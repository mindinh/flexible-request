import {
    Type, Hash, List, CheckSquare, LayoutGrid,
    Table, CircleDot, Mail, SlidersHorizontal,
    DollarSign, Tag, Image, Clock, Paperclip, Rows3, ScrollText, TextCursorInput
} from 'lucide-react';
import { useStudioStore } from './useStudioStore';

// Form element definitions grouped by category (matching reference design)

const LAYOUT_ELEMENTS = [
    { id: 'section', label: 'Section', icon: LayoutGrid },
    { id: 'row', label: 'Row', icon: Rows3 },
    { id: 'table', label: 'Table', icon: Table },
    { id: 'scrollview', label: 'Scroll View', icon: ScrollText },
];

const INPUT_ELEMENTS = [
    { id: 'text', label: 'Input Field', icon: TextCursorInput },
    { id: 'textarea', label: 'Text Area', icon: Type },
    { id: 'number', label: 'Number', icon: Hash },
    { id: 'currency', label: 'Currency', icon: DollarSign },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'slider', label: 'Slider', icon: SlidersHorizontal },
    { id: 'label', label: 'Label', icon: Tag },
    { id: 'selection', label: 'Selection', icon: List },
];

const SELECTION_ELEMENTS = [
    { id: 'select', label: 'Dropdown', icon: List },
    { id: 'radio', label: 'Radio', icon: CircleDot },
    { id: 'checkbox', label: 'Checkbox', icon: CheckSquare },
];

const ADVANCED_ELEMENTS = [
    { id: 'date', label: 'Date & Time', icon: Clock },
    { id: 'file', label: 'Attachment', icon: Paperclip },
    { id: 'image', label: 'Image', icon: Image },
];

const ELEMENT_GROUPS = [
    { key: 'layout', label: 'LAYOUT', items: LAYOUT_ELEMENTS },
    { key: 'input', label: 'INPUT', items: INPUT_ELEMENTS },
    { key: 'selection', label: 'SELECTION', items: SELECTION_ELEMENTS },
    { key: 'advanced', label: 'ADVANCED / SYSTEM', items: ADVANCED_ELEMENTS },
];

interface SchemaPaletteProps {
    isCollapsed?: boolean;
}

function PaletteCard({
    icon: Icon,
    label,
    type,
    isCollapsed,
    onClick
}: {
    icon: React.ElementType;
    label: string;
    type: string;
    isCollapsed?: boolean;
    onClick: () => void;
}) {
    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, label }));
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
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-slate-200 bg-white hover:border-primary hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing min-h-[72px]"
        >
            <Icon size={20} className="text-slate-500" />
            <span className="text-[11px] font-medium text-slate-700 leading-tight text-center">{label}</span>
        </button>
    );
}

export function SchemaPalette({ isCollapsed = false }: SchemaPaletteProps) {
    const { addSchemaItem, activeStepId } = useStudioStore();

    const handleAdd = (type: string, label: string) => {
        if (!activeStepId) return;
        addSchemaItem(type, label);
    };

    return (
        <div className="flex flex-col gap-4">
            {ELEMENT_GROUPS.map((group) => (
                <div key={group.key} className="flex flex-col gap-2">
                    {!isCollapsed && (
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                            {group.label}
                        </span>
                    )}
                    <div className={`grid gap-2 ${isCollapsed ? 'grid-cols-1 px-1' : 'grid-cols-2'}`}>
                        {group.items.map(item => (
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
        </div>
    );
}
