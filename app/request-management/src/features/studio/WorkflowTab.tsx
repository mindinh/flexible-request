import { useCallback, useMemo, useEffect } from 'react';
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
    useReactFlow,
    ReactFlowProvider,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertCircle, Play, Wand2 } from 'lucide-react';
import dagre from 'dagre';
import { useStudioStore } from './useStudioStore';
import { Button } from '../../components/ui/Button';

// Dagre layout helper
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 220;
    const nodeHeight = 100;

    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, edgesep: 40 });

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

// Custom Step Node Component
function StepNode({ data, selected }: NodeProps) {
    const getStatusIcon = () => {
        switch (data.status) {
            case 'completed':
                return <CheckCircle2 size={18} className="text-green-500" />;
            case 'in-progress':
                return <Clock size={18} className="text-amber-500" />;
            case 'pending':
                return <AlertCircle size={18} className="text-gray-400" />;
            default:
                return <Play size={18} className="text-primary" />;
        }
    };

    const getStatusColor = () => {
        switch (data.status) {
            case 'completed':
                return { bg: '#dcfce7', border: '#22c55e' };
            case 'in-progress':
                return { bg: '#fef3c7', border: '#f59e0b' };
            case 'pending':
                return { bg: '#f8fafc', border: '#e2e8f0' };
            default:
                return { bg: '#fff', border: '#e2e8f0' };
        }
    };

    const colors = getStatusColor();

    return (
        <motion.div
            style={{
                backgroundColor: colors.bg,
                borderColor: selected ? 'var(--brand-red)' : colors.border,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderRadius: '12px',
                padding: '16px 20px',
                minWidth: '200px',
                boxShadow: selected
                    ? '0 10px 25px -5px rgba(177, 14, 16, 0.15)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer',
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: 'var(--brand-red)',
                    border: '2px solid white',
                }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--brand-red-light)', // Assuming you have a light variant or stick to rgba(177, 14, 16, 0.1) if not available
                    // Better to use Tailwind class if possible, but this is inline style.
                    // Let's stick to the color variable if possible or keep rgbal but derivate.
                }}>
                    {getStatusIcon()}
                </div>
                <div>
                    <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: '#1e293b',
                        marginBottom: '2px',
                    }}>
                        {data.label}
                    </div>
                    <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                    }}>
                        {data.role || 'No role assigned'}
                    </div>
                </div>
            </div>

            {data.sla && (
                <div style={{
                    marginTop: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#64748b',
                }}>
                    <Clock size={14} />
                    <span>SLA: {data.sla} {data.sla === 1 ? 'day' : 'days'}</span>
                </div>
            )}

            {data.outcomes && data.outcomes.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {data.outcomes.slice(0, 3).map((outcome: string, i: number) => (
                        <span
                            key={i}
                            style={{
                                padding: '2px 8px',
                                fontSize: '10px',
                                borderRadius: '12px',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontWeight: 500,
                            }}
                        >
                            {outcome}
                        </span>
                    ))}
                </div>
            )}

            <Handle
                type="source"
                position={Position.Right}
                style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: 'var(--brand-red)',
                    border: '2px solid white',
                }}
            />
        </motion.div>
    );
}

const nodeTypes = {
    stepNode: StepNode,
};


interface WorkflowTabProps {
    onNodeSelect?: (nodeId: string | null) => void;
}

function WorkflowTabContent({ onNodeSelect }: WorkflowTabProps) {
    const { workflow, updateWorkflow, activeStepId } = useStudioStore();

    // Determine if we need to run layout
    // Run layout if ANY node is at (0,0) - this handles mixed scenarios where some nodes
    // are loaded from backend (at 0,0) and some are newly added (with explicit positions)
    const { nodes: autoLayoutedNodes, edges: autoLayoutedEdges } = useMemo(() => {
        const hasUnpositionedNodes = workflow.nodes.some(n => n.position.x === 0 && n.position.y === 0);

        if (workflow.nodes.length > 0 && hasUnpositionedNodes) {
            console.log("Running auto-layout due to unpositioned nodes");
            return getLayoutedElements(workflow.nodes as unknown as Node[], workflow.edges as unknown as Edge[], 'LR');
        }
        return { nodes: workflow.nodes as unknown as Node[], edges: workflow.edges as unknown as Edge[] };
    }, [workflow.nodes, workflow.edges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(autoLayoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(autoLayoutedEdges);

    // Sync Store updates to Local State and handle selection
    useEffect(() => {
        setNodes(autoLayoutedNodes.map(n => ({
            ...n,
            selected: n.id === activeStepId
        })));
        setEdges(autoLayoutedEdges);
    }, [autoLayoutedNodes, autoLayoutedEdges, setNodes, setEdges, activeStepId]);

    const onConnect: OnConnect = useCallback(
        (params) => {
            const newEdges = addEdge(
                {
                    ...params,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: 'var(--brand-red)', strokeWidth: 2 },
                },
                edges
            );
            setEdges(newEdges);
            updateWorkflow(nodes as any, newEdges as any);
        },
        [edges, nodes, setEdges, updateWorkflow]
    );

    const onNodeDragStop = useCallback(() => {
        updateWorkflow(nodes as any, edges as any);
    }, [nodes, edges, updateWorkflow]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            onNodeSelect?.(node.id);
        },
        [onNodeSelect]
    );

    // Handle edge deletion (when user presses Delete/Backspace on selected edge)
    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            console.log("Deleting edges:", deletedEdges);
            const remainingEdges = edges.filter(
                (e) => !deletedEdges.some((del) => del.id === e.id)
            );
            updateWorkflow(nodes as any, remainingEdges as any);
        },
        [edges, nodes, updateWorkflow]
    );

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges,
            'LR'
        );
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        updateWorkflow(layoutedNodes as any, layoutedEdges as any);
    }, [nodes, edges, setNodes, setEdges, updateWorkflow]);

    return (
        <motion.div
            style={{
                height: 'calc(100vh - 250px)',
                backgroundColor: 'white',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
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
                onNodeDragStop={onNodeDragStop}
                onEdgesDelete={onEdgesDelete}
                nodeTypes={nodeTypes}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                attributionPosition="bottom-left"
                style={{ backgroundColor: '#fafafa' }}
                defaultEdgeOptions={{
                    style: { stroke: 'var(--brand-red)', strokeWidth: 2 },
                    type: 'smoothstep'
                }}
            >
                <Panel position="top-right">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onLayout}
                    >
                        <Wand2 size={16} className="text-[var(--studio-primary)]" />
                        Auto Layout
                    </Button>
                </Panel>

                <Controls style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }} />
                <Background color="#e2e8f0" gap={24} size={1} />
            </ReactFlow >
        </motion.div >
    );
}

// Wrap in Provider to ensure internal hooks work if used
export function WorkflowTab(props: WorkflowTabProps) {
    return (
        <ReactFlowProvider>
            <WorkflowTabContent {...props} />
        </ReactFlowProvider>
    );
}
