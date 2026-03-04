import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Square } from 'lucide-react';

/**
 * EndNode — n8n-inspired rounded pill with a stop icon.
 * Clean, minimal, input-only handle.
 */
export function EndNode({ data, selected }: NodeProps) {
    const accent = '#64748b';

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
            {/* Pill container */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '24px',
                    backgroundColor: '#fff',
                    border: `1.5px solid ${selected ? accent : '#e2e8f0'}`,
                    boxShadow: selected
                        ? `0 0 0 2px ${accent}22, 0 4px 12px rgba(0,0,0,0.08)`
                        : '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease',
                }}
            >
                <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Square size={12} color={accent} fill={accent} />
                </div>
                <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    letterSpacing: '0.01em',
                }}>
                    {(data.label as string) || 'End'}
                </span>
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
                    top: '50%',
                    transform: 'translateY(-50%)',
                    left: '-4px',
                }}
            />
        </div>
    );
}
