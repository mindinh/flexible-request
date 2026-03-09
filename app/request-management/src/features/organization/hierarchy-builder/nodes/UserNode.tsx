import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, ChevronDown, ChevronRight } from 'lucide-react';
import { useHierarchyStore } from '../useHierarchyStore';

const BRAND_RED = '#b10e10';

/**
 * UserNode — Displays an individual user in the hierarchy canvas.
 * Rounded card with avatar placeholder, name, and subtitle.
 */
export function UserNode({ id, data, selected }: NodeProps) {
    const label = (data.label as string) || 'User';
    const subtitle = (data.subtitle as string) || '';
    const collapsed = Boolean((data as any).collapsed);
    const accentColor = BRAND_RED;
    const toggleNodeCollapsed = useHierarchyStore((s) => s.toggleNodeCollapsed);
    const hasChildren = useHierarchyStore((s) => s.edges.some((edge) => edge.source === id));

    return (
        <div style={{ position: 'relative' }}>
            {hasChildren && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeCollapsed(id);
                    }}
                    style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '999px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: accentColor,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        zIndex: 20,
                    }}
                    title={collapsed ? 'Expand children' : 'Collapse children'}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
            )}
            <div
                style={{
                    display: 'flex',
                    width: '200px',
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    border: `2px solid ${selected ? accentColor : '#e2e8f0'}`,
                    overflow: 'hidden',
                    boxShadow: selected
                        ? `0 0 0 3px ${accentColor}22, 0 4px 16px rgba(0,0,0,0.08)`
                        : '0 1px 6px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                }}
            >
                {/* Accent bar */}
                <div style={{ width: '4px', backgroundColor: accentColor, flexShrink: 0 }} />

                {/* Content */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', flex: 1 }}>
                    <div
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #fde8e8, #fbd5d5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <User size={16} color={accentColor} />
                    </div>

                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div
                            style={{
                                fontWeight: 600,
                                fontSize: '12px',
                                color: '#1e293b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {label}
                        </div>
                        {subtitle && (
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                {subtitle}
                            </div>
                        )}
                        <div
                            style={{
                                display: 'inline-block',
                                marginTop: '4px',
                                fontSize: '9px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: accentColor,
                                backgroundColor: '#fef2f2',
                                padding: '1px 6px',
                                borderRadius: '4px',
                            }}
                        >
                            Individual
                        </div>
                    </div>
                </div>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#fff',
                        border: `2px solid ${accentColor}`,
                        top: '-4px',
                    }}
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: accentColor,
                        border: '2px solid #fff',
                        bottom: '-4px',
                    }}
                />
            </div>
        </div>
    );
}
