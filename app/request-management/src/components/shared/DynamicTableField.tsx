import React, { useState } from 'react';
import { Plus, Trash2, Download, Upload, Copy } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/TextArea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { DynamicField } from './DynamicField';
import type { SchemaField } from '../../lib/schemaParser';

interface TableRow {
    id: string;
    [key: string]: any;
}

interface DynamicTableFieldProps {
    tableId: string;
    label: string;
    columns: SchemaField[];
    value: TableRow[];
    onChange: (rows: TableRow[]) => void;
    disabled?: boolean;
    hideAddButton?: boolean;
    selectedIds?: string[];
    onSelectionChange?: (ids: string[]) => void;
    headerActions?: {
        downloadTemplate?: boolean;
        uploadExcel?: boolean;
    };
}

/**
 * DynamicTableField - Renders an editable table based on column definitions
 * Used for table-type fields in dynamic forms
 */
export function DynamicTableField({
    tableId,
    label,
    columns,
    value = [],
    onChange,
    disabled = false,
    hideAddButton = false,
    selectedIds: externalSelectedIds,
    onSelectionChange: externalOnSelectionChange,
    headerActions
}: DynamicTableFieldProps) {
    const rows = Array.isArray(value) ? value : [];

    // Internal selection state (used when no external selection is provided)
    const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
    const selectedIds = externalSelectedIds ?? internalSelectedIds;
    const onSelectionChange = externalOnSelectionChange ?? setInternalSelectedIds;

    const handleRowSelection = (rowId: string, checked: boolean) => {
        if (checked) {
            onSelectionChange([...selectedIds, rowId]);
        } else {
            onSelectionChange(selectedIds.filter(id => id !== rowId));
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(rows.map(r => r.id));
        } else {
            onSelectionChange([]);
        }
    };

    const addRow = () => {
        const newRow: TableRow = { id: `row-${Date.now()}` };
        columns.forEach(col => { newRow[col.id] = ''; });
        onChange([...rows, newRow]);
    };

    const deleteRow = (rowId: string) => {
        onChange(rows.filter(row => row.id !== rowId));
        onSelectionChange(selectedIds.filter(id => id !== rowId));
    };

    const deleteSelectedRows = () => {
        if (selectedIds.length === 0) return;
        onChange(rows.filter(row => !selectedIds.includes(row.id)));
        onSelectionChange([]);
    };

    const duplicateSelectedRows = () => {
        if (selectedIds.length === 0) return;
        const toDuplicate = rows.filter(row => selectedIds.includes(row.id));
        const duplicated = toDuplicate.map((row, i) => ({
            ...row,
            id: `row-${Date.now()}-dup-${i}`,
        }));
        onChange([...rows, ...duplicated]);
        onSelectionChange([]);
    };

    const updateCell = (rowId: string, columnId: string, cellValue: any) => {
        const updatedRows = rows.map(row => {
            if (row.id === rowId) {
                return { ...row, [columnId]: cellValue };
            }
            return row;
        });
        onChange(updatedRows);
    };

    const handleDownloadCsv = () => {
        const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"` ).join(',');
        const csvRows = rows.map(row =>
            columns.map(col => {
                const rawValue = row[col.id] ?? '';
                const val = String(rawValue).replace(/"/g, '""');
                return `"${val}"`;
            }).join(',')
        );
        const csvContent = [headers, ...csvRows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${label || 'table'}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadTemplate = () => {
        const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
        const csvContent = headers + '\n';
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${label || 'table'}_template.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;
            const parseCSVLine = (line: string): string[] => {
                const result: string[] = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                        else { inQuotes = !inQuotes; }
                    } else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else { current += char; }
                }
                result.push(current.trim());
                return result;
            };
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) return;
            const headers = parseCSVLine(lines[0]);
            const headerToColId: Record<number, string> = {};
            headers.forEach((h, idx) => {
                const match = columns.find(c => c.label.toLowerCase().trim() === h.toLowerCase().trim());
                if (match) headerToColId[idx] = match.id;
            });
            const newRows: TableRow[] = [];
            for (let i = 1; i < lines.length; i++) {
                const vals = parseCSVLine(lines[i]);
                if (vals.every(v => !v)) continue;
                const row: TableRow = { id: `row-${Date.now()}-${i}` };
                columns.forEach(col => { row[col.id] = ''; });
                vals.forEach((val, idx) => {
                    const colId = headerToColId[idx];
                    if (colId) row[colId] = val;
                });
                newRows.push(row);
            }
            if (newRows.length > 0) onChange([...rows, ...newRows]);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const renderCellInput = (column: SchemaField, row: TableRow) => {
        const cellValue = row[column.id] ?? '';
        const controlType = column.controlType || (column as any).type || 'text';
        const isDisabled = disabled || !!(column as any).readOnly || !!(column as any).disabled;

        // Delegate to DynamicField when column has value help config
        if (column.valueHelp?.type === 'Reference' && column.valueHelp?.listCode && column.valueHelp?.objectType) {
            return (
                <DynamicField
                    field={column as any}
                    value={cellValue}
                    onChange={(val) => updateCell(row.id, column.id, val)}
                    disabled={isDisabled}
                />
            );
        }

        switch (controlType) {
            case 'number':
                return (
                    <Input
                        type="number"
                        value={cellValue}
                        onChange={(e) => updateCell(row.id, column.id, e.target.value ? Number(e.target.value) : '')}
                        placeholder={column.placeholder || '0'}
                        disabled={isDisabled}
                        className="h-8 text-sm"
                    />
                );
            case 'date':
                return (
                    <div className="h-8">
                        <Input
                            type="date"
                            value={cellValue}
                            onChange={(e) => updateCell(row.id, column.id, e.target.value)}
                            disabled={isDisabled}
                            className="h-8 text-sm w-full"
                        />
                    </div>
                );
            case 'select':
                return (
                    <Select
                        value={cellValue}
                        onValueChange={(val) => updateCell(row.id, column.id, val)}
                        disabled={isDisabled}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={`Select...`} />
                        </SelectTrigger>
                        <SelectContent>
                            {column.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            )) || (
                                    <>
                                        <SelectItem value="option1">Option 1</SelectItem>
                                        <SelectItem value="option2">Option 2</SelectItem>
                                    </>
                                )}
                        </SelectContent>
                    </Select>
                );
            case 'textarea':
                return (
                    <Textarea
                        value={cellValue}
                        onChange={(e) => updateCell(row.id, column.id, e.target.value)}
                        placeholder={column.placeholder || ''}
                        disabled={isDisabled}
                        rows={2}
                        className="text-sm resize-none"
                    />
                );
            default:
                return (
                    <Input
                        type="text"
                        value={cellValue}
                        onChange={(e) => updateCell(row.id, column.id, e.target.value)}
                        placeholder={column.placeholder || ''}
                        disabled={isDisabled}
                        className="h-8 text-sm"
                    />
                );
        }
    };

    return (
        <div className="w-full border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            {/* ─── Header: Label + Action Buttons ─── */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <h4 className="text-sm font-semibold text-slate-800 whitespace-nowrap">{label}</h4>

                {!disabled && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {!hideAddButton && (
                            <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs gap-1.5 bg-white">
                                <Plus size={12} />
                                Add Row
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={duplicateSelectedRows}
                            disabled={selectedIds.length === 0}
                            className="h-7 text-xs gap-1.5 bg-white"
                        >
                            <Copy size={12} />
                            Duplicate
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={headerActions?.downloadTemplate ? handleDownloadTemplate : handleDownloadCsv}
                            disabled={rows.length === 0 && !headerActions?.downloadTemplate}
                            className="h-7 text-xs gap-1.5 bg-white"
                        >
                            <Download size={12} />
                            Download
                        </Button>
                        {headerActions?.uploadExcel && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 bg-white relative" asChild>
                                <label className="cursor-pointer">
                                    <Upload size={12} />
                                    Upload
                                    <input type="file" accept=".csv" onChange={handleUploadCsv} className="sr-only" />
                                </label>
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={deleteSelectedRows}
                            disabled={selectedIds.length === 0}
                            className="h-7 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 bg-white"
                        >
                            <Trash2 size={12} />
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            {/* ─── Table ─── */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm text-left">
                    <thead className="bg-slate-50/80 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                            {!disabled && (
                                <th className="w-10 px-3 py-2.5 text-center">
                                    <input
                                        type="checkbox"
                                        style={{ accentColor: 'var(--primary)' }}
                                        checked={rows.length > 0 && selectedIds.length === rows.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-slate-300"
                                    />
                                </th>
                            )}
                            {columns.map(col => (
                                <th
                                    key={col.id}
                                    className="px-3 py-2.5 border-r border-slate-100 last:border-r-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider"
                                >
                                    {col.label}
                                    {col.required && <span className="text-destructive ml-1">*</span>}
                                </th>
                            ))}
                            {!disabled && <th className="w-10 px-2 py-2.5"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (!disabled ? 2 : 0)}
                                    className="px-4 py-10 text-center text-slate-400 text-sm"
                                >
                                    No rows added yet. Click "Add Row" to start.
                                </td>
                            </tr>
                        ) : (
                            rows.map(row => (
                                <tr
                                    key={row.id}
                                    className={`hover:bg-slate-50/80 transition-colors ${selectedIds.includes(row.id) ? 'bg-primary/5' : ''}`}
                                >
                                    {!disabled && (
                                        <td className="px-3 py-1.5 align-middle">
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    style={{ accentColor: 'var(--primary)' }}
                                                    checked={selectedIds.includes(row.id)}
                                                    onChange={(e) => handleRowSelection(row.id, e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded border-slate-300"
                                                />
                                            </div>
                                        </td>
                                    )}
                                    {columns.map(col => (
                                        <td
                                            key={col.id}
                                            className="px-2 py-1.5 border-r border-slate-50 last:border-r-0 align-top"
                                        >
                                            {renderCellInput(col, row)}
                                        </td>
                                    ))}
                                    {!disabled && (
                                        <td className="px-2 py-1.5 text-center align-middle">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                onClick={() => deleteRow(row.id)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
