/**
 * ValueHelpMultiSelect.tsx
 * Popover-based multi-select with checkboxes and Token chips.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Checkbox } from '@/components/ui/Checkbox';
import { Token } from '@/components/ui/Token';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useValueHelp } from '../hooks/useValueHelp';
import type { ValueHelpBaseProps } from '../types';

type Props = ValueHelpBaseProps;

export default function ValueHelpMultiSelect({
    objectType,
    valueHelpID,
    value,
    onChange,
    baseUrl,
    dependsOnValue,
    disabled,
    className,
}: Props) {
    const { entries, loading } = useValueHelp({
        objectType,
        valueHelpID,
        baseUrl,
        dependsOnValue,
    });

    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedKeys = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];

    // Collapse when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded]);

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    const handleToggle = (key: string) => {
        const isSelected = selectedKeys.includes(key);
        const newKeys = isSelected
            ? selectedKeys.filter(k => k !== key)
            : [...selectedKeys, key];
        onChange?.(newKeys.join(', '));
    };

    const handleSelectAll = () => {
        onChange?.(entries.map(e => e.key).join(', '));
    };

    const handleClearAll = () => {
        onChange?.('');
    };

    const handleRemoveToken = (key: string) => {
        onChange?.(selectedKeys.filter(k => k !== key).join(', '));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && selectedKeys.length > 0) {
            e.preventDefault();
            onChange?.(selectedKeys.slice(0, -1).join(', '));
        } else if (e.key === 'Escape') {
            setIsExpanded(false);
            setIsOpen(false);
        }
    };

    const getLabel = (key: string) => {
        const entry = entries.find(e => e.key === key);
        return entry?.text || key;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div
                    ref={containerRef}
                    className={cn(
                        "w-full border-2 rounded-md cursor-pointer transition-all outline-none",
                        disabled ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-card",
                        isOpen || isExpanded
                            ? "border-2 border-[var(--color-brand)]"
                            : "hover:border-[var(--input-border-hover)]",
                        isExpanded ? "min-h-8 p-1" : "h-9 px-2",
                        className
                    )}
                    title={selectedKeys.length > 0 ? selectedKeys.map(k => getLabel(k)).join(', ') : ''}
                >
                    {isExpanded ? (
                        <div className="flex flex-wrap items-center gap-1">
                            {selectedKeys.map(key => (
                                <Token key={key} onRemove={() => handleRemoveToken(key)}>
                                    {getLabel(key)}
                                </Token>
                            ))}
                            <input
                                ref={inputRef}
                                type="text"
                                className="flex-1 min-w-[60px] h-6 text-sm outline-none border-none bg-transparent caret-primary"
                                placeholder=""
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex items-center gap-1">
                            <div className="flex-1 flex items-center gap-1 overflow-hidden">
                                {selectedKeys.length > 0 ? (
                                    <>
                                        {selectedKeys.slice(0, 1).map(key => (
                                            <Token key={key} onRemove={() => handleRemoveToken(key)}>
                                                {getLabel(key)}
                                            </Token>
                                        ))}
                                        {selectedKeys.length > 1 && (
                                            <span
                                                className="text-sm text-muted-foreground shrink-0 cursor-pointer hover:text-primary hover:underline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setIsExpanded(true);
                                                    setIsOpen(true);
                                                }}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                }}
                                            >
                                                +{selectedKeys.length - 1} more
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-muted-foreground text-sm">Select…</span>
                                )}
                            </div>
                            {selectedKeys.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 p-0 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleClearAll();
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                </Button>
                            )}
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                    )}
                </div>
            </PopoverTrigger>

            <PopoverContent
                className="p-0"
                style={{ width: 'var(--radix-popover-trigger-width)' }}
                align="start"
                onInteractOutside={() => {}}
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    if (isExpanded && inputRef.current) {
                        inputRef.current.focus();
                    }
                }}
            >
                <div className="p-2 border-b border-border">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAll}
                            className="h-7 text-sm"
                        >
                            Select All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearAll}
                            className="h-7 text-sm"
                        >
                            Clear
                        </Button>
                    </div>
                </div>

                <div className="max-h-60 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                            No options available
                        </div>
                    ) : (
                        entries.map(entry => {
                            const isSelected = selectedKeys.includes(entry.key);
                            return (
                                <div
                                    key={entry.key}
                                    className="flex items-center space-x-2 py-1.5 px-1 rounded hover:bg-muted cursor-pointer"
                                    onClick={() => handleToggle(entry.key)}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggle(entry.key)}
                                        className="pointer-events-none"
                                    />
                                    <span className="text-sm flex-1">
                                        {entry.text || entry.key}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
