import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Users, Settings2, FlaskConical } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import type { UiRule, UiCondition } from './types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/label';
import { ApprovalRulesMatrix } from './ApprovalRulesMatrix';
import { ApprovalRulesFlowchart } from './ApprovalRulesFlowchart';


export function ApprovalRulesTab() {
    const { rules: storeRules, updateRules, workflow, activeStepId, schemas, selectedRuleId, setSelectedRuleId, isDryRunOpen, setIsDryRunOpen } = useStudioStore();
    const [rules, setRules] = useState<UiRule[]>(storeRules);
    const [showFlowchart, setShowFlowchart] = useState(false);

    useEffect(() => { setRules(storeRules); }, [storeRules]);

    // Filter rules by active step (from left panel selection)
    const filteredRules = useMemo(() =>
        activeStepId ? rules.filter(r => r.stepId === activeStepId) : rules,
        [rules, activeStepId]
    );

    const selectedRule = useMemo(() =>
        rules.find(r => r.id === selectedRuleId) || null,
        [rules, selectedRuleId]
    );

    const steps = workflow.nodes.filter(n => n.type === 'stepNode');


    // Rule management handlers
    const updateRule = (updatedRule: UiRule) => {
        const newRules = rules.map(r => r.id === updatedRule.id ? updatedRule : r);
        setRules(newRules);
        updateRules(newRules);
    };

    const deleteRule = (ruleId: string) => {
        const newRules = rules.filter(r => r.id !== ruleId);
        setRules(newRules);
        updateRules(newRules);
        if (selectedRuleId === ruleId) {
            setSelectedRuleId(null);
        }
    };

    const addRule = () => {
        // Require a step to be selected
        if (!activeStepId) return;

        // Calculate priority based only on this step's rules (not all rules)
        const stepRules = rules.filter(r => r.stepId === activeStepId);
        const maxPriority = stepRules.length > 0 ? Math.max(...stepRules.map(r => r.priority)) : 0;

        const newRule: UiRule = {
            id: `rule-${Date.now()}`,
            stepId: activeStepId,
            name: 'New Rule',
            priority: maxPriority + 10,
            conditions: [],
            assignTo: '',  // Empty - user must explicitly select an assignee
            assignToName: '',
            assignType: 'USER',  // Default to 'USER' type
            isFinal: false,
            expanded: false
        };
        const newRules = [...rules, newRule];
        setRules(newRules);
        updateRules(newRules);
        setSelectedRuleId(newRule.id); // Auto-select new rule
    };

    // Close details panel when switching to Dry Run
    const handleDryRunToggle = () => {
        if (!isDryRunOpen) {
            setSelectedRuleId(null);
        }
        setIsDryRunOpen(!isDryRunOpen);
    };

    // Close Dry Run when selecting a rule
    const handleRuleSelect = (ruleId: string | null) => {
        if (ruleId) {
            setIsDryRunOpen(false);
        }
        setSelectedRuleId(ruleId);
    };

    return (
        <div className="flex gap-6 h-full p-6">
            {/* Main Content */}
            <motion.div
                className="flex-1 space-y-4 overflow-y-auto"
                style={{ height: 'calc(100vh - 250px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-500">Rules are evaluated in priority order (lowest first).</p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowFlowchart(true)}
                            className="border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                            <GitBranch size={18} /> Visualize
                        </Button>
                        <Button
                            variant={isDryRunOpen ? "secondary" : "ghost"}
                            onClick={handleDryRunToggle}
                        >
                            <FlaskConical size={18} /> Dry Run
                        </Button>
                    </div>
                </div>

                {/* Matrix Table */}
                {rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                        <Users size={32} className="text-slate-300 mb-4" />
                        <h3 className="text-slate-600 font-medium mb-2">No Rules Defined</h3>
                        <p className="text-slate-400 text-sm mb-4">Add a rule to define dynamic approvers for your steps.</p>
                        <Button onClick={addRule}>Add Your First Rule</Button>
                    </div>
                ) : (
                    <ApprovalRulesMatrix
                        rules={filteredRules}
                        steps={steps}
                        selectedRuleId={selectedRuleId}
                        onSelectRule={handleRuleSelect}
                        onUpdateRule={updateRule}
                        onDeleteRule={deleteRule}
                        onAddRule={addRule}
                    />
                )}
            </motion.div>


            {/* Flowchart Modal */}
            <AnimatePresence>
                {showFlowchart && (
                    <ApprovalRulesFlowchart
                        rules={filteredRules}
                        onClose={() => setShowFlowchart(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
