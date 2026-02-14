import { cds, SELECT, INSERT, UPDATE } from '../lib/db';
import { WorkflowEngine } from '../lib/workflow';
import { Request, Step, StepApproval, StepHistory, RequestHistory, StatusNetwork } from '../../@cds-models/RequestService';
import { UserResolverHelper } from '../lib/user-resolver-helper';
import { IdentityProvisioner } from '../lib/identity-provisioner';

/**
 * Handles Approval-level actions: approve, reject, sendBack
 * Manages individual approver decisions and step advancement.
 */
export class ApprovalHandler {

    private srv: cds.ApplicationService;
    private workflowEngine: WorkflowEngine;
    private userResolver: UserResolverHelper;
    private log = cds.log('approval-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
        this.workflowEngine = new WorkflowEngine(srv);
        this.userResolver = new UserResolverHelper(srv);
    }

    /**
     * Register all approval-related handlers
     */
    register() {
        const { StepApprovals, Requests } = this.srv.entities;

        // These actions are bound to StepApprovals in CDS
        this.srv.on('approve', StepApprovals, this.onApprove.bind(this));
        this.srv.on('rejectApproval', StepApprovals, this.onReject.bind(this));
        this.srv.on('sendBack', StepApprovals, this.onSendBack.bind(this));

        // Enrich decidedByDisplayName virtual field
        this.srv.after('READ', StepApprovals, this.enrichDecidedByDisplayName.bind(this));

        // This action is bound to Requests
        this.srv.on('resetToDraft', Requests, this.onResetToDraft.bind(this));
    }

    /**
     * Enrich StepApprovals with decidedByDisplayName
     */
    private async enrichDecidedByDisplayName(data: any, req: cds.Request) {
        const items = Array.isArray(data) ? data : data ? [data] : [];
        if (items.length === 0) return;

        const { ShadowUsers } = this.srv.entities;

        // Collect all decidedBy_IDs
        const decidedByIds = new Set<string>();
        for (const item of items) {
            if (item.decidedBy_ID) {
                decidedByIds.add(item.decidedBy_ID);
            }
        }

        if (decidedByIds.size === 0) return;

        // Bulk fetch display names
        try {
            const users = await SELECT.from(ShadowUsers)
                .where({ ID: { in: [...decidedByIds] } })
                .columns('ID', 'displayName', 'email');

            const nameMap = new Map<string, string>();
            for (const u of users) {
                nameMap.set(u.ID, u.displayName || u.email || u.ID);
            }

            // Apply to items
            for (const item of items) {
                if (item.decidedBy_ID) {
                    item.decidedByDisplayName = nameMap.get(item.decidedBy_ID) || item.decidedBy_ID;
                }
            }
        } catch (e) {
            this.log.warn('Failed to enrich decidedByDisplayName', e);
        }
    }

    /**
     * Approve Action - bound to StepApprovals entity
     */
    private async onApprove(req: cds.Request) {
        const { StepApprovals, Steps, StepHistory } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const approvalId = param.ID;
        const { comment } = req.data as { comment?: string };

        this.log.info(`Approve action triggered for StepApproval: ${approvalId}, User: ${req.user.id}`);

        // 1. Get the approval record and validate
        const approval = await SELECT.one.from(StepApprovals, approvalId)
            .columns('ID', 'step_ID', 'approver', 'approverType', 'status') as {
                ID: string; step_ID: string; approver: string; approverType: string; status: string
            } | null;

        if (!approval) {
            return req.error(404, 'Approval not found');
        }

        if (approval.status !== StepApproval.status.PENDING) {
            return req.error(400, `Cannot approve - approval is in ${approval.status} status`);
        }

        // SECURITY FIX (CRITICAL-001): Verify user is authorized approver
        const origin = IdentityProvisioner.getOrigin(req.user);
        const isAuthorized = await this.isAuthorizedApprover(req.user.id, origin, approval);
        if (!isAuthorized) {
            this.log.warn(`Unauthorized approve attempt by ${req.user.id} for approval ${approvalId}`);
            return req.error(403, 'Not authorized to approve this step');
        }

        // Get the ShadowUser ID for the current actor
        const actorId = await this.getShadowUserId(req.user.id, origin);
        if (!actorId) {
            return req.error(500, `Shadow user not found for ${req.user.id}`);
        }

        // Get step to find request ID
        const step = await SELECT.one.from(Steps, approval.step_ID)
            .columns('ID', 'request_ID') as { ID: string; request_ID: string } | null;

        if (!step) {
            return req.error(404, 'Step not found');
        }

        const stepId = approval.step_ID;
        const requestID = step.request_ID;

        // 2. Update Approval Status to APPROVED
        await UPDATE(StepApprovals, approvalId).with({
            status: StepApproval.status.APPROVED,
            decisionAt: new Date().toISOString(),
            comment: comment,
            decidedBy_ID: actorId // Track actual decider
        });

        // Auto-release claim on action completion
        await UPDATE(Steps, stepId).with({
            claimedBy_ID: null,
            claimedAt: null
        });

        // 3. Log History (Step-level only - APPROVE is a Step action)
        await INSERT.into(StepHistory).entries({
            step_ID: stepId,
            action: 'APPROVE',
            fromValue: StepApproval.status.PENDING,
            toValue: StepApproval.status.APPROVED,
            actor_ID: actorId,
            createdBy_ID: actorId,
            modifiedBy_ID: actorId,
            timestamp: new Date().toISOString(),
            comment: comment
        });

        // 4. Check Step Completion
        await this.checkStepCompletion(stepId, requestID, actorId);
        return SELECT.from(this.srv.entities.Requests, requestID);
    }

