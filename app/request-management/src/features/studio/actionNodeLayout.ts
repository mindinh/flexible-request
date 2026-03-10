import { Position, type Edge, type Node } from '@xyflow/react';
import dagre from 'dagre';
import type { UiFormAction } from './types';

export type WorkflowLayoutDirection = 'TB' | 'LR';

const START_END_DIMENSIONS = { width: 96, height: 110 };
const ACTION_BASE_DIMENSIONS = { width: 220, height: 60 };
const CONDITION_DIMENSIONS = { width: 170, height: 130 };
const FALLBACK_DIMENSIONS = ACTION_BASE_DIMENSIONS;

const LAYOUT_CONFIG: Record<WorkflowLayoutDirection, { nodesep: number; ranksep: number; edgesep: number }> = {
    TB: { nodesep: 110, ranksep: 130, edgesep: 50 },
    LR: { nodesep: 120, ranksep: 150, edgesep: 50 },
};

function getNodeDimensions(node: Node, outgoingEdges: Edge[]) {
    if (node.type === 'startNode' || node.type === 'endNode') {
        return { ...START_END_DIMENSIONS };
    }

    if (node.type === 'conditionNode') {
        return { ...CONDITION_DIMENSIONS };
    }

    if (node.type === 'actionNode' || node.type === 'stepNode') {
        const formActions = Array.isArray(node.data?.formActions)
            ? (node.data.formActions as UiFormAction[])
            : [];
        const branchHandles = new Set(
            outgoingEdges
                .map((edge) => edge.sourceHandle)
                .filter((handle): handle is string => Boolean(handle))
        );
        const branchCount = Math.max(formActions.length, branchHandles.size);

        return {
            width: ACTION_BASE_DIMENSIONS.width + Math.min(Math.max(branchCount - 1, 0) * 48, 144),
            height: ACTION_BASE_DIMENSIONS.height + (branchCount > 0 ? 54 : 0),
        };
    }

    return { ...FALLBACK_DIMENSIONS };
}

function getBranchBucket(action?: Partial<UiFormAction> | null, handle?: string, label?: string) {
    const token = `${action?.label || ''} ${action?.variant || ''} ${handle || ''} ${label || ''}`.toLowerCase();

    if (
        token.includes('reject') ||
        token.includes('danger') ||
        token.includes('destructive') ||
        token.includes('decline') ||
        token.includes('deny') ||
        token.includes('cancel') ||
        token.includes('false') ||
        token.includes('no')
    ) {
        return 0;
    }

    if (
        token.includes('approve') ||
        token.includes('success') ||
        token.includes('accept') ||
        token.includes('confirm') ||
        token.includes('submit') ||
        token.includes('true') ||
        token.includes('yes')
    ) {
        return 2;
    }

    return 1;
}

function getOutgoingEdgeOrder(edge: Edge, sourceNode?: Node) {
    if (!sourceNode) return Number.MAX_SAFE_INTEGER;

    if (sourceNode.type === 'conditionNode') {
        if (edge.sourceHandle === 'true') return 0;
        if (edge.sourceHandle === 'false') return 2000;
    }

    const formActions = Array.isArray(sourceNode.data?.formActions)
        ? (sourceNode.data.formActions as UiFormAction[])
        : [];
    const action = formActions.find((candidate) => candidate.id === edge.sourceHandle);
    const actionIndex = formActions.findIndex((candidate) => candidate.id === edge.sourceHandle);
    const fallbackIndex = actionIndex === -1 ? formActions.length : actionIndex;
    const bucket = formActions.length > 0
        ? 1
        : getBranchBucket(action, edge.sourceHandle, edge.label?.toString());

    return bucket * 1000 + fallbackIndex;
}

function getLayoutedEdgeOrder(nodes: Node[], edges: Edge[]) {
    const sourceNodeMap = new Map(nodes.map((node) => [node.id, node]));

    return edges
        .map((edge, index) => ({
            edge,
            index,
            order: getOutgoingEdgeOrder(edge, sourceNodeMap.get(edge.source)),
        }))
        .sort((left, right) => {
            if (left.edge.source !== right.edge.source) {
                return left.index - right.index;
            }

            if (left.order === right.order) {
                return left.index - right.index;
            }

            return left.order - right.order;
        })
        .map(({ edge }) => edge);
}

