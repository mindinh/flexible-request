/**
 * ValueHelpComboBox.tsx
 * Input with dropdown suggestions for F4 Value Help entries.
 *
 * Uses React Portal to render the dropdown outside the DOM tree
 * so it is not clipped by parent overflow or table row stacking.
 *
 * Supports keyboard navigation: ArrowDown/ArrowUp to navigate,
 * Enter to select, Escape to close.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useValueHelp } from '../hooks/useValueHelp';
import type { ValueHelpBaseProps, WithBatchUpdate } from '../types';

type Props = ValueHelpBaseProps & WithBatchUpdate;

export default function ValueHelpComboBox({
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

    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    // Resolve value (key) to display text from entries
    useEffect(() => {
        if (!value) { setInputValue(''); return; }
        const match = entries.find(e => String(e.key) === String(value));
        setInputValue(match?.text || value);
    }, [value, entries]);

    // Position the dropdown relative to the input using getBoundingClientRect
    const updateDropdownPosition = useCallback(() => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        const dropdownMaxH = 200;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const spaceAbove = rect.top - gap;

        const showAbove = spaceBelow < dropdownMaxH && spaceAbove > spaceBelow;

        setDropdownStyle({
            position: 'fixed',
            ...(showAbove
                ? { bottom: window.innerHeight - rect.top + gap, top: 'auto' }
                : { top: rect.bottom + gap, bottom: 'auto' }),
            left: rect.left,
            width: rect.width,
            maxHeight: Math.min(dropdownMaxH, showAbove ? spaceAbove : spaceBelow),
            zIndex: 9999,
        });
    }, []);

    // Update position when open changes or on scroll/resize
    useEffect(() => {
        if (!open) return;
        updateDropdownPosition();
        window.addEventListener('scroll', updateDropdownPosition, true);
        window.addEventListener('resize', updateDropdownPosition);
        return () => {
            window.removeEventListener('scroll', updateDropdownPosition, true);
            window.removeEventListener('resize', updateDropdownPosition);
        };
    }, [open, updateDropdownPosition]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                wrapperRef.current && !wrapperRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setOpen(false);
                setHighlightIndex(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = entries.filter(e => {
        const search = inputValue.toLowerCase();
        return (e.text || '').toLowerCase().includes(search)
            || String(e.key).toLowerCase().includes(search);
    });

    // Reset highlight when filtered list changes
    useEffect(() => {
        setHighlightIndex(-1);
    }, [filtered.length]);

    const handleSelect = (entry: { key: string; text?: string }) => {
        const displayText = entry.text || String(entry.key);
        setInputValue(displayText);
        onChange?.(String(entry.key));
        setOpen(false);
        setHighlightIndex(-1);
        if (onBatchFieldUpdate) {
            const updates = handleSelection(String(entry.key));
            if (Object.keys(updates).length > 0) {
                onBatchFieldUpdate(updates);
            }
        }
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setOpen(true);
            e.preventDefault();
            return;
        }

        if (!open || filtered.length === 0) return;

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const next = highlightIndex < filtered.length - 1 ? highlightIndex + 1 : 0;
                setHighlightIndex(next);
                requestAnimationFrame(() => {
                    itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
                });
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                const prev = highlightIndex > 0 ? highlightIndex - 1 : filtered.length - 1;
                setHighlightIndex(prev);
                requestAnimationFrame(() => {
                    itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
                });
                break;
            }
            case 'Enter': {
                e.preventDefault();
                if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                    handleSelect(filtered[highlightIndex]);
                }
                break;
            }
            case 'Escape': {
                e.preventDefault();
                setOpen(false);
                setHighlightIndex(-1);
                break;
            }
        }
    };

    // Reset item refs when filtered list changes
    useEffect(() => {
        itemRefs.current = itemRefs.current.slice(0, filtered.length);
    }, [filtered.length]);

    const dropdown = open && filtered.length > 0
        ? createPortal(
            <div
                ref={dropdownRef}
                className="max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-md"
                style={dropdownStyle}
            >
                {filtered.map((entry, idx) => (
                    <button
                        key={entry.key}
                        ref={el => { itemRefs.current[idx] = el; }}
                        type="button"
                        className={cn(
                            "block w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors",
                            idx === highlightIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent"
                        )}
                        onClick={() => handleSelect(entry)}
                        onMouseEnter={() => setHighlightIndex(idx)}
                    >
                        {entry.text || entry.key}
                    </button>
                ))}
            </div>,
            document.body
        )
        : null;

    return (
        <div ref={wrapperRef} className="relative w-full">
            <Input
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setOpen(true);
                    setHighlightIndex(-1);
                    onChange?.(e.target.value);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                disabled={disabled || loading}
                placeholder={placeholder || 'Type to search…'}
                title={inputValue || ''}
                className={cn(
                    'h-8 truncate',
                    disabled && 'bg-muted text-muted-foreground',
                    loading && !disabled && 'opacity-60',
                    className,
                )}
            />
            {dropdown}
        </div>
    );
}
