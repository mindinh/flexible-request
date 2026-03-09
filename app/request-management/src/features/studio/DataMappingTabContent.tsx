import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, AlertTriangle, Link2, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import type { UiNodeInput, UiNodeOutput, UiDataField } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Flatten nested data schema fields into a searchable list */
function flattenDataFields(
    fields: UiDataField[],
    prefix = ''
): { key: string; label: string; type: string }[] {
    const result: { key: string; label: string; type: string }[] = [];
    for (const field of fields) {
        const fullKey = prefix ? `${prefix}.${field.key}` : field.key;
        if (field.type === 'Object' && field.children?.length) {
            if (field.isList) {
                // Expose the list itself as an array-type target for table binding
                result.push({ key: fullKey, label: field.label, type: 'array' });
            }
            // Also flatten children for column-level mapping
            result.push(...flattenDataFields(field.children, fullKey));
        } else {
            result.push({ key: fullKey, label: field.label, type: field.type });
        }
    }
    return result;
}

// ─── Row Components ───────────────────────────────────────────────────────

export function MappingRow({
    mapping,
    onAliasChange,
    onRemove,
    isInvalid,
    isReadOnly,
}: {
    mapping: { sourcePath: string; alias?: string; type?: string; derivedFrom?: string };
    onAliasChange?: (alias: string) => void;
    onRemove?: () => void;
    isInvalid?: boolean;
    isReadOnly?: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors group ${isInvalid
                ? 'border-red-300 bg-red-50/50'
                : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
        >
            {/* Path + Type badge */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <Link2 size={12} className={isInvalid ? 'text-red-400' : 'text-slate-400'} />
                    <code className="text-xs font-mono text-slate-700 truncate">
                        {mapping.sourcePath}
                    </code>
                    {mapping.type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium flex-shrink-0">
                            {mapping.type}
                        </span>
                    )}
                    {mapping.derivedFrom === 'formLayout' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium flex-shrink-0">
                            form
                        </span>
                    )}
                </div>
                {isInvalid && (
                    <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        Field not found in Data Schema
                    </p>
                )}
            </div>

            {/* Alias input */}
            {!isReadOnly && onAliasChange && (
                <Input
                    value={mapping.alias || ''}
                    onChange={(e) => onAliasChange(e.target.value)}
                    placeholder="alias"
                    className="w-24 h-7 text-xs border-slate-200"
                />
            )}

            {/* Remove */}
            {!isReadOnly && onRemove && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={onRemove}
                >
                    <Trash2 size={12} />
                </Button>
            )}
        </div>
    );
}

// ─── Add Mapping Picker ───────────────────────────────────────────────────

