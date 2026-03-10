/**
 * StatusFlowTab – READ-ONLY React Flow visualization with simple status cards.
 *
 * - Simple cards: just status name + color dot
 * - Horizontal lane separator lines between roles
 * - Action labels on transitions
 * - Statuses derived from Workflow edge statusConfig
 */
import { useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    MarkerType,
    BaseEdge,
    EdgeLabelRenderer,
    type Node,
    type Edge,
    type EdgeProps,
    ReactFlowProvider,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Eye, FileText, CircleDot } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { generateStatusFlow } from './statusFlowGenerator';
import type { StatusFlowModel } from './types';

// ─── Layout Constants ───────────────────────────────────────────────────

const ORIENTATION: 'horizontal' | 'vertical' = 'vertical';

const LANE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const CARD_WIDTH = 150;
const CARD_HEIGHT = 44;

// Horizontal layout (legacy)
const LANE_HEIGHT = 200;
const CARD_GAP = 130;
const LANE_HEADER_WIDTH = 140;
const FIRST_CARD_X = LANE_HEADER_WIDTH + 30;

// Vertical layout (default)
const LANE_WIDTH = 360;
const LANE_TOP_PADDING = 16;
const LANE_LEFT_PADDING = 16;
const LANE_HEADER_HEIGHT = 70;
const FIRST_CARD_Y = LANE_TOP_PADDING + LANE_HEADER_HEIGHT + 22;
const ROW_GAP = 130;

// ─── Custom Node: Lane Header ───────────────────────────────────────────

function LaneHeaderNode({ data }: { data: any }) {
    const color = data.color || '#3b82f6';
    return (
        <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 bg-white shadow-sm relative"
            style={{ borderColor: color, minWidth: 120 }}
        >
            <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{data.label}</div>
                {data.subtitle && (
                    <div className="text-[9px] text-slate-400 font-medium truncate">{data.subtitle}</div>
                )}
            </div>
        </div>
    );
}

// ─── Custom Node: Simple Status Card ────────────────────────────────────

function SimpleStatusCard({ data }: { data: any }) {
    const statusColor = data.statusColor || '#475569';
    const bgColor = data.bgColor || '#f8fafc';
    const borderColor = data.borderColor || '#e2e8f0';
    const handleStyle = { background: '#94a3b8', width: 6, height: 6, border: '2px solid white' };
    const orientation = (data?.orientation as typeof ORIENTATION | undefined) || ORIENTATION;
    const isVertical = orientation === 'vertical';

    return (
        <div
            className="px-4 py-2 rounded-xl border-2 shadow-sm flex items-center gap-2.5 relative"
            style={{ backgroundColor: bgColor, borderColor }}
        >
            {/* Forward handles */}
            <Handle type="target" position={Position.Left} id="left" style={{ ...handleStyle, opacity: isVertical ? 0 : 1 }} />
            <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, opacity: isVertical ? 0 : 1 }} />
            {/* Reverse handles — top receives back-edges, bottom sends back-edges */}
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...handleStyle, opacity: isVertical ? 1 : 0 }} />
            <Handle type="target" position={Position.Top} id="top" style={{ ...handleStyle, opacity: isVertical ? 1 : 0 }} />
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
            <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: statusColor }}>
                {data.statusName}
            </span>
        </div>
    );
}

// ─── Custom Node: Lane Separator Line ───────────────────────────────────

function LaneSeparatorNode({ data }: { data: any }) {
    const orientation = (data?.orientation as typeof ORIENTATION | undefined) || ORIENTATION;
    const isVertical = orientation === 'vertical';
    return (
        <div
            style={{
                width: isVertical ? 0 : (data.width || 1400),
                height: isVertical ? (data.height || 900) : 0,
                borderTop: isVertical ? undefined : '1.5px dashed #cbd5e1',
                borderLeft: isVertical ? '1.5px dashed #cbd5e1' : undefined,
            }}
        />
    );
}

// ─── Custom Edge: Reverse (U-shaped path below lanes) ─────────────────

