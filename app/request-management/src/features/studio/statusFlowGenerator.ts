/**
 * statusFlowGenerator – Converts Workflow Graph → Simple StatusFlowModel
 *
 * Rules:
 *  - Entry status  = default per step type (Draft, Pending)
 *  - Exit status   = edge statusConfig when edge has a sourceHandle, else default
 *  - Action label  = edge sourceHandle → form action label, or form's first action
 *  - Branching     = one exit card per outgoing edge with distinct action
 *  - Request Completed = terminal card added after any exit that targets an END node
 *  - Cross-lane    = connects via pendingConnections map (not simple prevExitId)
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

// ─── Step Classification ────────────────────────────────────────────────

type StepType = 'REQUESTOR_STEP' | 'DATA_ENTRY_STEP' | 'APPROVAL_STEP' | 'SYSTEM_STEP';

interface ClassifiedStep {
    node: UiWorkflowNode;
    stepType: StepType;
    actorLabel: string;
}

function classifyStep(node: UiWorkflowNode, forms: UiForm[]): ClassifiedStep {
    const data = node.data;
    if (node.type === 'startNode' || data?.isStart || node.type === 'endNode') {
        return { node, stepType: 'REQUESTOR_STEP', actorLabel: 'Requestor' };
    }
    const subType = (data?.actionSubType as string) || '';
    const formActions = getFormActionLabels(node, forms).map(a => a.toLowerCase());
    const isApproval = subType === 'approval' || formActions.some(a => a === 'approve' || a === 'reject');
    const actorLabel = (data?.approverDisplayName as string)
        || (data?.approverName as string)
        || (data?.ownerName as string)
        || data?.label || 'Unknown';
    if (isApproval) return { node, stepType: 'APPROVAL_STEP', actorLabel };
    return { node, stepType: 'DATA_ENTRY_STEP', actorLabel };
}

function getFormActionLabels(node: UiWorkflowNode, forms: UiForm[]): string[] {
    const formId = node.data?.formId;
    if (!formId) return [];
    const form = forms.find(f => f.id === formId);
    return form?.actions?.map(a => a.label).filter(Boolean) || [];
}

function buildActionIdToLabel(forms: UiForm[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const form of forms) {
        form.actions?.forEach(a => { if (a.id && a.label) map.set(a.id, a.label); });
    }
    return map;
}

// ─── Topological Sort ───────────────────────────────────────────────────

function topologicalSort(nodes: UiWorkflowNode[], edges: UiWorkflowEdge[]): string[] {
    const nodeSet = new Set(nodes.map(n => n.id));
    const adj = new Map<string, string[]>();
    for (const id of nodeSet) adj.set(id, []);
    for (const e of edges) {
        if (nodeSet.has(e.source) && nodeSet.has(e.target)) adj.get(e.source)!.push(e.target);
    }
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const id of nodeSet) color.set(id, WHITE);
    const result: string[] = [];
    function dfs(u: string) {
        color.set(u, GRAY);
        for (const v of adj.get(u) || []) { if (color.get(v) === WHITE) dfs(v); }
        color.set(u, BLACK);
        result.push(u);
    }
    for (const n of nodes) { if ((n.type === 'startNode' || n.data?.isStart) && color.get(n.id) === WHITE) dfs(n.id); }
    for (const id of nodeSet) { if (color.get(id) === WHITE) dfs(id); }
    result.reverse();
    return result;
}

// ─── Color Utilities ────────────────────────────────────────────────────

function lighten(hex: string, amount = 0.85): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const l = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount));
    return `#${l(r).toString(16).padStart(2, '0')}${l(g).toString(16).padStart(2, '0')}${l(b).toString(16).padStart(2, '0')}`;
}

function makeChip(label: string, color: string): IndividualStatus {
    return {
        id: `is-${label.replace(/\s+/g, '-').toLowerCase()}`,
        label, description: undefined,
        color, bgColor: lighten(color), borderColor: lighten(color, 0.7),
    };
}

// ─── Main Generator ─────────────────────────────────────────────────────

export function generateStatusFlow(
    workflowNodes: UiWorkflowNode[],
    workflowEdges: UiWorkflowEdge[],
    forms: UiForm[],
): StatusFlowModel {
    const empty: StatusFlowModel = { title: '', lanes: [], phases: [], transitions: [] };
    if (workflowNodes.length === 0) return empty;
    if (!workflowNodes.some(n => n.type === 'startNode' || n.data?.isStart)) return empty;

    // Lookups
    const classMap = new Map<string, ClassifiedStep>();
    for (const n of workflowNodes) classMap.set(n.id, classifyStep(n, forms));

    const nodeMap = new Map<string, UiWorkflowNode>();
    for (const n of workflowNodes) nodeMap.set(n.id, n);

    const outEdges = new Map<string, UiWorkflowEdge[]>();
    for (const e of workflowEdges) {
        if (!outEdges.has(e.source)) outEdges.set(e.source, []);
        outEdges.get(e.source)!.push(e);
    }

    const actionIdToLabel = buildActionIdToLabel(forms);
    const sorted = topologicalSort(workflowNodes, workflowEdges);
    const orderedSteps = sorted.map(id => classMap.get(id)!).filter(Boolean);

    // ── Lanes ────────────────────────────────────────────────────────
    const lanes: StatusFlowLane[] = [];
    const laneMap = new Map<string, number>();
    const stepToLane = new Map<string, number>();

    lanes.push({ id: 'lane-requestor', label: 'Creator', subtitle: 'Requestor', roleType: 'requestor' });

    let approverIndex = 0;
    const totalApprovers = orderedSteps.filter(s => s.stepType === 'APPROVAL_STEP').length;

    for (const step of orderedSteps) {
        if (step.stepType === 'REQUESTOR_STEP') { stepToLane.set(step.node.id, 0); continue; }
        const key = step.actorLabel;
        if (!laneMap.has(key)) {
            const isApproval = step.stepType === 'APPROVAL_STEP';
            if (isApproval) approverIndex++;
            lanes.push({
                id: `lane-${lanes.length}`,
                label: step.actorLabel,
                subtitle: isApproval ? `Approver${totalApprovers > 1 ? ` L${approverIndex}` : ''}` : 'Step Owner',
                roleType: isApproval ? 'approver' : 'stepOwner',
                sourceNodeId: step.node.id,
            });
            laneMap.set(key, lanes.length - 1);
        }
        stepToLane.set(step.node.id, laneMap.get(key)!);
    }

    // ── Cards & Transitions ──────────────────────────────────────────
    const phases: StatusFlowPhase[] = [];
    const transitions: StatusFlowTransition[] = [];
    const stepsToShow = orderedSteps.filter(s => s.node.type !== 'endNode');

    const isEndNode = (id: string) => {
        const n = nodeMap.get(id);
        return n?.type === 'endNode' || n?.data?.isEnd;
    };

    // Cross-lane connection: target step ID → exit card ID that should connect to it
    const pendingConnections = new Map<string, string>();
    let col = 0;

    for (const step of stepsToShow) {
        const laneIdx = stepToLane.get(step.node.id) ?? 0;
        const outgoing = outEdges.get(step.node.id) || [];

        // ── Entry card ───────────────────────────────────────────────
        let entryName = 'Draft';
        let entryColor = '#475569';
        if (step.stepType === 'APPROVAL_STEP') { entryName = 'Pending'; entryColor = '#d97706'; }

        const entryId = `card-${step.node.id}-entry`;
        phases.push({
            id: entryId, phaseNumber: col, label: entryName, laneIndex: laneIdx,
            statuses: [makeChip(entryName, entryColor)],
            sourceStepIds: [step.node.id],
        });

        // Cross-lane transition from a previous step's exit
        const fromExitId = pendingConnections.get(step.node.id);
        if (fromExitId) {
            transitions.push({ id: `tr-cross-${fromExitId}-${entryId}`, from: fromExitId, to: entryId, action: '' });
            pendingConnections.delete(step.node.id);
        }

        // ── Exit cards ───────────────────────────────────────────────
        const exitCol = col + 1;
        let hasRcCard = false;

        if (outgoing.length === 0) {
            // No outgoing edges — single exit with default
            const defaults = getDefaultExit(step, forms);
            const exitId = `card-${step.node.id}-exit-0`;
            phases.push({
                id: exitId, phaseNumber: exitCol, label: defaults.exitName, laneIndex: laneIdx,
                statuses: [makeChip(defaults.exitName, defaults.exitColor)],
                sourceStepIds: [step.node.id],
            });
            transitions.push({ id: `tr-${entryId}-${exitId}`, from: entryId, to: exitId, action: defaults.actionLabel });
        } else {
            for (let bi = 0; bi < outgoing.length; bi++) {
                const edge = outgoing[bi];
                const targetsEnd = isEndNode(edge.target);

                // Exit status: use statusConfig when edge has sourceHandle, else default
                let exitName: string, exitColor: string;
                if (edge.sourceHandle && edge.data?.statusConfig?.statusName) {
                    exitName = edge.data.statusConfig.statusName;
                    exitColor = edge.data.statusConfig.statusColor || '#16a34a';
                } else {
                    const defaults = getDefaultExit(step, forms);
                    exitName = defaults.exitName;
                    exitColor = defaults.exitColor;
                }

                const actionLabel = resolveActionLabel(edge, step, forms, actionIdToLabel);
                const exitId = `card-${step.node.id}-exit-${bi}`;
                phases.push({
                    id: exitId, phaseNumber: exitCol, label: exitName, laneIndex: laneIdx,
                    statuses: [makeChip(exitName, exitColor)],
                    sourceStepIds: [step.node.id],
                });
                transitions.push({ id: `tr-${entryId}-${exitId}`, from: entryId, to: exitId, action: actionLabel });

                if (targetsEnd) {
                    // "Request Completed" terminal card
                    hasRcCard = true;
                    const rcId = `card-${step.node.id}-rc-${bi}`;
                    phases.push({
                        id: rcId, phaseNumber: exitCol + 1, label: 'Request Completed', laneIndex: laneIdx,
                        statuses: [makeChip('Request Completed', '#6366f1')],
                        sourceStepIds: [step.node.id],
                    });
                    transitions.push({ id: `tr-${exitId}-${rcId}`, from: exitId, to: rcId, action: '' });
                } else {
                    // Non-END target → register pending cross-lane connection
                    pendingConnections.set(edge.target, exitId);
                }
            }
        }

        // Advance column (extra space if RC cards were added)
        col = exitCol + (hasRcCard ? 2 : 1);
    }

    return { title: '', lanes, phases, transitions };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getDefaultExit(step: ClassifiedStep, forms: UiForm[]) {
    let exitName = 'Completed';
    let exitColor = '#16a34a';
    let actionLabel = '';

    if (step.stepType === 'REQUESTOR_STEP') { exitName = 'Submitted'; exitColor = '#2563eb'; }

    const formActions = getFormActionLabels(step.node, forms);
    if (formActions.length > 0) {
        actionLabel = formActions[0];
    } else {
        if (step.stepType === 'REQUESTOR_STEP') actionLabel = 'Submit';
        else if (step.stepType === 'APPROVAL_STEP') actionLabel = 'Approve';
        else actionLabel = 'Complete';
    }

    return { exitName, exitColor, actionLabel };
}

function resolveActionLabel(
    edge: UiWorkflowEdge,
    step: ClassifiedStep,
    forms: UiForm[],
    actionIdToLabel: Map<string, string>,
): string {
    // 1. From edge sourceHandle → resolved label
    const handle = (edge.sourceHandle as string) || '';
    if (handle) {
        const resolved = actionIdToLabel.get(handle);
        if (resolved) return resolved;
    }

    // 2. From step's form (single action → use it)
    const formActions = getFormActionLabels(step.node, forms);
    if (formActions.length === 1) return formActions[0];

    // 3. Default
    if (step.stepType === 'REQUESTOR_STEP') return 'Submit';
    if (step.stepType === 'APPROVAL_STEP') return 'Approve';
    return 'Complete';
}
