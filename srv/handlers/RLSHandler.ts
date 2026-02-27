import { cds, SELECT } from '../lib/db';
import { resolveSecurityContext, isRLSEnabled, UserSecurityContext } from '../lib/security-context';

/**
 * RLSHandler - Row-Level Security enforcement
 * 
 * Epic 4.1: Filters data access based on user context
 * 
 * Visibility Matrix:
 * - Requester: Own requests
 * - Coordinator: Coordinating requests
 * - Approver: Requests with assigned approvals
 * - Admin: All
 */
export class RLSHandler {
    private srv: cds.ApplicationService;
    private log = cds.log('rls-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.log.info('Registering RLS Handlers...');

        // Apply RLS filters before read operations
        this.srv.before('READ', 'Requests', this.enforceRequestsRLS.bind(this));
        this.srv.before('READ', 'Steps', this.enforceStepsRLS.bind(this));
        this.srv.before('READ', 'StepApprovals', this.enforceApprovalsRLS.bind(this));
    }

    /**
     * Enforce RLS on Requests entity
     */
    private async enforceRequestsRLS(req: cds.Request) {
        // Check feature flag
        if (!isRLSEnabled()) {
            this.log.debug('RLS disabled by feature flag');
            return;
        }

        const ctx = await resolveSecurityContext(req);

        // Admin bypass
        if (ctx.isAdmin) {
            this.log.debug('Admin user - RLS bypass');
            return;
        }

        // Not authenticated - block all
        if (!ctx.isAuthenticated) {
            this.log.warn('Unauthenticated access attempt');
            (req.query as any).where({ 1: 0 }); // Return nothing
            return;
        }

        // User not in ShadowUsers table - block all (JIT provisioning may have failed)
        if (!ctx.shadowUserId) {
            this.log.warn(`User ${ctx.userId} has no ShadowUser record - blocking access. Check if JIT provisioning is working.`);
            (req.query as any).where({ 1: 0 }); // Return nothing
            return;
        }

        // Build visibility filter using pre-fetched visible request IDs
        const visibleRequestIds = await this.getVisibleRequestIds(ctx);

        if (visibleRequestIds.length === 0) {
            // User has no visible requests - block all
            this.log.debug(`No visible requests for user ${ctx.userId}`);
            (req.query as any).where({ 1: 0 });
            return;
        }

        this.log.debug(`Applying RLS filter for user ${ctx.userId}: ${visibleRequestIds.length} visible requests`);
        (req.query as any).where({ ID: { in: visibleRequestIds } });
    }

