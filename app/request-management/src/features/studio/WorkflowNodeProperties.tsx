import { useState, useMemo } from 'react';
import { Trash2, Play, Flag, FileEdit, Mail, Shield, Bell, MessageSquare, GitBranch, Layers, ExternalLink, Clock, Database, ClipboardCheck, X, Globe, Plus, Info, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Search, Link2, Users, RefreshCw } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField, ConfirmDialog } from '@/components/studio';
import { PrincipalSelect, type Principal } from '@/components/shared/PrincipalSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Textarea } from '@/components/ui/TextArea';
import { MappingSelector } from './components/MappingSelector';
import { AdminService } from '../../services/AdminService';
import { ConditionEditorDialog, type ConditionLogic } from './components/ConditionEditorDialog';
import type { UiWorkflowNode, UiWorkflowEdge, UiFormField, UiSection, UiNodeInput, UiNodeOutput } from './types';
import { getPredecessorOutputs, flattenPredecessorOutputsForPicker, validateInputMappings, findAllAncestors } from './workflowIOHelpers';

// System-level output fields available on every Start Node
const SYSTEM_OUTPUT_FIELDS = [
    { id: '__request_uuid', label: 'Request UUID', type: 'system', category: 'Request Info' },
    { id: '__request_displayId', label: 'Request ID', type: 'system', category: 'Request Info' },
    { id: '__request_title', label: 'Request Title', type: 'system', category: 'Request Info' },
    { id: '__requester_name', label: 'Requester', type: 'system', category: 'Related Personnel' },
] as const;

