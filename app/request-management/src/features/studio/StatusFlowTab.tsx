/**
 * StatusFlowTab – READ-ONLY grid-based Status Flow visualization.
 *
 * Layout:
 *   - CSS Grid where columns = lanes, rows = phase order
 *   - Phases horizontally aligned across lanes
 *   - Left sidebar: STATUS LIBRARY (Overall Request Status, Step Status, Step Owner Status, Approval Status)
 *   - Forward-only transition arrows between phase cards
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Eye,
    FileText,
    ArrowDown,
    ArrowRight,
    Users,
    Zap,
    CircleDot,
    ChevronDown,
    ChevronRight,
    GripVertical,
} from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { generateStatusFlow } from './statusFlowGenerator';
import type {
    StatusFlowModel,
    StatusFlowLane,
    StatusFlowPhase,
    IndividualStatus,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────────

const LANE_MIN_WIDTH = 200;
const HEADER_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

// ─── Overall Status Header Card ─────────────────────────────────────────

function OverallStatusHeader({ lane, index }: { lane: StatusFlowLane; index: number }) {
    const accentColor = HEADER_COLORS[index % HEADER_COLORS.length];
    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-2">
                <span
                    className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: accentColor }}
                >
                    Overall
                </span>
                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Status</span>
                <span className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">{lane.label}</h3>
            {lane.subtitle && (
                <p className="text-[10px] text-slate-400 mt-0.5">{lane.subtitle}</p>
            )}
        </div>
    );
}

// ─── Individual Status Chip ─────────────────────────────────────────────

function StatusChipItem({ status }: { status: IndividualStatus }) {
    return (
        <div
            className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-left"
            style={{ backgroundColor: status.bgColor, borderColor: status.borderColor }}
        >
            <span className="text-[11px] font-semibold" style={{ color: status.color }}>
                {status.label}
            </span>
            {status.description && (
                <span className="text-[9px] text-slate-400 leading-tight">{status.description}</span>
            )}
        </div>
    );
}

// ─── Phase Block Card ───────────────────────────────────────────────────

function PhaseBlockCard({ phase }: { phase: StatusFlowPhase }) {
    const hasNumber = phase.phaseNumber > 0;
    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-start gap-2">
                    {hasNumber && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {phase.phaseNumber}
                        </span>
                    )}
                    <h4 className="text-xs font-bold text-slate-700 leading-tight flex-1">{phase.label}</h4>
                </div>
            </div>
            <div className="p-2.5 space-y-1.5">
                {phase.statuses.map(s => (
                    <StatusChipItem key={s.id} status={s} />
                ))}
            </div>
        </div>
    );
}

// ─── Transition Arrow ───────────────────────────────────────────────────

function TransitionArrow({ label, direction = 'down' }: { label?: string; direction?: 'down' | 'right' }) {
    const Icon = direction === 'right' ? ArrowRight : ArrowDown;
    return (
        <div className={`flex ${direction === 'right' ? 'flex-row' : 'flex-col'} items-center py-1 px-1`}>
            <Icon size={14} className="text-slate-300" />
            {label && (
                <span className="text-[9px] text-slate-400 italic ml-1 mt-0.5">{label}</span>
            )}
        </div>
    );
}

// ─── Grid-based Canvas ──────────────────────────────────────────────────

function StatusFlowCanvas({ model }: { model: StatusFlowModel }) {
    const { lanes, phases, transitions } = model;

    if (lanes.length === 0) {
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

    // Grid dimensions
    const maxPhaseNum = Math.max(...phases.map(p => p.phaseNumber), 0);
    const totalGridRows = maxPhaseNum + 1;

    // Transition lookup
    const transitionFromMap = new Map<string, { to: string; action: string }[]>();
    for (const t of transitions) {
        if (!transitionFromMap.has(t.from)) transitionFromMap.set(t.from, []);
        transitionFromMap.get(t.from)!.push({ to: t.to, action: t.action });
    }

    return (
        <div className="overflow-auto h-full p-6">
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-600">User sequence by request type</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                    Each column is a user role, statuses are primary blocks, actions are shown between statuses
                </p>
            </div>

            {/* CSS Grid: columns = lanes, rows = phase stages */}
            <div
                className="grid gap-3"
                style={{
                    gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_MIN_WIDTH}px, 1fr))`,
                    gridTemplateRows: `auto repeat(${totalGridRows}, auto)`,
                }}
            >
                {/* Row 1: Overall Status Headers */}
                {lanes.map((lane, laneIdx) => (
                    <div key={lane.id} style={{ gridColumn: laneIdx + 1, gridRow: 1 }}>
                        <OverallStatusHeader lane={lane} index={laneIdx} />
                    </div>
                ))}

                {/* Phase cells: placed at [laneIndex+1, phaseNumber+1] */}
                {phases.map(phase => {
                    const col = phase.laneIndex + 1;
                    const row = phase.phaseNumber + 1;
                    const phaseTrs = transitionFromMap.get(phase.id) || [];

                    return (
                        <div
                            key={phase.id}
                            style={{ gridColumn: col, gridRow: row }}
                            className="flex flex-col"
                        >
                            <PhaseBlockCard phase={phase} />

                            {/* Transition arrows */}
                            {phaseTrs.map(tr => {
                                const toPhase = phases.find(p => p.id === tr.to);
                                if (!toPhase) return null;
                                const isRightward = toPhase.laneIndex > phase.laneIndex;
                                return (
                                    <TransitionArrow
                                        key={`${phase.id}-${tr.to}`}
                                        label={tr.action || undefined}
                                        direction={isRightward ? 'right' : 'down'}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Cross-lane note */}
            {transitions.some(t => {
                const from = phases.find(p => p.id === t.from);
                const to = phases.find(p => p.id === t.to);
                return from && to && from.laneIndex !== to.laneIndex;
            }) && (
                <div className="mt-3 px-2">
                    <p className="text-[9px] text-slate-300 italic">
                        ↗ Transitions flow forward across columns from left to right
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Left Sidebar: STATUS LIBRARY Legend ────────────────────────────────

function StatusLibrarySection({
    title, statuses, defaultCollapsed = false
}: { title: string; statuses: IndividualStatus[]; defaultCollapsed?: boolean }) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-slate-50/50 transition-colors"
            >
                <span className="text-[11px] font-bold text-slate-700">{title}</span>
                {collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {!collapsed && (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                    {statuses.map(s => (
                        <span
                            key={s.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border"
                            style={{ color: s.color, backgroundColor: s.bgColor, borderColor: s.borderColor }}
                        >
                            {s.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function LegendPanel({ model }: { model: StatusFlowModel }) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

    const statusLib = model.statusLibrary;
    const actions = model.workflowActions || [];

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            {/* USER ROLES */}
            <div className="px-4 pt-4 pb-1">
                <button onClick={() => toggle('roles')} className="flex items-center justify-between w-full text-left">
                    <div className="flex items-center gap-1.5">
                        <Users size={13} className="text-[#b10e10]" />
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">User Roles</span>
                    </div>
                    {collapsed['roles'] ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>
            </div>
            {!collapsed['roles'] && (
                <div className="px-4 pb-2 space-y-0.5">
                    {model.lanes.map((lane, i) => (
                        <div key={lane.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-700">
                            <div
                                className="w-1 min-h-[20px] rounded-full flex-shrink-0"
                                style={{ backgroundColor: HEADER_COLORS[i % HEADER_COLORS.length] }}
                            />
                            <div className="flex-1">
                                <span className="font-semibold">{lane.label}</span>
                                {lane.subtitle && <span className="text-[9px] text-slate-400 ml-1.5">({lane.subtitle})</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <hr className="mx-4 my-1 border-slate-100" />

            {/* ACTIONS – from workflow */}
            <div className="px-4 pt-2 pb-1">
                <button onClick={() => toggle('actions')} className="flex items-center justify-between w-full text-left">
                    <div className="flex items-center gap-1.5">
                        <Zap size={13} className="text-[#b10e10]" />
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Actions</span>
                    </div>
                    {collapsed['actions'] ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>
            </div>
            {!collapsed['actions'] && (
                <div className="px-4 pb-2 space-y-0.5">
                    {actions.length > 0 ? actions.map(a => (
                        <div key={a} className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-slate-600">
                            <Zap size={11} className="text-[#b10e10]/60 flex-shrink-0" />
                            {a}
                        </div>
                    )) : (
                        <p className="text-[9px] text-slate-400 italic px-2">No actions configured</p>
                    )}
                </div>
            )}

            <hr className="mx-4 my-1 border-slate-100" />

            {/* STATUS LIBRARY – 4 categories from reference image */}
            <div className="px-4 pt-2 pb-1">
                <div className="flex items-center gap-1.5">
                    <Eye size={13} className="text-[#b10e10]" />
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status Library</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Drag statuses to sequence lanes</p>
            </div>
            {statusLib && (
                <div className="px-3 space-y-2 pb-2">
                    <StatusLibrarySection title="Overall Request Status" statuses={statusLib.overallRequestStatus} />
                    <StatusLibrarySection title="Step Status" statuses={statusLib.stepStatus} />
                    <StatusLibrarySection title="Step Owner Status" statuses={statusLib.stepOwnerStatus} />
                    <StatusLibrarySection title="Approval Status" statuses={statusLib.approvalStatus} />
                </div>
            )}

        </div>
    );
}

// ─── Main Tab Component ─────────────────────────────────────────────────

const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 400;
const DEFAULT_PANEL_WIDTH = 240;

export function StatusFlowTab() {
    const { workflow, forms } = useStudioStore();
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(DEFAULT_PANEL_WIDTH);

    const model = useMemo(
        () => generateStatusFlow(workflow.nodes, workflow.edges, forms),
        [workflow.nodes, workflow.edges, forms],
    );

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        startX.current = e.clientX;
        startWidth.current = panelWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = ev.clientX - startX.current;
            const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
            setPanelWidth(newWidth);
        };
        const onMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [panelWidth]);

    return (
        <motion.div className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {/* Title bar */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 bg-white flex-shrink-0">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-semibold text-slate-800">
                    {model.title || 'Status Flow'}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <Eye size={11} />
                    <span>Read-only · Derived from Workflow</span>
                </div>
            </div>

            {/* Main body */}
            <div className="flex flex-1 min-h-0">
                {/* Left sidebar – resizable */}
                <div
                    className="flex-shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0 relative"
                    style={{ width: panelWidth }}
                >
                    <LegendPanel model={model} />
                </div>

                {/* Resize handle */}
                <div
                    className="flex-shrink-0 w-1.5 cursor-col-resize hover:bg-blue-200 active:bg-blue-300 transition-colors flex items-center justify-center group"
                    onMouseDown={onMouseDown}
                    title="Drag to resize"
                >
                    <GripVertical size={10} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>

                {/* Center canvas */}
                <div className="flex-1 relative overflow-hidden bg-slate-50/30">
                    <StatusFlowCanvas model={model} />
                </div>
            </div>
        </motion.div>
    );
}
