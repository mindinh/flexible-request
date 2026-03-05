import {
    Type, Hash, List, CheckSquare, LayoutGrid,
    Table, CircleDot, Mail, SlidersHorizontal,
    DollarSign, Tag, Image, Clock, Paperclip, Rows3, ScrollText, TextCursorInput, Database
} from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import type { SimpleDataType, UiDataField } from './types';

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

// Map data schema types to form control types
function dataTypeToControlType(dataType: SimpleDataType): string {
    switch (dataType) {
        case 'String': return 'text';
        case 'Number': return 'number';
        case 'Boolean': return 'checkbox';
        case 'DateTime': return 'date';
        case 'Object': return 'section';
        default: return 'text';
    }
}

interface SchemaPaletteProps {
    isCollapsed?: boolean;
}

function PaletteCard({
    icon: Icon,
    label,
    type,
    isCollapsed,
    onClick,
    dataFieldKey,
    subtitle,
}: {
    icon: React.ElementType;
    label: string;
    type: string;
    isCollapsed?: boolean;
    onClick: () => void;
    dataFieldKey?: string;
    subtitle?: string;
}) {
    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
        const payload: Record<string, string> = { type, label };
        if (dataFieldKey) payload.dataFieldKey = dataFieldKey;
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
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
            {subtitle && <span className="text-[9px] text-slate-400 leading-tight text-center truncate w-full">{subtitle}</span>}
        </button>
    );
}

export function SchemaPalette({ isCollapsed = false }: SchemaPaletteProps) {
    const { addSchemaItem, dataSchema, activeStepId } = useStudioStore();

    const handleAdd = (type: string, label: string) => {
        if (!activeStepId) return;
        addSchemaItem(type, label);
    };

    // Flatten data schema fields for the palette (including nested)
    const flattenDataFields = (fields: UiDataField[], prefix = ''): { key: string; label: string; type: SimpleDataType }[] => {
        const result: { key: string; label: string; type: SimpleDataType }[] = [];
        for (const field of fields) {
            const fullKey = prefix ? `${prefix}.${field.key}` : field.key;
            if (field.type === 'Object' && field.children?.length) {
                result.push(...flattenDataFields(field.children, fullKey));
            } else {
                result.push({ key: fullKey, label: field.label, type: field.type });
            }
        }
        return result;
    };

    const dataFields = flattenDataFields(dataSchema);

    return (
        <div className="flex flex-col gap-4">
            {/* Data Fields Section — shows fields from the Data Schema tab */}
            {dataFields.length > 0 && (
                <div className="flex flex-col gap-2">
                    {!isCollapsed && (
                        <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider px-1 flex items-center gap-1">
                            <Database size={10} />
                            DATA FIELDS
                        </span>
                    )}
                    <div className={`grid gap-2 ${isCollapsed ? 'grid-cols-1 px-1' : 'grid-cols-2'}`}>
                        {dataFields.map(field => {
                            const controlType = dataTypeToControlType(field.type);
                            const iconMap: Record<string, React.ElementType> = {
                                text: TextCursorInput,
                                number: Hash,
                                checkbox: CheckSquare,
                                date: Clock,
                                section: LayoutGrid,
                            };
                            const FieldIcon = iconMap[controlType] || Database;
                            return (
                                <PaletteCard
                                    key={field.key}
                                    icon={FieldIcon}
                                    label={field.label}
                                    type={controlType}
                                    isCollapsed={isCollapsed}
                                    onClick={() => handleAdd(controlType, field.label)}
                                    dataFieldKey={field.key}
                                    subtitle={field.key}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Standard Element Groups */}
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