const DEFAULT_EMAIL_SUBJECT = '';
const DEFAULT_EMAIL_BODY = '';

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
function getNodeTypeInfo(nodeType?: string, subType?: string) {
    switch (nodeType) {
        case 'startNode':
            return { icon: Play, color: 'var(--brand-red)', label: 'Start Node' };
        case 'endNode':
            return { icon: Flag, color: '#64748b', label: 'End Node' };
        case 'conditionNode':
            return { icon: GitBranch, color: '#7c3aed', label: 'Condition Node' };
        case 'actionNode':
            switch (subType) {
                case 'form':
                case 'user_task':
                case 'userTask':
                    return { icon: ClipboardCheck, color: 'var(--brand-red)', label: 'User Task' };
                case 'email':
                    return { icon: Mail, color: 'var(--brand-red)', label: 'Email Step' };
                case 'approval':
                    return { icon: Shield, color: 'var(--brand-red)', label: 'Approval Step' };
                case 'apiCall':
                case 'api_call':
                    return { icon: Globe, color: '#0ea5e9', label: 'API Call' };
                default:
                    return { icon: FileEdit, color: 'var(--brand-red)', label: 'Action Step' };
            }
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
    const isUserTask = nodeType === 'actionNode' && (node.data.actionSubType === 'form' || node.data.actionSubType === 'user_task' || node.data.actionSubType === 'userTask');

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

    // Show/hide input section (start node with form submission = no input, user task = shown in tab)
    const showInputs = !isStartNode && !isUserTask;
    // Show output section ONLY for action nodes that are NOT User Tasks (Start node outputs are separate, User Tasks have Field Mappings)
    const showOutputs = nodeType === 'actionNode' && !isUserTask;

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
// Email Template Editor (Dialog)
// ═══════════════════════════════════════════════════════════════════════════
function EmailTemplateEditor({
    subject,
    body,
    onSave,
    availableSources,
}: {
    subject: string;
    body: string;
    onSave: (subject: string, body: string) => void;
    availableSources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [draftSubject, setDraftSubject] = useState(subject || DEFAULT_EMAIL_SUBJECT);
    const [draftBody, setDraftBody] = useState(body || DEFAULT_EMAIL_BODY);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const bodyRef = useState<HTMLTextAreaElement | null>(null);
    const subjectRef = useState<HTMLInputElement | null>(null);
    const [activeTarget, setActiveTarget] = useState<'subject' | 'body'>('body');
    const [viewMode, setViewMode] = useState<'html' | 'preview'>('html');

    const handleOpen = () => {
        setDraftSubject(subject || DEFAULT_EMAIL_SUBJECT);
        setDraftBody(body || DEFAULT_EMAIL_BODY);
        setOpen(true);
    };

    const handleSave = () => {
        onSave(draftSubject, draftBody);
        setLastSaved(new Date().toLocaleTimeString());
        setOpen(false);
    };

    const insertVariable = (fieldId: string) => {
        const varStr = `{{${fieldId}}}`;
        if (activeTarget === 'body') {
            const textarea = bodyRef[0];
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const before = draftBody.slice(0, start);
                const after = draftBody.slice(end);
                setDraftBody(before + varStr + after);
                requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + varStr.length;
                    textarea.focus();
                });
            } else {
                setDraftBody(draftBody + varStr);
            }
        } else {
            const input = subjectRef[0];
            if (input) {
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const before = draftSubject.slice(0, start);
                const after = draftSubject.slice(end);
                setDraftSubject(before + varStr + after);
                requestAnimationFrame(() => {
                    input.selectionStart = input.selectionEnd = start + varStr.length;
                    input.focus();
                });
            } else {
                setDraftSubject(draftSubject + varStr);
            }
        }
    };

    // Group variables by category
    const categorizedVariables = useMemo(() => {
        const categories: Record<string, any> = {
            'Request Info': [],
            'Related Personnel': [],
            'Form Data': {} // Nested Record<stepName, fields[]>
        };

        // 1. Add system fields to their fixed categories
        SYSTEM_OUTPUT_FIELDS.forEach(sf => {
            if (Array.isArray(categories[sf.category])) {
                categories[sf.category].push({ id: sf.id, label: sf.label });
            }
        });

        // 2. Add form fields from available sources, grouped by their step name inside "Form Data"
        availableSources.forEach(s => {
            // Skip internal system fields (already handled)
            if (s.stepId === 'system') return;

            if (!s.fieldId.startsWith('__')) {
                const stepName = s.stepName || 'Unknown Step';
                if (!categories['Form Data'][stepName]) {
                    categories['Form Data'][stepName] = [];
                }
                categories['Form Data'][stepName].push({ id: s.fieldId, label: s.fieldName });
            }
        });

        return categories;
    }, [availableSources]);

    // Simple preview renderer - replaces {{var}} with [Var Label]
    const renderedPreview = useMemo(() => {
        let content = draftBody;
        let subj = draftSubject;

        // Replace system variables
        SYSTEM_OUTPUT_FIELDS.forEach(f => {
            const badge = `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold border border-amber-200">@${f.label}</span>`;
            content = content.replaceAll(`{{${f.id}}}`, badge);
            subj = subj.replaceAll(`{{${f.id}}}`, badge);
        });
        // Replace form variables
        availableSources.forEach(s => {
            const badge = `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold border border-blue-200">#${s.fieldName}</span>`;
            content = content.replaceAll(`{{${s.fieldId}}}`, badge);
            subj = subj.replaceAll(`{{${s.fieldId}}}`, badge);
        });
        return { body: content, subject: subj };
    }, [draftBody, draftSubject, availableSources]);

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOpen}
                className="w-full gap-2 font-semibold h-9 border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            >
                <Mail size={14} />
                Edit Body Content
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[1100px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-500">
                                <Mail size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900">Email Template</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    Set up automatic email notifications
                                </DialogDescription>
                            </div>
                        </div>
                        <DialogPrimitive.Close className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                            <X size={20} />
                        </DialogPrimitive.Close>
                    </div>

                    <div className="flex h-[600px]">
                        {/* Sidebar - Smaller width (1/4 instead of 1/3) */}
                        <div className="w-1/4 bg-slate-50/50 border-r border-slate-100 p-5 overflow-y-auto">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Available Data</h3>

                            <div className="space-y-6">
                                {Object.entries(categorizedVariables).map(([category, content]) => {
                                    // Special rendering for Form Data (nested)
                                    if (category === 'Form Data') {
                                        const stepGroups = content as Record<string, any[]>;
                                        if (Object.keys(stepGroups).length === 0) return null;
                                        return (
                                            <div key={category} className="space-y-4">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Layers size={12} />
                                                    <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                                </div>
                                                <div className="space-y-5 pl-2 border-l-2 border-slate-100 ml-1.5">
                                                    {Object.entries(stepGroups).map(([stepName, fields]) => (
                                                        <div key={stepName} className="space-y-2">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight px-1">{stepName}</div>
                                                            <div className="grid gap-1.5">
                                                                {fields.map(f => (
                                                                    <button
                                                                        key={f.id}
                                                                        onClick={() => insertVariable(f.id)}
                                                                        title={`Click to insert {{${f.id}}}`}
                                                                        className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:shadow-sm transition-all text-left"
                                                                    >
                                                                        <span className="text-xs font-medium text-slate-700 group-hover:text-amber-600 truncate">{f.label}</span>
                                                                        <Play size={8} className="text-slate-300 group-hover:text-amber-400" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Flat rendering for System Categories
                                    const fields = content as any[];
                                    return fields.length > 0 && (
                                        <div key={category} className="space-y-2">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                {category === 'Request Info' && <Database size={12} />}
                                                {category === 'Related Personnel' && <Shield size={12} />}
                                                <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                            </div>
                                            <div className="grid gap-1.5">
                                                {fields.map(f => (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => insertVariable(f.id)}
                                                        title={`Click to insert {{${f.id}}}`}
                                                        className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:shadow-sm transition-all text-left"
                                                    >
                                                        <span className="text-xs font-medium text-slate-700 group-hover:text-amber-600 truncate">{f.label}</span>
                                                        <Play size={8} className="text-slate-300 group-hover:text-amber-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-white flex flex-col">
                            {/* Subject Section - Compact */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Subject</Label>
                                </div>
                                <Input
                                    ref={(el) => { if (el) subjectRef[0] = el; }}
                                    value={draftSubject}
                                    onFocus={() => setActiveTarget('subject')}
                                    onChange={(e) => setDraftSubject(e.target.value)}
                                    className="h-10 px-4 text-slate-900 font-semibold bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 rounded-lg transition-all"
                                    placeholder="Enter subject..."
                                />
                            </div>

                            {/* Body Section */}
                            <div className="space-y-3 flex flex-col flex-1 min-h-0">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Body Content</Label>

                                    <div className="flex items-center gap-2">
                                        {/* View Switcher */}
                                        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 mr-2">
                                            <button
                                                onClick={() => setViewMode('html')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'html' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                HTML
                                            </button>
                                            <button
                                                onClick={() => setViewMode('preview')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                PREVIEW
                                            </button>
                                        </div>

                                        {/* Mini Toolbar */}
                                        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100/50 border border-slate-200">
                                            <button title="Bold" className="p-1 px-2 rounded hover:bg-white text-slate-400 hover:text-slate-900 transition-colors"><span className="text-[10px] font-bold">B</span></button>
                                            <button title="Italic" className="p-1 px-2 rounded hover:bg-white text-slate-400 hover:text-slate-900 transition-colors"><span className="text-[10px] font-italic">I</span></button>
                                            <div className="w-px h-3 bg-slate-200 mx-1" />
                                            <button title="Link" className="p-1 rounded hover:bg-white text-slate-400 hover:text-slate-900 transition-colors"><ExternalLink size={12} /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative flex-1 flex flex-col min-h-[350px] rounded-xl border border-slate-200 bg-slate-50/30 overflow-hidden focus-within:ring-2 focus-within:ring-amber-400/20 focus-within:border-amber-400 transition-all">
                                    {viewMode === 'html' ? (
                                        <textarea
                                            ref={(el) => { if (el) bodyRef[0] = el; }}
                                            value={draftBody}
                                            onFocus={() => setActiveTarget('body')}
                                            onChange={(e) => setDraftBody(e.target.value)}
                                            className="w-full flex-1 p-5 bg-white border-none focus:outline-none resize-none text-slate-800 font-mono text-xs leading-relaxed"
                                            placeholder="Write your email body in HTML format..."
                                        />
                                    ) : (
                                        <div className="w-full flex-1 bg-white overflow-y-auto">
                                            {/* Preview Subject */}
                                            <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject Preview</div>
                                                <div className="text-sm font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: renderedPreview.subject || '<span class="text-slate-300 italic">No subject</span>' }} />
                                            </div>
                                            {/* Preview Body */}
                                            <div className="p-8">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-4">Body Preview</div>
                                                <div
                                                    className="prose prose-sm max-w-none text-slate-700"
                                                    dangerouslySetInnerHTML={{ __html: renderedPreview.body }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-6 text-slate-400">
                            <div className="flex items-center gap-2">
                                <Shield size={14} className="text-emerald-500" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">HTML Supported</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">
                                    {lastSaved ? `Saved at ${lastSaved}` : 'Not saved yet'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="font-bold text-slate-500 hover:text-slate-900 h-11 px-6 text-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="h-11 px-8 bg-[#FF7D29] hover:bg-[#e66d1f] text-white font-bold rounded-xl shadow-lg shadow-orange-200 gap-2 transition-all text-sm"
                            >
                                <Mail size={16} />
                                Save Email Template
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// API Trigger Settings Editor (Dialog)
// ═══════════════════════════════════════════════════════════════════════════
// ─── API Configuration Dialog ─────────────────────────────────────────────
function ApiConfigurationDialog({
    open,
    onOpenChange,
    method,
    url,
    headers,
    body,
    authType,
    authToken,
    authUser,
    authPass,
    responseMapping,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    method: string;
    url: string;
    headers: any[];
    body: string;
    authType: string;
    authToken: string;
    authUser: string;
    authPass: string;
    responseMapping: any[];
    onSave: (data: {
        method: string;
        url: string;
        headers: any[];
        body: string;
        authType: string;
        authToken: string;
        authUser: string;
        authPass: string;
        responseMapping: any[];
    }) => void;
}) {
    const [localMethod, setLocalMethod] = useState(method);
    const [localUrl, setLocalUrl] = useState(url);
    const [localHeaders, setLocalHeaders] = useState([...headers]);
    const [localBody, setLocalBody] = useState(body);
    const [localAuthType, setLocalAuthType] = useState(authType || 'none');
    const [localAuthToken, setLocalAuthToken] = useState(authToken || '');
    const [localAuthUser, setLocalAuthUser] = useState(authUser || '');
    const [localAuthPass, setLocalAuthPass] = useState(authPass || '');
    const [localResponseMapping, setLocalResponseMapping] = useState([...(responseMapping || [])]);
    const [isTesting, setIsTesting] = useState(false);
    const [testResponse, setTestResponse] = useState<{ status: number; body: any } | null>(null);

    const handleTestCall = async () => {
        setIsTesting(true);
        setTestResponse(null);
        try {
            const headersObj: Record<string, string> = {};
            localHeaders.forEach(h => { if (h.key) headersObj[h.key] = h.value; });

            const payload = {
                method: localMethod,
                url: localUrl,
                headers: JSON.stringify(headersObj),
                body: localBody,
                authType: localAuthType,
                authUser: localAuthUser,
                authPass: localAuthPass,
                authToken: localAuthToken,
            };

            const response = await AdminService.testApiCall(payload);
            setTestResponse({ status: response.status, body: response.body });
        } catch (error: any) {
            setTestResponse({ status: 500, body: error.message || 'Failed to execute request through backend proxy' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        onSave({
            method: localMethod,
            url: localUrl,
            headers: localHeaders,
            body: localBody,
            authType: localAuthType,
            authToken: localAuthToken,
            authUser: localAuthUser,
            authPass: localAuthPass,
            responseMapping: localResponseMapping,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white rounded-2xl shadow-2xl border-none p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Globe size={20} />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900">API Call Configuration</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">Configure external HTTP request settings</DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Method & URL */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoint</Label>
                        <div className="flex gap-2">
                            <Select value={localMethod} onValueChange={setLocalMethod}>
                                <SelectTrigger className="w-[120px] h-11 bg-slate-50 border-slate-200 font-bold text-emerald-600 rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET" className="text-emerald-600 font-bold">GET</SelectItem>
                                    <SelectItem value="POST" className="text-blue-600 font-bold">POST</SelectItem>
                                    <SelectItem value="PUT" className="text-amber-600 font-bold">PUT</SelectItem>
                                    <SelectItem value="PATCH" className="text-purple-600 font-bold">PATCH</SelectItem>
                                    <SelectItem value="DELETE" className="text-rose-600 font-bold">DELETE</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                value={localUrl}
                                onChange={(e) => setLocalUrl(e.target.value)}
                                placeholder="https://api.example.com/v1/..."
                                className="flex-1 h-11 bg-white border-slate-200 rounded-xl focus:ring-emerald-500/20"
                            />
                        </div>
                    </div>

                    <Tabs defaultValue="auth" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100/50 p-1 rounded-xl">
                            <TabsTrigger value="auth" className="py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Auth</TabsTrigger>
                            <TabsTrigger value="headers" className="py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Headers</TabsTrigger>
                            <TabsTrigger value="body" className="py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Body & Test</TabsTrigger>
                        </TabsList>

                        <TabsContent value="auth" className="pt-4 space-y-4 min-h-[250px]">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authentication Type</Label>
                                <Select value={localAuthType} onValueChange={setLocalAuthType}>
                                    <SelectTrigger className="w-full h-11 bg-white border-slate-200 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Auth</SelectItem>
                                        <SelectItem value="basic">Basic Auth</SelectItem>
                                        <SelectItem value="bearer">Bearer Token</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {localAuthType === 'basic' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-slate-500">Username</Label>
                                        <Input
                                            value={localAuthUser}
                                            onChange={(e) => setLocalAuthUser(e.target.value)}
                                            placeholder="Username"
                                            className="h-10 bg-white border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-slate-500">Password</Label>
                                        <Input
                                            type="password"
                                            value={localAuthPass}
                                            onChange={(e) => setLocalAuthPass(e.target.value)}
                                            placeholder="Password"
                                            className="h-10 bg-white border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {localAuthType === 'bearer' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-xs font-semibold text-slate-500">Token</Label>
                                    <Input
                                        value={localAuthToken}
                                        onChange={(e) => setLocalAuthToken(e.target.value)}
                                        placeholder="Bearer Token"
                                        className="h-10 bg-white border-slate-200 rounded-lg"
                                    />
                                </div>
                            )}

                            {localAuthType === 'none' && (
                                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <Shield size={24} className="text-slate-200 mb-2" />
                                    <p className="text-xs text-slate-400 italic">This request does not use any authentication</p>
                                </div>
                            )}
                        </TabsContent>


                        <TabsContent value="headers" className="pt-4 space-y-3 min-h-[250px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Request Headers</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setLocalHeaders([...localHeaders, { key: '', value: '' }])}
                                    className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                >
                                    <Plus size={14} className="mr-1.5" /> Add Header
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {localHeaders.map((header, idx) => (
                                    <div key={idx} className="flex gap-2 group animate-in fade-in slide-in-from-top-1">
                                        <Input
                                            placeholder="Key"
                                            value={header.key}
                                            onChange={(e) => {
                                                const nh = [...localHeaders];
                                                nh[idx].key = e.target.value;
                                                setLocalHeaders(nh);
                                            }}
                                            className="h-10 text-sm bg-white border-slate-200 rounded-lg"
                                        />
                                        <Input
                                            placeholder="Value"
                                            value={header.value}
                                            onChange={(e) => {
                                                const nh = [...localHeaders];
                                                nh[idx].value = e.target.value;
                                                setLocalHeaders(nh);
                                            }}
                                            className="h-10 text-sm bg-white border-slate-200 rounded-lg"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setLocalHeaders(localHeaders.filter((_, i) => i !== idx))}
                                            className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </Button>
                                    </div>
                                ))}
                                {localHeaders.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                        <Layers size={24} className="text-slate-200 mb-2" />
                                        <p className="text-xs text-slate-400 italic">No headers configured</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="body" className="pt-4 space-y-4 min-h-[400px]">
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">JSON Payload</Label>
                                <textarea
                                    value={localBody}
                                    onChange={(e) => setLocalBody(e.target.value)}
                                    placeholder='{&#10;  "key": "value"&#10;}'
                                    className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <Button
                                    onClick={handleTestCall}
                                    disabled={isTesting || !localUrl}
                                    className="w-full gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg"
                                >
                                    {isTesting ? <Play size={16} className="animate-pulse" /> : <Play size={16} />}
                                    {isTesting ? 'Sending Request...' : 'Send Test Request'}
                                </Button>
                            </div>

                            {testResponse && (
                                <div className="space-y-3 animate-in fade-in zoom-in-95">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Response</Label>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${testResponse.status >= 200 && testResponse.status < 300 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                            STATUS: {testResponse.status}
                                        </span>
                                    </div>
                                    <div className="relative group">
                                        <pre className="w-full max-h-40 overflow-y-auto bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono custom-scrollbar border border-slate-800 shadow-xl">
                                            {JSON.stringify(testResponse.body, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Response Mapping</span>
                                        <p className="text-[10px] text-slate-400">Map result properties to workflow variables</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLocalResponseMapping([...localResponseMapping, { path: '', targetKey: '' }])}
                                        className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                    >
                                        <Plus size={14} className="mr-1.5" /> Add Mapping
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {localResponseMapping.map((mapping: { path: string; targetKey: string }, idx: number) => (
                                        <div key={idx} className="flex gap-2 group animate-in fade-in slide-in-from-top-1">
                                            <Input
                                                placeholder="JSON Path (e.g. status)"
                                                value={mapping.path}
                                                onChange={(e) => {
                                                    const nm = [...localResponseMapping];
                                                    nm[idx].path = e.target.value;
                                                    setLocalResponseMapping(nm);
                                                }}
                                                className="h-9 text-xs bg-white border-slate-200 rounded-lg font-mono flex-1"
                                            />
                                            <Input
                                                placeholder="Variable Name"
                                                value={mapping.targetKey}
                                                onChange={(e) => {
                                                    const nm = [...localResponseMapping];
                                                    nm[idx].targetKey = e.target.value;
                                                    setLocalResponseMapping(nm);
                                                }}
                                                className="h-9 text-xs bg-white border-slate-200 rounded-lg flex-1"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setLocalResponseMapping(localResponseMapping.filter((_: any, i: number) => i !== idx))}
                                                className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>
                                    ))}
                                    {localResponseMapping.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                            <Database size={20} className="text-slate-200 mb-2" />
                                            <p className="text-[10px] text-slate-400 italic">No output mappings defined</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-3 px-6">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
                    <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 shadow-lg shadow-emerald-200">Save Configuration</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ApiTriggerSettingsDialog({
    endpoint,
    payload,
    onSave,
    open,
    onOpenChange,
}: {
    endpoint: string;
    payload: string;
    onSave: (endpoint: string, payload: string) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [draftEndpoint, setDraftEndpoint] = useState(endpoint || '');
    const [draftPayload, setDraftPayload] = useState(payload || '');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Sync draft with props when opened
    useMemo(() => {
        if (open) {
            setDraftEndpoint(endpoint || '');
            setDraftPayload(payload || '');
            setJsonError(null);
        }
    }, [open, endpoint, payload]);

    const handleSave = () => {
        // Simple JSON validation
        if (draftPayload) {
            try {
                JSON.parse(draftPayload);
            } catch (e) {
                setJsonError('Invalid JSON format');
                return;
            }
        }
        onSave(draftEndpoint, draftPayload);
        onOpenChange(false);
    };

    const derivedFields = useMemo(() => {
        if (!draftPayload) return [];
        try {
            const parsed = JSON.parse(draftPayload);
            if (parsed && typeof parsed === 'object') {
                return Object.keys(parsed);
            }
        } catch (e) { /* ignore */ }
        return [];
    }, [draftPayload]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500">
                            <GitBranch size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">API Trigger Settings</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                Configure the external API endpoint and input payload
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogPrimitive.Close className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                        <X size={20} />
                    </DialogPrimitive.Close>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoint URL</Label>
                        <Input
                            value={draftEndpoint}
                            onChange={(e) => setDraftEndpoint(e.target.value)}
                            placeholder="https://api.example.com/trigger"
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-all font-mono text-xs"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Input Payload (JSON)</Label>
                        <Textarea
                            value={draftPayload}
                            onChange={(e) => {
                                setDraftPayload(e.target.value);
                                if (jsonError) setJsonError(null);
                            }}
                            placeholder='{ "field1": "value1", "field2": 123 }'
                            className="font-mono text-xs min-h-[150px] bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        />
                        {jsonError && <p className="text-xs text-red-500 font-medium">{jsonError}</p>}
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Derived Output Variables</Label>
                        {derivedFields.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No variables derived yet. Define a valid JSON payload above.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {derivedFields.map(field => (
                                    <div key={field} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <GitBranch size={12} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-700">{field}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-slate-500 hover:text-slate-900">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-8">
                        Save API Settings
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
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
    } = useStudioStore();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isConditionEditorOpen, setIsConditionEditorOpen] = useState(false);
    const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);

    const nodeType = node.type || 'actionNode';
    const subType = node.data?.actionSubType as string | undefined;
    const triggerType = (node.data?.triggerType as string) || 'FORM_SUB';

    const isUserTask = subType === 'user_task' || subType === 'userTask' || subType === 'form';
    const isApiCall = subType === 'api_call' || subType === 'apiCall';
    const isApproval = subType === 'approval';

    // --- Data Resolvers for IO Mapping ---

    // 1. Get fields for CURRENT step (the mapping targets)
    const targetFields = useMemo(() => {
        const fields: UiFormField[] = [];
        const isStart = node.data.isStart || node.type === 'startNode';

        if (isStart) {
            // Include system-level outputs ONLY for Form Submission
            if (triggerType === 'FORM_SUB') {
                SYSTEM_OUTPUT_FIELDS.forEach(sf => {
                    fields.push({ id: sf.id, label: sf.label, type: sf.type } as unknown as UiFormField);
                });
            }

            if (triggerType === 'FORM_SUB') {
                const currentFormId = node.data?.formId as string | undefined;
                const currentForm = currentFormId ? forms.find(f => f.id === currentFormId) : null;
                if (currentForm) {
                    currentForm.items.forEach(item => {
                        if (item.type === 'section') {
                            fields.push(...(item as UiSection).fields);
                        } else if (item.type !== 'table') {
                            fields.push(item as UiFormField);
                        }
                    });
                }
            } else if (triggerType === 'API_TRIGGER') {
                const apiPayload = node.data.apiPayload as string;
                if (apiPayload) {
                    try {
                        const parsed = JSON.parse(apiPayload);
                        if (parsed && typeof parsed === 'object') {
                            Object.keys(parsed).forEach(key => {
                                fields.push({
                                    id: key,
                                    label: key,
                                    type: 'api'
                                } as unknown as UiFormField);
                            });
                        }
                    } catch (e) {
                        // Invalid JSON
                    }
                }
            }
        } else {
            const currentFormId = node.data?.formId as string | undefined;
            const currentForm = currentFormId ? forms.find(f => f.id === currentFormId) : null;
            if (currentForm) {
                currentForm.items.forEach(item => {
                    if (item.type === 'section') {
                        fields.push(...(item as UiSection).fields);
                    } else if (item.type !== 'table') {
                        fields.push(item as UiFormField);
                    }
                });
            }
        }
        return fields;
    }, [node.data?.formId, forms, node.data.isStart, node.type, triggerType, node.data.apiPayload]);

    // 2. Get available source fields from ALL previous steps (Ancestors)
    const availableSources = useMemo(() => {
        const sources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string }> = [];

        // 1. Always add System Fields
        SYSTEM_OUTPUT_FIELDS.forEach(sf => {
            sources.push({
                stepId: 'system',
                stepName: 'System',
                fieldId: sf.id,
                fieldName: sf.label
            });
        });

        // 2. Find all ancestor nodes
        const ancestorIds = findAllAncestors(node.id, edges);

        ancestorIds.forEach(id => {
            const ancestor = allNodes.find(n => n.id === id);
            if (!ancestor) return;

            const stepName = (ancestor.data.label as string) || 'Untitled Step';

            // Form fields (for Start / User Task / Approval)
            const formId = ancestor.data.formId as string | undefined;
            const form = formId ? forms.find(f => f.id === formId) : null;

            if (form) {
                form.items.forEach(item => {
                    if (item.type === 'section') {
                        (item as UiSection).fields.forEach(f => sources.push({
                            stepId: id,
                            stepName,
                            fieldId: f.id,
                            fieldName: f.label
                        }));
                    } else if (item.type !== 'table') {
                        const f = item as UiFormField;
                        sources.push({
                            stepId: id,
                            stepName,
                            fieldId: f.id,
                            fieldName: f.label
                        });
                    }
                });
            }

            // API Outputs (specifically for API Call nodes)
            const outputs = (ancestor.data.outputs as UiNodeOutput[] | undefined) ?? [];
            outputs.forEach(opt => {
                sources.push({
                    stepId: id,
                    stepName,
                    fieldId: opt.sourcePath,
                    fieldName: opt.alias || opt.sourcePath
                });
            });
        });

        return sources;
    }, [allNodes, edges, node.id, forms]);


    // 4. Handle Mapping Updates
    const inputMapping = useMemo(() => {
        try {
            return JSON.parse((node.data.inputMapping as string) || '{}');
        } catch {
            return {};
        }
    }, [node.data.inputMapping]);

    const handleMappingChange = (fieldId: string, mapping: { sourceStepId: string; sourceFieldId: string } | undefined) => {
        const newMapping = { ...inputMapping };
        if (mapping) {
            newMapping[fieldId] = mapping;
        } else {
            delete newMapping[fieldId];
        }
        updateNodeData(node.id, { inputMapping: JSON.stringify(newMapping) });
    };
    const info = getNodeTypeInfo(nodeType, subType);
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

    const stepApprover: Principal | null = node.data.approver_ID
        ? {
            id: node.data.approver_ID as string,
            type: (node.data.approverType as string) || 'USER',
            displayName: (node.data.approverName as string) || 'Unknown',
        }
        : null;

    const handleApproverChange = (principal: Principal | null) => {
        if (principal) {
            updateNodeData(node.id, {
                approver_ID: principal.id,
                approverType: principal.type,
                approverName: principal.displayName,
            });
        } else {
            updateNodeData(node.id, {
                approver_ID: null,
                approverType: null,
                approverName: null,
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
                        {triggerType === 'FORM_SUB' ? (
                            <>
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
                            </>
                        ) : (
                            <>
                                <ApiTriggerSettingsDialog
                                    open={isApiSettingsOpen}
                                    onOpenChange={setIsApiSettingsOpen}
                                    endpoint={(node.data.apiEndpoint as string) || ''}
                                    payload={(node.data.apiPayload as string) || ''}
                                    onSave={(endpoint, payload) => {
                                        updateNodeData(node.id, {
                                            apiEndpoint: endpoint,
                                            apiPayload: payload
                                        });
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsApiSettingsOpen(true)}
                                    className="w-full gap-1.5 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                                >
                                    <GitBranch size={14} />
                                    Open API Setting
                                </Button>
                            </>
                        )}
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex flex-col">
                            <Label variant="section">Outputs</Label>
                            <span className="text-[11px] text-slate-400">Captured variables available for mapping</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {/* System Fields - ONLY for Form Submission */}
                            {triggerType === 'FORM_SUB' && (
                                <>
                                    {targetFields.filter(f => f.id.startsWith('__')).length > 0 && (
                                        <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">System</p>
                                    )}
                                    {targetFields.filter(f => f.id.startsWith('__')).map(f => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-blue-100 bg-blue-50/50">
                                            <Database size={12} className="text-blue-400" />
                                            <span className="text-xs font-medium text-blue-700">{f.label}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Form Fields */}
                            {triggerType === 'FORM_SUB' && (
                                <>
                                    {targetFields.filter(f => !f.id.startsWith('__')).length > 0 && (
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Form Fields</p>
                                    )}
                                    {targetFields.filter(f => !f.id.startsWith('__')).map(f => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                                            <Database size={12} className="text-slate-400" />
                                            <span className="text-xs font-medium text-slate-600">{f.label}</span>
                                        </div>
                                    ))}
                                    {targetFields.filter(f => !f.id.startsWith('__')).length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No fields defined for this form.</p>
                                    )}
                                </>
                            )}

                            {/* API Fields */}
                            {triggerType === 'API_TRIGGER' && (
                                <>
                                    {targetFields.filter(f => (f as any).type === 'api').length > 0 && (
                                        <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider mt-1">API Variables</p>
                                    )}
                                    {targetFields.filter(f => (f as any).type === 'api').map(f => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-emerald-100 bg-emerald-50/50">
                                            <Database size={12} className="text-emerald-500" />
                                            <span className="text-xs font-medium text-emerald-700">{f.label}</span>
                                        </div>
                                    ))}
                                    {targetFields.filter(f => (f as any).type === 'api').length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No valid JSON payload defined.</p>
                                    )}
                                </>
                            )}
                        </div>
                    </Card>
                </>
            )}

            {/* ── ACTION NODE (User Task) ───────────────────── */}
            {nodeType === 'actionNode' && (
                <>
                    {/* ─── Task Form Configuration ──────────── */}
                    {!isUserTask && (
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
                    )}

                    {/* ─── Approvers Card ────────────────────── */}
                    {!isUserTask && (
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
                    )}

                    {/* ─── API CALL SUB-TYPE ───────────────────── */}
                    {isApiCall && (
                        <Card className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <Label variant="section">API Configuration</Label>
                                {(node.data.apiMethod && node.data.apiUrl) && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
                                        <span className="text-[10px] font-bold text-emerald-600">{(node.data.apiMethod as string)}</span>
                                        <div className="w-1 h-1 rounded-full bg-emerald-300" />
                                        <span className="text-[10px] font-medium text-emerald-600/70 truncate max-w-[120px]">
                                            {(node.data.apiUrl as string).replace(/^https?:\/\//, '')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-400 -mt-1 leading-relaxed">
                                Configure the external API endpoint and request parameters for this automated step.
                            </p>

                            <ApiConfigurationDialog
                                open={isApiSettingsOpen}
                                onOpenChange={setIsApiSettingsOpen}
                                method={(node.data.apiMethod as string) || 'GET'}
                                url={(node.data.apiUrl as string) || ''}
                                headers={(node.data.apiHeaders as any[]) || []}
                                body={(node.data.apiBody as string) || ''}
                                authType={(node.data.apiAuthType as string) || 'none'}
                                authToken={(node.data.apiAuthToken as string) || ''}
                                authUser={(node.data.apiAuthUser as string) || ''}
                                authPass={(node.data.apiAuthPass as string) || ''}
                                responseMapping={(node.data.apiResponseMapping as any[]) || []}
                                onSave={(data) => {
                                    updateNodeData(node.id, {
                                        apiMethod: data.method,
                                        apiUrl: data.url,
                                        apiHeaders: data.headers,
                                        apiBody: data.body,
                                        apiAuthType: data.authType,
                                        apiAuthToken: data.authToken,
                                        apiAuthUser: data.authUser,
                                        apiAuthPass: data.authPass,
                                        apiResponseMapping: data.responseMapping,
                                    });
                                }}
                            />

                            <Button
                                variant="outline"
                                onClick={() => setIsApiSettingsOpen(true)}
                                className="w-full gap-2 font-semibold h-12 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl"
                            >
                                <Globe size={16} />
                                Configure API Call
                            </Button>

                            {!(node.data.apiMethod && node.data.apiUrl) && (
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex gap-2">
                                    <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-700 font-medium">
                                        Method and URL are required for the workflow to execute this step correctly.
                                    </p>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* ─── APPROVAL / USER TASK SUB-TYPE ──────────────────── */}
                    {(isApproval || isUserTask) && (
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className={`grid w-full ${isUserTask ? 'grid-cols-3' : 'grid-cols-2'} mb-4 bg-slate-100/50 p-1 rounded-lg`}>
                                <TabsTrigger value="general" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">General</TabsTrigger>
                                <TabsTrigger value="mapping" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Input</TabsTrigger>
                                {isUserTask && (
                                    <TabsTrigger value="output" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Output</TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="general" className="space-y-4 focus-visible:outline-none">
                                <Card className="p-4 space-y-4">
                                    <Label variant="section">Recipients</Label>
                                    <p className="text-[11px] text-slate-400 -mt-1">
                                        Select individual users or groups who are responsible for this task.
                                    </p>

                                    {stepApprover ? (
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-blue-100 bg-blue-50/30 group">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
                                                    <Shield size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 leading-none">{stepApprover.displayName}</p>
                                                    <p className="text-[10px] font-medium text-slate-400 uppercase mt-1 tracking-wider">{stepApprover.type}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 -mr-1"
                                                onClick={() => handleApproverChange(null)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2">
                                            <Shield size={20} className="text-slate-200" />
                                            <p className="text-[11px] text-slate-400">No recipients assigned</p>
                                        </div>
                                    )}

                                    <PrincipalSelect
                                        value={null}
                                        onChange={handleApproverChange}
                                        placeholder="Add recipients..."
                                        className="bg-slate-50 border-slate-200"
                                    />
                                </Card>

                                {isUserTask && (
                                    <Card className="p-4 space-y-3">
                                        <Label variant="section">Task Form</Label>
                                        <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                                            <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                                                {currentForm?.name || 'No form assigned'}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleEditFormLayout}
                                            className="w-full gap-2 font-semibold h-10 border-slate-200"
                                        >
                                            <FileEdit size={14} />
                                            Open Task Editor
                                        </Button>
                                        <p className="text-[10px] text-slate-400 text-center px-2">
                                            Configure the task form layout in the Task Editor
                                        </p>
                                    </Card>
                                )}

                                {isUserTask && (
                                    <Card className="p-4 space-y-4">
                                        <Label variant="section">Notifications</Label>
                                        <p className="text-[11px] text-slate-400 -mt-1">
                                            Choose how stakeholders are notified at this step.
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'email', icon: Mail, label: 'EMAIL' },
                                                { id: 'bell', icon: Bell, label: 'BELL' },
                                                { id: 'teams', icon: MessageSquare, label: 'TEAMS' },
                                            ].map((channel) => {
                                                const notificationTypes = (node.data.notificationTypes as string[]) || ['bell'];
                                                const isActive = notificationTypes.includes(channel.id);
                                                const ChannelIcon = channel.icon;
                                                return (
                                                    <button
                                                        key={channel.id}
                                                        onClick={() => {
                                                            const current = (node.data.notificationTypes as string[]) || ['bell'];
                                                            const next = current.includes(channel.id)
                                                                ? current.filter(c => c !== channel.id)
                                                                : [...current, channel.id];
                                                            updateNodeData(node.id, { notificationTypes: next });
                                                        }}
                                                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isActive
                                                            ? 'border-amber-400 bg-white shadow-sm'
                                                            : 'border-slate-100 bg-slate-50/50 grayscale opacity-60'
                                                            }`}
                                                    >
                                                        <ChannelIcon size={18} className={isActive ? 'text-amber-500' : 'text-slate-400'} />
                                                        <span className={`text-[9px] font-bold tracking-widest ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                                                            {channel.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Edit Body Content button — only visible when EMAIL is enabled */}
                                        {((node.data.notificationTypes as string[]) || []).includes('email') && (
                                            <EmailTemplateEditor
                                                subject={(node.data.emailSubject as string) || ''}
                                                body={(node.data.emailBody as string) || ''}
                                                onSave={(subject, body) => updateNodeData(node.id, { emailSubject: subject, emailBody: body })}
                                                availableSources={availableSources}
                                            />
                                        )}
                                    </Card>
                                )}

                                {/* Moved SLA, Owner, Sync, Predecessors into General Tab */}
                                <Card className="p-4 space-y-4">
                                    <FormField label="SLA" hint="Time limit in days">
                                        <SlaInput
                                            value={(node.data.sla as number) || 0}
                                            onChange={(val) => updateNodeData(node.id, { sla: val })}
                                        />
                                    </FormField>

                                    <FormField label="Default Owner" hint="Who is responsible for this step">
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
                            </TabsContent>

                            <TabsContent value="mapping" className="space-y-4 focus-visible:outline-none">
                                <Card className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label variant="section">Field Mappings</Label>
                                        <Button variant="ghost" size="sm" onClick={handleEditFormLayout} className="text-primary h-7 text-[10px] px-2 gap-1 font-semibold border-slate-200">
                                            <FileEdit size={12} />
                                            Edit {isUserTask ? 'Task' : 'Approval'} Form
                                        </Button>
                                    </div>

                                    {targetFields.length === 0 ? (
                                        <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                                            <p className="text-xs text-slate-400 italic">No fields defined for this step.<br />Add fields to set up mappings.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {targetFields.map(field => (
                                                <MappingSelector
                                                    key={field.id}
                                                    label={field.label}
                                                    availableSources={availableSources}
                                                    value={inputMapping[field.id]}
                                                    onChange={(val) => handleMappingChange(field.id, val)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Info box removed for User Tasks as per request */}
                                    {!isUserTask && (
                                        <div className="text-[11px] text-slate-400 italic bg-blue-50/30 p-3 rounded-xl border border-blue-100/50 flex gap-2">
                                            <Database size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                            <span>Mapped fields will automatically pre-fill with values captured from previous steps when the {isUserTask ? 'user' : 'approver'} opens the task.</span>
                                        </div>
                                    )}
                                </Card>
                            </TabsContent>

                            {isUserTask && (
                                <TabsContent value="output" className="space-y-4 focus-visible:outline-none">
                                    <Card className="p-4 space-y-4">
                                        <Label variant="section">Output Fields</Label>
                                        <p className="text-[11px] text-slate-400 -mt-1">
                                            These fields from the Task Form will be available as outputs for subsequent steps.
                                        </p>
                                        <div className="space-y-2">
                                            {targetFields.filter(f => !f.id.startsWith('__')).map(f => (
                                                <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                                                    <Database size={12} className="text-slate-400" />
                                                    <span className="text-xs font-medium text-slate-600">{f.label}</span>
                                                </div>
                                            ))}
                                            {targetFields.filter(f => !f.id.startsWith('__')).length === 0 && (
                                                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                                                    <p className="text-xs text-slate-400 italic">No fields defined for this form.</p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </TabsContent>
                            )}
                        </Tabs>
                    )}

                    {/* ─── Shared: SLA + Owner (Visible for all node types EXCEPT UserTask/Approval where it's moved to General Tab) ────────────────── */}
                    {!(isApproval || isUserTask) && (
                        <>
                            <Card className="p-4 space-y-4">
                                <FormField label="SLA" hint="Time limit in days">
                                    <SlaInput
                                        value={(node.data.sla as number) || 0}
                                        onChange={(val) => updateNodeData(node.id, { sla: val })}
                                    />
                                </FormField>

                                <FormField label="Default Owner" hint="Who is responsible for this step">
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

                </>
            )}

            {/* ── CONDITION NODE ──────────────────────────────── */}
            {nodeType === 'conditionNode' && (
                <Card className="p-4 space-y-4">
                    <Label variant="section">Condition Logic</Label>

                    <Button
                        variant="outline"
                        onClick={() => setIsConditionEditorOpen(true)}
                        className="w-full gap-2 font-semibold h-12 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 rounded-xl"
                    >
                        <GitBranch size={16} />
                        Edit Condition Rules
                    </Button>

                    {node.data.conditionLogic ? (
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600">
                            <strong>Configured:</strong> {`${((node.data.conditionLogic as any).rules?.length) || 0}`} rule(s)
                            <br />
                            <span className="text-[10px] text-slate-400">Match type: {`${(node.data.conditionLogic as any).matchType || 'AND'}`}</span>
                        </div>
                    ) : null}

                    <ConditionEditorDialog
                        open={isConditionEditorOpen}
                        onOpenChange={setIsConditionEditorOpen}
                        initialLogic={node.data.conditionLogic as ConditionLogic | null}
                        availableFields={availableSources}
                        onSave={(logic) => updateNodeData(node.id, { conditionLogic: logic })}
                    />
                </Card>
            )}


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
