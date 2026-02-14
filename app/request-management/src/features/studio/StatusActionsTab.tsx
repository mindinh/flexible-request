import { useCallback, useMemo, useState, useEffect } from 'react';
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
    Handle,
    Position,
    type NodeProps,
    type NodeChange,
    type EdgeChange,
    applyNodeChanges,
    applyEdgeChanges,
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    type EdgeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CircleDot, Plus, ChevronDown, ChevronRight, Info, Zap, Square, Layout } from 'lucide-react';
import dagre from 'dagre';
import { useStudioStore } from './useStudioStore';
import { Button } from '../../components/ui/Button';
import type { UiStatusNode, UiStatusEdge } from './types';

// Dagre layout helper
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const nodeWidth = 140;
    const nodeHeight = 50;

    dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120, edgesep: 50 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

// Status Node - RECTANGULAR with filled background
function StatusNode({ data, selected }: NodeProps) {
    return (
        <motion.div
            style={{
                padding: '12px 20px',
                minWidth: '120px',
                textAlign: 'center',
                borderRadius: '10px',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: selected ? 'var(--brand-red)' : (data.borderColor as string || '#e2e8f0'),
                backgroundColor: data.color as string || '#ffffff',
                boxShadow: selected
                    ? '0 8px 24px rgba(177, 14, 16, 0.25)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer',
            }}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)' }}
        >
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: data.dotColor as string || '#64748b',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Square size={14} style={{ color: data.dotColor as string || '#1e293b', fill: data.dotColor as string || '#1e293b' }} />
                <span style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: data.textColor as string || '#1e293b',
                }}>
                    {data.label as string}
                </span>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: data.dotColor as string || '#64748b',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
            />
        </motion.div>
    );
}

// Custom Action Edge - Pill Shape on Edge
function CustomActionEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    label,
    selected
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: 'white',
                        border: `1px dashed ${selected ? 'var(--brand-red)' : '#94a3b8'}`,
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: selected ? 'var(--brand-red)' : '#475569',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                    }}>
                        <Zap size={10} style={{ fill: selected ? 'var(--brand-red)' : '#475569', opacity: 0.8 }} />
                        {label || 'Action'}
                    </div>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}

const nodeTypes = {
    statusNode: StatusNode,
};

const edgeTypes = {
    custom: CustomActionEdge
};

export function StatusActionsTab() {
    const { statusNetwork, updateStatusNetwork } = useStudioStore();
    const [showInfo, setShowInfo] = useState(false);

    // Local state for ReactFlow
    const [nodes, setNodes] = useNodesState([]);
    const [edges, setEdges] = useEdgesState([]);

    // Initialize from Store
    useEffect(() => {
        // Only if we have nodes (and local is empty, or forced sync?)
        // Let's force sync on load or when store changes significantly.
        if (statusNetwork.nodes.length > 0) {
            // Check if we need layout
            const hasPositions = statusNetwork.nodes.some(n => n.position.x !== 0 || n.position.y !== 0);

            let initialNodes = statusNetwork.nodes as Node[];
            let initialEdges = statusNetwork.edges as Edge[];

            if (!hasPositions) {
                const layouted = getLayoutedElements(initialNodes, initialEdges);
                initialNodes = layouted.nodes;
                initialEdges = layouted.edges;
            }

            // Ensure edges are type 'custom'
            initialEdges = initialEdges.map(e => ({ ...e, type: 'custom', animated: true }));

            setNodes(initialNodes);
            setEdges(initialEdges);
        }
    }, [statusNetwork, setNodes, setEdges]);


    // Handlers
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((nds) => {
                const newNodes = applyNodeChanges(changes, nds);
                return newNodes;
            });
            // We defer store update to DragStop or similar to avoid thrashing
        },
        [setNodes]
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((eds) => {
                const newEdges = applyEdgeChanges(changes, eds);
                // If edge deleted, update store immediately?
                const hasDeletion = changes.some(c => c.type === 'remove');
                if (hasDeletion) {
                    // Calculate new full state and update store
                    // Need to wait for state update? or use newEdges directly
                    // updateStatusNetwork(nodes as UiStatusNode[], newEdges as UiStatusEdge[]);
                    // But `nodes` from closure might be stale. 
                }
                return newEdges;
            });
        },
        [setEdges]
    );

    // Manual sync helper
    const syncToStore = useCallback(() => {
        updateStatusNetwork(nodes as UiStatusNode[], edges as UiStatusEdge[]);
    }, [nodes, edges, updateStatusNetwork]);

    // Update store on Node Drag Stop
    const onNodeDragStop = useCallback(() => {
        syncToStore();
    }, [syncToStore]);

    const onConnect: OnConnect = useCallback(
        (params) => {
            setEdges((eds) => {
                const newEdges = addEdge(
                    {
                        ...params,
                        type: 'custom',
                        animated: true,
                        label: 'Action',
                        style: { stroke: 'var(--brand-red)', strokeWidth: 2 },
                        data: { action: 'Action' }
                    },
                    eds
                );
                // Update store (we need nodes access here, which is captured from closure)
                // This might be stale if nodes changed? But we depend on 'nodes' in dependency array
                updateStatusNetwork(nodes as UiStatusNode[], newEdges as UiStatusEdge[]);
                return newEdges;
            });
        },
        [setEdges, nodes, updateStatusNetwork]
    );

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges,
            'LR'
        );
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        updateStatusNetwork(layoutedNodes as UiStatusNode[], layoutedEdges as UiStatusEdge[]);
    }, [nodes, edges, setNodes, setEdges, updateStatusNetwork]);

    const addStatus = () => {
        const id = `status-${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'statusNode',
            position: { x: 100, y: 100 },
            data: { label: 'New Status', color: '#f1f5f9' }
        };
        const newNodes = [...nodes, newNode];
        setNodes(newNodes);
        updateStatusNetwork(newNodes as UiStatusNode[], edges as UiStatusEdge[]);
    };

    return (
        <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px' }}>
            {/* Toolbar */}
            <motion.div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        backgroundColor: '#dbeafe',
                        border: '2px solid #3b82f6',
                    }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Status</span>
                </div>

                <div style={{ flex: 1 }} />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLayout}
                >
                    <Layout size={14} /> Auto Layout
                </Button>

                {/* Info toggle */}
                <Button
                    variant={showInfo ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowInfo(!showInfo)}
                >
                    <Info size={14} />
                    Help
                    {showInfo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={addStatus}
                >
                    <Plus size={14} /> Add Status
                </Button>
            </motion.div>

            {/* Collapsible Info Panel */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        style={{
                            padding: '14px 18px',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '10px',
                            border: '1px solid #bae6fd',
                        }}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <CircleDot size={18} style={{ color: '#0284c7', marginTop: '2px' }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: '#0c4a6e' }}>Status Derivation Logic</div>
                                <div style={{ fontSize: '13px', color: '#0369a1', marginTop: '6px', lineHeight: 1.5 }}>
                                    <div>• Any step <strong>In Progress</strong> → Request is <strong>In Progress</strong></div>
                                    <div>• All steps <strong>Approved</strong> → Request is <strong>Completed</strong></div>
                                    <div>• Any step <strong>Rejected</strong> → Request is <strong>Rejected</strong></div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Flow Editor */}
            <motion.div
                style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    attributionPosition="bottom-left"
                    style={{ backgroundColor: '#fafafa' }}
                >
                    <Controls style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }} />
                    <Background color="#e2e8f0" gap={24} size={1} />
                </ReactFlow>
            </motion.div>
        </div>
    );
}
