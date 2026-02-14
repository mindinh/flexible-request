import { cds, SELECT, UPDATE, INSERT } from '../lib/db';
import { UserResolverHelper } from '../lib/user-resolver-helper';
import { IdentityProvisioner } from '../lib/identity-provisioner';

/**
 * CoordinatorHandler - Handles coordinator delegation and step claiming
 * 
 * Epic 3.1: Coordinator Assignment
 * Epic 3.3: Step Claim/Release
 */
export class CoordinatorHandler {
    private srv: cds.ApplicationService;
    private userResolver: UserResolverHelper;
    private log = cds.log('coordinator-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
        this.userResolver = new UserResolverHelper(srv);
    }

    register() {
        this.log.info('Registering Coordinator Handlers...');

        // Epic 3.1: Coordinator delegation
        this.srv.on('delegate', 'Requests', this.onDelegate.bind(this));

        // Epic 3.3: Step claim/release
        this.srv.on('claimStep', 'Steps', this.onClaimStep.bind(this));
        this.srv.on('releaseStep', 'Steps', this.onReleaseStep.bind(this));
    }

    /**
     * Delegate coordinator role to another user/group
     */
    private async onDelegate(req: cds.Request) {
        const param = req.params[0] as { ID: string };
        const data = req.data as {
            newCoordinatorType: string;
            newCoordinatorId: string;
            newCoordinatorValue: string;
        };

        const { Requests, RequestHistory, ShadowUsers } = this.srv.entities;

        // Get current request
        const request = await SELECT.one.from(Requests, param.ID)
            .columns('ID', 'coordinatorType', 'coordinatorId', 'coordinatorValue', 'status');

        if (!request) {
            return req.error(404, 'Request not found');
        }

        // Only allow delegation for active requests
        if (request.status === 'COMPLETED' || request.status === 'REJECTED' || request.status === 'WITHDRAWN') {
            return req.error(400, `Cannot delegate: request is ${request.status}`);
        }

        // SECURITY FIX (CRITICAL-002): Verify user is current coordinator or admin
        const origin = IdentityProvisioner.getOrigin(req.user);
        const isCoordinator = await this.isCurrentCoordinator(req.user.id, origin, request);
        if (!isCoordinator && !req.user.is('admin')) {
            this.log.warn(`Unauthorized delegate attempt by ${req.user.id} for request ${param.ID}`);
            return req.error(403, 'Only the current coordinator can delegate this request');
        }

        // Store previous coordinator for history
        const previousCoordinatorId = request.coordinatorId;
        const previousCoordinatorValue = request.coordinatorValue;

        // Resolve user UUID for audit (supports multi-IDP)
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);
        if (!userUUID) {
            return req.error(500, `Shadow user not found for ${origin}:${req.user.id}`);
        }

        // Update request with new coordinator
        await UPDATE(Requests).where({ ID: param.ID }).set({
            coordinatorType: data.newCoordinatorType,
            coordinatorId: data.newCoordinatorId,
            coordinatorValue: data.newCoordinatorValue,
            delegatedFrom: previousCoordinatorId,
            delegatedAt: new Date(),
            modifiedBy_ID: userUUID
        });

        // Log delegation in history
        await INSERT.into(RequestHistory).entries({
            request_ID: param.ID,
            action: 'DELEGATED',
            fromValue: previousCoordinatorValue || 'None',
            toValue: data.newCoordinatorValue,
            actor_ID: userUUID,
            createdBy_ID: userUUID,
            modifiedBy_ID: userUUID,
            timestamp: new Date().toISOString(),
            comment: `Coordinator delegated from ${previousCoordinatorValue || 'None'} to ${data.newCoordinatorValue}`
        });

        this.log.info(`Request ${param.ID} delegated to ${data.newCoordinatorValue}`);

