import { AlertCircle } from 'lucide-react';
import { WorkflowTimeline } from '../../../../components/shared';
import type { WorkflowStepStatus } from '../../../../components/shared';
import type { StepDefinition, ResolvedApproversMap } from '../../../../types';

// Step owner assignment map type
export interface StepOwnerAssignment {
    ownerId: string;
    ownerType: string;
    ownerName: string;
}

/** Parsed form action from formSchemasContent */
interface FormAction {
    id: string;
    label: string;
    variant?: string;
}

interface WorkflowPreviewPanelProps {
    steps: StepDefinition[];
    resolvedApprovers: ResolvedApproversMap;
    /** Map of step owners assigned by coordinator */
    stepOwners?: Record<string, StepOwnerAssignment>;
    /** JSON string of form schemas — used to resolve decision actions per step */
    formSchemasContent?: string;
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
 * Resolve form actions for a step from formSchemasContent.
 * Returns an empty array if the step has no assigned form or no actions defined.
 */
function resolveFormActions(
    formId: string | undefined,
    formSchemasContent: string | undefined
): FormAction[] {
    if (!formId || !formSchemasContent) return [];
    try {
        const forms = JSON.parse(formSchemasContent);
        const form = forms.find((f: any) => f.id === formId);
        return form?.actions || [];
    } catch {
        return [];
    }
}

/**
 * Sidebar panel showing workflow preview with dynamically resolved approvers.
 * Uses variant="preview" for enriched step cards with always-visible details.
 * Shows decision action badges when steps have form-defined branching actions.
 */
export function WorkflowPreviewPanel({
    steps,
    resolvedApprovers,
    stepOwners = {},
    formSchemasContent
}: WorkflowPreviewPanelProps) {
    // Steps are now pre-sorted topologically by the data hooks.
    // Just filter out End nodes for a cleaner UI.
    const sortedSteps = steps.filter(step => (step as any).stepType !== 'end');

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

        // Resolve form actions for this step (decision branching badges)
        const formActions = resolveFormActions(step.formId, formSchemasContent);
        const branchLabel = (formActions.length > 0 && !step.isStartStep)
            ? `Decisions: ${formActions.map(a => a.label).join(' / ')}`
            : undefined;

        return {
            id: step.ID,
            title: step.stepName,
            status: status,
            slaDays: step.slaDays,
            ownerName: ownerDisplayName,
            approvalRules: approvalRules,
            branchLabel: branchLabel,
        };
    });

    return (
        <div className="sticky top-6 space-y-6">
            {/* Workflow Preview Card — uses "preview" variant for rich step cards */}
            <WorkflowTimeline
                steps={workflowSteps}
                variant="preview"
            />


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
