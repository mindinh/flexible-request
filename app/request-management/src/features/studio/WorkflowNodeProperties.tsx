import { useState, useMemo, useEffect, useCallback } from 'react';
import { Trash2, Play, Flag, FileEdit, Mail, Shield, Bell, MessageSquare, GitBranch, Layers, ExternalLink, Clock, Database, ClipboardCheck, X, Globe, Plus, Info, Search, Users, AlertCircle, FileText, ChevronDown, Calculator, Hash, Type, RotateCcw } from 'lucide-react';
import { useStudioStore } from './useStudioStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { FormField, ConfirmDialog } from '@/components/studio';
import { PrincipalSelect, type Principal } from '@/components/shared/PrincipalSelect';
import { OrgHierarchySelect } from '@/components/shared/OrgHierarchySelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Textarea } from '@/components/ui/TextArea';

import { MappingSelector } from './components/MappingSelector';
import { AdminService } from '../../services/AdminService';
import { ConditionEditorDialog, type ConditionLogic } from './components/ConditionEditorDialog';
import type { UiWorkflowNode, UiWorkflowEdge, UiFormField, UiSection, UiNodeOutput } from './types';
import { findAllAncestors } from './workflowIOHelpers';
import { AVAILABLE_ICONS, ICON_CATEGORIES, getAllIcons, type IconCategory } from '../../config/iconConfig';
import { cn } from '@/lib/utils';

// System-level output fields available on every Start Node
const SYSTEM_OUTPUT_FIELDS = [
    { id: '__request_uuid', label: 'Request UUID', type: 'system', category: 'Request Info' },
    { id: '__request_displayId', label: 'Request ID', type: 'system', category: 'Request Info' },
    { id: '__request_title', label: 'Request Title', type: 'system', category: 'Request Info' },
    { id: '__request_priority', label: 'Priority', type: 'system', category: 'Request Info' },
    { id: '__requester_name', label: 'Requester', type: 'system', category: 'Related Personnel' },
] as const;



