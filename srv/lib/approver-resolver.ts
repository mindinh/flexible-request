import { cds, SELECT } from './db';
import { ApproverRule } from '../../@cds-models/RequestService';

/**
 * ResolvedApprover Interface
 * Standardized output from the resolver
 */
export interface ResolvedApprover {
    approverId: string;         // ID for RLS checks (UUID or group ID)
    approverDisplayName: string; // Display name for UI
    approverType: string;       // Type from SupportTypes
    ruleName: string;           // Description of the rule
    principalId?: string;       // Original Principal ID if available
}

/**
 * ApproverResolver
 * 
 * Responsible for evaluating ApproverRules against RequestData
 * to determine who should approve a step.
 * 
 * Supports both:
 * - NEW: Principal model (principalType, principalId, principalValue)
 * - LEGACY: Old fields (approverType, approverValue)
 */
export class ApproverResolver {
    private db: cds.Service;
    private log = cds.log('approver-resolver');

    constructor(db: cds.Service) {
        this.db = db;
    }

    /**
     * Resolve approvers for a given Step Definition and Request Data context.
     * 
     * @param stepDefinitionId - The ID of the step definition to find rules for
     * @param requestTypeId - The request type ID (for filtering rules)
     * @param requestData - Flattened key-value pairs of request data for condition evaluation
     * @returns Array of ResolvedApprover objects
     */
    public async resolveApprovers(
        stepDefinitionId: string,
        requestTypeId: string,
        requestData: Record<string, unknown>
    ): Promise<ResolvedApprover[]> {

        const { ApproverRules } = this.db.entities;

        this.log.info(`Resolving approvers for stepDefId=${stepDefinitionId}, requestTypeId=${requestTypeId}`);

        // 1. Fetch Rules for this Step Definition
        const rules = await SELECT.from(ApproverRules)
            .where({ stepDefinition_ID: stepDefinitionId }) as ApproverRule[];

        this.log.info(`Found ${rules.length} rules for stepDef ${stepDefinitionId}`);

        const resolved: ResolvedApprover[] = [];

        for (const rule of rules) {
            let matches = false;

            // 2. Evaluate Condition
            if (!rule.conditionExpr) {
                matches = true; // No condition = Always applies
            } else {
                matches = this.evaluateCondition(rule.conditionExpr, requestData);
            }

            if (matches) {
                const approverType = rule.principalType as string;
                const approverId = rule.principalId as string;

                if (!approverId) {
                    this.log.warn(`Rule matched but has no principalId (ID: ${rule.ID})`);
                    continue;
                }

                // Look up display name from ShadowUsers or ShadowGroups
                const approverDisplayName = await this.lookupDisplayName(approverId, approverType);

                const ruleName = rule.description || `Rule ${rule.ID}`;
                this.log.info(`Rule "${ruleName}" matched. Type: ${approverType}, ID: ${approverId}, Name: ${approverDisplayName}`);

                resolved.push({
                    approverId: approverId,
                    approverDisplayName: approverDisplayName,
                    approverType: approverType || 'USER',
                    ruleName: ruleName,
                    principalId: approverId
                });

                if (rule.isFinal) {
                    this.log.info(`Rule "${ruleName}" is final. Stopping resolution.`);
                    break;
                }
            }
        }

        return resolved;
    }

    /**
     * Look up display name from ShadowUsers or ShadowGroups
     */
    public async lookupDisplayName(principalId: string, principalType: string): Promise<string> {
        const { ShadowUsers, ShadowGroups } = this.db.entities;

        try {
            if (principalType === 'USER') {
                const user = await SELECT.one.from(ShadowUsers).where({ ID: principalId }).columns('displayName', 'email');
                return user?.displayName || user?.email || principalId;
            } else {
                // GROUP, TEAM, DEPARTMENT, ROLE, POSITION - all stored in ShadowGroups
                const group = await SELECT.one.from(ShadowGroups).where({ ID: principalId }).columns('name');
                return group?.name || principalId;
            }
        } catch (error) {
            this.log.warn(`Could not lookup display name for ${principalType}:${principalId}`);
            return principalId;
        }
    }

    /**
     * Resolve all user IDs that belong to a group.
     * Used when an approver is assigned to a GROUP/TEAM/DEPARTMENT.
     * 
     * @param groupId - The ShadowGroups ID
     * @returns Array of ShadowUser IDs who are members of the group
     */
    public async resolveGroupMembers(groupId: string): Promise<string[]> {
        const { GroupMembers } = this.db.entities;

        this.log.info(`Resolving members for group: ${groupId}`);

        const members = await SELECT.from(GroupMembers)
            .where({ group_ID: groupId })
            .columns('user_ID');

        const userIds = members
            .map((m: { user_ID?: string }) => m.user_ID)
            .filter((id: string | undefined): id is string => !!id);

        this.log.info(`Found ${userIds.length} members in group ${groupId}`);

        return userIds;
    }

