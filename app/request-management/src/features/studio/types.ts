
// UI Types for the Studio State
// These match the internal state of the interactive tabs

// --- Approval Rules ---
export interface UiCondition {
    id: string;
    field: string;
    operator: string;
    value: string;
}

export interface UiRule {
    id: string;
    stepId?: string;
    name: string;
    priority: number;
    conditions: UiCondition[];
    assignTo: string;           // Principal ID (UUID)
    assignToName?: string;      // Principal display name (for UI)
    assignType: 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION' | 'DEPARTMENT';
    isActive: boolean;
    expanded: boolean;
    isFinal?: boolean;  // Stop approval chain when this approver approves
}

// --- Schema Builder ---

// Value Help Configuration (aligned with dynamic_studio_concept.md Section 3.2)
export interface ValueHelpItem {
    key: string;
    label: string;
    i18nKey?: string;
}

export interface ValueHelpConfig {
    type: 'Static' | 'Reference' | 'Dynamic';
    // For Static
    items?: ValueHelpItem[];
    // For Reference (Managed List)
    listCode?: string;
    // For Dynamic (API / OData Entity)
    source?: {
        apiConfigId: string;   // Reference to an API Connection from the Integrations store
        path: string;          // Endpoint path (e.g. /admin/ShadowGroups)
        valueField: string;    // JSON key for saved value (e.g. ID)
        displayField: string;  // JSON key for displayed label (e.g. name)
        filter?: string;       // OData $filter expression
        expand?: string;       // OData $expand expression
        top?: number;          // OData $top
        skip?: number;         // OData $skip
    };
}

export interface FieldConstraints {
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
    precision?: number; // For decimal numbers (total digits)
    scale?: number;     // For decimal numbers (digits after decimal point)
    regex?: string;
    regexMessage?: string;
}

export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';

export interface UiFormField {
    id: string;
    type: string;     // controlType: 'text', 'select', 'radio', 'checkbox', 'number', 'date', etc.
    dataType?: DataType; // The underlying data type (defaults based on controlType)
    label: string;
    key?: string; // Field key for data binding
    required?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    helpText?: string;
    validationType?: 'none' | 'email' | 'phone' | 'url' | 'number' | 'custom';
    defaultValue?: string;
    parentId?: string;
    // Value Help (for select, radio, checkbox)
    valueHelp?: ValueHelpConfig;
    // Constraints
    constraints?: FieldConstraints;
    // Layout
    colSpan?: 3 | 6 | 9 | 12; // 3 = 25%, 6 = 50% (default), 9 = 75%, 12 = 100%
    // Legacy (deprecated, use valueHelp.items instead)
    options?: { value: string; label: string }[];
}

export interface UiSection {
    id: string;
    type: 'section';
    label: string;
    collapsed?: boolean;
    columns?: 2 | 3; // Number of grid columns (default: 2)
    fields: UiFormField[];
}

export interface UiTableField {
    id: string;
    type: 'table';
    label: string;
    columns: UiFormField[];
    // Header Actions
    headerActions?: {
        downloadTemplate?: boolean;
        uploadExcel?: boolean;
    };
}

export type UiCanvasItem = UiFormField | UiSection | UiTableField;

// --- Forms ---
export interface UiFormAction {
    id: string;
    label: string;
    variant?: 'default' | 'primary' | 'outline' | 'ghost' | 'danger' | 'success' | 'secondary' | 'warning';
    icon?: string;
}

export interface UiForm {
    id: string;
    name: string;
    items: UiCanvasItem[];
    footerActions?: UiFormAction[];
}

// --- Workflow ---
// We reuse basic node/edge structures but might need specific data
export type SyncTrigger = 'NONE' | 'IMMEDIATE' | 'WITH_NEXT' | 'ON_COMPLETE';

export interface UiWorkflowNodeData {
    label: string;
    isStart?: boolean;
    sla?: number;
    syncTrigger?: SyncTrigger; // When to sync data to external system
    formId?: string;            // Reference to a UiForm for this step
    actionSubType?: string;     // 'form' | 'email' | 'approval' (for action nodes)
    triggerType?: string;       // 'FORM_SUB' | 'API_TRIGGER' (for start nodes)
    inputMapping?: string;      // JSON string of input mappings
    owner_ID?: string;          // Default Step Owner ID
    ownerType?: string;         // USER/GROUP/etc.
    ownerName?: string;         // Display name
    approver_ID?: string;       // Fixed Approver ID
    approverType?: string;      // USER/GROUP/etc.
    approverName?: string;      // Display name

    // API Call Configuration
    apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    apiUrl?: string;
    apiHeaders?: Array<{ key: string; value: string }>;
    apiBody?: string;
    apiAuthType?: 'none' | 'bearer' | 'basic';
    apiAuthToken?: string;
    apiAuthUser?: string;
    apiAuthPass?: string;
    apiResponseMapping?: Array<{ path: string; targetKey: string }>;

    [key: string]: unknown;
}

export interface UiWorkflowNode {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: UiWorkflowNodeData;
    [key: string]: unknown;
}

export interface UiWorkflowEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    [key: string]: unknown;
}

// --- Status Network ---
export interface UiStatusNodeData {
    label: string;
    isInitial?: boolean;
    isFinal?: boolean;
}

export interface UiStatusNode {
    id: string;
    type?: 'statusNode';
    position: { x: number; y: number };
    data: UiStatusNodeData;
    [key: string]: unknown;
}

export interface UiStatusEdge {
    id: string;
    source: string;
    target: string;
    label?: string; // Action name
    data?: { action?: string; description?: string };
    type?: string;
    [key: string]: unknown;
}

// --- Request Type Metadata ---
export interface UiRequestTypeDetails {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
    icon: string;
}

// --- Data Schema ---
export type SimpleDataType = 'String' | 'Number' | 'Boolean' | 'DateTime' | 'Object';

export interface UiDataField {
    id: string;
    key: string;
    label: string;
    type: SimpleDataType;
    required?: boolean;
    isList?: boolean;
    sampleValue?: string;
    children?: UiDataField[];
}