function ReverseEdge({
    id, sourceX, sourceY, targetX, targetY, label, style, markerEnd, data,
}: EdgeProps) {
    const laneCount = (data as any)?.laneCount ?? 4;
    // Route below all lanes with padding
    const bottomY = (data as any)?.bottomY ?? (laneCount * LANE_HEIGHT + 40);
    const radius = 14; // corner radius

    // Direction: source is to the right, target is to the left
    // Path: source bottom → down to bottomY → horizontally left → up to target top
    const goingLeft = targetX < sourceX;
    const path = goingLeft
        ? [
            `M ${sourceX},${sourceY}`,
            `L ${sourceX},${bottomY - radius}`,
            `Q ${sourceX},${bottomY} ${sourceX - radius},${bottomY}`,
            `L ${targetX + radius},${bottomY}`,
            `Q ${targetX},${bottomY} ${targetX},${bottomY - radius}`,
            `L ${targetX},${targetY}`,
        ].join(' ')
        : [
            `M ${sourceX},${sourceY}`,
            `L ${sourceX},${bottomY - radius}`,
            `Q ${sourceX},${bottomY} ${sourceX + radius},${bottomY}`,
            `L ${targetX - radius},${bottomY}`,
            `Q ${targetX},${bottomY} ${targetX},${bottomY - radius}`,
            `L ${targetX},${targetY}`,
        ].join(' ');

    // Label at the midpoint of the horizontal segment
    const labelX = (sourceX + targetX) / 2;
    const labelY = bottomY;

    return (
        <>
            <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'none',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#1e293b',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '2px 8px',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {label as string}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

const statusFlowNodeTypes = {
    laneHeader: LaneHeaderNode,
    statusCard: SimpleStatusCard,
    laneSeparator: LaneSeparatorNode,
};

const statusFlowEdgeTypes = {
    reverse: ReverseEdge,
};

// ─── Convert Model → React Flow ─────────────────────────────────────────

function modelToReactFlow(model: StatusFlowModel): { nodes: Node[]; edges: Edge[] } {
    const { lanes, phases, transitions } = model;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (lanes.length === 0) return { nodes, edges };

    if (ORIENTATION === 'vertical') {
        // Vertical layout: lanes become columns; phaseNumber becomes row.
        // Compress sparse phaseNumber space to keep layout compact (phaseNumber in the model is "column-like").
        const uniquePhaseNumbers = Array.from(new Set(phases.map(p => p.phaseNumber))).sort((a, b) => a - b);
        const rowIndex = new Map<number, number>();
        uniquePhaseNumbers.forEach((n, idx) => rowIndex.set(n, idx));

        const maxRowIdx = Math.max(0, uniquePhaseNumbers.length - 1);
        const totalHeight = FIRST_CARD_Y + (maxRowIdx + 2) * (CARD_HEIGHT + ROW_GAP);
        const bottomY = totalHeight + 40;

        // Lane headers (top of each column)
        for (let i = 0; i < lanes.length; i++) {
            const laneX = LANE_LEFT_PADDING + i * LANE_WIDTH;
            nodes.push({
                id: `lane-header-${i}`,
                type: 'laneHeader',
                position: { x: laneX + (LANE_WIDTH - LANE_HEADER_WIDTH) / 2, y: LANE_TOP_PADDING },
                data: { label: lanes[i].label, subtitle: lanes[i].subtitle, color: LANE_COLORS[i % LANE_COLORS.length] },
                draggable: false, selectable: false, connectable: false,
            });
        }

        // Lane separator lines (between lanes)
        for (let i = 1; i < lanes.length; i++) {
            const x = LANE_LEFT_PADDING + i * LANE_WIDTH - 1;
            nodes.push({
                id: `separator-${i}`,
                type: 'laneSeparator',
                position: { x, y: 0 },
                data: { height: totalHeight, orientation: 'vertical' },
                draggable: false, selectable: false, connectable: false,
            });
        }

        // Status cards — detect branches at same (row, lane) and distribute horizontally
        const posGroups = new Map<string, typeof phases>();
        for (const phase of phases) {
            const key = `${phase.phaseNumber}-${phase.laneIndex}`;
            if (!posGroups.has(key)) posGroups.set(key, []);
            posGroups.get(key)!.push(phase);
        }

        for (const group of posGroups.values()) {
            const count = group.length;
            const laneIdx = group[0].laneIndex;
            const row = rowIndex.get(group[0].phaseNumber) ?? 0;
            const laneX = LANE_LEFT_PADDING + laneIdx * LANE_WIDTH;
            const baseX = laneX + (LANE_WIDTH - CARD_WIDTH) / 2;
            const y = FIRST_CARD_Y + row * (CARD_HEIGHT + ROW_GAP);

            if (count === 1) {
                const phase = group[0];
                const status = phase.statuses[0];
                nodes.push({
                    id: phase.id,
                    type: 'statusCard',
                    position: { x: baseX, y },
                    data: {
                        statusName: phase.label,
                        statusColor: status?.color || '#475569',
                        bgColor: status?.bgColor || '#f8fafc',
                        borderColor: status?.borderColor || '#e2e8f0',
                        orientation: 'vertical',
                    },
                    draggable: false, selectable: false, connectable: false,
                });
            } else {
                const gap = 16;
                const startX = baseX - ((count - 1) * (CARD_WIDTH + gap)) / 2;
                for (let i = 0; i < count; i++) {
                    const phase = group[i];
                    const status = phase.statuses[0];
                    nodes.push({
                        id: phase.id,
                        type: 'statusCard',
                        position: { x: startX + i * (CARD_WIDTH + gap), y },
                        data: {
                            statusName: phase.label,
                            statusColor: status?.color || '#475569',
                            bgColor: status?.bgColor || '#f8fafc',
                            borderColor: status?.borderColor || '#e2e8f0',
                            orientation: 'vertical',
                        },
                        draggable: false, selectable: false, connectable: false,
                    });
                }
            }
        }

        // Transition edges (vertical routing)
        for (const t of transitions) {
            const hasAction = !!t.action;
            const isReverse = !!t.isReverse;

            if (isReverse) {
                edges.push({
                    id: t.id,
                    source: t.from,
                    target: t.to,
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                    type: 'reverse',
                    animated: false,
                    label: hasAction ? `â†© ${t.action}` : undefined,
                    style: {
                        stroke: '#1e293b',
                        strokeWidth: 1.5,
                    },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#1e293b', width: 14, height: 14 },
                    data: { bottomY },
                });
            } else {
                edges.push({
                    id: t.id,
                    source: t.from,
                    target: t.to,
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                    type: 'smoothstep',
                    animated: false,
                    label: hasAction ? t.action : undefined,
                    style: {
                        stroke: hasAction ? '#64748b' : '#94a3b8',
                        strokeWidth: hasAction ? 2 : 1.5,
                        strokeDasharray: hasAction ? undefined : '6 3',
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: hasAction ? '#64748b' : '#94a3b8',
                        width: 14,
                        height: 14,
                    },
                    labelStyle: hasAction ? { fontSize: 10, fontWeight: 700, fill: '#475569' } : undefined,
                    labelBgStyle: hasAction ? { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 } : undefined,
                    labelBgPadding: hasAction ? [3, 6] as [number, number] : undefined,
                    labelBgBorderRadius: hasAction ? 6 : undefined,
                });
            }
        }

        return { nodes, edges };
    }

    // Max column for width calculation
    const maxCol = Math.max(...phases.map(p => p.phaseNumber), 0);
    const totalWidth = FIRST_CARD_X + (maxCol + 2) * (CARD_WIDTH + CARD_GAP);

    // Lane headers
    for (let i = 0; i < lanes.length; i++) {
        nodes.push({
            id: `lane-header-${i}`,
            type: 'laneHeader',
            position: { x: 10, y: i * LANE_HEIGHT + (LANE_HEIGHT - 50) / 2 },
            data: { label: lanes[i].label, subtitle: lanes[i].subtitle, color: LANE_COLORS[i % LANE_COLORS.length] },
            draggable: false, selectable: false, connectable: false,
        });
    }

    // Lane separator lines (between lanes)
    for (let i = 1; i < lanes.length; i++) {
        nodes.push({
            id: `separator-${i}`,
            type: 'laneSeparator',
            position: { x: 0, y: i * LANE_HEIGHT - 1 },
            data: { width: totalWidth },
            draggable: false, selectable: false, connectable: false,
        });
    }

    // Status cards — detect branches at same (col, lane) and distribute vertically
    const posGroups = new Map<string, typeof phases>();
    for (const phase of phases) {
        const key = `${phase.phaseNumber}-${phase.laneIndex}`;
        if (!posGroups.has(key)) posGroups.set(key, []);
        posGroups.get(key)!.push(phase);
    }

    for (const group of posGroups.values()) {
        const count = group.length;
        const laneIdx = group[0].laneIndex;
        const col = group[0].phaseNumber;
        const x = FIRST_CARD_X + col * (CARD_WIDTH + CARD_GAP);

        if (count === 1) {
            // Single card — center in lane
            const phase = group[0];
            const status = phase.statuses[0];
            nodes.push({
                id: phase.id,
                type: 'statusCard',
                position: { x, y: laneIdx * LANE_HEIGHT + (LANE_HEIGHT - CARD_HEIGHT) / 2 },
                data: {
                    statusName: phase.label,
                    statusColor: status?.color || '#475569',
                    bgColor: status?.bgColor || '#f8fafc',
                    borderColor: status?.borderColor || '#e2e8f0',
                },
                draggable: false, selectable: false, connectable: false,
            });
        } else {
            // Multiple cards — distribute vertically within lane
            const gap = 16;
            const totalH = count * CARD_HEIGHT + (count - 1) * gap;
            const startY = laneIdx * LANE_HEIGHT + (LANE_HEIGHT - totalH) / 2;

            for (let i = 0; i < count; i++) {
                const phase = group[i];
                const status = phase.statuses[0];
                nodes.push({
                    id: phase.id,
                    type: 'statusCard',
                    position: { x, y: startY + i * (CARD_HEIGHT + gap) },
                    data: {
                        statusName: phase.label,
                        statusColor: status?.color || '#475569',
                        bgColor: status?.bgColor || '#f8fafc',
                        borderColor: status?.borderColor || '#e2e8f0',
                    },
                    draggable: false, selectable: false, connectable: false,
                });
            }
        }
    }

    // Transition edges
    for (const t of transitions) {
        const hasAction = !!t.action;
        const isReverse = !!t.isReverse;

        if (isReverse) {
            // Reverse / Sent-Back edges — custom U-shaped path below all lanes
            edges.push({
                id: t.id,
                source: t.from,
                target: t.to,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'reverse',
                animated: false,
                label: hasAction ? `↩ ${t.action}` : undefined,
                style: {
                    stroke: '#1e293b',
                    strokeWidth: 1.5,
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#1e293b', width: 14, height: 14 },
                data: { laneCount: lanes.length },
            });
        } else {
            // Forward edges — route via left→right handles
            edges.push({
                id: t.id,
                source: t.from,
                target: t.to,
                sourceHandle: 'right',
                targetHandle: 'left',
                type: 'smoothstep',
                animated: false,
                label: hasAction ? t.action : undefined,
                style: {
                    stroke: hasAction ? '#64748b' : '#94a3b8',
                    strokeWidth: hasAction ? 2 : 1.5,
                    strokeDasharray: hasAction ? undefined : '6 3',
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: hasAction ? '#64748b' : '#94a3b8',
                    width: 14,
                    height: 14,
                },
                labelStyle: hasAction ? { fontSize: 10, fontWeight: 700, fill: '#475569' } : undefined,
                labelBgStyle: hasAction ? { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 } : undefined,
                labelBgPadding: hasAction ? [3, 6] as [number, number] : undefined,
                labelBgBorderRadius: hasAction ? 6 : undefined,
            });
        }
    }

    return { nodes, edges };
}

// ─── Empty State ────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-lg max-w-sm">
                <CircleDot size={32} className="mx-auto text-blue-400 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">No Workflow Defined</h3>
                <p className="text-xs text-slate-500">
                    Go to the <strong>Workflow</strong> tab and add steps to generate the Status Flow.
                </p>
            </div>
        </div>
    );
}

// ─── React Flow Canvas ──────────────────────────────────────────────────

function StatusFlowCanvas({ model }: { model: StatusFlowModel }) {
    const { nodes, edges } = useMemo(() => modelToReactFlow(model), [model]);

    if (model.lanes.length === 0) return <EmptyState />;

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={statusFlowNodeTypes}
            edgeTypes={statusFlowEdgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            fitView
            fitViewOptions={{ padding: 0.08, minZoom: 0.5, maxZoom: 1.2 }}
            style={{ backgroundColor: '#fafafa' }}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
        >
            <Background color="#e2e8f0" gap={20} />
            <Controls showInteractive={false} position="bottom-right" />
            <MiniMap
                nodeColor={(node) => node.type === 'laneHeader' ? '#e2e8f0' : '#94a3b8'}
                maskColor="rgba(0,0,0,0.08)"
                position="bottom-left"
            />
            <Panel position="top-right">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <Eye size={11} />
                    <span className="font-medium">Read-only · Derived from Workflow</span>
                </div>
            </Panel>
        </ReactFlow>
    );
}

// ─── Main Tab ───────────────────────────────────────────────────────────

export function StatusFlowTab() {
    const { workflow, forms } = useStudioStore();

    const model = useMemo(
        () => generateStatusFlow(workflow.nodes, workflow.edges, forms),
        [workflow.nodes, workflow.edges, forms],
    );

    return (
        <motion.div className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 bg-white flex-shrink-0">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-semibold text-slate-800">
                    {model.title || 'Status Flow'}
                </span>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 font-medium">
                        {model.lanes.length} Lanes
                    </span>
                    <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 font-medium">
                        {model.phases.length} Phases
                    </span>
                    <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 font-medium">
                        {model.transitions.length} Transitions
                    </span>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <ReactFlowProvider>
                    <StatusFlowCanvas model={model} />
                </ReactFlowProvider>
            </div>
        </motion.div>
    );
}
