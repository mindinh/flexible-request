import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';

interface ResizableLeftPanelProps {
    /** Content to render inside the panel */
    children: (isCollapsed: boolean) => ReactNode;
    /** Default expanded width in pixels */
    defaultWidth?: number;
    /** Minimum expanded width */
    minWidth?: number;
    /** Maximum expanded width */
    maxWidth?: number;
    /** Width when collapsed (icon-only mode) */
    collapsedWidth?: number;
    /** Whether the panel starts collapsed */
    defaultCollapsed?: boolean;
}

/**
 * A resizable and collapsible left panel that lives *inside* a tab's content area.
 * Modeled after the existing RightPanel resize pattern but anchored to the left.
 */
export function ResizableLeftPanel({
    children,
    defaultWidth = 220,
    minWidth = 160,
    maxWidth = 400,
    collapsedWidth = 56,
    defaultCollapsed = false,
}: ResizableLeftPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [panelWidth, setPanelWidth] = useState(defaultWidth);
    const [isResizing, setIsResizing] = useState(false);
    const resizingRef = useRef(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Resize logic — drag handle on the right edge
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current || !panelRef.current) return;
            const panelRect = panelRef.current.getBoundingClientRect();
            const newWidth = e.clientX - panelRect.left;
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setPanelWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            resizingRef.current = false;
            setIsResizing(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, minWidth, maxWidth]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const toggleCollapse = () => {
        setIsCollapsed((prev) => !prev);
    };

    const currentWidth = isCollapsed ? collapsedWidth : panelWidth;

    return (
        <div className="relative flex-shrink-0 h-full" style={{ width: currentWidth }}>
            {/* Animated inner container */}
            <motion.div
                ref={panelRef}
                className="h-full flex flex-col bg-[var(--studio-bg-primary,#ffffff)] border-r border-slate-200 select-none overflow-hidden"
                animate={{ width: currentWidth }}
                transition={{
                    duration: isResizing ? 0 : 0.25,
                    ease: 'easeInOut',
                }}
            >
                {/* Panel content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
                    {children(isCollapsed)}
                </div>

                {/* Resize handle — right edge, only when expanded */}
                {!isCollapsed && (
                    <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-20 flex flex-col justify-center items-center group"
                        onMouseDown={startResizing}
                    >
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical size={12} className="text-slate-300" />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Collapse / Expand toggle — positioned OUTSIDE the overflow container */}
            <button
                onClick={toggleCollapse}
                className="absolute -right-3 top-3 z-30 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 hover:shadow transition-all"
                aria-label={isCollapsed ? 'Expand palette' : 'Collapse palette'}
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </div>
    );
}
