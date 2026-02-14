/**
 * Utility functions for converting approval rule conditions to human-readable text.
 */

import type { UiCanvasItem, UiSection, UiFormField } from './types';

// Operator display labels
const OPERATOR_LABELS: Record<string, string> = {
    eq: '=',
    lt: '<',
    lte: '≤',
    gt: '>',
    gte: '≥',
    contains: 'contains',
    not_equals: '≠',
};

// Default field display labels (fallback)
const DEFAULT_FIELD_LABELS: Record<string, string> = {
    amount: 'Amount',
    totalValue: 'Total Value',
    region: 'Region',
    department: 'Department',
    priority: 'Priority',
    type: 'Request Type',
    costCenter: 'Cost Center',
};

// Type for field options in the condition dropdown
export interface FieldOption {
    value: string;
    label: string;
    dataType?: string;
    isSystemField?: boolean; // True for system fields like Request-priority
}

// System fields that are always available (not from form schema)
export const SYSTEM_FIELDS: FieldOption[] = [
    { value: '__request_priority', label: '📋 Request Priority', dataType: 'string', isSystemField: true },
];

/**
 * Extract fields from a step's schema for use in condition dropdowns.
 * This creates a flat list of all fields from all sections.
 */
export function extractFieldsFromSchema(schemaItems: UiCanvasItem[] = []): FieldOption[] {
    const fields: FieldOption[] = [];

    for (const item of schemaItems) {
        if (item.type === 'section') {
            const section = item as UiSection;
            for (const field of section.fields || []) {
                fields.push({
                    value: field.id || field.key || field.label?.toLowerCase().replace(/\s+/g, '_'),
                    label: field.label,
                    dataType: field.dataType || (field.type === 'number' ? 'number' : 'string'),
                });
            }
        } else if ((item as UiFormField).label) {
            // Direct field (not in a section)
            const field = item as UiFormField;
            fields.push({
                value: field.id || field.key || field.label?.toLowerCase().replace(/\s+/g, '_'),
                label: field.label,
                dataType: field.dataType || (field.type === 'number' ? 'number' : 'string'),
            });
        }
    }

    return fields;
}

/**
 * Merge system fields with schema fields (or defaults if no schema)
 * System fields are always shown first
 */
export function getAvailableFields(schemaItems: UiCanvasItem[] = []): FieldOption[] {
    const schemaFields = extractFieldsFromSchema(schemaItems);

    // Always start with system fields
    const systemFields = [...SYSTEM_FIELDS];

    // If schema has fields, use them after system fields
    if (schemaFields.length > 0) {
        return [...systemFields, ...schemaFields];
    }

    // Fallback to default fields after system fields
    const defaultFields = Object.entries(DEFAULT_FIELD_LABELS).map(([value, label]) => ({
        value,
        label,
        dataType: value === 'amount' || value === 'totalValue' ? 'number' : 'string',
    }));
    return [...systemFields, ...defaultFields];
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);

    // Format with appropriate suffix (M for millions, B for billions)
    if (num >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(1)}B`;
    } else if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(0)}M`;
    } else if (num >= 1_000) {
        return `${(num / 1_000).toFixed(0)}K`;
    }
    return num.toLocaleString();
}

/**
 * Get human-readable label for an operator
 */
export function getOperatorLabel(operator: string): string {
    return OPERATOR_LABELS[operator] || operator;
}

/**
 * Get human-readable label for a field
 * Checks system fields first, then default field labels
 */
export function getFieldLabel(field: string): string {
    // Check system fields first
    const systemField = SYSTEM_FIELDS.find(f => f.value === field);
    if (systemField) {
        return systemField.label.replace(/^📋\s*/, ''); // Remove emoji for display
    }
    return DEFAULT_FIELD_LABELS[field] || field;
}

/**
 * Convert a single condition to human-readable text
 * Example: { field: 'totalValue', operator: 'lte', value: '200000000' } -> "Total Value ≤ 200M"
 */
export function conditionToText(condition: { field: string; operator: string; value: string }): string {
    const fieldLabel = getFieldLabel(condition.field);
    const opLabel = getOperatorLabel(condition.operator);

    // Check if value looks like a number
    const numValue = parseFloat(condition.value);
    const valueDisplay = !isNaN(numValue) && condition.field !== 'region' && condition.field !== 'department'
        ? formatNumber(numValue)
        : condition.value;

    return `${fieldLabel} ${opLabel} ${valueDisplay}`;
}

/**
 * Convert an array of conditions to a combined text summary
 * Example: [cond1, cond2] -> "Total Value ≤ 200M AND Region = APAC"
 */
export function conditionsToText(conditions: Array<{ field: string; operator: string; value: string }>): string {
    if (!conditions || conditions.length === 0) {
        return 'Always (catch-all)';
    }
    return conditions.map(conditionToText).join(' AND ');
}

/**
 * Get approver display name from value.
 * 
 * NOTE: This function was previously used for legacy hardcoded roles.
 * Approver display names now come from ShadowUsers/ShadowGroups entities
 * via the Identity Service API. This function just returns the value as-is.
 */
export function getApproverLabel(approverValue: string): string {
    // Approver labels are now dynamic from the database (ShadowUsers, ShadowGroups)
    // The PrincipalSelect component fetches and displays the correct names
    return approverValue || 'Not assigned';
}
