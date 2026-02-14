import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
}

export function StepDetailsContent({
    node,
    allNodes,
    edges,
    onUpdate,
    onUpdateEdges
}: StepDetailsContentProps) {
    const { deleteStep } = useStudioStore();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    return (
        <div className="flex flex-col gap-4">
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

                <FormField label="SLA" hint="Time limit in days">
                    <SlaInput value={node.data.sla as number || 0} onChange={handleSlaChange} />
                </FormField>

                {/* Default Step Owner */}
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

            {/* Predecessors Card */}
            <div className="space-y-2">
                <Label variant="section">Predecessors</Label>
                <Card className="p-2 max-h-96 overflow-y-auto">
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
                <p className="text-[11px] text-slate-400 italic px-1">
                    Select steps that must complete before this step can start.
                </p>
            </div>

            {/* Sync Trigger */}
            <Card className="p-4 space-y-2">
                <div className="space-y-2">
                    <Label variant="section">Sync Trigger</Label>
                    <Select
                        value={(node.data.syncTrigger as string) || 'NONE'}
                        onValueChange={(val) => onUpdate(node.id, { syncTrigger: val })}
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
                </div>
            </Card>

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
