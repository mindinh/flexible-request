import { Play, Flag, GitBranch, ClipboardCheck, Layers } from 'lucide-react';

type WorkflowNodeType = 'START' | 'END' | 'ACTION' | 'CONDITION';
const TRIGGER_TERMINAL_NODES = [
    { id: 'start', label: 'Start', icon: Play, nodeType: 'START' as const, defaultLabel: 'Start' },
    { id: 'end', label: 'End', icon: Flag, nodeType: 'END' as const, defaultLabel: 'End' },
];

const ACTION_NODES = [
    {
        id: 'action-user-task',
        label: 'User Task',
        icon: ClipboardCheck,
        nodeType: 'ACTION' as WorkflowNodeType,
        defaultLabel: 'User Task',
        subType: 'user_task',
        accentColor: 'var(--brand-red)',
    },
    {
        id: 'action-background',
        label: 'Background Task',
        icon: Layers,
        nodeType: 'ACTION' as WorkflowNodeType,
        defaultLabel: 'Background Task',
        subType: 'background_task',
        accentColor: 'var(--brand-red)',
    },
];

const LOGIC_NODES = [
    { id: 'logic-condition', label: 'Condition', icon: GitBranch, nodeType: 'CONDITION' as const, defaultLabel: 'Condition' },
];

const NODE_GROUPS = [
    { key: 'triggers', label: 'TRIGGERS & TERMINALS', items: TRIGGER_TERMINAL_NODES, color: '#64748b' },
    { key: 'actions', label: 'ACTIONS', items: ACTION_NODES, color: 'var(--brand-red)' },
    { key: 'logic', label: 'LOGIC', items: LOGIC_NODES, color: '#7c3aed' },
];

interface WorkflowPaletteProps {
    isCollapsed?: boolean;
}

function PaletteCard({
    icon: Icon,
    label,
    nodeType,
    defaultLabel,
    subType,
    accentColor,
    isCollapsed,
}: {
    icon: React.ElementType;
    label: string;
    nodeType: string;
    defaultLabel: string;
    subType?: string;
    accentColor: string;
    isCollapsed?: boolean;
}) {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData(
            'application/reactflow',
            JSON.stringify({ nodeType, label: defaultLabel, subType })
        );
        e.dataTransfer.effectAllowed = 'move';
    };

    if (isCollapsed) {
        return (
            <div
                draggable
                onDragStart={handleDragStart}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white transition-all cursor-grab active:cursor-grabbing hover:shadow-sm"
                style={{ color: accentColor }}
                title={label}
            >
                <Icon size={18} />
            </div>
        );
    }

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing p-2.5"
        >
            <div
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor }}
            >
                <Icon size={16} />
            </div>
            <span className="text-[12px] font-medium text-slate-700 leading-tight">{label}</span>
        </div>
    );
}

export function WorkflowPalette({ isCollapsed = false }: WorkflowPaletteProps) {
    return (
        <div className="flex flex-col gap-4">
            {!isCollapsed && (
                <p className="text-[11px] text-slate-400 leading-relaxed px-1">
                    Drag and drop to build
                </p>
            )}
            {NODE_GROUPS.map((group) => (
                <div key={group.key} className="flex flex-col gap-1.5">
                    {!isCollapsed && (
                        <span
                            className="text-[10px] font-semibold uppercase tracking-wider px-1"
                            style={{ color: group.color }}
                        >
                            {group.label}
                        </span>
                    )}
                    <div className={`flex flex-col gap-1.5 ${isCollapsed ? 'px-1' : ''}`}>
                        {group.items.map((item) => (
                            <PaletteCard
                                key={item.id}
                                icon={item.icon}
                                label={item.label}
                                nodeType={item.nodeType}
                                defaultLabel={item.defaultLabel}
                                subType={item.subType}
                                accentColor={item.accentColor || group.color}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
