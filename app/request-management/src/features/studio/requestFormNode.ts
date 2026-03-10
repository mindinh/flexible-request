import type { UiWorkflowEdge, UiWorkflowNode } from './types';

export const REQUESTER_REQUEST_FORM_SUBTYPE = 'requester_form';
const START_NODE_WIDTH = 80;
const REQUESTER_FORM_WIDTH = 220;

export interface RequesterFormUiState {
    position?: { x: number; y: number };
    edgeOffsets?: number[];
}

function makeEdgeKey(edge: UiWorkflowEdge) {
    return `${edge.source}|${edge.target}|${edge.sourceHandle || ''}|${edge.targetHandle || ''}|${edge.label || ''}`;
}

function getNodeWidth(node: UiWorkflowNode, fallback: number) {
    if (typeof node.width === 'number') {
        return node.width;
    }

    const measuredWidth = (node.measured as { width?: number } | undefined)?.width;
    if (typeof measuredWidth === 'number') {
        return measuredWidth;
    }

    return fallback;
}

function getNodeCenterX(node: UiWorkflowNode, fallbackWidth: number) {
    return node.position.x + getNodeWidth(node, fallbackWidth) / 2;
}

function getAlignedRequesterX(startNode: UiWorkflowNode, requesterNode?: UiWorkflowNode) {
    const startCenterX = getNodeCenterX(startNode, START_NODE_WIDTH);
    const requesterWidth = requesterNode
        ? getNodeWidth(requesterNode, REQUESTER_FORM_WIDTH)
        : REQUESTER_FORM_WIDTH;
    return startCenterX - requesterWidth / 2;
}

export function isRequesterRequestFormNode(node: UiWorkflowNode) {
    return node.type === 'actionNode' && node.data?.actionSubType === REQUESTER_REQUEST_FORM_SUBTYPE;
}

export function getRequesterRequestFormNode(nodes: UiWorkflowNode[], startNodeId?: string | null) {
    return nodes.find((node) =>
        isRequesterRequestFormNode(node) &&
        (!startNodeId || node.data?.requesterEntryFor === startNodeId)
    ) || null;
}

export function alignRequesterFormWithStart(nodes: UiWorkflowNode[]): UiWorkflowNode[] {
    const startNode = nodes.find((node) => node.type === 'startNode' || node.data?.isStart);
    if (!startNode) {
        return nodes;
    }

    const requesterNode = getRequesterRequestFormNode(nodes, startNode.id);
    if (!requesterNode) {
        return nodes;
    }

    const alignedRequesterX = getAlignedRequesterX(startNode, requesterNode);
    if (Math.abs(requesterNode.position.x - alignedRequesterX) <= 0.5) {
        return nodes;
    }

    return nodes.map((node) => (
        node.id === requesterNode.id
            ? {
                ...node,
                position: {
                    ...node.position,
                    x: alignedRequesterX,
                },
            }
            : node
    ));
}

