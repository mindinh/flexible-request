import { cds, SELECT, INSERT, UPDATE } from '../lib/db';
import { WorkflowEngine } from '../lib/workflow';
import { ApproverResolver } from '../lib/approver-resolver';
import { Step, StepApproval } from '../../@cds-models/RequestService';
import { UserResolverHelper } from '../lib/user-resolver-helper';

/**
 * Handles Step-level actions: submitStep, respondToClarification
 * These are actions performed by the Step Responsible (may or may not be the original requester).
 */
export class StepHandler {

    private srv: cds.ApplicationService;
    private workflowEngine: WorkflowEngine;
    private userResolver: UserResolverHelper;
    private log = cds.log('step-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
        this.workflowEngine = new WorkflowEngine(srv);
        this.userResolver = new UserResolverHelper(srv);
    }

    /**
     * Register all step-related handlers
     */
    register() {
        const { Requests } = this.srv.entities;

        this.log.info('Registering Step Handlers...');
        this.srv.on('submitStep', Requests, this.onSubmitStep.bind(this));
        this.srv.on('respondToClarification', Requests, this.onRespondToClarification.bind(this));
        // Enrich steps with owner display name
        const { Steps } = this.srv.entities;
        this.srv.after('READ', Steps, this.afterRead.bind(this));
    }

    /**
     * After READ: Enrich steps with owner display name
     */
    private async afterRead(data: any, req: cds.Request) {
        const items = Array.isArray(data) ? data : data ? [data] : [];
        if (items.length === 0) return;

        const { ShadowUsers, ShadowGroups } = this.srv.entities;
        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        // Collect IDs
        for (const item of items) {
            if (item.ownerId) {
                if (item.ownerType === 'USER') {
                    userIds.add(item.ownerId);
                } else if (['GROUP', 'TEAM', 'ROLE', 'POSITION', 'DEPARTMENT'].includes(item.ownerType)) {
                    groupIds.add(item.ownerId);
                }
            }
        }

        const nameMap = new Map<string, string>();

        // Fetch Users
        if (userIds.size > 0) {
            try {
                const users = await SELECT.from(ShadowUsers)
                    .where({ ID: { in: [...userIds] } })
                    .columns('ID', 'displayName', 'email');
                for (const u of users) {
                    nameMap.set(u.ID, u.displayName || u.email || u.ID);
                }
            } catch (e) {
                this.log.warn('Failed to fetch users for step owner display names', e);
            }
        }

        // Fetch Groups
        if (groupIds.size > 0) {
            try {
                const groups = await SELECT.from(ShadowGroups)
                    .where({ ID: { in: [...groupIds] } })
                    .columns('ID', 'name');
                for (const g of groups) {
                    nameMap.set(g.ID, g.name || g.ID);
                }
            } catch (e) {
                this.log.warn('Failed to fetch groups for step owner display names', e);
            }
        }

        // Apply
        for (const item of items) {
            if (item.ownerId) {
                item.ownerDisplayName = nameMap.get(item.ownerId) || item.ownerId;
            }
        }
    }

    /**
     * Submit an intermediate step (STARTED -> IN_PROGRESS)
     * Called by the Step Responsible when they've filled in the step data.
     */
    private async onSubmitStep(req: cds.Request) {
        const { Requests, Steps, StepHistory } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const requestID = param.ID;
        const { stepId } = req.data as { stepId: string };

        this.log.info(`Submitting Step ID: ${stepId} for Request ${requestID}`);

        if (!stepId) return req.error(400, 'Step ID is required');

        // 1. Validate Step
        const step = await SELECT.one.from(Steps, stepId)
            .where({ request_ID: requestID })
            .columns('ID', 'status', 'stepDefinition_ID', 'ownerId', 'ownerType');

        if (!step) return req.error(404, 'Step not found');
        if (step.status !== Step.status.STARTED) {
            return req.error(400, `Step must be in STARTED status (current: ${step.status})`);
        }

        // SECURITY: Verify user is the step owner or member of owner group
        const origin = (req.user as any).origin || 'sap.default';
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);
        if (!userUUID) {
            return req.error(500, `Shadow user not found for ${origin}:${req.user.id}`);
        }

        const isOwner = await this.isStepOwnerOrMember(userUUID, step.ownerId, step.ownerType);
        if (!isOwner && !req.user.is('admin')) {
            this.log.warn(`[SECURITY] Unauthorized submitStep attempt by ${req.user.id} for step ${stepId}`);
            return req.error(403, 'Only the step owner can submit this step');
        }

        const request = await SELECT.one.from(Requests, requestID)
            .columns('ID', 'requestType_ID', 'priority');

        // 2. Transition Step to IN_PROGRESS and auto-release claim
        await UPDATE(Steps, step.ID).with({
            status: Step.status.IN_PROGRESS,
            modifiedBy_ID: userUUID,
            claimedBy_ID: null,
            claimedAt: null
        });

        // Record status transition (using SUBMIT_STEP action for step data submission)
        await INSERT.into(StepHistory).entries({
            step_ID: step.ID,
            action: 'SUBMIT_STEP',
            fromValue: Step.status.STARTED,
            toValue: Step.status.IN_PROGRESS,
            actor_ID: userUUID,
            createdBy_ID: userUUID,
            modifiedBy_ID: userUUID,
            timestamp: new Date().toISOString(),
            comment: 'Step data submitted for approval'
        });

