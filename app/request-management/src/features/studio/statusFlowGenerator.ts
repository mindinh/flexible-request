/**
 * statusFlowGenerator – Converts Workflow Definition Graph → StatusFlowModel
 *
 * Follows STATUS_FLOW.md algorithm:
 *   §2  Step Classification (REQUESTOR / DATA_ENTRY / APPROVAL / SYSTEM)
 *       → Uses actionSubType as PRIMARY signal, form actions as SECONDARY
 *   §3  Topological Sort (DFS-based, cycle-safe)
 *   §4  Lane Generation (actor names from workflow)
 *   §5  Data Entry Block Detection (sequential grouping)
 *   §6  Requestor Data Entry Handling (draft sub-steps in Requestor lane)
 *   §7  Overall Status Generation (one per lane)
 *   §8  Individual Status Generation – from STATUS LIBRARY reference
 *   §9  Status Mapping Logic
 *   §10 Status Card Construction
 *   §11 Transition Rendering (forward-only, edge-based)
 *   §12 Legend (categorized roles, actions, statuses)
 *   §14 Validation & Fallbacks
 */
import type {
    UiWorkflowNode,
    UiWorkflowEdge,
    UiForm,
    StatusFlowModel,
    StatusFlowLane,
    StatusFlowPhase,
    StatusFlowTransition,
    IndividualStatus,
} from './types';

// ─── §2 Step Classification ─────────────────────────────────────────────

type StepType = 'REQUESTOR_STEP' | 'DATA_ENTRY_STEP' | 'APPROVAL_STEP' | 'SYSTEM_STEP';

interface ClassifiedStep {
    node: UiWorkflowNode;
    stepType: StepType;
    actorLabel: string;
    formActions: string[];
}

/**
 * Classify a step following §2 priority rules.
 * PRIMARY: actionSubType ('approval' → APPROVAL, 'user_task' → DATA_ENTRY)
 * SECONDARY: form actions containing 'approve'/'reject' → APPROVAL
 */
function classifyStep(node: UiWorkflowNode, forms: UiForm[]): ClassifiedStep {
    const data = node.data;
    const type = node.type;
    const actions = getFormActions(node, forms);

    // 1️⃣ Start / End → REQUESTOR_STEP
    if (type === 'startNode' || data?.isStart || type === 'endNode') {
        return { node, stepType: 'REQUESTOR_STEP', actorLabel: 'Requestor', formActions: actions };
    }

    // Determine effective task type from:
    //   1. actionSubType === 'approval' → APPROVAL
    //   2. form actions include 'approve'/'reject' → APPROVAL (secondary detection)
    //   3. default → DATA_ENTRY
    const subType = (data?.actionSubType as string) || '';
    const isApprovalSubType = subType === 'approval';
    const loweredActions = actions.map(a => a.toLowerCase());
    const hasApprovalActions = loweredActions.some(a => a === 'approve' || a === 'reject');
    const isApproval = isApprovalSubType || hasApprovalActions;

    // All recipients are stored in approverName/approverDisplayName fields regardless of step type
    const recipientLabel = (data?.approverDisplayName as string)
        || (data?.approverName as string)
        || (data?.ownerName as string)
        || data?.label
        || 'Unknown';

    if (isApproval) {
        return { node, stepType: 'APPROVAL_STEP', actorLabel: recipientLabel, formActions: actions };
    }

    // DATA_ENTRY (user_task, form, or any other subtype)
    return { node, stepType: 'DATA_ENTRY_STEP', actorLabel: recipientLabel, formActions: actions };
}

function getFormActions(node: UiWorkflowNode, forms: UiForm[]): string[] {
    const formId = node.data?.formId;
    if (!formId) return [];
    const form = forms.find(f => f.id === formId);
    if (!form?.actions) return [];
    return form.actions.map(a => a.label).filter(Boolean);
}

// ─── §3 Topological Sort (DFS-based, cycle-safe) ────────────────────────

