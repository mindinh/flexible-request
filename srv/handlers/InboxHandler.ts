import { cds, SELECT } from '../lib/db';
import { IdentityProvisioner } from '../lib/identity-provisioner';

/**
 * InboxHandler - Handles inbox/task list filtering
 * 
 * Epic 3.5: Provides filtered views of pending approvals
 * - My Tasks: Direct assignments to current user
 * - Team Tasks: Assignments to groups user belongs to
 * - Coordinating: Requests where user is coordinator
 */
export class InboxHandler {
    private srv: cds.ApplicationService;
    private log = cds.log('inbox-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.log.info('Registering Inbox Handlers...');

        this.srv.on('getMyTasks', this.onGetMyTasks.bind(this));
        this.srv.on('getTeamTasks', this.onGetTeamTasks.bind(this));
        this.srv.on('getCoordinatingRequests', this.onGetCoordinatingRequests.bind(this));
    }

    /**
     * Get approvals directly assigned to current user
     */
    private async onGetMyTasks(req: cds.Request) {
        const { StepApprovals, ShadowUsers } = this.srv.entities;

        // Get current user's info
        const origin = IdentityProvisioner.getOrigin(req.user);
        const shadowUser = await IdentityProvisioner.getShadowUser(req.user.id, origin);
        if (!shadowUser) {
            return [];
        }

        // Find pending approvals assigned to this user
        const approvals = await SELECT.from(StepApprovals)
            .columns(
                'ID', 'approver', 'approverType', 'status', 'createdAt',
                'step.ID as stepId', 'step.status as stepStatus',
                'step.dueDate', 'step.claimedBy.displayName as claimedBy',
                'step.stepDefinition.stepName',
                'step.request.ID as requestId', 'step.request.title as requestTitle',
                'step.request.requestType.title as requestType'
            )
            .where({
                approverType: 'USER',
                approver: shadowUser.ID,
                status: 'PENDING'
            });

        // Resolve generic display names (though for My Tasks it's usually just the user)
        return this.mapToInboxItems(approvals, 'USER', shadowUser.displayName);
    }

    /**
     * Get approvals assigned to groups the user is a member of
     */
    private async onGetTeamTasks(req: cds.Request) {
        const { StepApprovals, GroupMembers, ShadowUsers, ShadowGroups } = this.srv.entities;

        // Get user's group memberships
        const origin = IdentityProvisioner.getOrigin(req.user);
        const shadowUser = await IdentityProvisioner.getShadowUser(req.user.id, origin);
        if (!shadowUser) {
            return [];
        }

        const memberships = await SELECT.from(GroupMembers)
            .where({ user_ID: shadowUser.ID })
            .columns('group_ID');

        const groupIds = memberships.map((m: { group_ID?: string }) => m.group_ID).filter(Boolean);

        if (groupIds.length === 0) {
            return [];
        }

        // Find pending approvals assigned to these groups
        const teamApprovals = await SELECT.from(StepApprovals)
            .columns(
                'ID', 'approver', 'approverType', 'status', 'createdAt',
                'step.ID as stepId', 'step.status as stepStatus',
                'step.dueDate', 'step.claimedBy.displayName as claimedBy',
                'step.stepDefinition.stepName',
                'step.request.ID as requestId', 'step.request.title as requestTitle',
                'step.request.requestType.title as requestType'
            )
            .where({
                approverType: { in: ['GROUP', 'TEAM', 'DEPARTMENT', 'ROLE'] },
                approver: { in: groupIds },
                status: 'PENDING'
            });

        // We need to map Group IDs to Names
        const groups = await SELECT.from(ShadowGroups)
            .where({ ID: { in: groupIds } })
            .columns('ID', 'name');

        const groupMap = new Map<string, string>();
        groups.forEach((g: any) => groupMap.set(g.ID, g.name));

        return this.mapToInboxItems(teamApprovals, 'GROUP', undefined, groupMap);
    }

    /**
     * Get requests where the user is the coordinator
     */
    private async onGetCoordinatingRequests(req: cds.Request) {
        const { Requests } = this.srv.entities;

        const origin = IdentityProvisioner.getOrigin(req.user);
        const shadowUser = await IdentityProvisioner.getShadowUser(req.user.id, origin);
        if (!shadowUser) {
            return [];
        }

        // Requests table doesn't have coordinatorDisplayName, so we fetch generic info
        // and knowing filter is 'coordinatorId = shadowUser.ID', assignedTo is the user.
        const requests = await SELECT.from(Requests)
            .columns(
                'ID as requestId', 'title as requestTitle', 'status', 'createdAt',
                'requestType.title as requestType',
                'coordinatorId', 'coordinatorType'
            )
            .where({
                coordinatorId: shadowUser.ID,
                status: { in: ['SUBMITTED', 'IN_PROGRESS'] }
            });

        return requests.map((r: Record<string, unknown>) => ({
            stepApprovalId: null,
            stepId: null,
            requestId: r.requestId,
            requestTitle: r.requestTitle,
            requestType: r.requestType,
            stepName: 'Coordinator',
            status: r.status,
            assignedTo: shadowUser.displayName || 'You',
            assignedType: 'COORDINATOR',
            claimedBy: null, // Coordinators don't claim steps usually
            createdAt: r.createdAt,
            dueDate: null
        }));
    }

    /**
     * Map raw approval data to InboxItem type
     */
    private mapToInboxItems(
        approvals: Record<string, unknown>[],
        assignedType: string,
        fixedName?: string,
        nameMap?: Map<string, string>
    ) {
        return approvals.map((a: Record<string, unknown>) => {
            let assignedToName = fixedName || `${a.approver}`;
            if (nameMap && a.approver) {
                assignedToName = nameMap.get(a.approver as string) || (a.approver as string);
            }

            return {
                stepApprovalId: a.ID,
                stepId: a.stepId,
                requestId: a.requestId,
                requestTitle: a.requestTitle,
                requestType: a.requestType,
                stepName: a.stepName,
                status: a.status,
                assignedTo: assignedToName,
                assignedType,
                claimedBy: a.claimedBy,
                createdAt: a.createdAt,
                dueDate: a.dueDate
            };
        });
    }
}
