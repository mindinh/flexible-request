/**
 * Frontend Types - Re-exports from CDS-generated models
 * 
 * This file re-exports types from @cds-models which are auto-generated
 * from schema.cds by cds-typer.
 * 
 * To regenerate: npm run build:types
 */

// Import CDS-generated types
import type { Request as CdsRequest, RequestType as CdsRequestType, Step as CdsStep } from '#cds-models/sap/cre';

// =============================================================================
// Type Aliases - Map CDS types to frontend-friendly names
// =============================================================================

// Entity Types (use these for type annotations)
export type Request = CdsRequest & {
    displayId?: string;
    refRequest_ID?: string;
    refRequest?: Request;
};
export type RequestType = CdsRequestType;
export type Step = CdsStep;

// =============================================================================
// Enum Constants - Manually maintained for runtime use
// CDS-typer generates these as static properties on classes, which are harder
// to use at runtime. These constants provide the same values in a usable format.
// =============================================================================

/**
 * Request Status - matches schema.cds Requests.status
 * @see db/schema.cds entity Requests.status
 */
export const RequestStatus = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    WITHDRAWN: 'WITHDRAWN'
} as const;

export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];

/**
 * Request Priority - matches schema.cds Requests.priority
 * @see db/schema.cds entity Requests.priority
 */
export const RequestPriority = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
} as const;

export type RequestPriority = typeof RequestPriority[keyof typeof RequestPriority];

/**
 * Step Status - matches schema.cds Steps.status
 * @see db/schema.cds entity Steps.status
 */
export const StepStatus = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    SKIPPED: 'SKIPPED'
} as const;

export type StepStatus = typeof StepStatus[keyof typeof StepStatus];

/**
 * Approval Status - matches schema.cds StepApprovals.status
 * @see db/schema.cds entity StepApprovals.status
 */
export const ApprovalStatus = {
    PENDING: 'PENDING',
    WAITING: 'WAITING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
} as const;

export type ApprovalStatus = typeof ApprovalStatus[keyof typeof ApprovalStatus];

/**
 * Sync Trigger - matches schema.cds StepDefinitions.syncTrigger
 * @see db/schema.cds entity StepDefinitions.syncTrigger
 */
export const SyncTrigger = {
    NONE: 'NONE',
    IMMEDIATE: 'IMMEDIATE',
    WITH_NEXT: 'WITH_NEXT',
    ON_COMPLETE: 'ON_COMPLETE'
} as const;

export type SyncTrigger = typeof SyncTrigger[keyof typeof SyncTrigger];

// =============================================================================
// Frontend-Specific Types (not in backend)
// =============================================================================

export interface Attachment {
    ID: string;
    createdAt?: string;
    createdBy?: string;
    fileName: string;
    mimeType: string;
    size: number;
    contentId: string;
    url?: string;
}

// Re-export request-specific types
export * from './requests';

