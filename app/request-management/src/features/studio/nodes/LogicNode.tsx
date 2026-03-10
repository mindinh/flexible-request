import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

/**
 * ConditionNode — standardized diamonds with inputs on Top/Left/Right 
 * and dual labelled source handles on Bottom.
 */
export function ConditionNode({ data, selected }: NodeProps) {
    const accent = '#b10e10';
    const targetHandleStyle = {
        width: '10px',
        height: '10px',
        backgroundColor: '#fff',
        border: `2px solid ${accent}`,
        zIndex: 20,
    } as const;
    const sourceHandleStyle = {
        width: '10px',
        height: '10px',
        backgroundColor: accent,
        border: '2px solid #fff',
        zIndex: 20,
    } as const;

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

            {/* Input handles (Top, Left, Right) */}
            <Handle
                type="target"
                position={Position.Top}
                style={{
                    ...targetHandleStyle,
                    top: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="left-target"
                style={{
                    ...targetHandleStyle,
                    left: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
            />
            <Handle
                type="target"
                position={Position.Right}
                id="right-target"
                style={{
                    ...targetHandleStyle,
                    right: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
            />

            {/* Outputs (Bottom - side by side) */}
            <div style={{
                position: 'absolute',
                bottom: '-28px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '24px',
                alignItems: 'flex-start'
            }}>
                {/* TRUE Branch */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        style={{
                            position: 'relative',
                            width: '10px',
                            height: '10px',
                            backgroundColor: '#22c55e',
                            border: '2px solid #fff',
                            transform: 'none',
                            left: 'auto',
                            top: 'auto'
                        }}
                    />
                    <span style={{ fontSize: '7px', fontWeight: 900, color: '#22c55e' }}>TRUE</span>
                </div>

                {/* FALSE Branch */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        style={{
                            position: 'relative',
                            width: '10px',
                            height: '10px',
                            backgroundColor: '#ef4444',
                            border: '2px solid #fff',
                            transform: 'none',
                            left: 'auto',
                            top: 'auto'
                        }}
                    />
                    <span style={{ fontSize: '7px', fontWeight: 900, color: '#ef4444' }}>FALSE</span>
                </div>
            </div>
        </div>
    );
}
