import { cds, SELECT, UPDATE } from './db';

const LOG = cds.log('sla-job');

/**
 * SLA (Service Level Agreement) Job
 * 
 * Scheduled background job that:
 * 1. Finds steps where dueDate < now and status = STARTED/IN_PROGRESS
 * 2. Sends reminders (logs for now, could be email/notification)
 * 3. Marks reminderSent = true to avoid duplicate reminders
 */
export class SlaJob {

    /**
     * Run the SLA check
     * Should be called from a scheduled job (e.g., cds.on('bootstrap'))
     */
    public static async run(): Promise<{ checked: number; reminded: number }> {
        LOG.info('Starting SLA breach check...');

        const db = await cds.connect.to('db');
        const { Steps, Requests, StepDefinitions } = db.entities;

        const now = new Date().toISOString();

        // Find overdue steps that haven't been reminded
        // Status: STARTED (awaiting data) or IN_PROGRESS (awaiting approval)
        const overdueSteps = await SELECT.from(Steps)
            .where({
                status: { in: ['STARTED', 'IN_PROGRESS'] },
                reminderSent: false,
                dueDate: { '<': now }
            })
            .columns('ID', 'request_ID', 'stepDefinition_ID', 'dueDate');

        LOG.info(`Found ${overdueSteps.length} overdue step(s)`);

        let remindedCount = 0;

        for (const step of overdueSteps) {
            // Get step details for logging
            const stepDef = await SELECT.one.from(StepDefinitions, step.stepDefinition_ID)
                .columns('stepName');
            const request = await SELECT.one.from(Requests, step.request_ID)
                .columns('title', 'createdBy');

            // Log the reminder (in production: send email/notification)
            LOG.warn(`⚠️ OVERDUE: Step "${stepDef?.stepName}" for Request "${request?.title}" (Due: ${step.dueDate})`);
            LOG.info(`   Requester: ${request?.createdBy}`);

            // Mark as reminded
            await UPDATE(Steps, step.ID).with({ reminderSent: true });
            remindedCount++;
        }

        LOG.info(`Completed. Reminded: ${remindedCount}`);

        return { checked: overdueSteps.length, reminded: remindedCount };
    }

    /**
     * Schedule the job to run periodically
     * Call this from server.ts or bootstrap
     */
    public static scheduleDaily(intervalMs: number = 60 * 60 * 1000): void {
        LOG.info(`Scheduled to run every ${intervalMs / 1000 / 60} minutes`);

        setInterval(async () => {
            try {
                await SlaJob.run();
            } catch (error) {
                LOG.error('SLA Job Error:', error);
            }
        }, intervalMs);

        // Run once on startup after a delay
        // setTimeout(() => SlaJob.run(), 10000);
    }
}
