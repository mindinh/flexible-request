/**
 * SearchHelpDialog.tsx
 * Full F4 search dialog with filter form, result table, and scroll.
 * Opens as a modal with grey backdrop overlay.
 * Loads ALL results at once (no pagination).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { X, Loader2 } from 'lucide-react';
import { useSearchHelp } from '../hooks/useSearchHelp';
import type { SearchHelpDialogProps } from '../types';

export default function SearchHelpDialog({
    objectType,
    valueHelpID,
    dependsOnValue,
    baseUrl,
    onSelect,
    onClose,
}: SearchHelpDialogProps) {
    const { config, results, total, loading, error, search, returnMapping } = useSearchHelp({
        objectType,
        valueHelpID,
        baseUrl,
    });

    const [filters, setFilters] = useState<Record<string, string>>({});
    const filtersRef = useRef<Record<string, string>>({});
    const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    // Initial search on config load
    useEffect(() => {
        if (config) {
            const initialFilters: Record<string, string> = dependsOnValue
                ? { _dependsOn: dependsOnValue }
                : {};
            search(initialFilters);
            setTimeout(() => setInitialLoading(false), 400);
        }
    }, [config, dependsOnValue]);

    const handleFilterChange = (column: string, value: string) => {
        const next = { ...filtersRef.current, [column]: value };
        filtersRef.current = next;
        setFilters(next);
        setSelectedRow(null);
    };

    const handleSearch = () => {
        const activeFilters = { ...filtersRef.current };
        if (dependsOnValue) activeFilters._dependsOn = dependsOnValue;
        search(activeFilters);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleSelect = () => {
        if (!selectedRow || !config?.returnField) return;
        const rowWithReturn = {
            ...selectedRow,
            _returnValue: selectedRow[config.returnField],
        };
        onSelect(rowWithReturn, returnMapping);
    };

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Prevent body scroll when dialog is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const showLoading = initialLoading || (loading && results.length === 0);

    return (
        <>
            {/* Grey modal backdrop */}
            <div
                className="fixed inset-0 z-50"
                style={{ backgroundColor: 'rgba(107, 114, 128, 0.5)' }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-8">
                <div
                    className="flex w-[90%] max-w-[700px] max-h-[80vh] flex-col rounded-lg border bg-card shadow-2xl pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b px-5 py-3">
                        <h3 className="text-sm font-semibold text-foreground">
                            {config?.title || `Search: ${valueHelpID}`}
                        </h3>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={onClose}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    {/* Filter Form */}
                    {!showLoading && config?.searchFields && (
                        <div className="border-b px-5 py-4 space-y-3">
                            <div className="flex flex-wrap gap-4">
                                {config.searchFields.map(field => (
                                    <div key={field.column} className="flex-1 min-w-[150px] space-y-1">
                                        <label className="text-sm font-semibold text-foreground">
                                            {field.label || field.column}
                                        </label>
                                        <Input
                                            value={filters[field.column] || ''}
                                            onChange={(e) => handleFilterChange(field.column, e.target.value)}
                                            onKeyDown={handleInputKeyDown}
                                            placeholder={field.label || field.column}
                                            className="h-10 text-sm bg-card border-border hover:border-input transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSearch}
                                >
                                    Go
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="border-b bg-destructive/10 px-5 py-2 text-sm text-destructive">
                            ⚠ Failed to load results: {error}
                        </div>
                    )}

                    {/* Scrollable Content Area */}
                    <div className="relative overflow-y-auto" style={{ height: '55vh' }}>
                        {/* Loading overlay */}
                        {loading && !showLoading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="size-6 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground">Searching…</span>
                                </div>
                            </div>
                        )}
                        <div>
                            {showLoading ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                                    <Loader2 className="size-8 animate-spin text-primary/60" />
                                    <span className="text-sm">Loading data…</span>
                                </div>
                            ) : results.length === 0 ? (
                                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                                    No results found.
                                </div>
                            ) : (
                                <table className="w-full" style={{ tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr className="border-b bg-card sticky top-0 z-10">
                                            {config?.resultColumns?.map((col: any) => (
                                                <th
                                                    key={col.column}
                                                    style={col.width ? { width: col.width, minWidth: col.width } : {}}
                                                    className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate px-4 py-2"
                                                    title={col.label || col.column}
                                                >
                                                    {col.label || col.column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((row, idx) => (
                                            <tr
                                                key={idx}
                                                className={cn(
                                                    'cursor-pointer transition-colors border-b border-border/50',
                                                    selectedRow === row && 'bg-primary/10 hover:bg-primary/15',
                                                    selectedRow !== row && 'hover:bg-muted/50',
                                                )}
                                                onClick={() => setSelectedRow(row)}
                                                onDoubleClick={() => {
                                                    setSelectedRow(row);
                                                    const rowWithReturn = {
                                                        ...row,
                                                        _returnValue: row[config?.returnField || ''],
                                                    };
                                                    onSelect(rowWithReturn, returnMapping);
                                                }}
                                            >
                                                {config?.resultColumns?.map((col: any) => (
                                                    <td
                                                        key={col.column}
                                                        className="text-sm py-2 px-4 truncate"
                                                        style={col.width ? { maxWidth: col.width } : {}}
                                                        title={String(row[col.column] ?? '')}
                                                    >
                                                        {row[col.column] ?? ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Footer: Result count + Actions */}
                    <div className="flex items-center justify-between border-t px-5 py-3">
                        <span className="text-xs text-muted-foreground">
                            {results.length > 0
                                ? `${results.length} result${results.length > 1 ? 's' : ''}`
                                : ' '
                            }
                        </span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={!selectedRow}
                                onClick={handleSelect}
                            >
                                Select
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
