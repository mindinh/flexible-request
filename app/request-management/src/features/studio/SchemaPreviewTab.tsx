import { useStudioStore } from './useStudioStore';
import type { UiFormField, UiSection, UiTableField } from './types';
import { Layers } from 'lucide-react';

// Simple field preview renderer
function FieldPreview({ field }: { field: UiFormField }) {
    const baseClass = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-400';
    switch (field.type) {
        case 'textarea':
            return <textarea className={`${baseClass} resize-none`} rows={3} placeholder={`Enter ${field.label.toLowerCase()}...`} disabled />;
        case 'select':
        case 'dropdown':
            return (
                <select className={baseClass} disabled>
                    <option>Select {field.label.toLowerCase()}...</option>
                    {field.valueHelp?.items?.map((opt: any, i: number) => (
                        <option key={i}>{opt.label}</option>
                    ))}
                </select>
            );
        case 'checkbox':
            return (
                <div className="flex items-center gap-2">
                    <input type="checkbox" disabled className="rounded border-slate-300" />
                    <span className="text-sm text-slate-500">{field.label}</span>
                </div>
            );
        case 'date':
            return <input type="date" className={baseClass} disabled />;
        case 'number':
        case 'currency':
            return <input type="number" className={baseClass} placeholder={`Enter ${field.label.toLowerCase()}...`} disabled />;
        case 'slider':
            return <input type="range" className="w-full" disabled />;
        default:
            return <input type="text" className={baseClass} placeholder={`Enter ${field.label.toLowerCase()}...`} disabled />;
    }
}

interface SchemaPreviewTabProps {
    formId: string | null;
}

export function SchemaPreviewTab({ formId }: SchemaPreviewTabProps) {
    const { forms } = useStudioStore();

    const form = formId ? forms.find(f => f.id === formId) : (forms[0] || null);
    const items = form?.items || [];

    if (!form) {
        return (
            <div className="flex h-full w-full bg-slate-50 items-center justify-center">
                <div className="text-center">
                    <Layers size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Form to Preview</h3>
                    <p className="text-sm text-slate-500">Create a form first in the Form Schema tab</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-slate-50 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Preview Header */}
                <div className="px-8 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <Layers size={16} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">{form.name}</h2>
                            <p className="text-xs text-slate-500">{items.length} element{items.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                </div>

                {/* Preview Body */}
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    <div className="max-w-3xl mx-auto">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Layers size={40} className="text-slate-300 mb-3" />
                                <p className="text-slate-500">No form fields yet. Add elements from the palette.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                {items.map(item => {
                                    if (item.type === 'section') {
                                        const section = item as UiSection;
                                        return (
                                            <div key={section.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                                                <h4 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                                                    {section.label}
                                                </h4>
                                                <div className="grid grid-cols-12 gap-4">
                                                    {section.fields.map(field => (
                                                        <div key={field.id} className={`col-span-${field.colSpan || 6}`}>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                {field.label}
                                                                {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                                            </label>
                                                            <FieldPreview field={field} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    } else if (item.type === 'table') {
                                        const table = item as UiTableField;
                                        return (
                                            <div key={table.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                                    <h4 className="text-sm font-semibold text-slate-800">{table.label}</h4>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-50">
                                                            <tr>
                                                                {table.columns.map(col => (
                                                                    <th key={col.id} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                                                        {col.label}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr className="border-t border-slate-100">
                                                                {table.columns.map(col => (
                                                                    <td key={col.id} className="px-4 py-3">
                                                                        <FieldPreview field={col} />
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        const field = item as UiFormField;
                                        return (
                                            <div key={field.id}>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    {field.label}
                                                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                                </label>
                                                <FieldPreview field={field} />
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
