import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Trash2, Settings2 } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import type { UiFormAction } from './types';

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-2">
            {children}
        </span>
    );
}

export function FooterActionPropertiesContent() {
    const {
        forms,
        activeFormId,
        selectedFooterActionId,
        setSelectedFooterActionId,
        updateForms
    } = useStudioStore();

    const activeForm = forms.find(f => f.id === activeFormId);
    const action = activeForm?.footerActions?.find(a => a.id === selectedFooterActionId);

    if (!action || !activeForm) {
        return (
            <div className="p-6 text-center text-slate-400">
                <Settings2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Action not found</p>
            </div>
        );
    }

    const updateAction = (updates: Partial<UiFormAction>) => {
        const newActions = activeForm.footerActions?.map(a =>
            a.id === selectedFooterActionId ? { ...a, ...updates } : a
        );
        updateForms(forms.map(f => f.id === activeFormId ? { ...f, footerActions: newActions } : f));
    };

    const deleteAction = () => {
        const newActions = activeForm.footerActions?.filter(a => a.id !== selectedFooterActionId);
        updateForms(forms.map(f => f.id === activeFormId ? { ...f, footerActions: newActions } : f));
        setSelectedFooterActionId(null);
    };

    return (
        <div className="flex flex-col px-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <h4 className="font-semibold text-slate-800 text-sm">Button Properties</h4>
                </div>
            </div>

            <div className="space-y-4">
                {/* LABEL */}
                <div className="space-y-1.5">
                    <SectionLabel>Button Label</SectionLabel>
                    <Input
                        value={action.label}
                        onChange={(e) => updateAction({ label: e.target.value })}
                        placeholder="e.g. Approve, Reject..."
                    />
                </div>

                {/* VARIANT / COLOR */}
                <div className="space-y-1.5">
                    <SectionLabel>Button Style</SectionLabel>
                    <Select
                        value={action.variant || 'primary'}
                        onValueChange={(val) => updateAction({ variant: val as any })}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select style..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="primary">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Blue (Primary)
                                </span>
                            </SelectItem>
                            <SelectItem value="success">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    Green (Success)
                                </span>
                            </SelectItem>
                            <SelectItem value="danger">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    Red (Danger)
                                </span>
                            </SelectItem>
                            <SelectItem value="secondary">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    Amber (Secondary)
                                </span>
                            </SelectItem>
                            <SelectItem value="warning">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                                    Orange (Warning)
                                </span>
                            </SelectItem>
                            <SelectItem value="outline">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full border border-slate-300" />
                                    Outline
                                </span>
                            </SelectItem>
                            <SelectItem value="ghost">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-100" />
                                    Ghost
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Delete Button */}
            <div className="mt-8 pt-4 border-t border-slate-100">
                <Button
                    onClick={deleteAction}
                    variant="outline-destructive"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                >
                    <Trash2 size={14} className="mr-2" />
                    Delete Button
                </Button>
            </div>
        </div>
    );
}
