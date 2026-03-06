import { cn } from '@/lib/utils';
import {
    LayoutGrid, Table, Rows3, ScrollText, Database
} from 'lucide-react';
import { useStudioStore } from './useStudioStore';

// Form element definitions grouped by category (matching reference design)

const LAYOUT_ELEMENTS = [
    { id: 'section', label: 'Section', icon: LayoutGrid },
    { id: 'row', label: 'Row', icon: Rows3 },
    { id: 'table', label: 'Table', icon: Table },
    { id: 'scrollview', label: 'Scroll View', icon: ScrollText },
];

const ELEMENT_GROUPS = [
    { key: 'layout', label: 'LAYOUT', items: LAYOUT_ELEMENTS },
];

interface SchemaPaletteProps {
    isCollapsed?: boolean;
}

function PaletteCard({
    icon: Icon,
    label,
    type,
    dataFieldKey,
    isCollapsed,
    onClick,
}: {
    icon: React.ElementType;
    label: string;
    type: string;
    dataFieldKey?: string;
    isCollapsed?: boolean;
    onClick: () => void;
}) {
    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, label, dataFieldKey }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    if (isCollapsed) {
        return (
            <button
                onClick={onClick}
                draggable
                onDragStart={handleDragStart}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing"
                title={label}
            >
                <Icon size={18} />
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            draggable
            onDragStart={handleDragStart}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-slate-200 bg-white hover:border-primary hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing min-h-[72px]"
        >
            <Icon size={20} className="text-slate-500" />
            <span className="text-[11px] font-medium text-slate-700 leading-tight text-center">{label}</span>
        </button>
    );
}

export function SchemaPalette({ isCollapsed = false }: SchemaPaletteProps) {
    const { addSchemaItem, activeStepId, dataSchema } = useStudioStore();

    const handleAdd = (type: string, label: string, key?: string) => {
        if (!activeStepId) return;
        addSchemaItem(type, label, key);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Standard Element Groups (LAYOUT) */}
            {ELEMENT_GROUPS.map((group) => (
                <div key={group.key} className="mb-2">
                    {!isCollapsed && (
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">
                            {group.label}
                        </h4>
                    )}
                    <div className={cn(
                        "grid gap-2",
                        isCollapsed ? "grid-cols-1" : "grid-cols-2"
                    )}>
                        {group.items.map((item) => (
                            <PaletteCard
                                key={item.id}
                                icon={item.icon}
                                label={item.label}
                                type={item.id}
                                isCollapsed={isCollapsed}
                                onClick={() => handleAdd(item.id, item.label)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            <div className="h-px bg-slate-100 my-1" />

            {/* Data Schema Fields */}
            {dataSchema && dataSchema.length > 0 && (
                <div className="mb-2">
                    {!isCollapsed && (
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">
                            <Database size={12} className="text-primary" />
                            Data Schema
                        </h4>
                    )}
                    <div className={cn(
                        "grid gap-2",
                        isCollapsed ? "grid-cols-1" : "grid-cols-2"
                    )}>
                        {dataSchema.map((field) => (
                            <PaletteCard
                                key={field.key}
                                type="text"
                                label={field.label}
                                icon={Database}
                                isCollapsed={isCollapsed}
                                dataFieldKey={field.key}
                                onClick={() => handleAdd('text', field.label, field.key)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
