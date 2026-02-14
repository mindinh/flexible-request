import { cds, SELECT } from '../lib/db';

const LOG = cds.log('request-type-handler');

/**
 * Shared RequestType Handler for enrichment logic.
 * Used by both AdminService and RequestService.
 */
export class SharedRequestTypeHandler {
    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Enrich RequestTypes with display names for steps and approverRules.
     * Resolves principalId/ownerId to human-readable names from ShadowUsers/ShadowGroups.
     */
    async enrichRequestTypes(data: any) {
        const items = Array.isArray(data) ? data : data ? [data] : [];
        if (items.length === 0) return;

        LOG.debug(`Enriching ${items.length} RequestType(s)`);

        const { ShadowUsers, ShadowGroups } = this.srv.entities;

        // Collect IDs to resolve
        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        // Walk the expanded graph: RequestTypes -> steps -> approverRules
        for (const item of items) {
            const steps = Array.isArray(item?.steps) ? item.steps : [];

            for (const step of steps) {
                // Step owner
                if (step?.ownerId) {
                    if (step.ownerType === 'USER') {
                        userIds.add(step.ownerId);
                    } else if (['GROUP', 'TEAM', 'ROLE', 'POSITION', 'DEPARTMENT'].includes(step.ownerType)) {
                        groupIds.add(step.ownerId);
                    }
                }

                // Approver rules
                const rules = Array.isArray(step?.approverRules) ? step.approverRules : [];

                for (const rule of rules) {
                    if (rule?.principalId) {
                        if (rule.principalType === 'USER') {
                            userIds.add(rule.principalId);
                        } else if (['GROUP', 'TEAM', 'ROLE', 'POSITION', 'DEPARTMENT'].includes(rule.principalType)) {
                            groupIds.add(rule.principalId);
                        }
                    }
                }
            }
        }

        LOG.debug(`Collected IDs - Users: ${userIds.size}, Groups: ${groupIds.size}`);

        // Batch fetch display names
        const userMap = new Map<string, string>();
        if (userIds.size > 0) {
            try {
                const users = await SELECT.from(ShadowUsers)
                    .where({ ID: { in: [...userIds] } })
                    .columns('ID', 'displayName', 'email');

                for (const u of users ?? []) {
                    const name = u.displayName || u.email || u.ID;
                    userMap.set(u.ID, name);
                }
                LOG.debug(`Fetched ${users?.length || 0} user display names`);
            } catch (e) {
                LOG.warn('Failed to fetch user display names:', e);
            }
        }

        const groupMap = new Map<string, string>();
        if (groupIds.size > 0) {
            try {
                const groups = await SELECT.from(ShadowGroups)
                    .where({ ID: { in: [...groupIds] } })
                    .columns('ID', 'name');

                for (const g of groups ?? []) {
                    const name = g.name || g.ID;
                    groupMap.set(g.ID, name);
                }
                LOG.debug(`Fetched ${groups?.length || 0} group display names`);
            } catch (e) {
                LOG.warn('Failed to fetch group display names:', e);
            }
        }

        // Apply display names (populate virtuals)
        for (const item of items) {
            const steps = Array.isArray(item?.steps) ? item.steps : [];
            for (const step of steps) {
                step.ownerDisplayName =
                    step.ownerType === 'USER'
                        ? userMap.get(step.ownerId) ?? step.ownerId
                        : groupMap.get(step.ownerId) ?? step.ownerId;

                const rules = Array.isArray(step?.approverRules) ? step.approverRules : [];

                for (const rule of rules) {
                    if (rule?.principalId) {
                        rule.principalDisplayName = rule.principalType === 'USER'
                            ? userMap.get(rule.principalId) ?? rule.principalId
                            : groupMap.get(rule.principalId) ?? rule.principalId;
                    }
                }
            }
        }

        LOG.debug('Enrichment complete');
    }
}

