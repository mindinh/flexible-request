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
            const { StepApprovals, Steps, Requests, RequestData, ShadowUsers, GroupMembers, StepDefinitions } = db.entities('sap.cre');

            // 1. Fetch Approval, Step (with stepDefinition), and Request
            const approval = await SELECT.one.from(StepApprovals, approvalId);
            const step = await SELECT.one.from(Steps, stepId)
                .columns((s: any) => { s.ID; s.stepDefinition_ID; s.stepDefinition((sd: any) => { sd.stepName; sd.notifications; sd.emailSubject; sd.emailBody; }); });
            const request = await SELECT.one.from(Requests, requestId).columns('ID', 'displayId', 'title', 'priority', 'createdBy');

            if (!approval || !step || !request) {
                throw new Error('Missing data for notification, aborting.');
            }

            // 2. Check if email notification is enabled for this step
            let notificationChannels: string[] = [];
            try {
                if (step.stepDefinition?.notifications) {
                    notificationChannels = JSON.parse(step.stepDefinition.notifications);
                }
            } catch { /* ignore parse error */ }

            const isEmailEnabled = notificationChannels.includes('email');
            this.log.info(`[notification-handler] Email enabled: ${isEmailEnabled}, channels: ${JSON.stringify(notificationChannels)}`);

            // 3. Resolve recipient emails (always needed for in-app notifications)
            const recipientEmails: string[] = [];
            const recipientUserIds: string[] = [];
            const groupTypes = ['GROUP', 'ROLE', 'TEAM', 'DEPARTMENT', 'POSITION'];

            if (approval.approverType === 'USER') {
                const user = await SELECT.one.from(ShadowUsers)
                    .where({ ID: approval.approver })
                    .columns('ID', 'email');
                if (user?.email) recipientEmails.push(user.email);
                if (user?.ID) recipientUserIds.push(user.ID);
            } else if (groupTypes.includes(approval.approverType)) {
                this.log.info(`[notification-handler] Resolving members for ${approval.approverType}: ${approval.approver}`);

                const members = await SELECT.from(GroupMembers)
                    .where({ group_ID: approval.approver })
                    .columns('user_ID');

                if (members.length > 0) {
                    const userIds = members.map((m: any) => m.user_ID).filter(Boolean);
                    this.log.info(`[notification-handler] Found ${userIds.length} member ID(s)`);

                    const users = await SELECT.from(ShadowUsers)
                        .where({ ID: { in: userIds } })
                        .columns('ID', 'email');

                    users.forEach((u: any) => {
                        if (u.email) recipientEmails.push(u.email);
                        if (u.ID) recipientUserIds.push(u.ID);
                    });
                } else {
                    this.log.warn(`[notification-handler] No members found for group ${approval.approver}`);
                }
            }

            // 4. Create in-app notification records (always)
            const notificationTitle = 'Approval Required';
            const notificationMessage = `Request ${request.displayId} needs your approval`;

            for (const userId of recipientUserIds) {
                await this.createInAppNotification(
                    userId,
                    notificationTitle,
                    notificationMessage,
                    request,
                    stepId,
                    'APPROVAL',
                    'Approver'
                );
            }

            // 5. Send email only if enabled in step definition
            if (!isEmailEnabled) {
                this.log.info(`[notification-handler] Email not enabled for this step, skipping email.`);
                return;
            }

            if (recipientEmails.length === 0) {
                this.log.warn(`[notification-handler] No email found for approver ${approval.approver} (${approval.approverType})`);
                return;
            }

            // 6. Build email content from step definition template (or use defaults)
            const appUrl = process.env.APP_URL || 'https://conarum-gmbh---co--kg---payasyougo-conarum-demo-general145ef808.cfapps.eu10.hana.ondemand.com';
            const deepLink = `${appUrl}/inbox/request/${requestId}`;
            const requester = await SELECT.one.from(ShadowUsers).where({ ID: request.createdBy_ID }).columns('displayName', 'email');
            const requesterName = requester?.displayName || requester?.email || 'Requester';
            const stepName = step.stepDefinition?.stepName || 'User Task';

            // Variable interpolation map — keys match SYSTEM_OUTPUT_FIELDS defined in the Studio UI
            const vars: Record<string, string> = {
                '{{__request_uuid}}': request.ID || '',
                '{{__request_displayId}}': request.displayId || '',
                '{{__request_title}}': request.title || '',
                '{{__requester_name}}': requesterName,
            };

            const interpolate = (template: string): string => {
                let result = template;
                for (const [key, value] of Object.entries(vars)) {
                    result = result.replaceAll(key, value);
                }
                return result;
            };

            const subject = step.stepDefinition?.emailSubject
                ? interpolate(step.stepDefinition.emailSubject)
                : '';

            const html = step.stepDefinition?.emailBody
                ? interpolate(step.stepDefinition.emailBody)
                : '';

            // 7. Send to all resolved emails
            this.log.info(`[notification-handler] Sending email to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}`);
            for (const email of recipientEmails) {
                await EmailService.sendMail({
                    to: email,
                    subject,
                    text: subject, // plain text fallback
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
