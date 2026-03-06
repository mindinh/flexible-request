import { cds, SELECT } from '../lib/db';

const LOG = cds.log('request-type-handler');

const GROUP_TYPES = ['GROUP', 'TEAM', 'ROLE', 'POSITION', 'DEPARTMENT'];

/**
 * Shared RequestType Handler for enrichment logic.
 * Used by both AdminService and RequestService.
 *
 * Provides three levels of enrichment:
 * 1. enrichRequestTypes  – walks the full expanded graph (RequestType → steps → rules)
 * 2. enrichStepDefinitions – enriches step-level ownerDisplayName
 * 3. enrichApproverRules   – enriches rule-level principalDisplayName
 *
 * Levels 2 & 3 are designed to be registered as after('READ') on the child
 * entities so that CAP populates virtual fields even during $expand.
 */
export class SharedRequestTypeHandler {
    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    // ─── helpers ──────────────────────────────────────────────

    /** Batch-fetch user display names by UUID */
    private async fetchUserNames(ids: Set<string>): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        if (ids.size === 0) return map;
        try {
            const { ShadowUsers } = this.srv.entities;
            const users = await SELECT.from(ShadowUsers)
                .where({ ID: { in: [...ids] } })
                .columns('ID', 'displayName', 'email');
            for (const u of users ?? []) {
                map.set(u.ID, u.displayName || u.email || u.ID);
            }
        } catch (e) {
            LOG.warn('Failed to fetch user display names:', e);
        }
        return map;
    }

    /** Batch-fetch group/role display names by UUID */
    private async fetchGroupNames(ids: Set<string>): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        if (ids.size === 0) return map;
        try {
            const { ShadowGroups } = this.srv.entities;
            const groups = await SELECT.from(ShadowGroups)
                .where({ ID: { in: [...ids] } })
                .columns('ID', 'name');
            for (const g of groups ?? []) {
                map.set(g.ID, g.name || g.ID);
            }
        } catch (e) {
            LOG.warn('Failed to fetch group display names:', e);
        }
        return map;
    }

    /** Resolve a single ID using pre-fetched maps */
    private resolve(id: string | undefined, type: string | undefined, userMap: Map<string, string>, groupMap: Map<string, string>): string | undefined {
        if (!id) return undefined;
        if (type === 'USER') return userMap.get(id) ?? id;
        return groupMap.get(id) ?? id;
    }

    // ─── public enrichment methods ───────────────────────────

    /**
     * Enrich StepDefinitions with ownerDisplayName.
     * Register as: srv.after('READ', 'StepDefinitions', ...)
     */
    async enrichStepDefinitions(data: any) {
        const steps = Array.isArray(data) ? data : data ? [data] : [];
        if (steps.length === 0) return;

        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        for (const step of steps) {
            if (!step?.ownerId) continue;
            if (step.ownerType === 'USER') userIds.add(step.ownerId);
            else if (GROUP_TYPES.includes(step.ownerType)) groupIds.add(step.ownerId);
        }

        const userMap = await this.fetchUserNames(userIds);
        const groupMap = await this.fetchGroupNames(groupIds);

        for (const step of steps) {
            if (step?.ownerId) {
                step.ownerDisplayName = this.resolve(step.ownerId, step.ownerType, userMap, groupMap);
            }
            if (step?.approverId) {
                step.approverDisplayName = this.resolve(step.approverId, step.approverType, userMap, groupMap);
            }
        }

        LOG.debug(`Enriched ${steps.length} StepDefinition(s) with ownerDisplayName`);
    }

    /**
     * Enrich ApproverRules with principalDisplayName.
     * Register as: srv.after('READ', 'ApproverRules', ...)
     */
    async enrichApproverRules(data: any) {
        const rules = Array.isArray(data) ? data : data ? [data] : [];
        if (rules.length === 0) return;

        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        for (const rule of rules) {
            if (!rule?.principalId) continue;
            if (rule.principalType === 'USER') userIds.add(rule.principalId);
            else if (GROUP_TYPES.includes(rule.principalType)) groupIds.add(rule.principalId);
        }

        const userMap = await this.fetchUserNames(userIds);
        const groupMap = await this.fetchGroupNames(groupIds);

        for (const rule of rules) {
            if (rule?.principalId) {
                rule.principalDisplayName = this.resolve(rule.principalId, rule.principalType, userMap, groupMap);
            }
        }

        LOG.debug(`Enriched ${rules.length} ApproverRule(s) with principalDisplayName`);
    }

    /**
     * Enrich full RequestTypes graph (steps + approverRules).
     * Kept for backward compatibility; delegates to the child-level methods
     * after collecting IDs across the entire tree for a single batch query.
     */
    async enrichRequestTypes(data: any) {
        const items = Array.isArray(data) ? data : data ? [data] : [];
        if (items.length === 0) return;

        LOG.debug(`Enriching ${items.length} RequestType(s)`);

        // Collect ALL IDs across the tree for a single batch
        const userIds = new Set<string>();
        const groupIds = new Set<string>();

        for (const item of items) {
            const steps = Array.isArray(item?.steps) ? item.steps : [];
            for (const step of steps) {
                if (step?.ownerId) {
                    if (step.ownerType === 'USER') userIds.add(step.ownerId);
                    else if (GROUP_TYPES.includes(step.ownerType)) groupIds.add(step.ownerId);
                }
                if (step?.approverId) {
                    if (step.approverType === 'USER') userIds.add(step.approverId);
                    else if (GROUP_TYPES.includes(step.approverType)) groupIds.add(step.approverId);
                }
                const rules = Array.isArray(step?.approverRules) ? step.approverRules : [];
                for (const rule of rules) {
                    if (rule?.principalId) {
                        if (rule.principalType === 'USER') userIds.add(rule.principalId);
                        else if (GROUP_TYPES.includes(rule.principalType)) groupIds.add(rule.principalId);
                    }
                }
            }
        }

        const userMap = await this.fetchUserNames(userIds);
        const groupMap = await this.fetchGroupNames(groupIds);

        // Apply display names
        for (const item of items) {
            const steps = Array.isArray(item?.steps) ? item.steps : [];
            for (const step of steps) {
                if (step?.ownerId) {
                    step.ownerDisplayName = this.resolve(step.ownerId, step.ownerType, userMap, groupMap);
                }
                if (step?.approverId) {
                    step.approverDisplayName = this.resolve(step.approverId, step.approverType, userMap, groupMap);
                }
                const rules = Array.isArray(step?.approverRules) ? step.approverRules : [];
                for (const rule of rules) {
                    if (rule?.principalId) {
                        rule.principalDisplayName = this.resolve(rule.principalId, rule.principalType, userMap, groupMap);
                    }
                }
            }
        }

        LOG.debug('Enrichment complete');
    }
}

