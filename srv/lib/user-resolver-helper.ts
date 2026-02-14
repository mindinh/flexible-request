import { cds, SELECT } from './db';

/**
 * UserResolverHelper
 * 
 * Utility class to resolve IDP user identifiers (email, subject ID) 
 * to ShadowUser UUIDs. Includes in-memory caching for performance.
 * 
 * Usage:
 * const resolver = new UserResolverHelper(srv);
 * const uuid = await resolver.resolveUserUUID('alice@example.com');
 */
export class UserResolverHelper {

    private srv: cds.Service;
    private cache: Map<string, string> = new Map();
    private log = cds.log('user-resolver-helper');

    constructor(srv: cds.Service) {
        this.srv = srv;
    }

    /**
     * Resolve an IDP user identifier to its ShadowUser UUID.
     * Returns null if user is not found in ShadowUsers table.
     * 
     * @param userId - The IDP user identifier (email or subject ID)
     * @param origin - The IDP origin (e.g., 'sap.default', 'azure-ad'). Defaults to 'sap.default'
     * @returns The ShadowUser UUID or null if not found
     */
    async resolveUserUUID(userId: string, origin: string = 'sap.default'): Promise<string | null> {
        if (!userId) return null;

        // Create composite cache key
        const cacheKey = `${origin}:${userId}`;

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { ShadowUsers } = this.srv.entities;
            const user = await SELECT.one.from(ShadowUsers)
                .where({ origin: origin, userId: userId })
                .columns('ID') as { ID: string } | null;

            if (user?.ID) {
                this.cache.set(cacheKey, user.ID);
                return user.ID;
            }

            this.log.warn(`ShadowUser not found for IDP user: ${origin}:${userId}`);
            return null;
        } catch (e) {
            this.log.error(`Error resolving ShadowUser for ${origin}:${userId}:`, e);
            return null;
        }
    }

    /**
     * Bulk resolve multiple user IDs to UUIDs.
     * Useful for batch operations.
     * 
     * @param userIds - Array of IDP user identifiers
     * @param origin - The IDP origin (e.g., 'sap.default', 'azure-ad'). Defaults to 'sap.default'
     * @returns Map of userId -> UUID (only includes found users)
     */
    async resolveMultipleUsers(userIds: string[], origin: string = 'sap.default'): Promise<Map<string, string>> {
        const resultMap = new Map<string, string>();
        const toFetch: string[] = [];

        // Check cache first (using composite key)
        for (const userId of userIds) {
            const cacheKey = `${origin}:${userId}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                resultMap.set(userId, cached);
            } else {
                toFetch.push(userId);
            }
        }

        // Fetch remaining from DB using composite key (origin + userId)
        if (toFetch.length > 0) {
            try {
                const { ShadowUsers } = this.srv.entities;
                const users = await SELECT.from(ShadowUsers)
                    .where({ origin, userId: { in: toFetch } })
                    .columns('ID', 'userId') as { ID: string; userId: string }[];

                for (const user of users) {
                    const cacheKey = `${origin}:${user.userId}`;
                    this.cache.set(cacheKey, user.ID);
                    resultMap.set(user.userId, user.ID);
                }
            } catch (e) {
                this.log.error(`Error bulk resolving ShadowUsers for origin ${origin}:`, e);
            }
        }

        return resultMap;
    }

    /**
     * Clear the cache (useful for testing or memory management).
     */
    clearCache(): void {
        this.cache.clear();
    }
}
