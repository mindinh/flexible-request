import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, AlertTriangle, Trash2 } from 'lucide-react';
import { useStudioStore } from '../../features/studio/useStudioStore';
import { ConfirmDialog } from './StudioUtils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

interface RightPanelProps {
    title: string;
    icon?: React.ReactNode;
    onClose?: () => void;
    children: React.ReactNode;
    width?: number; // Initial width
    isOpen?: boolean; // For animation control
}

export function RightPanel({ title, icon, onClose, children, width = 500, isOpen = true }: RightPanelProps) {
    const [panelWidth, setPanelWidth] = useState(width);
    const [isResizing, setIsResizing] = useState(false);
    const resizingRef = useRef(false);

    // Sync state with prop, but only when not resizing and panel opens
    useEffect(() => {
        if (!resizingRef.current) {
            setPanelWidth(width);
        }
    }, [width, isOpen]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;

            // Calculate new width: Window Width - Mouse X
            // Right panel is anchored to the right, so width is the distance from right edge
            const newWidth = window.innerWidth - e.clientX;

            // Constrain width
            if (newWidth > 250 && newWidth < 1200) {
                setPanelWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            resizingRef.current = false;
            setIsResizing(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    };

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: panelWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
                duration: isResizing ? 0 : 0.3, // Disable animation while resizing for performance
                ease: 'easeInOut'
            }}
            className="relative border-l border-slate-200 bg-slate-50 flex-shrink-0 h-full flex flex-col"
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50 flex flex-col justify-center items-center group"
                onMouseDown={startResizing}
            >
                {/* Visual indicator for handle */}
                <div className="h-8 w-1 bg-slate-200 rounded-full group-hover:bg-primary transition-colors" />
            </div>

            {/* Inner Content Container - remove fixed width, fill available space */}
            <div
                className="p-4 flex flex-col h-full w-full overflow-hidden"
            >
                {/* Panel Header */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 truncate pr-2">
                        {icon || <span className="w-1 h-4 bg-primary rounded-sm flex-shrink-0" />}
                        <span className="truncate">{title}</span>
                    </h3>
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 flex-shrink-0"
                            onClick={onClose}
                            aria-label="Close panel"
                        >
                            <X size={18} />
                        </Button>
                    )}
                </div>

                {/* Panel Content - Scrollable area */}
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    {children}
                </div>
            </div>
        </motion.div>
    );
}

// Reusable form field component
interface FormFieldProps {
    label: string;
    children: React.ReactNode;
    hint?: string;
}

export function FormField({ label, children, hint }: FormFieldProps) {
    return (
        <div className="mb-4">
            <Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {label}
            </Label>
            <Card className="p-0">
                {children}
            </Card>
            {hint && (
                <p className="mt-1.5 text-[11px] text-slate-400 italic">{hint}</p>
            )}
        </div>
    );
}

// Outcome Chip component with semantic colors
interface OutcomeChipProps {
    outcome: string;
    onRemove: () => void;
}

function OutcomeChip({ outcome, onRemove }: OutcomeChipProps) {
    const getVariant = () => {
        const upper = outcome.toUpperCase();
        if (upper.includes('APPROVE')) return 'success';
        if (upper.includes('REJECT')) return 'destructive';
        if (upper.includes('CHANGE') || upper.includes('REQUEST')) return 'warning';
        return 'secondary';
    };

    const colorClasses = {
        success: 'bg-green-100 text-green-800 border-green-300',
        destructive: 'bg-red-100 text-red-800 border-red-300',
        warning: 'bg-amber-100 text-amber-800 border-amber-300',
        secondary: 'bg-slate-100 text-slate-600 border-slate-300',
    };

    const variant = getVariant();

    return (
        <motion.div
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold",
                colorClasses[variant]
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.02 }}
        >
            {outcome}
            <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-4 w-4 rounded-full bg-current/20 hover:bg-current/30 p-0"
            >
                <X size={10} className="text-current" />
            </Button>
        </motion.div>
    );
}

// SLA Input with suffix
interface SlaInputProps {
    value: number;
    onChange: (value: number) => void;
}

function SlaInput({ value, onChange }: SlaInputProps) {
    return (
        <div className="flex items-center">
            <Input
                type="number"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                min={0}
                className="flex-1 border-0 rounded-none focus-visible:ring-0"
            />
            <span className="px-3.5 py-2.5 bg-slate-50 border-l border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                DAYS
            </span>
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
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
            <Checkbox
                id={`pred-${nodeId}`}
                checked={isSelected}
                onCheckedChange={(checked) => onToggle(checked === true)}
            />
            <label htmlFor={`pred-${nodeId}`} className="flex-1 text-sm text-slate-700 cursor-pointer select-none">
                {label}
            </label>
        </div>
    );
}

// Step details component
import type { UiWorkflowNode, UiWorkflowEdge } from '../../features/studio/types';

interface StepDetailsPanelProps {
    node: UiWorkflowNode;
    allNodes: UiWorkflowNode[];
    edges: UiWorkflowEdge[];
    onUpdate: (id: string, data: any) => void;
    onUpdateEdges: (edges: UiWorkflowEdge[]) => void;
    onEditSchema: () => void;
    onManageRules: () => void;
    onClose: () => void;
}

export function StepDetailsPanel({
    node,
    allNodes,
    edges,
    onUpdate,
    onUpdateEdges,
    onEditSchema,
    onManageRules,
    onClose
}: StepDetailsPanelProps) {
    const { deleteStep } = useStudioStore();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleNameChange = (val: string) => {
        onUpdate(node.id, { label: val });
    };

    const handleSlaChange = (val: number) => {
        onUpdate(node.id, { sla: val });
    };

    const handleStartStepChange = (isStart: boolean) => {
        // Exclusivity logic should be handled by parent or store, 
        // but here we just trigger the update for this node.
        onUpdate(node.id, { isStart });
    };

    const handlePredecessorToggle = (targetNodeId: string, isSelected: boolean) => {
        // Predecessor: targetNode -> CurrentNode (edge source -> target)
        // If selected, we ADD an edge: targetNode -> CurrentNode
        // If unselected, we REMOVE edge: targetNode -> CurrentNode

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

    // Filter potential predecessors (cannot be self)
    // Also prevent cycles? For now just basic filtering.
    const potentialPredecessors = allNodes.filter(n => n.id !== node.id);

    return (
        <RightPanel title="Step Details" onClose={onClose}>
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
                            className="h-5 w-5"
                        />
                    </div>

                    <FormField label="SLA" hint="Time limit in days">
                        <SlaInput value={node.data.sla as number || 0} onChange={handleSlaChange} />
                    </FormField>

                    {/* Schema Mode Removed as per request */}

                    {/* Sync Trigger Moved Down */}
                </Card>

                {/* Predecessors Card */}
                <div className="space-y-2">
                    <Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Predecessors
                    </Label>
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

                {/* Sync Trigger (Moved here) */}
                <Card className="p-4 space-y-2">
                    <div className="space-y-2">
                        <Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Sync Trigger
                        </Label>
                        <Select
                            value={(node.data.syncTrigger as string) || 'NONE'}
                            onValueChange={(value) => onUpdate(node.id, { syncTrigger: value })}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select sync trigger" />
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
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                        <Trash2 size={16} />
                        Delete Step
                    </Button>
                </div>
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
        </RightPanel >
    );
}
