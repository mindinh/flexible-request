import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Download, Upload, Trash2, Plus, Copy } from 'lucide-react';
import { Card, Button } from '../../../../components/ui';
import * as XLSX from 'xlsx';
import { DynamicField } from '../../../../components/shared/DynamicField';
import { DynamicTableField } from '../../../../components/shared/DynamicTableField';
import type { SchemaItem, SchemaField, SchemaSection, SchemaTable } from '../../../../lib/schemaParser';
import { flattenSchemaFields } from '../../../../lib/schemaParser';
import type { FormData, FieldValue } from '../../../../types';
import { globalEvents, EVENT_TYPES } from '../../../../lib/events';

interface DynamicFormSectionProps {
    schemaItems: SchemaItem[];
    formData: FormData;
    onFieldChange: (fieldId: string, value: FieldValue) => void;
    isEditMode?: boolean;
}

const handleDownloadTemplate = (table: SchemaTable) => {
    // Create headers from columns
    const headers = table.columns.map(c => c.label || 'Column');

    // Create a workbook with a single sheet
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    // Download
    XLSX.writeFile(wb, `${table.label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.xlsx`);
};

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
    // Track selected rows for each table
    const [rowSelections, setRowSelections] = useState<Record<string, string[]>>({});

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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, table: SchemaTable) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const arrayBuffer = evt.target?.result;
            if (!arrayBuffer) return;

            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Get data with headers
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

            // Validate headers
            if (data.length > 0) {
                const firstRow = data[0];
                const excelHeaders = Object.keys(firstRow);
                const tableHeaders = table.columns.map(c => c.label);

                // Check for at least one matching column
                const hasMatchingColumns = excelHeaders.some(header => tableHeaders.includes(header));
                if (!hasMatchingColumns) {
                    globalEvents.emit(EVENT_TYPES.API_ERROR, 'Invalid template. No matching columns found.');
                    e.target.value = '';
                    return;
                }

                // Check if all required table columns exist in Excel
                const missingColumns = table.columns
                    .filter(col => col.required && !excelHeaders.includes(col.label))
                    .map(col => col.label);

                if (missingColumns.length > 0) {
                    globalEvents.emit(EVENT_TYPES.API_ERROR, `Missing required columns: ${missingColumns.join(', ')}`);
                    e.target.value = '';
                    return;
                }
            }

            // Map data to table format
            const tableData = data.map((row, index) => {
                const newRow: Record<string, unknown> = {
                    id: `upload-${Date.now()}-${index}`
                };
                let hasData = false;

                table.columns.forEach(col => {
                    // Match by label as used in template
                    const header = col.label || 'Column';
                    const value = row[header];

                    // Only map if value matches logic (not undefined/null)
                    if (value !== undefined && value !== null && String(value).trim() !== '') {
                        newRow[col.id] = value;
                        hasData = true;
                    }
                });

                return hasData ? newRow : null;
            }).filter((row): row is Record<string, unknown> => row !== null);

            if (tableData.length === 0) {
                globalEvents.emit(EVENT_TYPES.API_ERROR, 'No valid data found to import.');
                e.target.value = '';
                return;
            }

            const uploadDataKey = table.bindTo || table.id;
            const currentRows = (formData[uploadDataKey] as unknown[]) || [];
            onFieldChange(uploadDataKey, [...currentRows, ...tableData]);
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, 'Table data uploaded successfully');

            // Reset input
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

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
                            <Card className="overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-slate-800">
                                            {table.label}
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            {/* Add Row Button */}
                                            {!table.readOnly && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs bg-white hover:bg-slate-50"
                                                onClick={() => {
                                                    const currentRows = (formData[dataKey] as any[]) || [];
                                                    const newRow: any = {
                                                        id: `row-${Date.now()}`,
                                                    };
                                                    table.columns.forEach(col => {
                                                        newRow[col.id] = '';
                                                    });
                                                    onFieldChange(dataKey, [...currentRows, newRow]);
                                                }}
                                            >
                                                <Plus size={14} className="mr-2" />
                                                Add Row
                                            </Button>
                                            )}

                                            {/* Duplicate Button */}
                                            {!table.readOnly && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs bg-white hover:bg-slate-50"
                                                disabled={!rowSelections[table.id]?.length}
                                                onClick={() => {
                                                    const currentRows = (formData[dataKey] as any[]) || [];
                                                    const selectedIds = rowSelections[table.id] || [];
                                                    const rowsToDuplicate = currentRows.filter((r: any) => selectedIds.includes(r.id));

                                                    const newRows = rowsToDuplicate.map((row, index) => ({
                                                        ...row,
                                                        id: `row-${Date.now()}-copy-${index}`
                                                    }));

                                                    onFieldChange(dataKey, [...currentRows, ...newRows]);
                                                    setRowSelections({ ...rowSelections, [table.id]: [] });
                                                }}
                                            >
                                                <Copy size={14} className="mr-2" />
                                                Duplicate
                                            </Button>
                                            )}

                                            {/* Download Template — always visible */}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs bg-white hover:bg-slate-50"
                                                    onClick={() => handleDownloadTemplate(table)}
                                                >
                                                    <Download size={14} className="mr-2" />
                                                    Download
                                                </Button>

                                            {/* Upload Excel */}
                                            {!table.readOnly && table.headerActions?.uploadExcel && (
                                                <>
                                                    <input
                                                        type="file"
                                                        id={`upload-${table.id}`}
                                                        className="hidden"
                                                        accept=".xlsx, .xls"
                                                        onChange={(e) => handleFileUpload(e, table)}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs bg-white hover:bg-slate-50"
                                                        onClick={() => document.getElementById(`upload-${table.id}`)?.click()}
                                                    >
                                                        <Upload size={14} className="mr-2" />
                                                        Upload
                                                    </Button>
                                                </>
                                            )}

                                            {/* Delete Selected */}
                                            {!table.readOnly && (
                                            <Button
                                                type="button"
                                                variant="outline-destructive"
                                                size="sm"
                                                className="h-8 text-xs bg-white hover:bg-red-50"
                                                disabled={!rowSelections[table.id]?.length}
                                                onClick={() => {
                                                    const currentRows = (formData[dataKey] as any[]) || [];
                                                    const selectedIds = rowSelections[table.id] || [];
                                                    const remainingRows = currentRows.filter((r: any) => !selectedIds.includes(r.id));
                                                    onFieldChange(dataKey, remainingRows);
                                                    setRowSelections({ ...rowSelections, [table.id]: [] });
                                                }}
                                            >
                                                <Trash2 size={14} className="mr-2" />
                                                Delete
                                            </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
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
                                        hideAddButton={true}
                                        selectedIds={rowSelections[table.id] || []}
                                        onSelectionChange={!table.readOnly ? (ids) => setRowSelections({ ...rowSelections, [table.id]: ids }) : undefined}
                                    />
                                </div>
                            </Card>
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
