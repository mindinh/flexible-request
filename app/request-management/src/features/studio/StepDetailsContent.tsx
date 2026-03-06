import { useState, useMemo } from 'react';
import { Trash2, FormInput, Settings2, Database } from 'lucide-react';
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
import { MappingSelector } from './components/MappingSelector';
import type { UiWorkflowNode, UiWorkflowEdge, UiFormField, UiSection } from './types';

// SLA Input with suffix
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

// Predecessor Item Component
function PredecessorItem({
    nodeId,
    label,
    isSelected,
    onToggle
}: {
    nodeId: string;
    label: string;
    isSelected: boolean;
    onToggle: (selected: boolean) => void;
}) {
    return (
        <div
            onClick={(e) => {
                // Prevent toggle if clicking checkbox directly to avoid double toggle
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

interface StepDetailsContentProps {
    node: UiWorkflowNode;
    allNodes: UiWorkflowNode[];
    edges: UiWorkflowEdge[];
    onUpdate: (id: string, data: any) => void;
    onUpdateEdges: (edges: UiWorkflowEdge[]) => void;
    onEditSchema?: () => void;
    onManageRules?: () => void;
}

export function StepDetailsContent({
    node,
    allNodes,
    edges,
    onUpdate,
    onUpdateEdges,
    onEditSchema,
    onManageRules
}: StepDetailsContentProps) {
    const { deleteStep, forms } = useStudioStore();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // --- Data Resolvers ---

    // 1. Get fields for CURRENT step (the mapping targets)
    const currentForm = forms.find(f => f.id === node.data.formId);
    const targetFields: UiFormField[] = [];
    if (currentForm) {
        // Flatten fields from sections if needed
        currentForm.items.forEach(item => {
            if (item.type === 'section') {
                targetFields.push(...(item as UiSection).fields);
            } else if (item.type !== 'table') {
                targetFields.push(item as UiFormField);
            }
        });
    }

    // 2. Get available source fields from PREVIOUS steps
    const availableSources = useMemo(() => {
        const sources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string }> = [];

        // Find Workflow Start node (always a source)
        const startNode = allNodes.find(n => n.data.isStart || n.type === 'startNode');
        if (startNode) {
            const startForm = forms.find(f => f.id === startNode.data.formId);
            if (startForm) {
                startForm.items.forEach(item => {
                    if (item.type === 'section') {
                        (item as UiSection).fields.forEach(f => sources.push({
                            stepId: startNode.id,
                            stepName: startNode.data.label as string,
                            fieldId: f.id,
                            fieldName: f.label
                        }));
                    } else if (item.type !== 'table') {
                        const f = item as UiFormField;
                        sources.push({
                            stepId: startNode.id,
                            stepName: startNode.data.label as string,
                            fieldId: f.id,
                            fieldName: f.label
                        });
                    }
                });
            }
        }
        return sources;
    }, [allNodes, forms]);

    // 3. Handle Mapping Updates
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
        onUpdate(node.id, { inputMapping: JSON.stringify(newMapping) });
    };

    const isApprovalStep = node.data.actionSubType === 'approval';

    const handleNameChange = (val: string) => {
        onUpdate(node.id, { label: val });
    };

    const handleSlaChange = (val: number) => {
        onUpdate(node.id, { sla: val });
    };

    const handleStartStepChange = (isStart: boolean) => {
        onUpdate(node.id, { isStart });
    };

    // Get current step owner as Principal
    const stepOwner: Principal | null = node.data.owner_ID ? {
        id: node.data.owner_ID as string,
        type: (node.data.ownerType as string) || 'USER',
        displayName: (node.data.ownerName as string) || 'Unknown',
    } : null;

    const handleOwnerChange = (principal: Principal | null) => {
        if (principal) {
            onUpdate(node.id, {
                owner_ID: principal.id,
                ownerType: principal.type,
                ownerName: principal.displayName,
            });
        } else {
            onUpdate(node.id, {
                owner_ID: null,
                ownerType: null,
                ownerName: null,
            });
        }
    };

    const handlePredecessorToggle = (targetNodeId: string, isSelected: boolean) => {
        const existingEdge = edges.find(e => e.source === targetNodeId && e.target === node.id);

        if (isSelected && !existingEdge) {
            const newEdge: UiWorkflowEdge = {
                id: `e-${targetNodeId}-${node.id}`,
                source: targetNodeId,
                target: node.id,
                type: 'smoothstep'
            };
            onUpdateEdges([...edges, newEdge]);
        } else if (!isSelected && existingEdge) {
            const newEdges = edges.filter(e => e.id !== existingEdge.id);
            onUpdateEdges(newEdges);
        }
    };

    const potentialPredecessors = allNodes.filter(n => n.id !== node.id);

    const renderGeneralTab = () => (
        <div className="space-y-4">
            {/* Step Name Card */}
            <Card className="p-4 space-y-4">
                <FormField label="Step Name" hint="Mandatory">
                    <Input
                        value={node.data.label as string}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Enter step name..."
                        className="border-0 focus-visible:ring-0 font-medium"
                    />
                </FormField>

                {!isApprovalStep && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">Start Step</span>
                            <span className="text-xs text-slate-500">First step of the request</span>
                        </div>
                        <Checkbox
                            checked={!!node.data.isStart}
                            onCheckedChange={(checked) => handleStartStepChange(checked === true)}
                        />
                    </div>
                )}

                <FormField label="SLA" hint="Time limit in days">
                    <SlaInput value={node.data.sla as number || 0} onChange={handleSlaChange} />
                </FormField>
            </Card>

            {(node.data.isStart || node.type === 'startNode') && (
                <Card className="p-4 space-y-3">
                    <div className="flex flex-col">
                        <Label variant="section">Outputs</Label>
                        <span className="text-[11px] text-slate-400">Captured fields available for mapping</span>
                    </div>
                    {targetFields.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No fields defined for this form.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {targetFields.map(f => (
                                <div key={f.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                                    <Database size={12} className="text-slate-400" />
                                    <span className="text-xs font-medium text-slate-600">{f.label}</span>
                                    <span className="text-[10px] text-slate-400 ml-auto font-mono">{f.id}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Predecessors Card */}
            <div className="space-y-2">
                <Label variant="section">Predecessors</Label>
                <Card className="p-2 max-h-48 overflow-y-auto">
                    {potentialPredecessors.length === 0 ? (
                        <p className="text-xs text-slate-400 p-2 italic text-center">No other steps available</p>
                    ) : (
                        potentialPredecessors.map(pred => (
                            <PredecessorItem
                                key={pred.id}
                                nodeId={pred.id}
                                label={pred.data.label as string}
                                isSelected={edges.some(e => e.source === pred.id && e.target === node.id)}
                                onToggle={(sel) => handlePredecessorToggle(pred.id, sel)}
                            />
                        ))
                    )}
                </Card>
            </div>

            {/* Sync Trigger */}
            <Card className="p-4 space-y-2">
                <div className="space-y-2">
                    <Label variant="section">Sync Trigger</Label>
                    <Select
                        value={(node.data.syncTrigger as string) || 'NONE'}
                        onValueChange={(val) => onUpdate(node.id, { syncTrigger: val })}
                    >
                        <SelectTrigger className="w-full bg-white border-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NONE">None (No sync)</SelectItem>
                            <SelectItem value="IMMEDIATE">Immediate (Sync on save)</SelectItem>
                            <SelectItem value="WITH_NEXT">With Next Step</SelectItem>
                            <SelectItem value="ON_COMPLETE">On Complete (Final step)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>
        </div>
    );

    const renderApproversTab = () => (
        <div className="space-y-4">
            <Card className="p-4 space-y-4">
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

                {onManageRules && (
                    <div className="pt-2">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={onManageRules}
                            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <Settings2 size={16} />
                            Configure Approval Rules
                        </Button>
                        <p className="text-[11px] text-slate-400 italic mt-2 text-center">
                            Define dynamic approvers based on form data or conditions.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );

    const renderInputMappingTab = () => (
        <div className="space-y-4">
            <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <Label variant="section">Field Mappings</Label>
                    <Button variant="ghost" size="sm" onClick={onEditSchema} className="text-primary h-7 text-[10px] px-2 gap-1">
                        <FormInput size={12} />
                        Edit Approval Form
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

                <p className="text-[11px] text-slate-400 italic bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                    Mapped fields will automatically pre-fill with values captured from previous steps when the approver opens the task.
                </p>
            </Card>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {isApprovalStep ? (
                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4 bg-slate-100/50 p-1">
                        <TabsTrigger value="general" className="text-xs py-1.5">General</TabsTrigger>
                        <TabsTrigger value="mapping" className="text-xs py-1.5">Input</TabsTrigger>
                        <TabsTrigger value="approvers" className="text-xs py-1.5">Approvers</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general">
                        {renderGeneralTab()}
                    </TabsContent>

                    <TabsContent value="mapping">
                        {renderInputMappingTab()}
                    </TabsContent>

                    <TabsContent value="approvers">
                        {renderApproversTab()}
                    </TabsContent>
                </Tabs>
            ) : (
                <>
                    {renderGeneralTab()}
                    <Card className="p-4">
                        <FormField label="Default Owner" hint="Step responsibility">
                            <PrincipalSelect
                                value={stepOwner}
                                onChange={handleOwnerChange}
                                placeholder="Inherit from coordinator"
                            />
                        </FormField>
                    </Card>
                    {onEditSchema && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onEditSchema}
                            className="w-full gap-2 h-10 border-slate-200"
                        >
                            <FormInput size={16} />
                            Edit Form Layout
                        </Button>
                    )}
                </>
            )}

            {/* Delete Step Button */}
            <div className="pt-6 mt-6 border-t border-slate-100">
                <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="outline-destructive"
                    className="w-full"
                >
                    <Trash2 size={16} />
                    Delete Step
                </Button>
            </div>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Step"
                message="Are you sure you want to delete this step? This cannot be undone."
                confirmLabel="Delete Step"
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
