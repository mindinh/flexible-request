import { useCallback, useMemo, useEffect, useRef } from 'react';
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
    ReactFlowProvider,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import dagre from 'dagre';
import { useStudioStore } from './useStudioStore';
import { Button } from '../../components/ui/Button';
import { nodeTypes } from './nodes';

// Map palette nodeType strings to React Flow node type keys
const PALETTE_TO_NODE_TYPE: Record<string, string> = {
    START: 'startNode',
    END: 'endNode',
    ACTION: 'actionNode',
    CONDITION: 'conditionNode',
};

// Dagre layout helper — different sizes per node type
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
    startNode: { width: 160, height: 52 },
    endNode: { width: 140, height: 52 },
    actionNode: { width: 220, height: 60 },
    conditionNode: { width: 180, height: 70 },
    stepNode: { width: 220, height: 60 }, // legacy fallback
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, edgesep: 40 });

    nodes.forEach((node) => {
        const dims = NODE_DIMENSIONS[node.type || 'actionNode'] || NODE_DIMENSIONS.actionNode;
        dagreGraph.setNode(node.id, dims);
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const dims = NODE_DIMENSIONS[node.type || 'actionNode'] || NODE_DIMENSIONS.actionNode;
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - dims.width / 2,
                y: nodeWithPosition.y - dims.height / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

interface WorkflowTabProps {
    onNodeSelect?: (nodeId: string | null) => void;
}

function WorkflowTabContent({ onNodeSelect }: WorkflowTabProps) {
    const { workflow, updateWorkflow, activeStepId } = useStudioStore();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    // Run layout if ANY node is at (0,0)
    const { nodes: autoLayoutedNodes, edges: autoLayoutedEdges } = useMemo(() => {
        const hasUnpositionedNodes = workflow.nodes.some(n => n.position.x === 0 && n.position.y === 0);

        if (workflow.nodes.length > 0 && hasUnpositionedNodes) {
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

    // Handle pane click → deselect
    const onPaneClick = useCallback(() => {
        onNodeSelect?.(null);
    }, [onNodeSelect]);

    // Handle edge deletion
    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            const remainingEdges = edges.filter(
                (e) => !deletedEdges.some((del) => del.id === e.id)
            );
            updateWorkflow(nodes as any, remainingEdges as any);
        },
        [edges, nodes, updateWorkflow]
    );

    // Drag-and-drop from palette
    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            const rawData = event.dataTransfer.getData('application/reactflow');
            if (!rawData) return;

            let parsed: { nodeType: string; label: string; subType?: string };
            try {
                parsed = JSON.parse(rawData);
            } catch {
                return;
            }

            const reactFlowType = PALETTE_TO_NODE_TYPE[parsed.nodeType] || 'actionNode';

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: any = {
                id: crypto.randomUUID(),
                type: reactFlowType,
                position,
                data: {
                    label: parsed.label,
                    isStart: parsed.nodeType === 'START',
                    sla: parsed.nodeType === 'ACTION' ? 3 : undefined,
                    actionSubType: parsed.subType || undefined,
                },
            };

            const newNodes = [...nodes, newNode];
            setNodes(newNodes as any);
            updateWorkflow(newNodes as any, edges as any);
            onNodeSelect?.(newNode.id);
        },
        [nodes, edges, setNodes, updateWorkflow, screenToFlowPosition, onNodeSelect]
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
            ref={reactFlowWrapper}
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
                onPaneClick={onPaneClick}
                onNodeDragStop={onNodeDragStop}
                onEdgesDelete={onEdgesDelete}
                onDrop={onDrop}
                onDragOver={onDragOver}
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

// Wrap in Provider to ensure internal hooks work
export function WorkflowTab(props: WorkflowTabProps) {
    return (
        <ReactFlowProvider>
            <WorkflowTabContent {...props} />
        </ReactFlowProvider>
    );
}
