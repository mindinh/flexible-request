/**
 * ValueHelpSelect.tsx
 * Standard select dropdown for F4 Value Help entries.
 */
import React, { useMemo } from 'react';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useValueHelp } from '../hooks/useValueHelp';
import type { ValueHelpBaseProps, WithBatchUpdate } from '../types';

/** Sentinel value for the "clear" option — Radix Select requires non-empty strings */
const EMPTY_SENTINEL = '__EMPTY__';

type Props = ValueHelpBaseProps & WithBatchUpdate;

export default function ValueHelpSelect({
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
    const { entries, loading, handleSelection } = useValueHelp({
        objectType,
        valueHelpID,
        baseUrl,
        dependsOnValue,
    });

    const handleChange = (val: string) => {
        const actualVal = val === EMPTY_SENTINEL ? '' : val;
        onChange?.(actualVal);
        if (onBatchFieldUpdate && actualVal) {
            const updates = handleSelection(actualVal);
            if (Object.keys(updates).length > 0) {
                onBatchFieldUpdate(updates);
            }
        }
    };

    const normalizedEntries = useMemo(
        () => entries.map(e => ({ ...e, key: String(e.key) })),
        [entries],
    );

    const radixValue = value ? String(value) : EMPTY_SENTINEL;

    const selectedLabel = value
        ? normalizedEntries.find(e => e.key === String(value))?.text || String(value)
        : undefined;

    return (
        <Select
            value={radixValue}
            onValueChange={handleChange}
            disabled={disabled || loading}
        >
            <SelectTrigger
                className={cn(
                    'h-8 text-sm',
                    disabled && 'bg-muted text-muted-foreground',
                    !disabled && 'bg-card',
                    loading && !disabled && 'opacity-60',
                    className,
                )}
                title={selectedLabel || ''}
            >
                <SelectValue placeholder={placeholder || 'Select…'}>
                    {selectedLabel ? (
                        <span className="truncate block">{selectedLabel}</span>
                    ) : (
                        <span className="text-muted-foreground">
                            {placeholder || 'Select…'}
                        </span>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent style={{ width: 'var(--radix-select-trigger-width)' }}>
                <SelectItem value={EMPTY_SENTINEL} className="text-muted-foreground">
                    <span className="italic text-xs">Clear</span>
                </SelectItem>
                {normalizedEntries.map(entry => (
                    <SelectItem key={entry.key} value={entry.key}>
                        {entry.text || entry.key}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
