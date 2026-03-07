/**
 * Token.tsx
 * A small chip/tag component for displaying selected values with a remove button.
 * Used by ValueHelpMultiSelect.
 */
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TokenProps {
    children: React.ReactNode;
    onRemove?: () => void;
    className?: string;
}

export function Token({ children, onRemove, className }: TokenProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
                'bg-primary/10 text-primary border border-primary/20',
                'max-w-[150px]',
                className,
            )}
        >
            <span className="truncate">{children}</span>
            {onRemove && (
                <button
                    type="button"
                    className="shrink-0 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemove();
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </span>
    );
}
