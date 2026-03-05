import { useState, type ReactNode } from 'react';
import { FileEdit, Shield, Mail } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField } from '@/components/studio';

// ─── Tab definitions ─────────────────────────────────────────────────────
type TaskTab = 'fields' | 'approval' | 'email';

const TABS: { id: TaskTab; label: string; icon: React.ElementType }[] = [
    { id: 'fields', label: 'Fields', icon: FileEdit },
    { id: 'approval', label: 'Approval', icon: Shield },
    { id: 'email', label: 'Email', icon: Mail },
];

// ─── Approval Tab Content ────────────────────────────────────────────────
function ApprovalTabContent() {
    const { workflow, activeStepId, updateNodeData } = useStudioStore();
    const node = workflow.nodes.find(n => n.id === activeStepId);
    if (!node) return <EmptyState message="Select a task node to configure approval" />;

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4 space-y-4">
                <Label variant="section">Approval Configuration</Label>
                <FormField label="Approval Policy" hint="How approvals are collected">
                    <Select
                        value={(node.data.approvalPolicy as string) || 'any'}
                        onValueChange={(val) => updateNodeData(node.id, { approvalPolicy: val })}
                    >
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="any">Any One Approver</SelectItem>
                            <SelectItem value="all">All Must Approve</SelectItem>
                            <SelectItem value="sequential">Sequential Chain</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>

                <FormField label="Decision Options" hint="Available actions for the approver">
                    <div className="flex flex-wrap gap-2">
                        {['Approve', 'Reject', 'Send Back'].map((action) => {
                            const decisions = ((node.data.decisions as string[]) || ['Approve', 'Reject']);
                            const isEnabled = decisions.includes(action);
                            return (
                                <button
                                    key={action}
                                    onClick={() => {
                                        const newDecisions = isEnabled
                                            ? decisions.filter(d => d !== action)
                                            : [...decisions, action];
                                        updateNodeData(node.id, { decisions: newDecisions });
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${isEnabled
                                        ? action === 'Approve' ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                            : action === 'Reject' ? 'bg-red-50 border-red-300 text-red-700'
                                                : 'bg-amber-50 border-amber-300 text-amber-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-400'
                                        }`}
                                >
                                    {action}
                                </button>
                            );
                        })}
                    </div>
                </FormField>
            </Card>
        </div>
    );
}

// ─── Email Tab Content ───────────────────────────────────────────────────
function EmailTabContent() {
    const { workflow, activeStepId, updateNodeData } = useStudioStore();
    const node = workflow.nodes.find(n => n.id === activeStepId);
    if (!node) return <EmptyState message="Select a task node to configure email" />;

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4 space-y-4">
                <Label variant="section">Email Notification</Label>
                <FormField label="Recipients" hint="Who receives this email">
                    <Select
                        value={(node.data.emailRecipient as string) || 'requester'}
                        onValueChange={(val) => updateNodeData(node.id, { emailRecipient: val })}
                    >
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="requester">Requester</SelectItem>
                            <SelectItem value="step_owner">Step Owner</SelectItem>
                            <SelectItem value="coordinator">Coordinator</SelectItem>
                            <SelectItem value="custom">Custom (specify below)</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>

                <FormField label="Subject Template" hint="Use {{fieldName}} for dynamic values">
                    <Input
                        value={(node.data.emailSubject as string) || ''}
                        onChange={(e) => updateNodeData(node.id, { emailSubject: e.target.value })}
                        placeholder="Request {{displayId}} - Status Update"
                        className="border-0 focus-visible:ring-0"
                    />
                </FormField>

                <FormField label="Body Template" hint="Email body content with placeholders">
                    <textarea
                        value={(node.data.emailBody as string) || ''}
                        onChange={(e) => updateNodeData(node.id, { emailBody: e.target.value })}
                        placeholder={"Dear {{requesterName}},\n\nYour request {{displayId}} has been processed..."}
                        className="w-full min-h-[80px] rounded-lg border border-slate-200 bg-white p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
                    />
                </FormField>
            </Card>
        </div>
    );
}

// ─── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400 italic">
            {message}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Exported Component
// ═══════════════════════════════════════════════════════════════════════════
interface TaskEditorRightPanelProps {
    /** The existing FieldPropertiesContent rendered for the "Fields" tab */
    fieldPropertiesContent: ReactNode;
}

export function TaskEditorRightPanel({ fieldPropertiesContent }: TaskEditorRightPanelProps) {
    const [activeTab, setActiveTab] = useState<TaskTab>('fields');

    return (
        <div className="flex flex-col h-full">
            {/* Tab Bar */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-1 pt-1">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all
                                ${isActive
                                    ? 'bg-white text-[var(--brand-red)] border border-slate-200 border-b-white -mb-px shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }
                            `}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'fields' && fieldPropertiesContent}
                {activeTab === 'approval' && <ApprovalTabContent />}
                {activeTab === 'email' && <EmailTabContent />}
            </div>
        </div>
    );
}
