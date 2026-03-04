import { useState, useEffect, useRef } from 'react';
import { useStudioStore } from './useStudioStore';
import type { UiCanvasItem, UiSection, UiFormField, UiTableField } from './types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import {
    LayoutGrid, Table, Trash2, Layers, GripVertical, Download, Upload, Plus, Copy, Calendar,
    Code2, MousePointerClick, AlertTriangle, Eye, X, FilePlus, Pencil
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';

// ─── Drag context: shared drag state for swap logic ───
const DRAG_TYPE_FIELD = 'schema-field';
const DRAG_TYPE_COLUMN = 'schema-column';
const DRAG_TYPE_ITEM = 'schema-item';


// ─── Field Preview Component ───
function FieldPreview({ field }: { field: UiFormField }) {
    switch (field.type) {
        case 'text':
        case 'number':
            return <Input type={field.type} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`} readOnly />;
        case 'date':
            return (
                <div className="relative">
                    <Input placeholder={field.placeholder || 'Select date...'} readOnly />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
            );
        case 'select':
            return (
                <Select disabled>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}...`} />
                    </SelectTrigger>
                    <SelectContent />
                </Select>
            );
        case 'checkbox':
            return (
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-200 rounded bg-white" />
                    <span className="text-sm text-slate-500">{field.placeholder || 'Checkbox option'}</span>
                </div>
            );
        case 'radio':
            return (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 rounded-full bg-blue-500 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        <span className="text-sm text-slate-500">Option 1</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 rounded-full bg-white" />
                        <span className="text-sm text-slate-500">Option 2</span>
                    </div>
                </div>
            );
        case 'textarea':
            return (
                <Textarea
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    readOnly
                    className="min-h-[80px] resize-none"
                />
            );
        case 'email':
            return <Input placeholder={field.placeholder || 'email@example.com'} readOnly />;
        case 'phone':
            return <Input placeholder={field.placeholder || '+1 (555) 000-0000'} readOnly />;
        case 'currency':
            return (
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input className="pl-7" placeholder={field.placeholder || '0.00'} readOnly />
                </div>
            );
        case 'file':
            return (
                <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:border-slate-300">
                    <Layers size={18} className="text-slate-400" />
                    <span className="text-sm text-slate-500">{field.placeholder || 'Click to upload or drag file'}</span>
                </div>
            );
        case 'slider':
            return (
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">0</span>
                    <input type="range" min={0} max={100} defaultValue={50} className="flex-1 accent-primary" disabled />
                    <span className="text-xs text-slate-400">100</span>
                </div>
            );
        case 'label':
            return (
                <span className="text-sm text-slate-600 font-medium">{field.placeholder || field.label}</span>
            );
        case 'image':
            return (
                <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <Layers size={18} className="text-slate-400" />
                    <span className="text-sm text-slate-500">Image placeholder</span>
                </div>
            );
        case 'selection':
            return (
                <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">Option A</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 border border-slate-200">Option B</span>
                </div>
            );
        default:
            return <Input placeholder={`Enter ${field.label.toLowerCase()}...`} readOnly />;
    }
}

// ─── Swap utility ───
function swapItems<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
    const result = [...arr];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
}

// ─── Field Card Component ───
function FieldCard({ field, isSelected, onSelect, onDelete, onDragStart, onDragOver, onDrop, isDragOver }: {
    field: UiFormField;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    isDragOver: boolean;
}) {
    return (
        <Card
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
                "p-4 mb-3 cursor-pointer transition-all border-2",
                isSelected ? "border-primary shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.1)]" : "border-slate-200",
                isDragOver && "border-primary/50 bg-primary/5 scale-[1.02]"
            )}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                        <GripVertical size={16} />
                    </div>
                    <label className="text-sm font-medium text-slate-900">
                        {field.label}
                        {field.required && <span className="text-primary ml-1">*</span>}
                    </label>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <Trash2 size={16} />
                </Button>
            </div>
            <FieldPreview field={field} />
            {field.helpText && (
                <p className="text-xs text-slate-400 mt-1.5 italic">{field.helpText}</p>
            )}
        </Card>
    );
}

