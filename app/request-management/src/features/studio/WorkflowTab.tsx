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
import { Wand2, Play, X, ChevronRight, RotateCcw, Info, Database } from 'lucide-react';
import dagre from 'dagre';
import { useStudioStore } from './useStudioStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/Switch';
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
    const {
        workflow,
        updateWorkflow,
        activeStepId,
        isSimulationMode,
        simulationActiveNodeId,
        simulationHistory,
        startSimulation,
        stopSimulation,
        stepSimulation,
        simulationVariables,
        updateSimulationVariable
    } = useStudioStore();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    // Run layout if ALL nodes are at (0,0) — heuristic for "unpositioned workflow"
    const { nodes: autoLayoutedNodes, edges: autoLayoutedEdges } = useMemo(() => {
        const isUnpositioned = workflow.nodes.length > 0 && workflow.nodes.every(n => n.position.x === 0 && n.position.y === 0);

        if (isUnpositioned) {
            return getLayoutedElements(workflow.nodes as unknown as Node[], workflow.edges as unknown as Edge[], 'TB');
        }
        return { nodes: workflow.nodes as unknown as Node[], edges: workflow.edges as unknown as Edge[] };
    }, [workflow.nodes, workflow.edges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(autoLayoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(autoLayoutedEdges);

    // Sync Store updates to Local State and handle selection
    useEffect(() => {
        setNodes(autoLayoutedNodes.map(n => ({
            ...n,
            selected: n.id === activeStepId || (isSimulationMode && n.id === simulationActiveNodeId)
        })));
        setEdges(autoLayoutedEdges);
    }, [autoLayoutedNodes, autoLayoutedEdges, setNodes, setEdges, activeStepId, isSimulationMode, simulationActiveNodeId]);

    const onConnect: OnConnect = useCallback(
        (params) => {
            const newEdges = addEdge(
                {
                    ...params,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: 'var(--brand-red)', strokeWidth: 2 },
                    // Ensure no label is added
                    label: undefined,
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

    // Handle node deletion (via keyboard)
    const onNodesDelete = useCallback(
        (deletedNodes: Node[]) => {
            const deletedNodeIds = new Set(deletedNodes.map((n) => n.id));
            const remainingNodes = nodes.filter((n) => !deletedNodeIds.has(n.id));
            const remainingEdges = edges.filter(
                (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
            );
            updateWorkflow(remainingNodes as any, remainingEdges as any);
            onNodeSelect?.(null);
        },
        [nodes, edges, updateWorkflow, onNodeSelect]
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

    const onRunSimulation = useCallback(() => {
        startSimulation();
    }, [startSimulation]);

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges,
            'TB'
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
                nodes={nodes.map(n => ({
                    ...n,
                    className: isSimulationMode && simulationHistory.includes(n.id) ? 'bg-emerald-50 border-emerald-500' : '',
                    selected: n.selected || (isSimulationMode && n.id === simulationActiveNodeId),
                }))}
                edges={edges.map(e => ({
                    ...e,
                    animated: isSimulationMode ? simulationHistory.includes(e.source) && simulationHistory.includes(e.target) : e.animated,
                    style: isSimulationMode && simulationHistory.includes(e.source) && simulationHistory.includes(e.target)
                        ? { stroke: '#10b981', strokeWidth: 3 }
                        : e.style
                }))}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onNodeDragStop={onNodeDragStop}
                onEdgesDelete={onEdgesDelete}
                onNodesDelete={onNodesDelete}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                attributionPosition="bottom-left"
                style={{ backgroundColor: '#fafafa' }}
                snapToGrid
                snapGrid={[15, 15]}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    style: { stroke: 'var(--brand-red)', strokeWidth: 2 },
                }}
            >
                <Panel position="top-right" className="flex gap-2">
                    {!isSimulationMode && (
                        <>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={onRunSimulation}
                                className="gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                            >
                                <Play size={16} fill="currentColor" />
                                Run Simulation
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onLayout}
                                className="bg-white/80 backdrop-blur-sm"
                            >
                                <Wand2 size={16} className="text-slate-400" />
                            </Button>
                        </>
                    )}
                </Panel>

                {/* Simulation Overlay */}
                {isSimulationMode && (
                    <>
                        <Panel position="top-center" className="mt-4">
                            <Card className="p-2 flex items-center gap-4 bg-white/90 backdrop-blur-md shadow-2xl border-emerald-100 rounded-2xl">
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Simulation Mode</span>
                                </div>

                                <div className="h-4 w-[1px] bg-slate-200" />

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startSimulation()}
                                        className="h-8 gap-1.5 text-slate-500 hover:text-slate-900"
                                        title="Restart Simulation"
                                    >
                                        <RotateCcw size={14} />
                                        Reset
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={stepSimulation}
                                        disabled={!simulationActiveNodeId}
                                        className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 border-none shadow-sm"
                                    >
                                        {simulationActiveNodeId ? 'Next Step' : 'End of Flow'}
                                        <ChevronRight size={14} />
                                    </Button>
                                </div>

                                <div className="h-4 w-[1px] bg-slate-200" />

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={stopSimulation}
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                >
                                    <X size={18} />
                                </Button>
                            </Card>
                        </Panel>

                        {/* Simulation Mock Data Panel */}
                        <Panel position="bottom-left" className="m-4">
                            <Card className="w-64 p-4 space-y-4 bg-white/90 backdrop-blur-md shadow-xl border-slate-100 rounded-2xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Database size={16} className="text-emerald-600" />
                                        <Label className="font-bold text-slate-700">Simulation Data</Label>
                                    </div>
                                    <Info size={14} className="text-slate-300" />
                                </div>

                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {nodes.filter(n => n.type === 'conditionNode').length === 0 ? (
                                        <p className="text-[10px] text-slate-400 italic">Add condition nodes to test complex logic.</p>
                                    ) : (
                                        nodes.filter(n => n.type === 'conditionNode').map(node => (
                                            <div key={node.id} className="p-2 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-semibold text-slate-500 truncate w-32">
                                                        {node.data.label as string}
                                                    </span>
                                                    <Switch
                                                        checked={simulationVariables[node.id] === true}
                                                        onCheckedChange={(val) => updateSimulationVariable(node.id, val)}
                                                        className="scale-75"
                                                    />
                                                </div>
                                                <div className="text-[9px] text-slate-400">
                                                    Branch to: <span className={simulationVariables[node.id] ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                                        {simulationVariables[node.id] ? 'True' : 'False'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-2 bg-emerald-50 rounded-lg text-[10px] text-emerald-700 border border-emerald-100">
                                    Toggle conditions to test different workflow paths.
                                </div>
                            </Card>
                        </Panel>
                    </>
                )}

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