function normalizeLayoutedNodes(nodes: Node[]) {
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));

    return nodes.map((node) => ({
        ...node,
        position: {
            x: node.position.x - minX,
            y: node.position.y - minY,
        },
    }));
}

function withNodeAnchors(nodes: Node[], direction: WorkflowLayoutDirection) {
    return nodes.map((node) => ({
        ...node,
        targetPosition: direction === 'LR' ? Position.Left : Position.Top,
        sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
    }));
}

function getRootedTreeLayout(nodes: Node[], edges: Edge[]) {
    const layoutConfig = LAYOUT_CONFIG.TB;
    const orderedEdges = getLayoutedEdgeOrder(nodes, edges);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const incomingEdgeCount = new Map<string, number>();
    const outgoingEdgeMap = new Map<string, Edge[]>();
    const childrenMap = new Map<string, string[]>();
    const dimensionsMap = new Map<string, { width: number; height: number }>();

    nodes.forEach((node) => incomingEdgeCount.set(node.id, 0));

    orderedEdges.forEach((edge) => {
        incomingEdgeCount.set(edge.target, (incomingEdgeCount.get(edge.target) ?? 0) + 1);
        const outgoingEdges = outgoingEdgeMap.get(edge.source) ?? [];
        outgoingEdges.push(edge);
        outgoingEdgeMap.set(edge.source, outgoingEdges);
    });

    nodes.forEach((node) => {
        dimensionsMap.set(node.id, getNodeDimensions(node, outgoingEdgeMap.get(node.id) ?? []));
        childrenMap.set(
            node.id,
            (outgoingEdgeMap.get(node.id) ?? [])
                .map((edge) => edge.target)
                .filter((target, index, list) => list.indexOf(target) === index)
        );
    });

    if (Array.from(incomingEdgeCount.values()).some((count) => count > 1)) {
        return null;
    }

    const roots = [
        ...nodes
            .filter((node) => node.type === 'startNode' || node.data?.isStart)
            .map((node) => node.id),
        ...nodes
            .filter((node) => (incomingEdgeCount.get(node.id) ?? 0) === 0 && node.type !== 'startNode' && !node.data?.isStart)
            .map((node) => node.id),
    ].filter((nodeId, index, list) => list.indexOf(nodeId) === index);

    if (roots.length === 0) {
        return null;
    }

    const visitState = new Map<string, 'visiting' | 'visited'>();
    const depthMap = new Map<string, number>();
    const maxHeightByDepth = new Map<number, number>();
    let hasCycle = false;

    const visit = (nodeId: string, depth: number) => {
        const state = visitState.get(nodeId);
        if (state === 'visiting') {
            hasCycle = true;
            return;
        }

        if (state === 'visited') {
            return;
        }

        visitState.set(nodeId, 'visiting');
        depthMap.set(nodeId, depth);

        const dimensions = dimensionsMap.get(nodeId)!;
        maxHeightByDepth.set(depth, Math.max(maxHeightByDepth.get(depth) ?? 0, dimensions.height));

        (childrenMap.get(nodeId) ?? []).forEach((childId) => {
            visit(childId, depth + 1);
        });

        visitState.set(nodeId, 'visited');
    };

    roots.forEach((rootId) => visit(rootId, 0));

    if (hasCycle || visitState.size !== nodes.length) {
        return null;
    }

    const subtreeWidthMap = new Map<string, number>();

    const getSubtreeWidth = (nodeId: string): number => {
        const cached = subtreeWidthMap.get(nodeId);
        if (cached !== undefined) return cached;

        const dimensions = dimensionsMap.get(nodeId)!;
        const children = childrenMap.get(nodeId) ?? [];

        if (children.length === 0) {
            subtreeWidthMap.set(nodeId, dimensions.width);
            return dimensions.width;
        }

        const childrenWidth = children.reduce((sum, childId) => sum + getSubtreeWidth(childId), 0)
            + layoutConfig.nodesep * (children.length - 1);
        const subtreeWidth = Math.max(dimensions.width, childrenWidth);

        subtreeWidthMap.set(nodeId, subtreeWidth);
        return subtreeWidth;
    };

    roots.forEach((rootId) => getSubtreeWidth(rootId));

    const yByDepth = new Map<number, number>();
    let currentY = 0;
    let depth = 0;

    while (maxHeightByDepth.has(depth)) {
        yByDepth.set(depth, currentY);
        currentY += (maxHeightByDepth.get(depth) ?? 0) + layoutConfig.ranksep;
        depth += 1;
    }

    const positions = new Map<string, { x: number; y: number }>();

    const placeNode = (nodeId: string, left: number) => {
        const node = nodeMap.get(nodeId)!;
        const dimensions = dimensionsMap.get(nodeId)!;
        const subtreeWidth = subtreeWidthMap.get(nodeId)!;
        const nodeDepth = depthMap.get(nodeId)!;
        const children = childrenMap.get(nodeId) ?? [];

        positions.set(nodeId, {
            x: left + (subtreeWidth - dimensions.width) / 2,
            y: yByDepth.get(nodeDepth) ?? 0,
        });

        if (children.length === 0) {
            return;
        }

        const childrenWidth = children.reduce((sum, childId) => sum + subtreeWidthMap.get(childId)!, 0)
            + layoutConfig.nodesep * (children.length - 1);
        let cursor = left + (subtreeWidth - childrenWidth) / 2;

        children.forEach((childId) => {
            placeNode(childId, cursor);
            cursor += subtreeWidthMap.get(childId)! + layoutConfig.nodesep;
        });
    };

    let cursorX = 0;
    const componentGap = layoutConfig.nodesep * 2;

    roots.forEach((rootId) => {
        placeNode(rootId, cursorX);
        cursorX += subtreeWidthMap.get(rootId)! + componentGap;
    });

    const layoutedNodes = nodes.map((node) => ({
        ...node,
        position: positions.get(node.id)!,
    }));

    return {
        nodes: normalizeLayoutedNodes(withNodeAnchors(layoutedNodes, 'TB')),
        edges,
    };
}

