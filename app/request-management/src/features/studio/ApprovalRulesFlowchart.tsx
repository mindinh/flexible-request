import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { UiRule } from './types';
import { conditionsToText, getApproverLabel } from './conditionUtils';

interface ApprovalRulesFlowchartProps {
    rules: UiRule[];
    onClose: () => void;
}

export function ApprovalRulesFlowchart({ rules, onClose }: ApprovalRulesFlowchartProps) {
    // Sort rules by priority for display
    const sortedRules = useMemo(() =>
        [...rules].sort((a, b) => a.priority - b.priority),
        [rules]
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Decision Flowchart</h2>
                        <p className="text-sm text-slate-500">Visual representation of approval rules evaluation</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X size={20} />
                    </Button>
                </div>

                {/* Flowchart Content */}
                <div className="p-8 overflow-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                    {sortedRules.length === 0 ? (
                        <div className="text-center text-slate-400 py-12">
                            No rules to visualize. Add rules first.
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Start Node */}
                            <div className="flex flex-col items-center mb-4">
                                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-600 font-semibold shadow-sm">
                                    Start
                                </div>
                                <div className="w-0.5 h-6 bg-slate-300" />
                            </div>

                            {/* Rule Nodes */}
                            {sortedRules.map((rule, index) => (
                                <div key={rule.id} className="flex flex-col items-center">
                                    {/* Decision Diamond */}
                                    <div className="relative flex items-center justify-center mb-2">
                                        <div
                                            className="w-48 h-24 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 flex items-center justify-center text-center p-3 shadow-md"
                                            style={{
                                                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                                            }}
                                        >
                                            <span className="text-xs font-medium text-blue-800 leading-tight max-w-[120px]">
                                                {conditionsToText(rule.conditions)}
                                            </span>
                                        </div>

                                        {/* Priority Badge */}
                                        <Badge
                                            variant="outline"
                                            className="absolute -left-12 top-1/2 -translate-y-1/2 bg-white text-primary border-primary/30 font-bold"
                                        >
                                            P{rule.priority}
                                        </Badge>
                                    </div>

                                    {/* Branches */}
                                    <div className="flex items-start gap-16 mb-4">
                                        {/* Yes Branch - Goes to Approver */}
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Yes</span>
                                            </div>
                                            <div className="w-0.5 h-4 bg-green-300" />
                                            <div className="flex items-center gap-2">
                                                <ArrowRight size={14} className="text-green-500" />
                                            </div>
                                            <div className="w-0.5 h-4 bg-green-300" />

                                            {/* Approver Rectangle */}
                                            <div className={`
                                                px-6 py-3 rounded-lg border-2 shadow-md flex flex-col items-center gap-1
                                                ${rule.isFinal
                                                    ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-400'
                                                    : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300'
                                                }
                                            `}>
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {rule.assignToName || rule.assignTo || 'Not assigned'}
                                                </span>
                                                {rule.isFinal && (
                                                    <div className="flex items-center gap-1 text-xs text-green-600">
                                                        <CheckCircle size={12} />
                                                        <span>Final</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* End Node if Final */}
                                            {rule.isFinal && (
                                                <>
                                                    <div className="w-0.5 h-4 bg-green-300" />
                                                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                                                        End
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* No Branch - Continue to next rule */}
                                        {index < sortedRules.length - 1 && (
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">No</span>
                                                </div>
                                                <div className="w-0.5 h-4 bg-red-300" />
                                                <span className="text-xs text-slate-400">Continue →</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Connector to next rule (if not final and not last) */}
                                    {index < sortedRules.length - 1 && !rule.isFinal && (
                                        <div className="w-0.5 h-6 bg-slate-300 mb-2" />
                                    )}
                                </div>
                            ))}

                            {/* Legend */}
                            <div className="mt-8 pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-5 bg-blue-100 border border-blue-300" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
                                        <span>Condition</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-4 bg-slate-100 border border-slate-300 rounded" />
                                        <span>Approver</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-green-500 rounded-full" />
                                        <span>Final (End)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