// ─── Draggable Section Field Item ───
function DraggableSectionField({ field, selectedFieldId, onFieldSelect, onFieldDelete, onDragStart, onDragOver, onDrop, isDragOver }: {
    field: UiFormField;
    selectedFieldId: string | null;
    onFieldSelect: (fieldId: string) => void;
    onFieldDelete: (fieldId: string) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    isDragOver: boolean;
}) {
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
                "p-3 rounded-lg cursor-pointer transition-all border-2 group relative bg-white overflow-hidden min-w-0",
                (() => {
                    const raw = (field.colSpan as number) || 6;
                    const span = raw === 1 ? 6 : raw === 2 ? 12 : raw;
                    const map: Record<number, string> = { 3: 'col-span-3', 6: 'col-span-6', 9: 'col-span-9', 12: 'col-span-12' };
                    return map[span] || 'col-span-6';
                })(),
                selectedFieldId === field.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-slate-300 hover:bg-slate-50",
                isDragOver && "border-primary/50 bg-primary/5 scale-[1.02]"
            )}
            onClick={(e) => {
                e.stopPropagation();
                onFieldSelect(field.id);
            }}
        >
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                        <GripVertical size={14} />
                    </div>
                    <label className="text-sm font-medium text-slate-900 pointer-events-none truncate">
                        {field.label}
                        {field.required && <span className="text-primary ml-1">*</span>}
                    </label>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        onFieldDelete(field.id);
                    }}
                >
                    <Trash2 size={14} />
                </Button>
            </div>
            <FieldPreview field={field} />
        </div>
    );
}

