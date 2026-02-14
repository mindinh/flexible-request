import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PrincipalSelect, type Principal } from '@/components/shared/PrincipalSelect';
import type { UiRule, UiCondition, UiCanvasItem } from './types';
import type { FieldOption } from './conditionUtils';
import { getAvailableFields } from './conditionUtils';
import { useRuleConditions } from './useRuleConditions';
import { OPERATORS } from '@/config/constants';



interface RuleDetailsContentProps {
    ruleId: string;
    rules: UiRule[];
    schemas: Record<string, UiCanvasItem[]>;
    onUpdateRule: (updatedRule: UiRule) => void;
    onDeleteRule: (ruleId: string) => void;
}

export function RuleDetailsContent({ ruleId, rules, schemas, onUpdateRule, onDeleteRule }: RuleDetailsContentProps) {
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) {
        return (
            <div className="p-6 text-center text-slate-400">
                <p>Rule not found</p>
            </div>
        );
    }

    // Get available fields for this rule (based on its step)
    const getFieldsForRule = (): FieldOption[] => {
        if (rule.stepId && schemas[rule.stepId]) {
            return getAvailableFields(schemas[rule.stepId]);
        }
        return getAvailableFields([]);
    };

    const availableFields = getFieldsForRule();

    const { addCondition, updateCondition, removeCondition } = useRuleConditions(rule, onUpdateRule, availableFields);

    return (
        <div className="space-y-5">
            {/* Rule Name */}
            <div>
                <Label variant="section" className="mb-1.5 block">
                    Rule Name
                </Label>
                <Input
                    value={rule.name}
                    onChange={(e) => onUpdateRule({ ...rule, name: e.target.value })}
                    placeholder="Enter rule name"
                />
            </div>

            {/* Priority */}
            <div>
                <Label variant="section" className="mb-1.5 block">
                    Priority
                </Label>
                <Input
                    type="number"
                    value={rule.priority}
                    onChange={(e) => onUpdateRule({ ...rule, priority: parseInt(e.target.value) || 0 })}
                    min={1}
                />
                <p className="text-xs text-slate-400 mt-1">Lower priority = evaluated first</p>
            </div>

            {/* Conditions */}
            <div>
                <Label variant="section" className="mb-2 block">
                    Conditions
                </Label>

                {rule.conditions.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-2">
                        No conditions — this rule matches all requests (catch-all)
                    </div>
                ) : (
                    <div className="space-y-2 mb-2">
                        {rule.conditions.map((condition, idx) => (
                            <div key={condition.id} className="p-3 bg-white rounded-lg border border-slate-200">
                                {idx > 0 && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs mb-2">
                                        AND
                                    </Badge>
                                )}
                                <div className="flex flex-col gap-2">
                                    <Select
                                        value={condition.field}
                                        onValueChange={(val) => updateCondition(idx, 'field', val)}
                                    >
                                        <SelectTrigger className="h-9 w-full bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableFields.map(f => (
                                                <SelectItem
                                                    key={f.value}
                                                    value={f.value}
                                                    className={f.isSystemField ? 'bg-blue-50 border-b border-blue-100' : ''}
                                                >
                                                    <span className={f.isSystemField ? 'font-medium text-blue-700' : ''}>
                                                        {f.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={condition.operator}
                                        onValueChange={(val) => updateCondition(idx, 'operator', val)}
                                    >
                                        <SelectTrigger className="h-9 w-full bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {OPERATORS.map(op => (
                                                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={condition.value}
                                            onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                                            placeholder="Value"
                                            className="flex-1"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                                            onClick={() => removeCondition(idx)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Button variant="outline" size="sm" className="w-full" onClick={addCondition}>
                    <Plus size={14} /> Add Condition
                </Button>
            </div>

            {/* Assign To - PrincipalSelect */}
            <div>
                <Label variant="section" className="mb-2 block">
                    Assign To
                </Label>
                <PrincipalSelect
                    value={rule.assignTo && rule.assignType ? {
                        id: rule.assignTo,
                        type: rule.assignType.toUpperCase(),
                        displayName: rule.assignToName || rule.assignTo, // Use saved name or fallback to ID
                    } : null}
                    onChange={(principal) => {
                        if (principal) {
                            // No mapping needed - principal.type matches assignType (both uppercase)
                            onUpdateRule({
                                ...rule,
                                assignType: principal.type as typeof rule.assignType,
                                assignTo: principal.id,
                                assignToName: principal.displayName,
                            });
                        } else {
                            onUpdateRule({
                                ...rule,
                                assignType: 'USER',
                                assignTo: '',
                                assignToName: '',
                            });
                        }
                    }}
                    placeholder="Select approver..."
                />
                <p className="text-xs text-slate-400 mt-1.5">
                    Select a user or group to assign this approval
                </p>
            </div>

            {/* Final Approver Toggle */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div>
                    <Label>Final Approver</Label>
                    <p className="text-xs text-slate-400">Stop approval chain when this approver approves</p>
                </div>
                <Switch
                    checked={rule.isFinal ?? false}
                    onCheckedChange={(checked) => onUpdateRule({ ...rule, isFinal: checked })}
                />
            </div>

            {/* Delete Button */}
            <div className="mt-6 pt-4 border-t border-slate-100">
                <Button
                    variant="outline-destructive"
                    className="w-full"
                    onClick={() => onDeleteRule(rule.id)}
                >
                    <Trash2 size={16} /> Delete Rule
                </Button>
            </div>
        </div>
    );
}
