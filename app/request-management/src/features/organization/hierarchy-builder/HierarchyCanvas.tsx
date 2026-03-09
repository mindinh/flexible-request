import { useCallback, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    type Edge,
    type Node,
    type OnConnect,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { hierarchyNodeTypes } from './nodes';
import { EditableHierarchyEdge } from './EditableHierarchyEdge';
import { useHierarchyStore, type HierarchyEdgeData, type HierarchyNodeData } from './useHierarchyStore';

const BRAND_RED = '#b10e10';
const hierarchyEdgeTypes = {
    editableHierarchyEdge: EditableHierarchyEdge,
};

export function HierarchyCanvas() {
    const { screenToFlowPosition } = useReactFlow();
    const store = useHierarchyStore();
    const revision = useHierarchyStore((s) => s.revision);
    const selectedNodeId = useHierarchyStore((s) => s.selectedNodeId);
    const selectedEdgeId = useHierarchyStore((s) => s.selectedEdgeId);

    const decoratedGraph = useMemo(() => {
        const childrenByParent = new Map<string, string[]>();
        store.edges.forEach((edge) => {
            const children = childrenByParent.get(edge.source) || [];
            children.push(edge.target);
            childrenByParent.set(edge.source, children);
        });

        const hiddenNodeIds = new Set<string>();
        const collapsedNodeIds = store.nodes
            .filter((node) => Boolean((node.data as HierarchyNodeData)?.collapsed))
            .map((node) => node.id);

        const markDescendantsHidden = (nodeId: string) => {
            const stack = [...(childrenByParent.get(nodeId) || [])];
            const visited = new Set<string>();

            while (stack.length > 0) {
                const currentId = stack.pop()!;
                if (visited.has(currentId)) continue;
                visited.add(currentId);
                hiddenNodeIds.add(currentId);
                const nextChildren = childrenByParent.get(currentId) || [];
                nextChildren.forEach((childId) => stack.push(childId));
            }
        };

        collapsedNodeIds.forEach(markDescendantsHidden);

        return {
            nodes: store.nodes.map((node) => ({
                ...node,
                hidden: hiddenNodeIds.has(node.id),
            })),
            edges: store.edges.map((edge) => ({
                ...edge,
                hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
            })),
            hiddenNodeIds,
        };
    }, [store.edges, store.nodes]);

    const [nodes, setNodes, onNodesChange] = useNodesState(decoratedGraph.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(decoratedGraph.edges);

    // *** KEY FIX: Subscribe to `revision` to sync ALL store changes to local React Flow state ***
    useEffect(() => {
        setNodes(decoratedGraph.nodes as any);
        setEdges(decoratedGraph.edges as any);
    }, [decoratedGraph.edges, decoratedGraph.nodes, revision, setNodes, setEdges]);

    useEffect(() => {
        if (selectedNodeId && decoratedGraph.hiddenNodeIds.has(selectedNodeId)) {
            store.clearSelection();
            return;
        }

        if (
            selectedEdgeId &&
            decoratedGraph.edges.some((edge) => edge.id === selectedEdgeId && edge.hidden)
        ) {
            store.clearSelection();
        }
    }, [decoratedGraph.edges, decoratedGraph.hiddenNodeIds, selectedEdgeId, selectedNodeId, store]);

    const syncStore = useCallback(
        (newNodes: Node[], newEdges: Edge[]) => {
            store.setNodes(newNodes);
            store.setEdges(newEdges);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const onConnect: OnConnect = useCallback(
        (params) => {
            const newEdge = {
                ...params,
                type: 'editableHierarchyEdge',
                animated: false,
                style: { stroke: BRAND_RED, strokeWidth: 2 },
                data: {
                    relationship: 'Direct Report',
                    accessLevel: 'View Only',
                    effectiveDate: '',
                    offsets: [0, 0, 0],
                } satisfies HierarchyEdgeData,
            };
            const newEdges = addEdge(newEdge, edges);
            setEdges(newEdges);
            syncStore(nodes, newEdges);
        },
        [edges, nodes, setEdges, syncStore]
    );

    const onNodeDragStop = useCallback(() => {
        syncStore(nodes, edges);
    }, [nodes, edges, syncStore]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            store.selectNode(node.id);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const onEdgeClick = useCallback(
        (_: React.MouseEvent, edge: Edge) => {
            store.selectEdge(edge.id);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const onPaneClick = useCallback(() => {
        store.clearSelection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            const rawData = event.dataTransfer.getData('application/hierarchy-node');
            if (!rawData) return;

            let parsed: any;
            try {
                parsed = JSON.parse(rawData);
            } catch {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: Node = {
                id: crypto.randomUUID(),
                type: parsed.entityType === 'USER' ? 'userNode' : 'groupNode',
                position,
                data: {
                    entityType: parsed.entityType,
                    entityId: parsed.entityId || '',
                    label: parsed.label,
                    subtitle: parsed.subtitle,
                    memberCount: 0,
                    groupTypeCode: parsed.groupTypeCode,
                    isNew: true,
                    members: [],
                    description: '',
                },
            };

            // Use store.addNode instead of local state to keep everything in sync
            store.addNode(newNode);
            store.selectNode(newNode.id);
        },
        [screenToFlowPosition, store]
    );

    return (
        <motion.div
            style={{
                height: '100%',
                backgroundColor: 'white',
                overflow: 'hidden',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                onNodeDragStop={onNodeDragStop}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={hierarchyNodeTypes}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                attributionPosition="bottom-left"
                style={{ backgroundColor: '#fafafa' }}
                defaultEdgeOptions={{
                    style: { stroke: BRAND_RED, strokeWidth: 2 },
                    type: 'editableHierarchyEdge',
                    animated: false,
                    data: { offsets: [0, 0, 0] },
                }}
                edgeTypes={hierarchyEdgeTypes}
            >
                <Controls
                    style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                />
                <Background color="#e2e8f0" gap={24} size={1} />
            </ReactFlow>
        </motion.div>
    );
}