    /**
     * Reject Action (Terminates Workflow) - bound to StepApprovals entity
     */
    private async onReject(req: cds.Request) {
        const { Requests, Steps, StepApprovals, StepHistory, RequestHistory } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const approvalId = param.ID;
        const { comment } = req.data as { comment?: string };

        this.log.info(`Reject action triggered for StepApproval: ${approvalId}`);

        // 1. Get the approval record and validate
        const approval = await SELECT.one.from(StepApprovals, approvalId)
            .columns('ID', 'step_ID', 'approver', 'approverType', 'status') as {
                ID: string; step_ID: string; approver: string; approverType: string; status: string
            } | null;

        if (!approval) {
            return req.error(404, 'Approval not found');
        }

        if (approval.status !== StepApproval.status.PENDING) {
            return req.error(400, `Cannot reject - approval is in ${approval.status} status`);
        }

        // SECURITY FIX (HIGH-002): Verify user is authorized approver
        const origin = IdentityProvisioner.getOrigin(req.user);
        const isAuthorized = await this.isAuthorizedApprover(req.user.id, origin, approval);
        if (!isAuthorized) {
            this.log.warn(`Unauthorized reject attempt by ${req.user.id} for approval ${approvalId}`);
            return req.error(403, 'Not authorized to reject this step');
        }

        // Get the ShadowUser ID for the current actor
        const actorId = await this.getShadowUserId(req.user.id, origin);
        if (!actorId) {
            return req.error(500, `Shadow user not found for ${req.user.id}`);
        }

        // Get step to find request ID
        const step = await SELECT.one.from(Steps, approval.step_ID)
            .columns('ID', 'request_ID') as { ID: string; request_ID: string } | null;

        if (!step) {
            return req.error(404, 'Step not found');
        }

        const stepId = approval.step_ID;
        const requestID = step.request_ID;

        // 2. Update Approval to REJECTED
        await UPDATE(StepApprovals, approvalId).with({
            status: StepApproval.status.REJECTED,
            decisionAt: new Date().toISOString(),
            comment: comment,
            decidedBy_ID: actorId
        });

        // Auto-release claim on action completion
        await UPDATE(Steps, stepId).with({
            claimedBy_ID: null,
            claimedAt: null,
            status: Step.status.REJECTED,
            modifiedBy_ID: actorId
        });

        // 4. Mark Request as REJECTED (Terminal State)
        await UPDATE(Requests, requestID).with({
            status: Request.status.REJECTED,
            modifiedBy_ID: actorId
        });

        // 5. History Logging
        const timestamp = new Date().toISOString();

        // Log Step-level REJECT action
        await INSERT.into(StepHistory).entries({
            step_ID: stepId,
            action: 'REJECT',
            fromValue: StepApproval.status.PENDING,
            toValue: StepApproval.status.REJECTED,
            actor_ID: actorId,
            createdBy_ID: actorId,
            modifiedBy_ID: actorId,
            timestamp: timestamp,
            comment: comment
        });

        // Log Request-level STATUS_CHANGE (system action triggered by user's reject)
        await INSERT.into(RequestHistory).entries({
            request_ID: requestID,
            step_ID: stepId,
            action: 'STATUS_CHANGE',
            actor_ID: actorId, // User who triggered the reject
            createdBy_ID: actorId,
            modifiedBy_ID: actorId,
            timestamp: timestamp,
            comment: `Request status changed to REJECTED due to step rejection`
        });

        return SELECT.from(Requests, requestID);
    }

