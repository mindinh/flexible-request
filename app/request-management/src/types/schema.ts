/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * 
 * This file is synced from srv/types.ts
 * To update, modify srv/types.ts and run: npm run sync:types
 * 
 * Source: srv/types.ts
 * Generated: 2026-01-09T22:38:25.812Z
 */

/**
 * Shared Types - Single Source of Truth
 * 
 * This file contains types that are shared between backend (srv) and frontend (app).
 * These types MUST match the definitions in db/schema.cds.
 * 
 * When schema.cds changes:
 * 1. Update this file to match
 * 2. Run: npm run sync:types
 * 
 * See .agent/guidelines/type-sharing-guideline.md for details.
 */

// =============================================================================
// Request Status - matches db/schema.cds entity Requests.status
// =============================================================================
export const RequestStatus = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    WITHDRAWN: 'WITHDRAWN'
} as const;

export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];

// =============================================================================
// Request Priority - matches db/schema.cds entity Requests.priority
// =============================================================================
export const RequestPriority = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
} as const;

export type RequestPriority = typeof RequestPriority[keyof typeof RequestPriority];

// =============================================================================
// Step Status - matches db/schema.cds entity Steps.status
// =============================================================================
export const StepStatus = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    SKIPPED: 'SKIPPED'
} as const;

export type StepStatus = typeof StepStatus[keyof typeof StepStatus];

// =============================================================================
// Approval Status - matches db/schema.cds entity StepApprovals.status
// =============================================================================
export const ApprovalStatus = {
    PENDING: 'PENDING',
    WAITING: 'WAITING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
} as const;

export type ApprovalStatus = typeof ApprovalStatus[keyof typeof ApprovalStatus];

// =============================================================================
// Sync Trigger - matches db/schema.cds entity StepDefinitions.syncTrigger
// =============================================================================
export const SyncTrigger = {
    NONE: 'NONE',
    IMMEDIATE: 'IMMEDIATE',
    WITH_NEXT: 'WITH_NEXT',
    ON_COMPLETE: 'ON_COMPLETE'
} as const;

export type SyncTrigger = typeof SyncTrigger[keyof typeof SyncTrigger];

// =============================================================================
// Approver Type - matches db/schema.cds entity ApproverRules.approverType
// =============================================================================
export const ApproverType = {
    USER: 'USER',
    ROLE: 'ROLE',
    GROUP: 'GROUP'
} as const;

export type ApproverType = typeof ApproverType[keyof typeof ApproverType];

// =============================================================================
// Step History Action - matches db/schema.cds entity StepHistory.action
// =============================================================================
export const StepHistoryAction = {
    CREATED: 'CREATED',
    ACTIVATED: 'ACTIVATED',
    DATA_UPDATED: 'DATA_UPDATED',
    STATUS_CHANGED: 'STATUS_CHANGED',
    SLA_BREACHED: 'SLA_BREACHED',
    APPROVAL_STARTED: 'APPROVAL_STARTED',
    SENT_BACK: 'SENT_BACK'
} as const;

export type StepHistoryAction = typeof StepHistoryAction[keyof typeof StepHistoryAction];

// =============================================================================
// Common Interfaces
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
