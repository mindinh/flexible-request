import { useState } from 'react';
import { Plus, Trash2, GitBranch, Layers, Database } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog';

import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

export interface ConditionRule {
    id: string;
    fieldId: string;
    operator: string;
    value: string;
}

export interface ConditionLogic {
    matchType: 'AND' | 'OR';
    rules: ConditionRule[];
}

interface ConditionEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialLogic: ConditionLogic | null;
    availableFields: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string; type?: string }>;
    onSave: (logic: ConditionLogic) => void;
}

// Map field types to available operators
const getOperatorsForField = () => {
    // Default text/generic operators
    return [
        { value: 'EQUALS', label: 'Equals (==)' },
        { value: 'NOT_EQUALS', label: 'Not Equals (!=)' },
        { value: 'CONTAINS', label: 'Contains' },
        { value: 'GREATER_THAN', label: 'Greater Than (>)' },
        { value: 'LESS_THAN', label: 'Less Than (<)' }
    ];
};

export function ConditionEditorDialog({
    open,
    onOpenChange,
    initialLogic,
    availableFields,
    onSave
}: ConditionEditorDialogProps) {
    const [matchType, setMatchType] = useState<'AND' | 'OR'>(initialLogic?.matchType || 'AND');
    const [rules, setRules] = useState<ConditionRule[]>(
        initialLogic?.rules?.length ? initialLogic.rules : [{
            id: crypto.randomUUID(),
            fieldId: '',
            operator: 'EQUALS',
            value: ''
        }]
    );

    const handleAddRule = () => {
        setRules([...rules, { id: crypto.randomUUID(), fieldId: '', operator: 'EQUALS', value: '' }]);
    };

    const handleRemoveRule = (id: string) => {
        setRules(rules.filter(r => r.id !== id));
    };

    const updateRule = (id: string, field: keyof ConditionRule, value: string) => {
        setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSave = () => {
        // Filter out completely empty rules
        const validRules = rules.filter(r => r.fieldId || r.value);
        onSave({
            matchType,
            rules: validRules
        });
        onOpenChange(false);
    };

    // Group fields by step source
    const groupedFields = availableFields.reduce((acc, field) => {
        const groupName = field.stepName;
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(field);
        return acc;
    }, {} as Record<string, typeof availableFields>);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-red-50/50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-[var(--brand-red)]">
                            <GitBranch size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Condition Logic Editor</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                Define the rules that decide if the workflow follows the TRUE path.
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">

                    {/* Multi-rule logic toggle */}
                    <div className={`flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl transition-opacity ${rules.length <= 1 ? 'opacity-60' : ''}`}>
                        <div>
                            <Label className="text-sm font-bold text-slate-700">Condition Match Type</Label>
                            <p className="text-[11px] text-slate-500">Determine how multiple rules are combined.</p>
                        </div>
                        <div className={`flex bg-white rounded-lg p-1 border border-slate-200 ml-auto ${rules.length <= 1 ? 'pointer-events-none' : ''}`}>
                            <button
                                onClick={() => setMatchType('AND')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${matchType === 'AND' ? 'bg-red-100 text-[var(--brand-red)] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                Match ALL (AND)
                            </button>
                            <button
                                onClick={() => setMatchType('OR')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${matchType === 'OR' ? 'bg-red-100 text-[var(--brand-red)] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                Match ANY (OR)
                            </button>
                        </div>
                    </div>

                    {/* Rule Builder */}
                    <div className="space-y-3">
                        {rules.map((rule, idx) => (
                            <div key={rule.id} className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm relative group hover:border-red-300 transition-colors">

                                {/* Rule Index / Status */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold mt-2">
                                    {idx + 1}
                                </div>

                                <div className="flex-1 grid grid-cols-12 gap-3 items-end">
                                    {/* Field Selector */}
                                    <div className="col-span-5 space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Field to evaluate</Label>
                                        <Select value={rule.fieldId} onValueChange={(val) => updateRule(rule.id, 'fieldId', val)}>
                                            <SelectTrigger className="bg-slate-50">
                                                <SelectValue placeholder="Select a field..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(groupedFields).map(([groupName, fields]) => (
                                                    <div key={groupName}>
                                                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 flex items-center gap-1.5">
                                                            {groupName === 'System' ? <Database size={10} /> : <Layers size={10} />}
                                                            {groupName}
                                                        </div>
                                                        {fields.map(f => (
                                                            <SelectItem key={f.fieldId} value={f.fieldId} className="pl-6 text-sm">
                                                                {f.fieldName}
                                                            </SelectItem>
                                                        ))}
                                                    </div>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Operator Selector */}
                                    <div className="col-span-3 space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Operator</Label>
                                        <Select value={rule.operator} onValueChange={(val) => updateRule(rule.id, 'operator', val)}>
                                            <SelectTrigger className="bg-slate-50 text-[var(--brand-red)] font-semibold text-center h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getOperatorsForField().map(op => (
                                                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Value Input */}
                                    <div className="col-span-4 space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Target Value</Label>
                                        <Input
                                            value={rule.value}
                                            onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                                            placeholder="Enter value..."
                                            className="bg-slate-50 h-10"
                                        />
                                    </div>
                                </div>

                                {/* Remove Rule Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveRule(rule.id)}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-100 shadow-sm"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        onClick={handleAddRule}
                        className="w-full h-12 border-2 border-dashed border-slate-200 text-slate-500 hover:text-[var(--brand-red)] hover:border-red-300 hover:bg-red-50 gap-2 font-semibold transition-all rounded-xl"
                    >
                        <Plus size={16} />
                        Add Rule
                    </Button>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/80">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-slate-500 h-11 px-6">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="h-11 px-8 bg-[var(--brand-red)] hover:bg-red-800 text-white font-bold rounded-xl shadow-lg shadow-red-200 gap-2 transition-all">
                        <GitBranch size={16} />
                        Save Conditions
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
