/**
 * Request Feature Types
 * 
 * Shared type definitions for request-related components.
 * These types extend or enhance the CDS-generated types with frontend-specific structures.
 */

import type { RequestStatus, RequestPriority, ApprovalStatus, StepStatus } from './index';

// =============================================================================
// Step Approval Types
// =============================================================================

/**
 * Step approval record
 */
export interface StepApproval {
    ID: string;
    status: ApprovalStatus | string;
    approver?: string;
    approverType?: ApproverType;
    ruleName?: string;
    comment?: string;
    decisionAt?: string;
    step_ID?: string;
}

/**
 * Approver type enum
 */
export type ApproverType = 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION' | 'DEPARTMENT';

// =============================================================================
// Step Types
// =============================================================================

/**
 * Step definition from request type (schema configuration)
 */
export interface StepDefinition {
    ID: string;
    stepName: string;
    isStartStep?: boolean;
    schemaContent?: string;
    formId?: string;
    sequenceNum?: number;
    slaDays?: number;
    approverRules?: ApproverRule[];
    // Step Owner assignment (from Studio configuration)
    ownerType?: string;       // Principal type (USER/GROUP/TEAM/etc.)
    ownerId?: string;         // ShadowUser or ShadowGroup ID
    ownerDisplayName?: string; // Resolved display name for UI
}

/**
 * Approver rule definition
 */
export interface ApproverRule {
    ID: string;
    ruleName?: string;
    approverType?: ApproverType;
    approverValue?: string;
    approverDisplayName?: string; // New field
    condition?: string;
    stepDefinition_ID?: string;
}

/**
 * Request data (step data payload)
 */
export interface RequestData {
    ID: string;
    payload?: string;
    step_ID?: string;
}

/**
 * Runtime step instance
 */
export interface RuntimeStep {
    ID: string;
    status: StepStatus | string;
    stepDefinition_ID?: string;
    stepDefinition?: StepDefinition;
    data?: RequestData;
    approvals?: StepApproval[];
    request_ID?: string;
}

// =============================================================================
// Request Type Types
// =============================================================================

/**
 * Request type configuration
 */
export interface RequestTypeConfig {
    ID: string;
    title: string;
    description?: string;
    icon?: string;
    steps?: StepDefinition[];
    formSchemasContent?: string;
    IsActiveEntity?: boolean;
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * Full request with all expanded relationships
 */
export interface RequestWithDetails {
    ID: string;
    displayId: string;
    title: string;
    status: RequestStatus | string;
    priority: RequestPriority | string;
    description?: string;
    createdAt: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    requestType?: RequestTypeConfig;
    requestType_ID?: string;
    steps?: RuntimeStep[];
}

/**
 * Request list item (minimal fields for list display)
 */
export interface RequestListItem {
    ID: string;
    displayId?: string;
    title: string;
    status: RequestStatus | string;
    priority: RequestPriority | string;
    createdAt: string;
    createdBy?: string;
    requestType?: {
        ID: string;
        title: string;
        icon?: string;
    };
    requestType_ID?: string;
}

// =============================================================================
// Audit Log Types
// =============================================================================

/**
 * Audit log / history item
 */
export interface AuditLogItem {
    ID: string;
    source: 'REQUEST' | 'STEP';
    action: string;
    actor: string;
    timestamp: string;
    comment?: string;
    stepName?: string;
    fromValue?: string;
    toValue?: string;
}

// =============================================================================
// Form Field Types
// =============================================================================

/**
 * Generic form field value type
 */
export type FieldValue = string | number | boolean | null | undefined | Record<string, any> | Record<string, any>[];

/**
 * Form data record type (maps field IDs to values)
 */
export type FormData = Record<string, FieldValue>;

/**
 * Field change handler type
 */
export type FieldChangeHandler = (fieldId: string, value: FieldValue) => void;

// =============================================================================
// Resolved Approver Types
// =============================================================================

/**
 * Resolved approver from condition evaluation
 */
export interface ResolvedApprover {
    stepId: string;
    ruleName: string;
    approverType: ApproverType;
    approverValue: string;
    approverDisplayName?: string; // New field
    ruleId: string;
}

/**
 * Map of step IDs to resolved approvers
 */
export type ResolvedApproversMap = Record<string, ResolvedApprover[]>;

// =============================================================================
// API Response Types
// =============================================================================

/**
 * OData collection response wrapper
 */
export interface ODataCollectionResponse<T> {
    value: T[];
    '@odata.count'?: number;
}

/**
 * OData single entity response
 */
export type ODataEntityResponse<T> = T;
