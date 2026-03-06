import { describe, it, expect } from 'vitest';
import {
    getPredecessorOutputs,
    flattenPredecessorOutputsForPicker,
    syncOutputsFromForm,
    validateInputMappings,
    hasInvalidMappings,
} from './workflowIOHelpers';
import type { UiWorkflowNode, UiWorkflowEdge, UiCanvasItem, UiNodeInput } from './types';

// ─── Test Helpers ─────────────────────────────────────────────────────────

function makeNode(overrides: Partial<UiWorkflowNode> & { id: string }): UiWorkflowNode {
    return {
        position: { x: 0, y: 0 },
        data: { label: overrides.id },
        ...overrides,
    } as UiWorkflowNode;
}

function makeEdge(source: string, target: string): UiWorkflowEdge {
    return { id: `e-${source}-${target}`, source, target };
}

// ═══════════════════════════════════════════════════════════════════════════
// getPredecessorOutputs
// ═══════════════════════════════════════════════════════════════════════════

describe('getPredecessorOutputs', () => {
    it('returns empty array when node has no predecessors', () => {
        const nodes = [makeNode({ id: 'A' }), makeNode({ id: 'B' })];
        const edges: UiWorkflowEdge[] = [];
        const result = getPredecessorOutputs('B', nodes, edges);
        expect(result).toEqual([]);
    });

    it('resolves direct predecessor outputs', () => {
        const nodes = [
            makeNode({
                id: 'A',
                data: {
                    label: 'Start',
                    outputs: [
                        { sourcePath: 'name', type: 'string', derivedFrom: 'formLayout' as const },
                        { sourcePath: 'email', type: 'string', derivedFrom: 'formLayout' as const },
                    ],
                },
            }),
            makeNode({ id: 'B', data: { label: 'Task' } }),
        ];
        const edges = [makeEdge('A', 'B')];

        const result = getPredecessorOutputs('B', nodes, edges);
        expect(result).toHaveLength(1);
        expect(result[0].nodeId).toBe('A');
        expect(result[0].nodeLabel).toBe('Start');
        expect(result[0].outputs).toHaveLength(2);
    });

    it('handles multiple predecessors', () => {
        const nodes = [
            makeNode({ id: 'A', data: { label: 'Step A', outputs: [{ sourcePath: 'a1', type: 'string' }] } }),
            makeNode({ id: 'B', data: { label: 'Step B', outputs: [{ sourcePath: 'b1', type: 'number' }] } }),
            makeNode({ id: 'C', data: { label: 'Merge' } }),
        ];
        const edges = [makeEdge('A', 'C'), makeEdge('B', 'C')];

        const result = getPredecessorOutputs('C', nodes, edges);
        expect(result).toHaveLength(2);
        expect(result.map((g) => g.nodeLabel)).toEqual(['Step A', 'Step B']);
    });

    it('returns empty outputs for predecessor with no outputs defined', () => {
        const nodes = [
            makeNode({ id: 'A', data: { label: 'Step A' } }),
            makeNode({ id: 'B', data: { label: 'Step B' } }),
        ];
        const edges = [makeEdge('A', 'B')];

        const result = getPredecessorOutputs('B', nodes, edges);
        expect(result).toHaveLength(1);
        expect(result[0].outputs).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// flattenPredecessorOutputsForPicker
// ═══════════════════════════════════════════════════════════════════════════

describe('flattenPredecessorOutputsForPicker', () => {
    it('formats fields as NodeLabel.fieldPath', () => {
        const groups = [
            {
                nodeId: 'node-1',
                nodeLabel: 'Start',
                outputs: [
                    { sourcePath: 'name', type: 'string', alias: 'Full Name' },
                    { sourcePath: 'email', type: 'string' },
                ],
            },
        ];

        const result = flattenPredecessorOutputsForPicker(groups);
        expect(result).toHaveLength(2);
        expect(result[0].key).toBe('Start.name');
        expect(result[0].label).toBe('Full Name'); // Uses alias
        expect(result[1].key).toBe('Start.email');
        expect(result[1].label).toBe('email'); // Falls back to sourcePath
    });

    it('returns empty array for empty groups', () => {
        expect(flattenPredecessorOutputsForPicker([])).toEqual([]);
    });

    it('handles multiple groups without collision', () => {
        const groups = [
            { nodeId: '1', nodeLabel: 'Step A', outputs: [{ sourcePath: 'value', type: 'string' }] },
            { nodeId: '2', nodeLabel: 'Step B', outputs: [{ sourcePath: 'value', type: 'number' }] },
        ];

        const result = flattenPredecessorOutputsForPicker(groups);
        expect(result).toHaveLength(2);
        expect(result[0].key).toBe('Step A.value');
        expect(result[1].key).toBe('Step B.value');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// syncOutputsFromForm
// ═══════════════════════════════════════════════════════════════════════════

describe('syncOutputsFromForm', () => {
    it('extracts fields from flat form items', () => {
        const items: UiCanvasItem[] = [
            { id: '1', type: 'text', label: 'Name', key: 'name' } as UiCanvasItem,
            { id: '2', type: 'number', label: 'Age', key: 'age', dataType: 'number' } as UiCanvasItem,
        ];

        const result = syncOutputsFromForm(items);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            sourcePath: 'name',
            alias: 'Name',
            type: 'string',
            derivedFrom: 'formLayout',
        });
        expect(result[1]).toEqual({
            sourcePath: 'age',
            alias: 'Age',
            type: 'number',
            derivedFrom: 'formLayout',
        });
    });

    it('recursively extracts fields from sections', () => {
        const items: UiCanvasItem[] = [
            {
                id: 's1',
                type: 'section',
                label: 'Personal Info',
                fields: [
                    { id: '1', type: 'text', label: 'First Name', key: 'firstName' },
                    { id: '2', type: 'text', label: 'Last Name', key: 'lastName' },
                ],
            } as UiCanvasItem,
        ];

        const result = syncOutputsFromForm(items);
        expect(result).toHaveLength(2);
        expect(result.map((o) => o.sourcePath)).toEqual(['firstName', 'lastName']);
    });

    it('recursively extracts fields from tables', () => {
        const items: UiCanvasItem[] = [
            {
                id: 't1',
                type: 'table',
                label: 'Items',
                columns: [
                    { id: '1', type: 'text', label: 'Item Name', key: 'itemName' },
                    { id: '2', type: 'number', label: 'Quantity', key: 'qty' },
                ],
            } as UiCanvasItem,
        ];

        const result = syncOutputsFromForm(items);
        expect(result).toHaveLength(2);
    });

    it('skips fields without a key', () => {
        const items: UiCanvasItem[] = [
            { id: '1', type: 'text', label: 'Unbound Field' } as UiCanvasItem,
            { id: '2', type: 'text', label: 'Bound', key: 'bound' } as UiCanvasItem,
        ];

        const result = syncOutputsFromForm(items);
        expect(result).toHaveLength(1);
        expect(result[0].sourcePath).toBe('bound');
    });

    it('returns empty array for empty form', () => {
        expect(syncOutputsFromForm([])).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateInputMappings
// ═══════════════════════════════════════════════════════════════════════════

describe('validateInputMappings', () => {
    it('categorizes valid and invalid inputs', () => {
        const inputs: UiNodeInput[] = [
            { sourcePath: 'Start.name', type: 'string' },
            { sourcePath: 'Start.email', type: 'string' },
            { sourcePath: 'Deleted.field', type: 'string' },
        ];
        const available = new Set(['Start.name', 'Start.email']);

        const result = validateInputMappings(inputs, available);
        expect(result.valid).toHaveLength(2);
        expect(result.invalid).toHaveLength(1);
        expect(result.invalid[0].sourcePath).toBe('Deleted.field');
    });

    it('returns all valid when all inputs match', () => {
        const inputs: UiNodeInput[] = [{ sourcePath: 'A.x', type: 'string' }];
        const available = new Set(['A.x']);
        const result = validateInputMappings(inputs, available);
        expect(result.valid).toHaveLength(1);
        expect(result.invalid).toHaveLength(0);
    });

    it('returns all invalid when none match', () => {
        const inputs: UiNodeInput[] = [
            { sourcePath: 'old.field', type: 'string' },
        ];
        const result = validateInputMappings(inputs, new Set());
        expect(result.invalid).toHaveLength(1);
    });

    it('handles empty inputs', () => {
        const result = validateInputMappings([], new Set(['A.x']));
        expect(result.valid).toEqual([]);
        expect(result.invalid).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// hasInvalidMappings
// ═══════════════════════════════════════════════════════════════════════════

describe('hasInvalidMappings', () => {
    it('returns true when any input is invalid', () => {
        const inputs: UiNodeInput[] = [
            { sourcePath: 'A.valid', type: 'string' },
            { sourcePath: 'B.invalid', type: 'string' },
        ];
        expect(hasInvalidMappings(inputs, new Set(['A.valid']))).toBe(true);
    });

    it('returns false when all inputs are valid', () => {
        const inputs: UiNodeInput[] = [
            { sourcePath: 'A.x', type: 'string' },
        ];
        expect(hasInvalidMappings(inputs, new Set(['A.x']))).toBe(false);
    });

    it('returns false for empty inputs', () => {
        expect(hasInvalidMappings([], new Set())).toBe(false);
    });
});
