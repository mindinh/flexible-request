import React from 'react';
import {
    BaseEdge,
    type EdgeProps,
    EdgeLabelRenderer,
    MarkerType,
    Position,
    useReactFlow,
} from '@xyflow/react';
import { useStudioStore } from '../useStudioStore';

function buildOrthogonalPath(points: Array<{ x: number; y: number }>) {
    const compactPoints = points.filter((point, index) => {
        if (index === 0) return true;
        const previous = points[index - 1];
        return previous.x !== point.x || previous.y !== point.y;
    });

    return compactPoints.map((point, index) => (
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    )).join(' ');
}

export function EditableEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
    data,
    selected,
    sourcePosition,
    targetPosition,
}: EdgeProps) {
    const { setEdges, screenToFlowPosition, getNodes, getEdges } = useReactFlow();
    const { updateWorkflow } = useStudioStore();

    const sx = Math.round(sourceX);
    const sy = Math.round(sourceY);
    const tx = Math.round(targetX);
    const ty = Math.round(targetY);

    const offsets = (data?.offsets as number[]) || [0, 0, 0];
    const [off1, offMid, off2] = offsets;

    const sourceIsVertical = sourcePosition === Position.Top || sourcePosition === Position.Bottom;
    const targetIsVertical = targetPosition === Position.Top || targetPosition === Position.Bottom;
    const sourceIsHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
    const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right;

    // Prefer actual handle direction over pure geometry so drag axis matches the connector segment users see.
    const isTB =
        sourceIsVertical && targetIsVertical
            ? true
            : sourceIsHorizontal && targetIsHorizontal
                ? false
                : sourceIsVertical
                    ? true
                    : sourceIsHorizontal
                        ? false
                        : Math.abs(ty - sy) > Math.abs(tx - sx);

    let path = '';
    let handles: Array<{ x: number; y: number; group: number; axis: 'x' | 'y'; emphasized?: boolean }> = [];

    if (isTB) {
        // Alignment Tolerance: If nodes are very close to vertical center and user hasn't manual offset
        const alignmentTolerance = 15;
        const isNearlyStraight = Math.abs(sx - tx) <= 1 && offMid === 0;
        const autoAlignX = (Math.abs(sx - tx) <= alignmentTolerance && offMid === 0) ? sx : (sx + tx) / 2 + offMid;

        const midX = Math.round(autoAlignX);
        const p1 = { x: sx, y: sy };

        if (isNearlyStraight && off1 === 0 && off2 === 0) {
            // Perfectly vertical line
            const p6 = { x: sx, y: ty };
            path = buildOrthogonalPath([p1, p6]);
            handles = [
                { x: sx, y: Math.round((sy + ty) / 2), group: 1, axis: 'x', emphasized: true },
            ];
        } else {
            const p2 = { x: sx, y: sy + off1 };
            const p3 = { x: midX, y: sy + off1 };
            const p4 = { x: midX, y: ty - off2 };
            const p5 = { x: tx, y: ty - off2 };
            const p6 = { x: tx, y: ty };

            path = buildOrthogonalPath([p1, p2, p3, p4, p5, p6]);

            handles = [
                { x: p1.x, y: Math.round((p1.y + p2.y) / 2), group: 0, axis: 'y' },
                { x: Math.round((p2.x + p3.x) / 2), y: p2.y, group: 0, axis: 'y' },
                { x: midX, y: Math.round((p3.y + p4.y) / 2), group: 1, axis: 'x', emphasized: true },
                { x: Math.round((p4.x + p5.x) / 2), y: p4.y, group: 2, axis: 'y' },
                { x: p6.x, y: Math.round((p5.y + p6.y) / 2), group: 2, axis: 'y' },
            ];

            if (Math.abs(p1.y - p2.y) < 8) handles[0].x -= 8;
            if (Math.abs(p2.x - p3.x) < 8) handles[1].x += (midX >= sx ? 8 : -8);
            if (Math.abs(p4.x - p5.x) < 8) handles[3].x -= (tx >= midX ? 8 : -8);
            if (Math.abs(p5.y - p6.y) < 8) handles[4].x += 8;
        }
    } else {
        const alignmentTolerance = 15;
        const isNearlyStraight = Math.abs(sy - ty) <= 1 && offMid === 0;
        const autoAlignY = (Math.abs(sy - ty) <= alignmentTolerance && offMid === 0) ? sy : (sy + ty) / 2 + offMid;

        const midY = Math.round(autoAlignY);
        const p1 = { x: sx, y: sy };

        if (isNearlyStraight && off1 === 0 && off2 === 0) {
            // Perfectly horizontal line
            const p6 = { x: tx, y: sy };
            path = buildOrthogonalPath([p1, p6]);
            handles = [
                { x: Math.round((sx + tx) / 2), y: sy, group: 1, axis: 'y', emphasized: true },
            ];
        } else {
            const p2 = { x: sx + off1, y: sy };
            const p3 = { x: sx + off1, y: midY };
            const p4 = { x: tx - off2, y: midY };
            const p5 = { x: tx - off2, y: ty };
            const p6 = { x: tx, y: ty };

            path = buildOrthogonalPath([p1, p2, p3, p4, p5, p6]);

            handles = [
                { x: Math.round((p1.x + p2.x) / 2), y: p1.y, group: 0, axis: 'x' },
                { x: p2.x, y: Math.round((p2.y + p3.y) / 2), group: 0, axis: 'x' },
                { x: Math.round((p3.x + p4.x) / 2), y: midY, group: 1, axis: 'y', emphasized: true },
                { x: p4.x, y: Math.round((p4.y + p5.y) / 2), group: 2, axis: 'x' },
                { x: Math.round((p5.x + p6.x) / 2), y: p6.y, group: 2, axis: 'x' },
            ];

            if (Math.abs(p1.x - p2.x) < 8) handles[0].y -= 8;
            if (Math.abs(p2.y - p3.y) < 8) handles[1].y += (midY >= sy ? 8 : -8);
            if (Math.abs(p4.y - p5.y) < 8) handles[3].y -= (ty >= midY ? 8 : -8);
            if (Math.abs(p5.x - p6.x) < 8) handles[4].y += 8;
        }
    }

    const distance = isTB ? Math.abs(ty - sy) : Math.abs(tx - sx);
    const showHandles = selected && distance > 10;
    const edgeStyle = {
        ...style,
        stroke: selected ? '#dc2626' : '#0f172a',
        strokeWidth: selected ? 2.5 : 2,
        strokeDasharray: selected ? '5,5' : undefined,
    };
    const resolvedMarkerEnd =
        typeof markerEnd === 'string'
            ? markerEnd
            : {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: (edgeStyle.stroke as string) || '#0f172a',
                ...(markerEnd || {}),
            };

    const resetOffsets = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEdges((eds) =>
            eds.map((edge) => {
                if (edge.id === id) {
                    return { ...edge, data: { ...edge.data, offsets: [0, 0, 0] } };
                }
                return edge;
            })
        );
        // Sync to store
        setTimeout(() => {
            const nodes = getNodes();
            const edges = getEdges();
            updateWorkflow(nodes as any, edges as any);
        }, 10);
    };

    const onHandleDrag = (index: number, moveEvent: MouseEvent | TouchEvent) => {
        const clientX = 'clientX' in moveEvent ? moveEvent.clientX : moveEvent.touches[0].clientX;
        const clientY = 'clientY' in moveEvent ? moveEvent.clientY : moveEvent.touches[0].clientY;

        const rawFlowPos = screenToFlowPosition({ x: clientX, y: clientY });
        const flowX = Math.round(rawFlowPos.x);
        const flowY = Math.round(rawFlowPos.y);

        setEdges((eds) =>
            eds.map((e) => {
                if (e.id === id) {
                    const newOffsets = [...((e.data as any)?.offsets as number[] || [0, 0, 0])];
                    const SNAP_VOLTAGE = 20;

                    if (isTB) {
                        if (index === 0 || index === 1) {
                            let valY = flowY - sy;
                            if (Math.abs(valY) < SNAP_VOLTAGE) valY = 0;
                            newOffsets[0] = valY;
                        } else if (index === 2) {
                            const centerX = Math.round((sx + tx) / 2);
                            let valX = flowX - centerX;
                            if (Math.abs(valX) < SNAP_VOLTAGE) valX = 0;
                            if (Math.abs(flowX - sx) < SNAP_VOLTAGE) valX = sx - centerX;
                            if (Math.abs(flowX - tx) < SNAP_VOLTAGE) valX = tx - centerX;
                            newOffsets[1] = valX;
                        } else if (index === 3 || index === 4) {
                            let valY = ty - flowY;
                            if (Math.abs(valY) < SNAP_VOLTAGE) valY = 0;
                            newOffsets[2] = valY;
                        }
                    } else {
                        if (index === 0 || index === 1) {
                            let valX = flowX - sx;
                            if (Math.abs(valX) < SNAP_VOLTAGE) valX = 0;
                            newOffsets[0] = valX;
                        } else if (index === 2) {
                            const centerY = Math.round((sy + ty) / 2);
                            let valY = flowY - centerY;
                            if (Math.abs(valY) < SNAP_VOLTAGE) valY = 0;
                            if (Math.abs(flowY - sy) < SNAP_VOLTAGE) valY = sy - centerY;
                            if (Math.abs(flowY - ty) < SNAP_VOLTAGE) valY = ty - centerY;
                            newOffsets[1] = valY;
                        } else if (index === 3 || index === 4) {
                            let valX = tx - flowX;
                            if (Math.abs(valX) < SNAP_VOLTAGE) valX = 0;
                            newOffsets[2] = valX;
                        }
                    }

                    return { ...e, data: { ...e.data, offsets: newOffsets } };
                }
                return e;
            })
        );
    };

    const startDrag = (index: number) => (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();

        const onMouseMove = (moveEvent: MouseEvent) => {
            onHandleDrag(index, moveEvent);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const currentNodes = getNodes();
            const currentEdges = getEdges();
            updateWorkflow(currentNodes as any, currentEdges as any);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <>
            <BaseEdge id={id} path={path} style={edgeStyle} markerEnd={resolvedMarkerEnd} />
            {showHandles && (
                <EdgeLabelRenderer>
                    {handles.map((handle, index) => (
                        <div
                            key={`${id}-handle-${index}`}
                            style={{
                                position: 'absolute',
                                transform: `translate(-50%, -50%) translate(${handle.x}px, ${handle.y}px)`,
                                pointerEvents: 'all',
                            }}
                            className="nodrag nopan"
                        >
                            <div
                                onMouseDown={startDrag(index)}
                                onDoubleClick={resetOffsets}
                                className={`${handle.emphasized ? 'w-4 h-4 bg-orange-600 shadow-md' : 'w-3 h-3 bg-orange-500 shadow-sm'} rounded-full border-2 border-white transition-transform hover:scale-125 ${handle.axis === 'x' ? 'cursor-ew-resize' : 'cursor-ns-resize'}`}
                                title={handle.axis === 'x' ? 'Drag Left/Right to adjust this segment group' : 'Drag Up/Down to adjust this segment group'}
                            />
                        </div>
                    ))}
                </EdgeLabelRenderer>
            )}
        </>
    );
}
