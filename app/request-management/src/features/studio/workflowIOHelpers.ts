/**
 * Pure helper functions for Workflow I/O mapping logic.
 * These are stateless and have no store dependencies — designed for easy testing.
 */
import type {
    UiWorkflowNode,
    UiWorkflowEdge,
    UiNodeInput,
    UiNodeOutput,
    UiCanvasItem,
} from './types';

// ─── Types ────────────────────────────────────────────────────────────────

/** A predecessor node and its outputs, for the Input picker */
export interface PredecessorOutputGroup {
    nodeId: string;
    nodeLabel: string;
    outputs: UiNodeOutput[];
}

/** A single pickable field for the Input picker */
export interface PickableInputField {
    /** Fully qualified key: "NodeLabel.fieldPath" */
    key: string;
    /** Human-readable label */
    label: string;
    /** Data type for display */
    type: string;
    /** The node that produces this output */
    sourceNodeId: string;
    /** The original output sourcePath (without node prefix) */
    rawPath: string;
}

/** Validation result for input mappings */
export interface InputValidationResult {
    valid: UiNodeInput[];
    invalid: UiNodeInput[];
}

// ─── Predecessor Resolution ───────────────────────────────────────────────

/**
 * Walk the workflow graph to find all direct predecessor nodes of a given node
 * and collect their outputs.
 */
export function getPredecessorOutputs(
    nodeId: string,
    nodes: UiWorkflowNode[],
    edges: UiWorkflowEdge[]
): PredecessorOutputGroup[] {
    // Find edges where target === nodeId → source is a predecessor
    const predecessorIds = edges
        .filter((e) => e.target === nodeId)
        .map((e) => e.source);

    const groups: PredecessorOutputGroup[] = [];

    for (const predId of predecessorIds) {
        const predNode = nodes.find((n) => n.id === predId);
        if (!predNode) continue;

        const outputs = (predNode.data.outputs as UiNodeOutput[] | undefined) ?? [];

        groups.push({
            nodeId: predId,
            nodeLabel: (predNode.data.label as string) || 'Untitled',
            outputs,
        });
    }

    return groups;
}

/**
 * Flatten predecessor output groups into a flat list suitable for the Input field picker.
 * Each field is keyed as "NodeLabel.fieldPath" to avoid collisions across nodes.
 */
export function flattenPredecessorOutputsForPicker(
    groups: PredecessorOutputGroup[]
): PickableInputField[] {
    const result: PickableInputField[] = [];

    for (const group of groups) {
        for (const output of group.outputs) {
            result.push({
                key: `${group.nodeLabel}.${output.sourcePath}`,
                label: output.alias || output.sourcePath,
                type: output.type || 'string',
                sourceNodeId: group.nodeId,
                rawPath: output.sourcePath,
            });
        }
    }

    return result;
}

// ─── Form Output Sync ─────────────────────────────────────────────────────

// Field types that are purely structural / non-data-carrying
const LAYOUT_ONLY_TYPES = new Set(['header', 'divider', 'spacer', 'paragraph', 'staticText']);

/**
 * Derive output mappings from a form's canvas items.
 * Collects ALL data-carrying fields (not just those with a `key`).
 * Fields with `bindTo` are tagged so downstream nodes know they map to the global schema.
 * Pure function — no store dependency.
 */
export function syncOutputsFromForm(items: UiCanvasItem[]): UiNodeOutput[] {
    const result: UiNodeOutput[] = [];

    for (const item of items) {
        if (item.type === 'section' && 'fields' in item) {
            result.push(...syncOutputsFromForm(item.fields as unknown as UiCanvasItem[]));
        } else if (item.type === 'table' && 'columns' in item) {
            const columns = (item as UiCanvasItem & { columns: UiCanvasItem[] }).columns;
            result.push(...syncOutputsFromForm(columns));
        } else if (!LAYOUT_ONLY_TYPES.has(item.type)) {
            // Include ALL data-carrying fields as outputs (bound or unbound)
            const field = item as UiCanvasItem & { key?: string; dataType?: string; bindTo?: string };
            const sourcePath = field.key || item.id;
            result.push({
                sourcePath,
                alias: item.label || undefined,
                type: field.dataType || 'string',
                derivedFrom: 'formLayout',
                ...(field.bindTo ? { bindTo: field.bindTo } : {}),
            });
        }
    }

    return result;
}

// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate input mappings against available predecessor output keys.
 * Returns lists of valid and invalid inputs.
 */
export function validateInputMappings(
    inputs: UiNodeInput[],
    availablePredecessorOutputKeys: Set<string>
): InputValidationResult {
    const valid: UiNodeInput[] = [];
    const invalid: UiNodeInput[] = [];

    for (const input of inputs) {
        if (availablePredecessorOutputKeys.has(input.sourcePath)) {
            valid.push(input);
        } else {
            invalid.push(input);
        }
    }

    return { valid, invalid };
}

/**
 * Check if a node has any invalid I/O mappings.
 * Useful for save-blocking logic.
 */
export function hasInvalidMappings(
    inputs: UiNodeInput[],
    validInputKeys: Set<string>
): boolean {
    return inputs.some((i) => !validInputKeys.has(i.sourcePath));
}
