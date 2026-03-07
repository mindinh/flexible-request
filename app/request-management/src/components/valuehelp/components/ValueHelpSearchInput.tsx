/**
 * ValueHelpSearchInput.tsx
 * Token-based input with embedded Copy (Value Help) icon.
 */
import React, { useState } from 'react';
import { Copy, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import SearchHelpDialog from './SearchHelpDialog';
import type { ValueHelpBaseProps, WithBatchUpdate, ReturnMapping } from '../types';

type Props = ValueHelpBaseProps & WithBatchUpdate;

export default function ValueHelpSearchInput({
    objectType,
    valueHelpID,
    value,
    onChange,
    baseUrl,
    dependsOnValue,
    disabled,
    placeholder,
    onBatchFieldUpdate,
    className,
}: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleOpen = () => {
        if (disabled) return;
        setIsLoading(true);
        setDialogOpen(true);
        setTimeout(() => setIsLoading(false), 600);
    };

    const handleSelect = (row: Record<string, any>, mapping: ReturnMapping[]) => {
        const returnValue = row._returnValue ?? '';
        onChange?.(returnValue);
        if (onBatchFieldUpdate && mapping) {
            const updates: Record<string, any> = {};
            for (const m of mapping) {
                if (row[m.sourceColumn] !== undefined) {
                    updates[m.targetField] = row[m.sourceColumn];
                }
            }
            if (Object.keys(updates).length > 0) {
                onBatchFieldUpdate(updates);
            }
        }
        setDialogOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onChange?.('');
    };

    return (
        <>
            <div
                className={cn(
                    "min-h-8 w-full flex items-center gap-1 px-2 py-1 border-2 rounded-md bg-card cursor-pointer transition-all",
                    "hover:border-[var(--input-border-hover)]",
                    "focus-within:border-2 focus-within:border-[var(--color-brand)]",
                    disabled && "bg-muted text-muted-foreground cursor-not-allowed",
                    className,
                )}
                onClick={handleOpen}
            >
                <div
                    className="flex-1 flex items-center gap-1 min-h-[20px] overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    onWheel={(e) => {
                        e.currentTarget.scrollLeft += e.deltaY;
                    }}
                >
                    {value ? (
                        <span className={cn("text-sm truncate", disabled ? "text-muted-foreground" : "text-foreground")} title={value}>{value}</span>
                    ) : (
                        <span className="text-muted-foreground text-sm">{placeholder || ''}</span>
                    )}
                </div>

                {value && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 shrink-0"
                        onClick={handleClear}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                    >
                        <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                )}

                {isLoading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                ) : (
                    <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
            </div>

            {dialogOpen && (
                <SearchHelpDialog
                    objectType={objectType}
                    valueHelpID={valueHelpID}
                    dependsOnValue={dependsOnValue}
                    baseUrl={baseUrl}
                    onSelect={handleSelect}
                    onClose={() => setDialogOpen(false)}
                />
            )}
        </>
    );
}