export function syncRequesterRequestFormNode(
    nodes: UiWorkflowNode[],
    edges: UiWorkflowEdge[],
    uiState: Record<string, RequesterFormUiState> = {}
): { nodes: UiWorkflowNode[]; edges: UiWorkflowEdge[] } {
    const startNode = nodes.find((node) => node.type === 'startNode' || node.data?.isStart);
    if (!startNode) {
        return {
            nodes: nodes.filter(n => !isRequesterRequestFormNode(n)),
            edges: edges.filter(e => !(e.data as any)?.isRequesterBridge)
        };
    }

    const triggerType = (startNode.data?.triggerType as string) || 'FORM_SUB';
    const requesterNode = getRequesterRequestFormNode(nodes, startNode.id);
    const otherRequesterNodes = nodes.filter(
        (node) => isRequesterRequestFormNode(node) && node.id !== requesterNode?.id
    );

    if (triggerType !== 'FORM_SUB') {
        if (!requesterNode && otherRequesterNodes.length === 0) {
            return { nodes, edges };
        }

        const requesterIds = new Set([
            ...(requesterNode ? [requesterNode.id] : []),
            ...otherRequesterNodes.map((node) => node.id),
        ]);

        const rewiredEdges = [
            ...edges
                .filter((edge) => requesterNode && edge.source === requesterNode.id)
                .map((edge) => ({ ...edge, source: startNode.id })),
            ...edges.filter((edge) => !requesterIds.has(edge.source) && !requesterIds.has(edge.target)),
        ];

        const seen = new Set<string>();
        const dedupedEdges = rewiredEdges.filter((edge) => {
            const key = makeEdgeKey(edge);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return {
            nodes: nodes.filter((node) => !requesterIds.has(node.id)),
            edges: dedupedEdges,
        };
    }

    const sharedFormId = (requesterNode?.data?.formId as string | undefined)
        || (startNode.data?.formId as string | undefined);
    const requesterUiState = uiState[startNode.id];

    const normalizedRequesterNode: UiWorkflowNode = requesterNode || {
        id: crypto.randomUUID(),
        type: 'actionNode',
        position: {
            x: getAlignedRequesterX(startNode),
            y: requesterUiState?.position?.y ?? startNode.position.y + 180,
        },
        data: {
            label: 'Requester: Request Form',
            actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
            requesterEntryFor: startNode.id,
            taskType: 'dataEntry' as const,
            formId: sharedFormId,
        },
    };

    const normalizedNodes = nodes
        .filter((node) => !otherRequesterNodes.some((extra) => extra.id === node.id))
        .map((node) => {
            if (node.id === startNode.id) {
                const nextData = { ...node.data };
                if (triggerType === 'FORM_SUB') {
                    delete nextData.formId;
                } else {
                    nextData.formId = sharedFormId;
                }

                return {
                    ...node,
                    data: nextData,
                };
            }

            if (node.id === normalizedRequesterNode.id) {
                return {
                    ...normalizedRequesterNode,
                    data: {
                        ...normalizedRequesterNode.data,
                        label: 'Requester: Request Form',
                        actionSubType: REQUESTER_REQUEST_FORM_SUBTYPE,
                        requesterEntryFor: startNode.id,
                        taskType: 'dataEntry' as const,
                        formId: sharedFormId,
                    },
                };
            }

            return node;
        });

    const normalizedEdges = edges.map((edge) => {
        if (edge.source === startNode.id && edge.target !== normalizedRequesterNode.id) {
            return {
                ...edge,
                source: normalizedRequesterNode.id,
            };
        }

        if (edge.target === startNode.id && edge.source !== normalizedRequesterNode.id) {
            return {
                ...edge,
                target: normalizedRequesterNode.id,
            };
        }

        if (edge.source === startNode.id && edge.target === normalizedRequesterNode.id) {
            return {
                ...edge,
                data: {
                    ...edge.data,
                    offsets: (edge.data as any)?.offsets || requesterUiState?.edgeOffsets || [0, 0, 0],
                    isRequesterBridge: true,
                },
            };
        }

        return edge;
    });

    if (!normalizedEdges.some((edge) => edge.source === startNode.id && edge.target === normalizedRequesterNode.id)) {
        normalizedEdges.unshift({
            id: `e-${startNode.id}-${normalizedRequesterNode.id}`,
            source: startNode.id,
            target: normalizedRequesterNode.id,
            type: 'editableEdge',
            data: {
                offsets: requesterUiState?.edgeOffsets || [0, 0, 0],
                isRequesterBridge: true,
            },
        });
    }

    const resultNodes = normalizedNodes.some((node) => node.id === normalizedRequesterNode.id)
        ? normalizedNodes
        : [...normalizedNodes, normalizedRequesterNode];

    const alignedNodes = alignRequesterFormWithStart(resultNodes);

    const seen = new Set<string>();
    const dedupedEdges = normalizedEdges.filter((edge) => {
        const key = makeEdgeKey(edge);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return {
        nodes: alignedNodes,
        edges: dedupedEdges,
    };
}

export function collectRequesterFormUiState(
    nodes: UiWorkflowNode[],
    edges: UiWorkflowEdge[]
): Record<string, RequesterFormUiState> {
    const startNode = nodes.find((node) => node.type === 'startNode' || node.data?.isStart);
    if (!startNode) {
        return {};
    }

    const requesterNode = getRequesterRequestFormNode(nodes, startNode.id);
    if (!requesterNode) {
        return {};
    }

    const requesterEdge = edges.find((edge) => edge.source === startNode.id && edge.target === requesterNode.id);

    return {
        [startNode.id]: {
            position: { ...requesterNode.position },
            edgeOffsets: ((requesterEdge?.data as any)?.offsets as number[]) || [0, 0, 0],
        },
    };
}
