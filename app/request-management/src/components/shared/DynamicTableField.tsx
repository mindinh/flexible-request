import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/TextArea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
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
    selectedIds = [],
    onSelectionChange
}: DynamicTableFieldProps) {
    const rows = Array.isArray(value) ? value : [];
    const hasSelection = !!onSelectionChange;

    const handleRowSelection = (rowId: string, checked: boolean) => {
        if (!onSelectionChange) return;

        if (checked) {
            onSelectionChange([...selectedIds, rowId]);
        } else {
            onSelectionChange(selectedIds.filter(id => id !== rowId));
        }
    };

    const addRow = () => {
        const newRow: TableRow = {
            id: `row-${Date.now()}`,
        };
        // Initialize with empty values for each column
        columns.forEach(col => {
            newRow[col.id] = '';
        });
        onChange([...rows, newRow]);
    };

    const deleteRow = (rowId: string) => {
        onChange(rows.filter(row => row.id !== rowId));
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

    const renderCellInput = (column: SchemaField, row: TableRow) => {
        const cellValue = row[column.id] ?? '';
        const controlType = column.controlType || (column as any).type || 'text';
        const isDisabled = disabled || !!(column as any).readOnly || !!(column as any).disabled;

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
        <div className="w-full space-y-2">
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-max text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                        <tr>
                            {hasSelection && (
                                <th className="w-12 px-2 py-2 text-center">
                                    <div className="flex justify-center">
                                        <input
                                            type="checkbox"
                                            style={{ accentColor: 'var(--primary)' }}
                                            checked={rows.length > 0 && selectedIds.length === rows.length}
                                            onChange={(e) => {
                                                if (!onSelectionChange) return;
                                                if (e.target.checked) {
                                                    onSelectionChange(rows.map(r => r.id));
                                                } else {
                                                    onSelectionChange([]);
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 focus:ring-primary"
                                        />
                                    </div>
                                </th>
                            )}
                            {columns.map(col => (
                                <th
                                    key={col.id}
                                    className="px-3 py-2 border-r border-slate-200 last:border-r-0 whitespace-nowrap"
                                >
                                    {col.label}
                                    {col.required && <span className="text-destructive ml-1">*</span>}
                                </th>
                            ))}
                            {!disabled && <th className="w-12 px-2 py-2"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (hasSelection ? 1 : 0) + (!disabled ? 1 : 0)}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    No rows added yet. Click "Add Row" to start.
                                </td>
                            </tr>
                        ) : (
                            rows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    {hasSelection && (
                                        <td className="px-2 py-1.5 align-middle">
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    style={{ accentColor: 'var(--primary)' }}
                                                    checked={selectedIds.includes(row.id)}
                                                    onChange={(e) => handleRowSelection(row.id, e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 focus:ring-primary"
                                                />
                                            </div>
                                        </td>
                                    )}
                                    {columns.map(col => (
                                        <td
                                            key={col.id}
                                            className="px-2 py-1.5 border-r border-slate-100 last:border-r-0 align-top"
                                        >
                                            {renderCellInput(col, row)}
                                        </td>
                                    ))}
                                    {!disabled && (
                                        <td className="px-2 py-1.5 text-center align-middle">
                                            <Button
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

            {/* Add Row Button */}
            {!disabled && !hideAddButton && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                >
                    <Plus size={14} className="mr-1" />
                    Add Row
                </Button>
            )}
        </div>
    );
}