function topologicalSort(nodes: UiWorkflowNode[], edges: UiWorkflowEdge[]): string[] {
    const nodeSet = new Set(nodes.map(n => n.id));
    const adj = new Map<string, string[]>();
    for (const id of nodeSet) adj.set(id, []);
    for (const e of edges) {
        if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue;
        adj.get(e.source)!.push(e.target);
    }

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const id of nodeSet) color.set(id, WHITE);
    const result: string[] = [];

    function dfs(u: string) {
        color.set(u, GRAY);
        for (const v of adj.get(u) || []) {
            if (color.get(v) === WHITE) dfs(v);
        }
        color.set(u, BLACK);
        result.push(u);
    }

    // Start nodes first
    const startIds = new Set(nodes.filter(n => n.type === 'startNode' || n.data?.isStart).map(n => n.id));
    for (const id of startIds) { if (color.get(id) === WHITE) dfs(id); }
    for (const id of nodeSet) { if (color.get(id) === WHITE) dfs(id); }

    result.reverse();
    return result;
}

// ─── STATUS LIBRARY – matches the reference image exactly ───────────────

function makeChip(label: string, desc: string | undefined, color: string, bgColor: string, borderColor: string): IndividualStatus {
    return { id: `is-${label.replace(/\s+/g, '-').toLowerCase()}`, label, description: desc, color, bgColor, borderColor };
}

/** Overall Request Status: Draft, Submitted, Completed, Rejected, Withdrawn */
function overallRequestStatuses(): IndividualStatus[] {
    return [
        makeChip('Draft', undefined, '#475569', '#f8fafc', '#e2e8f0'),
        makeChip('Submitted', undefined, '#2563eb', '#eff6ff', '#bfdbfe'),
        makeChip('Completed', undefined, '#16a34a', '#f0fdf4', '#bbf7d0'),
        makeChip('Rejected', undefined, '#dc2626', '#fef2f2', '#fecaca'),
        makeChip('Withdrawn', undefined, '#7c3aed', '#f5f3ff', '#ddd6fe'),
    ];
}

/** Step Status: Not Started, Started, In Progress, Completed, Rejected */
function stepStatuses(): IndividualStatus[] {
    return [
        makeChip('Not Started', undefined, '#475569', '#f8fafc', '#e2e8f0'),
        makeChip('Started', undefined, '#2563eb', '#eff6ff', '#bfdbfe'),
        makeChip('In Progress', undefined, '#7c3aed', '#f5f3ff', '#ddd6fe'),
        makeChip('Completed', undefined, '#16a34a', '#f0fdf4', '#bbf7d0'),
        makeChip('Rejected', undefined, '#dc2626', '#fef2f2', '#fecaca'),
    ];
}

/** Step Owner Status: Pending, In Progress, In Clarification, Reapproval Needed, Completed */
function stepOwnerStatuses(): IndividualStatus[] {
    return [
        makeChip('Pending', undefined, '#475569', '#f8fafc', '#e2e8f0'),
        makeChip('In Progress', undefined, '#7c3aed', '#f5f3ff', '#ddd6fe'),
        makeChip('In Clarification', undefined, '#d97706', '#fffbeb', '#fde68a'),
        makeChip('Reapproval Needed', undefined, '#ea580c', '#fff7ed', '#fed7aa'),
        makeChip('Completed', undefined, '#16a34a', '#f0fdf4', '#bbf7d0'),
    ];
}

/** Approval Status: Pending, Approved, Rejected, Sent Back */
function approvalStatuses(): IndividualStatus[] {
    return [
        makeChip('Pending', undefined, '#475569', '#f8fafc', '#e2e8f0'),
        makeChip('Approved', undefined, '#16a34a', '#dcfce7', '#86efac'),
        makeChip('Rejected', undefined, '#dc2626', '#fef2f2', '#fecaca'),
        makeChip('Sent Back', undefined, '#d97706', '#fffbeb', '#fde68a'),
    ];
}

// ─── Main Generator ─────────────────────────────────────────────────────

