import cds from '@sap/cds';

/**
 * ConditionEvaluator
 * 
 * Shared utility for evaluating JSON conditions against data payloads.
 * Used by both WorkflowEngine (step activation) and ApproverResolver (approver routing).
 * 
 * Condition format: { "field": "totalValue", "operator": "gt", "value": 200000000 }
 */
export class ConditionEvaluator {

    /**
     * Evaluate a condition expression against data.
     * 
     * @param conditionExpr - JSON string with condition definition (or null for "always true")
     * @param data - The data object to evaluate against
     * @returns true if condition matches, false otherwise
     */
    public evaluate(
        conditionExpr: string | null | undefined,
        data: Record<string, any>
    ): boolean {
        // Null or empty condition always matches (catch-all / unconditional)
        if (!conditionExpr || conditionExpr.trim() === '') {
            return true;
        }

        try {
            const condition = JSON.parse(conditionExpr);

            // Studio UI format from ConditionEditorDialog: { matchType: 'AND'|'OR', rules: [...] }
            if (condition.matchType && Array.isArray(condition.rules)) {
                return this.evaluateGroup({
                    logic: condition.matchType.toLowerCase(),
                    conditions: condition.rules.map((r: any) => ({
                        field: r.fieldId,
                        operator: r.operator,
                        value: r.value
                    }))
                }, data);
            }

            // New group-based format from Condition Node: { logic: 'and'|'or', conditions: [...], negate? }
            if (condition.logic && Array.isArray(condition.conditions)) {
                return this.evaluateGroup(condition, data);
            }

            // Legacy: Studio-style format: { conditions: [...] } (implicit AND)
            if (condition.conditions && Array.isArray(condition.conditions)) {
                return condition.conditions.every((c: any) => {
                    // Support nested groups inside legacy format
                    if (c.logic || c.isGroup || c.conditions) return this.evaluateGroup(c, data);
                    return this.evaluateSingleCondition(c, data);
                });
            }

            // Support for array of conditions (AND logic)
            if (Array.isArray(condition)) {
                return condition.every(c => this.evaluateSingleCondition(c, data));
            }

            return this.evaluateSingleCondition(condition, data);
        } catch (e) {
            console.error(`[ConditionEvaluator] Failed to parse condition: ${conditionExpr}`, e);
            return false;
        }
    }

    /**
     * Evaluate a group condition with AND/OR logic and optional NOT negation.
     * Supports nested groups recursively.
     */
    private evaluateGroup(
        group: { logic?: string; conditions?: any[]; negate?: boolean; isGroup?: boolean; field?: string },
        data: Record<string, any>
    ): boolean {
        // If it's a leaf condition (not a group), evaluate directly
        if (group.field) {
            return this.evaluateSingleCondition(group as any, data);
        }

        const logic = group.logic || 'and';
        const conditions = group.conditions || [];

        if (conditions.length === 0) return true;

        let result: boolean;
        if (logic === 'or') {
            result = conditions.some((c: any) => {
                if (c.logic || c.isGroup || c.conditions) return this.evaluateGroup(c, data);
                return this.evaluateSingleCondition(c, data);
            });
        } else {
            // Default: AND
            result = conditions.every((c: any) => {
                if (c.logic || c.isGroup || c.conditions) return this.evaluateGroup(c, data);
                return this.evaluateSingleCondition(c, data);
            });
        }

        return group.negate ? !result : result;
    }

    /**
     * Evaluate a single condition object.
     * 
     * Supported operators (both shorthand and Studio-style):
     * - eq / equals: equals
     * - ne / not_equals: not equals
     * - gt / greater_than: greater than
     * - lt / less_than: less than
     * - gte / greater_equal: greater than or equal
     * - lte / less_equal: less than or equal
     * - contains: string contains
     * - in: value in array
     * - exists: field exists and is not null
     */
    private evaluateSingleCondition(
        condition: { field: string; operator: string; value: any },
        data: Record<string, any>
    ): boolean {
        const { field, operator, value } = condition;
        const fieldValue = this.getNestedValue(data, field);

        // Normalize operator to handle both shorthand (eq) and full name (equals)
        switch (operator.toLowerCase()) {
            case 'eq':
            case 'equals':
                return fieldValue === value;
            case 'ne':
            case 'not_equals':
                return fieldValue !== value;
            case 'gt':
            case 'greater_than':
                return fieldValue > value;
            case 'lt':
            case 'less_than':
                return fieldValue < value;
            case 'gte':
            case 'greater_equal':
                return fieldValue >= value;
            case 'lte':
            case 'less_equal':
                return fieldValue <= value;
            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.includes(value);
            case 'in':
                return Array.isArray(value) && value.includes(fieldValue);
            case 'exists':
                return fieldValue !== undefined && fieldValue !== null;
            default:
                console.warn(`[ConditionEvaluator] Unknown operator: ${operator}`);
                return false;
        }
    }

    /**
     * Get a nested value from an object using dot notation.
     * e.g., getNestedValue({ plant: { country: "DE" } }, "plant.country") => "DE"
     */
    private getNestedValue(obj: Record<string, any>, path: string): any {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }

        return current;
    }
}

// Singleton instance for convenience
export const conditionEvaluator = new ConditionEvaluator();
