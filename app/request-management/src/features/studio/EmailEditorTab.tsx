import { useStudioStore } from './useStudioStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField } from '@/components/studio';
import { Mail } from 'lucide-react';
import type { EmailConfig } from './types';

/**
 * EmailEditorTab – Full-canvas email template editor.
 * Opened as a sub-tab of the Workflow tab when the user clicks
 * "Open Email Editor" from the Notifications card.
 *
 * Now binds directly into `node.data.emailConfig` (part of the
 * NotificationsContent contract) instead of storing loose fields
 * like `emailRecipient`, `emailSubject`, `emailBody` on the node.
 */
export function EmailEditorTab() {
    const { workflow, activeStepId, updateNodeData } = useStudioStore();
    const node = workflow.nodes.find(n => n.id === activeStepId);

    if (!node) {
        return (
            <div className="flex items-center justify-center h-full py-20 text-sm text-slate-400 italic">
                Select a task node first, then open the Email Editor.
            </div>
        );
    }

    // Read from the canonical emailConfig object; fall back to legacy loose fields
    const emailConfig: EmailConfig = (node.data.emailConfig as EmailConfig) ?? {
        recipientMode: (node.data.emailRecipient as string as EmailConfig['recipientMode']) || 'requester',
        customRecipients: (node.data.emailCustomRecipients as string) || '',
        subjectTemplate: (node.data.emailSubject as string) || '',
        bodyTemplate: (node.data.emailBody as string) || '',
    };

    /** Merge a partial update into the emailConfig stored on the node. */
    const updateEmailConfig = (patch: Partial<EmailConfig>) => {
        updateNodeData(node.id, {
            emailConfig: { ...emailConfig, ...patch },
        });
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                    <Mail size={20} className="text-rose-500" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Email Template</h2>
                    <p className="text-xs text-slate-400">
                        Configure the email notification for step "{(node.data.label as string) || 'Untitled'}"
                    </p>
                </div>
            </div>

            {/* Recipients */}
            <Card className="p-5 space-y-4">
                <Label variant="section">Recipients</Label>
                <FormField label="Send To" hint="Who receives this email notification">
                    <Select
                        value={emailConfig.recipientMode}
                        onValueChange={(val) => updateEmailConfig({ recipientMode: val as EmailConfig['recipientMode'] })}
                    >
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="requester">Requester</SelectItem>
                            <SelectItem value="step_owner">Step Owner</SelectItem>
                            <SelectItem value="coordinator">Coordinator</SelectItem>
                            <SelectItem value="approvers">All Approvers</SelectItem>
                            <SelectItem value="custom">Custom (specify below)</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>

                {emailConfig.recipientMode === 'custom' && (
                    <FormField label="Custom Recipients" hint="Comma-separated email addresses">
                        <Input
                            value={emailConfig.customRecipients || ''}
                            onChange={(e) => updateEmailConfig({ customRecipients: e.target.value })}
                            placeholder="user@example.com, team@example.com"
                            className="border-slate-200"
                        />
                    </FormField>
                )}
            </Card>

            {/* Subject */}
            <Card className="p-5 space-y-4">
                <Label variant="section">Subject</Label>
                <FormField label="Subject Template" hint="Use {{fieldName}} for dynamic values">
                    <Input
                        value={emailConfig.subjectTemplate || ''}
                        onChange={(e) => updateEmailConfig({ subjectTemplate: e.target.value })}
                        placeholder="Request {{displayId}} - Status Update"
                        className="border-slate-200 font-medium"
                    />
                </FormField>
            </Card>

            {/* Body */}
            <Card className="p-5 space-y-4">
                <Label variant="section">Body</Label>
                <FormField label="Body Template" hint="HTML or plain text with {{placeholder}} variables">
                    <textarea
                        value={emailConfig.bodyTemplate || ''}
                        onChange={(e) => updateEmailConfig({ bodyTemplate: e.target.value })}
                        placeholder={"Dear {{requesterName}},\n\nYour request {{displayId}} has been processed.\n\nRegards,\nThe Team"}
                        className="w-full min-h-[280px] rounded-lg border border-slate-200 bg-white p-4 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] leading-relaxed"
                    />
                </FormField>
            </Card>
        </div>
    );
}