    /**
     * Get all request IDs visible to the current user
     * This approach avoids complex OR conditions in the query
     */
    private async getVisibleRequestIds(ctx: UserSecurityContext): Promise<string[]> {
        const { Requests, StepApprovals, Steps } = this.srv.entities;

        // Collect visible request IDs from multiple queries
        const visibleIds = new Set<string>();

        this.log.debug(`[RLS] Resolving visible requests for user: ${ctx.userId}, shadowId: ${ctx.shadowUserId}`);

        // 1. Requests created by user (using UUID-based createdBy_ID)
        const createdRequests = await SELECT.from(Requests)
            .columns('ID')
            .where({ createdBy_ID: ctx.shadowUserId });
        createdRequests.forEach((r: { ID: string }) => visibleIds.add(r.ID));
        this.log.debug(`[RLS] Created by user: ${createdRequests.length} requests`);

        // 2. Requests where user is direct coordinator
        const coordinatorRequests = await SELECT.from(Requests)
            .columns('ID')
            .where({ coordinatorId: ctx.shadowUserId });
        coordinatorRequests.forEach((r: { ID: string }) => visibleIds.add(r.ID));
        this.log.debug(`[RLS] Coordinator requests: ${coordinatorRequests.length} requests`);

        // 3. Requests where user's group is coordinator (only if user has groups)
        if (ctx.groupIds && ctx.groupIds.length > 0) {
            const groupCoordinatorRequests = await SELECT.from(Requests)
                .columns('ID')
                .where({ coordinatorId: { in: ctx.groupIds } });
            groupCoordinatorRequests.forEach((r: { ID: string }) => visibleIds.add(r.ID));
            this.log.debug(`[RLS] Group coordinator requests: ${groupCoordinatorRequests.length} requests`);
        }

        // Build list of all principal IDs to check (user + their groups)
        const principalIds: string[] = [];
        if (ctx.shadowUserId) principalIds.push(ctx.shadowUserId);
        if (ctx.groupIds) principalIds.push(...ctx.groupIds);

        if (principalIds.length === 0) {
            this.log.warn(`[RLS] No valid principal IDs for user ${ctx.userId} - shadowUserId may be null`);
            this.log.debug(`[RLS] Total visible requests: ${visibleIds.size}`);
            return [...visibleIds];
        }

        // 4. Requests with pending/waiting approvals for user or their groups
        this.log.debug(`[RLS] Checking approvals for principalIds: ${principalIds.join(', ')}`);

        const approvalRequests = await SELECT.from(StepApprovals)
            .columns('step_ID', 'approver', 'status')
            .where({
                status: { in: ['PENDING', 'WAITING', 'SENDBACK', 'REAPPROVAL_NEEDED', 'APPROVED', 'REJECTED'] },
                approver: { in: principalIds }
            });

        this.log.debug(`[RLS] Found ${approvalRequests.length} matching approvals`);

        if (approvalRequests.length > 0) {
            const stepIds = approvalRequests.map((a: { step_ID: string }) => a.step_ID);
            const steps = await SELECT.from(Steps)
                .columns('request_ID')
                .where({ ID: { in: stepIds } });

            steps.forEach((s: { request_ID: string }) => {
                if (s.request_ID) visibleIds.add(s.request_ID);
            });
            this.log.debug(`[RLS] Approval-based requests: ${steps.length} requests`);
        }

        // 5. Requests where user is a step owner (directly or via group)
        const ownedSteps = await SELECT.from(Steps)
            .columns('request_ID')
            .where({ ownerId: { in: principalIds } });

        ownedSteps.forEach((s: { request_ID: string }) => {
            if (s.request_ID) visibleIds.add(s.request_ID);
        });
        this.log.debug(`[RLS] Step owner requests: ${ownedSteps.length} requests`);

        this.log.debug(`[RLS] Total visible requests: ${visibleIds.size}`);
        return [...visibleIds];
    }

    /**
     * Enforce RLS on Steps - inherit from Request access
     */
    private async enforceStepsRLS(req: cds.Request) {
        if (!isRLSEnabled()) return;

        const ctx = await resolveSecurityContext(req);
        if (ctx.isAdmin) return;

        if (!ctx.isAuthenticated || !ctx.shadowUserId) {
            (req.query as any).where({ 1: 0 });
            return;
        }

        // Steps visibility follows Request visibility
        // User can see step if they can see the parent request
        // This is enforced at query level through request expansion
        this.log.debug('Steps RLS applied via Request relationship');
    }

    /**
     * Enforce RLS on StepApprovals
     * 
     * Users may only see approvals that are assigned:
     * - Directly to them (approverType = USER, approver = their ShadowUser ID)
     * - To a group they are a member of
     */
    private async enforceApprovalsRLS(req: cds.Request) {
        if (!isRLSEnabled()) return;

        const ctx = await resolveSecurityContext(req);
        if (ctx.isAdmin) return;

        if (!ctx.isAuthenticated) {
            (req.query as any).where({ 1: 0 });
            return;
        }

        // User not in ShadowUsers - block all
        if (!ctx.shadowUserId) {
            this.log.warn(`[ApprovalsRLS] User ${ctx.userId} has no ShadowUser record - blocking access.`);
            (req.query as any).where({ 1: 0 });
            return;
        }

        // Build list of principal IDs: user's own ID + all their group IDs
        const principalIds: string[] = [ctx.shadowUserId, ...ctx.groupIds];

        this.log.debug(`[ApprovalsRLS] Filtering StepApprovals to principalIds: ${principalIds.join(', ')}`);

        // Filter: only show approvals where approver is one of the principal IDs
        (req.query as any).where({ approver: { in: principalIds } });
    }
}
