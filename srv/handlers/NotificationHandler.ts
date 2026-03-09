import cds from '@sap/cds';
import { SELECT, UPDATE } from '../lib/db';
import { EmailService } from '../lib/email-service';
import { IdentityProvisioner } from '../lib/identity-provisioner';
import { formatEnumLabel } from '../lib/utils';

// ────────────────────────────────────────────────────────────────────────────
// Shared contract: mirrors app/.../studio/types.ts NotificationsContent
// ────────────────────────────────────────────────────────────────────────────
interface EmailConfig {
    recipientMode?: string;   // 'requester' | 'step_owner' | 'coordinator' | 'approvers' | 'custom'
    customRecipients?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
}

interface BellConfig {
    titleTemplate?: string;
    bodyTemplate?: string;
    typeTemplate?: string;
    priorityTemplate?: string;
    roleTemplate?: string;
}

interface ParsedNotificationsContent {
    channels: string[];
    emailConfig?: EmailConfig;
    bellConfig?: BellConfig;
}

/**
 * Parse notificationsContent from DB (LargeString).
 *
 * Handles:
 *  1. null/undefined → default (both channels on)
 *  2. Legacy string[] like `["bell","email"]`
 *  3. New object `{ channels: [...], emailConfig?: {...} }`
 */
function parseNotificationsContent(raw?: string | null): ParsedNotificationsContent {
    const DEFAULT: ParsedNotificationsContent = { channels: [] };
    if (!raw) return DEFAULT;

    try {
        const parsed = JSON.parse(raw);

        // Legacy: bare array
        if (Array.isArray(parsed)) {
            return { channels: parsed.map((c: unknown) => String(c).toLowerCase()) };
        }

        // New contract
        if (parsed && typeof parsed === 'object') {
            const channels = Array.isArray(parsed.channels)
                ? parsed.channels.map((c: unknown) => String(c).toLowerCase())
                : DEFAULT.channels;
            return {
                channels,
                emailConfig: parsed.emailConfig ?? undefined,
                bellConfig: parsed.bellConfig ?? undefined
            };
        }
    } catch { /* fall through */ }

    return DEFAULT;
}

export class NotificationHandler {
    private static log = cds.log('notification-handler');

