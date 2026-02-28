import { cds, SELECT, DELETE } from './db';

const LOG = cds.log('draft-job');

/**
 * Draft Garbage Collection Job
 * 
 * Scheduled background job that:
 * 1. Finds RequestTypes drafts older than the configured timeout
 * 2. Deletes them to prevent 409 Conflict errors on stuck/abandoned drafts
 * 
 * This uses the DraftAdministrativeData entity which CAP automatically
 * maintains for every draft-enabled entity.
 */
export class DraftJob {

    /**
     * Run the draft garbage collection.
     * Deletes RequestTypes drafts that haven't been modified within `maxAgeMs`.
     * 
     * @param maxAgeMs Maximum age in milliseconds before a draft is considered stale (default: 3 hours)
     */
    public static async run(maxAgeMs: number = 3 * 60 * 60 * 1000): Promise<{ checked: number; deleted: number }> {
        LOG.info('Starting draft garbage collection...');

        const DraftAdministrativeData = cds.entities['DRAFT.DraftAdministrativeData']
            || cds.entities['DraftAdministrativeData'];

        if (!DraftAdministrativeData) {
            LOG.warn('DraftAdministrativeData entity not found – no draft-enabled entities in model?');
            return { checked: 0, deleted: 0 };
        }

        const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

        // Find draft administrative records older than the cutoff
        // LastChangeDateTime tracks when the draft was last modified
        const staleDrafts = await SELECT.from(DraftAdministrativeData)
            .where({
                LastChangeDateTime: { '<': cutoff },
                // Only target drafts that are NOT currently being processed in-memory
                InProcessByUser: { '!=': '' }
            })
            .columns('DraftUUID', 'LastChangeDateTime', 'InProcessByUser', 'DraftIsCreatedByMe');

        LOG.info(`Found ${staleDrafts.length} stale draft(s) older than ${maxAgeMs / 1000 / 60 / 60}h`);

        let deletedCount = 0;

        for (const draft of staleDrafts) {
            try {
                LOG.warn(
                    `🗑️ Deleting stale draft: UUID=${draft.DraftUUID}, ` +
                    `LastChanged=${draft.LastChangeDateTime}, ` +
                    `LockedBy=${draft.InProcessByUser}`
                );

                // Delete the draft administrative data entry.
                // CAP cascade-deletes the associated draft entity rows.
                await DELETE.from(DraftAdministrativeData).where({ DraftUUID: draft.DraftUUID });
                deletedCount++;
            } catch (err: any) {
                LOG.error(`Failed to delete draft ${draft.DraftUUID}:`, err.message);
            }
        }

        LOG.info(`Draft GC completed. Checked: ${staleDrafts.length}, Deleted: ${deletedCount}`);
        return { checked: staleDrafts.length, deleted: deletedCount };
    }

    /**
     * Schedule the job to run periodically.
     * Call this from server.ts on startup.
     * 
     * @param intervalMs How often to run (default: 1 hour)
     * @param maxAgeMs Max draft age before deletion (default: 3 hours)
     */
    public static schedule(intervalMs: number = 60 * 60 * 1000, maxAgeMs: number = 3 * 60 * 60 * 1000): void {
        LOG.info(`Scheduled draft GC every ${intervalMs / 1000 / 60}min (max age: ${maxAgeMs / 1000 / 60 / 60}h)`);

        setInterval(async () => {
            try {
                await DraftJob.run(maxAgeMs);
            } catch (error) {
                LOG.error('Draft GC Job Error:', error);
            }
        }, intervalMs);

        // Run once on startup after a short delay
        setTimeout(() => DraftJob.run(maxAgeMs).catch(err => LOG.error('Initial draft GC failed:', err)), 15000);
    }
}