    /**
     * Send Back Action (Returns step to IN_CLARIFICATION) - bound to StepApprovals entity
     */
    private async onSendBack(req: cds.Request) {
        const { Requests, Steps, StepApprovals, StepHistory } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const approvalId = param.ID;
        const { comment } = req.data as { comment?: string };

        this.log.info(`SendBack action for StepApproval: ${approvalId}`);

        // 1. Get the approval record and validate
        const approval = await SELECT.one.from(StepApprovals, approvalId)
            .columns('ID', 'step_ID', 'approver', 'approverType', 'status') as {
                ID: string; step_ID: string; approver: string; approverType: string; status: string
            } | null;

        if (!approval) {
            return req.error(404, 'Approval not found');
        }

        if (approval.status !== StepApproval.status.PENDING) {
            return req.error(400, `Cannot send back - approval is in ${approval.status} status`);
        }

        // SECURITY FIX (HIGH-002): Verify user is authorized approver
        const origin = IdentityProvisioner.getOrigin(req.user);
        const isAuthorized = await this.isAuthorizedApprover(req.user.id, origin, approval);
        if (!isAuthorized) {
            this.log.warn(`Unauthorized sendBack attempt by ${req.user.id} for approval ${approvalId}`);
            return req.error(403, 'Not authorized to send back this step');
        }

        // Get the ShadowUser ID for the current actor
        const actorId = await this.getShadowUserId(req.user.id, origin);
        if (!actorId) {
            return req.error(500, `Shadow user not found for ${req.user.id}`);
        }

        // Get step to find request ID
        const step = await SELECT.one.from(Steps, approval.step_ID)
            .columns('ID', 'request_ID') as { ID: string; request_ID: string } | null;

        if (!step) {
            return req.error(404, 'Step not found');
        }

        const stepId = approval.step_ID;
        const requestID = step.request_ID;

        // 2. Set Step status to IN_CLARIFICATION and auto-release claim
        await UPDATE(Steps, stepId).with({
            status: Step.status.IN_CLARIFICATION,
            modifiedBy_ID: actorId,
            claimedBy_ID: null,
            claimedAt: null
        });

        // 3. Log History (Step-level only - SEND_BACK is a Step action)
        const timestamp = new Date().toISOString();
        await INSERT.into(StepHistory).entries({
            step_ID: stepId,
            action: 'SEND_BACK',
            fromValue: Step.status.IN_PROGRESS,
            toValue: Step.status.IN_CLARIFICATION,
            actor_ID: actorId,
            createdBy_ID: actorId,
            modifiedBy_ID: actorId,
            timestamp: timestamp,
            comment: comment
        });

        return SELECT.from(Requests, requestID);
    }

    /**
        * Reset to Draft Action (Emergency/Admin usage or Reset Logic)
        * Added to match RequestHandler capabilities if needed, or specific button logic
        * Usually called from the UI if configured
        */
    private async onResetToDraft(req: cds.Request) {
        // SECURITY FIX (HIGH-003): Require admin role
        if (!req.user.is('admin') && !req.user.is('system-user')) {
            this.log.warn(`Unauthorized resetToDraft attempt by ${req.user.id}`);
            return req.error(403, 'Only administrators can reset requests to draft');
        }

        const { Requests, Steps, StepHistory } = this.srv.entities;
        const requestID = (req.params[0] as { ID: string }).ID;

        // Reset Request
        await UPDATE(Requests, requestID).with({ status: Request.status.DRAFT });

        this.log.warn(`Request ${requestID} reset to DRAFT by admin ${req.user.id}`);
        return SELECT.from(Requests, requestID);
    }


