import { useState } from 'react';
import { Trash2, Play, Flag, FileEdit, Mail, Shield, GitBranch, Layers, ExternalLink, Clock } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField, ConfirmDialog } from '@/components/studio';
import { PrincipalSelect, type Principal } from '@/components/shared/PrincipalSelect';
import type { UiWorkflowNode, UiWorkflowEdge } from './types';

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
                    return { icon: FileEdit, color: 'var(--brand-red)', label: 'Form Step' };
                case 'email':
                    return { icon: Mail, color: 'var(--brand-red)', label: 'Email Step' };
                case 'approval':
                    return { icon: Shield, color: 'var(--brand-red)', label: 'Approval Step' };
                default:
                    return { icon: FileEdit, color: 'var(--brand-red)', label: 'Action Step' };
            }
        default:
            return { icon: FileEdit, color: '#64748b', label: 'Step' };
    }
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

    const nodeType = node.type || 'actionNode';
    const subType = node.data?.actionSubType as string | undefined;
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

            {/* Step Label */}
            <Card className="p-4 space-y-4">
                <FormField label="Step Label" hint="Display name on the canvas">
                    <Input
                        value={(node.data.label as string) || ''}
                        onChange={(e) => handleLabelChange(e.target.value)}
                        placeholder="Enter step name..."
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

            {/* ── ACTION NODE ────────────────────────────────── */}
            {nodeType === 'actionNode' && (
                <>
                    {/* ─── FORM SUB-TYPE ─────────────────────── */}
                    {(subType === 'form' || !subType) && (
                        <Card className="p-4 space-y-3">
                            <Label variant="section">Form Configuration</Label>
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
                    )}

                    {/* ─── EMAIL SUB-TYPE ─────────────────────── */}
                    {subType === 'email' && (
                        <Card className="p-4 space-y-4">
                            <Label variant="section">Email Configuration</Label>
                            <FormField label="Recipients" hint="Who receives this email">
                                <Select
                                    value={(node.data.emailRecipient as string) || 'requester'}
                                    onValueChange={(val) => updateNodeData(node.id, { emailRecipient: val })}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="requester">Requester</SelectItem>
                                        <SelectItem value="step_owner">Step Owner</SelectItem>
                                        <SelectItem value="coordinator">Coordinator</SelectItem>
                                        <SelectItem value="custom">Custom (specify below)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <FormField label="Subject Template" hint="Use {{fieldName}} for dynamic values">
                                <Input
                                    value={(node.data.emailSubject as string) || ''}
                                    onChange={(e) => updateNodeData(node.id, { emailSubject: e.target.value })}
                                    placeholder="Request {{displayId}} - Status Update"
                                    className="border-0 focus-visible:ring-0"
                                />
                            </FormField>

                            <FormField label="Body Template" hint="Email body content with placeholders">
                                <textarea
                                    value={(node.data.emailBody as string) || ''}
                                    onChange={(e) => updateNodeData(node.id, { emailBody: e.target.value })}
                                    placeholder="Dear {{requesterName}},&#10;&#10;Your request {{displayId}} has been processed..."
                                    className="w-full min-h-[80px] rounded-lg border border-slate-200 bg-white p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
                                />
                            </FormField>
                        </Card>
                    )}

                    {/* ─── APPROVAL SUB-TYPE ──────────────────── */}
                    {subType === 'approval' && (
                        <Card className="p-4 space-y-4">
                            <Label variant="section">Approval Configuration</Label>
                            <FormField label="Approval Policy" hint="How approvals are collected">
                                <Select
                                    value={(node.data.approvalPolicy as string) || 'any'}
                                    onValueChange={(val) => updateNodeData(node.id, { approvalPolicy: val })}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any One Approver</SelectItem>
                                        <SelectItem value="all">All Must Approve</SelectItem>
                                        <SelectItem value="sequential">Sequential Chain</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <FormField label="Decision Options" hint="Available actions for the approver">
                                <div className="flex flex-wrap gap-2">
                                    {['Approve', 'Reject', 'Send Back'].map((action) => {
                                        const decisions = ((node.data.decisions as string[]) || ['Approve', 'Reject']);
                                        const isEnabled = decisions.includes(action);
                                        return (
                                            <button
                                                key={action}
                                                onClick={() => {
                                                    const newDecisions = isEnabled
                                                        ? decisions.filter(d => d !== action)
                                                        : [...decisions, action];
                                                    updateNodeData(node.id, { decisions: newDecisions });
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${isEnabled
                                                    ? action === 'Approve' ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                        : action === 'Reject' ? 'bg-red-50 border-red-300 text-red-700'
                                                            : 'bg-amber-50 border-amber-300 text-amber-700'
                                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                                                    }`}
                                            >
                                                {action}
                                            </button>
                                        );
                                    })}
                                </div>
                            </FormField>

                            <Label variant="section">Form for Review</Label>
                            {currentForm ? (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80">
                                    <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 flex-1 truncate">{currentForm.name}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No form assigned yet. Click below to create one.</p>
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
                    )}

                    {/* ─── Shared: SLA + Owner ────────────────── */}
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
            {nodeType === 'conditionNode' && (
                <Card className="p-4 space-y-3">
                    <Label variant="section">Condition Logic</Label>
                    <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-4 text-center">
                        <GitBranch size={24} className="text-purple-400 mx-auto mb-2" />
                        <p className="text-xs text-purple-500 font-medium">Condition Editor</p>
                        <p className="text-[11px] text-purple-400 mt-1">
                            Route workflow based on form data conditions. <br />
                            Coming soon.
                        </p>
                    </div>
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
