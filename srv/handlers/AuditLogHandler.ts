import { cds, SELECT } from '../lib/db';

/**
 * AuditLogHandler
 * 
 * Provides a unified view of Request and Step history
 * by merging both tables into a single chronological feed.
 */
export class AuditLogHandler {

    private srv: cds.ApplicationService;
    private log = cds.log('audit-log');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all audit log handlers
     */
    register() {
        // Register as unbound function on the service
        this.srv.on('getAuditLog', this.onGetAuditLog.bind(this));
    }

    /**
     * Returns a unified audit log combining RequestHistory and StepHistory
     */
    private async onGetAuditLog(req: cds.Request) {
        const { RequestHistory, StepHistory, Steps, StepDefinitions, ShadowUsers } = this.srv.entities;
        const { requestId } = req.data as { requestId: string };

        if (!requestId) {
            return req.error(400, 'requestId is required');
        }

        this.log.info(`Getting audit log for Request: ${requestId}`);

        // 1. Fetch Request History (use actor_ID - the FK column name)
        const requestHistory = await SELECT.from(RequestHistory)
            .where({ request_ID: requestId })
            .columns('ID', 'action', 'actor_ID', 'timestamp', 'comment') as {
                ID: string;
                action: string;
                actor_ID: string | null;
                timestamp: string;
                comment: string;
            }[];

        // 2. Fetch Step History with Step names
        // First get all steps for this request
        const steps = await SELECT.from(Steps)
            .where({ request_ID: requestId })
            .columns('ID', 'stepDefinition_ID') as {
                ID: string;
                stepDefinition_ID: string;
            }[];

        const stepIds = steps.map(s => s.ID);

        // Build step ID to definition ID map
        const stepToDefMap = new Map<string, string>();
        steps.forEach(s => stepToDefMap.set(s.ID, s.stepDefinition_ID));

        // Fetch all step definitions for names
        const defIds = [...new Set(steps.map(s => s.stepDefinition_ID))];
        const definitions = defIds.length > 0
            ? await SELECT.from(StepDefinitions)
                .where({ ID: { in: defIds } })
                .columns('ID', 'stepName') as { ID: string; stepName: string }[]
            : [];

        const defNameMap = new Map<string, string>();
        definitions.forEach(d => defNameMap.set(d.ID, d.stepName));

        // Fetch step history (use actor_ID - the FK column name)
        const stepHistory = stepIds.length > 0
            ? await SELECT.from(StepHistory)
                .where({ step_ID: { in: stepIds } })
                .columns('ID', 'step_ID', 'action', 'actor_ID', 'timestamp', 'comment', 'fromValue', 'toValue') as {
                    ID: string;
                    step_ID: string;
                    action: string;
                    actor_ID: string | null;
                    timestamp: string;
                    comment: string;
                    fromValue: string;
                    toValue: string;
                }[]
            : [];

        // 3. Collect all actor UUIDs for bulk lookup
        const actorIds = new Set<string>();
        for (const entry of requestHistory) {
            if (entry.actor_ID) actorIds.add(entry.actor_ID);
        }
        for (const entry of stepHistory) {
            if (entry.actor_ID) actorIds.add(entry.actor_ID);
        }

        // 4. Bulk fetch actor display names
        const actorNameMap = new Map<string, string>();
        if (actorIds.size > 0) {
            try {
                const users = await SELECT.from(ShadowUsers)
                    .where({ ID: { in: [...actorIds] } })
                    .columns('ID', 'displayName', 'email') as { ID: string; displayName: string; email: string }[];
                for (const user of users) {
                    actorNameMap.set(user.ID, user.displayName || user.email || user.ID);
                }
            } catch (e) {
                this.log.warn('Failed to fetch actor display names', e);
            }
        }

        // 5. Merge and transform
        interface AuditLogEntry {
            ID: string;
            source: 'REQUEST' | 'STEP';
            action: string;
            actor: string;          // Display name or 'system'
            actorId: string | null; // UUID for linking
            timestamp: string;
            comment: string | null;
            stepName: string | null;
            fromValue: string | null;
            toValue: string | null;
        }

        const auditLog: AuditLogEntry[] = [];

        // Add request history entries
        for (const entry of requestHistory) {
            const actorName = entry.actor_ID
                ? (actorNameMap.get(entry.actor_ID) || entry.actor_ID)
                : 'system';

            auditLog.push({
                ID: entry.ID,
                source: 'REQUEST',
                action: entry.action,
                actor: actorName,
                actorId: entry.actor_ID,
                timestamp: entry.timestamp,
                comment: entry.comment,
                stepName: null,
                fromValue: null,
                toValue: null
            });
        }

        // Add step history entries with step names
        for (const entry of stepHistory) {
            const defId = stepToDefMap.get(entry.step_ID);
            const stepName = defId ? defNameMap.get(defId) : null;
            const actorName = entry.actor_ID
                ? (actorNameMap.get(entry.actor_ID) || entry.actor_ID)
                : 'system';

            auditLog.push({
                ID: entry.ID,
                source: 'STEP',
                action: entry.action,
                actor: actorName,
                actorId: entry.actor_ID,
                timestamp: entry.timestamp,
                comment: entry.comment,
                stepName: stepName || 'Unknown Step',
                fromValue: entry.fromValue,
                toValue: entry.toValue
            });
        }

        // 6. Sort by timestamp descending (most recent first)
        auditLog.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });

        this.log.info(`Returning ${auditLog.length} audit log entries`);
        return auditLog;
    }
}