    /**
     * Check if a user is a valid approver for a resolved approver entry.
     * Handles both direct USER assignments and GROUP memberships.
     * 
     * @param userId - The user's ShadowUser ID to check
     * @param resolved - The resolved approver from resolveApprovers()
     * @returns true if the user can approve for this resolved approver
     */
    public async canUserApprove(userId: string, resolved: ResolvedApprover): Promise<boolean> {
        // Direct USER assignment
        if (resolved.approverType === 'USER') {
            return resolved.principalId === userId;
        }

        // GROUP-based assignment (GROUP, TEAM, DEPARTMENT, ROLE)
        if (resolved.principalId) {
            const members = await this.resolveGroupMembers(resolved.principalId);
            return members.includes(userId);
        }

        // Legacy approverValue matching (fallback)
        const { ShadowUsers } = this.db.entities;
        const user = await SELECT.one.from(ShadowUsers, userId).columns('userId');
        return user?.userId === resolved.approverId;
    }

    /**
     * Condition evaluator supporting both:
     * 1. JSON format from Studio: {"conditions":[{"field":"x","operator":"eq","value":"y"}]}
     * 2. Legacy string format: "field = value"
     */
    private evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
        try {
            // Check if it's JSON format
            if (condition.trim().startsWith('{')) {
                return this.evaluateJsonCondition(condition, data);
            }
            // Otherwise fall back to simple string parsing
            return this.evaluateSimpleCondition(condition, data);
        } catch (e) {
            this.log.error('Error evaluating condition', e);
            return false;
        }
    }

    /**
     * Evaluate JSON condition format from Studio
     * Format: {"conditions":[{"id":"...","field":"fieldName","operator":"eq|ne|gt|lt|gte|lte","value":"..."}]}
     */
    private evaluateJsonCondition(conditionJson: string, data: Record<string, unknown>): boolean {
        try {
            const parsed = JSON.parse(conditionJson);

            // Handle empty condition object
            if (!parsed.conditions || parsed.conditions.length === 0) {
                this.log.debug('Empty conditions array - rule always applies');
                return true;
            }

            // All conditions must match (AND logic)
            for (const cond of parsed.conditions) {
                const { field, operator, value } = cond;
                const actualValue = data[field];

                this.log.debug(`Evaluating JSON condition: ${field} ${operator} ${value}, actual=${actualValue}`);

                // Handle undefined/null
                if (actualValue === undefined || actualValue === null) {
                    this.log.debug(`Field ${field} not found in data - condition fails`);
                    return false;
                }

                const match = this.compareValues(actualValue, operator, value);
                if (!match) {
                    this.log.debug(`Condition ${field} ${operator} ${value} did not match`);
                    return false;
                }
            }

            return true;
        } catch (e) {
            this.log.error(`Failed to parse JSON condition: ${conditionJson}`, e);
            return false;
        }
    }

    /**
     * Compare values using the given operator
     */
    private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
        // Normalize for comparison
        const actualStr = String(actual).toLowerCase();
        const expectedStr = String(expected).toLowerCase();

        switch (operator) {
            case 'eq':
            case '=':
            case '==':
                return actualStr === expectedStr;
            case 'ne':
            case 'not_equals':
            case '!=':
                return actualStr !== expectedStr;
            case 'gt':
            case '>':
                return Number(actual) > Number(expected);
            case 'lt':
            case '<':
                return Number(actual) < Number(expected);
            case 'gte':
            case '>=':
                return Number(actual) >= Number(expected);
            case 'lte':
            case '<=':
                return Number(actual) <= Number(expected);
            case 'contains':
                return actualStr.includes(expectedStr);
            case 'starts_with':
                return actualStr.startsWith(expectedStr);
            case 'ends_with':
                return actualStr.endsWith(expectedStr);
            default:
                this.log.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }

    /**
     * Legacy simple condition evaluator
     * Supports: "field = value", "field > value", etc.
     */
    private evaluateSimpleCondition(condition: string, data: Record<string, unknown>): boolean {
        const parts = condition.split(' ');
        if (parts.length < 3) {
            this.log.warn(`Invalid condition format: "${condition}". Expected "Field Op Value"`);
            return false;
        }

        const field = parts[0];
        const op = parts[1];
        const value = parts.slice(2).join(' ').replace(/^'|'$/g, "").replace(/^"|"$/g, "");

        const actualValue = data[field];

        if (actualValue === undefined || actualValue === null) {
            return false;
        }

        return this.compareValues(actualValue, op, value);
    }
}
