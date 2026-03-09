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
    type Node,
    type Edge,
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

const LANE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
const LANE_HEIGHT = 140;
const CARD_WIDTH = 150;
const CARD_HEIGHT = 44;
const CARD_GAP = 90;
const LANE_HEADER_WIDTH = 140;
const FIRST_CARD_X = LANE_HEADER_WIDTH + 30;

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

    return (
        <div
            className="px-4 py-2 rounded-xl border-2 shadow-sm flex items-center gap-2.5 relative"
            style={{ backgroundColor: bgColor, borderColor }}
        >
            <Handle type="target" position={Position.Left} style={{ background: '#94a3b8', width: 6, height: 6, border: '2px solid white' }} />
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
            <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: statusColor }}>
                {data.statusName}
            </span>
            <Handle type="source" position={Position.Right} style={{ background: '#94a3b8', width: 6, height: 6, border: '2px solid white' }} />
        </div>
    );
}

// ─── Custom Node: Lane Separator Line ───────────────────────────────────

function LaneSeparatorNode({ data }: { data: any }) {
    return (
        <div
            style={{
                width: data.width || 1400,
                height: 0,
                borderTop: '1.5px dashed #cbd5e1',
            }}
        />
    );
}

const statusFlowNodeTypes = {
    laneHeader: LaneHeaderNode,
    statusCard: SimpleStatusCard,
    laneSeparator: LaneSeparatorNode,
};

// ─── Convert Model → React Flow ─────────────────────────────────────────

function modelToReactFlow(model: StatusFlowModel): { nodes: Node[]; edges: Edge[] } {
    const { lanes, phases, transitions } = model;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (lanes.length === 0) return { nodes, edges };

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
            const gap = 8;
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
        edges.push({
            id: t.id,
            source: t.from,
            target: t.to,
            type: 'smoothstep',
            animated: false,
            label: hasAction ? t.action : undefined,
            style: {
                stroke: hasAction ? '#64748b' : '#94a3b8',
                strokeWidth: hasAction ? 2 : 1.5,
                strokeDasharray: hasAction ? undefined : '6 3',
            },
            labelStyle: hasAction ? { fontSize: 11, fontWeight: 700, fill: '#475569' } : undefined,
            labelBgStyle: hasAction ? { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 } : undefined,
            labelBgPadding: hasAction ? [3, 5] as [number, number] : undefined,
            labelBgBorderRadius: hasAction ? 4 : undefined,
        });
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
