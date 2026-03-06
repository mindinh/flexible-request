import { Users } from 'lucide-react';

interface HierarchyPaletteProps {
    isCollapsed?: boolean;
}

/**
 * HierarchyPalette — Matches the Workflow Studio palette style.
 * Single draggable "Group" template card.
 */
export function HierarchyPalette({ isCollapsed = false }: HierarchyPaletteProps) {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData(
            'application/hierarchy-node',
            JSON.stringify({
                entityType: 'GROUP',
                entityId: '',
                label: 'New Group',
                isNew: true,
                groupTypeCode: 'GROUP',
                members: [],
            })
        );
        e.dataTransfer.effectAllowed = 'move';
    };

    if (!isCollapsed) {
        return (
            <div className="flex flex-col gap-1.5">
                {!isCollapsed && (
                    <p className="text-[10px] text-slate-400 leading-relaxed px-1 mb-1">
                        Drag and drop to build
                    </p>
                )}
                <div
                    draggable
                    onDragStart={handleDragStart}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
                >
                    <div
                        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: 'color-mix(in srgb, #2563eb 10%, transparent)', color: '#2563eb' }}
                    >
                        <Users size={16} />
                    </div>
                    <span className="text-[12px] font-medium text-slate-700 leading-tight">Group</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-2 pt-1">
            <div
                draggable
                onDragStart={handleDragStart}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white transition-all cursor-grab active:cursor-grabbing hover:shadow-sm"
                style={{ color: '#2563eb' }}
                title="Group"
            >
                <Users size={18} />
            </div>
        </div>
    );
}
