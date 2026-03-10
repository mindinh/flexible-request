import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Card } from '../../../../components/ui';

import { DynamicField } from '../../../../components/shared/DynamicField';
import { DynamicTableField } from '../../../../components/shared/DynamicTableField';
import type { SchemaItem, SchemaField, SchemaSection, SchemaTable } from '../../../../lib/schemaParser';
import { flattenSchemaFields } from '../../../../lib/schemaParser';
import type { FormData, FieldValue } from '../../../../types';


interface DynamicFormSectionProps {
    schemaItems: SchemaItem[];
    formData: FormData;
    onFieldChange: (fieldId: string, value: FieldValue) => void;
    isEditMode?: boolean;
}



/**
 * Dynamic form section that renders schema-based fields
 * Supports individual fields, sections with multiple fields, and tables
 */
export function DynamicFormSection({
    schemaItems,
    formData,
    onFieldChange,
    isEditMode = false
}: DynamicFormSectionProps) {

    // Seed formData with field defaultValues on mount
    // ONLY for new requests (not in edit/copy mode)
    useEffect(() => {
        if (isEditMode) return;

        const allFields = flattenSchemaFields(schemaItems);
        allFields.forEach(field => {
            if (field.defaultValue && !formData[field.id]) {
                onFieldChange(field.id, field.defaultValue);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schemaItems, isEditMode]);



    if (schemaItems.length === 0) {
        return (
            <Card className="p-8 text-center bg-slate-50 border-dashed">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700">No Additional Details Required</h3>
                <p className="text-slate-500 mt-2">This request type doesn't have any extra fields configured.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {schemaItems.map((item, index) => {
                // Handle section type
                if (item.type === 'section') {
                    const section = item as SchemaSection;
                    return (
                        <motion.div
                            key={section.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100">
                                    <h2 className="text-lg font-semibold text-slate-800">
                                        {section.label || section.title}
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <div className={`grid gap-4 ${section.columns === 1 ? 'grid-cols-1' : 'grid-cols-12'}`}>
                                        {section.fields?.map((field) => {
                                            // Map colSpan to 12-col grid (with legacy fallback)
                                            const raw = (field.colSpan as number) || 6;
                                            const span = raw === 1 ? 6 : raw === 2 ? 12 : raw;
                                            // Static map so Tailwind JIT can detect classes
                                            const spanMap: Record<number, string> = {
                                                3: 'col-span-12 md:col-span-3',
                                                6: 'col-span-12 md:col-span-6',
                                                9: 'col-span-12 md:col-span-9',
                                                12: 'col-span-12 md:col-span-12',
                                            };
                                            const spanClass = spanMap[span] || 'col-span-12 md:col-span-6';
                                            return (
                                                <div
                                                    key={field.id}
                                                    className={`min-w-0 ${spanClass} ${field.controlType === 'checkbox' ? 'flex items-center' : 'space-y-2'}`}
                                                >
                                                    {field.controlType !== 'checkbox' && (
                                                        <label className="block text-sm font-medium text-slate-700 truncate">
                                                            {field.label}
                                                            {field.required && !field.readOnly && <span className="text-destructive ml-1">*</span>}
                                                        </label>
                                                    )}
                                                    <DynamicField
                                                        field={field}
                                                        value={formData[field.id]}
                                                        onChange={(value) => { if (!field.readOnly) onFieldChange(field.id, value); }}
                                                        disabled={field.readOnly}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                }

                // Handle table type
                if (item.type === 'table') {
                    const table = item as SchemaTable;
                    // Use bindTo key if table is bound to a Data Schema list, otherwise fallback to table.id
                    const dataKey = table.bindTo || table.id;
                    return (
                        <motion.div
                            key={table.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <DynamicTableField
                                tableId={table.id}
                                label={table.label}
                                columns={table.columns.map(col => ({
                                    ...col,
                                    controlType: col.controlType || col.type || 'text'
                                }))}
                                value={(formData[dataKey] as any[]) || []}
                                onChange={(rows) => onFieldChange(dataKey, rows)}
                                disabled={!!table.readOnly}
                                headerActions={table.headerActions}
                            />
                        </motion.div>
                    );
                }

                // Handle standalone field
                const field = item as SchemaField;
                return (
                    <Card key={field.id} className="p-6">
                        <div className={field.controlType === 'checkbox' ? 'flex items-center' : 'space-y-2'}>
                            {field.controlType !== 'checkbox' && (
                                <label className="block text-sm font-medium text-slate-700">
                                    {field.label}
                                    {field.required && !field.readOnly && <span className="text-destructive ml-1">*</span>}
                                </label>
                            )}
                            <DynamicField
                                field={field}
                                value={formData[field.id]}
                                onChange={(value) => { if (!field.readOnly) onFieldChange(field.id, value); }}
                                disabled={field.readOnly}
                            />
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
