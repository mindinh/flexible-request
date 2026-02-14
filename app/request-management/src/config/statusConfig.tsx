/**
 * Status Configuration - Centralized status to badge mapping
 * 
 * This file provides consistent styling for status badges across the app.
 * Import this instead of defining statusConfig locally in components.
 */
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, CircleOff } from 'lucide-react';
import { RequestStatus, StepStatus, ApprovalStatus } from '@/types';
import type { ReactNode } from 'react';

// ============================================================================
// Badge Variant Type
// ============================================================================
export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

// ============================================================================
// Request Status Config
// ============================================================================
export interface StatusConfigItem {
    variant: BadgeVariant;
    icon: ReactNode;
    label: string;
}

export const REQUEST_STATUS_CONFIG: Record<RequestStatus, StatusConfigItem> = {
    [RequestStatus.DRAFT]: {
        variant: 'neutral',
        icon: <FileText className="w-3 h-3" />,
        label: 'Draft'
    },
    [RequestStatus.SUBMITTED]: {
        variant: 'info',
        icon: <Clock className="w-3 h-3" />,
        label: 'Submitted'
    },
    [RequestStatus.IN_PROGRESS]: {
        variant: 'warning',
        icon: <AlertCircle className="w-3 h-3" />,
        label: 'In Progress'
    },
    [RequestStatus.COMPLETED]: {
        variant: 'success',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Completed'
    },
    [RequestStatus.REJECTED]: {
        variant: 'error',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Rejected'
    },
    [RequestStatus.WITHDRAWN]: {
        variant: 'neutral',
        icon: <CircleOff className="w-3 h-3" />,
        label: 'Withdrawn'
    },
};

// ============================================================================
// Step Status Config
// ============================================================================
export const STEP_STATUS_CONFIG: Record<StepStatus, Omit<StatusConfigItem, 'icon'>> = {
    [StepStatus.PENDING]: { variant: 'neutral', label: 'Pending' },
    [StepStatus.IN_PROGRESS]: { variant: 'warning', label: 'In Progress' },
    [StepStatus.COMPLETED]: { variant: 'success', label: 'Completed' },
    [StepStatus.REJECTED]: { variant: 'error', label: 'Rejected' },
    [StepStatus.SKIPPED]: { variant: 'neutral', label: 'Skipped' },
};

// ============================================================================
// Approval Status Config
// ============================================================================
export const APPROVAL_STATUS_CONFIG: Record<ApprovalStatus, Omit<StatusConfigItem, 'icon'>> = {
    [ApprovalStatus.PENDING]: { variant: 'neutral', label: 'Pending' },
    [ApprovalStatus.WAITING]: { variant: 'warning', label: 'Waiting' },
    [ApprovalStatus.APPROVED]: { variant: 'success', label: 'Approved' },
    [ApprovalStatus.REJECTED]: { variant: 'error', label: 'Rejected' },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status config with fallback to DRAFT
 */
export function getRequestStatusConfig(status: string | undefined): StatusConfigItem {
    return REQUEST_STATUS_CONFIG[status as RequestStatus] || REQUEST_STATUS_CONFIG.DRAFT;
}

/**
 * Get step status config with fallback to PENDING
 */
export function getStepStatusConfig(status: string | undefined): Omit<StatusConfigItem, 'icon'> {
    return STEP_STATUS_CONFIG[status as StepStatus] || STEP_STATUS_CONFIG.PENDING;
}

/**
 * Get all request status options for dropdowns
 */
export function getRequestStatusOptions() {
    return Object.values(RequestStatus).map(status => ({
        value: status,
        label: REQUEST_STATUS_CONFIG[status].label,
        ...REQUEST_STATUS_CONFIG[status],
    }));
}
