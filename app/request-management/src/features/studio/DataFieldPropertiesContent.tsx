import { useStudioStore } from './useStudioStore';
import type { UiDataField, SimpleDataType } from './types';
import { updateFieldInTree, findDataField, getTypeIcon } from './DataSchemaTab';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Trash2, Plus } from 'lucide-react';

const SIMPLE_TYPES: SimpleDataType[] = ['String', 'Number', 'Boolean', 'DateTime', 'Object'];

/**
 * Right-panel content for editing a selected Data Schema field.
 * Shows: General Information (Name, Key, Type), Sample value, Constraints.
 */
export function DataFieldPropertiesContent() {
    const {
        dataSchema,
        updateDataSchema,
        selectedDataFieldId,
        setSelectedDataFieldId,
    } = useStudioStore();

    const field = selectedDataFieldId ? findDataField(dataSchema, selectedDataFieldId) : null;

    if (!field) return null;

    const onUpdate = (updates: Partial<UiDataField>) => {
        updateDataSchema(updateFieldInTree(dataSchema, field.id, f => ({ ...f, ...updates })));
    };

    // Auto-generate key from label
    const handleLabelChange = (label: string) => {
        const isDefault = !field.label || field.key === field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const key = isDefault
            ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
            : field.key;
        onUpdate({ label, key });
    };

    const handleDelete = () => {
        updateDataSchema(updateFieldInTree(dataSchema, field.id, () => null));
        setSelectedDataFieldId(null);
    };

    const handleTypeChange = (type: SimpleDataType) => {
        const updates: Partial<UiDataField> = { type };
        // When changing to Object, ensure children array exists
        if (type === 'Object' && !field.children) {
            updates.children = [];
        }
        // When changing away from Object, remove children
        if (type !== 'Object') {
            updates.children = undefined;
        }
        onUpdate(updates);
    };

    const handleAddChild = () => {
        const siblings = field.children || [];
        const idx = siblings.length + 1;
        const child: UiDataField = {
            id: `df-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            key: `child_${idx}`,
            label: '',
            type: 'String',
        };
        onUpdate({ type: 'Object', children: [...(field.children || []), child] });
        setSelectedDataFieldId(child.id);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* ─── General Information ─── */}
                <section>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">General Information</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                                Name <span className="text-primary">*</span>
                            </label>
                            <Input
                                value={field.label}
                                onChange={(e) => handleLabelChange(e.target.value)}
                                placeholder="Field name"
                                className="h-9 text-sm"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                                Key <span className="text-primary">*</span>
                            </label>
                            <Input
                                value={field.key}
                                onChange={(e) => onUpdate({ key: e.target.value })}
                                placeholder="field_key"
                                className="h-9 text-sm font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                                Type <span className="text-primary">*</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {SIMPLE_TYPES.map(t => {
                                    const Icon = getTypeIcon(t);
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => handleTypeChange(t)}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all',
                                                field.type === t
                                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            )}
                                        >
                                            <Icon size={13} />
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── Sample Value ─── */}
                <section>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Settings</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Sample Value</label>
                            <Input
                                value={field.sampleValue || ''}
                                onChange={(e) => onUpdate({ sampleValue: e.target.value })}
                                placeholder="Sample value"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                </section>

                {/* ─── Constraints ─── */}
                <section>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Constraints</h3>
                    <div className="space-y-2.5">
                        <label className="flex items-center gap-3 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={field.isList || false}
                                onChange={(e) => onUpdate({ isList: e.target.checked })}
                                className="rounded border-slate-300 w-4 h-4"
                            />
                            <span className="text-sm text-slate-700">List</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={field.required || false}
                                onChange={(e) => onUpdate({ required: e.target.checked })}
                                className="rounded border-slate-300 w-4 h-4"
                            />
                            <span className="text-sm text-slate-700">Required</span>
                        </label>
                    </div>
                </section>

                {/* ─── Children (for Object type) ─── */}
                {field.type === 'Object' && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Children ({(field.children || []).length})
                            </h3>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleAddChild}
                            >
                                <Plus size={12} className="mr-1" />
                                New Child
                            </Button>
                        </div>
                        {(field.children || []).length > 0 && (
                            <div className="space-y-1 border rounded-lg p-2 bg-slate-50">
                                {field.children!.map(child => (
                                    <div
                                        key={child.id}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white cursor-pointer transition-colors text-xs"
                                        onClick={() => setSelectedDataFieldId(child.id)}
                                    >
                                        <span className="font-medium text-slate-700 flex-1 truncate">
                                            {child.label || <span className="text-slate-400 italic">untitled</span>}
                                        </span>
                                        <span className="text-slate-400">{child.type}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-200 p-3 flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                    onClick={handleDelete}
                >
                    <Trash2 size={12} className="mr-1.5" />
                    Delete Field
                </Button>
            </div>
        </div>
    );
}
