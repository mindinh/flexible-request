import { cds, SELECT } from '../../lib/db';

/**
 * Handles StepDefinitions and StepDependencies validation.
 * Also handles ownerDisplayName resolution for steps.
 */
export class StepHandler {

    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all step-related handlers
     */
    register() {
        this.srv.before('CREATE', 'StepDependencies', this.validateDependency.bind(this));
        this.srv.after('READ', 'StepDefinitions', this.afterReadSteps.bind(this));
    }

    /**
     * After READ: Populate ownerDisplayName by looking up ShadowUsers/ShadowGroups
     * This fires for both direct reads and $expand scenarios
     */
    private async afterReadSteps(results: any[]) {
        if (!results || results.length === 0) return;

        // Handle single result
        const items = Array.isArray(results) ? results : [results];

        const { ShadowUsers, ShadowGroups } = this.srv.entities;

        // Collect all owner IDs
        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        for (const step of items) {
            if (step.ownerId) {
                if (step.ownerType === 'USER') {
                    userIds.add(step.ownerId);
                } else if (['GROUP', 'TEAM', 'ROLE', 'POSITION', 'DEPARTMENT'].includes(step.ownerType)) {
                    groupIds.add(step.ownerId);
                }
            }
        }

        // Batch fetch names
        const userMap = new Map<string, string>();
        if (userIds.size > 0) {
            try {
                const users = await SELECT.from(ShadowUsers)
                    .where({ ID: { in: [...userIds] } })
                    .columns('ID', 'displayName', 'email');
                users.forEach((u: any) => userMap.set(u.ID, u.displayName || u.email || u.ID));
            } catch (e) {
                console.warn('[StepHandler] Failed to fetch users:', e);
            }
        }

        const groupMap = new Map<string, string>();
        if (groupIds.size > 0) {
            try {
                const groups = await SELECT.from(ShadowGroups)
                    .where({ ID: { in: [...groupIds] } })
                    .columns('ID', 'name');
                groups.forEach((g: any) => groupMap.set(g.ID, g.name || g.ID));
            } catch (e) {
                console.warn('[StepHandler] Failed to fetch groups:', e);
            }
        }

        // Apply names to results
        for (const step of items) {
            if (step.ownerId) {
                if (step.ownerType === 'USER') {
                    step.ownerDisplayName = userMap.get(step.ownerId) || step.ownerId;
                } else {
                    step.ownerDisplayName = groupMap.get(step.ownerId) || step.ownerId;
                }
            }
        }
    }

    /**
     * Prevent circular dependencies and self-references
     */
    private async validateDependency(req: cds.Request) {
        const { StepDependencies } = this.srv.entities;
        const data = req.data as { step_ID?: string; dependsOn_ID?: string };

        // Check self-reference
        if (data.step_ID === data.dependsOn_ID) {
            return req.error(400, 'A step cannot depend on itself');
        }

        // Check for circular dependency (A depends on B, B depends on A)
        if (data.step_ID && data.dependsOn_ID) {
            const reverseDep = await SELECT.one.from(StepDependencies)
                .where({
                    step_ID: data.dependsOn_ID,
                    dependsOn_ID: data.step_ID
                });

            if (reverseDep) {
                return req.error(400, 'Circular dependency detected');
            }
        }
    }
}
