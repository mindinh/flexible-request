import { cds, SELECT } from '../lib/db';
import { IdentityProvisioner } from '../lib/identity-provisioner';

/**
 * Managed User Handler
 * 
 * Automatically resolves the current user's ShadowUser UUID
 * and sets createdBy_ID / modifiedBy_ID on create/update operations.
 * 
 * This handler works with the custom managedWithUser aspect that uses
 * Association to ShadowUsers instead of string user IDs.
 */
export class ManagedUserHandler {

    private srv: cds.ApplicationService;
    private userCache: Map<string, string> = new Map();

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        // Register for all entity operations
        this.srv.before(['CREATE', 'UPDATE'], '*', this.resolveManagedUser.bind(this));
        console.log('[managed-user-handler] - Registered for CREATE/UPDATE operations');
    }

    /**
     * Before CREATE/UPDATE: Resolve user UUID from ShadowUsers
     */
    private async resolveManagedUser(req: cds.Request) {
        // Skip if no user context (system operations)
        if (!req.user?.id) return;

        const userId = req.user.id;

        // Skip for identity entities to avoid recursion
        const entityName = req.target?.name || '';
        if (entityName.includes('ShadowUsers') ||
            entityName.includes('ShadowGroups') ||
            entityName.includes('GroupMembers') ||
            entityName.includes('SupportTypes')) {
            return;
        }

        // Skip if data is not an object
        if (!req.data || typeof req.data !== 'object') return;

        // Get or resolve UUID using composite key (origin + userId)
        const origin = IdentityProvisioner.getOrigin(req.user);
        const cacheKey = `${origin}:${userId}`;
        let userUUID = this.userCache.get(cacheKey);

        if (!userUUID) {
            userUUID = await this.lookupUserUUID(userId, origin);
            if (userUUID) {
                this.userCache.set(cacheKey, userUUID);
            }
        }

        // If no UUID found, user doesn't exist in ShadowUsers yet (JIT not done)
        // In this case, we leave the fields null and let JIT create the user
        if (!userUUID) {
            console.warn(`[managed-user-handler] User ${userId} not found in ShadowUsers`);
            return;
        }

        // Handle array of data (batch operations)
        const items = Array.isArray(req.data) ? req.data : [req.data];

        for (const data of items) {
            // Set createdBy_ID on CREATE
            if (req.event === 'CREATE') {
                data.createdBy_ID = userUUID;
                data.modifiedBy_ID = userUUID;
            }
            // Set modifiedBy_ID on UPDATE
            else if (req.event === 'UPDATE') {
                data.modifiedBy_ID = userUUID;
            }
        }
    }

    /**
     * Lookup ShadowUser UUID by origin and userId
     */
    private async lookupUserUUID(userId: string, origin: string): Promise<string | null> {
        try {
            const { ShadowUsers } = this.srv.entities;
            const user = await SELECT.one.from(ShadowUsers)
                .where({ origin, userId })
                .columns('ID');
            return user?.ID || null;
        } catch (e) {
            console.error(`[managed-user-handler] Error looking up user ${origin}:${userId}:`, e);
            return null;
        }
    }
}
