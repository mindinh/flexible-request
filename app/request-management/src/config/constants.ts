/**
 * Condition Operators for Approval Rules
 * Used in RuleDetailsContent.tsx for building conditional expressions
 */
export const OPERATORS = [
    { value: 'eq', label: 'equals (=)' },
    { value: 'lt', label: 'less than (<)' },
    { value: 'lte', label: 'less than or equal (≤)' },
    { value: 'gt', label: 'greater than (>)' },
    { value: 'gte', label: 'greater than or equal (≥)' },
    { value: 'contains', label: 'contains' },
    { value: 'not_equals', label: 'not equals (≠)' },
];

// NOTE: APPROVER_TYPES and APPROVER_VALUES have been removed.
// These are now dynamically loaded from the database:
// - Principal types: GET /admin/SupportTypes
// - Users: GET /admin/ShadowUsers
// - Groups: GET /admin/ShadowGroups
// See: docs/concepts/authorization-and-roles/solution-design.md

