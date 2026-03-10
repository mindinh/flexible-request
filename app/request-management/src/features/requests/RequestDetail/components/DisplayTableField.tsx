import { Download } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import type { SchemaField } from '../../../../lib/schemaParser';

interface TableRow {
    id: string;
    [key: string]: any;
}

interface DisplayTableFieldProps {
    columns: SchemaField[];
    rows: TableRow[];
}

/**
 * Read-only table display component for viewing table data in request details
 * Includes a download button for CSV export
 */
export function DisplayTableField({ columns, rows }: DisplayTableFieldProps) {
    if (!rows || rows.length === 0) {
        return <p className="text-slate-400 italic text-sm">No data provided</p>;
    }

    const formatCellValue = (column: SchemaField, value: any): string => {
        if (value === undefined || value === null || value === '') {
            return '-';
        }

        const controlType = column.controlType || column.type || 'text';

        switch (controlType) {
            case 'date':
                try {
                    return new Date(value).toLocaleDateString();
                } catch {
                    return String(value);
                }
            case 'checkbox':
                return value ? 'Yes' : 'No';
            default:
                return String(value);
        }
    };

    const handleDownloadCsv = () => {
        // Build CSV content
        const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
        const csvRows = rows.map(row =>
            columns.map(col => {
                const rawValue = row[col.id] ?? '';
                const val = String(rawValue).replace(/"/g, '""');
                return `"${val}"`;
            }).join(',')
        );
        const csvContent = [headers, ...csvRows].join('\n');

        // Trigger download
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `table_data_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCsv}
                    className="h-7 text-xs gap-1.5"
                >
                    <Download size={12} />
                    Download CSV
                </Button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {columns.map(col => (
                                <th
                                    key={col.id}
                                    className="px-3 py-2 text-left font-medium text-slate-700"
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row, rowIndex) => (
                            <tr key={row.id || rowIndex} className="hover:bg-slate-50">
                                {columns.map(col => (
                                    <td
                                        key={col.id}
                                        className="px-3 py-2 text-slate-900"
                                    >
                                        {formatCellValue(col, row[col.id])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
