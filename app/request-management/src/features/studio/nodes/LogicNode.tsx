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
            {/* Diamond container */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100px',
                    height: '100px',
                    backgroundColor: '#fff',
                    border: `2px solid ${selected ? accent : '#e2e8f0'}`,
                    transform: 'rotate(45deg)',
                    boxShadow: selected
                        ? `0 0 0 2px ${accent}22, 0 4px 20px rgba(0,0,0,0.1)`
                        : '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                }}
            >
                {/* Inverse rotation for content */}
                <div style={{
                    transform: 'rotate(-45deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '10px',
                    width: '100%',
                }}>
                    <GitBranch size={16} color={accent} style={{ marginBottom: '4px' }} />
                    <div style={{
                        fontWeight: 700,
                        fontSize: '11px',
                        color: '#1e293b',
                        lineHeight: 1.1,
                        maxWidth: '70px',
                        wordBreak: 'break-word',
                    }}>
                        {(data.label as string) || 'Condition'}
                    </div>
                </div>
            </div>

            {/* Input handle (Top) */}
            <Handle
                type="target"
                position={Position.Top}
                style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#fff',
                    border: `2px solid ${accent}`,
                    top: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 20,
                }}
            />

            {/* Yes output (Bottom) */}
            <div style={{
                position: 'absolute',
                bottom: '-25px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
            }}>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="true"
                    style={{
                        position: 'static',
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#22c55e',
                        border: '2px solid #fff',
                        transform: 'none',
                    }}
                />
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#22c55e' }}>YES</span>
            </div>

            {/* No output (Right) */}
            <div style={{
                position: 'absolute',
                right: '-40px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#ef4444' }}>NO</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="false"
                    style={{
                        position: 'static',
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ef4444',
                        border: '2px solid #fff',
                        transform: 'none',
                    }}
                />
            </div>
        </div>
    );
}
