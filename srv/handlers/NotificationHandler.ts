import cds from '@sap/cds';
import { SELECT } from '../lib/db';
import { EmailService } from '../lib/email-service';

export class NotificationHandler {
    private static log = cds.log('notification-handler');

    static register() {
        this.log.info('[notification-handler] Registering StepApprovalCreated listener...');

        (cds as any).on('sap.cre.StepApprovalCreated', async (data: any) => {
            await this.handleStepApprovalCreated(data.stepApprovalId, data.stepId, data.requestId);
        });
    }

    private static async handleStepApprovalCreated(approvalId: string, stepId: string, requestId: string) {
        try {
            this.log.info(`[notification-handler] Processing notification for approval: ${approvalId}`);

            const db = await cds.connect.to('db');
            const { StepApprovals, Steps, Requests, RequestData, ShadowUsers, GroupMembers } = db.entities('sap.cre');

            // 1. Fetch Approval, Step, and Request
            const approval = await SELECT.one.from(StepApprovals, approvalId);
            const step = await SELECT.one.from(Steps, stepId)
                .columns((s: any) => { s.ID; s.stepDefinition((sd: any) => { sd.stepName; }); });
            const request = await SELECT.one.from(Requests, requestId).columns('ID', 'title', 'priority', 'createdBy');

            if (!approval || !step || !request) {
                throw new Error('Missing data for notification, aborting.');
            }

            // 2. Resolve recipient emails
            const recipientEmails: string[] = [];
            const groupTypes = ['GROUP', 'ROLE', 'TEAM', 'DEPARTMENT', 'POSITION'];

            if (approval.approverType === 'USER') {
                const user = await SELECT.one.from(ShadowUsers)
                    .where({ ID: approval.approver })
                    .columns('email');
                if (user?.email) recipientEmails.push(user.email);
            } else if (groupTypes.includes(approval.approverType)) {
                this.log.info(`[notification-handler] Resolving members for ${approval.approverType}: ${approval.approver}`);

                // Fetch member IDs first
                const members = await SELECT.from(GroupMembers)
                    .where({ group_ID: approval.approver })
                    .columns('user_ID');

                if (members.length > 0) {
                    const userIds = members.map((m: any) => m.user_ID).filter(Boolean);
                    this.log.info(`[notification-handler] Found ${userIds.length} member ID(s)`);

                    // Fetch emails for these users
                    const users = await SELECT.from(ShadowUsers)
                        .where({ ID: { in: userIds } })
                        .columns('email');

                    users.forEach((u: any) => {
                        if (u.email) recipientEmails.push(u.email);
                    });
                } else {
                    this.log.warn(`[notification-handler] No members found for group ${approval.approver}`);
                }
            }

            if (recipientEmails.length === 0) {
                this.log.warn(`[notification-handler] No email found for approver ${approval.approver} (${approval.approverType})`);
                return;
            }

            // 3. Fetch submitted data summary
            const stepData = await SELECT.one.from(RequestData).where({ step_ID: stepId });
            let dataSummary = 'No additional data.';
            if (stepData?.payload) {
                try {
                    const parsed = JSON.parse(stepData.payload);
                    dataSummary = Object.entries(parsed)
                        .filter(([k, v]) => k !== 'ID' && v !== null && v !== '')
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n');
                } catch { /* ignore parse error */ }
            }

            // 4. Build email content
            const appUrl = process.env.APP_URL || 'https://flexible-request-management.cfapps.eu10.hana.ondemand.com';
            const deepLink = `${appUrl}/request-management#Requests-display?ID=${requestId}`;
            const subject = `Action Required: ${request.title}`;

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 620px; margin: auto; padding: 24px; border: 1px solid #e8e8e8; border-radius: 8px; color: #333;">
                    <h2 style="color: #0070f3; margin-top: 0;">📋 New Approval Task Assigned</h2>
                    <p>A new request requires your review in <strong>ProRequest</strong>.</p>

                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                        <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold;width:140px;">Request</td><td style="padding:8px 12px;">${request.title}</td></tr>
                        <tr><td style="padding:8px 12px;font-weight:bold;">Step</td><td style="padding:8px 12px;">${approval.ruleName || step.stepDefinition?.stepName || 'Approval Step'}</td></tr>
                        <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold;">Priority</td><td style="padding:8px 12px;">${request.priority || '-'}</td></tr>
                        <tr><td style="padding:8px 12px;font-weight:bold;">Submitted By</td><td style="padding:8px 12px;">${request.createdBy || '-'}</td></tr>
                    </table>

                    <h4 style="margin-bottom:4px;">Submitted Data:</h4>
                    <pre style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap;">${dataSummary}</pre>

                    <div style="margin-top: 24px; text-align: center;">
                        <a href="${deepLink}" style="background-color:#0070f3;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
                            Open in My Inbox →
                        </a>
                    </div>

                    <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
                    <p style="font-size:11px;color:#aaa;text-align:center;">This is an automated message from ProRequest. Please do not reply.</p>
                </div>
            `;

            // 5. Send to all resolved emails
            this.log.info(`[notification-handler] Sending to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}`);
            for (const email of recipientEmails) {
                await EmailService.sendMail({
                    to: email,
                    subject,
                    text: `Action Required: ${request.title}\nStep: ${approval.ruleName || step.stepDefinition?.stepName}\nLink: ${deepLink}`,
                    html
                });
            }

        } catch (error: any) {
            NotificationHandler.log.error('[notification-handler] Failed to process notification:', error.message);
        }
    }
}
