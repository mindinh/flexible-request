import { useCallback, useEffect } from 'react';
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
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import dagre from 'dagre';
import { Button } from '../../../components/ui/Button';
import { hierarchyNodeTypes } from './nodes';
import { useHierarchyStore, type HierarchyEdgeData } from './useHierarchyStore';

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
    userNode: { width: 200, height: 75 },
    groupNode: { width: 220, height: 110 },
};

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, edgesep: 40 });

    nodes.forEach((node) => {
        const dims = NODE_DIMENSIONS[node.type || 'userNode'] || NODE_DIMENSIONS.userNode;
        dagreGraph.setNode(node.id, dims);
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    return {
        nodes: nodes.map((node) => {
            const pos = dagreGraph.node(node.id);
            const dims = NODE_DIMENSIONS[node.type || 'userNode'] || NODE_DIMENSIONS.userNode;
            return {
                ...node,
                position: { x: pos.x - dims.width / 2, y: pos.y - dims.height / 2 },
            };
        }),
        edges,
    };
}

export function HierarchyCanvas() {
    const { screenToFlowPosition } = useReactFlow();
    const store = useHierarchyStore();
    const revision = useHierarchyStore((s) => s.revision);

    const [nodes, setNodes, onNodesChange] = useNodesState(store.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(store.edges);

    // *** KEY FIX: Subscribe to `revision` to sync ALL store changes to local React Flow state ***
    useEffect(() => {
        const state = useHierarchyStore.getState();
        setNodes(state.nodes as any);
        setEdges(state.edges as any);
    }, [revision, setNodes, setEdges]);

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
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#8b5cf6', strokeWidth: 2 },
                data: {
                    relationship: 'Direct Report',
                    accessLevel: 'View Only',
                    effectiveDate: '',
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

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges,
            'TB'
        );
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        syncStore(layoutedNodes, layoutedEdges);
    }, [nodes, edges, setNodes, setEdges, syncStore]);

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
                    style: { stroke: '#8b5cf6', strokeWidth: 2 },
                    type: 'smoothstep',
                    animated: true,
                }}
            >
                <Panel position="top-right">
                    <Button variant="outline" size="sm" onClick={onLayout}>
                        <Wand2 size={16} className="text-violet-500" />
                        Auto Layout
                    </Button>
                </Panel>

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
