import { useStudioStore } from './useStudioStore';
import type { UiSection, UiFormField, UiTableField } from './types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/TextArea';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Layers, ArrowLeft, Send, Save, Trash2, Plus, Download, Upload, Copy } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Field Renderer for Preview ───
export function PreviewField({ field, value, onChange }: { field: UiFormField, value?: any, onChange?: (val: any) => void }) {
    const colSpanClass = (() => {
        const raw = (field.colSpan as number) || 6;
        const span = raw === 1 ? 6 : raw === 2 ? 12 : raw;
        const map: Record<number, string> = { 3: 'col-span-3', 6: 'col-span-6', 9: 'col-span-9', 12: 'col-span-12' };
        return map[span] || 'col-span-6';
    })();

    const renderControl = () => {
        switch (field.type) {
            case 'text':
            case 'number':
                return <Input type={field.type} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />;
            case 'email':
                return <Input type="email" placeholder={field.placeholder || 'email@example.com'} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />;
            case 'phone':
                return <Input type="tel" placeholder={field.placeholder || '+1 (555) 000-0000'} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />;
            case 'currency':
                return (
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <Input className="pl-7" placeholder={field.placeholder || '0.00'} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />
                    </div>
                );
            case 'date':
                return (
                    <div className="relative">
                        <Input type="date" placeholder={field.placeholder || 'mm/dd/yyyy'} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />
                    </div>
                );
            case 'select':
                return (
                    <Select value={value} onValueChange={onChange}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}...`} />
                        </SelectTrigger>
                        <SelectContent />
                    </Select>
                );
            case 'textarea':
                return (
                    <Textarea
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                        className="min-h-[100px] resize-y"
                        value={value || ''}
                        onChange={e => onChange && onChange(e.target.value)}
                    />
                );
            case 'checkbox':
                return (
                    <div className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                        <span className="text-sm text-slate-600">{field.placeholder || field.label}</span>
                    </div>
                );
            case 'radio':
                return (
                    <div className="flex flex-col gap-2">
                        {(field.valueHelp?.items || [{ key: '1', label: 'Option 1' }, { key: '2', label: 'Option 2' }]).map((opt, i) => (
                            <label key={i} className="flex items-center gap-2">
                                <input type="radio" name={field.id} className="w-4 h-4 text-primary" />
                                <span className="text-sm text-slate-600">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'file':
                return (
                    <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:border-primary/50 transition-colors">
                        <Layers size={18} className="text-slate-400" />
                        <span className="text-sm text-slate-500">{field.placeholder || 'Click to upload or drag file'}</span>
                    </div>
                );
            case 'slider':
                return (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">0</span>
                        <input type="range" min={0} max={100} defaultValue={50} className="flex-1 accent-primary" />
                        <span className="text-xs text-slate-400">100</span>
                    </div>
                );
            default:
                return <Input placeholder={`Enter ${field.label.toLowerCase()}...`} />;
        }
    };

    return (
        <div className={colSpanClass}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderControl()}
            {field.helpText && (
                <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
            )}
        </div>
    );
}

// ─── Section Renderer ───
export function PreviewSection({ section, values, onChange }: { section: UiSection, values?: Record<string, any>, onChange?: (id: string, val: any) => void }) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layers size={16} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{section.label}</h2>
            </div>
            <div className="grid grid-cols-12 gap-x-6 gap-y-5">
                {section.fields.map(field => (
                    <PreviewField key={field.id} field={field} value={values?.[field.id]} onChange={val => onChange?.(field.id, val)} />
                ))}
            </div>
        </div>
    );
}

// ─── Table Renderer ───
export function PreviewTable({ table }: { table: UiTableField }) {
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Layers size={16} className="text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">{table.label}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {table.headerActions?.downloadTemplate && (
                        <Button variant="outline" size="sm" className="text-slate-600 gap-1.5 text-xs">
                            <Download size={13} />
                            Template
                        </Button>
                    )}
                    {table.headerActions?.uploadExcel && (
                        <Button variant="outline" size="sm" className="text-slate-600 gap-1.5 text-xs">
                            <Upload size={13} />
                            Upload
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/5 gap-1">
                        <Plus size={14} />
                        Add Row
                    </Button>
                </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50">
                                {/* Checkbox column */}
                                <th className="p-3 border-b border-slate-200 w-[44px]">
                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary" />
                                </th>
                                {/* # column */}
                                <th className="p-3 text-left border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[44px]">
                                    #
                                </th>
                                {table.columns.map(col => (
                                    <th key={col.id} className="p-3 text-left border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {col.label}
                                        {col.required && <span className="text-red-500 ml-0.5">*</span>}
                                    </th>
                                ))}
                                <th className="p-3 text-center border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[120px]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3].map(row => (
                                <tr key={row} className="border-b border-slate-100 last:border-none hover:bg-slate-50/50 transition-colors">
                                    {/* Checkbox */}
                                    <td className="p-3">
                                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary" />
                                    </td>
                                    {/* Row number */}
                                    <td className="p-3 text-xs text-slate-400 font-mono">
                                        {row}
                                    </td>
                                    {table.columns.map(col => (
                                        <td key={col.id} className="p-2">
                                            {col.type === 'select' ? (
                                                <select className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-400">
                                                    <option>{`Select ${col.label.toLowerCase()}...`}</option>
                                                </select>
                                            ) : col.type === 'checkbox' ? (
                                                <div className="flex justify-center">
                                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                                                </div>
                                            ) : col.type === 'date' ? (
                                                <input type="date" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md text-slate-400" />
                                            ) : (
                                                <input
                                                    type={col.type === 'number' || col.type === 'currency' ? 'number' : 'text'}
                                                    placeholder={col.type === 'number' || col.type === 'currency' ? '0' : `${col.label}...`}
                                                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md placeholder:text-slate-300 focus:outline-none focus:border-primary/50"
                                                />
                                            )}
                                        </td>
                                    ))}
                                    {/* Actions: Duplicate + Delete */}
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-colors" title="Duplicate row">
                                                <Copy size={14} />
                                            </button>
                                            <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete row">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Main Form Preview Tab ───
export function FormPreviewTab() {
    const { schema, schemaName, metadata, setIsPreviewOpen } = useStudioStore();

    return (
        <motion.div
            className="flex h-full w-full bg-slate-100 overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex-1 p-6 overflow-y-auto flex justify-center">
                <div className="w-full max-w-[900px]">
                    {/* Preview Header */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-semibold text-xs px-2.5 py-0.5">
                                DRAFT MODE
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsPreviewOpen(false)}
                                className="gap-1.5"
                            >
                                <ArrowLeft size={14} />
                                Back to Editor
                            </Button>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">
                            Form Preview: {schemaName || metadata?.name || 'Untitled Form'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            Review how your form will appear to end users before deploying to production.
                        </p>
                    </div>

                    {/* Rendered Form */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                        {schema.length === 0 ? (
                            <div className="text-center py-16">
                                <Layers size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Fields Defined</h3>
                                <p className="text-sm text-slate-500">
                                    Add fields in the Schema Definition tab to see a preview here.
                                </p>
                            </div>
                        ) : (
                            <>
                                {schema.map(item => {
                                    if (item.type === 'section') {
                                        return <PreviewSection key={item.id} section={item as UiSection} />;
                                    } else if (item.type === 'table') {
                                        return <PreviewTable key={item.id} table={item as UiTableField} />;
                                    } else {
                                        return (
                                            <div key={item.id} className="mb-5">
                                                <PreviewField field={item as UiFormField} />
                                            </div>
                                        );
                                    }
                                })}
                            </>
                        )}
                    </div>

                    {/* Footer with action buttons */}
                    {schema.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6 flex items-center justify-end gap-4">
                            <Button variant="outline" disabled className="gap-1.5">
                                <Save size={14} />
                                Save as Draft
                            </Button>
                            <Button disabled className="bg-primary hover:bg-primary/90 text-white gap-1.5">
                                <Send size={14} />
                                Submit Request
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
