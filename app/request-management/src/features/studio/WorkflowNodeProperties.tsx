import { useState, useMemo } from 'react';
import { Trash2, Play, Flag, FileEdit, GitBranch, Layers, ExternalLink, Clock, ArrowDownToLine, ArrowUpFromLine, RefreshCw, AlertTriangle, Search, Plus, Link2, Users, Bell, MessageSquare, Mail, X } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField, ConfirmDialog } from '@/components/studio';
import { PrincipalSelect, type Principal } from '@/components/shared/PrincipalSelect';
import type { UiWorkflowNode, UiWorkflowEdge, UiNodeInput, UiNodeOutput } from './types';
import { getPredecessorOutputs, flattenPredecessorOutputsForPicker, validateInputMappings } from './workflowIOHelpers';

// ─── Trigger Type Toggle ──────────────────────────────────────────────────
function TriggerTypeToggle({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const options = [
        { key: 'FORM_SUB', label: 'Form Submission', icon: FileEdit },
        { key: 'API_TRIGGER', label: 'API Trigger', icon: GitBranch },
    ];

    return (
        <div className="flex gap-2">
            {options.map((opt) => {
                const isActive = value === opt.key;
                return (
                    <button
                        key={opt.key}
                        onClick={() => onChange(opt.key)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all flex-1 cursor-pointer ${isActive
                            ? 'border-[var(--brand-red)] bg-[var(--brand-red)]/5 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                    >
                        <opt.icon
                            size={20}
                            className={isActive ? 'text-[var(--brand-red)]' : 'text-slate-400'}
                        />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'text-[var(--brand-red)]' : 'text-slate-400'
                            }`}>
                            {opt.label}
                        </span>
                        {isActive && (
                            <div className="w-4 h-4 rounded-full bg-[var(--brand-red)] flex items-center justify-center">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── SLA Input ────────────────────────────────────────────────────────────
function SlaInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-20 text-center border-0 focus-visible:ring-0"
            />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Days</span>
        </div>
    );
}

// ─── Predecessor Item ─────────────────────────────────────────────────────
function PredecessorItem({
    label,
    isSelected,
    onToggle,
}: {
    label: string;
    isSelected: boolean;
    onToggle: (selected: boolean) => void;
}) {
    return (
        <div
            onClick={(e) => {
                if ((e.target as HTMLElement).getAttribute('role') !== 'checkbox') {
                    onToggle(!isSelected);
                }
            }}
            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${isSelected
                ? 'bg-primary/10 border border-primary text-primary'
                : 'bg-slate-50 border border-transparent hover:border-slate-200 text-slate-700'
                }`}
        >
            <span className="text-sm font-medium truncate">{label}</span>
            <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onToggle(checked === true)}
            />
        </div>
    );
}

// ─── Node type icon + color mapping ───────────────────────────────────────
function getNodeTypeInfo(nodeType?: string) {
    switch (nodeType) {
        case 'startNode':
            return { icon: Play, color: 'var(--brand-red)', label: 'Start Node' };
        case 'endNode':
            return { icon: Flag, color: '#64748b', label: 'End Node' };
        case 'conditionNode':
            return { icon: GitBranch, color: '#7c3aed', label: 'Condition Node' };
        case 'actionNode':
            return { icon: FileEdit, color: 'var(--brand-red)', label: 'User Task' };
        default:
            return { icon: FileEdit, color: '#64748b', label: 'Step' };
    }
}

// ─── Node I/O Section ─────────────────────────────────────────────────────
// Renders Input/Output configuration directly in the Workflow Properties Panel.
// - Start Node (form submission): Output only (auto-synced from form)
// - User Task: Input (from predecessor outputs) + Output (from form)
// - Other: Input (from predecessors) + Output (manual)

function IOFieldRow({
    mapping,
    onAliasChange,
    onRemove,
    isInvalid,
    isReadOnly,
}: {
    mapping: { sourcePath: string; alias?: string; type?: string; derivedFrom?: string; bindTo?: string };
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
                    {mapping.bindTo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium flex-shrink-0">
                            global
                        </span>
                    )}
                    {mapping.derivedFrom === 'formLayout' && !mapping.bindTo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium flex-shrink-0">
                            form
                        </span>
                    )}
                </div>
                {isInvalid && (
                    <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        Source output not found
                    </p>
                )}
            </div>
            {!isReadOnly && onAliasChange && (
                <Input
                    value={mapping.alias || ''}
                    onChange={(e) => onAliasChange(e.target.value)}
                    placeholder="alias"
                    className="w-24 h-7 text-xs border-slate-200"
                />
            )}
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

function IOFieldPicker({
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
                    No predecessor outputs available. Connect predecessor nodes first.
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
                    placeholder="Search by field name, path, or type..."
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

function NodeIOSection({
    node,
    allNodes,
    edges,
}: {
    node: UiWorkflowNode;
    allNodes: UiWorkflowNode[];
    edges: UiWorkflowEdge[];
}) {
    const { updateNodeInputs, updateNodeOutputs, syncUserTaskOutputs } = useStudioStore();
    const [showInputPicker, setShowInputPicker] = useState(false);

    const nodeType = node.type || 'actionNode';
    const isStartNode = nodeType === 'startNode';
    const isFormSubmission = isStartNode && (node.data.triggerType as string || 'FORM_SUB') === 'FORM_SUB';
    const isUserTask = nodeType === 'actionNode' && node.data.actionSubType === 'form';

    const inputs = (node.data.inputs as UiNodeInput[] | undefined) ?? [];
    const outputs = (node.data.outputs as UiNodeOutput[] | undefined) ?? [];
    const hasDerivedOutputs = outputs.some((o) => o.derivedFrom === 'formLayout');

    // Compute predecessor outputs for Input picker
    // NOTE: All hooks must be called unconditionally (React rules of hooks).
    // Early returns are deferred until after all hooks.
    const predecessorGroups = useMemo(
        () => getPredecessorOutputs(node.id, allNodes, edges),
        [node.id, allNodes, edges]
    );
    const pickableInputFields = useMemo(
        () => flattenPredecessorOutputsForPicker(predecessorGroups),
        [predecessorGroups]
    );
    const validInputKeys = useMemo(
        () => new Set(pickableInputFields.map((f) => f.key)),
        [pickableInputFields]
    );

    // Validate existing inputs
    const { invalid: invalidInputs } = useMemo(
        () => validateInputMappings(inputs, validInputKeys),
        [inputs, validInputKeys]
    );
    const hasInvalidInputs = invalidInputs.length > 0;

    // Show/hide input section (start node with form submission = no input)
    const showInputs = !isStartNode;
    // Show output section for start (form sub) and action nodes
    const showOutputs = isFormSubmission || nodeType === 'actionNode';

    // End nodes and condition nodes don't need I/O — guard AFTER all hooks
    if (nodeType === 'endNode' || nodeType === 'conditionNode') return null;
    if (!showInputs && !showOutputs) return null;

    return (
        <Card className="p-4 space-y-4">
            <Label variant="section">Data Mapping</Label>

            {/* Validation warning banner */}
            {hasInvalidInputs && (
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-600">
                        Some input mappings reference outputs that no longer exist.
                        Update or remove them before saving.
                    </p>
                </div>
            )}

            {/* ── Inputs Section ─────────────────────────────── */}
            {showInputs && (
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
                            onClick={() => setShowInputPicker(!showInputPicker)}
                        >
                            <Plus size={12} className="mr-1" />
                            Add
                        </Button>
                    </div>

                    {showInputPicker && (
                        <IOFieldPicker
                            availableFields={pickableInputFields}
                            usedPaths={new Set(inputs.map((i) => i.sourcePath))}
                            onAdd={(path, type) => {
                                updateNodeInputs(node.id, [...inputs, { sourcePath: path, type }]);
                                setShowInputPicker(false);
                            }}
                        />
                    )}

                    {inputs.length === 0 && !showInputPicker && (
                        predecessorGroups.length === 0 ? (
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                <p className="text-[11px] text-slate-400 italic text-center">
                                    No predecessor nodes connected. Add edges to make outputs available as inputs.
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic text-center py-2">No inputs configured</p>
                        )
                    )}

                    <div className="space-y-1">
                        {inputs.map((input, idx) => (
                            <IOFieldRow
                                key={input.sourcePath}
                                mapping={input}
                                isInvalid={!validInputKeys.has(input.sourcePath)}
                                onAliasChange={(alias) => {
                                    const updated = [...inputs];
                                    updated[idx] = { ...updated[idx], alias: alias || undefined };
                                    updateNodeInputs(node.id, updated);
                                }}
                                onRemove={() => updateNodeInputs(node.id, inputs.filter((_, i) => i !== idx))}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Divider between Input & Output */}
            {showInputs && showOutputs && <div className="border-t border-slate-100" />}

            {/* ── Outputs Section ────────────────────────────── */}
            {showOutputs && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                            <ArrowUpFromLine size={14} className="text-emerald-500" />
                            Outputs
                            <span className="text-slate-400 font-normal">({outputs.length})</span>
                        </Label>
                        {(isUserTask || isFormSubmission) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-emerald-600 hover:text-emerald-700"
                                onClick={() => syncUserTaskOutputs(node.id)}
                                title="Sync outputs from form layout"
                            >
                                <RefreshCw size={12} className="mr-1" />
                                Sync
                            </Button>
                        )}
                    </div>

                    {/* User Task / Start info banner */}
                    {(isUserTask || isFormSubmission) && hasDerivedOutputs && (
                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-[11px] text-blue-600">
                                Outputs are derived from all form fields.
                                Fields bound to the Data Schema are tagged <strong className="text-emerald-600">global</strong>.
                                Click <strong>Sync</strong> to refresh after editing the form.
                            </p>
                        </div>
                    )}

                    {(isUserTask || isFormSubmission) && !hasDerivedOutputs && outputs.length === 0 && (
                        <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-[11px] text-amber-600">
                                Assign a form and click <strong>Sync</strong> to derive outputs from form fields.
                            </p>
                        </div>
                    )}

                    {outputs.length === 0 && !isUserTask && !isFormSubmission && (
                        <p className="text-xs text-slate-400 italic text-center py-2">No outputs configured</p>
                    )}

                    <div className="space-y-1">
                        {outputs.map((output, idx) => (
                            <IOFieldRow
                                key={output.sourcePath}
                                mapping={output}
                                isReadOnly={(isUserTask || isFormSubmission) && output.derivedFrom === 'formLayout'}
                                onAliasChange={
                                    (isUserTask || isFormSubmission) && output.derivedFrom === 'formLayout'
                                        ? undefined
                                        : (alias) => {
                                            const updated = [...outputs];
                                            updated[idx] = { ...updated[idx], alias: alias || undefined };
                                            updateNodeOutputs(node.id, updated);
                                        }
                                }
                                onRemove={
                                    (isUserTask || isFormSubmission) && output.derivedFrom === 'formLayout'
                                        ? undefined
                                        : () => updateNodeOutputs(node.id, outputs.filter((_, i) => i !== idx))
                                }
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Start node: explicitly hide inputs */}
            {isStartNode && (
                <p className="text-[11px] text-slate-400 italic">
                    Start nodes do not receive inputs.
                </p>
            )}
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
interface WorkflowNodePropertiesProps {
    node: UiWorkflowNode;
    allNodes: UiWorkflowNode[];
    edges: UiWorkflowEdge[];
}

export function WorkflowNodeProperties({ node, allNodes, edges }: WorkflowNodePropertiesProps) {
    const {
        updateNodeData,
        deleteStep,
        updateWorkflow,
        workflow,
        forms,
        addForm,
        selectForm,
        setActiveTab,
        setIsFormEditorOpen,
        setIsEmailEditorOpen,
    } = useStudioStore();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const nodeType = node.type || 'actionNode';
    const info = getNodeTypeInfo(nodeType);
    const Icon = info.icon;

    // ── Shared helpers ────────────────────────────────────────────────────
    const handleLabelChange = (val: string) => updateNodeData(node.id, { label: val });

    // Auto-create a skeleton form for this step if one doesn't exist
    const ensureFormForNode = (): string => {
        const existingFormId = node.data?.formId as string | undefined;
        if (existingFormId) {
            const existingForm = forms.find(f => f.id === existingFormId);
            if (existingForm) return existingFormId;
        }
        // Create a skeleton form named after the step
        const stepLabel = (node.data.label as string) || 'Untitled Step';
        addForm(`${stepLabel} Form`);
        const latestForms = useStudioStore.getState().forms;
        const newForm = latestForms[latestForms.length - 1];
        if (newForm) {
            updateNodeData(node.id, { formId: newForm.id });
            return newForm.id;
        }
        return '';
    };

    const handleEditFormLayout = () => {
        const formId = ensureFormForNode();
        if (formId) {
            selectForm(formId);
        }
        setIsFormEditorOpen(true);
        setActiveTab('schema');
    };

    // Get the current form name for display
    const currentFormId = node.data?.formId as string | undefined;
    const currentForm = currentFormId ? forms.find(f => f.id === currentFormId) : null;

    // Predecessor management
    const handlePredecessorToggle = (targetNodeId: string, isSelected: boolean) => {
        const existingEdge = edges.find(e => e.source === targetNodeId && e.target === node.id);
        if (isSelected && !existingEdge) {
            const newEdge: UiWorkflowEdge = {
                id: `e-${targetNodeId}-${node.id}`,
                source: targetNodeId,
                target: node.id,
                type: 'smoothstep',
            };
            updateWorkflow(workflow.nodes, [...workflow.edges, newEdge]);
        } else if (!isSelected && existingEdge) {
            updateWorkflow(workflow.nodes, workflow.edges.filter(e => e.id !== existingEdge.id));
        }
    };

    // Owner
    const stepOwner: Principal | null = node.data.owner_ID
        ? {
            id: node.data.owner_ID as string,
            type: (node.data.ownerType as string) || 'USER',
            displayName: (node.data.ownerName as string) || 'Unknown',
        }
        : null;

    const handleOwnerChange = (principal: Principal | null) => {
        if (principal) {
            updateNodeData(node.id, {
                owner_ID: principal.id,
                ownerType: principal.type,
                ownerName: principal.displayName,
            });
        } else {
            updateNodeData(node.id, {
                owner_ID: null,
                ownerType: null,
                ownerName: null,
            });
        }
    };

    const potentialPredecessors = allNodes.filter(n => n.id !== node.id);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4">
            {/* Node Type Badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg"
                    style={{ backgroundColor: `color-mix(in srgb, ${info.color} 12%, transparent)` }}
                >
                    <Icon size={18} style={{ color: info.color }} />
                </div>
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{info.label}</p>
                    <p className="text-sm font-medium text-slate-900">{(node.data.label as string) || 'Untitled'}</p>
                </div>
            </div>

            {/* Task Name / Step Label */}
            <Card className="p-4 space-y-4">
                <FormField label={nodeType === 'actionNode' ? 'Task Name' : 'Step Label'} hint="Display name on the canvas">
                    <Input
                        value={(node.data.label as string) || ''}
                        onChange={(e) => handleLabelChange(e.target.value)}
                        placeholder={nodeType === 'actionNode' ? 'Enter task name...' : 'Enter step name...'}
                        className="border-0 focus-visible:ring-0 font-medium"
                    />
                </FormField>
            </Card>

            {/* ── START NODE ─────────────────────────────────── */}
            {nodeType === 'startNode' && (
                <>
                    <Card className="p-4 space-y-4">
                        <Label variant="section">Trigger Type</Label>
                        <TriggerTypeToggle
                            value={(node.data.triggerType as string) || 'FORM_SUB'}
                            onChange={(val) => updateNodeData(node.id, { triggerType: val })}
                        />
                    </Card>

                    <Card className="p-4 space-y-3">
                        <Label variant="section">Trigger Settings</Label>
                        {currentForm ? (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80">
                                <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-slate-700 flex-1 truncate">{currentForm.name}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic">No form created yet. Click below to create one.</p>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditFormLayout}
                            className="w-full gap-1.5"
                        >
                            <ExternalLink size={14} />
                            {currentForm ? 'Open Form Editor' : 'Create & Edit Form'}
                        </Button>
                    </Card>
                </>
            )}

            {/* ── ACTION NODE (User Task) ───────────────────── */}
            {nodeType === 'actionNode' && (
                <>
                    {/* ─── Task Form Configuration ──────────── */}
                    <Card className="p-4 space-y-3">
                        <Label variant="section">Task Form</Label>
                        {currentForm ? (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80">
                                <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-slate-700 flex-1 truncate">{currentForm.name}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic">No form created yet. Click below to create one.</p>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditFormLayout}
                            className="w-full gap-1.5"
                        >
                            <ExternalLink size={14} />
                            {currentForm ? 'Open Task Editor' : 'Create & Edit Task Form'}
                        </Button>
                        <p className="text-[11px] text-slate-400 italic">
                            Configure the task form layout in the Task Editor
                        </p>
                    </Card>

                    {/* ─── Approvers Card ────────────────────── */}
                    <Card className="p-4 space-y-3">
                        <Label variant="section">Approvers</Label>
                        <p className="text-[11px] text-slate-400">
                            Select individual users or groups who can approve this task.
                        </p>

                        {/* List of current approvers */}
                        {(() => {
                            const approvers = (node.data.approvers as Array<{ id: string; type: string; displayName: string }>) || [];
                            return (
                                <>
                                    {approvers.length > 0 && (
                                        <div className="space-y-1.5">
                                            {approvers.map((approver, idx) => {
                                                const ApproverIcon = approver.type === 'USER' ? FileEdit : Users;
                                                return (
                                                    <div
                                                        key={approver.id + '-' + idx}
                                                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/80 group"
                                                    >
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${approver.type === 'USER' ? 'bg-blue-100' : 'bg-violet-100'
                                                            }`}>
                                                            <ApproverIcon size={14} className={
                                                                approver.type === 'USER' ? 'text-blue-600' : 'text-violet-600'
                                                            } />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm font-medium text-slate-700 truncate block">
                                                                {approver.displayName}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 uppercase">{approver.type}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const newApprovers = approvers.filter((_, i) => i !== idx);
                                                                updateNodeData(node.id, { approvers: newApprovers });
                                                            }}
                                                            className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <PrincipalSelect
                                        value={null}
                                        onChange={(principal) => {
                                            if (!principal) return;
                                            const existing = (node.data.approvers as Array<{ id: string; type: string; displayName: string }>) || [];
                                            // Avoid duplicates
                                            if (existing.some(a => a.id === principal.id && a.type === principal.type)) return;
                                            updateNodeData(node.id, {
                                                approvers: [...existing, {
                                                    id: principal.id,
                                                    type: principal.type,
                                                    displayName: principal.displayName,
                                                }],
                                            });
                                        }}
                                        placeholder="Add approver..."
                                        excludeIds={
                                            ((node.data.approvers as Array<{ id: string }>) || []).map(a => a.id)
                                        }
                                    />
                                </>
                            );
                        })()}
                    </Card>

                    {/* ─── Notifications Card ───────────────── */}
                    <Card className="p-4 space-y-3">
                        <Label variant="section">Notifications</Label>
                        <p className="text-[11px] text-slate-400">
                            Choose how stakeholders are notified at this step.
                        </p>

                        {(() => {
                            const notifTypes = (node.data.notificationTypes as string[]) || [];
                            const NOTIF_OPTIONS = [
                                { key: 'email', label: 'Email', icon: Mail, color: 'rose' },
                                { key: 'bell', label: 'Bell', icon: Bell, color: 'amber' },
                            ] as const;

                            const toggleNotif = (key: string) => {
                                const current = (node.data.notificationTypes as string[]) || [];
                                const updated = current.includes(key)
                                    ? current.filter(k => k !== key)
                                    : [...current, key];
                                updateNodeData(node.id, { notificationTypes: updated });
                            };

                            return (
                                <>
                                    <div className="flex gap-2">
                                        {NOTIF_OPTIONS.map((opt) => {
                                            const isActive = notifTypes.includes(opt.key);
                                            const Icon = opt.icon;
                                            const colorMap: Record<string, { active: string; icon: string }> = {
                                                rose: { active: 'border-rose-400 bg-rose-50', icon: 'text-rose-500' },
                                                amber: { active: 'border-amber-400 bg-amber-50', icon: 'text-amber-500' },
                                                blue: { active: 'border-blue-400 bg-blue-50', icon: 'text-blue-500' },
                                            };
                                            const colors = colorMap[opt.color];
                                            return (
                                                <button
                                                    key={opt.key}
                                                    onClick={() => toggleNotif(opt.key)}
                                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all flex-1 cursor-pointer ${isActive
                                                        ? `${colors.active} shadow-sm`
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                >
                                                    <Icon
                                                        size={20}
                                                        className={isActive ? colors.icon : 'text-slate-400'}
                                                    />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? colors.icon : 'text-slate-400'
                                                        }`}>
                                                        {opt.label}
                                                    </span>
                                                    {isActive && (
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${opt.color === 'rose' ? 'bg-rose-500'
                                                            : opt.color === 'amber' ? 'bg-amber-500'
                                                                : 'bg-blue-500'
                                                            }`}>
                                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Email Editor button */}
                                    {notifTypes.includes('email') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setIsEmailEditorOpen(true);
                                                setActiveTab('email-editor');
                                            }}
                                            className="w-full gap-1.5 mt-1"
                                        >
                                            <Mail size={14} />
                                            Open Email Editor
                                        </Button>
                                    )}
                                </>
                            );
                        })()}
                    </Card>

                    {/* ─── Shared: SLA + Owner ────────────────── */}
                    <Card className="p-4 space-y-4">
                        <FormField label="SLA" hint="Time limit in days">
                            <SlaInput
                                value={(node.data.sla as number) || 0}
                                onChange={(val) => updateNodeData(node.id, { sla: val })}
                            />
                        </FormField>

                        <FormField label="Default Owner" hint="Who is responsible for this task">
                            <PrincipalSelect
                                value={stepOwner}
                                onChange={handleOwnerChange}
                                placeholder="Inherit from coordinator"
                            />
                            <p className="text-[11px] text-slate-400 italic mt-1">
                                Leave empty to default to the request coordinator
                            </p>
                        </FormField>
                    </Card>

                    {/* Sync Trigger */}
                    <Card className="p-4 space-y-2">
                        <Label variant="section">Sync Trigger</Label>
                        <Select
                            value={(node.data.syncTrigger as string) || 'NONE'}
                            onValueChange={(val) => updateNodeData(node.id, { syncTrigger: val })}
                        >
                            <SelectTrigger className="w-full bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">None (No sync)</SelectItem>
                                <SelectItem value="IMMEDIATE">Immediate (Sync on save)</SelectItem>
                                <SelectItem value="WITH_NEXT">With Next Step</SelectItem>
                                <SelectItem value="ON_COMPLETE">On Complete (Final step)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-slate-400 italic">
                            When to sync data to external systems (e.g., S/4HANA)
                        </p>
                    </Card>

                    {/* Predecessors */}
                    <div className="space-y-2">
                        <Label variant="section">Predecessors</Label>
                        <Card className="p-2 max-h-52 overflow-y-auto">
                            {potentialPredecessors.length === 0 ? (
                                <p className="text-xs text-slate-400 p-2 italic text-center">No other steps available</p>
                            ) : (
                                potentialPredecessors.map(pred => (
                                    <PredecessorItem
                                        key={pred.id}
                                        label={pred.data.label as string}
                                        isSelected={edges.some(e => e.source === pred.id && e.target === node.id)}
                                        onToggle={(sel) => handlePredecessorToggle(pred.id, sel)}
                                    />
                                ))
                            )}
                        </Card>
                    </div>
                </>
            )}

            {/* ── CONDITION NODE ──────────────────────────────── */}
            {nodeType === 'conditionNode' && (() => {
                // Condition expression stored on node.data.conditionExpr
                const condExpr = (node.data.conditionExpr as any) || { logic: 'and', conditions: [] };

                // Helper to update the condition expression on the node
                const updateCondExpr = (newExpr: any) => {
                    updateNodeData(node.id, { conditionExpr: newExpr });
                };

                // Flatten data schema fields for the field picker
                const { dataSchema } = useStudioStore.getState();
                const flatFields: { key: string; label: string }[] = [];
                const flatten = (fields: any[], prefix = '') => {
                    for (const f of fields) {
                        const key = prefix ? `${prefix}.${f.key}` : f.key;
                        flatFields.push({ key, label: f.label || f.key });
                        if (f.children?.length) flatten(f.children, key);
                    }
                };
                flatten(dataSchema || []);

                const OPERATORS = [
                    { value: 'eq', label: '=' },
                    { value: 'ne', label: '≠' },
                    { value: 'gt', label: '>' },
                    { value: 'gte', label: '≥' },
                    { value: 'lt', label: '<' },
                    { value: 'lte', label: '≤' },
                    { value: 'contains', label: 'Contains' },
                    { value: 'startsWith', label: 'Starts with' },
                    { value: 'in', label: 'In list' },
                ];

                // Recursive group renderer
                const renderGroup = (group: any, path: number[], depth: number): React.ReactNode => {
                    const conditions: any[] = group.conditions || [];
                    const isRoot = path.length === 0;

                    const updateGroup = (updates: any) => {
                        if (isRoot) {
                            updateCondExpr({ ...condExpr, ...updates });
                        } else {
                            // Deep update nested group
                            const newExpr = JSON.parse(JSON.stringify(condExpr));
                            let target = newExpr;
                            for (let i = 0; i < path.length - 1; i++) {
                                target = target.conditions[path[i]];
                            }
                            target.conditions[path[path.length - 1]] = { ...target.conditions[path[path.length - 1]], ...updates };
                            updateCondExpr(newExpr);
                        }
                    };

                    const addCondition = () => {
                        updateGroup({ conditions: [...conditions, { field: '', operator: 'eq', value: '' }] });
                    };

                    const addNestedGroup = () => {
                        updateGroup({ conditions: [...conditions, { logic: 'and', conditions: [], isGroup: true }] });
                    };

                    const removeCondition = (idx: number) => {
                        updateGroup({ conditions: conditions.filter((_: any, i: number) => i !== idx) });
                    };

                    const updateCondition = (idx: number, updates: any) => {
                        const newConds = [...conditions];
                        newConds[idx] = { ...newConds[idx], ...updates };
                        updateGroup({ conditions: newConds });
                    };

                    return (
                        <div
                            className={`rounded-lg border ${depth === 0 ? 'border-purple-200 bg-purple-50/30' : 'border-slate-200 bg-slate-50/50'} p-3 space-y-2`}
                        >
                            {/* Group header: logic toggle + NOT toggle */}
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center bg-white rounded-md border border-slate-200 overflow-hidden">
                                    <button
                                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${group.logic === 'and' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                        onClick={() => updateGroup({ logic: 'and' })}
                                    >AND</button>
                                    <button
                                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${group.logic === 'or' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                        onClick={() => updateGroup({ logic: 'or' })}
                                    >OR</button>
                                </div>
                                <button
                                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-colors ${group.negate ? 'bg-red-100 text-red-600 border-red-300' : 'text-slate-400 border-slate-200 hover:border-red-200 hover:text-red-500'}`}
                                    onClick={() => updateGroup({ negate: !group.negate })}
                                    title="Negate this group (NOT)"
                                >NOT</button>
                                {!isRoot && (
                                    <button
                                        onClick={() => {
                                            // Remove this group from parent
                                            const newExpr = JSON.parse(JSON.stringify(condExpr));
                                            let parent = newExpr;
                                            for (let i = 0; i < path.length - 1; i++) {
                                                parent = parent.conditions[path[i]];
                                            }
                                            parent.conditions.splice(path[path.length - 1], 1);
                                            updateCondExpr(newExpr);
                                        }}
                                        className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                                        title="Remove group"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Conditions list */}
                            {conditions.map((cond: any, idx: number) => {
                                if (cond.isGroup || cond.conditions) {
                                    return (
                                        <div key={idx}>
                                            {renderGroup(cond, [...path, idx], depth + 1)}
                                        </div>
                                    );
                                }
                                return (
                                    <div key={idx} className="flex items-center gap-1.5 group">
                                        <select
                                            value={cond.field || ''}
                                            onChange={(e) => updateCondition(idx, { field: e.target.value })}
                                            className="flex-1 h-7 text-xs border border-slate-200 rounded-md px-2 bg-white focus:ring-1 focus:ring-purple-300 min-w-0"
                                        >
                                            <option value="">Field...</option>
                                            {flatFields.map(f => (
                                                <option key={f.key} value={f.key}>{f.label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={cond.operator || 'eq'}
                                            onChange={(e) => updateCondition(idx, { operator: e.target.value })}
                                            className="w-20 h-7 text-xs border border-slate-200 rounded-md px-1 bg-white focus:ring-1 focus:ring-purple-300"
                                        >
                                            {OPERATORS.map(op => (
                                                <option key={op.value} value={op.value}>{op.label}</option>
                                            ))}
                                        </select>
                                        <Input
                                            value={cond.value || ''}
                                            onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                            placeholder="Value"
                                            className="flex-1 h-7 text-xs min-w-0"
                                        />
                                        <button
                                            onClick={() => removeCondition(idx)}
                                            className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Add buttons */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={addCondition}
                                    className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium"
                                >
                                    <Plus size={12} /> Condition
                                </button>
                                {depth < 2 && (
                                    <button
                                        onClick={addNestedGroup}
                                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-600 font-medium"
                                    >
                                        <Plus size={12} /> Group
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                };

                return (
                    <Card className="p-4 space-y-3">
                        <Label variant="section">Condition Logic</Label>
                        <p className="text-[11px] text-slate-400">
                            Define conditions to route the workflow. Evaluates to <strong className="text-green-600">Yes</strong> or <strong className="text-red-500">No</strong>.
                        </p>
                        {flatFields.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center">
                                <p className="text-xs text-amber-600">
                                    No data fields available. Add fields to the Data Schema first.
                                </p>
                            </div>
                        ) : (
                            renderGroup(condExpr, [], 0)
                        )}
                    </Card>
                );
            })()}

            {/* ── END NODE ────────────────────────────────────── */}
            {nodeType === 'endNode' && (
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <p className="text-xs">This marks the end of the workflow.</p>
                    </div>
                </Card>
            )}

            {/* ── DATA MAPPING (I/O) ──────────────────────────── */}
            <NodeIOSection node={node} allNodes={allNodes} edges={edges} />

            {/* Delete Node Button (not for start) */}
            {nodeType !== 'startNode' && (
                <div className="pt-4 mt-4 border-t border-slate-100">
                    <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        variant="outline-destructive"
                        className="w-full"
                    >
                        <Trash2 size={16} />
                        Delete Node
                    </Button>
                </div>
            )}


            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Node"
                message="Are you sure you want to delete this node? All connections will also be removed."
                confirmLabel="Delete Node"
                variant="danger"
                onConfirm={() => {
                    deleteStep(node.id);
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
