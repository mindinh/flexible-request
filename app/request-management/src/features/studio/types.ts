
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
    objectType?: string;
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
    bindTo?: string; // Optional global Data Schema field key (e.g., 'costCenter')
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
    bindTo?: string; // Data Schema field key (Object with isList=true) for array binding
    columns: UiFormField[];
    // Header Actions
    headerActions?: {
        downloadTemplate?: boolean;
        uploadExcel?: boolean;
    };
}

export type UiCanvasItem = UiFormField | UiSection | UiTableField;

// --- Form Footer Actions (Decision Branching) ---
export interface UiFormAction {
    id: string;
    label: string;
    variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'success' | 'warning' | 'default' | 'danger';
    icon?: string;
}

export interface UiForm {
    id: string;
    name: string;
    items: UiCanvasItem[];
    actions?: UiFormAction[];  // Footer action buttons for decision branching
}

// --- Node Input / Output Mappings ---
export interface UiNodeInput {
    sourcePath: string;   // Data Schema field path (e.g. "address.city")
    alias?: string;       // Optional rename for this step's context
    type?: string;        // Mirrored data type for display
}

export interface UiNodeOutput {
    sourcePath: string;
    alias?: string;
    type?: string;
    derivedFrom?: 'formLayout' | 'manual';  // How the output was created
    bindTo?: string; // If set, this output maps to a global Data Schema field
}

// --- Notifications Contract ---
export interface EmailConfig {
    recipientMode: 'requester' | 'step_owner' | 'coordinator' | 'approvers' | 'custom';
    customRecipients?: string;   // Comma-separated emails (only when recipientMode = 'custom')
    subjectTemplate?: string;    // e.g. "Request {{displayId}} – Action Required"
    bodyTemplate?: string;       // HTML or plain text with {{placeholder}} vars
}

/**
 * Canonical shape stored in StepDefinitions.notificationsContent (JSON).
 *
 * Legacy format was a plain string[] (e.g. ["email","bell"]).
 * The runtime parser MUST handle both shapes.
 */
export interface NotificationsContent {
    channels: string[];          // e.g. ['bell', 'email']
    emailConfig?: EmailConfig;
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
    taskType?: 'dataEntry' | 'approval'; // For User Tasks: determines action palette in Status Flow
    triggerType?: string;       // 'FORM_SUB' | 'API_TRIGGER' (for start nodes)
    inputs?: UiNodeInput[];     // Data Schema fields consumed by this step
    outputs?: UiNodeOutput[];   // Data Schema fields produced by this step
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

/** Status configuration stored on a workflow edge (transition) */
export interface EdgeStatusConfig {
    statusName: string;
    statusColor: string;       // Hex color (e.g. '#22c55e')
    description?: string;
}

export interface UiWorkflowEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    sourceHandle?: string;  // Maps to UiFormAction.id for conditional branching
    label?: string;         // Edge label (e.g. 'Approve')
    data?: {
        offsets?: number[];
        action?: string;
        statusConfig?: EdgeStatusConfig;
        [key: string]: unknown;
    };
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

// --- Status Flow (Business Visualization) ---

/** An individual status chip inside a Phase Block */
export interface IndividualStatus {
    id: string;
    label: string;
    description?: string;
    color: string;       // Text color
    bgColor: string;     // Background
    borderColor: string; // Border
}

/** A Phase Block – a card containing grouped individual statuses */
export interface StatusFlowPhase {
    id: string;
    phaseNumber: number;       // e.g. 1, 2, 3 … (displayed as numbered circle)
    label: string;             // e.g. "Draft: Create PO Request", "In Processing: Procurement"
    laneIndex: number;         // Column index (0 = first lane)
    statuses: IndividualStatus[];
    sourceStepIds: string[];   // Workflow step IDs that contributed to this phase
}

/** A lane / column header – derived from the workflow */
export interface StatusFlowLane {
    id: string;
    label: string;            // e.g. "Creator", "Step Owner", "Approver L1"
    subtitle?: string;        // e.g. "Requester", "Procurement Processing"
    roleType: 'requestor' | 'stepOwner' | 'approver';
    sourceNodeId?: string;
}

/** A transition between two phase blocks */
export interface StatusFlowTransition {
    id: string;
    from: string;             // → StatusFlowPhase.id
    to: string;               // → StatusFlowPhase.id
    action: string;           // Label on the connector (e.g. "Submit", "Approved")
    isReverse?: boolean;      // True when this is a backward/sent-back transition
}

/** Root model for the Status Flow visualization */
export interface StatusFlowModel {
    title?: string;
    lanes: StatusFlowLane[];
    phases: StatusFlowPhase[];
    transitions: StatusFlowTransition[];
    /** STATUS LIBRARY – fixed categories for the legend panel */
    statusLibrary?: {
        overallRequestStatus: IndividualStatus[];
        stepStatus: IndividualStatus[];
        stepOwnerStatus: IndividualStatus[];
        approvalStatus: IndividualStatus[];
    };
    /** Actions derived from workflow form actions + edge labels */
    workflowActions?: string[];
}
