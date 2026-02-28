import type { UiRule, UiCondition } from '@/features/studio/types';
import type { ApproverType } from '@/types';

/**
 * Resolved approver information with rule metadata
 */
export interface ResolvedApprover {
    ruleName: string;
    approverType: ApproverType;
    approverValue: string;
    approverDisplayName?: string;
    isFinal: boolean;
    stepId: string;
    ruleId: string;
}

/**
 * Evaluates approval rules against form data to determine which approvers should be assigned.
 * 
 * @param rules - All approval rules from the studio
 * @param stepId - The workflow step to evaluate rules for
 * @param formData - Current form field values (e.g., { priority: 'HIGH', region: 'NORTH' })
 * @returns Array of resolved approvers in priority order (stops at first isFinal rule)
 */
export function resolveApproversForStep(
    rules: UiRule[],
    stepId: string,
    formData: Record<string, any>
): ResolvedApprover[] {
    // Filter rules for this step and sort by priority (lowest first)
    const stepRules = rules
        .filter(r => r.stepId === stepId)
        .sort((a, b) => a.priority - b.priority);

    const matchedApprovers: ResolvedApprover[] = [];

    for (const rule of stepRules) {
        // Rules with no conditions always match (catch-all)
        if (rule.conditions.length === 0) {
            matchedApprovers.push({
                ruleName: rule.name || 'Default Rule',
                approverType: (rule.assignType?.toUpperCase() || 'ROLE') as ApproverType,
                approverValue: rule.assignTo,
                approverDisplayName: rule.assignToName, // Pass display name
                isFinal: rule.isFinal ?? false,
                stepId,            // Fix TS Error
                ruleId: rule.id    // Fix TS Error
            });
            if (rule.isFinal) break;
            continue;
        }

        // Evaluate all conditions for this rule
        const allConditionsMatch = rule.conditions.every(condition =>
            evaluateCondition(condition, formData)
        );

        if (allConditionsMatch) {
            matchedApprovers.push({
                ruleName: rule.name || `Rule ${rule.priority}`,
                approverType: (rule.assignType?.toUpperCase() || 'ROLE') as ApproverType,
                approverValue: rule.assignTo,
                approverDisplayName: rule.assignToName, // Pass display name
                isFinal: rule.isFinal ?? false,
                stepId,            // Fix TS Error
                ruleId: rule.id    // Fix TS Error
            });
            if (rule.isFinal) break;
        }
    }

    return matchedApprovers;
}

/**
 * Evaluates a single condition against form data
 */
function evaluateCondition(
    condition: UiCondition,
    formData: Record<string, any>
): boolean {
    const fieldValue = formData[condition.field];
    const ruleValue = condition.value;

    // Handle missing/undefined values
    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        return false;
    }

    switch (condition.operator) {
        case 'eq':
            return String(fieldValue) === String(ruleValue);

        case 'not_equals':
            return String(fieldValue) !== String(ruleValue);

        case 'contains':
            return String(fieldValue).includes(String(ruleValue));

        case 'gt':
            return parseNumeric(fieldValue) > parseNumeric(ruleValue);

        case 'gte':
            return parseNumeric(fieldValue) >= parseNumeric(ruleValue);

        case 'lt':
            return parseNumeric(fieldValue) < parseNumeric(ruleValue);

        case 'lte':
            return parseNumeric(fieldValue) <= parseNumeric(ruleValue);

        default:
            console.warn(`Unknown operator: ${condition.operator}`);
            return false;
    }
}

/**
 * Parse value as numeric, handling both strings and numbers
 */
function parseNumeric(value: any): number {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? 0 : num;
}
