import { cds, SELECT } from '../../lib/db';

/**
 * Handles ApproverRules operations.
 * Main responsibility: Populate virtual display names for UI configuration.
 * 
 * NOTE: For $expand scenarios (e.g., RequestTypes?$expand=steps($expand=approverRules)),
 * display names are also populated by RequestTypeHandler.afterRead.
 * This handler covers direct ApproverRules reads.
 */
export class ApproverRulesHandler {

    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.srv.after('READ', 'ApproverRules', this.afterRead.bind(this));
    }

    /**
     * After READ: Populate principalDisplayName by looking up ShadowUsers/ShadowGroups
     */
    private async afterRead(results: any[]) {
        if (!results || !Array.isArray(results) || results.length === 0) return;

        const { ShadowUsers, ShadowGroups } = this.srv.entities;

        // Collect all IDs needed for lookup
        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        // Map results to easy lookup
        results.forEach(rule => {
            if (rule.principalId) {
                if (rule.principalType === 'USER') {
                    userIds.add(rule.principalId);
                } else if (['GROUP', 'TEAM', 'ROLE', 'POSITION', 'DEPARTMENT'].includes(rule.principalType)) {
                    groupIds.add(rule.principalId);
                }
            }
        });

        // Batch fetch names
        const userMap = new Map<string, string>();
        if (userIds.size > 0) {
            const users = await SELECT.from(ShadowUsers)
                .where({ ID: { in: [...userIds] } })
                .columns('ID', 'displayName', 'email');
            users.forEach((u: any) => userMap.set(u.ID, u.displayName || u.email));
        }

        const groupMap = new Map<string, string>();
        if (groupIds.size > 0) {
            const groups = await SELECT.from(ShadowGroups)
                .where({ ID: { in: [...groupIds] } })
                .columns('ID', 'name');
            groups.forEach((g: any) => groupMap.set(g.ID, g.name));
        }

        // Apply names to results
        results.forEach(rule => {
            if (rule.principalId) {
                if (rule.principalType === 'USER') {
                    rule.principalDisplayName = userMap.get(rule.principalId) || rule.principalId; // Fallback to ID if not found
                } else {
                    rule.principalDisplayName = groupMap.get(rule.principalId) || rule.principalId;
                }
            }
        });
    }
}
