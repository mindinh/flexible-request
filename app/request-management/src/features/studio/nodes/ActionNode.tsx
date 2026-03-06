import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ClipboardCheck, FileEdit, Mail, Shield, Clock } from 'lucide-react';

// Sub-type config: icon + accent color
const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    user_task: { icon: ClipboardCheck, color: '#b10e10', bg: '#fef2f2', label: 'User Task' },
    // Legacy subtypes kept for backward compatibility
    form: { icon: FileEdit, color: '#e74c3c', bg: '#fef2f2', label: 'Form' },
    email: { icon: Mail, color: '#3b82f6', bg: '#eff6ff', label: 'Email' },
    approval: { icon: Shield, color: '#f59e0b', bg: '#fffbeb', label: 'Approval' },
};
const DEFAULT_CONFIG = { icon: ClipboardCheck, color: '#b10e10', bg: '#fef2f2', label: 'User Task' };

interface FormAction {
    id: string;
    label: string;
    variant: 'primary' | 'secondary' | 'destructive';
}

const VARIANT_COLORS: Record<string, string> = {
    primary: '#22c55e',
    secondary: '#3b82f6',
    destructive: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    outline: '#64748b',
    ghost: '#94a3b8',
};

/**
 * ActionNode — n8n-inspired card with a colored left accent stripe,
 * icon badge, and clean typography.
 * Supports dynamic output handles based on form actions (decision branching).
 */
export function ActionNode({ data, selected }: NodeProps) {
    const subType = data.actionSubType as string | undefined;
    const config = (subType && ACTION_CONFIG[subType]) || DEFAULT_CONFIG;
    const Icon = config.icon;

    // Dynamic source handles from form actions
    const formActions = (data.formActions as FormAction[] | undefined) || [];
    const hasMultipleHandles = formActions.length > 0;

    return (
        <div
            style={{
                display: 'flex',
                width: '220px',
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: `1.5px solid ${selected ? config.color : '#e2e8f0'}`,
                overflow: 'hidden',
                boxShadow: selected
                    ? `0 0 0 2px ${config.color}22, 0 4px 16px rgba(0,0,0,0.08)`
                    : '0 1px 4px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
            }}
        >
            {/* Colored left accent bar */}
            <div style={{
                width: '4px',
                backgroundColor: config.color,
                flexShrink: 0,
            }} />

            {/* Content area */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                flex: 1,
                minWidth: 0,
            }}>
                {/* Icon badge */}
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: config.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Icon size={16} color={config.color} />
                </div>

                {/* Text */}
                <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{
                        fontWeight: 600,
                        fontSize: '12.5px',
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                    }}>
                        {data.label as string}
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '10.5px',
                        color: '#94a3b8',
                        marginTop: '2px',
                    }}>
                        {(data.sla as number) > 0 ? (
                            <>
                                <Clock size={10} />
                                <span>{data.sla as number}d SLA</span>
                            </>
                        ) : (
                            <span>{config.label}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Target Handle (Left — always single) */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#fff',
                    border: `2px solid ${config.color}`,
                    left: '-4px',
                }}
            />

            {/* Source Handles (Right — dynamic or single) */}
            {hasMultipleHandles ? (
                formActions.map((action, idx) => {
                    const total = formActions.length;
                    // Distribute handles evenly along the right edge
                    const topPercent = total === 1 ? 50 : 20 + (idx * 60) / (total - 1);
                    const handleColor = VARIANT_COLORS[action.variant] || config.color;
                    return (
                        <div key={action.id}>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={action.id}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: handleColor,
                                    border: '2px solid #fff',
                                    right: '-4px',
                                    top: `${topPercent}%`,
                                }}
                            />
                            {/* Label next to handle */}
                            <div
                                style={{
                                    position: 'absolute',
                                    right: '-70px',
                                    top: `${topPercent}%`,
                                    transform: 'translateY(-50%)',
                                    fontSize: '9px',
                                    color: '#64748b',
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                    fontWeight: 500,
                                }}
                            >
                                {action.label}
                            </div>
                        </div>
                    );
                })
            ) : (
                <Handle
                    type="source"
                    position={Position.Right}
                    style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: config.color,
                        border: '2px solid #fff',
                        right: '-4px',
                    }}
                />
            )}
        </div>
    );
}
