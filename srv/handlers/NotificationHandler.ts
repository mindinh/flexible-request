import cds from '@sap/cds';
import { SELECT, UPDATE } from '../lib/db';
import { EmailService } from '../lib/email-service';
import { IdentityProvisioner } from '../lib/identity-provisioner';

export class NotificationHandler {
    private static log = cds.log('notification-handler');

    static register(srv: cds.ApplicationService) {
        this.log.info('[notification-handler] Registering notifications logic...');

        // 1. Event Listeners (from workflow engine)
        (cds as any).on('sap.cre.StepApprovalCreated', async (data: any) => {
            await this.handleStepApprovalCreated(data.stepApprovalId, data.stepId, data.requestId);
        });

        (cds as any).on('sap.cre.StepActivated', async (data: any) => {
            await this.handleStepActivated(data.stepId, data.requestId);
        });

        // 2. Action Handlers (from frontend)
        srv.on('markAsRead', 'Notifications', async (req) => {
            const { ID } = req.params[0];
            await UPDATE('sap.cre.Notifications', ID).with({ isRead: true });
            return true;
        });

        srv.on('markAllAsRead', async (req) => {
            const userId = req.user.id;
            const origin = IdentityProvisioner.getOrigin(req.user);

            const db = await cds.connect.to('db');
            const { ShadowUsers } = db.entities('sap.cre');
            const user = await SELECT.one.from(ShadowUsers).where({ userId, origin });

            if (user) {
                await UPDATE('sap.cre.Notifications').where({ recipient_ID: user.ID }).with({ isRead: true });
            }
            return true;
        });

        srv.on('deleteAll', async (req) => {
            const userId = req.user.id;
            const origin = IdentityProvisioner.getOrigin(req.user);

            const db = await cds.connect.to('db');
            const { ShadowUsers } = db.entities('sap.cre');
            const user = await SELECT.one.from(ShadowUsers).where({ userId, origin });

            if (user) {
                const { Notifications } = db.entities('sap.cre');
                await db.delete(Notifications).where({ recipient_ID: user.ID });
            }
            return true;
        });
    }

    private static async handleStepActivated(stepId: string, requestId: string) {
        try {
            this.log.info(`[notification-handler] Processing StepActivated for step: ${stepId}`);

            const db = await cds.connect.to('db');
            const { Steps, Requests, ShadowUsers, GroupMembers } = db.entities('sap.cre');

            // 1. Fetch Step and Request
            const step = await SELECT.one.from(Steps, stepId).columns('ID', 'ownerId', 'ownerType');
            const request = await SELECT.one.from(Requests, requestId).columns('ID', 'displayId', 'title', 'priority');

            if (!step || !request) {
                this.log.warn(`[notification-handler] Missing data for step ${stepId} or request ${requestId}`);
                return;
            }

            // 2. Resolve owner IDs (could be multiple if group)
            const recipientIds: string[] = [];
            const groupTypes = ['GROUP', 'ROLE', 'TEAM', 'DEPARTMENT', 'POSITION'];

            if (step.ownerType === 'USER' && step.ownerId) {
                recipientIds.push(step.ownerId);
            } else if (groupTypes.includes(step.ownerType) && step.ownerId) {
                const members = await SELECT.from(GroupMembers).where({ group_ID: step.ownerId }).columns('user_ID');
                members.forEach((m: any) => { if (m.user_ID) recipientIds.push(m.user_ID); });
            }

            // 3. Create Notifications
            const title = 'Data Input Required';
            const message = `${request.displayId || 'Request'} needs your input`;

            for (const userId of recipientIds) {
                await this.createInAppNotification(userId, title, message, request, stepId, 'DATA_INPUT', 'Step Owner');
            }

        } catch (error: any) {
            this.log.error('[notification-handler] Failed to handle StepActivated:', error.message);
        }
    }

    private static async createInAppNotification(
        userId: string,
        title: string,
        message: string,
        request: any,
        stepId: string,
        type: string,
        role: string
    ) {
        const db = await cds.connect.to('db');
        const { Notifications } = db.entities('sap.cre');

        await db.create(Notifications).entries({
            recipient_ID: userId,
            title,
            message,
            priority: request.priority || 'MEDIUM',
            type,
            request_ID: request.ID,
            stepId,
            role
        });
        this.log.info(`[notification-handler] Created in-app notification (${type}) for user: ${userId}`);
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
            const request = await SELECT.one.from(Requests, requestId).columns('ID', 'displayId', 'title', 'priority', 'createdBy');

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

            // 4. Resolve Requester Name
            const requester = await SELECT.one.from(ShadowUsers).where({ ID: request.createdBy_ID }).columns('displayName', 'email');
            const requesterName = requester?.displayName || requester?.email || 'Requester';

            // 5. Build email content 
            const appUrl = process.env.APP_URL || 'https://conarum-gmbh---co--kg---payasyougo-conarum-demo-general145ef808.cfapps.eu10.hana.ondemand.com';
            const deepLink = `${appUrl}/request/${requestId}`;
            const subject = `New Approval Request [${request.displayId}] – Action Required`;

            const html = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; line-height: 1.6;">
                    <p>Dear Approver,</p>
                    
                    <p>You have been assigned a new request that requires your review and decision.</p>
                    <p>Please find the details below:</p>
                    
                    <ul style="list-style: none; padding-left: 20px;">
                        <li><strong>Request:</strong> ${requestId} - ${request.title}</li>
                        <li><strong>Step:</strong> ${approval.ruleName || step.stepDefinition?.stepName || 'Approval Step'}</li>
                        <li><strong>Priority:</strong> ${NotificationHandler.formatPriority(request.priority)}</li>
                        <li><strong>Created By:</strong> ${requesterName}</li>
                    </ul>

                    <p>Kindly review the request in the system and provide your approval or rejection at your earliest convenience.</p>
                    <p>You can access the request here:<br/>
                    <a href="${deepLink}" style="color: #0070f3; font-weight: bold; text-decoration: underline;">Open in ProRequest System</a></p>

                    <p>If you have any questions or require further clarification, please feel free to contact the requester.</p>

                    <p>Thank you for your prompt attention.</p>
                    <p>Best regards,<br/><strong>proRequest System</strong></p>
                </div>
            `;

            const text = `Dear Approver,\n\nYou have been assigned a new request that requires your review and decision.\n\nPlease find the details below:\n- Request: ${request.title}\n- Step: ${approval.ruleName || step.stepDefinition?.stepName}\n- Priority: ${NotificationHandler.formatPriority(request.priority)}\n- Created By: ${requesterName}\n\nKindly review the request in the system and provide your approval or rejection at your earliest convenience.\nYou can access the request here: ${deepLink}\n\nIf you have any questions or require further clarification, please feel free to contact the requester.\n\nThank you for your prompt attention.\n\nBest regards,\nproRequest System`;

            // 6. Create in-app notification records
            const notificationTitle = 'Approval Required';
            const notificationMessage = `Request ${request.displayId} needs your approval`;

            for (const email of recipientEmails) {
                const targetUser = await SELECT.one.from(ShadowUsers).where({ email }).columns('ID');
                if (targetUser) {
                    await this.createInAppNotification(
                        targetUser.ID,
                        notificationTitle,
                        notificationMessage,
                        request,
                        stepId,
                        'APPROVAL',
                        'Approver'
                    );
                }
            }

            // 6. Send to all resolved emails
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

    private static formatPriority(priority: string): string {
        const p = (priority || 'MEDIUM').toLowerCase();
        return p.charAt(0).toUpperCase() + p.slice(1);
    }
}
