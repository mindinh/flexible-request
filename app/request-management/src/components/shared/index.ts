/**
 * Shared Components - Reusable UI components used across the application
 * 
 * These components ensure UX consistency by providing a single source of truth
 * for common UI patterns. Always use these shared components instead of creating
 * custom implementations.
 */

export { RequestTypeIcon } from './RequestTypeIcon';
export { GlobalErrorBoundary } from './GlobalErrorBoundary';
export { GlobalToast } from './GlobalToast';

export { WorkflowTimeline } from './WorkflowTimeline';
export type { WorkflowTimelineStep, WorkflowStepStatus, ApprovalRule } from './WorkflowTimeline';
export { AccessDenied } from './AccessDenied';
