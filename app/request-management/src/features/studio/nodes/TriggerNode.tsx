import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';

/**
 * StartNode — n8n-inspired rounded pill with a lightning bolt icon.
 * Clean, minimal, output-only handle.
 */
export function StartNode({ data, selected }: NodeProps) {
    const accent = '#22c55e';

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
                    backgroundColor: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Zap size={14} color={accent} fill={accent} />
                </div>
                <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#1e293b',
                    letterSpacing: '0.01em',
                }}>
                    {(data.label as string) || 'Start'}
                </span>
            </div>

            {/* Output handle */}
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: accent,
                    border: '2px solid #fff',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    right: '-4px',
                }}
            />
        </div>
    );
}
