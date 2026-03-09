import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
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
import { Wand2, Play, Pause, X, ChevronRight, RotateCcw, Send, FileEdit, FileCode2, Code, AlertTriangle } from 'lucide-react';
import dagre from 'dagre';
import { useStudioStore } from './useStudioStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ResizableLeftPanel } from '../../components/studio';
import { PreviewField, PreviewSection, PreviewTable } from './FormPreviewTab';
import { WorkflowPalette } from './WorkflowPalette';
import { nodeTypes } from './nodes';
import { EditableEdge } from './nodes/EditableEdge';
import type { UiFormAction } from './types';

const edgeTypes = {
    editableEdge: EditableEdge,
};

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
    conditionNode: { width: 140, height: 70 },
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
        playSimulation,
        pauseSimulation,
        isSimulationAutoPlaying,
        stepSimulation,
        simulationVariables,
        updateSimulationVariable,
        forms,
        simulationPendingBranches,
        selectSimulationBranch,
        deleteStep
    } = useStudioStore();
    const setActiveEdgeId = useStudioStore(s => s.setActiveEdgeId);
    const activeEdgeId = useStudioStore(s => s.activeEdgeId);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
    const [showJson, setShowJson] = useState(false);
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync JSON text from store (one-way: store -> text)
    useEffect(() => {
        // Only update if not currently focused to avoid cursor reset during typing
        if (showJson && document.activeElement !== jsonTextareaRef.current) {
            setJsonText(JSON.stringify(workflow, null, 2));
            setJsonError(null);
        }
    }, [workflow, showJson]);

    const handleJsonChange = useCallback((text: string) => {
        setJsonText(text);
        try {
            const parsed = JSON.parse(text);
            if (!parsed.nodes || !parsed.edges || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
                setJsonError('Workflow JSON must contain "nodes" and "edges" arrays');
                return;
            }
            setJsonError(null);
            // Heuristic: only update the store if the structure is actually valid
            // We use standard any to bypass strict type check for now since we are editing raw JSON
            updateWorkflow(parsed.nodes as any, parsed.edges as any);
        } catch (e) {
            setJsonError((e as Error).message);
        }
    }, [updateWorkflow]);

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

    // Auto-Play Effect
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isSimulationAutoPlaying && simulationActiveNodeId) {
            timer = setTimeout(() => {
                stepSimulation();
            }, 1000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isSimulationAutoPlaying, simulationActiveNodeId, stepSimulation]);

    const onConnect: OnConnect = useCallback(
        (params) => {
            const newEdges = addEdge(
                {
                    ...params,
                    type: 'editableEdge',
                    animated: false,
                    style: { stroke: '#0f172a', strokeWidth: 2 },
                    // Ensure no label is added
                    label: undefined,
                    data: { offsets: [0, 0, 0] }
                },
                edges
            );
            setEdges(newEdges);
            updateWorkflow(nodes as any, newEdges as any);
        },
        [edges, nodes, setEdges, updateWorkflow]
    );

    const onNodeDragStop = useCallback(() => {
        // Ensure we use the absolute latest state from React Flow hooks
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        updateWorkflow(currentNodes as any, currentEdges as any);
    }, [getNodes, getEdges, updateWorkflow]);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            onNodeSelect?.(node.id);
        },
        [onNodeSelect]
    );

    // Handle pane click → deselect
    const onPaneClick = useCallback(() => {
        onNodeSelect?.(null);
        setActiveEdgeId(null);
    }, [onNodeSelect, setActiveEdgeId]);

    // Handle edge click → select for properties panel
    const onEdgeClick = useCallback(
        (_: React.MouseEvent, edge: Edge) => {
            setActiveEdgeId(edge.id);
        },
        [setActiveEdgeId]
    );

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
            deletedNodes.forEach(n => deleteStep(n.id));
            onNodeSelect?.(null);
        },
        [deleteStep, onNodeSelect]
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
        const startNode = autoLayoutedNodes.find(n => n.type === 'startNode' || n.data.isStart);
        if (startNode) {
            const triggerType = (startNode.data.triggerType as string) || 'FORM_SUB';
            if (triggerType === 'FORM_SUB' && !startNode.data.formId) {
                alert('A Form must be assigned to the Start step (Form Submission) before running the simulation.');
                return;
            }
        }
        startSimulation();
    }, [startSimulation, autoLayoutedNodes]);

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
        <div className="flex h-full w-full" style={{ height: 'calc(100vh - 250px)' }}>
            {/* Resizable palette panel */}
            <ResizableLeftPanel defaultWidth={200} minWidth={140} maxWidth={360} collapsedWidth={56}>
                {(isCollapsed) => <WorkflowPalette isCollapsed={isCollapsed} />}
            </ResizableLeftPanel>

            {/* Canvas area */}
            <motion.div
                ref={reactFlowWrapper}
                className="flex-1 min-w-0"
                style={{
                    height: '100%',
                    backgroundColor: 'white',
                    borderRadius: '0 14px 14px 0',
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
                    edges={edges.map(e => {
                        // Derive label from statusConfig if available
                        const statusName = (e as any).data?.statusConfig?.statusName;
                        const statusColor = (e as any).data?.statusConfig?.statusColor;
                        const baseLabel = statusName || (e as any).label || undefined;

                        return {
                            ...e,
                            label: baseLabel,
                            animated: isSimulationMode ? simulationHistory.includes(e.source) && simulationHistory.includes(e.target) : e.animated,
                            style: isSimulationMode && simulationHistory.includes(e.source) && simulationHistory.includes(e.target)
                                ? { stroke: '#10b981', strokeWidth: 3 }
                                : e.style,
                            labelStyle: statusName ? {
                                fontSize: 10,
                                fontWeight: 700,
                                fill: statusColor || 'var(--brand-red)',
                            } : undefined,
                            labelBgStyle: statusName ? {
                                fill: '#ffffff',
                                stroke: statusColor || '#e2e8f0',
                                strokeWidth: 1,
                            } : undefined,
                            labelBgPadding: statusName ? [4, 6] as [number, number] : undefined,
                            labelBgBorderRadius: statusName ? 6 : undefined,
                        };
                    })}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
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
                    snapGrid={[10, 10]}
                    defaultEdgeOptions={{
                        type: 'editableEdge',
                        style: { stroke: '#0f172a', strokeWidth: 2 },
                        data: { offsets: [0, 0, 0] }
                    }}
                    edgeTypes={edgeTypes}
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowJson(!showJson)}
                                    className={`gap-2 shadow-sm ${showJson ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : 'bg-white/80 backdrop-blur-sm'}`}
                                >
                                    <FileCode2 size={16} className={showJson ? 'text-white' : 'text-slate-400'} />
                                    {showJson ? 'Hide JSON' : 'View JSON'}
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
                                        {isSimulationAutoPlaying ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={pauseSimulation}
                                                className="h-8 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                                            >
                                                <Pause size={14} />
                                                Pause
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={playSimulation}
                                                disabled={!simulationActiveNodeId}
                                                className="h-8 gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                            >
                                                <Play size={14} />
                                                Play
                                            </Button>
                                        )}
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={stepSimulation}
                                            disabled={!simulationActiveNodeId || isSimulationAutoPlaying}
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


                            {/* Rendering Form if Active Node is Start AND its trigger is FORM_SUB */}
                            {(() => {
                                if (!simulationActiveNodeId) return null;
                                const activeNode = nodes.find(n => n.id === simulationActiveNodeId);
                                if (!activeNode) return null;

                                const isStart = activeNode.type === 'startNode' || activeNode.data.isStart;
                                const triggerType = (activeNode.data.triggerType as string) || 'FORM_SUB';
                                const formId = activeNode.data.formId as string | undefined;

                                if (isStart && triggerType === 'FORM_SUB' && formId) {
                                    const form = forms.find(f => f.id === formId);
                                    if (form && form.items) {
                                        return (
                                            <Panel position="top-right" style={{ top: 80, bottom: 15, right: 15, margin: 0 }} className="flex flex-col z-50">
                                                <Card className="w-[600px] flex-1 p-0 flex flex-col bg-white shadow-2xl border-slate-200 rounded-xl overflow-hidden">
                                                    {/* Header */}
                                                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-[var(--brand-red)]/10 p-2 rounded-lg text-[var(--brand-red)]">
                                                                <FileEdit size={18} />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-base text-slate-900 leading-tight">Request Form</h3>
                                                                <p className="text-xs font-medium text-slate-500 mt-0.5">{form.name}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Form Content - Scrollable */}
                                                    <div className="p-8 overflow-y-auto flex-1 bg-white">
                                                        {form.items && form.items.length > 0 ? (
                                                            <div className="space-y-6">
                                                                {form.items.map((item: any) => {
                                                                    if (item.type === 'section') {
                                                                        return <PreviewSection key={item.id} section={item} values={simulationVariables} onChange={updateSimulationVariable} />;
                                                                    } else if (item.type === 'table') {
                                                                        return <div key={item.id} className="opacity-50 pointer-events-none"><PreviewTable table={item} /></div>;
                                                                    } else {
                                                                        return (
                                                                            <div key={item.id} className="mb-5">
                                                                                <PreviewField field={item} value={simulationVariables[item.id]} onChange={(val: any) => updateSimulationVariable(item.id, val)} />
                                                                            </div>
                                                                        );
                                                                    }
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic text-center py-4">No fields defined in this form.</p>
                                                        )}
                                                    </div>

                                                    {/* Footer Actions */}
                                                    <div className="p-5 border-t border-slate-200 bg-slate-50 shrink-0">
                                                        <Button
                                                            onClick={() => {
                                                                stepSimulation();
                                                                playSimulation();
                                                            }}
                                                            disabled={isSimulationAutoPlaying}
                                                            className="w-full gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 shadow-sm text-white font-semibold h-11 rounded-lg"
                                                        >
                                                            <Send size={16} />
                                                            Submit & Auto-Run
                                                        </Button>
                                                    </div>
                                                </Card>
                                            </Panel>
                                        );
                                    }
                                }
                                return null;
                            })()}

                            {/* Branch Selection Overlay */}
                            {simulationPendingBranches && (
                                <Panel position="bottom-center" className="mb-24">
                                    <Card className="p-4 bg-white/95 backdrop-blur-xl shadow-2xl border-emerald-200 rounded-3xl min-w-[320px] animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                                <div className="bg-red-50 p-2 rounded-xl text-[var(--brand-red)]">
                                                    <Send size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">Select Path</h4>
                                                    <p className="text-[10px] text-slate-500 font-medium">Multiple outgoing branches detected</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 justify-center">
                                                {(() => {
                                                    const sortedBranches = [...simulationPendingBranches].sort((a, b) => {
                                                        const sourceNode = nodes.find(n => n.id === a.source);
                                                        if (sourceNode?.data?.formId) {
                                                            const form = forms.find(f => f.id === sourceNode.data.formId);
                                                            if (form && form.actions) {
                                                                const idxA = form.actions.findIndex(act => act.id === a.sourceHandle);
                                                                const idxB = form.actions.findIndex(act => act.id === b.sourceHandle);
                                                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                            }
                                                        } else if (sourceNode?.data?.formActions) {
                                                            const actions = sourceNode.data.formActions as UiFormAction[];
                                                            const idxA = actions.findIndex(act => act.id === a.sourceHandle);
                                                            const idxB = actions.findIndex(act => act.id === b.sourceHandle);
                                                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                        }
                                                        if (sourceNode?.type === 'conditionNode') {
                                                            if (a.sourceHandle === 'true' && b.sourceHandle === 'false') return -1;
                                                            if (a.sourceHandle === 'false' && b.sourceHandle === 'true') return 1;
                                                        }
                                                        return 0;
                                                    });

                                                    return sortedBranches.map((edge) => {
                                                        const sourceNode = nodes.find(n => n.id === edge.source);
                                                        let label = (edge.label as string) || 'Next Step';
                                                        let actionVariant: string | undefined;

                                                        if (sourceNode?.type === 'conditionNode') {
                                                            label = (edge.label as string) || (edge.sourceHandle === 'true' ? 'True' : 'False');
                                                        } else if (sourceNode?.data?.formId) {
                                                            const form = forms.find(f => f.id === sourceNode.data.formId);
                                                            if (form && form.actions) {
                                                                const action = form.actions.find(a => a.id === edge.sourceHandle);
                                                                if (action) {
                                                                    label = action.label;
                                                                    actionVariant = action.variant;
                                                                }
                                                            }
                                                        } else if (sourceNode?.data?.formActions) {
                                                            const actions = sourceNode.data.formActions as UiFormAction[];
                                                            const action = actions.find(a => a.id === edge.sourceHandle);
                                                            if (action) {
                                                                label = action.label;
                                                                actionVariant = action.variant;
                                                            }
                                                        }

                                                        if (sourceNode?.type === 'conditionNode') {
                                                            actionVariant = edge.sourceHandle === 'true' ? 'success' : 'danger';
                                                        }

                                                        let variantClass = "bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm border border-slate-200/60";

                                                        if (actionVariant) {
                                                            if (actionVariant === 'success') variantClass = "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-200/50 border-emerald-600";
                                                            else if (actionVariant === 'danger') variantClass = "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200/50 border-red-600";
                                                            else if (actionVariant === 'primary') variantClass = "bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-200/50 border-blue-600";
                                                            else if (actionVariant === 'secondary') variantClass = "bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200/50 border-amber-600";
                                                            else if (actionVariant === 'warning') variantClass = "bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-200/50 border-orange-600";
                                                            else if (actionVariant === 'outline') variantClass = "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm";
                                                            else if (actionVariant === 'ghost') variantClass = "bg-transparent text-slate-600 hover:bg-slate-100 shadow-none border-transparent";
                                                        } else {
                                                            const isTrue = edge.sourceHandle === 'true';
                                                            const isFalse = edge.sourceHandle === 'false';
                                                            const isApprove = label.toLowerCase().includes('approve') || label.toLowerCase().includes('yes');
                                                            const isReject = label.toLowerCase().includes('reject') || label.toLowerCase().includes('no');

                                                            if (isTrue || isApprove) variantClass = "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-200/50 border-emerald-600";
                                                            if (isFalse || isReject) variantClass = "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200/50 border-red-600";
                                                        }

                                                        return (
                                                            <Button
                                                                key={edge.id}
                                                                size="sm"
                                                                onClick={() => selectSimulationBranch(edge.id)}
                                                                className={`px-6 h-10 font-bold rounded-xl transition-all active:scale-95 border ${variantClass}`}
                                                            >
                                                                {label}
                                                            </Button>
                                                        );
                                                    });
                                                })()}
                                            </div>

                                            <div className="p-2 bg-slate-50 rounded-xl text-center">
                                                <p className="text-[9px] text-slate-400 font-medium italic">
                                                    Choose the next step to continue the simulation.
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </Panel>
                            )}
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

            {/* ─── RIGHT: Workflow JSON Editor (inline panel) ─── */}
            {showJson && (
                <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden bg-[#1e1e2e]">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-[#181825]">
                        <Code size={14} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-300">Workflow JSON</span>
                        <div className="flex-1" />
                        {jsonError ? (
                            <Badge variant="destructive" className="text-[10px] h-5 px-2 bg-red-500/20 text-red-400 border-red-500/30">Error</Badge>
                        ) : (
                            <Badge className="text-[10px] h-5 px-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Valid</Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard.writeText(jsonText);
                            }}
                            className="text-[10px] h-7 px-2.5 text-slate-400 hover:text-white hover:bg-slate-700 gap-1.5"
                        >
                            Copy
                        </Button>
                    </div>
                    {/* Editor */}
                    <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
                        {/* Line Number Gutter */}
                        <div
                            className="w-10 flex-shrink-0 bg-[#181825] text-slate-600 font-mono text-xs leading-6 pt-3 pr-2 text-right select-none overflow-hidden"
                            ref={(el) => {
                                if (!el) return;
                                const ta = jsonTextareaRef.current;
                                if (ta) {
                                    ta.onscroll = () => { el.scrollTop = ta.scrollTop; };
                                }
                            }}
                        >
                            {jsonText.split('\n').map((_, i) => (
                                <div key={i} className="px-1">{i + 1}</div>
                            ))}
                        </div>
                        {/* Textarea */}
                        <textarea
                            ref={jsonTextareaRef}
                            value={jsonText}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            className="flex-1 px-3 py-3 font-mono text-xs leading-6 bg-transparent text-[#a6e3a1] resize-none focus:outline-none placeholder:text-slate-600 caret-[#f5c2e7]"
                            spellCheck={false}
                            placeholder="{}"
                        />
                    </div>
                    {/* Status bar */}
                    <div className="px-4 py-2 border-t border-slate-700 bg-[#181825] flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">
                            {workflow.nodes.length} Nodes • {workflow.edges.length} Edges
                        </span>
                    </div>
                    {jsonError && (
                        <div className="flex items-center gap-2 px-3 py-2 text-red-400 text-[11px] bg-red-500/10 border-t border-red-500/20">
                            <AlertTriangle size={12} />
                            <span className="truncate">{jsonError}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
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