    static register(srv: cds.ApplicationService) {
        this.log.info('[notification-handler] Registering notifications logic...');

        // 1. Event Listeners (from workflow engine)
        (cds as any).on('sap.cre.StepApprovalCreated', async (data: any) => {
            await this.handleStepApprovalCreated(data);
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

    // ─────────────────────────────────────────────────────────────────────────
    // StepActivated – step owner (data-entry) notifications
    // Now honors channel config from StepDefinition.notificationsContent
    // ─────────────────────────────────────────────────────────────────────────
    public static async handleStepActivated(stepId: string, requestId: string) {
        try {
            this.log.info(`[notification-handler] Processing StepActivated for step: ${stepId}, request: ${requestId}`);

            const db = await cds.connect.to('db');
            const { Steps, Requests, ShadowUsers, GroupMembers, StepDefinitions } = db.entities('sap.cre');

            // 1. Fetch Step and Request
            const step = await SELECT.one.from(Steps, stepId).columns('ID', 'ownerId', 'ownerType', 'stepDefinition_ID');
            const request = await SELECT.one.from(Requests, requestId).columns('ID', 'displayId', 'title', 'priority', 'createdBy_ID');

            if (!step || !request) {
                this.log.warn(`[notification-handler] Missing data for step ${stepId} or request ${requestId}`);
                return;
            }

            // 2. Read channel config and templates from StepDefinition
            let notifConfig: ParsedNotificationsContent = { channels: [] };
            let sidebarEmailSubject: string | null = null;
            let sidebarEmailBody: string | null = null;

            if (step.stepDefinition_ID) {
                const stepDef = await SELECT.one.from(StepDefinitions)
                    .where({ ID: step.stepDefinition_ID })
                    .columns('notificationsContent', 'emailSubject', 'emailBody') as {
                        notificationsContent?: string | null,
                        emailSubject?: string | null,
                        emailBody?: string | null
                    } | null;

                notifConfig = parseNotificationsContent(stepDef?.notificationsContent);
                sidebarEmailSubject = stepDef?.emailSubject || null;
                sidebarEmailBody = stepDef?.emailBody || null;
            }

            const sendBell = notifConfig.channels.includes('bell') || notifConfig.channels.includes('in-app');
            const sendEmail = notifConfig.channels.includes('email');

            if (!sendBell && !sendEmail) {
                this.log.info(`[notification-handler] StepActivated: no channels enabled for step ${stepId} — skipping.`);
                return;
            }

            // 3. Resolve owner IDs (could be multiple if group)
            const recipientIds: string[] = [];
            const recipientEmails: string[] = [];
            const groupTypes = ['GROUP', 'ROLE', 'TEAM', 'DEPARTMENT', 'POSITION'];

            if (step.ownerType === 'USER' && step.ownerId) {
                const resolvedId = await this.resolveShadowUserId(step.ownerId);
                if (resolvedId) {
                    recipientIds.push(resolvedId);
                    if (sendEmail) {
                        const user = await SELECT.one.from(ShadowUsers).where({ ID: resolvedId }).columns('email');
                        if (user?.email) recipientEmails.push(user.email);
                    }
                }
            } else if (groupTypes.includes(step.ownerType) && step.ownerId) {
                const members = await SELECT.from(GroupMembers).where({ group_ID: step.ownerId }).columns('user_ID');
                const memberIds = members.map((m: any) => m.user_ID).filter(Boolean);
                recipientIds.push(...memberIds);

                if (sendEmail && memberIds.length > 0) {
                    const users = await SELECT.from(ShadowUsers)
                        .where({ ID: { in: memberIds } })
                        .columns('ID', 'email');
                    users.forEach((u: any) => { if (u.email) recipientEmails.push(u.email); });
                }
            }

            // Dedupe
            const uniqueRecipientIds = [...new Set(recipientIds)];
            const uniqueEmails = [...new Set(recipientEmails)];

            // 4. Resolve Variables for templates
            const requester = await SELECT.one.from(ShadowUsers).where({ ID: request.createdBy_ID }).columns('displayName', 'email');
            const requesterName = requester?.displayName || requester?.email || 'Requester';

            const appUrl = process.env.APP_URL || 'https://conarum-gmbh---co--kg---payasyougo-conarum-demo-general145ef808.cfapps.eu10.hana.ondemand.com';
            const deepLink = `${appUrl}/inbox/request/${requestId}`;

            // 5. Create bell notifications
            if (sendBell) {
                const bellCfg = notifConfig.bellConfig;
                const title = bellCfg?.titleTemplate
                    ? this.renderTemplate(bellCfg.titleTemplate, request, requesterName)
                    : 'Data Input Required';
                const message = bellCfg?.bodyTemplate
                    ? this.renderTemplate(bellCfg.bodyTemplate, request, requesterName, deepLink)
                    : `${request.displayId || 'Request'} needs your input`;
                const type = this.renderTemplate(bellCfg?.typeTemplate || 'DATA_INPUT', request, requesterName);
                const priority = this.renderTemplate(bellCfg?.priorityTemplate || (request.priority || 'MEDIUM'), request, requesterName);
                const role = this.renderTemplate(bellCfg?.roleTemplate || 'Step Owner', request, requesterName);

                for (const userId of uniqueRecipientIds) {
                    await this.createInAppNotification(userId, title, message, request, stepId, type, role, priority);
                }
                this.log.info(`[notification-handler] StepActivated: sent ${uniqueRecipientIds.length} bell notification(s) for step ${stepId}`);
            }

            // 6. Send email if enabled
            if (sendEmail && uniqueEmails.length > 0) {
                // Use custom template from emailConfig (Editor) or top-level columns (Sidebar)
                const emailCfg = notifConfig.emailConfig;
                const subject = (emailCfg?.subjectTemplate || sidebarEmailSubject)
                    ? this.renderTemplate(emailCfg?.subjectTemplate || sidebarEmailSubject!, request, requesterName)
                    : `Data Input Required [${request.displayId}]`;

                const bodyText = (emailCfg?.bodyTemplate || sidebarEmailBody)
                    ? this.renderTemplate(emailCfg?.bodyTemplate || sidebarEmailBody!, request, requesterName, deepLink)
                    : `Your input is required for request ${request.displayId} – ${request.title}.\n\nLink: ${deepLink}`;

                for (const email of uniqueEmails) {
                    try {
                        await EmailService.sendMail({ to: email, subject, text: bodyText, html: bodyText });
                    } catch (emailErr: any) {
                        this.log.error(`[notification-handler] StepActivated email failed for ${email}, step=${stepId}: ${emailErr.message}`);
                    }
                }
                this.log.info(`[notification-handler] StepActivated: sent ${uniqueEmails.length} email(s) for step ${stepId}`);
            }

        } catch (error: any) {
            this.log.error(`[notification-handler] Failed to handle StepActivated (step=${stepId}, request=${requestId}):`, error.message);
        }
    }

    private static async createInAppNotification(
        userId: string,
        title: string,
        message: string,
        request: any,
        stepId: string,
        type: string,
        role: string,
        priority?: string
    ) {
        const db = await cds.connect.to('db');
        const { Notifications } = db.entities('sap.cre');

        await db.create(Notifications).entries({
            recipient_ID: userId,
            title,
            message,
            priority: priority || request.priority || 'MEDIUM',
            type,
            request_ID: request.ID,
            stepId,
            role
        });
        this.log.info(`[notification-handler] Created in-app notification (${type}) for user: ${userId}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // StepApprovalCreated – approver notifications
    // Now uses parseNotificationsContent for robust parsing of both formats
    // ─────────────────────────────────────────────────────────────────────────
    public static async handleStepApprovalCreated(eventData: {
        stepApprovalId: string;
        stepId: string;
        requestId: string;
        approval?: {
            ID: string;
            step_ID: string;
            approver: string;
            approverDisplayName: string;
            status: string;
            ruleName: string;
            approverType: string;
        };
    }) {
        const { stepApprovalId: approvalId, stepId, requestId } = eventData;
        try {
            this.log.info(`[notification-handler] Processing notification for approval: ${approvalId}, step: ${stepId}, request: ${requestId}`);

            const db = await cds.connect.to('db');
            const { StepApprovals, Steps, Requests, RequestData, ShadowUsers, GroupMembers, StepDefinitions } = db.entities('sap.cre');

            // 1. Use event payload if available (avoids race condition with uncommitted TX),
            //    otherwise fall back to DB lookup for backward compatibility.
            let approval = eventData.approval as any;
            if (!approval) {
                this.log.info(`[notification-handler] No approval in event payload, fetching from DB (fallback)`);
                approval = await SELECT.one.from(StepApprovals, approvalId);
            }

            const step = await SELECT.one.from(Steps, stepId)
                .columns((s: any) => { s.ID; s.stepDefinition_ID; s.stepDefinition((sd: any) => { sd.stepName; }); });
            const request = await SELECT.one.from(Requests, requestId).columns('ID', 'displayId', 'title', 'priority', 'createdBy_ID');

            if (!approval || !step || !request) {
                throw new Error(`Missing data for notification (approval=${approvalId}, step=${stepId}, request=${requestId}), aborting.`);
            }

            // 2. Fetch notificationsContent and templates from StepDefinition — robust parser
            let notifConfig: ParsedNotificationsContent = { channels: [] };
            let sidebarEmailSubject: string | null = null;
            let sidebarEmailBody: string | null = null;

            if (step.stepDefinition_ID) {
                const stepDef = await SELECT.one.from(StepDefinitions)
                    .where({ ID: step.stepDefinition_ID })
                    .columns('notificationsContent', 'emailSubject', 'emailBody') as {
                        notificationsContent?: string | null,
                        emailSubject?: string | null,
                        emailBody?: string | null
                    } | null;

                notifConfig = parseNotificationsContent(stepDef?.notificationsContent);
                sidebarEmailSubject = stepDef?.emailSubject || null;
                sidebarEmailBody = stepDef?.emailBody || null;
            }

            const sendBell = notifConfig.channels.includes('bell') || notifConfig.channels.includes('in-app');
            const sendEmail = notifConfig.channels.includes('email');

            if (!sendBell && !sendEmail) {
                this.log.info(`[notification-handler] No notification channels enabled for step — skipping entirely.`);
                return;
            }

            // 3. Resolve recipient user IDs (for in-app notifications)
            //    and emails (for email notifications) independently
            const recipientUserIds: string[] = [];
            const recipientEmails: string[] = [];
            const groupTypes = ['GROUP', 'ROLE', 'TEAM', 'DEPARTMENT', 'POSITION'];

            if (approval.approverType === 'USER') {
                // Direct user assignment — resolve to guaranteed ShadowUser UUID
                const resolvedId = await this.resolveShadowUserId(approval.approver);
                if (resolvedId) {
                    recipientUserIds.push(resolvedId);
                    if (sendEmail) {
                        const user = await SELECT.one.from(ShadowUsers)
                            .where({ ID: resolvedId })
                            .columns('email');
                        if (user?.email) recipientEmails.push(user.email);
                    }
                } else {
                    this.log.warn(`[notification-handler] Could not resolve ShadowUser for approver: ${approval.approver}`);
                }
            } else if (groupTypes.includes(approval.approverType)) {
                this.log.info(`[notification-handler] Resolving members for ${approval.approverType}: ${approval.approver}`);

                const members = await SELECT.from(GroupMembers)
                    .where({ group_ID: approval.approver })
                    .columns('user_ID');

                if (members.length > 0) {
                    const userIds = members.map((m: any) => m.user_ID).filter(Boolean);
                    this.log.info(`[notification-handler] Found ${userIds.length} member ID(s)`);
                    recipientUserIds.push(...userIds);

                    if (sendEmail) {
                        const users = await SELECT.from(ShadowUsers)
                            .where({ ID: { in: userIds } })
                            .columns('ID', 'email');
                        users.forEach((u: any) => {
                            if (u.email) recipientEmails.push(u.email);
                        });
                    }
                } else {
                    this.log.warn(`[notification-handler] No members found for group ${approval.approver}`);
                }
            }

            // Dedupe
            const uniqueUserIds = [...new Set(recipientUserIds)];
            const uniqueEmails = [...new Set(recipientEmails)];

            // 4. Resolve Variables for templates (Title, Message, Email)
            const requester = await SELECT.one.from(ShadowUsers).where({ ID: request.createdBy_ID }).columns('displayName', 'email');
            const requesterName = requester?.displayName || requester?.email || 'Requester';

            const appUrl = process.env.APP_URL || 'https://conarum-gmbh---co--kg---payasyougo-conarum-demo-general145ef808.cfapps.eu10.hana.ondemand.com';
            const deepLink = `${appUrl}/inbox/request/${requestId}`;

            // 5. Create in-app (bell) notifications if enabled
            if (sendBell) {
                const bellCfg = notifConfig.bellConfig;
                const notificationTitle = bellCfg?.titleTemplate
                    ? this.renderTemplate(bellCfg.titleTemplate, request, requesterName)
                    : 'Approval Required';
                const notificationMessage = bellCfg?.bodyTemplate
                    ? this.renderTemplate(bellCfg.bodyTemplate, request, requesterName, deepLink)
                    : `Request ${request.displayId || 'Request'} needs your approval`;
                const type = this.renderTemplate(bellCfg?.typeTemplate || 'APPROVAL', request, requesterName);
                const priority = this.renderTemplate(bellCfg?.priorityTemplate || request.priority || 'MEDIUM', request, requesterName);
                const role = this.renderTemplate(bellCfg?.roleTemplate || 'Approver', request, requesterName);

                for (const userId of uniqueUserIds) {
                    await this.createInAppNotification(
                        userId,
                        notificationTitle,
                        notificationMessage,
                        request,
                        stepId,
                        type,
                        role,
                        priority
                    );
                }
                this.log.info(`[notification-handler] Created ${uniqueUserIds.length} in-app notification(s) for approval ${approvalId}`);
            } else {
                this.log.info(`[notification-handler] Bell notifications disabled for this step — skipping in-app.`);
            }

            // 6. Send email notifications if enabled
            if (!sendEmail) {
                this.log.info(`[notification-handler] Email notifications disabled for this step — done.`);
                return;
            }

            if (uniqueEmails.length === 0) {
                this.log.warn(`[notification-handler] No email found for approver ${approval.approver} (${approval.approverType}) — skipping email, in-app sent.`);
                return;
            }

            // 7. Fetch submitted data summary
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

            // 8. Build email content — use custom template from emailConfig if available
            const emailCfg = notifConfig.emailConfig;
            const subject = (emailCfg?.subjectTemplate || sidebarEmailSubject)
                ? this.renderTemplate(emailCfg?.subjectTemplate || sidebarEmailSubject!, request, requesterName)
                : `New Approval Request [${request.displayId}] – Action Required`;

            const html = (emailCfg?.bodyTemplate || sidebarEmailBody)
                ? this.renderTemplate(emailCfg?.bodyTemplate || sidebarEmailBody!, request, requesterName, deepLink)
                : `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; line-height: 1.6;">
                    <p>Dear Approver,</p>
                    
                    <p>You have been assigned a new request that requires your review and decision.</p>
                    <p>Please find the details below:</p>
                    
                    <ul style="list-style: none; padding-left: 20px;">
                        <li><strong>Request:</strong> ${request.displayId} - ${request.title}</li>
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

            const text = (emailCfg?.bodyTemplate || sidebarEmailBody)
                ? this.renderTemplate(emailCfg?.bodyTemplate || sidebarEmailBody!, request, requesterName, deepLink)
                : `Dear Approver,\n\nYou have been assigned a new request that requires your review and decision.\n\nPlease find the details below:\n- Request: ${request.title}\n- Step: ${approval.ruleName || step.stepDefinition?.stepName}\n- Priority: ${NotificationHandler.formatPriority(request.priority)}\n- Created By: ${requesterName}\n\nKindly review the request in the system and provide your approval or rejection at your earliest convenience.\nYou can access the request here: ${deepLink}\n\nIf you have any questions or require further clarification, please feel free to contact the requester.\n\nThank you for your prompt attention.\n\nBest regards,\nproRequest System`;

            // 9. Send to all resolved emails — individually try/catch to avoid crashing the flow
            this.log.info(`[notification-handler] Sending approval email to ${uniqueEmails.length} recipient(s): ${uniqueEmails.join(', ')}, approval=${approvalId}, step=${stepId}`);
            for (const email of uniqueEmails) {
                try {
                    await EmailService.sendMail({
                        to: email,
                        subject,
                        text,
                        html
                    });
                } catch (emailErr: any) {
                    this.log.error(`[notification-handler] Email send failed for ${email} (approval=${approvalId}, step=${stepId}): ${emailErr.message}`);
                }
            }
        } catch (error: any) {
            NotificationHandler.log.error(`[notification-handler] Failed to process notification (approval=${approvalId}, step=${stepId}, request=${requestId}):`, error.message);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static formatPriority(priority: string): string {
        return formatEnumLabel(priority || 'MEDIUM');
    }

    /**
     * Simple Mustache-style template renderer.
     * Replaces `{{key}}` placeholders with values from the request object.
     */
    private static renderTemplate(
        template: string,
        request: any,
        requesterName?: string,
        deepLink?: string
    ): string {
        if (!template) return '';

        return template.replace(/\{\{(.*?)\}\}/g, (match, p1) => {
            const key = p1.trim();
            const lowerKey = key.toLowerCase();

            // 1. System Variables (Studio Format: System.FieldName)
            if (lowerKey === 'system.priority') return this.formatPriority(request.priority);
            if (lowerKey === 'system.requestid' || lowerKey === 'system.displayid') return request.displayId || '';
            if (lowerKey === 'system.requesttitle') return request.title || '';
            if (lowerKey === 'system.requestuuid') return request.ID || '';
            if (lowerKey === 'system.requester') return requesterName || 'Requester';

            // 2. Internal/Legacy IDs (Studio Format: __request_*)
            if (lowerKey === '__request_priority') return this.formatPriority(request.priority);
            if (lowerKey === '__request_displayid') return request.displayId || '';
            if (lowerKey === '__request_title') return request.title || '';
            if (lowerKey === '__request_uuid') return request.ID || '';
            if (lowerKey === '__requester_name') return requesterName || 'Requester';

            // 3. Short Legacy Names
            if (lowerKey === 'displayid') return request.displayId || '';
            if (lowerKey === 'title') return request.title || '';
            if (lowerKey === 'priority') return this.formatPriority(request.priority);
            if (lowerKey === 'requestername') return requesterName || 'Requester';
            if (lowerKey === 'deeplink') return deepLink || '';

            // 4. Fallback: Return raw key if not matched
            return match;
        });
    }

    /**
     * Resolve an approver/owner identifier to a guaranteed ShadowUser UUID.
     * The provided id might already be a UUID (ShadowUser.ID), or it could be
     * a username string or email. This method tries all three lookups.
     */
    private static async resolveShadowUserId(id: string): Promise<string | null> {
        const db = await cds.connect.to('db');
        const { ShadowUsers } = db.entities('sap.cre');

        // 1. Try direct UUID match (most common path)
        const byId = await SELECT.one.from(ShadowUsers).where({ ID: id }).columns('ID');
        if (byId) return byId.ID;

        // 2. Fallback: try matching by userId (e.g., "alice@example.com" login name)
        const byUserId = await SELECT.one.from(ShadowUsers).where({ userId: id }).columns('ID');
        if (byUserId) return byUserId.ID;

        // 3. Fallback: try matching by email
        const byEmail = await SELECT.one.from(ShadowUsers).where({ email: id }).columns('ID');
        if (byEmail) return byEmail.ID;

        this.log.warn(`[notification-handler] Could not resolve ShadowUser for identifier: ${id}`);
        return null;
    }
}

// Export the parser for unit testing
export { parseNotificationsContent };
export type { ParsedNotificationsContent, EmailConfig as RuntimeEmailConfig };
