import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ClipboardCheck, FileEdit, Mail, Shield, Clock } from 'lucide-react';

// Sub-type config: icon + accent color
const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    form: { icon: FileEdit, color: '#e74c3c', bg: '#fef2f2', label: 'Form' },
    email: { icon: Mail, color: '#3b82f6', bg: '#eff6ff', label: 'Email' },
    approval: { icon: Shield, color: '#f59e0b', bg: '#fffbeb', label: 'Approval' },
};
const DEFAULT_CONFIG = { icon: ClipboardCheck, color: '#b10e10', bg: '#fef2f2', label: 'Action' };

/**
 * ActionNode — n8n-inspired card with a colored left accent stripe,
 * icon badge, and clean typography.
 */
export function ActionNode({ data, selected }: NodeProps) {
    const subType = data.actionSubType as string | undefined;
    const config = (subType && ACTION_CONFIG[subType]) || DEFAULT_CONFIG;
    const Icon = config.icon;

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
                position={Position.Left}
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#fff',
                    border: `2px solid ${config.color}`,
                    left: '-4px',
                }}
            />
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
        </div>
    );
}
