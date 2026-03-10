import { describe, expect, it } from 'vitest';
import type { UiWorkflowEdge, UiWorkflowNode } from './types';
import {
    alignRequesterFormWithStart,
    collectRequesterFormUiState,
    REQUESTER_REQUEST_FORM_SUBTYPE,
    getRequesterRequestFormNode,
    syncRequesterRequestFormNode,
} from './requestFormNode';

function makeNode(overrides: Partial<UiWorkflowNode> & { id: string }): UiWorkflowNode {
    return {
        id: overrides.id,
        type: 'actionNode',
        position: { x: 0, y: 0 },
        data: { label: overrides.id },
        ...overrides,
    } as UiWorkflowNode;
}

function makeEdge(source: string, target: string): UiWorkflowEdge {
    return {
        id: `e-${source}-${target}`,
        source,
        target,
    };
}

describe('syncRequesterRequestFormNode', () => {
    it('creates and wires a requester request form after start for form submission', () => {
        const nodes = [
            makeNode({
                id: 'start',
                type: 'startNode',
                data: { label: 'Start', isStart: true, triggerType: 'FORM_SUB', formId: 'form-1' },
            }),
            makeNode({
                id: 'approve-step',
                type: 'actionNode',
                data: { label: 'Approve', actionSubType: 'user_task' },
            }),
        ];
        const edges = [makeEdge('start', 'approve-step')];

        const synced = syncRequesterRequestFormNode(nodes, edges);
        const requesterNode = getRequesterRequestFormNode(synced.nodes, 'start');

        expect(requesterNode).toBeTruthy();
        expect(requesterNode?.data.actionSubType).toBe(REQUESTER_REQUEST_FORM_SUBTYPE);
        expect(requesterNode?.data.formId).toBe('form-1');
        expect(requesterNode?.position).toEqual({ x: -70, y: 180 });
        expect(synced.nodes.find((node) => node.id === 'start')?.data.formId).toBeUndefined();
        expect(synced.edges.some((edge) => edge.source === 'start' && edge.target === requesterNode?.id)).toBe(true);
        expect(synced.edges.some((edge) => edge.source === requesterNode?.id && edge.target === 'approve-step')).toBe(true);
        expect(synced.edges.find((edge) => edge.source === 'start' && edge.target === requesterNode?.id)?.data?.offsets).toEqual([0, 0, 0]);
    });

    it('removes requester request form and rewires edges when trigger changes to api trigger', () => {
        const requesterNodeId = 'requester-form-start';
        const nodes = [
            makeNode({
                id: 'start',
                type: 'startNode',
                data: { label: 'Start', isStart: true, triggerType: 'API_TRIGGER' },
            }),
            makeNode({
                id: requesterNodeId,
                type: 'actionNode',
                data: {
                    label: 'Requester: Request Form',
                    actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
                    requesterEntryFor: 'start',
                },
            }),
            makeNode({
                id: 'approve-step',
                type: 'actionNode',
                data: { label: 'Approve', actionSubType: 'user_task' },
            }),
        ];
        const edges = [
            makeEdge('start', requesterNodeId),
            makeEdge(requesterNodeId, 'approve-step'),
        ];

        const synced = syncRequesterRequestFormNode(nodes, edges);

        expect(getRequesterRequestFormNode(synced.nodes, 'start')).toBeNull();
        expect(synced.edges.some((edge) => edge.source === 'start' && edge.target === 'approve-step')).toBe(true);
    });

    it('restores requester bridge offsets from ui state', () => {
        const nodes = [
            makeNode({
                id: 'start',
                type: 'startNode',
                position: { x: 100, y: 0 },
                data: { label: 'Start', isStart: true, triggerType: 'FORM_SUB' },
            }),
        ];

        const synced = syncRequesterRequestFormNode(nodes, [], {
            start: {
                position: { x: 160, y: 180 },
                edgeOffsets: [40, 12, 24],
            },
        });
        const requesterNode = getRequesterRequestFormNode(synced.nodes, 'start')!;
        const requesterEdge = synced.edges.find((edge) => edge.source === 'start' && edge.target === requesterNode.id)!;

        expect(requesterNode.position).toEqual({ x: 30, y: 180 });
        expect(requesterEdge.data?.offsets).toEqual([40, 12, 24]);
    });

    it('preserves a manually adjusted requester bridge after generation', () => {
        const nodes = [
            makeNode({
                id: 'start',
                type: 'startNode',
                position: { x: 100, y: 0 },
                data: { label: 'Start', isStart: true, triggerType: 'FORM_SUB' },
            }),
            makeNode({
                id: 'requester',
                type: 'actionNode',
                position: { x: 108, y: 180 },
                data: {
                    label: 'Requester: Request Form',
                    actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
                    requesterEntryFor: 'start',
                },
            }),
        ];
        const edges = [
            {
                ...makeEdge('start', 'requester'),
                data: { offsets: [35, 20, 18], isRequesterBridge: true },
            },
        ];

        const synced = syncRequesterRequestFormNode(nodes, edges);
        const requesterEdge = synced.edges.find((edge) => edge.source === 'start' && edge.target === 'requester')!;

        expect(requesterEdge.data?.offsets).toEqual([35, 20, 18]);
        expect(collectRequesterFormUiState(synced.nodes, synced.edges).start.edgeOffsets).toEqual([35, 20, 18]);
    });

    it('preserves incoming edges to requester form because it is a real workflow node', () => {
        const nodes = [
            makeNode({
                id: 'start',
                type: 'startNode',
                data: { label: 'Start', isStart: true, triggerType: 'FORM_SUB' },
            }),
            makeNode({
                id: 'review',
                type: 'actionNode',
                data: { label: 'Review', actionSubType: 'user_task' },
            }),
            makeNode({
                id: 'requester',
                type: 'actionNode',
                data: {
                    label: 'Requester: Request Form',
                    actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
                    requesterEntryFor: 'start',
                    formId: 'request-form-1',
                },
            }),
        ];
        const edges = [
            makeEdge('start', 'requester'),
            makeEdge('requester', 'review'),
            makeEdge('review', 'requester'),
        ];

        const synced = syncRequesterRequestFormNode(nodes, edges);

        expect(synced.edges.some((edge) => edge.source === 'review' && edge.target === 'requester')).toBe(true);
    });

    it('keeps requester form centered under start when aligning nodes', () => {
        const aligned = alignRequesterFormWithStart([
            makeNode({
                id: 'start',
                type: 'startNode',
                position: { x: 220, y: 0 },
                data: { label: 'Start', isStart: true, triggerType: 'FORM_SUB' },
            }),
            makeNode({
                id: 'requester',
                type: 'actionNode',
                position: { x: 340, y: 180 },
                data: {
                    label: 'Requester: Request Form',
                    actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
                    requesterEntryFor: 'start',
                },
            }),
        ]);

        expect(aligned.find((node) => node.id === 'requester')?.position.x).toBe(150);
        expect(aligned.find((node) => node.id === 'requester')?.position.y).toBe(180);
    });

    it('aligns using rendered node widths so the bridge stays visually straight', () => {
        const aligned = alignRequesterFormWithStart([
            makeNode({
                id: 'start',
                type: 'startNode',
                position: { x: 300, y: 0 },
                width: 80,
                data: { label: 'Start', isStart: true, triggerType: 'FORM_SUB' },
            }),
            makeNode({
                id: 'requester',
                type: 'actionNode',
                position: { x: 420, y: 180 },
                width: 220,
                data: {
                    label: 'Requester: Request Form',
                    actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
                    requesterEntryFor: 'start',
                },
            }),
        ]);

        expect(aligned.find((node) => node.id === 'requester')?.position.x).toBe(230);
    });
});
