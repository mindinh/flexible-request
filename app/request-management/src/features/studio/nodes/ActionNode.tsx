import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ClipboardCheck, FileEdit, Mail, Shield, Clock } from 'lucide-react';
import { useStudioStore } from '../useStudioStore';

// Sub-type config: icon + accent color
const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    form: { icon: FileEdit, color: '#e74c3c', bg: '#fef2f2', label: 'Form' },
    email: { icon: Mail, color: '#3b82f6', bg: '#eff6ff', label: 'Email' },
    approval: { icon: Shield, color: '#f59e0b', bg: '#fffbeb', label: 'Approval' },
    userTask: { icon: ClipboardCheck, color: '#b10e10', bg: '#fef2f2', label: 'User Task' },
};
const DEFAULT_CONFIG = { icon: ClipboardCheck, color: '#b10e10', bg: '#fef2f2', label: 'Action' };

/**
 * ActionNode — n8n-inspired card with a colored left accent stripe,
 * icon badge, and clean typography.
 */
export function ActionNode({ data, selected }: NodeProps) {
    const { forms } = useStudioStore();
    const subType = data.actionSubType as string | undefined;
    const config = (subType && ACTION_CONFIG[subType]) || DEFAULT_CONFIG;
    const Icon = config.icon;

    // Dynamically resolve custom actions from the associated form
    const associatedForm = forms.find(f => f.id === data.formId);
    const customActions = associatedForm?.footerActions || [];

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

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Top}
                style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#fff',
                    border: `2px solid ${config.color}`,
                    top: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            />
            {/* Dynamic Output Handles */}
            {customActions.length > 0 ? (
                <>
                    {customActions.map((action, index) => {
                        // Map variant to color
                        const actionColor =
                            action.variant === 'success' ? '#22c55e' :
                                action.variant === 'danger' ? '#ef4444' :
                                    action.variant === 'primary' || !action.variant ? '#3b82f6' :
                                        action.variant === 'outline' ? '#64748b' :
                                            action.variant === 'ghost' ? '#94a3b8' :
                                                action.variant === 'secondary' ? '#f59e0b' :
                                                    action.variant === 'warning' ? '#f97316' :
                                                        '#3b82f6';
                        const actionBg =
                            action.variant === 'success' ? '#f0fdf4' :
                                action.variant === 'danger' ? '#fef2f2' :
                                    action.variant === 'primary' || !action.variant ? '#eff6ff' :
                                        action.variant === 'outline' ? '#f8fafc' :
                                            action.variant === 'ghost' ? '#f1f5f9' :
                                                action.variant === 'secondary' ? '#fffbeb' :
                                                    action.variant === 'warning' ? '#fff7ed' :
                                                        '#eff6ff';

                        // Balanced horizontal distribution (N+1 containers)
                        const leftPos = `${(index + 1) * (100 / (customActions.length + 1))}%`;

                        return (
                            <div
                                key={action.id}
                                style={{
                                    position: 'absolute',
                                    left: leftPos,
                                    bottom: '-5px',
                                    pointerEvents: 'none',
                                    zIndex: 10,
                                }}
                            >
                                <Handle
                                    type="source"
                                    position={Position.Bottom}
                                    id={action.id}
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: actionColor,
                                        border: '2.4px solid #fff',
                                        bottom: '0px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        pointerEvents: 'auto',
                                    }}
                                />
                                {/* Label */}
                                <div style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: '16px',
                                    transform: 'translateX(-50%)',
                                    backgroundColor: actionBg,
                                    padding: '2px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: actionColor,
                                    border: `1.5px solid ${actionColor}44`,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    pointerEvents: 'auto',
                                }}>
                                    <span>{action.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: config.color,
                        border: '2px solid #fff',
                        bottom: '-5px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                    }}
                />
            )}
        </div>
    );
}