export function AddFieldPicker({
    availableFields,
    usedPaths,
    onAdd,
}: {
    availableFields: { key: string; label: string; type: string }[];
    usedPaths: Set<string>;
    onAdd: (path: string, type: string) => void;
}) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return availableFields.filter(
            (f) =>
                !usedPaths.has(f.key) &&
                (f.key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))
        );
    }, [availableFields, usedPaths, search]);

    if (availableFields.length === 0) {
        return (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <p className="text-xs text-amber-600">
                    No Data Schema fields defined. Add fields in the Data Schema tab first.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="pl-8 h-8 text-xs"
                />
            </div>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filtered.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 text-center italic">
                        {search ? 'No matching fields' : 'All fields mapped'}
                    </p>
                ) : (
                    filtered.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => onAdd(f.key, f.type)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                        >
                            <code className="text-xs font-mono text-slate-700 flex-1 truncate">{f.key}</code>
                            <span className="text-[10px] text-slate-400">{f.label}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                                {f.type}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Section Components ───────────────────────────────────────────────────

export function InputsSection({
    inputs,
    availableFields,
    validPaths,
    onUpdate,
}: {
    inputs: UiNodeInput[];
    availableFields: { key: string; label: string; type: string }[];
    validPaths: Set<string>;
    onUpdate: (inputs: UiNodeInput[]) => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const usedPaths = new Set(inputs.map((i) => i.sourcePath));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <ArrowDownToLine size={14} className="text-blue-500" />
                    Inputs
                    <span className="text-slate-400 font-normal">({inputs.length})</span>
                </Label>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => setShowPicker(!showPicker)}
                >
                    <Plus size={12} className="mr-1" />
                    Add
                </Button>
            </div>

            {showPicker && (
                <AddFieldPicker
                    availableFields={availableFields}
                    usedPaths={usedPaths}
                    onAdd={(path, type) => {
                        onUpdate([...inputs, { sourcePath: path, type }]);
                        setShowPicker(false);
                    }}
                />
            )}

            {inputs.length === 0 && !showPicker && (
                <p className="text-xs text-slate-400 italic text-center py-3">No inputs configured</p>
            )}

            <div className="space-y-1">
                {inputs.map((input, idx) => (
                    <MappingRow
                        key={input.sourcePath}
                        mapping={input}
                        isInvalid={!validPaths.has(input.sourcePath)}
                        onAliasChange={(alias) => {
                            const updated = [...inputs];
                            updated[idx] = { ...updated[idx], alias: alias || undefined };
                            onUpdate(updated);
                        }}
                        onRemove={() => onUpdate(inputs.filter((_, i) => i !== idx))}
                    />
                ))}
            </div>
        </div>
    );
}

export function OutputsSection({
    outputs,
    availableFields,
    validPaths,
    isUserTask,
    nodeId,
    onUpdate,
}: {
    outputs: UiNodeOutput[];
    availableFields: { key: string; label: string; type: string }[];
    validPaths: Set<string>;
    isUserTask: boolean;
    nodeId: string;
    onUpdate: (outputs: UiNodeOutput[]) => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const syncUserTaskOutputs = useStudioStore((s) => s.syncUserTaskOutputs);
    const usedPaths = new Set(outputs.map((o) => o.sourcePath));

    const hasDerivedOutputs = outputs.some((o) => o.derivedFrom === 'formLayout');

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <ArrowUpFromLine size={14} className="text-emerald-500" />
                    Outputs
                    <span className="text-slate-400 font-normal">({outputs.length})</span>
                </Label>
                <div className="flex gap-1">
                    {isUserTask && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-emerald-600 hover:text-emerald-700"
                            onClick={() => syncUserTaskOutputs(nodeId)}
                            title="Sync outputs from form layout"
                        >
                            <RefreshCw size={12} className="mr-1" />
                            Sync
                        </Button>
                    )}
                    {!isUserTask && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-emerald-600 hover:text-emerald-700"
                            onClick={() => setShowPicker(!showPicker)}
                        >
                            <Plus size={12} className="mr-1" />
                            Add
                        </Button>
                    )}
                </div>
            </div>

            {/* User Task info banner */}
            {isUserTask && hasDerivedOutputs && (
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-[11px] text-blue-600">
                        Outputs are derived from the assigned form's bound fields.
                        Click <strong>Sync</strong> to refresh after editing the form.
                    </p>
                </div>
            )}

            {isUserTask && !hasDerivedOutputs && outputs.length === 0 && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-[11px] text-amber-600">
                        Assign a form to this task and click <strong>Sync</strong> to derive outputs from form fields.
                    </p>
                </div>
            )}

            {showPicker && !isUserTask && (
                <AddFieldPicker
                    availableFields={availableFields}
                    usedPaths={usedPaths}
                    onAdd={(path, type) => {
                        onUpdate([...outputs, { sourcePath: path, type, derivedFrom: 'manual' }]);
                        setShowPicker(false);
                    }}
                />
            )}

            {outputs.length === 0 && !showPicker && !isUserTask && (
                <p className="text-xs text-slate-400 italic text-center py-3">No outputs configured</p>
            )}

            <div className="space-y-1">
                {outputs.map((output, idx) => (
                    <MappingRow
                        key={output.sourcePath}
                        mapping={output}
                        isInvalid={!validPaths.has(output.sourcePath)}
                        isReadOnly={isUserTask && output.derivedFrom === 'formLayout'}
                        onAliasChange={
                            isUserTask && output.derivedFrom === 'formLayout'
                                ? undefined
                                : (alias) => {
                                    const updated = [...outputs];
                                    updated[idx] = { ...updated[idx], alias: alias || undefined };
                                    onUpdate(updated);
                                }
                        }
                        onRemove={
                            isUserTask && output.derivedFrom === 'formLayout'
                                ? undefined
                                : () => onUpdate(outputs.filter((_, i) => i !== idx))
                        }
                    />
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Exported Component
// ═══════════════════════════════════════════════════════════════════════════

export function DataMappingTabContent() {
    const { workflow, activeStepId, dataSchema, updateNodeInputs, updateNodeOutputs } = useStudioStore();
    const node = workflow.nodes.find((n) => n.id === activeStepId);

    if (!node) {
        return (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400 italic">
                Select a workflow step to configure data mappings
            </div>
        );
    }

    const inputs = (node.data.inputs as UiNodeInput[]) || [];
    const outputs = (node.data.outputs as UiNodeOutput[]) || [];
    const isUserTask = (node.data.actionSubType === 'form' || node.data.actionSubType === 'user_task' || node.data.actionSubType === 'userTask') || node.type === 'actionNode' && (node.data.actionSubType === 'form' || node.data.actionSubType === 'user_task' || node.data.actionSubType === 'userTask');

    // Flatten available fields from data schema
    const availableFields = flattenDataFields(dataSchema);
    const validPaths = new Set(availableFields.map((f) => f.key));

    // Check for any invalid mappings
    const hasInvalidInputs = inputs.some((i) => !validPaths.has(i.sourcePath));
    const hasInvalidOutputs = outputs.some((o) => !validPaths.has(o.sourcePath));

    return (
        <div className="flex flex-col gap-5 px-1">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <h4 className="font-semibold text-slate-800 text-sm">Data Mapping</h4>
            </div>

            {/* Validation warnings */}
            {(hasInvalidInputs || hasInvalidOutputs) && (
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-600">
                        Some mappings reference fields that no longer exist in the Data Schema.
                        Update or remove them before saving.
                    </p>
                </div>
            )}

            {/* Inputs */}
            <InputsSection
                inputs={inputs}
                availableFields={availableFields}
                validPaths={validPaths}
                onUpdate={(newInputs) => updateNodeInputs(node.id, newInputs)}
            />

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Outputs */}
            <OutputsSection
                outputs={outputs}
                availableFields={availableFields}
                validPaths={validPaths}
                isUserTask={isUserTask}
                nodeId={node.id}
                onUpdate={(newOutputs) => updateNodeOutputs(node.id, newOutputs)}
            />
        </div>
    );
}
