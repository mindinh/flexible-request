import { useState, useEffect, useRef, useCallback } from 'react';
import { useStudioStore } from './useStudioStore';
import type { UiDataField, SimpleDataType } from './types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
    Plus, Search, Code2, LayoutList, AlertTriangle,
    ChevronRight, ChevronDown, Type, Hash, ToggleLeft,
    Calendar, Braces
} from 'lucide-react';

// ─── Type icon/label mapping ───
const TYPE_CONFIG: Record<SimpleDataType, { icon: typeof Type; label: string }> = {
    String: { icon: Type, label: 'String' },
    Number: { icon: Hash, label: 'Number' },
    Boolean: { icon: ToggleLeft, label: 'Boolean' },
    DateTime: { icon: Calendar, label: 'DateTime' },
    Object: { icon: Braces, label: 'Object' },
};

export function getTypeIcon(type: SimpleDataType) {
    return TYPE_CONFIG[type]?.icon || Type;
}

function genId() {
    return `df-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createSkeletonField(parentFields: UiDataField[]): UiDataField {
    const idx = parentFields.length + 1;
    return {
        id: genId(),
        key: `field_${idx}`,
        label: '',
        type: 'String',
        required: false,
    };
}

// ─── Recursive helper: update a field anywhere in the tree ───
function updateFieldInTree(fields: UiDataField[], id: string, updater: (f: UiDataField) => UiDataField | null): UiDataField[] {
    const result: UiDataField[] = [];
    for (const field of fields) {
        if (field.id === id) {
            const updated = updater(field);
            if (updated) result.push(updated); // null = delete
        } else {
            const newField = { ...field };
            if (newField.children) {
                newField.children = updateFieldInTree(newField.children, id, updater);
            }
            result.push(newField);
        }
    }
    return result;
}

function addChildToField(fields: UiDataField[], parentId: string, child: UiDataField): UiDataField[] {
    return fields.map(f => {
        if (f.id === parentId) {
            return {
                ...f,
                type: 'Object' as SimpleDataType,
                children: [...(f.children || []), child],
            };
        }
        if (f.children) {
            return { ...f, children: addChildToField(f.children, parentId, child) };
        }
        return f;
    });
}

// ─── Tree Row Component ───
function FieldTreeRow({
    field, depth, selectedId, onSelect, onAddChild
}: {
    field: UiDataField;
    depth: number;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAddChild: (parentId: string) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = field.type === 'Object' && field.children && field.children.length > 0;
    const Icon = getTypeIcon(field.type);
    const isSelected = selectedId === field.id;

    return (
        <>
            <tr
                className={cn(
                    'group cursor-pointer transition-colors border-b border-slate-100',
                    isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'
                )}
                onClick={() => onSelect(field.id)}
            >
                {/* Name */}
                <td className="py-2.5 pr-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
                    <div className="flex items-center gap-1.5">
                        {hasChildren ? (
                            <button
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
                                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            >
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span className="w-5" /> /* spacer */
                        )}
                        <span className={cn(
                            'text-sm font-medium',
                            isSelected ? 'text-primary' : 'text-slate-900'
                        )}>
                            {field.label || <span className="text-slate-400 italic">untitled</span>}
                        </span>
                    </div>
                </td>
                {/* Type */}
                <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                        <Icon size={13} className="text-slate-400" />
                        <span className="text-xs text-slate-600">{field.type}</span>
                    </div>
                </td>
                {/* Sample */}
                <td className="py-2.5 px-3">
                    <span className="text-xs text-slate-400">{field.sampleValue || '—'}</span>
                </td>
                {/* List */}
                <td className="py-2.5 px-3 text-center">
                    <span className="text-xs text-slate-500">{field.isList ? 'Yes' : 'No'}</span>
                </td>
                {/* Required */}
                <td className="py-2.5 px-3 text-center">
                    <span className="text-xs text-slate-500">{field.required ? 'Yes' : 'No'}</span>
                </td>
                {/* Actions */}
                <td className="py-2.5 pl-3 pr-4 text-right">
                    <Button
                        variant="link"
                        size="sm"
                        className="h-6 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity p-0"
                        onClick={(e) => { e.stopPropagation(); onAddChild(field.id); }}
                    >
                        New Child
                    </Button>
                </td>
            </tr>
            {/* Render children */}
            {hasChildren && expanded && field.children!.map(child => (
                <FieldTreeRow
                    key={child.id}
                    field={child}
                    depth={depth + 1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onAddChild={onAddChild}
                />
            ))}
        </>
    );
}

// ─── Main DataSchemaTab ───
export function DataSchemaTab() {
    const {
        dataSchema,
        updateDataSchema,
        selectedDataFieldId,
        setSelectedDataFieldId,
    } = useStudioStore();

    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showJson, setShowJson] = useState(true);

    // Sync JSON text from store
    useEffect(() => {
        setJsonText(JSON.stringify(dataSchema, null, 2));
        setJsonError(null);
    }, [dataSchema]);

    const handleJsonChange = useCallback((text: string) => {
        setJsonText(text);
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                setJsonError('Data schema must be a JSON array');
                return;
            }
            setJsonError(null);
            updateDataSchema(parsed);
        } catch (e) {
            setJsonError((e as Error).message);
        }
    }, [updateDataSchema]);

    // Add a top-level skeleton field and select it
    const handleAddField = () => {
        const newField = createSkeletonField(dataSchema);
        updateDataSchema([...dataSchema, newField]);
        setSelectedDataFieldId(newField.id);
    };

    // Add a child to any field (converts parent to Object)
    const handleAddChild = (parentId: string) => {
        const parent = findFieldById(dataSchema, parentId);
        const siblings = parent?.children || [];
        const child = createSkeletonField(siblings);
        updateDataSchema(addChildToField(dataSchema, parentId, child));
        setSelectedDataFieldId(child.id);
    };

    // Count all fields recursively
    const countFields = (fields: UiDataField[]): number =>
        fields.reduce((sum, f) => sum + 1 + (f.children ? countFields(f.children) : 0), 0);

    // Simple filter (top-level only for now)
    const filteredFields = searchQuery
        ? dataSchema.filter(f =>
            f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.key.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : dataSchema;

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* ─── LEFT: Visualizer Table ─── */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200 bg-white">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
                    <div className="flex-1 flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search fields..."
                                className="h-8 text-sm pl-8 w-[200px]"
                            />
                        </div>
                        <Badge variant="outline" className="text-xs">
                            {countFields(dataSchema)} field{countFields(dataSchema) !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                    <button
                        onClick={() => setShowJson(!showJson)}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all h-8',
                            showJson
                                ? 'border-slate-300 bg-slate-100 text-slate-700'
                                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
                        )}
                        title={showJson ? 'Hide JSON Editor' : 'Show JSON Editor'}
                    >
                        <Code2 size={14} />
                        JSON
                    </button>
                    <Button
                        size="sm"
                        onClick={handleAddField}
                        className="gap-1.5 h-8"
                    >
                        <Plus size={14} />
                        New Field
                    </Button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    {filteredFields.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                <LayoutList size={28} className="text-slate-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 mb-1">
                                {searchQuery ? 'No Fields Found' : 'No Data Fields Yet'}
                            </h3>
                            <p className="text-xs text-slate-500 text-center mb-3">
                                {searchQuery
                                    ? 'Try adjusting your search'
                                    : 'Define the data structure for your request type'}
                            </p>
                            {!searchQuery && (
                                <Button size="sm" onClick={handleAddField} className="h-7 text-xs">
                                    <Plus size={12} className="mr-1" />
                                    New Field
                                </Button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="text-left text-xs font-semibold text-slate-600 py-2.5 pl-4 pr-3">Name</th>
                                    <th className="text-left text-xs font-semibold text-slate-600 py-2.5 px-3">Type</th>
                                    <th className="text-left text-xs font-semibold text-slate-600 py-2.5 px-3">Sample</th>
                                    <th className="text-center text-xs font-semibold text-slate-600 py-2.5 px-3">List</th>
                                    <th className="text-center text-xs font-semibold text-slate-600 py-2.5 px-3">Required</th>
                                    <th className="text-right text-xs font-semibold text-slate-600 py-2.5 pl-3 pr-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFields.map(field => (
                                    <FieldTreeRow
                                        key={field.id}
                                        field={field}
                                        depth={0}
                                        selectedId={selectedDataFieldId}
                                        onSelect={(id) => setSelectedDataFieldId(
                                            selectedDataFieldId === id ? null : id
                                        )}
                                        onAddChild={handleAddChild}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ─── RIGHT: JSON Editor (toggleable) ─── */}
            {showJson && (
                <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden bg-[#1e1e2e]">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-[#181825]">
                        <Code2 size={14} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-300">JSON Schema</span>
                        <div className="flex-1" />
                        {jsonError ? (
                            <Badge variant="destructive" className="text-[10px] h-5">Error</Badge>
                        ) : (
                            <Badge className="text-[10px] h-5 bg-green-500/20 text-green-400 border-green-500/30">Valid</Badge>
                        )}
                    </div>
                    {/* Editor */}
                    <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
                        {/* Line Number Gutter */}
                        <div
                            className="w-10 flex-shrink-0 bg-[#181825] text-slate-600 font-mono text-xs leading-6 pt-3 pr-2 text-right select-none overflow-hidden"
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
                        {/* Textarea */}
                        <textarea
                            ref={jsonTextareaRef}
                            value={jsonText}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            className="flex-1 px-3 py-3 font-mono text-xs leading-6 bg-transparent text-[#a6e3a1] resize-none focus:outline-none placeholder:text-slate-600 caret-[#f5c2e7]"
                            spellCheck={false}
                            placeholder="[]"
                        />
                    </div>
                    {/* Status bar */}
                    {jsonError && (
                        <div className="flex items-center gap-2 px-3 py-2 text-red-400 text-[11px] bg-red-500/10 border-t border-red-500/20">
                            <AlertTriangle size={12} />
                            <span className="truncate">{jsonError}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Helper: find a field by ID in the tree
function findFieldById(fields: UiDataField[], id: string): UiDataField | null {
    for (const f of fields) {
        if (f.id === id) return f;
        if (f.children) {
            const found = findFieldById(f.children, id);
            if (found) return found;
        }
    }
    return null;
}

// Export helpers for use in DataFieldPropertiesContent
export { updateFieldInTree, findFieldById as findDataField };
