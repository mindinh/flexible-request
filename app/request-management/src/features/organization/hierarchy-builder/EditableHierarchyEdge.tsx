import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    type EdgeProps,
    Position,
    useReactFlow,
} from '@xyflow/react';
import { useHierarchyStore, type HierarchyEdgeData } from './useHierarchyStore';

const BRAND_RED = '#b10e10';
const EDIT_STROKE = '#dc2626';

export function EditableHierarchyEdge({
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
    const setStoreNodes = useHierarchyStore((state) => state.setNodes);
    const setStoreEdges = useHierarchyStore((state) => state.setEdges);

    const syncStore = () => {
        setStoreNodes(getNodes() as any);
        setStoreEdges(getEdges() as any);
    };

    const sx = Math.round(sourceX);
    const sy = Math.round(sourceY);
    const tx = Math.round(targetX);
    const ty = Math.round(targetY);

    const edgeData = (data as HierarchyEdgeData | undefined) || undefined;
    const offsets = edgeData?.offsets || [0, 0, 0];
    const [off1, offMid, off2] = offsets;

    const sourceIsVertical = sourcePosition === Position.Top || sourcePosition === Position.Bottom;
    const targetIsVertical = targetPosition === Position.Top || targetPosition === Position.Bottom;
    const sourceIsHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
    const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right;

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
        const alignmentTolerance = 15;
        const autoAlignX = (Math.abs(sx - tx) <= alignmentTolerance && offMid === 0) ? sx : (sx + tx) / 2 + offMid;

        const midX = Math.round(autoAlignX);
        const p1 = { x: sx, y: sy };
        const p2 = { x: sx, y: sy + off1 };
        const p3 = { x: midX, y: sy + off1 };
        const p4 = { x: midX, y: ty - off2 };
        const p5 = { x: tx, y: ty - off2 };
        const p6 = { x: tx, y: ty };

        path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} L ${p5.x} ${p5.y} L ${p6.x} ${p6.y}`;

        handles = [
            { x: p1.x, y: Math.round((p1.y + p2.y) / 2), group: 0, axis: 'y' },
            { x: Math.round((p2.x + p3.x) / 2), y: p2.y, group: 0, axis: 'y' },
            { x: midX, y: Math.round((p3.y + p4.y) / 2), group: 1, axis: 'x', emphasized: true },
            { x: Math.round((p4.x + p5.x) / 2), y: p4.y, group: 2, axis: 'y' },
            { x: p6.x, y: Math.round((p5.y + p6.y) / 2), group: 2, axis: 'y' },
        ];

        if (Math.abs(p1.y - p2.y) < 8) {
            handles[0].x -= 8;
        }
        if (Math.abs(p2.x - p3.x) < 8) {
            handles[1].x += (midX >= sx ? 8 : -8);
        }
        if (Math.abs(p4.x - p5.x) < 8) {
            handles[3].x -= (tx >= midX ? 8 : -8);
        }
        if (Math.abs(p5.y - p6.y) < 8) {
            handles[4].x += 8;
        }
    } else {
        const alignmentTolerance = 15;
        const autoAlignY = (Math.abs(sy - ty) <= alignmentTolerance && offMid === 0) ? sy : (sy + ty) / 2 + offMid;

        const midY = Math.round(autoAlignY);
        const p1 = { x: sx, y: sy };
        const p2 = { x: sx + off1, y: sy };
        const p3 = { x: sx + off1, y: midY };
        const p4 = { x: tx - off2, y: midY };
        const p5 = { x: tx - off2, y: ty };
        const p6 = { x: tx, y: ty };

        path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} L ${p5.x} ${p5.y} L ${p6.x} ${p6.y}`;

        handles = [
            { x: Math.round((p1.x + p2.x) / 2), y: p1.y, group: 0, axis: 'x' },
            { x: p2.x, y: Math.round((p2.y + p3.y) / 2), group: 0, axis: 'x' },
            { x: Math.round((p3.x + p4.x) / 2), y: midY, group: 1, axis: 'y', emphasized: true },
            { x: p4.x, y: Math.round((p4.y + p5.y) / 2), group: 2, axis: 'x' },
            { x: Math.round((p5.x + p6.x) / 2), y: p6.y, group: 2, axis: 'x' },
        ];

        if (Math.abs(p1.x - p2.x) < 8) {
            handles[0].y -= 8;
        }
        if (Math.abs(p2.y - p3.y) < 8) {
            handles[1].y += (midY >= sy ? 8 : -8);
        }
        if (Math.abs(p4.y - p5.y) < 8) {
            handles[3].y -= (ty >= midY ? 8 : -8);
        }
        if (Math.abs(p5.x - p6.x) < 8) {
            handles[4].y += 8;
        }
    }

    const distance = isTB ? Math.abs(ty - sy) : Math.abs(tx - sx);
    const showHandles = selected && distance > 10;
    const edgeStyle = {
        ...style,
        stroke: selected ? EDIT_STROKE : (style.stroke ?? BRAND_RED),
        strokeWidth: selected ? 2.5 : (style.strokeWidth ?? 2),
        strokeDasharray: selected ? '5,5' : style.strokeDasharray,
    };

    const resetOffsets = (event: React.MouseEvent) => {
        event.stopPropagation();
        setEdges((existingEdges) =>
            existingEdges.map((edge) => {
                if (edge.id !== id) return edge;
                return {
                    ...edge,
                    data: { ...(edge.data as object), offsets: [0, 0, 0] },
                };
            })
        );

        setTimeout(syncStore, 10);
    };

    const onHandleDrag = (index: number, moveEvent: MouseEvent | TouchEvent) => {
        const clientX = 'clientX' in moveEvent ? moveEvent.clientX : moveEvent.touches[0].clientX;
        const clientY = 'clientY' in moveEvent ? moveEvent.clientY : moveEvent.touches[0].clientY;
        const rawFlowPos = screenToFlowPosition({ x: clientX, y: clientY });
        const flowX = Math.round(rawFlowPos.x);
        const flowY = Math.round(rawFlowPos.y);

        setEdges((existingEdges) =>
            existingEdges.map((edge) => {
                if (edge.id !== id) return edge;

                const nextOffsets = [...(((edge.data as HierarchyEdgeData | undefined)?.offsets) || [0, 0, 0])];
                const SNAP_VOLTAGE = 20;

                if (isTB) {
                    if (index === 0 || index === 1) {
                        let valY = flowY - sy;
                        if (Math.abs(valY) < SNAP_VOLTAGE) valY = 0;
                        nextOffsets[0] = valY;
                    } else if (index === 2) {
                        const centerX = Math.round((sx + tx) / 2);
                        let valX = flowX - centerX;
                        if (Math.abs(valX) < SNAP_VOLTAGE) valX = 0;
                        if (Math.abs(flowX - sx) < SNAP_VOLTAGE) valX = sx - centerX;
                        if (Math.abs(flowX - tx) < SNAP_VOLTAGE) valX = tx - centerX;
                        nextOffsets[1] = valX;
                    } else if (index === 3 || index === 4) {
                        let valY = ty - flowY;
                        if (Math.abs(valY) < SNAP_VOLTAGE) valY = 0;
                        nextOffsets[2] = valY;
                    }
                } else {
                    if (index === 0 || index === 1) {
                        let valX = flowX - sx;
                        if (Math.abs(valX) < SNAP_VOLTAGE) valX = 0;
                        nextOffsets[0] = valX;
                    } else if (index === 2) {
                        const centerY = Math.round((sy + ty) / 2);
                        let valY = flowY - centerY;
                        if (Math.abs(valY) < SNAP_VOLTAGE) valY = 0;
                        if (Math.abs(flowY - sy) < SNAP_VOLTAGE) valY = sy - centerY;
                        if (Math.abs(flowY - ty) < SNAP_VOLTAGE) valY = ty - centerY;
                        nextOffsets[1] = valY;
                    } else if (index === 3 || index === 4) {
                        let valX = tx - flowX;
                        if (Math.abs(valX) < SNAP_VOLTAGE) valX = 0;
                        nextOffsets[2] = valX;
                    }
                }

                return {
                    ...edge,
                    data: { ...(edge.data as object), offsets: nextOffsets },
                };
            })
        );
    };

    const startDrag = (index: number) => (event: React.MouseEvent | React.TouchEvent) => {
        event.stopPropagation();

        const onMouseMove = (moveEvent: MouseEvent) => {
            onHandleDrag(index, moveEvent);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            syncStore();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <>
            <BaseEdge id={id} path={path} style={edgeStyle} markerEnd={markerEnd} />
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
