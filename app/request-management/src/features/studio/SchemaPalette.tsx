import {
    Type, Hash, Calendar, List, CheckSquare, LayoutGrid,
    Table, CircleDot, Layers, Mail
} from 'lucide-react';
import { useStudioStore } from './useStudioStore';

// Form element definitions with icons matching the reference design
const LAYOUT_ELEMENTS = [
    { id: 'section', label: 'Section', icon: LayoutGrid },
    { id: 'table', label: 'Table', icon: Table },
];

const FIELD_ELEMENTS = [
    { id: 'text', label: 'Text Field', icon: Type },
    { id: 'number', label: 'Number', icon: Hash },
    { id: 'date', label: 'Date', icon: Calendar },
    { id: 'select', label: 'Dropdown', icon: List },
    { id: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { id: 'file', label: 'Upload', icon: Layers },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'radio', label: 'Radio', icon: CircleDot },
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
            {/* Layout Section */}
            {!isCollapsed && (
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                    Layout
                </span>
            )}
            <div className={`grid gap-2 ${isCollapsed ? 'grid-cols-1 px-1' : 'grid-cols-2'}`}>
                {LAYOUT_ELEMENTS.map(item => (
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

            {/* Form Elements Section */}
            {!isCollapsed && (
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mt-2">
                    Form Elements
                </span>
            )}
            <div className={`grid gap-2 ${isCollapsed ? 'grid-cols-1 px-1' : 'grid-cols-2'}`}>
                {FIELD_ELEMENTS.map(item => (
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
    );
}