        // 3. Create Approvals or Auto-Complete
        const requestData = await this.workflowEngine.getRequestDataPayload(requestID);
        requestData['__request_priority'] = request.priority;

        const approverResolver = new ApproverResolver(this.srv);
        const approvers = await approverResolver.resolveApprovers(
            step.stepDefinition_ID,
            request.requestType_ID,
            requestData
        );

        if (approvers.length > 0) {
            await this.workflowEngine.createApprovals(step.ID, approvers, userUUID);
        } else {
            // Auto-complete
            this.log.info(`No approvers for step ${stepId} - auto-completing`);
            await UPDATE(Steps, step.ID).with({
                status: Step.status.COMPLETED,
                modifiedBy_ID: userUUID
            });

            const comment = 'Step auto-completed - no approval rules defined';
            const timestamp = new Date().toISOString();

            await INSERT.into(StepHistory).entries({
                step_ID: step.ID,
                action: 'AUTO_COMPLETE',
                fromValue: Step.status.IN_PROGRESS,
                toValue: Step.status.COMPLETED,
                actor_ID: null, // System action
                createdBy_ID: userUUID,
                modifiedBy_ID: userUUID,
                timestamp: timestamp,
                comment: comment
            });

            // Note: AUTO_COMPLETE is a Step-level action, not logged to RequestHistory

            await this.workflowEngine.advance(requestID, userUUID);
        }

        return SELECT.from(Requests, requestID);
    }

    /**
     * Respond to Clarification - step responsible provides requested information
     * Called when an approver has sent the step back for more information.
     */
    private async onRespondToClarification(req: cds.Request) {
        const { Requests, Steps, StepApprovals, StepHistory } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const requestID = param.ID;
        const { stepId, comment } = req.data as { stepId?: string; comment?: string };

        this.log.info(`Responding to clarification for Request ID: ${requestID}, Step ID: ${stepId}`);

        if (!stepId) {
            return req.error(400, 'stepId is required');
        }

        // 1. Verify step is in IN_CLARIFICATION status and get owner info
        const step = await SELECT.one.from(Steps, stepId)
            .columns('status', 'request_ID', 'ownerId', 'ownerType') as {
                status: string; request_ID: string; ownerId: string; ownerType: string
            } | null;
        if (!step || step.request_ID !== requestID) {
            return req.error(404, 'Step not found or does not belong to this request');
        }
        if (step.status !== Step.status.IN_CLARIFICATION) {
            return req.error(400, 'Step is not awaiting clarification');
        }

        // Resolve user UUID (supports multi-IDP)
        const origin = (req.user as any).origin || 'sap.default';
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);
        if (!userUUID) {
            return req.error(500, `Shadow user not found for ${origin}:${req.user.id}`);
        }

        // SECURITY: Verify user is the step owner or member of owner group
        const isOwner = await this.isStepOwnerOrMember(userUUID, step.ownerId, step.ownerType);
        if (!isOwner && !req.user.is('admin')) {
            this.log.warn(`[SECURITY] Unauthorized respondToClarification attempt by ${req.user.id} for step ${stepId}`);
            return req.error(403, 'Only the step owner can respond to clarification');
        }

        // 2. Transition step back to IN_PROGRESS and auto-release claim
        await UPDATE(Steps, stepId).with({
            status: Step.status.IN_PROGRESS,
            modifiedBy_ID: userUUID,
            claimedBy_ID: null,
            claimedAt: null
        });

        // 3. Reset ALL approvals for this step to restart the approval process
        const approvals = await SELECT.from(StepApprovals)
            .where({ step_ID: stepId })
            .orderBy('createdAt') as { ID: string; approver: string }[];

        for (let i = 0; i < approvals.length; i++) {
            await UPDATE(StepApprovals, approvals[i].ID).with({
                status: i === 0 ? StepApproval.status.PENDING : StepApproval.status.WAITING,
                approver: approvals[i].approver, // Keep original approver
                decisionAt: null,
                comment: null,
                modifiedBy_ID: userUUID
            });
        }

        // 4. Record in step history (Step-level action only)
        await INSERT.into(StepHistory).entries({
            step_ID: stepId,
            action: 'CLARIFICATION_PROVIDED',
            fromValue: Step.status.IN_CLARIFICATION,
            toValue: Step.status.IN_PROGRESS,
            actor_ID: userUUID,
            createdBy_ID: userUUID,
            modifiedBy_ID: userUUID,
            timestamp: new Date().toISOString(),
            comment: comment ?? 'Clarification provided'
        });

        // Note: CLARIFICATION_PROVIDED is a Step-level action, not logged to RequestHistory

        this.log.info(`Clarification provided - step returned to IN_PROGRESS`);
        return SELECT.from(Requests, requestID);
    }

    /**
     * SECURITY: Check if user is the step owner or a member of the owner group.
     * Used for submitStep and respondToClarification authorization.
     */
    private async isStepOwnerOrMember(
        shadowUserId: string,
        ownerId: string,
        ownerType: string
    ): Promise<boolean> {
        const { GroupMembers } = this.srv.entities;

        // Direct USER assignment
        if (ownerType === 'USER') {
            return shadowUserId === ownerId;
        }

        // GROUP-based assignment - check membership
        const membership = await SELECT.one.from(GroupMembers)
            .where({ user_ID: shadowUserId, group_ID: ownerId })
            .columns('ID') as { ID: string } | null;

        return !!membership;
    }
}
