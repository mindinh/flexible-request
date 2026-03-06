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
                    backgroundColor: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px',
                }}>
                    <Zap size={16} color={accent} fill={accent} />
                </div>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#1e293b',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                }}>
                    {(data.label as string) || 'Start'}
                </span>
            </div>

            {/* Output handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: accent,
                    border: '2px solid #fff',
                    bottom: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            />
        </div>
    );
}