// ─── Section Card Component ───
function SectionCard({ section, isSelected, selectedFieldId, onSelect, onFieldSelect, onFieldDelete, onDelete, onFieldDrop, onSwapFields, dragOverFieldId, setDragOverFieldId, onItemDragStart, onItemDragOver, onItemDrop, isItemDragOver }: {
    section: UiSection;
    isSelected: boolean;
    selectedFieldId: string | null;
    onSelect: () => void;
    onFieldSelect: (fieldId: string) => void;
    onFieldDelete: (fieldId: string) => void;
    onDelete: () => void;
    onFieldDrop: (fieldType: string, fieldLabel: string) => void;
    onSwapFields: (fromId: string, toId: string) => void;
    dragOverFieldId: string | null;
    setDragOverFieldId: (id: string | null) => void;
    onItemDragStart: (e: React.DragEvent) => void;
    onItemDragOver: (e: React.DragEvent) => void;
    onItemDrop: (e: React.DragEvent) => void;
    isItemDragOver: boolean;
}) {
    const [isDragOver, setIsDragOver] = useState(false);
    const dragFieldIdRef = useRef<string | null>(null);

    const handlePaletteDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handlePaletteDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handlePaletteDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type && data.label && data.type !== 'section' && data.type !== 'table') {
                onFieldDrop(data.type, data.label);
            }
        } catch {
            // Not a palette drop, ignore
        }
    };

    const handleFieldDragStart = (fieldId: string) => (e: React.DragEvent) => {
        e.stopPropagation();
        dragFieldIdRef.current = fieldId;
        e.dataTransfer.setData(DRAG_TYPE_FIELD, fieldId);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
    };

    const handleFieldDragOver = (fieldId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFieldId(fieldId);
    };

    const handleFieldDrop = (targetFieldId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFieldId(null);
        const fromId = e.dataTransfer.getData(DRAG_TYPE_FIELD);
        if (fromId && fromId !== targetFieldId) {
            onSwapFields(fromId, targetFieldId);
        }
    };

    const handleFieldDragEnd = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
        dragFieldIdRef.current = null;
        setDragOverFieldId(null);
    };

    return (
        <Card
            draggable
            onDragStart={onItemDragStart}
            onDragOver={onItemDragOver}
            onDrop={onItemDrop}
            className={cn(
                "mb-3 overflow-hidden cursor-pointer transition-all border-2",
                isSelected ? "border-primary shadow-[0_0_0_3px_rgba(177,14,16,0.1)]" : "border-slate-200",
                isItemDragOver && "border-primary/50 bg-primary/5 scale-[1.01]"
            )}
            onClick={onSelect}
        >
            <div className={cn(
                "flex items-center gap-3 p-4 border-b border-slate-200",
                isSelected ? "bg-primary/5" : "bg-slate-50"
            )}>
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                    <GripVertical size={16} />
                </div>
                <LayoutGrid size={18} className={isSelected ? "text-primary" : "text-slate-500"} />
                <span className="flex-1 font-semibold text-slate-900">{section.label}</span>
                <Badge variant="outline">{section.fields.length} fields</Badge>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <Trash2 size={16} />
                </Button>
            </div>
            <div
                className={cn(
                    "p-4 min-h-[80px] transition-colors",
                    isDragOver ? "bg-primary/10 border-2 border-dashed border-primary" : ""
                )}
                onDragOver={handlePaletteDragOver}
                onDragLeave={handlePaletteDragLeave}
                onDrop={handlePaletteDrop}
            >
                {section.fields.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">Drop fields here</div>
                ) : (
                    <div className="grid grid-cols-12 gap-3">
                        {section.fields.map(field => (
                            <DraggableSectionField
                                key={field.id}
                                field={field}
                                selectedFieldId={selectedFieldId}
                                onFieldSelect={onFieldSelect}
                                onFieldDelete={onFieldDelete}
                                onDragStart={handleFieldDragStart(field.id)}
                                onDragOver={handleFieldDragOver(field.id)}
                                onDrop={handleFieldDrop(field.id)}
                                isDragOver={dragOverFieldId === field.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}

// ─── Draggable Table Column Header ───
function DraggableColumnHeader({ col, selectedColumnId, onColumnSelect, onColumnDelete, onDragStart, onDragOver, onDrop, isDragOver }: {
    col: UiFormField;
    selectedColumnId: string | null;
    onColumnSelect: (columnId: string) => void;
    onColumnDelete: (columnId: string) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    isDragOver: boolean;
}) {
    return (
        <th
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
                "p-3 text-left border-b border-slate-200 cursor-pointer transition-colors group min-w-[200px]",
                selectedColumnId === col.id ? "bg-primary/10" : "hover:bg-slate-100",
                isDragOver && "bg-primary/10 border-primary/50"
            )}
            onClick={(e) => {
                e.stopPropagation();
                onColumnSelect(col.id);
            }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none flex-shrink-0">
                        <GripVertical size={12} />
                    </div>
                    <span className="text-sm font-medium truncate">{col.label}</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onColumnDelete(col.id);
                    }}
                >
                    <Trash2 size={12} />
                </Button>
            </div>
        </th>
    );
}

// ─── Table Card Component ───
function TableCard({ table, isSelected, selectedColumnId, onSelect, onColumnSelect, onColumnDelete, onDelete, onColumnDrop, onSwapColumns, dragOverColumnId, setDragOverColumnId, onItemDragStart, onItemDragOver, onItemDrop, isItemDragOver }: {
    table: UiTableField;
    isSelected: boolean;
    selectedColumnId: string | null;
    onSelect: () => void;
    onColumnSelect: (columnId: string) => void;
    onColumnDelete: (columnId: string) => void;
    onDelete: () => void;
    onColumnDrop: (fieldType: string, fieldLabel: string) => void;
    onSwapColumns: (fromId: string, toId: string) => void;
    dragOverColumnId: string | null;
    setDragOverColumnId: (id: string | null) => void;
    onItemDragStart: (e: React.DragEvent) => void;
    onItemDragOver: (e: React.DragEvent) => void;
    onItemDrop: (e: React.DragEvent) => void;
    isItemDragOver: boolean;
}) {
    const [isDragOver, setIsDragOver] = useState(false);

    const handlePaletteDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handlePaletteDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handlePaletteDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type && data.label && data.type !== 'section' && data.type !== 'table') {
                onColumnDrop(data.type, data.label);
            }
        } catch {
            // Not a palette drop, ignore
        }
    };

    const handleColDragStart = (colId: string) => (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData(DRAG_TYPE_COLUMN, colId);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
    };

    const handleColDragOver = (colId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumnId(colId);
    };

    const handleColDrop = (targetColId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverColumnId(null);
        const fromId = e.dataTransfer.getData(DRAG_TYPE_COLUMN);
        if (fromId && fromId !== targetColId) {
            onSwapColumns(fromId, targetColId);
        }
    };

    const handleColDragEnd = (_e: React.DragEvent) => {
        setDragOverColumnId(null);
    };

    return (
        <Card
            draggable
            onDragStart={onItemDragStart}
            onDragOver={onItemDragOver}
            onDrop={onItemDrop}
            className={cn(
                "p-4 mb-3 cursor-pointer transition-all border-2",
                isSelected ? "border-primary shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.1)]" : "border-slate-200",
                isItemDragOver && "border-primary/50 bg-primary/5 scale-[1.01]"
            )}
            onClick={onSelect}
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                    <GripVertical size={16} />
                </div>
                <Table size={18} className={isSelected ? "text-primary" : "text-slate-500"} />
                <span className="flex-1 font-semibold text-slate-900">{table.label}</span>
                <Badge variant="outline">{table.columns.length} columns</Badge>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <Trash2 size={16} />
                </Button>
            </div>
            {/* Table Actions Header */}
            <div className="flex justify-end mb-2 px-1 gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-white" disabled>
                    <Plus size={12} className="mr-1.5" />
                    Add Row
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-white" disabled>
                    <Copy size={12} className="mr-1.5" />
                    Duplicate
                </Button>
                {table.headerActions?.downloadTemplate && (
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-white" disabled>
                        <Download size={12} className="mr-1.5" />
                        Download
                    </Button>
                )}
                {table.headerActions?.uploadExcel && (
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-white" disabled>
                        <Upload size={12} className="mr-1.5" />
                        Upload
                    </Button>
                )}
                <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-white text-red-600" disabled>
                    <Trash2 size={12} className="mr-1.5" />
                    Delete
                </Button>
            </div>
            <div
                className={cn(
                    "border border-slate-200 rounded-lg overflow-hidden transition-colors",
                    isDragOver ? "bg-primary/10 border-2 border-dashed border-primary" : ""
                )}
                onDragOver={handlePaletteDragOver}
                onDragLeave={handlePaletteDragLeave}
                onDrop={handlePaletteDrop}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                        <thead>
                            <tr className="bg-slate-50">
                                {/* Checkbox Header */}
                                <th className="p-3 w-12 text-center border-b border-slate-200 sticky left-0 bg-slate-50 z-10">
                                    <input type="checkbox" className="w-3 h-3 rounded border-gray-300" disabled />
                                </th>

                                {table.columns.length > 0 ? (
                                    table.columns.map(col => (
                                        <DraggableColumnHeader
                                            key={col.id}
                                            col={col}
                                            selectedColumnId={selectedColumnId}
                                            onColumnSelect={onColumnSelect}
                                            onColumnDelete={onColumnDelete}
                                            onDragStart={handleColDragStart(col.id)}
                                            onDragOver={handleColDragOver(col.id)}
                                            onDrop={handleColDrop(col.id)}
                                            isDragOver={dragOverColumnId === col.id}
                                        />
                                    ))
                                ) : (
                                    <th className="p-3 text-left border-b border-slate-200 text-slate-400">Drop columns here</th>
                                )}
                                {!table.columns.length && <th className="p-3 border-b border-slate-200"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={table.columns.length + 1 || 2} className="p-6 text-center text-slate-400">Table preview</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </Card>
    );
}

