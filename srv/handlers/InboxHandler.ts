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
     * ALSO includes group-assigned approvals that this user has claimed.
     */
    private async onGetMyTasks(req: cds.Request) {
        const { StepApprovals } = this.srv.entities;

        // Get current user's info
        const origin = IdentityProvisioner.getOrigin(req.user);
        const shadowUser = await IdentityProvisioner.getShadowUser(req.user.id, origin);
        if (!shadowUser) {
            return [];
        }

        // NOTE: CDS CQL cannot resolve 3-level deep association paths in SELECT columns
        // (e.g. step.claimedBy.displayName from StepApprovals). So we fetch claimedBy
        // info separately from Steps and merge by stepId.
        const INBOX_COLUMNS = [
            'ID', 'approver', 'approverType', 'status', 'createdAt',
            'step.ID as stepId', 'step.status as stepStatus',
            'step.dueDate',
            'step.stepDefinition.stepName',
            'step.request.ID as requestId', 'step.request.title as requestTitle',
            'step.request.requestType.title as requestType'
        ];

        // 1) Direct USER approvals assigned to this user
        const directApprovals = await SELECT.from(StepApprovals)
            .columns(...INBOX_COLUMNS)
            .where({
                approverType: 'USER',
                approver: shadowUser.ID,
                status: 'PENDING'
            });

        // 2) Group/Team approvals where the step is claimed by this user
        //    Query db-level Steps to reliably access claimedBy_ID FK column
        const db = await cds.connect.to('db');
        const { Steps: DbSteps } = db.entities('sap.cre');
        const claimedSteps = await SELECT.from(DbSteps)
            .columns('ID')
            .where({ claimedBy_ID: shadowUser.ID });
        const claimedStepIds = claimedSteps.map((s: any) => s.ID).filter(Boolean);

        let claimedGroupApprovals: Record<string, unknown>[] = [];
        if (claimedStepIds.length > 0) {
            claimedGroupApprovals = await SELECT.from(StepApprovals)
                .columns(...INBOX_COLUMNS)
                .where({
                    approverType: { in: ['GROUP', 'TEAM', 'DEPARTMENT', 'ROLE'] },
                    status: 'PENDING',
                    step_ID: { in: claimedStepIds }
                });
        }

        // 3) Merge and deduplicate by approval ID
        const seen = new Set<string>();
        const merged: Record<string, unknown>[] = [];
        for (const a of [...directApprovals, ...claimedGroupApprovals]) {
            const id = a.ID as string;
            if (!seen.has(id)) {
                seen.add(id);
                merged.push(a);
            }
        }

        // 4) Enrich with claimedBy info from Steps
        const stepIds = [...new Set(merged.map((a: any) => a.stepId).filter(Boolean))];
        const claimedByMap = await this.getClaimedByMap(stepIds as string[]);
        for (const a of merged) {
            const info = claimedByMap.get(a.stepId as string);
            (a as any).claimedBy = info?.displayName ?? null;
            (a as any).claimedByUserId = info?.userId ?? null;
        }

        return this.mapToInboxItems(merged, undefined, shadowUser.displayName);
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
                'step.dueDate',
                'step.stepDefinition.stepName',
                'step.request.ID as requestId', 'step.request.title as requestTitle',
                'step.request.requestType.title as requestType'
            )
            .where({
                approverType: { in: ['GROUP', 'TEAM', 'DEPARTMENT', 'ROLE'] },
                approver: { in: groupIds },
                status: 'PENDING'
            });

        // Enrich with claimedBy info from Steps
        const stepIds = [...new Set(teamApprovals.map((a: any) => a.stepId).filter(Boolean))];
        const claimedByMap = await this.getClaimedByMap(stepIds as string[]);

        // Filter out tasks claimed by the current user (they appear in My Tasks instead)
        const filtered = teamApprovals.filter((a: any) => {
            const info = claimedByMap.get(a.stepId as string);
            if (info?.userId === shadowUser.ID) return false;
            // Enrich the remaining tasks
            (a as any).claimedBy = info?.displayName ?? null;
            (a as any).claimedByUserId = info?.userId ?? null;
            return true;
        });

        // We need to map Group IDs to Names
        const groups = await SELECT.from(ShadowGroups)
            .where({ ID: { in: groupIds } })
            .columns('ID', 'name');

        const groupMap = new Map<string, string>();
        groups.forEach((g: any) => groupMap.set(g.ID, g.name));

        return this.mapToInboxItems(filtered, undefined, undefined, groupMap);
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
     * Fetch claimedBy displayName + userId for a batch of step IDs.
     * Uses cds.db entities directly (not service projections) because CDS service-level
     * SELECT columns silently drop generated FK columns like claimedBy_ID.
     */
    private async getClaimedByMap(
        stepIds: string[]
    ): Promise<Map<string, { displayName: string | null; userId: string | null }>> {
        const map = new Map<string, { displayName: string | null; userId: string | null }>();
        if (stepIds.length === 0) return map;

        const db = await cds.connect.to('db');
        const { Steps, ShadowUsers } = db.entities('sap.cre');

        // 1) Get claimedBy_ID (direct FK) from db-level Steps
        const steps = await SELECT.from(Steps)
            .columns('ID', 'claimedBy_ID')
            .where({ ID: { in: stepIds } });

        this.log.debug('[getClaimedByMap] Steps result:', JSON.stringify(steps));

        // 2) Collect unique claimer IDs and resolve display names
        const claimerIds = [...new Set(steps.map((s: any) => s.claimedBy_ID).filter(Boolean))];
        const nameMap = new Map<string, string>();
        if (claimerIds.length > 0) {
            const users = await SELECT.from(ShadowUsers)
                .columns('ID', 'displayName')
                .where({ ID: { in: claimerIds } });
            for (const u of users) {
                nameMap.set(u.ID as string, (u as any).displayName ?? '');
            }
        }

        // 3) Build the map
        for (const s of steps) {
            const claimerId = (s as any).claimedBy_ID as string | null;
            map.set(s.ID as string, {
                displayName: claimerId ? (nameMap.get(claimerId) ?? null) : null,
                userId: claimerId ?? null
            });
        }
        return map;
    }

    /**
     * Map raw approval data to InboxItem type.
     * 
     * @param assignedTypeOverride - If provided, forces all items to this type.
     *   When undefined, uses the approval's own approverType (dynamic).
     */
    private mapToInboxItems(
        approvals: Record<string, unknown>[],
        assignedTypeOverride?: string,
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
                assignedType: assignedTypeOverride ?? (a.approverType as string),
                claimedBy: a.claimedBy,
                claimedByUserId: a.claimedByUserId ?? null,
                createdAt: a.createdAt,
                dueDate: a.dueDate
            };
        });
    }
}
