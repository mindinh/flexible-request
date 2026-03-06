import { cds, SELECT } from '../lib/db';
import { resolveSecurityContext, isRLSEnabled, UserSecurityContext } from '../lib/security-context';

/**
 * RLSHandler - Row-Level Security enforcement
 *
 * Visibility Matrix:
 * - Requester : Own requests (createdBy_ID = shadowUserId)
 * - Coordinator: Requests where user or their group is coordinator
 * - Approver   : Requests with any approval assigned to user or their groups
 * - Admin      : All requests (bypass)
 *
 * Implementation Strategy:
 * Pre-fetch visible request IDs, then inject a WHERE ID IN (...) filter.
 * Returns nothing (ID IN []) when user has no visible requests.
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
        this.srv.before('READ', 'Notifications', this.enforceNotificationsRLS.bind(this));
    }

    // -------------------------------------------------------------------------
    // Requests RLS
    // -------------------------------------------------------------------------

    /**
     * Enforce RLS on Requests entity.
     *
     * Users only see requests they are party to:
     *   1. They created                (createdBy_ID match)
     *   2. They are the coordinator    (coordinatorId match)
     *   3. Their group is coordinator  (coordinatorId in groupIds)
     *   4. They have an approval slot  (StepApprovals.approver match)
     *
     * Admins bypass all filters.
     */
    private async enforceRequestsRLS(req: cds.Request) {
        if (!isRLSEnabled()) {
            this.log.debug('[RLS] Disabled by feature flag');
            return;
        }

        const ctx = await resolveSecurityContext(req);

        // Admin bypass — see everything
        if (ctx.isAdmin) {
            this.log.debug('[RLS] Admin bypass for Requests');
            return;
        }

        // Block unauthenticated access
        if (!ctx.isAuthenticated) {
            this.log.warn('[RLS] Unauthenticated access attempt blocked');
            this.blockQuery(req);
            return;
        }

        // If user has no shadow record (JIT may not have run yet), block all
        if (!ctx.shadowUserId) {
            this.log.warn(`[RLS] No ShadowUser for ${ctx.userId} — blocking access`);
            this.blockQuery(req);
            return;
        }

        const visibleIds = await this.getVisibleRequestIds(ctx);

        if (visibleIds.length === 0) {
            this.log.debug(`[RLS] No visible requests for ${ctx.userId}`);
            this.blockQuery(req);
            return;
        }

        this.log.debug(`[RLS] User ${ctx.userId} can see ${visibleIds.length} request(s)`);
        (req.query as any).where({ ID: { in: visibleIds } });
    }

    /**
     * Collect all request IDs that the current user is authorised to read.
     */
    private async getVisibleRequestIds(ctx: UserSecurityContext): Promise<string[]> {
        const { Requests, Steps, StepApprovals } = this.srv.entities;
        const visibleIds = new Set<string>();

        // Build principal list: user's own ID + all group IDs they belong to
        const principalIds: string[] = [];
        if (ctx.shadowUserId) principalIds.push(ctx.shadowUserId);
        if (ctx.groupIds?.length) principalIds.push(...ctx.groupIds);

        // 1. Requests created by this user
        const created = await SELECT.from(Requests)
            .columns('ID')
            .where({ createdBy_ID: ctx.shadowUserId });
        created.forEach((r: { ID: string }) => visibleIds.add(r.ID));

        // 2. Requests where user (or their group) is coordinator
        if (principalIds.length > 0) {
            const coordinated = await SELECT.from(Requests)
                .columns('ID')
                .where({ coordinatorId: { in: principalIds } });
            coordinated.forEach((r: { ID: string }) => visibleIds.add(r.ID));
        }

        // 3. Requests with any approval assigned to user or their groups
        if (principalIds.length > 0) {
            const approvals = await SELECT.from(StepApprovals)
                .columns('step_ID')
                .where({ approver: { in: principalIds } });

            if (approvals.length > 0) {
                const stepIds = [...new Set(approvals.map((a: { step_ID: string }) => a.step_ID))];
                const steps = await SELECT.from(Steps)
                    .columns('request_ID')
                    .where({ ID: { in: stepIds } });
                steps.forEach((s: { request_ID: string }) => {
                    if (s.request_ID) visibleIds.add(s.request_ID);
                });
            }
        }

        // 4. Requests where user (or their group) owns a step (data-entry tasks)
        if (principalIds.length > 0) {
            const ownedSteps = await SELECT.from(Steps)
                .columns('request_ID')
                .where({ ownerId: { in: principalIds } });
            ownedSteps.forEach((s: { request_ID: string }) => {
                if (s.request_ID) visibleIds.add(s.request_ID);
            });
        }

        this.log.debug(`[RLS] Resolved ${visibleIds.size} visible request(s) for ${ctx.userId}`);
        return [...visibleIds];
    }

    // -------------------------------------------------------------------------
    // Steps RLS
    // -------------------------------------------------------------------------

    /**
     * Enforce RLS on Steps.
     * Steps inherit visibility from their parent Request — if you can see
     * the request, you can see its steps. No separate filter needed here
     * because CAP will scope Steps via the parent Request's WHERE when
     * navigating via $expand or navigation property.
     *
     * For direct access to /Steps, we apply the same principal filter.
     */
    private async enforceStepsRLS(req: cds.Request) {
        if (!isRLSEnabled()) return;

        const ctx = await resolveSecurityContext(req);
        if (ctx.isAdmin) return;

        if (!ctx.isAuthenticated || !ctx.shadowUserId) {
            this.blockQuery(req);
            return;
        }

        // Steps visibility mirrors Request visibility — derive via visible request IDs
        const visibleIds = await this.getVisibleRequestIds(ctx);

        if (visibleIds.length === 0) {
            this.blockQuery(req);
            return;
        }

        (req.query as any).where({ request_ID: { in: visibleIds } });
    }

    // -------------------------------------------------------------------------
    // StepApprovals RLS
    // -------------------------------------------------------------------------

    /**
     * Enforce RLS on StepApprovals.
     * Users may only see approvals assigned directly to them or to a group
     * they are a member of.
     */
    private async enforceApprovalsRLS(req: cds.Request) {
        if (!isRLSEnabled()) return;

        const ctx = await resolveSecurityContext(req);
        if (ctx.isAdmin) return;

        if (!ctx.isAuthenticated) {
            this.blockQuery(req);
            return;
        }

        if (!ctx.shadowUserId) {
            this.log.warn(`[RLS][Approvals] No ShadowUser for ${ctx.userId} — blocking`);
            this.blockQuery(req);
            return;
        }

        const principalIds: string[] = [ctx.shadowUserId, ...ctx.groupIds];

        this.log.debug(`[RLS][Approvals] Filtering to principalIds: ${principalIds.join(', ')}`);
        (req.query as any).where({ approver: { in: principalIds } });
    }

    // -------------------------------------------------------------------------
    // Notifications RLS
    // -------------------------------------------------------------------------

    /**
     * Enforce RLS on Notifications.
     * Users only see notifications where they are the recipient.
     */
    private async enforceNotificationsRLS(req: cds.Request) {
        if (!isRLSEnabled()) return;

        const ctx = await resolveSecurityContext(req);

        if (!ctx.isAuthenticated || !ctx.shadowUserId) {
            this.blockQuery(req);
            return;
        }

        this.log.debug(`[RLS][Notifications] Filtering for recipient: ${ctx.shadowUserId}`);
        (req.query as any).where({ recipient_ID: ctx.shadowUserId });
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Inject a "WHERE 1 = 0" condition to return zero rows.
     * Used instead of throwing an error so the API returns an empty list,
     * which is the correct semantic for a filtered read.
     */
    private blockQuery(req: cds.Request) {
        // Using a known-false condition: ID must be a non-empty UUID, 
        // so matching against the empty string safely returns nothing.
        (req.query as any).where({ ID: { '=': '' } });
    }
}
