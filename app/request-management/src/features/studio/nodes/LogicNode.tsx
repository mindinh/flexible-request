import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

/**
 * ConditionNode — n8n-inspired compact card with a purple accent for logic/branching.
 * Has one input handle and two labelled output handles (Yes / No).
 */
export function ConditionNode({ data, selected }: NodeProps) {
    const accent = '#7c3aed';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
            }}
        >
            {/* Card container */}
            <div
                style={{
                    display: 'flex',
                    width: '180px',
                    backgroundColor: '#fff',
                    borderRadius: '10px',
                    border: `1.5px solid ${selected ? accent : '#e2e8f0'}`,
                    overflow: 'hidden',
                    boxShadow: selected
                        ? `0 0 0 2px ${accent}22, 0 4px 16px rgba(0,0,0,0.08)`
                        : '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'all 0.15s ease',
                }}
            >
                {/* Purple left accent */}
                <div style={{
                    width: '4px',
                    backgroundColor: accent,
                    flexShrink: 0,
                }} />

                {/* Content */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    flex: 1,
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#f5f3ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <GitBranch size={16} color={accent} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{
                            fontWeight: 600,
                            fontSize: '12.5px',
                            color: '#1e293b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.3,
                        }}>
                            {(data.label as string) || 'Condition'}
                        </div>
                        <div style={{
                            fontSize: '10.5px',
                            color: '#a78bfa',
                            marginTop: '2px',
                        }}>
                            IF / ELSE
                        </div>
                    </div>
                </div>
            </div>

            {/* Output labels */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '180px',
                padding: '4px 6px 0',
            }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#22c55e', letterSpacing: '0.04em' }}>YES</span>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#ef4444', letterSpacing: '0.04em' }}>NO</span>
            </div>

            {/* Input handle */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#fff',
                    border: `2px solid ${accent}`,
                    top: '26px',
                    left: '-4px',
                }}
            />

            {/* Yes output */}
            <Handle
                type="source"
                position={Position.Right}
                id="true"
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#22c55e',
                    border: '2px solid #fff',
                    top: '20px',
                    right: '-4px',
                }}
            />

            {/* No output */}
            <Handle
                type="source"
                position={Position.Right}
                id="false"
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#ef4444',
                    border: '2px solid #fff',
                    top: '36px',
                    right: '-4px',
                }}
            />
        </div>
    );
}
