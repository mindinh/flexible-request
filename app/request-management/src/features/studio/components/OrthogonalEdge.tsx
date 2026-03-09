/**
 * OrthogonalEdge – Custom React Flow edge that draws clean 90° connectors.
 *
 * Routing: Horizontal → Vertical → Horizontal
 * Exits from the RIGHT of source, enters from the LEFT of target.
 */
import { type EdgeProps, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';

export function OrthogonalEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    label,
    style = {},
    selected,
    markerEnd,
}: EdgeProps) {
    // Midpoint X for the vertical segment
    const midX = (sourceX + targetX) / 2;

    // Build the SVG path: H→V→H
    const path = `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;

    const edgeStyle = {
        ...style,
        stroke: selected ? '#3b82f6' : (style.stroke ?? '#94a3b8'),
        strokeWidth: selected ? 3 : (style.strokeWidth ?? 2),
    };

    // Label at the midpoint of the vertical segment
    const labelX = midX;
    const labelY = (sourceY + targetY) / 2;

    return (
        <>
            <BaseEdge id={id} path={path} style={edgeStyle} markerEnd={markerEnd} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                    >
                        <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                            style={{
                                color: '#64748b',
                                backgroundColor: '#fff',
                                borderColor: '#e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                        >
                            {label}
                        </span>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
