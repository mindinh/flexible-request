import { useState, useMemo } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField, ConfirmDialog } from '@/components/studio';
import { getApproverLabel } from './conditionUtils';
import type { UiRule } from './types';

interface SimulationContentProps {
    rules: UiRule[];
}

export function SimulationContent({ rules }: SimulationContentProps) {
    const [mockData, setMockData] = useState({
        totalValue: '',
        region: '',
        department: '',
        '__request_priority': ''
    });

    // Simulate rule evaluation
    const simulatedResult = useMemo(() => {
        if (!mockData.totalValue && !mockData.region && !mockData.department && !mockData['__request_priority']) {
            return [];
        }

        const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
        const matchedRules: UiRule[] = [];

        for (const rule of sortedRules) {
            if (rule.conditions.length === 0) {
                matchedRules.push(rule);
                if (rule.isFinal) break;
                continue;
            }

            const allMatch = rule.conditions.every(c => {
                const dataValue = mockData[c.field as keyof typeof mockData] || '';

                // Numeric comparison for totalValue
                if (c.field === 'totalValue' && mockData.totalValue) {
                    const numData = parseFloat(mockData.totalValue);
                    const numRule = parseFloat(c.value);
                    if (isNaN(numData) || isNaN(numRule)) return false;

                    if (c.operator === 'gt') return numData > numRule;
                    if (c.operator === 'gte') return numData >= numRule;
                    if (c.operator === 'lt') return numData < numRule;
                    if (c.operator === 'lte') return numData <= numRule;
                    if (c.operator === 'eq') return numData === numRule;
                }

                if (c.operator === 'eq') return dataValue === c.value;
                if (c.operator === 'contains') return dataValue.includes(c.value);
                if (c.operator === 'not_equals') return dataValue !== c.value;

                return false;
            });

            if (allMatch) {
                matchedRules.push(rule);
                if (rule.isFinal) break;
            }
        }

        return matchedRules;
    }, [rules, mockData]);

    return (
        <div className="space-y-6">
            {/* Simulation Header */}
            <div className="flex items-center gap-2 text-slate-700">
                <FlaskConical size={18} className="text-primary" />
                <span className="text-sm font-medium">Test your approval rules</span>
            </div>

            {/* Input Fields */}
            <div className="space-y-4">
                <div>
                    <Label variant="section" className="mb-1.5 block">Total Value (VND)</Label>
                    <Input
                        type="number"
                        value={mockData.totalValue}
                        onChange={(e) => setMockData({ ...mockData, totalValue: e.target.value })}
                        placeholder="e.g., 500000000"
                    />
                </div>
                <div>
                    <Label variant="section" className="mb-1.5 block">Region</Label>
                    <Select
                        value={mockData.region}
                        onValueChange={(val) => setMockData({ ...mockData, region: val })}
                    >
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NORTH">North</SelectItem>
                            <SelectItem value="SOUTH">South</SelectItem>
                            <SelectItem value="CENTRAL">Central</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label variant="section" className="mb-1.5 block">Department</Label>
                    <Input
                        value={mockData.department}
                        onChange={(e) => setMockData({ ...mockData, department: e.target.value })}
                        placeholder="e.g., IT, Finance"
                    />
                </div>
                <div>
                    <Label variant="section" className="mb-1.5 block">Request Priority</Label>
                    <Select
                        value={mockData['__request_priority']}
                        onValueChange={(val) => setMockData({ ...mockData, '__request_priority': val })}
                    >
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results */}
            <Card className={`p-4 ${simulatedResult && simulatedResult.length > 0 ? "bg-green-50 border-green-200" : "bg-slate-100"}`}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Approval Chain</div>
                {simulatedResult && simulatedResult.length > 0 ? (
                    <div className="space-y-2">
                        {simulatedResult.map((rule, idx) => (
                            <div key={rule.id} className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-white border-green-200 text-green-700">
                                    {idx + 1}
                                </Badge>
                                <span className="text-sm font-medium text-green-800">
                                    {rule.assignToName || rule.assignTo || 'Not assigned'}
                                </span>
                                {rule.isFinal && (
                                    <Badge variant="default" className="bg-green-600 text-white text-xs">
                                        Final
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 italic">No rules match this input</div>
                )}
            </Card>
        </div>
    );
}
