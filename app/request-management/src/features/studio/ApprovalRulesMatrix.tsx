import { motion } from 'framer-motion';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/utils';
import type { UiRule, UiWorkflowNode } from './types';
import { conditionsToText, getApproverLabel } from './conditionUtils';

interface ApprovalRulesMatrixProps {
    rules: UiRule[];
    steps: UiWorkflowNode[];
    selectedRuleId: string | null;
    onSelectRule: (ruleId: string | null) => void;
    onUpdateRule: (updatedRule: UiRule) => void;
    onDeleteRule: (ruleId: string) => void;
    onAddRule: () => void;
}

export function ApprovalRulesMatrix({
    rules,
    steps,
    selectedRuleId,
    onSelectRule,
    onUpdateRule,
    onDeleteRule,
    onAddRule
}: ApprovalRulesMatrixProps) {
    // Sort rules by priority
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[60px_1.5fr_2.5fr_1.5fr_80px_60px] gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <div className="text-center">Priority</div>
                <div>Rule Name</div>
                <div>Condition</div>
                <div>Approver</div>
                <div className="text-center">Final</div>
                <div className="text-center">Delete</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
                {sortedRules.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400">
                        No approval rules defined. Click "Add Rule" to create one.
                    </div>
                ) : (
                    sortedRules.map((rule) => (
                        <motion.div
                            key={rule.id}
                            className={cn(
                                "grid grid-cols-[60px_1.5fr_2.5fr_1.5fr_80px_60px] gap-4 px-4 py-3 items-center cursor-pointer transition-colors",
                                selectedRuleId === rule.id
                                    ? "bg-primary/5 border-l-4 border-l-primary"
                                    : "hover:bg-slate-50"
                            )}
                            onClick={() => onSelectRule(selectedRuleId === rule.id ? null : rule.id)}
                            whileHover={{ scale: 1.001 }}
                        >
                            {/* Priority */}
                            <div className="flex items-center justify-center gap-1">
                                <GripVertical size={14} className="text-slate-300 cursor-grab" />
                                <Badge
                                    variant="outline"
                                    className="bg-primary/10 text-primary border-primary/20 font-bold text-sm min-w-[32px] justify-center"
                                >
                                    {rule.priority}
                                </Badge>
                            </div>

                            {/* Rule Name */}
                            <div className="text-sm text-slate-900 font-medium truncate min-w-0">
                                {rule.name || 'Unnamed Rule'}
                            </div>

                            {/* Condition Summary */}
                            <div className="text-sm text-slate-700 truncate min-w-0">
                                {conditionsToText(rule.conditions)}
                            </div>

                            {/* Approver */}
                            <div className="text-sm text-slate-600 truncate min-w-0">
                                {rule.assignToName || rule.assignTo || 'Not assigned'}
                            </div>

                            {/* Final Toggle */}
                            <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                <Switch
                                    checked={rule.isFinal ?? false}
                                    onCheckedChange={(checked) => onUpdateRule({ ...rule, isFinal: checked })}
                                />
                            </div>

                            {/* Delete */}
                            <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                    onClick={() => onDeleteRule(rule.id)}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Add Rule Button */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                <Button variant="outline" className="w-full border-dashed" onClick={onAddRule}>
                    <Plus size={16} /> Add Approval Rule
                </Button>
            </div>
        </div>
    );
}
