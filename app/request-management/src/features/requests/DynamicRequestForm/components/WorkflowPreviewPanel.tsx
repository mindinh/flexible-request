import { AlertCircle, User, MousePointerClick } from 'lucide-react';
import { WorkflowTimeline } from '../../../../components/shared';
import type { WorkflowStepStatus } from '../../../../components/shared';
import type { StepDefinition, ResolvedApproversMap } from '../../../../types';

// Step owner assignment map type
export interface StepOwnerAssignment {
    ownerId: string;
    ownerType: string;
    ownerName: string;
}

interface WorkflowPreviewPanelProps {
    steps: StepDefinition[];
    resolvedApprovers: ResolvedApproversMap;
    isEditMode: boolean;
    /** Currently selected step ID (for step owner assignment) */
    selectedStepId?: string;
    /** Callback when a step is clicked */
    onStepClick?: (stepId: string) => void;
    /** Map of step owners assigned by coordinator */
    stepOwners?: Record<string, StepOwnerAssignment>;
}

/**
 * Sidebar panel showing workflow preview with dynamically resolved approvers.
 * Supports step selection for configuring step owners.
 */
export function WorkflowPreviewPanel({
    steps,
    resolvedApprovers,
    isEditMode,
    selectedStepId,
    onStepClick,
    stepOwners = {}
}: WorkflowPreviewPanelProps) {
    // Sort steps by sequence number
    const sortedSteps = steps.slice().sort((a, b) =>
        (a.sequenceNum || 0) - (b.sequenceNum || 0)
    );

    const workflowSteps = sortedSteps.map((step, idx) => {
        // Determine status based on step position
        let status: WorkflowStepStatus = 'UPCOMING';
        if (idx === 0) {
            status = 'STARTED';
        }

        // Use dynamically resolved approvers
        const stepResolvedApprovers = resolvedApprovers[step.ID] || [];

        const approvalRules = stepResolvedApprovers.length > 0
            ? stepResolvedApprovers.map(resolved => ({
                ruleName: resolved.ruleName,
                approvers: [{
                    name: resolved.approverDisplayName || resolved.approverValue,
                    type: (resolved.approverType?.toUpperCase() || 'ROLE') as 'USER' | 'ROLE'
                }]
            }))
            : undefined;

        // Get step owner - prioritize assigned owner from stepOwners map
        const assignedOwner = stepOwners[step.ID];

        // If assignedOwner is present (even if empty/cleared), use it. Otherwise fallback to default.
        const ownerDisplayName = assignedOwner
            ? (assignedOwner.ownerName || null)
            : (step.ownerDisplayName || step.ownerId || null);

        return {
            id: step.ID,
            title: step.stepName,
            status: status,
            slaDays: step.slaDays,
            ownerName: ownerDisplayName,
            approvalRules: approvalRules,
            subtitle: (
                <div className="space-y-1">
                    {status === 'STARTED' && <span className="text-amber-600 font-medium">Data entry required</span>}
                    {status === 'IN_PROGRESS' && <span className="text-blue-600 font-medium">In Progress</span>}
                    {status === 'COMPLETED' && <span className="text-emerald-600 font-medium">Completed</span>}
                    {status === 'REJECTED' && <span className="text-rose-600 font-medium">Rejected</span>}
                    {status === 'SKIPPED' && <span className="text-slate-500">Skipped</span>}
                    {status === 'UPCOMING' && <span className="text-slate-500">Upcoming</span>}

                    {/* Display Step Owner */}
                    {ownerDisplayName && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            <span>{ownerDisplayName}</span>
                        </div>
                    )}
                    {!ownerDisplayName && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 italic">
                            <User className="w-3 h-3" />
                            <span>Request Coordinator</span>
                        </div>
                    )}
                </div>
            )
        };
    });

    return (
        <div className="sticky top-6 space-y-6">
            {/* Workflow Preview Card */}
            <WorkflowTimeline
                steps={workflowSteps}
                onStepClick={onStepClick}
                selectedStepId={selectedStepId}
            />

            {/* Click to Configure Tip */}
            {onStepClick && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-700">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                        <MousePointerClick className="w-4 h-4" />
                        Configure Step Owners
                    </h4>
                    <p className="opacity-90">
                        Click on any step above to assign its owner. The selected step will be highlighted.
                    </p>
                </div>
            )}

            {/* Help / Info Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Tip
                </h4>
                <p className="opacity-90">
                    Providing a detailed justification helps approvers speed up the process.
                </p>
            </div>
        </div>
    );
}
