import cds from '@sap/cds';
import { SlaJob } from './lib/sla-job';
import { DraftJob } from './lib/draft-job';
import { ObjectStoreProvider } from './lib/object-store';
import { IdentityProvisioner } from './lib/identity-provisioner';

const LOG = cds.log('server');

/**
 * Custom Server Bootstrap
 * 
 * This file is loaded by CAP on startup to perform custom initialization.
 * Reference: https://cap.cloud.sap/docs/node.js/cds-serve#custom-server-ts
 */
// Export using CommonJS-compatible syntax for CAP server bootstrap
// Using 'export =' ensures the server is correctly loaded in production (CF)
// Reference: https://cap.cloud.sap/docs/node.js/cds-serve#custom-server-ts
export = cds.server;

// JIT User Provisioning - provision ShadowUser on first access
// TTL Cache: Prevents DB queries on every request (~94% reduction)
const jitCache = new Map<string, number>();
const JIT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Rate Limiting: Prevent excessive provisioning attempts
const provisioningWindowStart = { time: Date.now() };
let provisioningCount = 0;
const MAX_PROVISIONS_PER_MINUTE = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

cds.on('bootstrap', (app) => {
    app.use(async (req: any, _res: any, next: any) => {
        // Only provision for authenticated requests with user info
        if (req.user?.id && req.user.id !== 'anonymous') {
            const userId = req.user.id;
            const lastSeen = jitCache.get(userId);
            const now = Date.now();

            // Only provision if not seen recently (within TTL)
            if (!lastSeen || now - lastSeen > JIT_CACHE_TTL_MS) {
                // Rate limiting check
                if (now - provisioningWindowStart.time > RATE_LIMIT_WINDOW_MS) {
                    // Reset window
                    provisioningWindowStart.time = now;
                    provisioningCount = 0;
                }

                if (provisioningCount >= MAX_PROVISIONS_PER_MINUTE) {
                    LOG.warn(`Rate limit exceeded: ${provisioningCount} provisions in window`);
                } else {
                    provisioningCount++;
                    jitCache.set(userId, now);
                    // Fire and forget - don't block the request
                    IdentityProvisioner.provisionUser(req.user).catch((err) => {
                        LOG.error('JIT Provisioning Error:', err.message);
                        jitCache.delete(userId); // Allow retry on failure
                    });
                }
            }
        }
        next();
    });

    // Cleanup stale cache entries every 10 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [userId, timestamp] of jitCache.entries()) {
            if (now - timestamp > JIT_CACHE_TTL_MS * 2) {
                jitCache.delete(userId);
            }
        }
    }, 10 * 60 * 1000);
});

// Initialize services after bootstrap
cds.on('served', () => {
    LOG.info('All services served. Initializing background services...');

    // Initialize Object Store Provider
    ObjectStoreProvider.initialize();

    // Schedule SLA job
    const slaIntervalMs = process.env.SLA_CHECK_INTERVAL_MS
        ? parseInt(process.env.SLA_CHECK_INTERVAL_MS)
        : 60 * 60 * 1000; // Default: 1 hour

    SlaJob.scheduleDaily(slaIntervalMs);

    // Schedule Draft Garbage Collection
    const draftGcIntervalMs = process.env.DRAFT_GC_INTERVAL_MS
        ? parseInt(process.env.DRAFT_GC_INTERVAL_MS)
        : 60 * 60 * 1000; // Default: 1 hour
    const draftMaxAgeMs = process.env.DRAFT_MAX_AGE_MS
        ? parseInt(process.env.DRAFT_MAX_AGE_MS)
        : 3 * 60 * 60 * 1000; // Default: 3 hours

    DraftJob.schedule(draftGcIntervalMs, draftMaxAgeMs);
});
