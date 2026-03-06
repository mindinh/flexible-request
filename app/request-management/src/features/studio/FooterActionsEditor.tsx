import { useState } from 'react';
import { Plus, Trash2, GripVertical, MousePointerClick } from 'lucide-react';
import { Card, Button, Input } from '../../components/ui';
import { cn } from '../../lib/utils';
import type { UiFormAction } from './types';

interface FooterActionsEditorProps {
    actions: UiFormAction[];
    onChange: (actions: UiFormAction[]) => void;
}

const VARIANT_OPTIONS: { value: UiFormAction['variant']; label: string; color: string }[] = [
    { value: 'primary', label: 'Primary', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'secondary', label: 'Secondary', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'destructive', label: 'Destructive', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'success', label: 'Success', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { value: 'warning', label: 'Warning', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    { value: 'outline', label: 'Outline', color: 'bg-slate-50 text-slate-700 border-slate-400' },
    { value: 'ghost', label: 'Ghost', color: 'bg-transparent text-slate-500 border-slate-200' },
];

/**
 * Footer Actions Editor — lets Studio users define the decision buttons
 * that appear at the bottom of a form (e.g. Approve, Reject, Send to Legal).
 * Each action creates a corresponding output handle on the workflow node.
 */
export function FooterActionsEditor({ actions, onChange }: FooterActionsEditorProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const addAction = () => {
        const newAction: UiFormAction = {
            id: `action_${Date.now()}`,
            label: 'New Action',
            variant: 'secondary',
        };
        onChange([...actions, newAction]);
        setExpandedId(newAction.id);
    };

    const removeAction = (id: string) => {
        onChange(actions.filter(a => a.id !== id));
        if (expandedId === id) setExpandedId(null);
    };

    const updateAction = (id: string, updates: Partial<UiFormAction>) => {
        onChange(actions.map(a => a.id === id ? { ...a, ...updates } : a));
        // When the ID itself changes, keep the panel expanded by tracking the new ID
        if (updates.id && expandedId === id) {
            setExpandedId(updates.id);
        }
    };

    const getVariantStyle = (variant: UiFormAction['variant']) =>
        VARIANT_OPTIONS.find(v => v.value === variant)?.color || '';

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <MousePointerClick size={16} className="text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Footer Actions</h4>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addAction}
                    className="h-7 text-xs gap-1"
                >
                    <Plus size={12} />
                    Add Action
                </Button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
                Define decision buttons shown at the bottom of this form. Each action creates a workflow output handle for conditional branching.
            </p>

            {actions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                    No footer actions defined. Add actions to enable decision branching.
                </div>
            ) : (
                <div className="space-y-2">
                    {actions.map((action) => (
                        <div
                            key={action.id}
                            className={cn(
                                "border rounded-lg transition-all",
                                expandedId === action.id ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-white"
                            )}
                        >
                            {/* Header row */}
                            <div
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                                onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}
                            >
                                <GripVertical size={14} className="text-slate-300 flex-shrink-0" />
                                <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0",
                                    getVariantStyle(action.variant)
                                )}>
                                    {action.variant}
                                </span>
                                <span className="flex-1 text-sm font-medium text-slate-700 truncate">{action.label}</span>
                                <span className="text-xs text-slate-400 font-mono flex-shrink-0">{action.id}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-red-500 flex-shrink-0"
                                    onClick={(e) => { e.stopPropagation(); removeAction(action.id); }}
                                >
                                    <Trash2 size={12} />
                                </Button>
                            </div>

                            {/* Expanded editor */}
                            {expandedId === action.id && (
                                <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Label</label>
                                            <Input
                                                value={action.label}
                                                onChange={e => updateAction(action.id, { label: e.target.value })}
                                                className="h-8 text-sm"
                                                placeholder="Button text"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Action ID</label>
                                            <Input
                                                value={action.id}
                                                onChange={e => {
                                                    const newId = e.target.value.replace(/\s/g, '_').toLowerCase();
                                                    updateAction(action.id, { id: newId });
                                                }}
                                                className="h-8 text-sm font-mono"
                                                placeholder="action_id"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Style</label>
                                        <div className="flex gap-2">
                                            {VARIANT_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => updateAction(action.id, { variant: opt.value })}
                                                    className={cn(
                                                        "text-xs px-3 py-1.5 rounded-md border font-medium transition-all",
                                                        action.variant === opt.value
                                                            ? `${opt.color} ring-2 ring-offset-1 ring-primary/30`
                                                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
