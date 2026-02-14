import { cds, SELECT, INSERT, UPDATE, DELETE } from './db';

/**
 * ShadowUser type (matches db/schema/identity.cds)
 */
interface ShadowUser {
    ID: string;
    origin: string;    // IDP origin (e.g., 'sap.default', 'sap.custom', 'azure-ad')
    userId: string;
    idpUserId?: string; // Stable IDP user UUID (user_uuid from JWT) - never changes
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    isActive?: boolean;
    lastLoginAt?: Date;
}

/**
 * JIT User Provisioning Service
 * 
 * Auto-provisions users into the Shadow Directory on first login.
 * Updates lastLoginAt on subsequent logins.
 * 
 * This ensures every authenticated user has a ShadowUser record
 * that can be used for group membership and approval assignments.
 */
export class IdentityProvisioner {
    private static log = cds.log('identity');
    private static isProcessing = new Set<string>();

    /**
     * Extract IDP origin from CAP user object.
     * Checks JWT payload first, then falls back to attribute locations.
     * 
     * @param user - CAP user object from request context
     * @returns The IDP origin string (e.g., 'sap.default', 'sap.custom', 'azure-ad')
     */
    static getOrigin(user: cds.User): string {
        this.log.info(`[ORIGIN-DEBUG] Extracting origin for user: ${user.id}`);

        try {
            // Primary: Extract origin from JWT payload using authInfo.token API
            const authInfo = (user as any).authInfo;
            this.log.info(`[ORIGIN-DEBUG] authInfo exists: ${!!authInfo}`);

            if (authInfo?.token?.getPayload) {
                const payload = authInfo.token.getPayload();
                this.log.info(`[ORIGIN-DEBUG] JWT payload origin: ${payload?.origin}`);
                if (payload?.origin) {
                    return payload.origin;
                }
            }
        } catch (error) {
            this.log.warn('[ORIGIN-DEBUG] Could not extract origin from JWT payload:', error);
        }

        // Fallback: Check various attribute locations
        const attr = user.attr as Record<string, any> | undefined;
        this.log.info(`[ORIGIN-DEBUG] user.attr: ${JSON.stringify(attr)}`);
        this.log.info(`[ORIGIN-DEBUG] (user as any).origin: ${(user as any).origin}`);

        const origin = (user as any).origin                               // CAP may expose directly
            ?? attr?.origin                                       // Standard attribute
            ?? attr?.ext_attr?.origin                             // Extended attributes
            ?? attr?.['xs.user.attributes']?.origin?.[0]          // XSUAA specific
            ?? attr?.zdn                                          // Zone Distinguished Name
            ?? 'sap.default';                                     // Fallback

        this.log.info(`[ORIGIN-DEBUG] Final resolved origin: ${origin}`);
        return origin;
    }

    /**
     * Extract stable IDP user UUID from CAP user object.
     * Uses authInfo.token (new API) to access JWT payload.
     * 
     * @param user - CAP user object from request context
     * @returns The stable user_uuid from IDP, or undefined if not available
     */
    static getIdpUserId(user: cds.User): string | undefined {
        try {
            // New API: authInfo.token.getPayload()
            const authInfo = (user as any).authInfo;
            if (authInfo?.token?.getPayload) {
                const payload = authInfo.token.getPayload();
                return payload?.user_uuid;
            }

            // Fallback to direct attributes
            const attr = user.attr as Record<string, any> | undefined;
            return attr?.user_uuid ?? attr?.sub;
        } catch (error) {
            this.log.debug('Could not extract idpUserId from JWT:', error);
            return undefined;
        }
    }

