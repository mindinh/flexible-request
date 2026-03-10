import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { getLayoutedWorkflowElements } from './actionNodeLayout';

function makeNode(overrides: Partial<Node> & { id: string }): Node {
    return {
        id: overrides.id,
        type: 'actionNode',
        position: { x: 0, y: 0 },
        data: { label: overrides.id },
        ...overrides,
    };
}

function makeEdge(
    id: string,
    source: string,
    target: string,
    overrides: Partial<Edge> = {}
): Edge {
    return {
        id,
        source,
        target,
        ...overrides,
    };
}

describe('getLayoutedWorkflowElements', () => {
    it('stacks a simple flow from top to bottom', () => {
        const nodes = [
            makeNode({ id: 'start', type: 'startNode', data: { label: 'Start', isStart: true } }),
            makeNode({ id: 'task', type: 'actionNode', data: { label: 'Task' } }),
            makeNode({ id: 'end', type: 'endNode', data: { label: 'End' } }),
        ];
        const edges = [
            makeEdge('e-start-task', 'start', 'task'),
            makeEdge('e-task-end', 'task', 'end'),
        ];

        const { nodes: layoutedNodes } = getLayoutedWorkflowElements(nodes, edges, 'TB');
        const startNode = layoutedNodes.find((node) => node.id === 'start')!;
        const taskNode = layoutedNodes.find((node) => node.id === 'task')!;
        const endNode = layoutedNodes.find((node) => node.id === 'end')!;

        expect(startNode.position.y).toBeLessThan(taskNode.position.y);
        expect(taskNode.position.y).toBeLessThan(endNode.position.y);
        expect(startNode.targetPosition).toBe('top');
        expect(startNode.sourcePosition).toBe('bottom');
    });

    it('keeps branch children aligned with form action order', () => {
        const nodes = [
            makeNode({ id: 'start', type: 'startNode', data: { label: 'Start', isStart: true } }),
            makeNode({
                id: 'approval',
                type: 'actionNode',
                data: {
                    label: 'Approval',
                    formActions: [
                        { id: 'approve', label: 'Approve', variant: 'success' },
                        { id: 'reject', label: 'Reject', variant: 'danger' },
                    ],
                },
            }),
            makeNode({ id: 'end', type: 'endNode', data: { label: 'End' } }),
            makeNode({ id: 'follow-up', type: 'actionNode', data: { label: 'Follow Up' } }),
        ];
        const edges = [
            makeEdge('e-start-approval', 'start', 'approval'),
            makeEdge('e-approval-end', 'approval', 'end', { sourceHandle: 'reject' }),
            makeEdge('e-approval-follow-up', 'approval', 'follow-up', { sourceHandle: 'approve' }),
        ];

        const { nodes: layoutedNodes } = getLayoutedWorkflowElements(nodes, edges, 'TB');
        const approvalNode = layoutedNodes.find((node) => node.id === 'approval')!;
        const endNode = layoutedNodes.find((node) => node.id === 'end')!;
        const followUpNode = layoutedNodes.find((node) => node.id === 'follow-up')!;

        expect(endNode.position.y).toBeGreaterThan(approvalNode.position.y);
        expect(followUpNode.position.y).toBeGreaterThan(approvalNode.position.y);
        expect(endNode.position.y).toBe(followUpNode.position.y);
        expect(followUpNode.position.x).toBeLessThan(approvalNode.position.x);
        expect(endNode.position.x).toBeGreaterThan(approvalNode.position.x);
    });
});