function getDagreLayout(nodes: Node[], edges: Edge[], direction: WorkflowLayoutDirection) {
    const dagreGraph = new dagre.graphlib.Graph();
    const layoutConfig = LAYOUT_CONFIG[direction];
    const outgoingEdgeMap = new Map<string, Edge[]>();

    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: direction,
        align: 'UL',
        ranker: 'tight-tree',
        marginx: 48,
        marginy: 48,
        ...layoutConfig,
    });

    edges.forEach((edge) => {
        const outgoingEdges = outgoingEdgeMap.get(edge.source) ?? [];
        outgoingEdges.push(edge);
        outgoingEdgeMap.set(edge.source, outgoingEdges);
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, getNodeDimensions(node, outgoingEdgeMap.get(node.id) ?? []));
    });

    getLayoutedEdgeOrder(nodes, edges).forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const dagreNode = dagreGraph.node(node.id);
        const dimensions = getNodeDimensions(node, outgoingEdgeMap.get(node.id) ?? []);

        return {
            ...node,
            position: {
                x: dagreNode.x - dimensions.width / 2,
                y: dagreNode.y - dimensions.height / 2,
            },
        };
    });

    return {
        nodes: normalizeLayoutedNodes(withNodeAnchors(layoutedNodes, direction)),
        edges,
    };
}

export function getLayoutedWorkflowElements(
    nodes: Node[],
    edges: Edge[],
    direction: WorkflowLayoutDirection = 'TB'
) {
    if (direction === 'TB') {
        const treeLayout = getRootedTreeLayout(nodes, edges);
        if (treeLayout) {
            return treeLayout;
        }
    }

    return getDagreLayout(nodes, edges, direction);
}