    /**
     * Provision or update a user in the Shadow Directory.
     * Called on every authenticated request (debounced).
     * 
     * @param user - CAP user object from request context
     * @returns The ShadowUser record
     */
    static async provisionUser(user: cds.User): Promise<ShadowUser | null> {
        if (!user?.id) {
            return null;
        }

        // Debounce: Skip if already processing this user
        if (this.isProcessing.has(user.id)) {
            return null;
        }

        try {
            this.isProcessing.add(user.id);

            const db = await cds.connect.to('db');
            const { ShadowUsers } = db.entities('sap.cre');

            // Extract user info from CAP user (populated from JWT)
            const userId = user.id;
            const origin = this.getOrigin(user);

            // Extract stable IDP user UUID from JWT payload (using new authInfo.token API)
            const idpUserId = this.getIdpUserId(user);

            const email = user.attr?.email ?? user.id;
            const firstName = user.attr?.given_name ?? user.attr?.givenName ?? '';
            const lastName = user.attr?.family_name ?? user.attr?.familyName ?? '';
            const displayName = user.attr?.name ??
                (firstName && lastName ? `${firstName} ${lastName}` : email);

            this.log.debug(`JIT provisioning for user: ${origin}:${userId}`);

            // Check if user exists using composite key (origin + userId)
            const existing = await SELECT.one.from(ShadowUsers)
                .where({ origin, userId }) as ShadowUser | null;

            if (existing) {
                // Update lastLoginAt
                await UPDATE(ShadowUsers).where({ ID: existing.ID }).set({ lastLoginAt: new Date() });
                this.log.debug(`Updated lastLoginAt for user: ${origin}:${userId}`);

                // Sync SAML group memberships on every login
                await this.syncSamlGroups(existing, user);

                return existing;
            }

            // Email change recovery: Check if user exists with same idpUserId but different email
            if (idpUserId) {
                const existingByIdp = await SELECT.one.from(ShadowUsers)
                    .where({ origin, idpUserId }) as ShadowUser | null;

                if (existingByIdp) {
                    // User changed their email in IDP - update the record
                    await UPDATE(ShadowUsers).where({ ID: existingByIdp.ID }).set({
                        userId,
                        email,
                        firstName,
                        lastName,
                        displayName,
                        lastLoginAt: new Date()
                    });
                    this.log.info(`Email change detected for idpUserId ${idpUserId}: ${existingByIdp.userId} → ${userId}`);

                    // Sync SAML groups after email change recovery
                    await this.syncSamlGroups(existingByIdp, user);

                    return { ...existingByIdp, userId, email, firstName, lastName, displayName };
                }
            }

            // Create new user with origin and IDP user UUID
            const newUser = {
                origin,      // IDP origin
                userId,
                idpUserId,   // Stable IDP user UUID
                email,
                firstName,
                lastName,
                displayName,
                isActive: true,
                lastLoginAt: new Date()
            };

            await INSERT.into(ShadowUsers).entries(newUser);

            this.log.info(`JIT provisioned new user: ${origin}:${userId} (${displayName})`);

            // Fetch the created record using composite key
            const created = await SELECT.one.from(ShadowUsers)
                .where({ origin, userId }) as ShadowUser | null;

            // Sync SAML groups for new user
            if (created) {
                await this.syncSamlGroups(created, user);
            }

            return created;

        } catch (error) {
            this.log.error(`Failed to provision user ${user.id}:`, error);
            return null;
        } finally {
            this.isProcessing.delete(user.id);
        }
    }

    /**
     * Get ShadowUser by CAP user ID and optional origin.
     * If origin is not provided, returns the first match (legacy behavior).
     */
    static async getShadowUser(userId: string, origin?: string): Promise<ShadowUser | null> {
        try {
            const db = await cds.connect.to('db');
            const { ShadowUsers } = db.entities('sap.cre');

            // Use composite key if origin provided
            const whereClause = origin
                ? { origin, userId }
                : { userId };

            const userRecord = await SELECT.one.from(ShadowUsers)
                .where(whereClause) as ShadowUser | null;

            return userRecord ?? null;
        } catch (error) {
            this.log.error(`Failed to get shadow user ${origin || 'any'}:${userId}:`, error);
            return null;
        }
    }

