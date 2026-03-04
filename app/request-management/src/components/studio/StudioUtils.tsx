import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, X, Info } from 'lucide-react';
import { Button } from '../ui/Button';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useStudioToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useStudioToast must be used within StudioToastProvider');
    }
    return context;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const icons = {
        success: <CheckCircle2 size={20} className="text-[var(--studio-success)]" />,
        error: <XCircle size={20} className="text-[var(--studio-error)]" />,
        warning: <AlertTriangle size={20} className="text-[var(--studio-warning)]" />,
        info: <Info size={20} className="text-[var(--studio-info)]" />,
    };

    useEffect(() => {
        if (toast.duration) {
            const timer = setTimeout(onDismiss, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast.duration, onDismiss]);

    return (
        <motion.div
            className={`studio-toast studio-toast--${toast.type}`}
            initial={{ opacity: 0, x: 100, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
        >
            {icons[toast.type]}
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="h-6 w-6 text-[var(--studio-text-muted)] hover:text-[var(--studio-text-primary)]"
            >
                <X size={16} />
            </Button>
        </motion.div>
    );
}

export function StudioToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: ToastType = 'info', duration = 5000) => {
        const id = `toast-${Date.now()}`;
        setToasts((prev) => [...prev, { id, message, type, duration }]);
    };

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <ToastItem
                            key={toast.id}
                            toast={toast}
                            onDismiss={() => dismissToast(toast.id)}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

// Loading skeleton components
export function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`studio-skeleton ${className}`} />;
}

export function CardSkeleton() {
    return (
        <div className="glass-card p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
    );
}

export function StepListSkeleton() {
    return (
        <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="flex-1 h-4" />
                </div>
            ))}
        </div>
    );
}

// Error boundary component
interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = 'Something went wrong',
    message = 'An error occurred while loading this content.',
    onRetry,
}: ErrorStateProps) {
    return (
        <div className="studio-error">
            <XCircle className="studio-error__icon" />
            <h3 className="studio-error__title">{title}</h3>
            <p className="studio-error__message">{message}</p>
            {onRetry && (
                <Button onClick={onRetry}>
                    Try Again
                </Button>
            )}
        </div>
    );
}

// Empty state component
interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    message?: string;
    action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
    return (
        <div className="studio-empty">
            {icon && <div className="studio-empty__icon">{icon}</div>}
            <h3 className="studio-empty__title">{title}</h3>
            {message && <p className="studio-empty__message">{message}</p>}
            {action}
        </div>
    );
}

// Confirmation dialog
interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'default';
    /** Optional custom content rendered between message and buttons */
    children?: ReactNode;
    /** If true, the confirm button is disabled */
    confirmDisabled?: boolean;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'default',
    children,
    confirmDisabled = false,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <>
            <div className="studio-overlay studio-overlay--visible" onClick={onCancel} />
            <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <motion.div
                    className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <h3 className="text-lg font-semibold text-[var(--studio-text-primary)] mb-2">
                        {title}
                    </h3>
                    <p className="text-sm text-[var(--studio-text-secondary)] mb-4">
                        {message}
                    </p>
                    {children && <div className="mb-4">{children}</div>}
                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={onCancel}>
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={variant === 'danger' ? 'destructive' : 'default'}
                            onClick={onConfirm}
                            disabled={confirmDisabled}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </>
    );
}
// Helper to topologically sort nodes
interface GraphNode {
    id: string;
    [key: string]: any;
}

interface GraphEdge {
    source: string;
    target: string;
    [key: string]: any;
}

export function getTopologicalSortedNodes<T extends GraphNode>(nodes: T[], edges: GraphEdge[]): T[] {
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, T>();

    // Initialize
    nodes.forEach(node => {
        adjacencyList.set(node.id, []);
        inDegree.set(node.id, 0);
        nodeMap.set(node.id, node);
    });

    // Build graph
    edges.forEach(edge => {
        if (adjacencyList.has(edge.source) && adjacencyList.has(edge.target)) {
            adjacencyList.get(edge.source)!.push(edge.target);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }
    });

    // Queue for nodes with in-degree 0 (Start Nodes)
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
        if (degree === 0) {
            queue.push(id);
        }
    });

    // Tie breaking: Start Node priority or just name/index? 
    // Start nodes will be added first.

    const sortedIds: string[] = [];

    while (queue.length > 0) {
        // Pop first available
        const currentId = queue.shift()!;
        sortedIds.push(currentId);

        const neighbors = adjacencyList.get(currentId) || [];
        for (const neighbor of neighbors) {
            inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
            if (inDegree.get(neighbor) === 0) {
                queue.push(neighbor);
            }
        }
    }

    // Handle cycles or disconnected components naturally.
    // Remaining nodes that weren't visited (cycles)
    if (sortedIds.length < nodes.length) {
        const visited = new Set(sortedIds);
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                sortedIds.push(node.id);
            }
        });
    }

    // Map back to node objects
    return sortedIds
        .map(id => nodeMap.get(id))
        .filter((n): n is T => !!n);
}