    /**
     * Check if a step is complete after an approval action.
     * Handles Sequential Approvals logic.
     */
    private async checkStepCompletion(stepId: string, requestId: string, actorId?: string | null) {
        const { Steps, StepApprovals, StepHistory } = this.srv.entities;

        // 1. Check for any explicit REJECTIONS (already handled in onReject, but safe check)
        const rejected = await SELECT.one.from(StepApprovals)
            .where({ step_ID: stepId, status: StepApproval.status.REJECTED });

        if (rejected) {
            // Should have been handled by onReject, but ensures consistency
            return;
        }

        // 2. Check remaining PENDING approvals
        const pending = await SELECT.from(StepApprovals)
            .where({ step_ID: stepId, status: StepApproval.status.PENDING });

        // 3. Check remaining WAITING approvals (for sequential chains)
        const waiting = await SELECT.from(StepApprovals)
            .where({ step_ID: stepId, status: StepApproval.status.WAITING })
            .orderBy('createdAt asc'); // Ordering important for sequence

        if (pending.length === 0 && waiting.length === 0) {
            // ALL approvals provided -> Step Complete
            this.log.info(`Step ${stepId} completed.`);
            await UPDATE(Steps, stepId).with({
                status: Step.status.COMPLETED,
                modifiedBy_ID: actorId
            });

            // Log completion
            await INSERT.into(StepHistory).entries({
                step_ID: stepId,
                action: 'COMPLETE',
                fromValue: Step.status.IN_PROGRESS,
                toValue: Step.status.COMPLETED,
                actor_ID: null, // System action (all approvers approved)
                createdBy_ID: actorId,
                modifiedBy_ID: actorId,
                timestamp: new Date().toISOString(),
                comment: 'All approvals granted'
            });

            // Trigger Workflow Advance (pass actor for audit trail)
            await this.workflowEngine.advance(requestId, actorId);

        } else if (pending.length === 0 && waiting.length > 0) {
            // Current tier approved, promote next WAITING approver to PENDING
            // Assuming simplified sequential logic: Activate the NEXT one in line
            const nextApprover = waiting[0];

            this.log.info(`Promoting next approver ${nextApprover.approver} for step ${stepId}`);

            await UPDATE(StepApprovals, nextApprover.ID).with({
                status: StepApproval.status.PENDING
            });

            // Notify/Log promotion could go here
        } else {
            // Still pending approvals
            this.log.info(`Step ${stepId} still pending ${pending.length} approvals.`);
        }
    }

    /**
     * SECURITY: Check if user is authorized to action this approval
     * Handles both direct USER assignments and GROUP membership.
     * 
     * @param userId - The CAP user.id (IDP identifier)
     * @param approval - The approval record with approver and approverType
     * @returns true if user is authorized
     */
    private async isAuthorizedApprover(
        userId: string,
        origin: string,
        approval: { approver: string; approverType: string }
    ): Promise<boolean> {
        const { GroupMembers, ShadowUsers } = this.srv.entities;

        this.log.info(`[Auth] Checking authorization for user: ${origin}:${userId}`);
        this.log.info(`[Auth] Approval: approver=${approval.approver}, type=${approval.approverType}`);

        // Get shadow user using composite key
        const shadowUser = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId })
            .columns('ID') as { ID: string } | null;

        if (!shadowUser) {
            this.log.warn(`[Auth] No shadow user found for IDP user: ${userId}`);
            return false;
        }

        this.log.info(`[Auth] Found ShadowUser ID: ${shadowUser.ID}`);

        // Direct USER assignment
        if (approval.approverType === 'USER') {
            const match = approval.approver === shadowUser.ID;
            this.log.info(`[Auth] USER check: approver=${approval.approver} === shadowUser.ID=${shadowUser.ID} ? ${match}`);
            return match;
        }

        // GROUP-based assignment (GROUP, TEAM, DEPARTMENT, ROLE)
        // Check if user is a member of the assigned group
        const membership = await SELECT.one.from(GroupMembers)
            .where({ user_ID: shadowUser.ID, group_ID: approval.approver })
            .columns('ID') as { ID: string } | null;

        this.log.info(`[Auth] GROUP check: user ${shadowUser.ID} in group ${approval.approver} ? ${!!membership}`);
        return !!membership;
    }

    /**
     * Helper to get ShadowUser ID from IDP User ID and origin
     */
    private async getShadowUserId(userId: string, origin: string): Promise<string | null> {
        const { ShadowUsers } = this.srv.entities;
        const user = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId })
            .columns('ID') as { ID: string } | null;
        return user ? user.ID : null;
    }
}
