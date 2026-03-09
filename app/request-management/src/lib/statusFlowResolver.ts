/**
 * statusFlowResolver – Maps runtime request/step status to business-friendly labels
 * from the configured StatusFlowModel.
 *
 * Updated to work with the phase-based StatusFlowModel (lanes, phases, IndividualStatus).
 * Used by: My Requests, Inbox, and Workflow Preview to display business statuses.
 */
import type { StatusFlowModel, IndividualStatus } from '../features/studio/types';

// ─── Status Chip Colors (fallback palette) ───────────────────────────────

interface StatusChipStyle {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

const CHIP_STYLES: Record<string, StatusChipStyle> = {
    // Overall Request Status
    'overall-draft':      { label: 'Draft',      color: '#475569', bgColor: '#f8fafc', borderColor: '#e2e8f0' },
    'overall-submitted':  { label: 'Submitted',  color: '#2563eb', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
    'overall-completed':  { label: 'Completed',  color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
    'overall-rejected':   { label: 'Rejected',   color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
    'overall-withdrawn':  { label: 'Withdrawn',  color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a' },
    // Step Status
    'step-not-started':   { label: 'Not Started',  color: '#475569', bgColor: '#f8fafc', borderColor: '#e2e8f0' },
    'step-started':       { label: 'Started',      color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe' },
    'step-in-progress':   { label: 'In Progress',  color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
    'step-completed':     { label: 'Completed',    color: '#16a34a', bgColor: '#dcfce7', borderColor: '#86efac' },
    'step-rejected':      { label: 'Rejected',     color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
    // Step Owner Status
    'owner-pending':           { label: 'Pending',           color: '#475569', bgColor: '#f8fafc', borderColor: '#e2e8f0' },
    'owner-in-progress':       { label: 'In Progress',       color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe' },
    'owner-in-clarification':  { label: 'In Clarification',  color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a' },
    'owner-reapproval-needed': { label: 'Reapproval Needed', color: '#ea580c', bgColor: '#fff7ed', borderColor: '#fed7aa' },
    'owner-completed':         { label: 'Completed',         color: '#16a34a', bgColor: '#dcfce7', borderColor: '#86efac' },
    // Approval Status
    'approval-pending':   { label: 'Pending',   color: '#475569', bgColor: '#f8fafc', borderColor: '#e2e8f0' },
    'approval-approved':  { label: 'Approved',  color: '#16a34a', bgColor: '#dcfce7', borderColor: '#86efac' },
    'approval-rejected':  { label: 'Rejected',  color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
    'approval-sent-back': { label: 'Sent Back', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a' },
};

// ─── System status → chip ID mapping ─────────────────────────────────────

const REQUEST_STATUS_TO_CHIP: Record<string, string> = {
    'DRAFT':       'overall-draft',
    'SUBMITTED':   'overall-submitted',
    'IN_PROGRESS': 'overall-submitted',
    'COMPLETED':   'overall-completed',
    'REJECTED':    'overall-rejected',
    'WITHDRAWN':   'overall-withdrawn',
};

const STEP_STATUS_TO_LABEL: Record<string, string> = {
    'NOT_STARTED':      'Not Started',
    'PENDING':          'Pending',
    'UPCOMING':         'Not Started',
    'STARTED':          'Started',
    'IN_PROGRESS':      'In Progress',
    'IN_CLARIFICATION': 'In Clarification',
    'COMPLETED':        'Completed',
    'REJECTED':         'Rejected',
    'SKIPPED':          'Not Started',
};

// ─── Parse helper ────────────────────────────────────────────────────────

export function parseStatusFlowModel(content: string | null | undefined): StatusFlowModel | null {
    if (!content) return null;
    try {
        const parsed = JSON.parse(content);
        if (parsed?.phases?.length > 0) return parsed as StatusFlowModel;
        return null;
    } catch {
        return null;
    }
}

// ─── Core resolver ───────────────────────────────────────────────────────

export interface ResolvedStatus {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

/**
 * Resolves the business-friendly status for a request based on its
 * configured Status Flow.
 */
export function resolveBusinessStatus(
    statusFlowContent: string | null | undefined,
    requestStatus: string,
    currentStepDefId?: string | null,
    stepStatus?: string | null,
): ResolvedStatus | null {
    const model = parseStatusFlowModel(statusFlowContent);

    // Strategy 1: Match via phase-based model (new format)
    if (model && currentStepDefId && stepStatus) {
        // Find a phase whose sourceStepIds include the current step
        const phase = model.phases.find(p => p.sourceStepIds.includes(currentStepDefId!));
        if (phase) {
            const targetLabel = STEP_STATUS_TO_LABEL[stepStatus];
            if (targetLabel) {
                const chip = phase.statuses.find(s =>
                    s.label.toLowerCase() === targetLabel.toLowerCase()
                );
                if (chip) {
                    return { label: chip.label, color: chip.color, bgColor: chip.bgColor, borderColor: chip.borderColor };
                }
            }
        }
    }

    // Strategy 2: Match via overall request status → fallback chip
    const requestChipId = REQUEST_STATUS_TO_CHIP[requestStatus];
    if (requestChipId && CHIP_STYLES[requestChipId]) {
        const chip = CHIP_STYLES[requestChipId];
        return { label: chip.label, color: chip.color, bgColor: chip.bgColor, borderColor: chip.borderColor };
    }

    return null;
}

/**
 * Resolves the business-friendly status for a workflow step.
 * Used by WorkflowTimeline to display step-level business statuses.
 */
export function resolveStepBusinessStatus(
    statusFlowContent: string | null | undefined,
    stepDefId: string,
    stepStatus: string,
): ResolvedStatus | null {
    const model = parseStatusFlowModel(statusFlowContent);

    if (model) {
        // Find the phase that owns this step
        const phase = model.phases.find(p => p.sourceStepIds.includes(stepDefId));
        if (phase) {
            const targetLabel = STEP_STATUS_TO_LABEL[stepStatus];
            if (targetLabel) {
                const chip = phase.statuses.find(s =>
                    s.label.toLowerCase() === targetLabel.toLowerCase()
                );
                if (chip) {
                    return { label: chip.label, color: chip.color, bgColor: chip.bgColor, borderColor: chip.borderColor };
                }
            }
        }
    }

    // Fallback: use the static chip styles
    const stepChipId = (() => {
        switch (stepStatus) {
            case 'NOT_STARTED': case 'PENDING': case 'UPCOMING': case 'SKIPPED': return 'step-not-started';
            case 'STARTED': return 'step-started';
            case 'IN_PROGRESS': return 'step-in-progress';
            case 'IN_CLARIFICATION': return 'owner-in-clarification';
            case 'COMPLETED': return 'step-completed';
            case 'REJECTED': return 'step-rejected';
            default: return null;
        }
    })();

    if (stepChipId && CHIP_STYLES[stepChipId]) {
        const chip = CHIP_STYLES[stepChipId];
        return { label: chip.label, color: chip.color, bgColor: chip.bgColor, borderColor: chip.borderColor };
    }

    return null;
}
