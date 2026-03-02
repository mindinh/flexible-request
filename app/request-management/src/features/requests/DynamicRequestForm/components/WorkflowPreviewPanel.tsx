import { AlertCircle, MousePointerClick } from 'lucide-react';
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
 * Robust display name fallback to ensure assignee is never blank.
 * Order: explicit display name → resolved principal name → safe label → raw ID
 */
function resolveDisplayName(
    primary: string | null | undefined,
    fallback: string | null | undefined,
    safeLabel: string
): string {
    if (primary && primary.trim()) return primary.trim();
    if (fallback && fallback.trim()) return fallback.trim();
    return safeLabel;
}

/**
 * Sidebar panel showing workflow preview with dynamically resolved approvers.
 * Uses variant="preview" for enriched step cards with always-visible details.
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
                    // Robust fallback: displayName → approverValue → "Unassigned"
                    name: resolveDisplayName(
                        resolved.approverDisplayName,
                        resolved.approverValue,
                        'Unassigned'
                    ),
                    type: (resolved.approverType?.toUpperCase() || 'ROLE') as 'USER' | 'ROLE'
                }]
            }))
            : undefined;

        // Get step owner — prioritize assigned owner from stepOwners map
        const assignedOwner = stepOwners[step.ID];

        // Robust owner display: assignedOwner → step default → "Request Coordinator"
        const ownerDisplayName = assignedOwner
            ? resolveDisplayName(assignedOwner.ownerName, assignedOwner.ownerId, 'Request Coordinator')
            : resolveDisplayName(step.ownerDisplayName, step.ownerId, 'Request Coordinator');

        return {
            id: step.ID,
            title: step.stepName,
            status: status,
            slaDays: step.slaDays,
            ownerName: ownerDisplayName,
            approvalRules: approvalRules,
        };
    });

    return (
        <div className="sticky top-6 space-y-6">
            {/* Workflow Preview Card — uses "preview" variant for rich step cards */}
            <WorkflowTimeline
                steps={workflowSteps}
                variant="preview"
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
