import type { UiRule, UiCondition } from './types';
import type { FieldOption } from './conditionUtils';

export function useRuleConditions(
    rule: UiRule,
    onUpdateRule: (updatedRule: UiRule) => void,
    availableFields: FieldOption[]
) {
    const addCondition = () => {
        const newCondition: UiCondition = {
            id: `c-${crypto.randomUUID()}`,
            field: availableFields.length > 0 ? availableFields[0].value : 'totalValue',
            operator: 'gt',
            value: '',
        };
        onUpdateRule({ ...rule, conditions: [...rule.conditions, newCondition] });
    };

    const updateCondition = (idx: number, field: keyof UiCondition, value: string) => {
        const newConditions = [...rule.conditions];
        newConditions[idx] = { ...newConditions[idx], [field]: value };
        onUpdateRule({ ...rule, conditions: newConditions });
    };

    const removeCondition = (idx: number) => {
        const newConditions = rule.conditions.filter((_, i) => i !== idx);
        onUpdateRule({ ...rule, conditions: newConditions });
    };

    return { addCondition, updateCondition, removeCondition };
}
