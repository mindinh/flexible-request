import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Square } from 'lucide-react';

/**
 * EndNode — n8n-inspired rounded pill with a stop icon.
 * Clean, minimal, input-only handle.
 */
export function EndNode({ data, selected }: NodeProps) {
    const accent = '#64748b';
    const sideHandleStyle = {
        width: '10px',
        height: '10px',
        backgroundColor: '#fff',
        border: `2px solid ${accent}`,
    } as const;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
            }}
        >
            {/* Circle container */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: `2px solid ${selected ? accent : '#e2e8f0'}`,
                    boxShadow: selected
                        ? `0 0 0 2px ${accent}22, 0 4px 12px rgba(0,0,0,0.08)`
                        : '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                }}
            >
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px',
                }}>
                    <Square size={14} color={accent} fill={accent} />
                </div>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#475569',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                }}>
                    {(data.label as string) || 'End'}
                </span>
            </div>

            {/* Input handle */}
            <Handle
                type="target"
                position={Position.Top}
                style={{
                    ...sideHandleStyle,
                    top: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    ...sideHandleStyle,
                    left: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
            />
            <Handle
                type="target"
                position={Position.Right}
                id="right"
                style={{
                    ...sideHandleStyle,
                    right: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
            />
        </div>
    );
}