export function generateStatusFlow(
    workflowNodes: UiWorkflowNode[],
    workflowEdges: UiWorkflowEdge[],
    forms: UiForm[],
): StatusFlowModel {
    const emptyModel: StatusFlowModel = { title: '', lanes: [], phases: [], transitions: [] };
    if (workflowNodes.length === 0) return emptyModel;

    // §14 Validation
    const hasStart = workflowNodes.some(n => n.type === 'startNode' || n.data?.isStart);
    if (!hasStart) return emptyModel;

    // §2 Classify
    const classMap = new Map<string, ClassifiedStep>();
    for (const n of workflowNodes) classMap.set(n.id, classifyStep(n, forms));

    // §3 Topological sort
    const sorted = topologicalSort(workflowNodes, workflowEdges);
    const orderedSteps = sorted.map(id => classMap.get(id)!).filter(Boolean);

    // Count approvers
    const totalApprovers = orderedSteps.filter(s => s.stepType === 'APPROVAL_STEP').length;

    // ─── §6: Detect requestor-owned data entry steps ─────────────────
    // All DATA_ENTRY steps BEFORE the first APPROVAL step go to Requestor lane (as Draft sub-steps)
    const requestorDataEntryIds = new Set<string>();
    for (const step of orderedSteps) {
        if (step.stepType === 'REQUESTOR_STEP') continue;
        if (step.stepType === 'APPROVAL_STEP' || step.stepType === 'SYSTEM_STEP') break;
        if (step.stepType === 'DATA_ENTRY_STEP') {
            requestorDataEntryIds.add(step.node.id);
        }
    }

    // ─── §4 Lane Generation ──────────────────────────────────────────
    const lanes: StatusFlowLane[] = [];
    const laneMap = new Map<string, number>();
    const stepToLane = new Map<string, number>();

    // Requestor lane always first
    lanes.push({ id: 'lane-requestor', label: 'Creator', subtitle: 'Requestor', roleType: 'requestor' });

    let approverIndex = 0;
    for (const step of orderedSteps) {
        if (step.stepType === 'REQUESTOR_STEP') {
            stepToLane.set(step.node.id, 0);
            continue;
        }

        // §6: Requestor-owned data entry → ALSO assigned to lane 0 for the Draft phase
        // But they ALSO get their own Step Owner lane
        const actorKey = step.actorLabel;
        if (!laneMap.has(actorKey)) {
            let roleType: 'requestor' | 'stepOwner' | 'approver';
            let laneLabel: string;
            let subtitle: string;

            if (step.stepType === 'APPROVAL_STEP') {
                roleType = 'approver';
                approverIndex++;
                laneLabel = totalApprovers === 1
                    ? step.actorLabel
                    : `${step.actorLabel}`;
                subtitle = `Approver${totalApprovers > 1 ? ` L${approverIndex}` : ''}`;
            } else {
                roleType = 'stepOwner';
                laneLabel = step.actorLabel;
                subtitle = 'Step Owner';
            }

            lanes.push({
                id: `lane-${lanes.length}`,
                label: laneLabel,
                subtitle,
                roleType,
                sourceNodeId: step.node.id,
            });
            laneMap.set(actorKey, lanes.length - 1);
        }
        stepToLane.set(step.node.id, laneMap.get(actorKey)!);
    }

    // ─── §5-10 Phase / Status Card Generation ────────────────────────
    const phases: StatusFlowPhase[] = [];
    let phaseNum = 0;

    // Separate steps into buckets
    const requestorStartSteps: ClassifiedStep[] = [];
    const requestorDESteps: ClassifiedStep[] = [];
    const workSteps: ClassifiedStep[] = [];

    for (const step of orderedSteps) {
        if (step.stepType === 'REQUESTOR_STEP' && step.node.type !== 'endNode') {
            requestorStartSteps.push(step);
        } else if (requestorDataEntryIds.has(step.node.id)) {
            requestorDESteps.push(step);
        } else if (step.node.type !== 'endNode') {
            workSteps.push(step);
        }
    }

    // ── Phase 1: Requestor Draft (§6) ────────────────────────────────
    const allRequestorSteps = [...requestorStartSteps, ...requestorDESteps];
    if (allRequestorSteps.length > 0) {
        phaseNum++;
        // Show step names as the status items (user requested: "Step name in the Requestor group")
        const draftStatuses: IndividualStatus[] = [];

        if (requestorDESteps.length === 0) {
            draftStatuses.push(makeChip('Draft', 'Request not yet submitted', '#475569', '#f8fafc', '#e2e8f0'));
        } else {
            for (const s of requestorDESteps) {
                const stepName = s.node.data?.label || 'Step';
                draftStatuses.push(makeChip(
                    stepName,
                    `Fill in ${stepName}`,
                    '#475569', '#f8fafc', '#e2e8f0',
                ));
            }
        }

        phases.push({
            id: 'phase-draft',
            phaseNumber: phaseNum,
            label: 'Draft: Create Request',
            laneIndex: 0,
            statuses: draftStatuses,
            sourceStepIds: allRequestorSteps.map(s => s.node.id),
        });
    }

    // ── Phase 2: Submitted ────────────────────────────────────────────
    phaseNum++;
    phases.push({
        id: 'phase-submitted',
        phaseNumber: phaseNum,
        label: 'Submitted',
        laneIndex: 0,
        statuses: [makeChip('Submitted', 'Request enters workflow', '#2563eb', '#eff6ff', '#bfdbfe')],
        sourceStepIds: [],
    });

    // ── Phase 3+: Step Owner / Approval phases ───────────────────────
    // Data Entry steps that were grouped in Requestor lane ALSO get their own Step Owner phase
    for (const step of requestorDESteps) {
        const li = stepToLane.get(step.node.id) ?? 1;
        phaseNum++;
        phases.push({
            id: `phase-de-${step.node.id}`,
            phaseNumber: phaseNum,
            label: `Processing: ${step.actorLabel}`,
            laneIndex: li,
            // §8: Step Owner statuses – just Started, Completed per user request
            statuses: [
                makeChip('Started', 'Owner begins processing', '#2563eb', '#eff6ff', '#bfdbfe'),
                makeChip('Completed', 'Processing finished', '#16a34a', '#f0fdf4', '#bbf7d0'),
            ],
            sourceStepIds: [step.node.id],
        });
    }

    // Work step phases (non-requestor data entry + approvals)
    let i = 0;
    while (i < workSteps.length) {
        const step = workSteps[i];
        const li = stepToLane.get(step.node.id) ?? 1;

        if (step.stepType === 'DATA_ENTRY_STEP') {
            // Group sequential data entry steps with same actor
            const block: ClassifiedStep[] = [step];
            while (
                i + 1 < workSteps.length &&
                workSteps[i + 1].stepType === 'DATA_ENTRY_STEP' &&
                workSteps[i + 1].actorLabel === step.actorLabel
            ) {
                i++;
                block.push(workSteps[i]);
            }

            phaseNum++;
            const blockLabel = block.length === 1
                ? step.actorLabel
                : block.map(s => s.node.data?.label).filter(Boolean).join(', ');

            // §8: Step Owner statuses – just Started, Completed per user request
            phases.push({
                id: `phase-de-${step.node.id}`,
                phaseNumber: phaseNum,
                label: `Processing: ${blockLabel}`,
                laneIndex: li,
                statuses: [
                    makeChip('Started', 'Owner begins processing', '#2563eb', '#eff6ff', '#bfdbfe'),
                    makeChip('Completed', 'Processing finished', '#16a34a', '#f0fdf4', '#bbf7d0'),
                ],
                sourceStepIds: block.map(s => s.node.id),
            });
        } else if (step.stepType === 'APPROVAL_STEP') {
            phaseNum++;
            // Approval statuses from STATUS LIBRARY
            phases.push({
                id: `phase-ap-${step.node.id}`,
                phaseNumber: phaseNum,
                label: `Under Review: ${step.actorLabel}`,
                laneIndex: li,
                statuses: approvalStatuses(),
                sourceStepIds: [step.node.id],
            });
        } else {
            // SYSTEM_STEP
            phaseNum++;
            phases.push({
                id: `phase-sys-${step.node.id}`,
                phaseNumber: phaseNum,
                label: `Processing: ${step.actorLabel}`,
                laneIndex: li,
                statuses: [
                    makeChip('Started', 'System processing', '#7c3aed', '#f5f3ff', '#ddd6fe'),
                    makeChip('Completed', 'System step finished', '#16a34a', '#f0fdf4', '#bbf7d0'),
                ],
                sourceStepIds: [step.node.id],
            });
        }
        i++;
    }

    // ── Terminal: Completed ───────────────────────────────────────────
    const lastLane = lanes.length > 1 ? lanes.length - 1 : 0;
    phaseNum++;
    phases.push({
        id: 'phase-completed',
        phaseNumber: phaseNum,
        label: 'Completed',
        laneIndex: lastLane,
        statuses: [makeChip('Completed', 'Fully approved and closed', '#16a34a', '#f0fdf4', '#bbf7d0')],
        sourceStepIds: orderedSteps.filter(s => s.node.type === 'endNode').map(s => s.node.id),
    });

    // ─── §11 Transitions (edge-based, forward-only) ─────────────────
    const nodeToPhase = new Map<string, string>();
    for (const phase of phases) {
        for (const sid of phase.sourceStepIds) nodeToPhase.set(sid, phase.id);
    }

    // Build action ID → label lookup from form actions
    const actionIdToLabel = new Map<string, string>();
    for (const form of forms) {
        if (form.actions) {
            for (const a of form.actions) {
                if (a.id && a.label) actionIdToLabel.set(a.id, a.label);
            }
        }
    }

    const transitions: StatusFlowTransition[] = [];
    const transitionSet = new Set<string>();

    // Draft → Submitted
    if (phases.find(p => p.id === 'phase-draft')) {
        transitionSet.add('phase-draft→phase-submitted');
        transitions.push({ id: 'tr-draft-submitted', from: 'phase-draft', to: 'phase-submitted', action: 'Submit' });
    }

    // Submitted → first work phase
    const firstWorkPhase = phases.find(p =>
        p.id !== 'phase-draft' && p.id !== 'phase-submitted' && p.id !== 'phase-completed'
    );
    if (firstWorkPhase) {
        transitionSet.add(`phase-submitted→${firstWorkPhase.id}`);
        transitions.push({ id: `tr-submitted-${firstWorkPhase.id}`, from: 'phase-submitted', to: firstWorkPhase.id, action: '' });
    }

    // Edge-based transitions
    for (const edge of workflowEdges) {
        const fromPhaseId = nodeToPhase.get(edge.source);
        const toPhaseId = nodeToPhase.get(edge.target);
        if (!fromPhaseId || !toPhaseId) continue;
        if (fromPhaseId === toPhaseId) continue;
        if (fromPhaseId === 'phase-draft' || fromPhaseId === 'phase-submitted') continue;

        const key = `${fromPhaseId}→${toPhaseId}`;
        if (transitionSet.has(key)) continue;
        transitionSet.add(key);

        // Resolve edge sourceHandle: could be action ID (e.g., "action-123") or readable label
        let action = '';
        const handle = (edge.sourceHandle as string) || '';
        if (handle) {
            // Try to resolve action ID to human-readable label
            const resolved = actionIdToLabel.get(handle) || handle;
            // Only use if it's not a raw action ID (e.g., "action-1234567890")
            action = resolved.startsWith('action-') ? '' : resolved;
        }
        if (!action) {
            action = (edge.label as string) || '';
        }
        if (!action) {
            if (fromPhaseId.startsWith('phase-de-')) action = 'Completed';
            else if (fromPhaseId.startsWith('phase-ap-')) action = 'Approved';
        }

        transitions.push({ id: `tr-${fromPhaseId}-${toPhaseId}`, from: fromPhaseId, to: toPhaseId, action });
    }

    // Fallback: linear transitions if no edge-based ones
    const hasWorkTransitions = transitions.some(t =>
        t.from !== 'phase-draft' && t.from !== 'phase-submitted'
    );
    if (!hasWorkTransitions) {
        const workPhases = phases.filter(p => p.id !== 'phase-draft' && p.id !== 'phase-submitted');
        for (let t = 0; t < workPhases.length - 1; t++) {
            const from = workPhases[t];
            const to = workPhases[t + 1];
            const key = `${from.id}→${to.id}`;
            if (transitionSet.has(key)) continue;
            transitionSet.add(key);
            let action = '';
            if (from.id.startsWith('phase-de-')) action = 'Completed';
            else if (from.id.startsWith('phase-ap-')) action = 'Approved';
            transitions.push({ id: `tr-${from.id}-${to.id}`, from: from.id, to: to.id, action });
        }
    }

    // ─── Collect all unique actions from workflows for legend ─────────
    const allActions = new Set<string>();
    // From form actions (human-readable labels)
    for (const step of orderedSteps) {
        for (const a of step.formActions) allActions.add(a);
    }
    // From edge labels/sourceHandles (resolve IDs to labels)
    for (const edge of workflowEdges) {
        if (edge.sourceHandle && typeof edge.sourceHandle === 'string') {
            const resolved = actionIdToLabel.get(edge.sourceHandle) || edge.sourceHandle;
            // Only add if it's a proper label (not an action-XXX ID)
            if (!resolved.startsWith('action-')) allActions.add(resolved);
        }
        if (edge.label && typeof edge.label === 'string') allActions.add(edge.label as string);
    }

    return {
        title: '',
        lanes,
        phases,
        transitions,
        // Attach STATUS LIBRARY and actions for the Legend panel
        statusLibrary: {
            overallRequestStatus: overallRequestStatuses(),
            stepStatus: stepStatuses(),
            stepOwnerStatus: stepOwnerStatuses(),
            approvalStatus: approvalStatuses(),
        },
        workflowActions: Array.from(allActions),
    };
}