        return { success: true };
    }

    /**
     * Claim a step for work (Epic 3.3)
     * 
     * Context-aware claiming:
     * - STARTED / IN_CLARIFICATION → Only Step Owner can claim
     * - IN_PROGRESS → Only Pending Approvers can claim
     */
    private async onClaimStep(req: cds.Request) {
        const param = req.params[0] as { ID: string };
        const { Steps, ShadowUsers, StepHistory, StepApprovals } = this.srv.entities;

        // Get step details including owner info for security check
        const step = await SELECT.one.from(Steps, param.ID)
            .columns('ID', 'claimedBy_ID', 'claimedAt', 'status', 'stepDefinition_ID', 'ownerType', 'ownerId');

        if (!step) {
            return req.error(404, 'Step not found');
        }

        // Get current user's ShadowUser ID first (needed for authorization checks)
        const origin = IdentityProvisioner.getOrigin(req.user);
        this.log.info(`[CLAIM-DEBUG] Origin from JWT: ${origin}, userId: ${req.user.id}`);

        const currentShadowUser = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId: req.user.id })
            .columns('ID', 'displayName') as { ID: string; displayName: string } | null;

        this.log.info(`[CLAIM-DEBUG] Current ShadowUser lookup result: ${currentShadowUser ? JSON.stringify(currentShadowUser) : 'NOT FOUND'}`);

        if (!currentShadowUser) {
            return req.error(400, 'User not provisioned');
        }

        // CONTEXT-AWARE AUTHORIZATION based on step status
        let isAuthorized = false;
        let claimContext = '';

        if (step.status === 'STARTED' || step.status === 'IN_CLARIFICATION') {
            // Step Owner's turn - only owner can claim
            claimContext = 'step_owner';
            isAuthorized = await this.isStepOwnerOrMember(currentShadowUser.ID, step, req.user.id);

            if (!isAuthorized) {
                this.log.warn(`Claim denied: User ${req.user.id} is not step owner for step ${param.ID} in status ${step.status}`);
                return req.error(403, 'Only the step owner can claim this step at this time');
            }
        } else if (step.status === 'IN_PROGRESS') {
            // Approvers' turn - only pending approvers can claim
            claimContext = 'approver';
            isAuthorized = await this.isPendingApproverOrMember(currentShadowUser.ID, param.ID, req.user.id);

            if (!isAuthorized) {
                this.log.warn(`Claim denied: User ${req.user.id} is not a pending approver for step ${param.ID}`);
                return req.error(403, 'Only assigned approvers can claim this step at this time');
            }
        } else {
            // Other statuses - no claiming allowed
            return req.error(400, `Cannot claim step in status: ${step.status}`);
        }

        // Check if already claimed
        if (step.claimedBy_ID) {
            // Check 4-hour timeout
            const claimedAt = new Date(step.claimedAt as string);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

            if (claimedAt > fourHoursAgo) {
                return req.error(409, 'Step is already claimed by another user');
            }
            // Claim has expired, allow re-claim
            this.log.info(`Claim expired for step ${param.ID}, allowing re-claim`);
        }

        // Get current user's ShadowUser ID (origin already declared above)
        const shadowUser = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId: req.user.id })
            .columns('ID', 'displayName');

        if (!shadowUser) {
            return req.error(400, 'User not provisioned');
        }

        // Claim the step
        await UPDATE(Steps).where({ ID: param.ID }).set({
            claimedBy_ID: shadowUser.ID,
            claimedAt: new Date(),
            modifiedBy_ID: shadowUser.ID
        });

        // Log in step history
        await INSERT.into(StepHistory).entries({
            step_ID: param.ID,
            action: 'CLAIMED',
            actor_ID: shadowUser.ID,
            createdBy_ID: shadowUser.ID,
            modifiedBy_ID: shadowUser.ID,
            timestamp: new Date().toISOString(),
            comment: `Step claimed by ${shadowUser.displayName}`
        });

        this.log.info(`Step ${param.ID} claimed by ${req.user.id}`);

        return { success: true, claimedBy: shadowUser.displayName };
    }

    /**
     * Release a claimed step (Epic 3.3)
     */
    private async onReleaseStep(req: cds.Request) {
        const param = req.params[0] as { ID: string };
        const { Steps, ShadowUsers, StepHistory } = this.srv.entities;

        // Get step details including request for coordinator check
        const step = await SELECT.one.from(Steps, param.ID)
            .columns('ID', 'claimedBy_ID', 'request_ID');

        if (!step) {
            return req.error(404, 'Step not found');
        }

        if (!step.claimedBy_ID) {
            return req.error(400, 'Step is not claimed');
        }

        // Get current user's ShadowUser ID
        const origin = IdentityProvisioner.getOrigin(req.user);
        const shadowUser = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId: req.user.id })
            .columns('ID');

        // SECURITY: Allow release by claimer, coordinator, or admin
        const isClaimer = step.claimedBy_ID === shadowUser?.ID;
        const isAdmin = req.user.is('admin');

        // Check if user is coordinator of the request
        let isCoordinator = false;
        if (!isClaimer && !isAdmin && step.request_ID) {
            const { Requests } = this.srv.entities;
            const request = await SELECT.one.from(Requests, step.request_ID)
                .columns('coordinatorId', 'coordinatorType') as { coordinatorId: string; coordinatorType: string } | null;

            if (request) {
                isCoordinator = await this.isCurrentCoordinator(req.user.id, origin, request);
            }
        }

        if (!isClaimer && !isAdmin && !isCoordinator) {
            this.log.warn(`[SECURITY] Unauthorized release attempt by ${req.user.id} for step ${param.ID}`);
            return req.error(403, 'Only the claimer, coordinator, or admin can release this step');
        }

        // Release the step
        await UPDATE(Steps).where({ ID: param.ID }).set({
            claimedBy_ID: null,
            claimedAt: null,
            modifiedBy_ID: shadowUser?.ID
        });

        // Log in step history with appropriate comment
        const releaseComment = isClaimer
            ? 'Step released by claimer'
            : isAdmin
                ? 'Step force-released by admin'
                : 'Step force-released by coordinator';

        await INSERT.into(StepHistory).entries({
            step_ID: param.ID,
            action: 'RELEASED',
            actor_ID: shadowUser?.ID || null,
            createdBy_ID: shadowUser?.ID,
            modifiedBy_ID: shadowUser?.ID,
            timestamp: new Date().toISOString(),
            comment: releaseComment
        });

        this.log.info(`Step ${param.ID} released by ${req.user.id} (${isClaimer ? 'claimer' : isAdmin ? 'admin' : 'coordinator'})`);

        return { success: true };
    }

    /**
     * SECURITY: Check if user is the current coordinator of a request
     * Handles both direct USER and GROUP coordinator assignments.
     */
    private async isCurrentCoordinator(
        userId: string,
        origin: string,
        request: { coordinatorType: string; coordinatorId: string }
    ): Promise<boolean> {
        const { GroupMembers, ShadowUsers } = this.srv.entities;

        // Get shadow user using composite key
        const shadowUser = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId })
            .columns('ID') as { ID: string } | null;

        if (!shadowUser) return false;

        // Direct USER coordinator
        if (request.coordinatorType === 'USER') {
            return request.coordinatorId === shadowUser.ID;
        }

        // GROUP-based coordinator - check membership
        const membership = await SELECT.one.from(GroupMembers)
            .where({ user_ID: shadowUser.ID, group_ID: request.coordinatorId })
            .columns('ID') as { ID: string } | null;

        return !!membership;
    }

    /**
     * SECURITY: Check if user is a member of a group.
     * Used for validating step claims on GROUP-assigned steps.
     */
    private async isGroupMember(userId: string, origin: string, groupId: string): Promise<boolean> {
        const { GroupMembers, ShadowUsers } = this.srv.entities;

        // Get shadow user using composite key
        const shadowUser = await SELECT.one.from(ShadowUsers)
            .where({ origin, userId })
            .columns('ID') as { ID: string } | null;

        if (!shadowUser) return false;

        const membership = await SELECT.one.from(GroupMembers)
            .where({ user_ID: shadowUser.ID, group_ID: groupId })
            .columns('ID') as { ID: string } | null;

        return !!membership;
    }

    /**
     * Check if user is the step owner or a member of the step owner group.
     * Used during STARTED / IN_CLARIFICATION status to authorize claiming.
     */
    private async isStepOwnerOrMember(
        shadowUserId: string,
        step: { ownerType: string; ownerId: string },
        userId: string
    ): Promise<boolean> {
        const { GroupMembers } = this.srv.entities;

        if (step.ownerType === 'USER') {
            // Direct user assignment - check if current user matches
            return shadowUserId === step.ownerId;
        }

        // Non-USER type - check group membership
        const membership = await SELECT.one.from(GroupMembers)
            .where({ user_ID: shadowUserId, group_ID: step.ownerId })
            .columns('ID') as { ID: string } | null;

        return !!membership;
    }

    /**
     * Check if user is a pending approver or a member of a pending approver group.
     * Used during IN_PROGRESS status to authorize claiming.
     */
    private async isPendingApproverOrMember(
        shadowUserId: string,
        stepId: string,
        userId: string
    ): Promise<boolean> {
        const { StepApprovals, GroupMembers } = this.srv.entities;

        this.log.info(`[CLAIM-DEBUG] Checking if user can claim step ${stepId}`);
        this.log.info(`[CLAIM-DEBUG] shadowUserId: ${shadowUserId}, userId: ${userId}`);

        const pendingApprovals = await SELECT.from(StepApprovals)
            .where({
                step_ID: stepId,
                status: { in: ['PENDING', 'REAPPROVAL_NEEDED'] }
            })
            .columns('approver', 'approverType');

        this.log.info(`[CLAIM-DEBUG] Found ${pendingApprovals.length} pending approval(s)`);

        for (const approval of pendingApprovals) {
            this.log.info(`[CLAIM-DEBUG] Checking approval: approverType=${approval.approverType}, approver=${approval.approver}`);

            if (approval.approverType === 'USER') {
                // Direct user assignment
                this.log.info(`[CLAIM-DEBUG] USER check: shadowUserId(${shadowUserId}) === approver(${approval.approver}) ? ${shadowUserId === approval.approver}`);
                if (shadowUserId === approval.approver) {
                    return true;
                }
            } else {
                // Group assignment - check membership
                this.log.info(`[CLAIM-DEBUG] GROUP check: Looking for user_ID=${shadowUserId}, group_ID=${approval.approver}`);

                // Also log all memberships for this user for debugging
                const allMemberships = await SELECT.from(GroupMembers)
                    .where({ user_ID: shadowUserId })
                    .columns('group_ID');
                this.log.info(`[CLAIM-DEBUG] User's group memberships: ${JSON.stringify(allMemberships)}`);

                const membership = await SELECT.one.from(GroupMembers)
                    .where({ user_ID: shadowUserId, group_ID: approval.approver })
                    .columns('ID') as { ID: string } | null;

                this.log.info(`[CLAIM-DEBUG] Membership found: ${membership ? 'YES' : 'NO'}`);

                if (membership) {
                    return true;
                }
            }
        }

        this.log.warn(`[CLAIM-DEBUG] No matching approval found for user ${userId}`);
        return false;
    }
}
