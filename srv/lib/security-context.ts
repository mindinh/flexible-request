import { cds, SELECT } from './db';
import { IdentityProvisioner } from './identity-provisioner';

/**
 * SecurityContext - Row-Level Security helpers
 * 
 * Epic 4.1: Provides context about the current user for RLS enforcement
 */

export interface UserSecurityContext {
    shadowUserId: string | null;
    userId: string;              // IDP user ID
    groupIds: string[];          // ShadowGroup IDs user belongs to
    isAdmin: boolean;
    isAuthenticated: boolean;
}

/**
 * Feature flag for Row Level Security (RLS)
 * 
 * RLS is ENABLED by default. To disable, set in package.json or .cdsrc.json:
 * { "cds": { "features": { "rowLevelSecurity": false } } }
 */
export function isRLSEnabled(): boolean {
    return (cds.env as any)?.features?.rowLevelSecurity !== false;
}

/**
 * Resolve current user's security context from request
 */
export async function resolveSecurityContext(req: cds.Request): Promise<UserSecurityContext> {
    const log = cds.log('security-context');
    const userId = req.user?.id;
    const isAuthenticated = userId && userId !== 'anonymous';

    if (!isAuthenticated) {
        return {
            shadowUserId: null,
            userId: 'anonymous',
            groupIds: [],
            isAdmin: false,
            isAuthenticated: false
        };
    }

    // Check admin role
    const isAdmin = req.user.is('admin') || req.user.is('system-user');

    // Extract origin using centralized helper
    const origin = IdentityProvisioner.getOrigin(req.user);

    // Get ShadowUser using composite key
    const shadowUser = await IdentityProvisioner.getShadowUser(userId, origin);
    const shadowUserId = shadowUser?.ID ?? null;

    log.debug(`[SecurityContext] User: ${origin}:${userId}, ShadowUserId: ${shadowUserId}, isAdmin: ${isAdmin}`);

    // Get group memberships
    const groupIds = shadowUserId
        ? await getMyGroupIds(shadowUserId)
        : [];

    log.debug(`[SecurityContext] GroupIds: ${groupIds.join(', ') || 'none'}`);

    return {
        shadowUserId,
        userId: userId!,
        groupIds,
        isAdmin,
        isAuthenticated: true
    };
}

/**
 * Get all group IDs the user belongs to
 */
export async function getMyGroupIds(shadowUserId: string): Promise<string[]> {
    const { GroupMembers } = cds.entities('sap.cre');

    const memberships = await SELECT.from(GroupMembers)
        .where({ user_ID: shadowUserId })
        .columns('group_ID');

    return memberships
        .map((m: { group_ID?: string }) => m.group_ID)
        .filter((id: string | undefined): id is string => !!id);
}

/**
 * Check if user can access a specific request based on visibility rules
 * 
 * Visibility Matrix:
 * - Requester: Own requests (createdBy_ID matches shadowUserId)
 * - Coordinator: Requests where user is coordinator (by UUID)
 * - Approver: Requests with pending approvals for user/group (by UUID)
 * - Admin: All requests
 */
export async function canAccessRequest(
    ctx: UserSecurityContext,
    requestId: string
): Promise<boolean> {
    // Admin can see all
    if (ctx.isAdmin) return true;
    if (!ctx.shadowUserId) return false;

    const { Requests, StepApprovals } = cds.entities('sap.cre');

    // Check if requester (using UUID-based createdBy_ID)
    const request = await SELECT.one.from(Requests, requestId)
        .columns('createdBy_ID', 'coordinatorId');

    if (!request) return false;

    // Requester access (createdBy_ID is UUID matching shadowUserId)
    if (request.createdBy_ID === ctx.shadowUserId) return true;

    // Coordinator access
    if (request.coordinatorId === ctx.shadowUserId) return true;

    // Check group coordinator
    if (ctx.groupIds.includes(request.coordinatorId)) return true;

    // Approver access - check if user has pending approval
    const approvals = await SELECT.from(StepApprovals)
        .where({
            'step.request_ID': requestId,
            status: { in: ['PENDING', 'WAITING'] }
        })
        .columns('approver', 'approverType');

    for (const approval of approvals) {
        // Direct user assignment (approver is ShadowUser UUID)
        if (approval.approverType === 'USER' && approval.approver === ctx.shadowUserId) {
            return true;
        }
        // Group assignment - check if user is member of the group (any non-USER type)
        if (approval.approverType && approval.approverType !== 'USER') {
            if (ctx.groupIds.includes(approval.approver)) {
                return true;
            }
        }
    }

    return false;
}