// ─── Trigger Type Toggle ──────────────────────────────────────────────────
function TriggerTypeToggle({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const options = [
        { key: 'FORM_SUB', label: 'Form Submission', icon: FileEdit },
        { key: 'API_TRIGGER', label: 'API Trigger', icon: GitBranch },
    ];

    return (
        <div className="flex gap-2">
            {options.map((opt) => {
                const isActive = value === opt.key;
                return (
                    <button
                        key={opt.key}
                        onClick={() => onChange(opt.key)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all flex-1 cursor-pointer ${isActive
                            ? 'border-[var(--brand-red)] bg-[var(--brand-red)]/5 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                    >
                        <opt.icon
                            size={20}
                            className={isActive ? 'text-[var(--brand-red)]' : 'text-slate-400'}
                        />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'text-[var(--brand-red)]' : 'text-slate-400'
                            }`}>
                            {opt.label}
                        </span>
                        {isActive && (
                            <div className="w-4 h-4 rounded-full bg-[var(--brand-red)] flex items-center justify-center">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── SLA Input ────────────────────────────────────────────────────────────
function SlaInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-20 text-center border-0 focus-visible:ring-0"
            />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Days</span>
        </div>
    );
}

// ─── Predecessor Item ─────────────────────────────────────────────────────
function PredecessorItem({
    label,
    isSelected,
    onToggle,
}: {
    label: string;
    isSelected: boolean;
    onToggle: (selected: boolean) => void;
}) {
    return (
        <div
            onClick={(e) => {
                if ((e.target as HTMLElement).getAttribute('role') !== 'checkbox') {
                    onToggle(!isSelected);
                }
            }}
            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${isSelected
                ? 'bg-primary/10 border border-primary text-primary'
                : 'bg-slate-50 border border-transparent hover:border-slate-200 text-slate-700'
                }`}
        >
            <span className="text-sm font-medium truncate">{label}</span>
            <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onToggle(checked === true)}
            />
        </div>
    );
}

// ─── Node type icon + color mapping ───────────────────────────────────────
function getNodeTypeInfo(nodeType?: string, subType?: string) {
    switch (nodeType) {
        case 'startNode':
            return { icon: Play, color: 'var(--brand-red)', label: 'Start Node' };
        case 'endNode':
            return { icon: Flag, color: '#64748b', label: 'End Node' };
        case 'conditionNode':
            return { icon: GitBranch, color: '#7c3aed', label: 'Condition Node' };
        case 'actionNode':
            switch (subType) {
                case 'form':
                case 'user_task':
                case 'userTask':
                    return { icon: ClipboardCheck, color: 'var(--brand-red)', label: 'User Task' };
                case 'email':
                    return { icon: Mail, color: 'var(--brand-red)', label: 'Email Step' };
                case 'approval':
                    return { icon: Shield, color: 'var(--brand-red)', label: 'Approval Step' };
                case 'apiCall':
                case 'api_call':
                case 'background_task':
                    return { icon: Globe, color: '#0ea5e9', label: 'Background Task' };
                case 'formula':
                    return { icon: Calculator, color: 'var(--brand-red)', label: 'Background Task' };
                default:
                    return { icon: FileEdit, color: 'var(--brand-red)', label: 'Action Step' };
            }
        default:
            return { icon: FileEdit, color: '#64748b', label: 'Step' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Email Template Editor (Dialog)
// ═══════════════════════════════════════════════════════════════════════════
function EmailTemplateEditor({
    subject,
    body,
    onSave,
    availableSources,
}: {
    subject: string;
    body: string;
    onSave: (subject: string, body: string) => void;
    availableSources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [draftSubject, setDraftSubject] = useState(subject || '');
    const [draftBody, setDraftBody] = useState(body || '');
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const bodyRef = useState<HTMLTextAreaElement | null>(null);
    const subjectRef = useState<HTMLInputElement | null>(null);
    const [activeTarget, setActiveTarget] = useState<'subject' | 'body'>('body');
    const [viewMode, setViewMode] = useState<'html' | 'preview'>('html');

    const handleOpen = () => {
        setDraftSubject(subject || '');
        setDraftBody(body || '');
        setOpen(true);
    };

    const handleSave = () => {
        onSave(draftSubject, draftBody);
        setLastSaved(new Date().toLocaleTimeString());
        setOpen(false);
    };

    const insertVariable = (varName: string) => {
        const varStr = `{{${varName}}}`;
        if (activeTarget === 'body') {
            const textarea = bodyRef[0];
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const before = draftBody.slice(0, start);
                const after = draftBody.slice(end);
                setDraftBody(before + varStr + after);
                requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + varStr.length;
                    textarea.focus();
                });
            } else {
                setDraftBody(draftBody + varStr);
            }
        } else {
            const input = subjectRef[0];
            if (input) {
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const before = draftSubject.slice(0, start);
                const after = draftSubject.slice(end);
                setDraftSubject(before + varStr + after);
                requestAnimationFrame(() => {
                    input.selectionStart = input.selectionEnd = start + varStr.length;
                    input.focus();
                });
            } else {
                setDraftSubject(draftSubject + varStr);
            }
        }
    };

    // Group variables by category
    const categorizedVariables = useMemo(() => {
        const categories: Record<string, any> = {
            'Request Info': [],
            'Related Personnel': [],
            'Form Data': {} // Nested Record<stepName, fields[]>
        };

        // 1. Add system fields to their fixed categories
        SYSTEM_OUTPUT_FIELDS.forEach(sf => {
            if (Array.isArray(categories[sf.category])) {
                categories[sf.category].push({ id: sf.id, label: sf.label });
            }
        });

        // 2. Add form fields from available sources, grouped by their step name inside "Form Data"
        availableSources.forEach(s => {
            // Skip internal system fields (already handled)
            if (s.stepId === 'system') return;

            if (!s.fieldId.startsWith('__')) {
                const stepName = s.stepName || 'Unknown Step';
                if (!categories['Form Data'][stepName]) {
                    categories['Form Data'][stepName] = [];
                }
                categories['Form Data'][stepName].push({ id: s.fieldId, label: s.fieldName });
            }
        });

        return categories;
    }, [availableSources]);

    // Simple preview renderer - replaces {{var}} with [Var Label]
    const renderedPreview = useMemo(() => {
        let content = draftBody;
        let subj = draftSubject;

        // Replace system variables
        SYSTEM_OUTPUT_FIELDS.forEach(f => {
            const varStr = `System.${f.label.replace(/\s+/g, '')}`;
            const badge = `<span class="px-1.5 py-0.5 rounded bg-[var(--brand-red)]/10 text-[var(--brand-red)] font-bold border border-[var(--brand-red)]/20">@${f.label}</span>`;
            content = content.replaceAll(`{{${varStr}}}`, badge);
            subj = subj.replaceAll(`{{${varStr}}}`, badge);
        });
        // Replace form variables
        availableSources.forEach(s => {
            if (s.stepId === 'system' || s.fieldId.startsWith('__')) return;
            const stepName = s.stepName || 'Unknown Step';
            const varStr = `${stepName.replace(/\s+/g, '')}.${s.fieldName.replace(/\s+/g, '')}`;
            const badge = `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold border border-blue-200">#${s.fieldName}</span>`;
            content = content.replaceAll(`{{${varStr}}}`, badge);
            subj = subj.replaceAll(`{{${varStr}}}`, badge);
        });
        return { body: content, subject: subj };
    }, [draftBody, draftSubject, availableSources]);

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOpen}
                className="w-full gap-2 font-semibold h-9 border-[var(--brand-red)]/30 bg-[var(--brand-red)]/5 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 hover:text-[var(--brand-red)]"
            >
                <Mail size={14} />
                Edit Body Content
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[1100px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--brand-red)]/10 text-[var(--brand-red)]">
                                <Mail size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900">Email Template</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    Set up automatic email notifications
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="flex h-[600px]">
                        {/* Sidebar - Smaller width (1/4 instead of 1/3) */}
                        <div className="w-1/4 bg-slate-50/50 border-r border-slate-100 p-5 overflow-y-auto">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Available Data</h3>

                            <div className="space-y-6">
                                {Object.entries(categorizedVariables).map(([category, content]) => {
                                    // Special rendering for Form Data (nested)
                                    if (category === 'Form Data') {
                                        const stepGroups = content as Record<string, any[]>;
                                        if (Object.keys(stepGroups).length === 0) return null;
                                        return (
                                            <div key={category} className="space-y-4">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Layers size={12} />
                                                    <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                                </div>
                                                <div className="space-y-5 pl-2 border-l-2 border-slate-100 ml-1.5">
                                                    {Object.entries(stepGroups).map(([stepName, fields]) => (
                                                        <div key={stepName} className="space-y-2">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight px-1">{stepName}</div>
                                                            <div className="grid gap-1.5">
                                                                {fields.map(f => {
                                                                    const varStr = `${stepName.replace(/\s+/g, '')}.${f.label.replace(/\s+/g, '')}`;
                                                                    return (
                                                                        <button
                                                                            key={f.id}
                                                                            onClick={() => insertVariable(varStr)}
                                                                            title={`Click to insert {{${varStr}}}`}
                                                                            className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[var(--brand-red)] hover:shadow-sm transition-all text-left"
                                                                        >
                                                                            <span className="text-xs font-medium text-slate-700 group-hover:text-[var(--brand-red)] truncate">{f.label}</span>
                                                                            <Play size={8} className="text-slate-300 group-hover:text-[var(--brand-red)]" />
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Flat rendering for System Categories
                                    const fields = content as any[];
                                    return fields.length > 0 && (
                                        <div key={category} className="space-y-2">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                {category === 'Request Info' && <Database size={12} />}
                                                {category === 'Related Personnel' && <Shield size={12} />}
                                                <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                            </div>
                                            <div className="grid gap-1.5">
                                                {fields.map(f => {
                                                    const varStr = `System.${f.label.replace(/\s+/g, '')}`;
                                                    return (
                                                        <button
                                                            key={f.id}
                                                            onClick={() => insertVariable(varStr)}
                                                            title={`Click to insert {{${varStr}}}`}
                                                            className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[var(--brand-red)] hover:shadow-sm transition-all text-left"
                                                        >
                                                            <span className="text-xs font-medium text-slate-700 group-hover:text-[var(--brand-red)] truncate">{f.label}</span>
                                                            <Play size={8} className="text-slate-300 group-hover:text-[var(--brand-red)]" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-white flex flex-col">
                            {/* Subject Section - Compact */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Subject</Label>
                                </div>
                                <Input
                                    ref={(el) => { if (el) subjectRef[0] = el; }}
                                    value={draftSubject}
                                    onFocus={() => setActiveTarget('subject')}
                                    onChange={(e) => setDraftSubject(e.target.value)}
                                    className="h-10 px-4 text-slate-900 font-semibold bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] rounded-lg transition-all"
                                    placeholder="Enter subject..."
                                />
                            </div>

                            {/* Body Section */}
                            <div className="space-y-3 flex flex-col flex-1 min-h-0">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Body Content</Label>

                                    <div className="flex items-center gap-2">
                                        {/* View Switcher */}
                                        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 mr-2">
                                            <button
                                                onClick={() => setViewMode('html')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'html' ? 'bg-white shadow-sm text-[var(--brand-red)]' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                HTML
                                            </button>
                                            <button
                                                onClick={() => setViewMode('preview')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-[var(--brand-red)]' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                PREVIEW
                                            </button>
                                        </div>

                                        {/* Mini Toolbar */}
                                        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100/50 border border-slate-200">
                                            <button title="Bold" className="p-1 px-2 rounded hover:bg-white text-slate-400 hover:text-slate-900 transition-colors"><span className="text-[10px] font-bold">B</span></button>
                                            <button title="Italic" className="p-1 px-2 rounded hover:bg-white text-slate-400 hover:text-slate-900 transition-colors"><span className="text-[10px] font-italic">I</span></button>
                                            <div className="w-px h-3 bg-slate-200 mx-1" />
                                            <button title="Link" className="p-1 rounded hover:bg-white text-slate-400 hover:text-slate-900 transition-colors"><ExternalLink size={12} /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative flex-1 flex flex-col min-h-[350px] rounded-xl border border-slate-200 bg-slate-50/30 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-red)]/20 focus-within:border-[var(--brand-red)] transition-all">
                                    {viewMode === 'html' ? (
                                        <textarea
                                            ref={(el) => { if (el) bodyRef[0] = el; }}
                                            value={draftBody}
                                            onFocus={() => setActiveTarget('body')}
                                            onChange={(e) => setDraftBody(e.target.value)}
                                            className="w-full flex-1 p-5 bg-white border-none focus:outline-none resize-none text-slate-800 font-mono text-xs leading-relaxed"
                                            placeholder="Write your email body in HTML format..."
                                        />
                                    ) : (
                                        <div className="w-full flex-1 bg-white overflow-y-auto">
                                            {/* Preview Subject */}
                                            <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject Preview</div>
                                                <div className="text-sm font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: renderedPreview.subject || '<span class="text-slate-300 italic">No subject</span>' }} />
                                            </div>
                                            {/* Preview Body */}
                                            <div className="p-8">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-4">Body Preview</div>
                                                <div
                                                    className="prose prose-sm max-w-none text-slate-700"
                                                    dangerouslySetInnerHTML={{ __html: renderedPreview.body }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-6 text-slate-400">
                            <div className="flex items-center gap-2">
                                <Shield size={14} className="text-emerald-500" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">HTML Supported</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">
                                    {lastSaved ? `Saved at ${lastSaved}` : 'Not saved yet'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="font-bold text-slate-500 hover:text-slate-900 h-11 px-6 text-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="h-11 px-8 bg-[var(--brand-red)] hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-red-200 gap-2 transition-all text-sm"
                            >
                                <Mail size={16} />
                                Save Email Template
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export type FormulaItem = {
    id: string;
    resultName: string;
    expression: string;
};

// ─── Math Guide Helper ───────────────────────────────────────────────────
function MathGuide() {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="p-1 rounded-full hover:bg-slate-100 text-slate-400 transition-colors" title="View supported operators">
                    <Info size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-5 bg-white shadow-2xl border border-slate-200 rounded-2xl z-[9999]">
                <div className="space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Calculator size={16} className="text-[var(--brand-red)]" />
                            Formula Help
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1">Supported mathematical operators and syntax.</p>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-[var(--brand-red)] px-1.5 py-0.5 rounded bg-red-50">+ - * /</span>
                            <span className="text-slate-600 font-medium">Basic Math</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-[var(--brand-red)] px-1.5 py-0.5 rounded bg-red-50">**</span>
                            <span className="text-slate-600 font-medium">Power (e.g. 2**3 = 8)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-[var(--brand-red)] px-1.5 py-0.5 rounded bg-red-50">%</span>
                            <span className="text-slate-600 font-medium">Remainder (Modulo)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-[var(--brand-red)] px-1.5 py-0.5 rounded bg-red-50">( )</span>
                            <span className="text-slate-600 font-medium">Grouping</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                            <strong className="block mb-1">💡 Variables</strong>
                            Always wrap field IDs in double curly braces: <code className="bg-white px-1.5 py-0.5 rounded shadow-sm text-blue-700 font-bold font-mono">{"{{Step.Field}}"}</code>
                        </p>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Formula Editor (Dialog)
// ═══════════════════════════════════════════════════════════════════════════
function FormulaEditor({
    formulas,
    onSave,
    availableSources,
}: {
    formulas: FormulaItem[];
    onSave: (formulas: FormulaItem[]) => void;
    availableSources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string; type?: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [draftFormulas, setDraftFormulas] = useState<FormulaItem[]>([]);
    const [activeTarget, setActiveTarget] = useState<{ id: string, field: 'resultName' | 'expression' } | null>(null);
    const [testingIds, setTestingIds] = useState<string[]>([]);
    const [testValues, setTestValues] = useState<Record<string, string>>({});

    const expressionToNames = useCallback((expr: string) => {
        let res = expr;
        // Also map SYSTEM_OUTPUT_FIELDS if they use f.id to f.label
        availableSources.forEach(s => {
            const idRegex = new RegExp(`\\{\\{${s.fieldId}\\}\\}`, 'g');
            const friendlyName = s.stepId === 'system'
                ? `System.${s.fieldName.replace(/\s+/g, '')}`
                : `${s.stepName.replace(/\s+/g, '')}.${s.fieldName.replace(/\s+/g, '')}`;
            res = res.replace(idRegex, `{{${friendlyName}}}`);
        });
        return res;
    }, [availableSources]);

    const expressionToIds = useCallback((expr: string) => {
        let res = expr;
        availableSources.forEach(s => {
            const friendlyName = s.stepId === 'system'
                ? `System.${s.fieldName.replace(/\s+/g, '')}`
                : `${s.stepName.replace(/\s+/g, '')}.${s.fieldName.replace(/\s+/g, '')}`;
            const escapedName = friendlyName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
            const nameRegex = new RegExp(`\\{\\{${escapedName}\\}\\}`, 'g');
            res = res.replace(nameRegex, `{{${s.fieldId}}}`);
        });
        return res;
    }, [availableSources]);

    // Update draft state when props change or modal opens
    useEffect(() => {
        if (open) {
            if (formulas && formulas.length > 0) {
                setDraftFormulas(formulas.map(f => ({ ...f, expression: expressionToNames(f.expression) })));
                setActiveTarget({ id: formulas[0].id, field: 'expression' });
            } else {
                const newId = crypto.randomUUID();
                setDraftFormulas([{ id: newId, resultName: '', expression: '' }]);
                setActiveTarget({ id: newId, field: 'expression' });
            }
        }
    }, [open, formulas, expressionToNames]);

    const handleOpen = () => setOpen(true);

    const handleSave = () => {
        const validFormulas = draftFormulas.filter(f => f.resultName.trim() !== '' || f.expression.trim() !== '');
        onSave(validFormulas.map(f => ({ ...f, expression: expressionToIds(f.expression) })));
        setOpen(false);
    };

    const addFormula = () => {
        const newId = crypto.randomUUID();
        setDraftFormulas([...draftFormulas, { id: newId, resultName: '', expression: '' }]);
        setActiveTarget({ id: newId, field: 'resultName' });
    };

    const removeFormula = (id: string) => {
        setDraftFormulas(draftFormulas.filter(f => f.id !== id));
    };

    const updateFormula = (id: string, field: 'resultName' | 'expression', value: string) => {
        setDraftFormulas(draftFormulas.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const insertVariable = (varName: string) => {
        if (!activeTarget) return;
        const varStr = `{{${varName}}}`;
        const elmId = `${activeTarget.field}-${activeTarget.id}`;
        const el = document.getElementById(elmId) as HTMLInputElement | HTMLTextAreaElement | null;

        if (el) {
            const start = el.selectionStart || 0;
            const end = el.selectionEnd || 0;
            setDraftFormulas(prev => prev.map(f => {
                if (f.id === activeTarget.id) {
                    const currentVal = f[activeTarget.field];
                    const before = currentVal.slice(0, start);
                    const after = currentVal.slice(end);
                    return { ...f, [activeTarget.field]: before + varStr + after };
                }
                return f;
            }));
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + varStr.length;
                el.focus();
            });
        } else {
            setDraftFormulas(prev => prev.map(f => {
                if (f.id === activeTarget.id) {
                    return { ...f, [activeTarget.field]: f[activeTarget.field] + varStr };
                }
                return f;
            }));
        }
    };



    const getVariablesForExpression = useCallback((expr: string) => {
        const vars = new Set<string>();
        const matches = expr.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
            matches.forEach(m => vars.add(m.replace(/\{\{|\}\}/g, '').trim()));
        }
        return Array.from(vars).sort();
    }, []);

    const evaluate = useCallback((expr: string) => {
        if (!expr || expr.trim() === '') return null;
        try {
            // 1. Replace variables with test values
            let replaced = expr.replace(/\{\{([^}]+)\}\}/g, (_, name) => {
                const val = testValues[name.trim()] || '0';
                return val;
            });

            // 2. Sanitize (allow only math)
            const sanitized = replaced.replace(/[^-0-9. +*/%()]/g, '');
            if (!sanitized.trim()) return null;

            // 3. Eval
            // eslint-disable-next-line no-new-func
            const res = new Function(`return (${sanitized})`)();
            const num = Number(res);
            return isNaN(num) ? 'Error' : num.toLocaleString();
        } catch (e) {
            return 'Error';
        }
    }, [testValues]);

    // Group variables by category
    const categorizedVariables = useMemo(() => {
        const categories: Record<string, any> = {
            'Request Info': [],
            'Related Personnel': [],
            'Form Data': {}
        };

        SYSTEM_OUTPUT_FIELDS.forEach(sf => {
            if (Array.isArray(categories[sf.category])) {
                categories[sf.category].push({ id: sf.id, label: sf.label, type: sf.type });
            }
        });

        availableSources.forEach(s => {
            if (s.stepId === 'system') return;
            if (!s.fieldId.startsWith('__')) {
                const stepName = s.stepName || 'Unknown Step';
                if (!categories['Form Data'][stepName]) {
                    categories['Form Data'][stepName] = [];
                }
                categories['Form Data'][stepName].push({ id: s.fieldId, label: s.fieldName, type: s.type });
            }
        });

        return categories;
    }, [availableSources]);

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOpen}
                className="w-full gap-2 font-semibold h-9 border-[var(--brand-red)]/20 bg-[var(--brand-red)]/5 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 hover:text-[var(--brand-red)]"
            >
                <Calculator size={14} />
                Edit Formula Configuration
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[1100px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--brand-red)]/10 text-[var(--brand-red)]">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900">Formula Editor</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    Use the variable picker on the left to insert dynamic data into your formula.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="flex h-[600px]">
                        {/* Sidebar - Smaller width (1/4 instead of 1/3) */}
                        <div className="w-1/4 bg-slate-50/50 border-r border-slate-100 p-5 overflow-y-auto">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Available Data</h3>

                            <div className="space-y-6">
                                {Object.entries(categorizedVariables).map(([category, content]) => {
                                    // Special rendering for Form Data (nested)
                                    if (category === 'Form Data') {
                                        const stepGroups = content as Record<string, any[]>;
                                        if (Object.keys(stepGroups).length === 0) return null;
                                        return (
                                            <div key={category} className="space-y-4">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Layers size={12} />
                                                    <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                                </div>
                                                <div className="space-y-5 pl-2 border-l-2 border-slate-100 ml-1.5">
                                                    {Object.entries(stepGroups).map(([stepName, fields]) => (
                                                        <div key={stepName} className="space-y-2">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight px-1">{stepName}</div>
                                                            <div className="grid gap-1.5">
                                                                {fields.map(f => {
                                                                    const varStr = `${stepName.replace(/\s+/g, '')}.${f.label.replace(/\s+/g, '')}`;
                                                                    const isNumber = f.type === 'number';
                                                                    return (
                                                                        <button
                                                                            key={f.id}
                                                                            onClick={() => insertVariable(varStr)}
                                                                            title={`Click to insert {{${varStr}}}`}
                                                                            className="group flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-[var(--brand-red)] hover:shadow-sm transition-all text-left gap-2"
                                                                        >
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <div className={`flex flex-shrink-0 items-center justify-center w-5 h-5 rounded ${isNumber ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'}`}>
                                                                                    {isNumber ? <Hash size={12} /> : <Type size={12} />}
                                                                                </div>
                                                                                <span className="text-xs font-medium text-slate-700 group-hover:text-[var(--brand-red)] truncate">{f.label}</span>
                                                                            </div>
                                                                            <Plus size={12} className="text-slate-300 group-hover:text-[var(--brand-red)] flex-shrink-0" />
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Flat rendering for System Categories
                                    const fields = content as any[];
                                    return fields.length > 0 && (
                                        <div key={category} className="space-y-2">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                {category === 'Request Info' && <Database size={12} />}
                                                {category === 'Related Personnel' && <Shield size={12} />}
                                                <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                            </div>
                                            <div className="grid gap-1.5">
                                                {fields.map(f => {
                                                    const varStr = `System.${f.label.replace(/\s+/g, '')}`;
                                                    const isNumber = f.type === 'number';
                                                    return (
                                                        <button
                                                            key={f.id}
                                                            onClick={() => insertVariable(varStr)}
                                                            title={`Click to insert {{${varStr}}}`}
                                                            className="group flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-[var(--brand-red)] hover:shadow-sm transition-all text-left gap-2"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`flex flex-shrink-0 items-center justify-center w-5 h-5 rounded ${isNumber ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'}`}>
                                                                    {isNumber ? <Hash size={12} /> : <Type size={12} />}
                                                                </div>
                                                                <span className="text-xs font-medium text-slate-700 group-hover:text-[var(--brand-red)] truncate">{f.label}</span>
                                                            </div>
                                                            <Plus size={12} className="text-slate-300 group-hover:text-[var(--brand-red)] flex-shrink-0" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-white flex flex-col p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900">Calculations</h3>
                                <Button onClick={addFormula} variant="outline" size="sm" className="h-8 gap-1 border-[var(--brand-red)]/20 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/5">
                                    <Plus size={14} /> Add Calculation
                                </Button>
                            </div>



                            <div className="space-y-6">
                                {draftFormulas.map((formula, index) => {
                                    const isTesting = testingIds.includes(formula.id);
                                    const formulaVars = getVariablesForExpression(formula.expression);

                                    return (
                                        <div key={formula.id} className={`p-5 rounded-xl border relative transition-all ${activeTarget?.id === formula.id ? 'border-[var(--brand-red)]/50 shadow-sm bg-[var(--brand-red)]/5' : 'border-slate-200 bg-white'}`}>

                                            {/* Header Row for each Formula */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-500 font-bold text-[10px]">
                                                        {index + 1}
                                                    </div>
                                                    <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Calculation #{index + 1}</Label>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant={isTesting ? 'secondary' : 'ghost'}
                                                        onClick={() => setTestingIds(prev => isTesting ? prev.filter(id => id !== formula.id) : [...prev, formula.id])}
                                                        className={`h-7 gap-1.5 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider ${isTesting ? 'bg-[var(--brand-red)] text-white hover:opacity-90 border-transparent shadow-sm' : 'text-slate-400 hover:text-[var(--brand-red)] hover:bg-[var(--brand-red)]/5'}`}
                                                    >
                                                        <Play size={10} className={isTesting ? 'fill-current' : ''} />
                                                        {isTesting ? 'Stop Test' : 'Test'}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeFormula(formula.id)}
                                                        className="h-7 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                {/* Testing UI (if enabled) */}
                                                {isTesting && (
                                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mt-2 mb-6 space-y-4 shadow-inner">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 px-2 rounded bg-[var(--brand-red)]/10 text-[var(--brand-red)] text-[10px] font-bold uppercase">Test Mode</div>
                                                                <span className="text-[11px] text-slate-500 font-medium">Enter values for variables used in this formula</span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setTestValues({})}
                                                                className="h-6 text-[10px] text-slate-400 hover:text-[var(--brand-red)] hover:bg-[var(--brand-red)]/5 uppercase font-bold gap-1"
                                                            >
                                                                <RotateCcw size={10} /> Reset All
                                                            </Button>
                                                        </div>

                                                        {formulaVars.length > 0 ? (
                                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {formulaVars.map(v => (
                                                                    <div key={v} className="space-y-1">
                                                                        <Label className="text-[10px] text-slate-500 font-bold truncate block px-1" title={v}>{v}</Label>
                                                                        <Input
                                                                            type="number"
                                                                            id={`test-${formula.id}-${v}`}
                                                                            value={testValues[v] || ''}
                                                                            onChange={(e) => setTestValues({ ...testValues, [v]: e.target.value })}
                                                                            className="h-8 text-xs bg-white border-slate-200 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-400 italic text-center py-1">No variables detected in this expression.</div>
                                                        )}

                                                        <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calculation Result</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono font-bold text-[var(--brand-red)] text-lg">
                                                                    {evaluate(formula.expression) ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-2">
                                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Result Name</Label>
                                                    <Input
                                                        id={`resultName-${formula.id}`}
                                                        value={formula.resultName}
                                                        onFocus={() => setActiveTarget({ id: formula.id, field: 'resultName' })}
                                                        onChange={(e) => updateFormula(formula.id, 'resultName', e.target.value)}
                                                        className="h-10 px-4 text-slate-900 font-semibold bg-white border-slate-200 focus:bg-white focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] rounded-lg transition-all"
                                                        placeholder="e.g. TotalAmount"
                                                    />
                                                </div>

                                                {/* Expression Section */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expression</Label>
                                                            <MathGuide />
                                                        </div>
                                                        <span className="text-[10px] uppercase text-slate-400 font-medium">Math logic</span>
                                                    </div>

                                                    <div className="relative flex flex-col min-h-[140px] rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand-red)]/20 focus-within:border-[var(--brand-red)] transition-all">
                                                        <textarea
                                                            id={`expression-${formula.id}`}
                                                            value={formula.expression}
                                                            onFocus={() => setActiveTarget({ id: formula.id, field: 'expression' })}
                                                            onChange={(e) => updateFormula(formula.id, 'expression', e.target.value)}
                                                            className="w-full flex-1 p-4 bg-white border-none focus:outline-none resize-y min-h-[140px] text-slate-800 font-mono text-xs leading-relaxed"
                                                            placeholder="{{Start.Amount}} * 2"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {draftFormulas.length === 0 && (
                                    <div className="p-10 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                                        <Calculator size={32} className="text-slate-300 mb-3" />
                                        <p className="text-sm font-semibold text-slate-600">No calculations defined</p>
                                        <p className="text-xs text-slate-400 mb-4 mt-1">Add a calculation to map dynamic formulas to output variables.</p>
                                        <Button onClick={addFormula} variant="outline" size="sm" className="h-9 gap-2">
                                            <Plus size={14} /> Add First Calculation
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="font-bold text-slate-500 hover:text-slate-900 h-11 px-6 text-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="h-11 px-8 bg-[var(--brand-red)] hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-red-200 gap-2 transition-all text-sm"
                            >
                                <Calculator size={16} />
                                Save Formula
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Icon Picker ────────────────────────────────────────────────────────────
function IconPicker({
    value,
    onChange
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<IconCategory | 'all'>('all');
    const [isOpen, setIsOpen] = useState(false);

    const filteredIcons = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return getAllIcons().filter(icon => {
            const matchesCategory = activeCategory === 'all' || icon.category === activeCategory;
            const matchesSearch = !query ||
                icon.label.toLowerCase().includes(query) ||
                icon.id.toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [searchQuery, activeCategory]);

    const activeIcon = useMemo(() => AVAILABLE_ICONS[value] || AVAILABLE_ICONS['workflow'], [value]);
    const ActiveIconComponent = activeIcon.icon;

    return (
        <>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button className="w-full h-11 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl flex items-center justify-between group hover:border-slate-200 transition-all focus:outline-none focus:border-[var(--brand-red)] focus:bg-white overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                activeIcon.bgColor
                            )}>
                                <ActiveIconComponent size={18} className={activeIcon.color} />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 truncate">{activeIcon.label}</span>
                        </div>
                        <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[420px] p-0 border-none shadow-2xl rounded-3xl overflow-hidden mt-2">
                    <div className="flex flex-col gap-4 p-5 bg-white">
                        {/* Search Bar */}
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--brand-red)] transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search icons..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-11 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-[var(--brand-red)] focus:bg-white transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Categories */}
                        <div
                            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 pointer-events-auto"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setActiveCategory('all')}
                                className={cn(
                                    "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                                    activeCategory === 'all'
                                        ? "bg-[var(--brand-red)] text-white shadow-lg shadow-red-100"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                )}
                            >
                                All
                            </button>
                            {Object.entries(ICON_CATEGORIES).map(([id, cfg]) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveCategory(id as IconCategory)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                                        activeCategory === id
                                            ? "bg-[var(--brand-red)] text-white shadow-lg shadow-red-100"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    )}
                                >
                                    {cfg.label}
                                </button>
                            ))}
                        </div>

                        {/* Icon Grid */}
                        <div
                            className="grid grid-cols-7 gap-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar p-1 pointer-events-auto"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {filteredIcons.map((icon) => {
                                const Icon = icon.icon;
                                const isSelected = value === icon.id;
                                return (
                                    <button
                                        key={icon.id}
                                        onClick={() => {
                                            onChange(icon.id);
                                            setIsOpen(false);
                                        }}
                                        title={icon.label}
                                        className={cn(
                                            "group relative aspect-square rounded-2xl flex items-center justify-center transition-all",
                                            isSelected
                                                ? "bg-white ring-4 ring-offset-2 ring-[var(--brand-red)] shadow-2xl z-10 scale-95"
                                                : "bg-slate-50 hover:bg-white hover:ring-2 hover:ring-slate-200 hover:scale-110 active:scale-90"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 flex items-center justify-center rounded-xl transition-colors shrink-0",
                                            isSelected ? "bg-red-50" : icon.bgColor
                                        )}>
                                            <Icon
                                                size={20}
                                                className={cn(
                                                    "transition-all stroke-[2.5]",
                                                    isSelected ? "text-[var(--brand-red)]" : icon.color
                                                )}
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between px-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{filteredIcons.length} icons</span>
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover >
            <style dangerouslySetInnerHTML={{
                __html: `
            .custom-scrollbar::-webkit-scrollbar {
                width: 5px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
            .scrollbar-hide::-webkit-scrollbar {
                display: none;
            }
            .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
        `}} />
        </>
    );
}

// Bell Notification Editor (Dialog)
// ═══════════════════════════════════════════════════════════════════════════
function BellNotificationEditor({
    title,
    body,
    type,
    priority,
    role,
    onSave,
    availableSources,
}: {
    title: string;
    body: string;
    type: string;
    priority: string;
    role: string;
    onSave: (title: string, body: string, type: string, priority: string, role: string) => void;
    availableSources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string }>;
}) {
    const [open, setOpen] = useState(false);
    const [draftTitle, setDraftTitle] = useState(title || '');
    const [draftBody, setDraftBody] = useState(body || '');
    const [draftType, setDraftType] = useState(type || 'DATA_INPUT');
    const [draftPriority, setDraftPriority] = useState(priority || '');
    const [draftRole, setDraftRole] = useState(role || '');
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const bodyRef = useState<HTMLTextAreaElement | null>(null);
    const titleRef = useState<HTMLInputElement | null>(null);
    const priorityRef = useState<HTMLInputElement | null>(null);
    const roleRef = useState<HTMLInputElement | null>(null);
    const [activeTarget, setActiveTarget] = useState<'title' | 'body' | 'priority'>('body');
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

    const handleOpen = () => {
        setDraftTitle(title || '');
        setDraftBody(body || '');
        setDraftType(type || 'DATA_INPUT');
        setDraftPriority(priority || '');
        setDraftRole(role || '');
        setOpen(true);
    };

    const handleSave = () => {
        onSave(draftTitle, draftBody, draftType, draftPriority, draftRole);
        setLastSaved(new Date().toLocaleTimeString());
        setOpen(false);
    };

    const insertVariable = (varName: string) => {
        const varStr = `{{${varName}}}`;
        if (activeTarget === 'body') {
            const textarea = bodyRef[0];
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                setDraftBody(draftBody.slice(0, start) + varStr + draftBody.slice(end));
                requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + varStr.length;
                    textarea.focus();
                });
            } else {
                setDraftBody(draftBody + varStr);
            }
        } else if (activeTarget === 'title') {
            const input = titleRef[0];
            if (input) {
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                setDraftTitle(draftTitle.slice(0, start) + varStr + draftTitle.slice(end));
                requestAnimationFrame(() => {
                    input.selectionStart = input.selectionEnd = start + varStr.length;
                    input.focus();
                });
            } else {
                setDraftTitle(draftTitle + varStr);
            }
        } else if (activeTarget === 'priority') {
            const input = priorityRef[0];
            if (input) {
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                setDraftPriority(draftPriority.slice(0, start) + varStr + draftPriority.slice(end));
                requestAnimationFrame(() => {
                    input.selectionStart = input.selectionEnd = start + varStr.length;
                    input.focus();
                });
            } else {
                setDraftPriority(draftPriority + varStr);
            }
        }
    };

    const categorizedVariables = useMemo(() => {
        const categories: Record<string, any> = { 'Request Info': [], 'Related Personnel': [], 'Form Data': {} };
        SYSTEM_OUTPUT_FIELDS.forEach(sf => {
            if (Array.isArray(categories[sf.category])) categories[sf.category].push({ id: sf.id, label: sf.label });
        });
        availableSources.forEach(s => {
            if (s.stepId === 'system' || s.fieldId.startsWith('__')) return;
            const stepName = s.stepName || 'Unknown Step';
            if (!categories['Form Data'][stepName]) categories['Form Data'][stepName] = [];
            categories['Form Data'][stepName].push({ id: s.fieldId, label: s.fieldName });
        });
        return categories;
    }, [availableSources]);

    const renderedPreview = useMemo(() => {
        let content = draftBody;
        let t = draftTitle;
        let p = draftPriority;
        let r = draftRole;

        SYSTEM_OUTPUT_FIELDS.forEach(f => {
            const varStr = `System.${f.label.replace(/\s+/g, '')}`;
            const badge = `<span class="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-100 italic">@${f.label}</span>`;
            content = content.replaceAll(`{{${varStr}}}`, badge);
            t = t.replaceAll(`{{${varStr}}}`, badge);
            p = p.replaceAll(`{{${varStr}}}`, badge);
            r = r.replaceAll(`{{${varStr}}}`, badge);
        });
        availableSources.forEach(s => {
            if (s.stepId === 'system' || s.fieldId.startsWith('__')) return;
            const stepName = s.stepName || 'Unknown Step';
            const varStr = `${stepName.replace(/\s+/g, '')}.${s.fieldName.replace(/\s+/g, '')}`;
            const badge = `<span class="px-1.5 py-0.5 rounded bg-red-50 text-[var(--brand-red)] font-bold border border-red-100 italic">#${s.fieldName}</span>`;
            content = content.replaceAll(`{{${varStr}}}`, badge);
            t = t.replaceAll(`{{${varStr}}}`, badge);
            p = p.replaceAll(`{{${varStr}}}`, badge);
            r = r.replaceAll(`{{${varStr}}}`, badge);
        });
        return { body: content, title: t, priority: p, role: r };
    }, [draftBody, draftTitle, draftPriority, draftRole, availableSources]);

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOpen}
                className="w-full gap-2 font-semibold h-9 border-red-200 bg-red-50/50 text-[var(--brand-red)] hover:bg-red-100 hover:text-[var(--brand-red)] mt-2"
            >
                <Bell size={14} />
                Edit Bell Content
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[1100px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-[var(--brand-red)]">
                                <Bell size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900">Bell Notification Content</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500">
                                    Customize the in-app notification message
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="flex h-[600px]">
                        {/* Sidebar */}
                        <div className="w-1/4 bg-slate-50/50 border-r border-slate-100 p-5 overflow-y-auto custom-scrollbar">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Available Data</h3>
                            <div className="space-y-6">
                                {Object.entries(categorizedVariables).map(([category, items]) => {
                                    if (category === 'Form Data') {
                                        return Object.entries(items as Record<string, any[]>).map(([stepName, fields]) => (
                                            <div key={stepName} className="space-y-2">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Layers size={12} />
                                                    <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                                </div>
                                                <div className="space-y-5 pl-2 border-l-2 border-slate-100 ml-1.5">
                                                    <div key={stepName} className="space-y-2">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight px-1">{stepName}</div>
                                                        <div className="grid gap-1.5">
                                                            {fields.map(f => {
                                                                const varStr = `${stepName.replace(/\s+/g, '')}.${f.label.replace(/\s+/g, '')}`;
                                                                return (
                                                                    <button key={f.id} onClick={() => insertVariable(varStr)} title={`Click to insert {{${varStr}}}`} className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[var(--brand-red)] hover:shadow-sm transition-all text-left">
                                                                        <span className="text-xs font-medium text-slate-700 group-hover:text-[var(--brand-red)] truncate">{f.label}</span>
                                                                        <Play size={8} className="text-slate-300 group-hover:text-[var(--brand-red)]" />
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    }
                                    return (
                                        <div key={category} className="space-y-2">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                {category === 'Request Info' && <Database size={12} />}
                                                {category === 'Related Personnel' && <Shield size={12} />}
                                                <span className="text-[11px] font-bold uppercase text-slate-500">{category}</span>
                                            </div>
                                            <div className="grid gap-1.5">
                                                {(items as any[]).map(f => {
                                                    const varStr = `System.${f.label.replace(/\s+/g, '')}`;
                                                    return (
                                                        <button key={f.id} onClick={() => insertVariable(varStr)} title={`Click to insert {{${varStr}}}`} className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[var(--brand-red)] hover:shadow-sm transition-all text-left">
                                                            <span className="text-xs font-medium text-slate-700 group-hover:text-[var(--brand-red)] truncate">{f.label}</span>
                                                            <Play size={8} className="text-slate-300 group-hover:text-[var(--brand-red)]" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-white flex flex-col custom-scrollbar">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configure Appearance</Label>
                                <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                                    <button
                                        onClick={() => setViewMode('edit')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'edit' ? 'bg-white shadow-sm text-[var(--brand-red)]' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        EDIT
                                    </button>
                                    <button
                                        onClick={() => setViewMode('preview')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-[var(--brand-red)]' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        PREVIEW
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'edit' ? (
                                <>
                                    <div className="grid grid-cols-3 gap-6 items-start">
                                        <FormField label="Notification Icon" hint="Visual identifier">
                                            <IconPicker value={draftType} onChange={setDraftType} />
                                        </FormField>

                                        <FormField label="Priority" hint="Badge level">
                                            <div className="relative group/field">
                                                <Input
                                                    ref={(el) => { if (el) priorityRef[0] = el; }}
                                                    value={draftPriority}
                                                    onFocus={() => setActiveTarget('priority')}
                                                    onChange={(e) => setDraftPriority(e.target.value)}
                                                    className="h-11 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-[var(--brand-red)] transition-all font-semibold pr-10"
                                                    placeholder="Priority (template or static)"
                                                />
                                                {draftPriority && (
                                                    <button
                                                        onClick={() => setDraftPriority('')}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-[var(--brand-red)] hover:bg-red-50 transition-all"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </FormField>

                                        <FormField label="Role Label" hint="Badge text">
                                            <Input
                                                ref={(el) => { if (el) roleRef[0] = el; }}
                                                value={draftRole}
                                                onChange={(e) => setDraftRole(e.target.value)}
                                                className="h-11 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-[var(--brand-red)] transition-all font-semibold"
                                                placeholder="Enter role label..."
                                            />
                                        </FormField>
                                    </div>

                                    <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Notification Title</Label>
                                            <Input
                                                ref={(el) => { if (el) titleRef[0] = el; }}
                                                value={draftTitle}
                                                onFocus={() => setActiveTarget('title')}
                                                onChange={(e) => setDraftTitle(e.target.value)}
                                                className="h-11 px-4 text-slate-900 font-semibold bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)] rounded-lg transition-all"
                                                placeholder="Enter title template..."
                                            />
                                        </div>

                                        <div className="space-y-2 flex-1 flex flex-col min-h-0">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Message Content</Label>
                                            <div className={`relative flex-1 flex flex-col rounded-xl border transition-all ${activeTarget === 'body' ? 'border-[var(--brand-red)] ring-2 ring-red-50' : 'border-slate-200 bg-slate-50/30'}`}>
                                                <textarea
                                                    ref={(el) => { if (el) bodyRef[0] = el; }}
                                                    value={draftBody}
                                                    onFocus={() => setActiveTarget('body')}
                                                    onChange={(e) => setDraftBody(e.target.value)}
                                                    className="w-full flex-1 p-5 bg-white border-none focus:outline-none resize-none text-slate-800 text-sm leading-relaxed rounded-xl"
                                                    placeholder="Enter notification message..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-12">
                                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 w-full max-w-md relative overflow-hidden">
                                        <div className="flex gap-4 items-start">
                                            <div className={cn(
                                                "w-11 h-11 flex items-center justify-center rounded-2xl shrink-0 mt-0.5",
                                                AVAILABLE_ICONS[draftType]?.bgColor || "bg-slate-100",
                                                AVAILABLE_ICONS[draftType]?.color || "text-slate-600"
                                            )}>
                                                {(() => {
                                                    const Icon = AVAILABLE_ICONS[draftType]?.icon || FileText;
                                                    return <Icon size={24} />;
                                                })()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <p className="font-bold text-slate-900 leading-tight" dangerouslySetInnerHTML={{ __html: renderedPreview.title }} />
                                                    {draftPriority === 'HIGH' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                                                </div>
                                                <p className="text-sm text-slate-600 mb-2 truncate" dangerouslySetInnerHTML={{ __html: renderedPreview.body }} />
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded h-5 flex items-center" dangerouslySetInnerHTML={{ __html: renderedPreview.role }} />
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-[10px] font-bold uppercase rounded h-5 flex items-center",
                                                        draftPriority === 'HIGH' ? "bg-red-100 text-red-700" :
                                                            draftPriority === 'LOW' ? "bg-slate-100 text-slate-600" :
                                                                "bg-yellow-100 text-yellow-700"
                                                    )} dangerouslySetInnerHTML={{ __html: renderedPreview.priority }} />
                                                    <div className="flex items-center gap-1 text-[11px] text-slate-400 ml-auto">
                                                        <Clock size={12} />
                                                        <span>1 min ago</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-8 text-xs font-medium text-slate-400 uppercase tracking-widest italic">Live Preview in Notification Popover</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-6 text-slate-400">
                            <div className="flex items-center gap-2">
                                <Info size={14} className="text-[var(--brand-red)]" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Real-time Preview</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">
                                    {lastSaved ? `Saved at ${lastSaved}` : 'Not saved yet'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="font-bold text-slate-500 hover:text-slate-900 h-11 px-6 text-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="h-11 px-8 bg-[var(--brand-red)] hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-red-200 gap-2 transition-all text-sm"
                            >
                                <Bell size={16} />
                                Save Bell Template
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// API Trigger Settings Editor (Dialog)
// ═══════════════════════════════════════════════════════════════════════════
// ─── API Configuration Dialog ─────────────────────────────────────────────
function ApiConfigurationDialog({
    open,
    onOpenChange,
    method,
    url,
    headers,
    body,
    authType,
    authToken,
    authUser,
    authPass,
    responseMapping,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    method: string;
    url: string;
    headers: any[];
    body: string;
    authType: string;
    authToken: string;
    authUser: string;
    authPass: string;
    responseMapping: any[];
    onSave: (data: {
        method: string;
        url: string;
        headers: any[];
        body: string;
        authType: string;
        authToken: string;
        authUser: string;
        authPass: string;
        responseMapping: any[];
    }) => void;
}) {
    const [localMethod, setLocalMethod] = useState(method);
    const [localUrl, setLocalUrl] = useState(url);
    const [localHeaders, setLocalHeaders] = useState([...headers]);
    const [localBody, setLocalBody] = useState(body);
    const [localAuthType, setLocalAuthType] = useState(authType || 'none');
    const [localAuthToken, setLocalAuthToken] = useState(authToken || '');
    const [localAuthUser, setLocalAuthUser] = useState(authUser || '');
    const [localAuthPass, setLocalAuthPass] = useState(authPass || '');
    const [localResponseMapping, setLocalResponseMapping] = useState([...(responseMapping || [])]);
    const [isTesting, setIsTesting] = useState(false);
    const [testResponse, setTestResponse] = useState<{ status: number; body: any } | null>(null);

    const handleTestCall = async () => {
        setIsTesting(true);
        setTestResponse(null);
        try {
            const headersObj: Record<string, string> = {};
            localHeaders.forEach(h => { if (h.key) headersObj[h.key] = h.value; });

            const payload = {
                method: localMethod,
                url: localUrl,
                headers: JSON.stringify(headersObj),
                body: localBody,
                authType: localAuthType,
                authUser: localAuthUser,
                authPass: localAuthPass,
                authToken: localAuthToken,
            };

            const response = await AdminService.testApiCall(payload);
            setTestResponse({ status: response.status, body: response.body });
        } catch (error: any) {
            setTestResponse({ status: 500, body: error.message || 'Failed to execute request through backend proxy' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        onSave({
            method: localMethod,
            url: localUrl,
            headers: localHeaders,
            body: localBody,
            authType: localAuthType,
            authToken: localAuthToken,
            authUser: localAuthUser,
            authPass: localAuthPass,
            responseMapping: localResponseMapping,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white rounded-2xl shadow-2xl border-none p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Globe size={20} />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900">Background Step Configuration</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">Configure external HTTP request settings</DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Method & URL */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoint</Label>
                        <div className="flex gap-2">
                            <Select value={localMethod} onValueChange={setLocalMethod}>
                                <SelectTrigger className="w-[120px] h-11 bg-slate-50 border-slate-200 font-bold text-emerald-600 rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET" className="text-emerald-600 font-bold">GET</SelectItem>
                                    <SelectItem value="POST" className="text-blue-600 font-bold">POST</SelectItem>
                                    <SelectItem value="PUT" className="text-amber-600 font-bold">PUT</SelectItem>
                                    <SelectItem value="PATCH" className="text-purple-600 font-bold">PATCH</SelectItem>
                                    <SelectItem value="DELETE" className="text-rose-600 font-bold">DELETE</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                value={localUrl}
                                onChange={(e) => setLocalUrl(e.target.value)}
                                placeholder="https://api.example.com/v1/..."
                                className="flex-1 h-11 bg-white border-slate-200 rounded-xl focus:ring-emerald-500/20"
                            />
                        </div>
                    </div>

                    <Tabs defaultValue="auth" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100/50 p-1 rounded-xl">
                            <TabsTrigger value="auth" className="py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Auth</TabsTrigger>
                            <TabsTrigger value="headers" className="py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Headers</TabsTrigger>
                            <TabsTrigger value="body" className="py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Body & Test</TabsTrigger>
                        </TabsList>

                        <TabsContent value="auth" className="pt-4 space-y-4 min-h-[250px]">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authentication Type</Label>
                                <Select value={localAuthType} onValueChange={setLocalAuthType}>
                                    <SelectTrigger className="w-full h-11 bg-white border-slate-200 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Auth</SelectItem>
                                        <SelectItem value="basic">Basic Auth</SelectItem>
                                        <SelectItem value="bearer">Bearer Token</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {localAuthType === 'basic' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-slate-500">Username</Label>
                                        <Input
                                            value={localAuthUser}
                                            onChange={(e) => setLocalAuthUser(e.target.value)}
                                            placeholder="Username"
                                            className="h-10 bg-white border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-slate-500">Password</Label>
                                        <Input
                                            type="password"
                                            value={localAuthPass}
                                            onChange={(e) => setLocalAuthPass(e.target.value)}
                                            placeholder="Password"
                                            className="h-10 bg-white border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {localAuthType === 'bearer' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-xs font-semibold text-slate-500">Token</Label>
                                    <Input
                                        value={localAuthToken}
                                        onChange={(e) => setLocalAuthToken(e.target.value)}
                                        placeholder="Bearer Token"
                                        className="h-10 bg-white border-slate-200 rounded-lg"
                                    />
                                </div>
                            )}

                            {localAuthType === 'none' && (
                                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <Shield size={24} className="text-slate-200 mb-2" />
                                    <p className="text-xs text-slate-400 italic">This request does not use any authentication</p>
                                </div>
                            )}
                        </TabsContent>


                        <TabsContent value="headers" className="pt-4 space-y-3 min-h-[250px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Request Headers</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setLocalHeaders([...localHeaders, { key: '', value: '' }])}
                                    className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                >
                                    <Plus size={14} className="mr-1.5" /> Add Header
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {localHeaders.map((header, idx) => (
                                    <div key={idx} className="flex gap-2 group animate-in fade-in slide-in-from-top-1">
                                        <Input
                                            placeholder="Key"
                                            value={header.key}
                                            onChange={(e) => {
                                                const nh = [...localHeaders];
                                                nh[idx].key = e.target.value;
                                                setLocalHeaders(nh);
                                            }}
                                            className="h-10 text-sm bg-white border-slate-200 rounded-lg"
                                        />
                                        <Input
                                            placeholder="Value"
                                            value={header.value}
                                            onChange={(e) => {
                                                const nh = [...localHeaders];
                                                nh[idx].value = e.target.value;
                                                setLocalHeaders(nh);
                                            }}
                                            className="h-10 text-sm bg-white border-slate-200 rounded-lg"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setLocalHeaders(localHeaders.filter((_, i) => i !== idx))}
                                            className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </Button>
                                    </div>
                                ))}
                                {localHeaders.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                        <Layers size={24} className="text-slate-200 mb-2" />
                                        <p className="text-xs text-slate-400 italic">No headers configured</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="body" className="pt-4 space-y-4 min-h-[400px]">
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">JSON Payload</Label>
                                <textarea
                                    value={localBody}
                                    onChange={(e) => setLocalBody(e.target.value)}
                                    placeholder='{&#10;  "key": "value"&#10;}'
                                    className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <Button
                                    onClick={handleTestCall}
                                    disabled={isTesting || !localUrl}
                                    className="w-full gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg"
                                >
                                    {isTesting ? <Play size={16} className="animate-pulse" /> : <Play size={16} />}
                                    {isTesting ? 'Sending Request...' : 'Send Test Request'}
                                </Button>
                            </div>

                            {testResponse && (
                                <div className="space-y-3 animate-in fade-in zoom-in-95">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Response</Label>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${testResponse.status >= 200 && testResponse.status < 300 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                            STATUS: {testResponse.status}
                                        </span>
                                    </div>
                                    <div className="relative group">
                                        <pre className="w-full max-h-40 overflow-y-auto bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono custom-scrollbar border border-slate-800 shadow-xl">
                                            {JSON.stringify(testResponse.body, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Response Mapping</span>
                                        <p className="text-[10px] text-slate-400">Map result properties to workflow variables</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLocalResponseMapping([...localResponseMapping, { path: '', targetKey: '' }])}
                                        className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                    >
                                        <Plus size={14} className="mr-1.5" /> Add Mapping
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {localResponseMapping.map((mapping: { path: string; targetKey: string }, idx: number) => (
                                        <div key={idx} className="flex gap-2 group animate-in fade-in slide-in-from-top-1">
                                            <Input
                                                placeholder="JSON Path (e.g. status)"
                                                value={mapping.path}
                                                onChange={(e) => {
                                                    const nm = [...localResponseMapping];
                                                    nm[idx].path = e.target.value;
                                                    setLocalResponseMapping(nm);
                                                }}
                                                className="h-9 text-xs bg-white border-slate-200 rounded-lg font-mono flex-1"
                                            />
                                            <Input
                                                placeholder="Variable Name"
                                                value={mapping.targetKey}
                                                onChange={(e) => {
                                                    const nm = [...localResponseMapping];
                                                    nm[idx].targetKey = e.target.value;
                                                    setLocalResponseMapping(nm);
                                                }}
                                                className="h-9 text-xs bg-white border-slate-200 rounded-lg flex-1"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setLocalResponseMapping(localResponseMapping.filter((_: any, i: number) => i !== idx))}
                                                className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>
                                    ))}
                                    {localResponseMapping.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                            <Database size={20} className="text-slate-200 mb-2" />
                                            <p className="text-[10px] text-slate-400 italic">No output mappings defined</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-3 px-6">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
                    <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 shadow-lg shadow-emerald-200">Save Configuration</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ApiTriggerSettingsDialog({
    endpoint,
    payload,
    onSave,
    open,
    onOpenChange,
}: {
    endpoint: string;
    payload: string;
    onSave: (endpoint: string, payload: string) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [draftEndpoint, setDraftEndpoint] = useState(endpoint || '');
    const [draftPayload, setDraftPayload] = useState(payload || '');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Sync draft with props when opened
    useMemo(() => {
        if (open) {
            setDraftEndpoint(endpoint || '');
            setDraftPayload(payload || '');
            setJsonError(null);
        }
    }, [open, endpoint, payload]);

    const handleSave = () => {
        // Simple JSON validation
        if (draftPayload) {
            try {
                JSON.parse(draftPayload);
            } catch (e) {
                setJsonError('Invalid JSON format');
                return;
            }
        }
        onSave(draftEndpoint, draftPayload);
        onOpenChange(false);
    };

    const derivedFields = useMemo(() => {
        if (!draftPayload) return [];
        try {
            const parsed = JSON.parse(draftPayload);
            if (parsed && typeof parsed === 'object') {
                return Object.keys(parsed);
            }
        } catch (e) { /* ignore */ }
        return [];
    }, [draftPayload]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500">
                            <GitBranch size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">API Trigger Settings</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                Configure the external API endpoint and input payload
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoint URL</Label>
                        <Input
                            value={draftEndpoint}
                            onChange={(e) => setDraftEndpoint(e.target.value)}
                            placeholder="https://api.example.com/trigger"
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-all font-mono text-xs"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Input Payload (JSON)</Label>
                        <Textarea
                            value={draftPayload}
                            onChange={(e) => {
                                setDraftPayload(e.target.value);
                                if (jsonError) setJsonError(null);
                            }}
                            placeholder='{ "field1": "value1", "field2": 123 }'
                            className="font-mono text-xs min-h-[150px] bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        />
                        {jsonError && <p className="text-xs text-red-500 font-medium">{jsonError}</p>}
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Derived Output Variables</Label>
                        {derivedFields.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No variables derived yet. Define a valid JSON payload above.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {derivedFields.map(field => (
                                    <div key={field} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <GitBranch size={12} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-700">{field}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-slate-500 hover:text-slate-900">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-8">
                        Save API Settings
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
interface WorkflowNodePropertiesProps {
    node: UiWorkflowNode;
    allNodes: UiWorkflowNode[];
    edges: UiWorkflowEdge[];
}

export function WorkflowNodeProperties({ node, allNodes, edges }: WorkflowNodePropertiesProps) {
    const {
        updateNodeData,
        deleteStep,
        updateWorkflow,
        workflow,
        forms,
        addForm,
        selectForm,
        setActiveTab,
        setIsFormEditorOpen,
    } = useStudioStore();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isConditionEditorOpen, setIsConditionEditorOpen] = useState(false);
    const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);

    const nodeType = node.type || 'actionNode';
    const subType = node.data?.actionSubType as string | undefined;
    const triggerType = (node.data?.triggerType as string) || 'FORM_SUB';

    const isUserTask = subType === 'user_task' || subType === 'userTask' || subType === 'form';
    const isBackgroundTask = subType === 'background_task' || subType === 'api_call' || subType === 'apiCall' || subType === 'formula';
    // For background_task, determine the active mode from node data (default: api_call)
    const backgroundTaskMode = isBackgroundTask
        ? ((node.data.backgroundTaskMode as string) || (subType === 'formula' ? 'formula' : 'api_call'))
        : null;
    const isApiCall = backgroundTaskMode === 'api_call';
    const isFormula = backgroundTaskMode === 'formula';
    const isApproval = subType === 'approval';

    // --- Data Resolvers for IO Mapping ---

    // 1. Get fields for CURRENT step (the mapping targets)
    const targetFields = useMemo(() => {
        const fields: UiFormField[] = [];
        const isStart = node.data.isStart || node.type === 'startNode';

        if (isStart) {
            // Include system-level outputs ONLY for Form Submission
            if (triggerType === 'FORM_SUB') {
                SYSTEM_OUTPUT_FIELDS.forEach(sf => {
                    fields.push({ id: sf.id, label: sf.label, type: sf.type } as unknown as UiFormField);
                });
            }

            if (triggerType === 'FORM_SUB') {
                const currentFormId = node.data?.formId as string | undefined;
                const currentForm = currentFormId ? forms.find(f => f.id === currentFormId) : null;
                if (currentForm) {
                    currentForm.items.forEach(item => {
                        if (item.type === 'section') {
                            fields.push(...(item as UiSection).fields);
                        } else if (item.type !== 'table') {
                            fields.push(item as UiFormField);
                        }
                    });
                }
            } else if (triggerType === 'API_TRIGGER') {
                const apiPayload = node.data.apiPayload as string;
                if (apiPayload) {
                    try {
                        const parsed = JSON.parse(apiPayload);
                        if (parsed && typeof parsed === 'object') {
                            Object.keys(parsed).forEach(key => {
                                fields.push({
                                    id: key,
                                    label: key,
                                    type: 'api'
                                } as unknown as UiFormField);
                            });
                        }
                    } catch (e) {
                        // Invalid JSON
                    }
                }
            }
        } else {
            const currentFormId = node.data?.formId as string | undefined;
            const currentForm = currentFormId ? forms.find(f => f.id === currentFormId) : null;
            if (currentForm) {
                currentForm.items.forEach(item => {
                    if (item.type === 'section') {
                        fields.push(...(item as UiSection).fields);
                    } else if (item.type !== 'table') {
                        fields.push(item as UiFormField);
                    }
                });
            }
        }
        return fields;
    }, [node.data?.formId, forms, node.data.isStart, node.type, triggerType, node.data.apiPayload]);

    // 2. Get available source fields from ALL previous steps (Ancestors)
    const availableSources = useMemo(() => {
        const sources: Array<{ stepId: string; stepName: string; fieldId: string; fieldName: string; type?: string }> = [];

        // 1. Always add System Fields
        SYSTEM_OUTPUT_FIELDS.forEach(sf => {
            sources.push({
                stepId: 'system',
                stepName: 'System',
                fieldId: sf.id,
                fieldName: sf.label,
                type: sf.type
            });
        });

        // 2. Find all ancestor nodes
        const ancestorIds = findAllAncestors(node.id, edges);

        ancestorIds.forEach(id => {
            const ancestor = allNodes.find(n => n.id === id);
            if (!ancestor) return;

            const stepName = (ancestor.data.label as string) || 'Untitled Step';

            // Form fields (for Start / User Task / Approval)
            const formId = ancestor.data.formId as string | undefined;
            const form = formId ? forms.find(f => f.id === formId) : null;

            if (form) {
                form.items.forEach(item => {
                    if (item.type === 'section') {
                        (item as UiSection).fields.forEach(f => sources.push({
                            stepId: id,
                            stepName,
                            fieldId: f.id,
                            fieldName: f.label,
                            type: f.type
                        }));
                    } else if (item.type !== 'table') {
                        const f = item as UiFormField;
                        sources.push({
                            stepId: id,
                            stepName,
                            fieldId: f.id,
                            fieldName: f.label,
                            type: f.type
                        });
                    }
                });
            }

            // API Outputs (specifically for API Call nodes)
            const outputs = (ancestor.data.outputs as UiNodeOutput[] | undefined) ?? [];
            outputs.forEach(opt => {
                sources.push({
                    stepId: id,
                    stepName,
                    fieldId: opt.sourcePath,
                    fieldName: opt.alias || opt.sourcePath,
                    type: opt.type || 'string'
                });
            });

            // Formula Outputs
            const formulas = (ancestor.data.formulas as FormulaItem[] | undefined) ?? [];
            formulas.forEach(f => {
                if (f.resultName) {
                    sources.push({
                        stepId: id,
                        stepName,
                        fieldId: f.id,
                        fieldName: f.resultName,
                        type: 'number' // Assuming formulas output numbers for calculation purposes
                    });
                }
            });
        });

        return sources;
    }, [allNodes, edges, node.id, forms]);


    // 4. Handle Mapping Updates
    const inputMapping = useMemo(() => {
        try {
            return JSON.parse((node.data.inputMapping as string) || '{}');
        } catch {
            return {};
        }
    }, [node.data.inputMapping]);

    const handleMappingChange = (fieldId: string, mapping: { sourceStepId: string; sourceFieldId: string } | undefined) => {
        const newMapping = { ...inputMapping };
        if (mapping) {
            newMapping[fieldId] = mapping;
        } else {
            delete newMapping[fieldId];
        }
        updateNodeData(node.id, { inputMapping: JSON.stringify(newMapping) });
    };
    const info = getNodeTypeInfo(nodeType, subType);
    const Icon = info.icon;

    // ── Shared helpers ────────────────────────────────────────────────────
    const handleLabelChange = (val: string) => updateNodeData(node.id, { label: val });

    // Auto-create a skeleton form for this step if one doesn't exist
    const ensureFormForNode = (): string => {
        const existingFormId = node.data?.formId as string | undefined;
        if (existingFormId) {
            const existingForm = forms.find(f => f.id === existingFormId);
            if (existingForm) return existingFormId;
        }
        // Create a skeleton form named after the step, ensuring uniqueness
        const stepLabel = (node.data.label as string) || 'Untitled Step';
        const baseName = `${stepLabel} Form`;
        let uniqueName = baseName;
        let counter = 1;

        while (forms.some(f => f.name === uniqueName)) {
            uniqueName = `${baseName} ${counter++}`;
        }

        addForm(uniqueName);
        const latestForms = useStudioStore.getState().forms;
        const newForm = latestForms[latestForms.length - 1];
        if (newForm) {
            updateNodeData(node.id, { formId: newForm.id });
            return newForm.id;
        }
        return '';
    };

    const handleEditFormLayout = () => {
        const formId = ensureFormForNode();
        if (formId) {
            selectForm(formId);
        }
        setIsFormEditorOpen(true);
        setActiveTab('schema');
    };

    // Get the current form name for display
    const currentFormId = node.data?.formId as string | undefined;
    const currentForm = currentFormId ? forms.find(f => f.id === currentFormId) : null;

    // Predecessor management
    const handlePredecessorToggle = (targetNodeId: string, isSelected: boolean) => {
        const existingEdge = edges.find(e => e.source === targetNodeId && e.target === node.id);
        if (isSelected && !existingEdge) {
            const newEdge: UiWorkflowEdge = {
                id: `e-${targetNodeId}-${node.id}`,
                source: targetNodeId,
                target: node.id,
                type: 'smoothstep',
            };
            updateWorkflow(workflow.nodes, [...workflow.edges, newEdge]);
        } else if (!isSelected && existingEdge) {
            updateWorkflow(workflow.nodes, workflow.edges.filter(e => e.id !== existingEdge.id));
        }
    };

    // Owner
    const stepOwner: Principal | null = node.data.owner_ID
        ? {
            id: node.data.owner_ID as string,
            type: (node.data.ownerType as string) || 'USER',
            displayName: (node.data.ownerName as string) || 'Unknown',
        }
        : null;

    const handleOwnerChange = (principal: Principal | null) => {
        if (principal) {
            updateNodeData(node.id, {
                owner_ID: principal.id,
                ownerType: principal.type,
                ownerName: principal.displayName,
            });
        } else {
            updateNodeData(node.id, {
                owner_ID: null,
                ownerType: null,
                ownerName: null,
            });
        }
    };

    const stepApprover: Principal | null = node.data.approver_ID
        ? {
            id: node.data.approver_ID as string,
            type: (node.data.approverType as string) || 'USER',
            displayName: (node.data.approverName as string) || 'Unknown',
        }
        : null;

    const handleApproverChange = (principal: Principal | null) => {
        if (principal) {
            updateNodeData(node.id, {
                approver_ID: principal.id,
                approverType: principal.type,
                approverName: principal.displayName,
            });
        } else {
            updateNodeData(node.id, {
                approver_ID: null,
                approverType: null,
                approverName: null,
            });
        }
    };

    const potentialPredecessors = allNodes.filter(n => n.id !== node.id);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4">
            {/* Node Type Badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg"
                    style={{ backgroundColor: `color-mix(in srgb, ${info.color} 12%, transparent)` }}
                >
                    <Icon size={18} style={{ color: info.color }} />
                </div>
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{info.label}</p>
                    <p className="text-sm font-medium text-slate-900">{(node.data.label as string) || 'Untitled'}</p>
                </div>
            </div>

            {/* Task Name / Step Label */}
            <Card className="p-4 space-y-4">
                <FormField label={nodeType === 'actionNode' ? 'Task Name' : 'Step Label'} hint="Display name on the canvas">
                    <Input
                        value={(node.data.label as string) || ''}
                        onChange={(e) => handleLabelChange(e.target.value)}
                        placeholder={nodeType === 'actionNode' ? 'Enter task name...' : 'Enter step name...'}
                        className="border-0 focus-visible:ring-0 font-medium"
                    />
                </FormField>
            </Card>

            {/* ── START NODE ─────────────────────────────────── */}
            {nodeType === 'startNode' && (
                <>
                    <Card className="p-4 space-y-4">
                        <Label variant="section">Trigger Type</Label>
                        <TriggerTypeToggle
                            value={(node.data.triggerType as string) || 'FORM_SUB'}
                            onChange={(val) => updateNodeData(node.id, { triggerType: val })}
                        />
                    </Card>

                    <Card className="p-4 space-y-3">
                        <Label variant="section">Trigger Settings</Label>
                        {triggerType === 'FORM_SUB' ? (
                            <>
                                {currentForm ? (
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80">
                                        <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{currentForm.name}</span>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No form created yet. Click below to create one.</p>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleEditFormLayout}
                                    className="w-full gap-1.5"
                                >
                                    <ExternalLink size={14} />
                                    {currentForm ? 'Open Form Editor' : 'Create & Edit Form'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <ApiTriggerSettingsDialog
                                    open={isApiSettingsOpen}
                                    onOpenChange={setIsApiSettingsOpen}
                                    endpoint={(node.data.apiEndpoint as string) || ''}
                                    payload={(node.data.apiPayload as string) || ''}
                                    onSave={(endpoint, payload) => {
                                        updateNodeData(node.id, {
                                            apiEndpoint: endpoint,
                                            apiPayload: payload
                                        });
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsApiSettingsOpen(true)}
                                    className="w-full gap-1.5 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                                >
                                    <GitBranch size={14} />
                                    Open API Setting
                                </Button>
                            </>
                        )}
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex flex-col">
                            <Label variant="section">Outputs</Label>
                            <span className="text-[11px] text-slate-400">Captured variables available for mapping</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {/* System Fields - ONLY for Form Submission */}
                            {triggerType === 'FORM_SUB' && (
                                <>
                                    {targetFields.filter(f => f.id.startsWith('__')).length > 0 && (
                                        <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">System</p>
                                    )}
                                    {targetFields.filter(f => f.id.startsWith('__')).map(f => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-blue-100 bg-blue-50/50">
                                            <Database size={12} className="text-blue-400" />
                                            <span className="text-xs font-medium text-blue-700">{f.label}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Form Fields */}
                            {triggerType === 'FORM_SUB' && (
                                <>
                                    {targetFields.filter(f => !f.id.startsWith('__')).length > 0 && (
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Form Fields</p>
                                    )}
                                    {targetFields.filter(f => !f.id.startsWith('__')).map(f => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                                            <Database size={12} className="text-slate-400" />
                                            <span className="text-xs font-medium text-slate-600">{f.label}</span>
                                        </div>
                                    ))}
                                    {targetFields.filter(f => !f.id.startsWith('__')).length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No fields defined for this form.</p>
                                    )}
                                </>
                            )}

                            {/* API Fields */}
                            {triggerType === 'API_TRIGGER' && (
                                <>
                                    {targetFields.filter(f => (f as any).type === 'api').length > 0 && (
                                        <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider mt-1">API Variables</p>
                                    )}
                                    {targetFields.filter(f => (f as any).type === 'api').map(f => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-emerald-100 bg-emerald-50/50">
                                            <Database size={12} className="text-emerald-500" />
                                            <span className="text-xs font-medium text-emerald-700">{f.label}</span>
                                        </div>
                                    ))}
                                    {targetFields.filter(f => (f as any).type === 'api').length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No valid JSON payload defined.</p>
                                    )}
                                </>
                            )}
                        </div>
                    </Card>
                </>
            )}

            {/* ── ACTION NODE (User Task) ───────────────────── */}
            {nodeType === 'actionNode' && (
                <>
                    {/* ─── Task Type Selector (Status Flow REQ 1) ── */}
                    {(isUserTask || isApproval) && (
                        <Card className="p-4 space-y-3">
                            <Label variant="section">Task Type</Label>
                            <p className="text-[11px] text-slate-400">
                                Determines the role swimlane and available actions in the Status Flow.
                            </p>
                            <Select
                                value={(node.data.taskType as string) || (isApproval ? 'approval' : 'dataEntry')}
                                onValueChange={(val) => updateNodeData(node.id, {
                                    taskType: val,
                                    // Persist via actionSubType (the DB-backed field)
                                    actionSubType: val === 'approval' ? 'approval' : 'user_task',
                                })}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select task type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dataEntry">📝 Data Entry</SelectItem>
                                    <SelectItem value="approval">🛡️ Approval</SelectItem>
                                </SelectContent>
                            </Select>
                        </Card>
                    )}

                    {/* ─── Task Form Configuration ──────────── */}
                    {(!isUserTask && !isFormula && !isApproval) && (
                        <Card className="p-4 space-y-3">
                            <Label variant="section">Task Form</Label>
                            {currentForm ? (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80">
                                    <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 flex-1 truncate">{currentForm.name}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No form created yet. Click below to create one.</p>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEditFormLayout}
                                className="w-full gap-1.5"
                            >
                                <ExternalLink size={14} />
                                {currentForm ? 'Open Task Editor' : 'Create & Edit Task Form'}
                            </Button>
                            <p className="text-[11px] text-slate-400 italic">
                                Configure the task form layout in the Task Editor
                            </p>
                        </Card>
                    )}

                    {/* ─── Approvers Card ────────────────────── */}
                    {(!isUserTask && !isFormula && !isApproval) && (
                        <Card className="p-4 space-y-3">
                            <Label variant="section">Approvers</Label>
                            <p className="text-[11px] text-slate-400">
                                Select individual users or groups who can approve this task.
                            </p>

                            {/* List of current approvers */}
                            {(() => {
                                const approvers = (node.data.approvers as Array<{ id: string; type: string; displayName: string }>) || [];
                                return (
                                    <>
                                        {approvers.length > 0 && (
                                            <div className="space-y-1.5">
                                                {approvers.map((approver, idx) => {
                                                    const ApproverIcon = approver.type === 'USER' ? FileEdit : Users;
                                                    return (
                                                        <div
                                                            key={approver.id + '-' + idx}
                                                            className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/80 group"
                                                        >
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${approver.type === 'USER' ? 'bg-blue-100' : 'bg-violet-100'
                                                                }`}>
                                                                <ApproverIcon size={14} className={
                                                                    approver.type === 'USER' ? 'text-blue-600' : 'text-violet-600'
                                                                } />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium text-slate-700 truncate block">
                                                                    {approver.displayName}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 uppercase">{approver.type}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const newApprovers = approvers.filter((_, i) => i !== idx);
                                                                    updateNodeData(node.id, { approvers: newApprovers });
                                                                }}
                                                                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <PrincipalSelect
                                            value={null}
                                            onChange={(principal) => {
                                                if (!principal) return;
                                                const existing = (node.data.approvers as Array<{ id: string; type: string; displayName: string }>) || [];
                                                // Avoid duplicates
                                                if (existing.some(a => a.id === principal.id && a.type === principal.type)) return;
                                                updateNodeData(node.id, {
                                                    approvers: [...existing, {
                                                        id: principal.id,
                                                        type: principal.type,
                                                        displayName: principal.displayName,
                                                    }],
                                                });
                                            }}
                                            placeholder="Add approver..."
                                            excludeIds={
                                                ((node.data.approvers as Array<{ id: string }>) || []).map(a => a.id)
                                            }
                                        />
                                    </>
                                );
                            })()}
                        </Card>
                    )}

                    {/* ─── BACKGROUND TASK (API Call / Formula) ───────── */}
                    {isBackgroundTask && (
                        <>
                            {/* Task Mode Selector */}
                            <Card className="p-4 space-y-3">
                                <Label variant="section">Background Task Type</Label>
                                <p className="text-[11px] text-slate-400 -mt-1">
                                    Choose the type of automated processing for this step.
                                </p>
                                <Select
                                    value={backgroundTaskMode || 'api_call'}
                                    onValueChange={(val) => updateNodeData(node.id, {
                                        backgroundTaskMode: val,
                                        actionSubType: 'background_task',
                                    })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select task type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="api_call">🌐 API Call</SelectItem>
                                        <SelectItem value="formula">🧮 Formula</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Card>

                            {/* API Call Configuration */}
                            {isApiCall && (
                                <Card className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label variant="section">API Configuration</Label>
                                        {(node.data.apiMethod && node.data.apiUrl) && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
                                                <span className="text-[10px] font-bold text-emerald-600">{(node.data.apiMethod as string)}</span>
                                                <div className="w-1 h-1 rounded-full bg-emerald-300" />
                                                <span className="text-[10px] font-medium text-emerald-600/70 truncate max-w-[120px]">
                                                    {(node.data.apiUrl as string).replace(/^https?:\/\//, '')}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-slate-400 -mt-1 leading-relaxed">
                                        Configure the external API endpoint and request parameters for this automated step.
                                    </p>

                                    <ApiConfigurationDialog
                                        open={isApiSettingsOpen}
                                        onOpenChange={setIsApiSettingsOpen}
                                        method={(node.data.apiMethod as string) || 'GET'}
                                        url={(node.data.apiUrl as string) || ''}
                                        headers={(node.data.apiHeaders as any[]) || []}
                                        body={(node.data.apiBody as string) || ''}
                                        authType={(node.data.apiAuthType as string) || 'none'}
                                        authToken={(node.data.apiAuthToken as string) || ''}
                                        authUser={(node.data.apiAuthUser as string) || ''}
                                        authPass={(node.data.apiAuthPass as string) || ''}
                                        responseMapping={(node.data.apiResponseMapping as any[]) || []}
                                        onSave={(data) => {
                                            updateNodeData(node.id, {
                                                apiMethod: data.method,
                                                apiUrl: data.url,
                                                apiHeaders: data.headers,
                                                apiBody: data.body,
                                                apiAuthType: data.authType,
                                                apiAuthToken: data.authToken,
                                                apiAuthUser: data.authUser,
                                                apiAuthPass: data.authPass,
                                                apiResponseMapping: data.responseMapping,
                                            });
                                        }}
                                    />

                                    <Button
                                        variant="outline"
                                        onClick={() => setIsApiSettingsOpen(true)}
                                        className="w-full gap-2 font-semibold h-12 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl"
                                    >
                                        <Globe size={16} />
                                        Configure API Call
                                    </Button>

                                    {!(node.data.apiMethod && node.data.apiUrl) && (
                                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex gap-2">
                                            <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-amber-700 font-medium">
                                                Method and URL are required for the workflow to execute this step correctly.
                                            </p>
                                        </div>
                                    )}
                                </Card>
                            )}

                            {/* Formula Configuration */}
                            {isFormula && (
                                <Card className="p-4 space-y-4">
                                    <Label variant="section">Formula Configuration</Label>
                                    <p className="text-[11px] text-slate-400 -mt-1 leading-relaxed">
                                        Calculate values dynamically based on outputs of previous steps.
                                    </p>
                                    <FormulaEditor
                                        formulas={(node.data.formulas as FormulaItem[]) || (node.data.formulaResultName ? [{ id: crypto.randomUUID(), resultName: node.data.formulaResultName as string, expression: node.data.formulaExpression as string }] : [])}
                                        onSave={(formulas) => updateNodeData(node.id, { formulas })}
                                        availableSources={availableSources}
                                    />
                                </Card>
                            )}

                            {/* Formula Outputs Card */}
                            {isFormula && (
                                (() => {
                                    const currentFormulas = (node.data.formulas as FormulaItem[]) || (node.data.formulaResultName ? [{ id: 'legacy', resultName: node.data.formulaResultName as string, expression: node.data.formulaExpression as string }] : []);
                                    if (currentFormulas.length === 0) return null;
                                    return (
                                        <Card className="p-4 space-y-3">
                                            <div className="flex flex-col">
                                                <Label variant="section">Outputs</Label>
                                                <span className="text-[11px] text-slate-400">Captured variables available for mapping</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Formula Results</p>
                                                {currentFormulas.map(f => (
                                                    <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                                                        <Database size={12} className="text-slate-400" />
                                                        <span className="text-xs font-medium text-slate-600">{f.resultName || 'Unnamed Variable'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    );
                                })()
                            )}
                        </>
                    )}

                    {/* ─── APPROVAL / USER TASK SUB-TYPE ──────────────────── */}
                    {(isApproval || isUserTask) && (
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className={`grid w-full ${isUserTask ? 'grid-cols-3' : 'grid-cols-2'} mb-4 bg-slate-100/50 p-1 rounded-lg`}>
                                <TabsTrigger value="general" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">General</TabsTrigger>
                                <TabsTrigger value="mapping" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Input</TabsTrigger>
                                {isUserTask && (
                                    <TabsTrigger value="output" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Output</TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="general" className="space-y-4 focus-visible:outline-none">
                                <Card className="p-4 space-y-4">
                                    <Label variant="section">Recipients</Label>
                                    <p className="text-[11px] text-slate-400 -mt-1">
                                        Select individual users or groups who are responsible for this task.
                                    </p>

                                    {stepApprover ? (
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50/30 group">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
                                                    <Shield size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 leading-none">{stepApprover.displayName}</p>
                                                    <p className="text-[10px] font-medium text-slate-400 uppercase mt-1 tracking-wider">{stepApprover.type}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 -mr-1"
                                                onClick={() => handleApproverChange(null)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2">
                                            <Shield size={20} className="text-slate-200" />
                                            <p className="text-[11px] text-slate-400">No recipients assigned</p>
                                        </div>
                                    )}

                                    <OrgHierarchySelect
                                        onChange={handleApproverChange}
                                        placeholder="Add recipient(s)..."
                                        excludeIds={
                                            stepApprover ? [stepApprover.id] : []
                                        }
                                    />
                                </Card>

                                {(isUserTask || isApproval) && (
                                    <Card className="p-4 space-y-3">
                                        <Label variant="section">Task Form</Label>
                                        <div className="space-y-3">
                                            <Select
                                                value={node.data?.formId as string || "none"}
                                                onValueChange={(val) => {
                                                    const newFormId = val === "none" ? null : val;
                                                    updateNodeData(node.id, { formId: newFormId });
                                                    if (newFormId) selectForm(newFormId);
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-0">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Layers size={14} className="text-slate-400 flex-shrink-0" />
                                                        <SelectValue placeholder="Select a form..." />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none" className="text-slate-500 italic">(None) No Form</SelectItem>
                                                    {(() => {
                                                        const startNode = allNodes.find(n => n.data?.isStart || n.type === 'startNode');
                                                        const startFormId = startNode?.data?.formId;
                                                        return forms
                                                            .filter(f => f.id !== startFormId)
                                                            .map(f => (
                                                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                                            ));
                                                    })()}
                                                </SelectContent>
                                            </Select>

                                            {node.data?.formId ? (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleEditFormLayout}
                                                        className="w-full gap-2 font-semibold h-10 border-slate-200"
                                                    >
                                                        <FileEdit size={14} />
                                                        Open Task Editor
                                                    </Button>
                                                    <p className="text-[10px] text-slate-400 text-center px-2 leading-relaxed">
                                                        Configure the task form layout in the Task Editor
                                                    </p>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const formId = ensureFormForNode();
                                                        if (formId) selectForm(formId);
                                                    }}
                                                    className="w-full gap-2 font-semibold h-10 border-slate-200 border-dashed hover:border-[var(--brand-red)] hover:bg-[var(--brand-red)]/5 text-slate-500 hover:text-[var(--brand-red)]"
                                                >
                                                    <Plus size={14} />
                                                    Create New Form
                                                </Button>
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {isUserTask && (
                                    <Card className="p-4 space-y-4">
                                        <Label variant="section">Notifications</Label>
                                        <p className="text-[11px] text-slate-400 -mt-1">
                                            Choose how stakeholders are notified at this step.
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'email', icon: Mail, label: 'EMAIL' },
                                                { id: 'bell', icon: Bell, label: 'BELL' },
                                                { id: 'teams', icon: MessageSquare, label: 'TEAMS' },
                                            ].map((channel) => {
                                                const notificationTypes = (node.data.notificationTypes as string[]) || [];
                                                const isActive = notificationTypes.includes(channel.id);
                                                const ChannelIcon = channel.icon;
                                                return (
                                                    <button
                                                        key={channel.id}
                                                        onClick={() => {
                                                            const current = (node.data.notificationTypes as string[]) || [];
                                                            const next = current.includes(channel.id)
                                                                ? current.filter(c => c !== channel.id)
                                                                : [...current, channel.id];
                                                            updateNodeData(node.id, { notificationTypes: next });
                                                        }}
                                                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isActive
                                                            ? 'border-[var(--brand-red)] bg-white shadow-sm'
                                                            : 'border-slate-100 bg-slate-50/50 grayscale opacity-60'
                                                            }`}
                                                    >
                                                        <ChannelIcon size={18} className={isActive ? 'text-[var(--brand-red)]' : 'text-slate-400'} />
                                                        <span className={`text-[9px] font-bold tracking-widest ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                                                            {channel.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Edit Body Content button — only visible when EMAIL is enabled */}
                                        {((node.data.notificationTypes as string[]) || []).includes('email') && (
                                            <EmailTemplateEditor
                                                subject={(node.data.emailSubject as string) || ''}
                                                body={(node.data.emailBody as string) || ''}
                                                onSave={(subject, body) => updateNodeData(node.id, { emailSubject: subject, emailBody: body })}
                                                availableSources={availableSources}
                                            />
                                        )}

                                        {/* Edit Bell Content button — only visible when BELL is enabled */}
                                        {((node.data.notificationTypes as string[]) || []).includes('bell') && (
                                            <BellNotificationEditor
                                                title={(node.data.bellTitle as string) || ''}
                                                body={(node.data.bellBody as string) || ''}
                                                type={(node.data.bellType as string) || ''}
                                                priority={(node.data.bellPriority as string) || ''}
                                                role={(node.data.bellRole as string) || ''}
                                                onSave={(title, body, type, priority, role) => updateNodeData(node.id, {
                                                    bellTitle: title,
                                                    bellBody: body,
                                                    bellType: type,
                                                    bellPriority: priority,
                                                    bellRole: role
                                                })}
                                                availableSources={availableSources}
                                            />
                                        )}
                                    </Card>
                                )}

                                {/* Moved SLA, Owner, Sync, Predecessors into General Tab */}
                                <Card className="p-4 space-y-4">
                                    <FormField label="SLA" hint="Time limit in days">
                                        <SlaInput
                                            value={(node.data.sla as number) || 0}
                                            onChange={(val) => updateNodeData(node.id, { sla: val })}
                                        />
                                    </FormField>

                                    <FormField label="Default Owner" hint="Who is responsible for this step">
                                        <PrincipalSelect
                                            value={stepOwner}
                                            onChange={handleOwnerChange}
                                            placeholder="Inherit from coordinator"
                                        />
                                        <p className="text-[11px] text-slate-400 italic mt-1">
                                            Leave empty to default to the request coordinator
                                        </p>
                                    </FormField>
                                </Card>

                                <Card className="p-4 space-y-2">
                                    <Label variant="section">Sync Trigger</Label>
                                    <Select
                                        value={(node.data.syncTrigger as string) || 'NONE'}
                                        onValueChange={(val) => updateNodeData(node.id, { syncTrigger: val })}
                                    >
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">None (No sync)</SelectItem>
                                            <SelectItem value="IMMEDIATE">Immediate (Sync on save)</SelectItem>
                                            <SelectItem value="WITH_NEXT">With Next Step</SelectItem>
                                            <SelectItem value="ON_COMPLETE">On Complete (Final step)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-slate-400 italic">
                                        When to sync data to external systems (e.g., S/4HANA)
                                    </p>
                                </Card>

                                <div className="space-y-2">
                                    <Label variant="section">Predecessors</Label>
                                    <Card className="p-2 max-h-52 overflow-y-auto">
                                        {potentialPredecessors.length === 0 ? (
                                            <p className="text-xs text-slate-400 p-2 italic text-center">No other steps available</p>
                                        ) : (
                                            potentialPredecessors.map(pred => (
                                                <PredecessorItem
                                                    key={pred.id}
                                                    label={pred.data.label as string}
                                                    isSelected={edges.some(e => e.source === pred.id && e.target === node.id)}
                                                    onToggle={(sel) => handlePredecessorToggle(pred.id, sel)}
                                                />
                                            ))
                                        )}
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="mapping" className="space-y-4 focus-visible:outline-none">
                                <Card className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label variant="section">Field Mappings</Label>
                                        <Button variant="ghost" size="sm" onClick={handleEditFormLayout} className="text-primary h-7 text-[10px] px-2 gap-1 font-semibold border-slate-200">
                                            <FileEdit size={12} />
                                            Edit {isUserTask ? 'Task' : 'Approval'} Form
                                        </Button>
                                    </div>

                                    {targetFields.length === 0 ? (
                                        <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                                            <p className="text-xs text-slate-400 italic">No fields defined for this step.<br />Add fields to set up mappings.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {targetFields.map(field => (
                                                <MappingSelector
                                                    key={field.id}
                                                    label={field.label}
                                                    availableSources={availableSources}
                                                    value={inputMapping[field.id]}
                                                    onChange={(val) => handleMappingChange(field.id, val)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Info box removed for User Tasks as per request */}
                                    {!isUserTask && (
                                        <div className="text-[11px] text-slate-400 italic bg-blue-50/30 p-3 rounded-xl border border-blue-100/50 flex gap-2">
                                            <Database size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                            <span>Mapped fields will automatically pre-fill with values captured from previous steps when the {isUserTask ? 'user' : 'approver'} opens the task.</span>
                                        </div>
                                    )}
                                </Card>
                            </TabsContent>

                            {isUserTask && (
                                <TabsContent value="output" className="space-y-4 focus-visible:outline-none">
                                    <Card className="p-4 space-y-4">
                                        <Label variant="section">Output Fields</Label>
                                        <p className="text-[11px] text-slate-400 -mt-1">
                                            These fields from the Task Form will be available as outputs for subsequent steps.
                                        </p>
                                        <div className="space-y-2">
                                            {targetFields.filter(f => !f.id.startsWith('__')).map(f => (
                                                <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                                                    <Database size={12} className="text-slate-400" />
                                                    <span className="text-xs font-medium text-slate-600">{f.label}</span>
                                                </div>
                                            ))}
                                            {targetFields.filter(f => !f.id.startsWith('__')).length === 0 && (
                                                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                                                    <p className="text-xs text-slate-400 italic">No fields defined for this form.</p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </TabsContent>
                            )}
                        </Tabs>
                    )}

                    {/* ─── Shared: SLA + Owner (Visible for all node types EXCEPT UserTask/Approval where it's moved to General Tab) ────────────────── */}
                    {!(isApproval || isUserTask || isFormula) && (
                        <>
                            <Card className="p-4 space-y-4">
                                <FormField label="SLA" hint="Time limit in days">
                                    <SlaInput
                                        value={(node.data.sla as number) || 0}
                                        onChange={(val) => updateNodeData(node.id, { sla: val })}
                                    />
                                </FormField>

                                <FormField label="Default Owner" hint="Who is responsible for this step">
                                    <PrincipalSelect
                                        value={stepOwner}
                                        onChange={handleOwnerChange}
                                        placeholder="Inherit from coordinator"
                                    />
                                    <p className="text-[11px] text-slate-400 italic mt-1">
                                        Leave empty to default to the request coordinator
                                    </p>
                                </FormField>
                            </Card>

                            <Card className="p-4 space-y-2">
                                <Label variant="section">Sync Trigger</Label>
                                <Select
                                    value={(node.data.syncTrigger as string) || 'NONE'}
                                    onValueChange={(val) => updateNodeData(node.id, { syncTrigger: val })}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">None (No sync)</SelectItem>
                                        <SelectItem value="IMMEDIATE">Immediate (Sync on save)</SelectItem>
                                        <SelectItem value="WITH_NEXT">With Next Step</SelectItem>
                                        <SelectItem value="ON_COMPLETE">On Complete (Final step)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-slate-400 italic">
                                    When to sync data to external systems (e.g., S/4HANA)
                                </p>
                            </Card>

                            <div className="space-y-2">
                                <Label variant="section">Predecessors</Label>
                                <Card className="p-2 max-h-52 overflow-y-auto">
                                    {potentialPredecessors.length === 0 ? (
                                        <p className="text-xs text-slate-400 p-2 italic text-center">No other steps available</p>
                                    ) : (
                                        potentialPredecessors.map(pred => (
                                            <PredecessorItem
                                                key={pred.id}
                                                label={pred.data.label as string}
                                                isSelected={edges.some(e => e.source === pred.id && e.target === node.id)}
                                                onToggle={(sel) => handlePredecessorToggle(pred.id, sel)}
                                            />
                                        ))
                                    )}
                                </Card>
                            </div>
                        </>
                    )}

                </>
            )}

            {/* ── CONDITION NODE ──────────────────────────────── */}
            {nodeType === 'conditionNode' && (
                <Card className="p-4 space-y-4">
                    <Label variant="section">Condition Logic</Label>

                    <Button
                        variant="outline"
                        onClick={() => setIsConditionEditorOpen(true)}
                        className="w-full gap-2 font-semibold h-12 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 rounded-xl"
                    >
                        <GitBranch size={16} />
                        Edit Condition Rules
                    </Button>

                    {node.data.conditionLogic ? (
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600">
                            <strong>Configured:</strong> {`${((node.data.conditionLogic as any).rules?.length) || 0}`} rule(s)
                            <br />
                            <span className="text-[10px] text-slate-400">Match type: {`${(node.data.conditionLogic as any).matchType || 'AND'}`}</span>
                        </div>
                    ) : null}

                    <ConditionEditorDialog
                        open={isConditionEditorOpen}
                        onOpenChange={setIsConditionEditorOpen}
                        initialLogic={node.data.conditionLogic as ConditionLogic | null}
                        availableFields={availableSources}
                        onSave={(logic) => updateNodeData(node.id, { conditionLogic: logic })}
                    />
                </Card>
            )}


            {/* ── END NODE ────────────────────────────────────── */}
            {nodeType === 'endNode' && (
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <p className="text-xs">This marks the end of the workflow.</p>
                    </div>
                </Card>
            )}

            {/* Delete Node Button (not for start) */}
            {nodeType !== 'startNode' && (
                <div className="pt-4 mt-4 border-t border-slate-100">
                    <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        variant="outline-destructive"
                        className="w-full"
                    >
                        <Trash2 size={16} />
                        Delete Node
                    </Button>
                </div>
            )}


            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Node"
                message="Are you sure you want to delete this node? All connections will also be removed."
                confirmLabel="Delete Node"
                variant="danger"
                onConfirm={() => {
                    deleteStep(node.id);
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