// ─── Main SchemaTab ───
interface SchemaTabProps {
    onFieldSelect?: (fieldId: string | null) => void;
    onPreview?: () => void;
}

export function SchemaTab({ onFieldSelect, onPreview }: SchemaTabProps) {
    const {
        schema,
        updateSchema,
        selectedSchemaFieldId,
        setSelectedSchemaFieldId,
        forms,
        activeFormId,
        addForm,
        deleteForm,
        selectForm,
        updateFormName,
    } = useStudioStore();

    const currentSchema = schema;
    const updateCurrentSchema = updateSchema;

    const [items, setItems] = useState<UiCanvasItem[]>(currentSchema);
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
    const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
    const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
    const dragItemIdRef = useRef<string | null>(null);

    // JSON Editor state
    const [viewMode, setViewMode] = useState<'builder' | 'json'>('builder');
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Form creation/editing state
    const [isCreatingForm, setIsCreatingForm] = useState(false);
    const [newFormName, setNewFormName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingName, setEditingName] = useState('');
    const newFormInputRef = useRef<HTMLInputElement>(null);

    const activeForm = forms.find(f => f.id === activeFormId);

    const handleJsonChange = (text: string) => {
        setJsonText(text);
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                setJsonError('Root must be an array');
                return;
            }
            setJsonError(null);
            setItems(parsed);
            updateCurrentSchema(parsed);
        } catch (e: any) {
            setJsonError(e.message);
        }
    };

    // When switching to JSON mode, sync the text
    useEffect(() => {
        if (viewMode === 'json') {
            setJsonText(JSON.stringify(items, null, 2));
            setJsonError(null);
        }
    }, [viewMode]);

    useEffect(() => {
        setItems(currentSchema);
    }, [currentSchema]);

    const addItem = (type: string, label: string) => {
        const newItem: UiCanvasItem = {
            id: `${type}-${Date.now()}`,
            type,
            label,
            required: false,
            ...(type === 'section' ? { fields: [], collapsed: false } : {}),
            ...(type === 'table' ? { columns: [] } : {}),
        } as UiCanvasItem;

        const newItems = [...items, newItem];
        setItems(newItems);
        updateCurrentSchema(newItems);
        setSelectedSchemaFieldId(newItem.id);
        onFieldSelect?.(newItem.id);
    };

    const deleteItem = (id: string) => {
        const newItems = items.filter(item => item.id !== id);
        setItems(newItems);
        updateCurrentSchema(newItems);
        if (selectedSchemaFieldId === id) {
            setSelectedSchemaFieldId(null);
            onFieldSelect?.(null);
        }
    };

    const selectField = (id: string) => {
        setSelectedSchemaFieldId(id);
        onFieldSelect?.(id);
    };

    const addFieldToSection = (sectionId: string, fieldType: string, fieldLabel: string) => {
        const defaultColSpan = ['textarea', 'radio'].includes(fieldType) ? 12 : 6;
        const newField: UiFormField = {
            id: `${fieldType}-${Date.now()}`,
            type: fieldType,
            label: fieldLabel,
            required: false,
            colSpan: defaultColSpan as 3 | 6 | 9 | 12,
        };

        const newItems = items.map(item => {
            if (item.id === sectionId && item.type === 'section') {
                const section = item as UiSection;
                return { ...section, fields: [...section.fields, newField] };
            }
            return item;
        });

        setItems(newItems);
        updateCurrentSchema(newItems);
    };

    const deleteFieldFromSection = (sectionId: string, fieldId: string) => {
        const newItems = items.map(item => {
            if (item.id === sectionId && item.type === 'section') {
                const section = item as UiSection;
                return { ...section, fields: section.fields.filter(f => f.id !== fieldId) };
            }
            return item;
        });

        setItems(newItems);
        updateCurrentSchema(newItems);
        if (selectedSchemaFieldId === fieldId) {
            setSelectedSchemaFieldId(null);
        }
    };

    const addColumnToTable = (tableId: string, fieldType: string, fieldLabel: string) => {
        const newColumn = {
            id: `col-${Date.now()}`,
            type: fieldType,
            label: fieldLabel,
        };

        const newItems = items.map(item => {
            if (item.id === tableId && item.type === 'table') {
                const table = item as UiTableField;
                return { ...table, columns: [...table.columns, newColumn] };
            }
            return item;
        });

        setItems(newItems);
        updateCurrentSchema(newItems);
    };

    const deleteColumnFromTable = (tableId: string, columnId: string) => {
        const newItems = items.map(item => {
            if (item.id === tableId && item.type === 'table') {
                const table = item as UiTableField;
                return { ...table, columns: table.columns.filter(c => c.id !== columnId) };
            }
            return item;
        });

        setItems(newItems);
        updateCurrentSchema(newItems);
        if (selectedSchemaFieldId === columnId) {
            setSelectedSchemaFieldId(null);
        }
    };

    // ─── Swap handlers ───
    const handleSwapItems = (fromId: string, toId: string) => {
        const fromIndex = items.findIndex(i => i.id === fromId);
        const toIndex = items.findIndex(i => i.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;
        const newItems = swapItems(items, fromIndex, toIndex);
        setItems(newItems);
        updateCurrentSchema(newItems);
    };

    const handleSwapSectionFields = (sectionId: string, fromFieldId: string, toFieldId: string) => {
        const newItems = items.map(item => {
            if (item.id === sectionId && item.type === 'section') {
                const section = item as UiSection;
                const fromIndex = section.fields.findIndex(f => f.id === fromFieldId);
                const toIndex = section.fields.findIndex(f => f.id === toFieldId);
                if (fromIndex === -1 || toIndex === -1) return item;
                return { ...section, fields: swapItems(section.fields, fromIndex, toIndex) };
            }
            return item;
        });
        setItems(newItems);
        updateCurrentSchema(newItems);
    };

    const handleSwapTableColumns = (tableId: string, fromColId: string, toColId: string) => {
        const newItems = items.map(item => {
            if (item.id === tableId && item.type === 'table') {
                const table = item as UiTableField;
                const fromIndex = table.columns.findIndex(c => c.id === fromColId);
                const toIndex = table.columns.findIndex(c => c.id === toColId);
                if (fromIndex === -1 || toIndex === -1) return item;
                return { ...table, columns: swapItems(table.columns, fromIndex, toIndex) };
            }
            return item;
        });
        setItems(newItems);
        updateCurrentSchema(newItems);
    };

    // ─── Top-level item drag handlers ───
    const handleItemDragStart = (itemId: string) => (e: React.DragEvent) => {
        dragItemIdRef.current = itemId;
        e.dataTransfer.setData(DRAG_TYPE_ITEM, itemId);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
    };

    const handleItemDragOver = (itemId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverItemId(itemId);
    };

    const handleItemDrop = (targetItemId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverItemId(null);
        const fromId = e.dataTransfer.getData(DRAG_TYPE_ITEM);
        if (fromId && fromId !== targetItemId) {
            handleSwapItems(fromId, targetItemId);
        }
    };

    const handleItemDragEnd = () => {
        dragItemIdRef.current = null;
        setDragOverItemId(null);
    };

    // If no form exists, show empty state with create button
    if (forms.length === 0) {
        return (
            <div className="flex h-full w-full bg-slate-100 items-center justify-center">
                <div className="text-center">
                    <Layers size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Forms Yet</h3>
                    <p className="text-sm text-slate-500 mb-6">Create your first form layout to get started</p>
                    {isCreatingForm ? (
                        <div className="flex items-center gap-2 justify-center">
                            <Input
                                ref={newFormInputRef}
                                value={newFormName}
                                onChange={(e) => setNewFormName(e.target.value)}
                                placeholder="Form name..."
                                className="w-48"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { const name = newFormName.trim(); if (name) { addForm(name); setNewFormName(''); setIsCreatingForm(false); } }
                                    if (e.key === 'Escape') { setIsCreatingForm(false); setNewFormName(''); }
                                }}
                            />
                            <Button size="sm" onClick={() => { const name = newFormName.trim(); if (name) { addForm(name); setNewFormName(''); setIsCreatingForm(false); } }}>Create</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setIsCreatingForm(false); setNewFormName(''); }}>Cancel</Button>
                        </div>
                    ) : (
                        <Button onClick={() => setIsCreatingForm(true)} className="gap-2">
                            <FilePlus size={16} />
                            Create First Form
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-slate-100 overflow-hidden">
            {/* Canvas Area - Full Width (palette moved to sidebar) */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Toolbar: Form Management + View Toggle + Preview */}
                <div className="flex items-center gap-2 px-6 pt-4 pb-2">
                    {/* Left: Form Selector with inline rename */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {/* Form select dropdown */}
                        <Select value={activeFormId || ''} onValueChange={(val) => selectForm(val)}>
                            <SelectTrigger className="w-48 bg-white h-8 text-sm border-slate-200 shadow-sm">
                                <SelectValue placeholder="Select a form" />
                            </SelectTrigger>
                            <SelectContent>
                                {forms.map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Rename (inline) */}
                        {activeForm && (
                            isEditingName ? (
                                <Input
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="w-40 h-8 text-sm shadow-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { if (activeFormId && editingName.trim()) updateFormName(activeFormId, editingName.trim()); setIsEditingName(false); }
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                    onBlur={() => { if (activeFormId && editingName.trim()) updateFormName(activeFormId, editingName.trim()); setIsEditingName(false); }}
                                />
                            ) : (
                                <button
                                    onClick={() => { setEditingName(activeForm.name); setIsEditingName(true); }}
                                    className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                                    title="Rename form"
                                >
                                    <Pencil size={13} />
                                </button>
                            )
                        )}

                        {/* Separator */}
                        <div className="w-px h-5 bg-slate-200 mx-0.5" />

                        {/* New Form */}
                        {isCreatingForm ? (
                            <div className="flex items-center gap-1">
                                <Input
                                    ref={newFormInputRef}
                                    value={newFormName}
                                    onChange={(e) => setNewFormName(e.target.value)}
                                    placeholder="Form name..."
                                    className="w-32 h-8 text-sm shadow-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { const n = newFormName.trim(); if (n) { addForm(n); setNewFormName(''); setIsCreatingForm(false); } }
                                        if (e.key === 'Escape') { setIsCreatingForm(false); setNewFormName(''); }
                                    }}
                                />
                                <button
                                    onClick={() => { const n = newFormName.trim(); if (n) { addForm(n); setNewFormName(''); setIsCreatingForm(false); } }}
                                    className="h-8 w-8 flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    onClick={() => { setIsCreatingForm(false); setNewFormName(''); }}
                                    className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCreatingForm(true)}
                                className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition-colors"
                                title="Create new form"
                            >
                                <FilePlus size={13} />
                                <span className="hidden sm:inline">New</span>
                            </button>
                        )}

                        {/* Delete Form */}
                        {activeFormId && (
                            <button
                                onClick={() => { if (window.confirm(`Delete form "${activeForm?.name}"?`)) deleteForm(activeFormId); }}
                                className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete form"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>

                    {/* View Toggle + Preview */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setViewMode('builder')}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                    viewMode === 'builder'
                                        ? 'bg-primary/10 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                <MousePointerClick size={14} />
                                Builder
                            </button>
                            <button
                                onClick={() => setViewMode('json')}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                    viewMode === 'json'
                                        ? 'bg-primary/10 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                <Code2 size={14} />
                                JSON
                            </button>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPreview?.()}
                            className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                        >
                            <Eye size={14} />
                            Preview
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'json' ? (
                    /* JSON Editor */
                    <div className="flex-1 px-6 pb-6 overflow-hidden flex flex-col">
                        <div className="flex-1 flex rounded-lg overflow-hidden border-2 border-slate-700 bg-[#1e1e2e]"
                            style={{ minHeight: 0 }}>
                            {/* Line Number Gutter */}
                            <div
                                className="w-12 flex-shrink-0 bg-[#181825] text-slate-500 font-mono text-xs leading-6 pt-3 pr-2 text-right select-none overflow-hidden border-r border-slate-700"
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
                            {/* Code Editor */}
                            <textarea
                                ref={jsonTextareaRef}
                                value={jsonText}
                                onChange={(e) => handleJsonChange(e.target.value)}
                                className={cn(
                                    'flex-1 px-4 py-3 font-mono text-xs leading-6 bg-transparent text-[#a6e3a1] resize-none focus:outline-none',
                                    'placeholder:text-slate-600 caret-[#f5c2e7]'
                                )}
                                spellCheck={false}
                                placeholder="[]"
                            />
                        </div>
                        {jsonError && (
                            <div className="mt-2 flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                                <AlertTriangle size={14} />
                                {jsonError}
                            </div>
                        )}
                        {!jsonError && jsonText && (
                            <div className="mt-2 flex items-center gap-2 text-green-600 text-xs bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                                ✓ Valid JSON · {items.length} item{items.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Drag-and-Drop Builder */
                    <div className="flex-1 p-6 overflow-y-auto flex justify-center">
                        <div className="w-full max-w-[900px]">
                            {items.length === 0 ? (
                                <div
                                    className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-300 rounded-xl bg-white/60 transition-colors"
                                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        try {
                                            const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                            if (data.type && data.label) {
                                                addItem(data.type, data.label);
                                            }
                                        } catch {
                                            // ignore
                                        }
                                    }}
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                        <Layers size={32} className="text-slate-400" />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-900 mb-2">Start Building</h3>
                                    <p className="text-sm text-slate-500 text-center">
                                        Click or drag elements from the sidebar to add them to your form
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <div className="space-y-0" onDragEnd={handleItemDragEnd}>
                                        {items.map(item => {
                                            const isSelected = selectedSchemaFieldId === item.id;
                                            const isOver = dragOverItemId === item.id;

                                            if (item.type === 'section') {
                                                return (
                                                    <SectionCard
                                                        key={item.id}
                                                        section={item as UiSection}
                                                        isSelected={isSelected}
                                                        selectedFieldId={selectedSchemaFieldId}
                                                        onSelect={() => selectField(item.id)}
                                                        onFieldSelect={(fieldId) => selectField(fieldId)}
                                                        onFieldDelete={(fieldId) => deleteFieldFromSection(item.id, fieldId)}
                                                        onDelete={() => deleteItem(item.id)}
                                                        onFieldDrop={(type, label) => addFieldToSection(item.id, type, label)}
                                                        onSwapFields={(fromId, toId) => handleSwapSectionFields(item.id, fromId, toId)}
                                                        dragOverFieldId={dragOverFieldId}
                                                        setDragOverFieldId={setDragOverFieldId}
                                                        onItemDragStart={handleItemDragStart(item.id)}
                                                        onItemDragOver={handleItemDragOver(item.id)}
                                                        onItemDrop={handleItemDrop(item.id)}
                                                        isItemDragOver={isOver}
                                                    />
                                                );
                                            } else if (item.type === 'table') {
                                                return (
                                                    <TableCard
                                                        key={item.id}
                                                        table={item as UiTableField}
                                                        isSelected={isSelected}
                                                        selectedColumnId={selectedSchemaFieldId}
                                                        onSelect={() => selectField(item.id)}
                                                        onColumnSelect={(columnId) => selectField(columnId)}
                                                        onColumnDelete={(columnId) => deleteColumnFromTable(item.id, columnId)}
                                                        onDelete={() => deleteItem(item.id)}
                                                        onColumnDrop={(type, label) => addColumnToTable(item.id, type, label)}
                                                        onSwapColumns={(fromId, toId) => handleSwapTableColumns(item.id, fromId, toId)}
                                                        dragOverColumnId={dragOverColumnId}
                                                        setDragOverColumnId={setDragOverColumnId}
                                                        onItemDragStart={handleItemDragStart(item.id)}
                                                        onItemDragOver={handleItemDragOver(item.id)}
                                                        onItemDrop={handleItemDrop(item.id)}
                                                        isItemDragOver={isOver}
                                                    />
                                                );
                                            } else {
                                                return (
                                                    <FieldCard
                                                        key={item.id}
                                                        field={item as UiFormField}
                                                        isSelected={isSelected}
                                                        onSelect={() => selectField(item.id)}
                                                        onDelete={() => deleteItem(item.id)}
                                                        onDragStart={handleItemDragStart(item.id)}
                                                        onDragOver={handleItemDragOver(item.id)}
                                                        onDrop={handleItemDrop(item.id)}
                                                        isDragOver={isOver}
                                                    />
                                                );
                                            }
                                        })}
                                    </div>

                                    {/* Drop zone at the bottom */}
                                    <div
                                        className="mt-4 flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-white/40 hover:bg-white/60 hover:border-slate-400 transition-colors cursor-pointer"
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            try {
                                                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                                if (data.type && data.label) {
                                                    addItem(data.type, data.label);
                                                }
                                            } catch {
                                                // ignore
                                            }
                                        }}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                            <Plus size={20} className="text-primary" />
                                        </div>
                                        <p className="text-sm text-slate-500">Drop here to add a new section</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Form Preview Dialog */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[800px] max-h-[85vh] flex flex-col">
                        {/* Preview Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Eye size={16} className="text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Form Preview</h3>
                            </div>
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        {/* Preview Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Layers size={40} className="text-slate-300 mb-3" />
                                    <p className="text-slate-500">No form fields yet. Add elements from the palette.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {items.map(item => {
                                        if (item.type === 'section') {
                                            const section = item as UiSection;
                                            return (
                                                <div key={section.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                                                    <h4 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                                                        {section.label}
                                                    </h4>
                                                    <div className="grid grid-cols-12 gap-4">
                                                        {section.fields.map(field => (
                                                            <div key={field.id} className={`col-span-${field.colSpan || 6}`}>
                                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                    {field.label}
                                                                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                                                </label>
                                                                <FieldPreview field={field} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        } else if (item.type === 'table') {
                                            const table = item as UiTableField;
                                            return (
                                                <div key={table.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                                        <h4 className="text-sm font-semibold text-slate-800">{table.label}</h4>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-50">
                                                                <tr>
                                                                    {table.columns.map(col => (
                                                                        <th key={col.id} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                                                            {col.label}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr className="border-t border-slate-100">
                                                                    {table.columns.map(col => (
                                                                        <td key={col.id} className="px-4 py-3">
                                                                            <FieldPreview field={col} />
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            const field = item as UiFormField;
                                            return (
                                                <div key={field.id}>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                        {field.label}
                                                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                                    </label>
                                                    <FieldPreview field={field} />
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
