import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

/**
 * ConditionNode — compact diamond card with the app's brand red accent.
 * Has one input handle (Top) and two labelled output handles:
 * - TRUE (Bottom, Green)
 * - FALSE (Right, Red)
 */
export function ConditionNode({ data, selected }: NodeProps) {
    const accent = '#b10e10'; // Matching app brand red (User Task color)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                position: 'relative',
            }}
        >
            {/* Diamond container */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '70px',
                    height: '70px',
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
                    padding: '8px',
                    width: '100%',
                }}>
                    <GitBranch size={14} color={accent} style={{ marginBottom: '2px' }} />
                    <div style={{
                        fontWeight: 700,
                        fontSize: '9px',
                        color: '#1e293b',
                        lineHeight: 1,
                        maxWidth: '50px',
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

            {/* TRUE output (Bottom) */}
            <div style={{
                position: 'absolute',
                bottom: '-30px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
            }}>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="true"
                    style={{
                        position: 'static',
                        width: '10px',
                        height: '10px',
                        backgroundColor: '#22c55e',
                        border: '2px solid #fff',
                        transform: 'none',
                    }}
                />
                <span style={{ fontSize: '8px', fontStyle: 'italic', fontWeight: 800, color: '#22c55e' }}>TRUE</span>
            </div>

            {/* FALSE output (Right) */}
            <div style={{
                position: 'absolute',
                right: '-45px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}>
                <span style={{ fontSize: '8px', fontStyle: 'italic', fontWeight: 800, color: '#ef4444' }}>FALSE</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="false"
                    style={{
                        position: 'static',
                        width: '10px',
                        height: '10px',
                        backgroundColor: '#ef4444',
                        border: '2px solid #fff',
                        transform: 'none',
                    }}
                />
            </div>
        </div>
    );
}