    /**
     * Get all group IDs that a user belongs to.
     * Used for RLS and inbox filtering.
     */
    static async getUserGroupIds(shadowUserId: string): Promise<string[]> {
        try {
            const db = await cds.connect.to('db');
            const { GroupMembers } = db.entities('sap.cre');

            const memberships = await SELECT.from(GroupMembers)
                .columns('group_ID')
                .where({ user_ID: shadowUserId }) as Array<{ group_ID: string }>;

            return memberships.map((m: { group_ID: string }) => m.group_ID);
        } catch (error) {
            this.log.error(`Failed to get user groups for ${shadowUserId}:`, error);
            return [];
        }
    }

    /**
     * Extract SAML groups from JWT payload.
     */
    private static getSamlGroups(user: cds.User): string[] {
        try {
            const authInfo = (user as any).authInfo;
            if (authInfo?.token?.getPayload) {
                const payload = authInfo.token.getPayload();
                // Check multiple possible locations for SAML groups
                return payload?.['xs.saml.groups']
                    || payload?.['xs.system.attributes']?.['xs.saml.groups']
                    || [];
            }
            return [];
        } catch (error) {
            this.log.debug('Could not extract SAML groups from JWT:', error);
            return [];
        }
    }

    /**
     * Sync SAML group memberships for a user.
     * 
     * Bi-directional sync:
     * - Adds user to local groups that are mapped to their current SAML groups
     * - Removes user from local groups that are mapped to SAML groups they no longer have
     * - Only affects memberships with source='SAML' (manual assignments are preserved)
     * 
     * @param shadowUser - The ShadowUser record
     * @param capUser - The CAP user object (contains JWT)
     */
    static async syncSamlGroups(shadowUser: ShadowUser, capUser: cds.User): Promise<void> {
        try {
            const samlGroups = this.getSamlGroups(capUser);

            const db = await cds.connect.to('db');
            const { SamlGroupMappings, GroupMembers } = db.entities('sap.cre');

            // Get all enabled SAML mappings
            const mappings = await SELECT.from(SamlGroupMappings)
                .where({ isEnabled: true }) as Array<{ externalGroupName: string; localGroup_ID: string }>;

            if (mappings.length === 0) {
                return; // No mappings configured
            }

            // Get current SAML-sourced memberships for this user
            const currentSamlMemberships = await SELECT.from(GroupMembers)
                .where({ user_ID: shadowUser.ID, source: 'SAML' }) as Array<{ ID: string; group_ID: string }>;

            // Build sets for comparison
            const currentGroupIds = new Set(currentSamlMemberships.map(m => m.group_ID));
            const expectedGroupIds = new Set<string>();

            // Determine which groups the user should belong to based on SAML claims
            for (const mapping of mappings) {
                if (samlGroups.includes(mapping.externalGroupName)) {
                    expectedGroupIds.add(mapping.localGroup_ID);
                }
            }

            // ADD: Groups user should have but doesn't
            for (const groupId of expectedGroupIds) {
                if (!currentGroupIds.has(groupId)) {
                    // Check if user is already a member via manual assignment
                    const existingManual = await SELECT.one.from(GroupMembers)
                        .where({ user_ID: shadowUser.ID, group_ID: groupId, source: 'MANUAL' });

                    if (!existingManual) {
                        await INSERT.into(GroupMembers).entries({
                            user_ID: shadowUser.ID,
                            group_ID: groupId,
                            source: 'SAML',
                            addedAt: new Date()
                        });
                        this.log.info(`SAML: Added ${shadowUser.userId} to group ${groupId}`);
                    }
                }
            }

            // REMOVE: Groups user has but shouldn't (only SAML-sourced)
            for (const membership of currentSamlMemberships) {
                if (!expectedGroupIds.has(membership.group_ID)) {
                    await DELETE.from(GroupMembers).where({ ID: membership.ID });
                    this.log.info(`SAML: Removed ${shadowUser.userId} from group ${membership.group_ID} (no longer in IDP)`);
                }
            }
        } catch (error) {
            this.log.error(`Failed to sync SAML groups for user ${shadowUser.userId}:`, error);
            // Don't throw - SAML sync failure shouldn't block login
        }
    }
}
