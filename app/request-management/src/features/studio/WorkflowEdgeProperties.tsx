import { useMemo } from 'react';
import { ArrowRight, Palette, Tag, Type, FileText } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

import { Textarea } from '@/components/ui/TextArea';
import { useStudioStore } from './useStudioStore';
import type { UiWorkflowEdge, UiWorkflowNode, EdgeStatusConfig } from './types';

// Predefined color palette for status colors
const STATUS_COLORS = [
    { value: '#22c55e', label: 'Green', swatch: 'bg-green-500' },
    { value: '#3b82f6', label: 'Blue', swatch: 'bg-blue-500' },
    { value: '#f59e0b', label: 'Amber', swatch: 'bg-amber-500' },
    { value: '#ef4444', label: 'Red', swatch: 'bg-red-500' },
    { value: '#8b5cf6', label: 'Purple', swatch: 'bg-violet-500' },
    { value: '#06b6d4', label: 'Cyan', swatch: 'bg-cyan-500' },
    { value: '#f97316', label: 'Orange', swatch: 'bg-orange-500' },
    { value: '#64748b', label: 'Slate', swatch: 'bg-slate-500' },
    { value: '#ec4899', label: 'Pink', swatch: 'bg-pink-500' },
    { value: '#14b8a6', label: 'Teal', swatch: 'bg-teal-500' },
];

interface WorkflowEdgePropertiesProps {
    edge: UiWorkflowEdge;
    allNodes: UiWorkflowNode[];
}

export function WorkflowEdgeProperties({ edge, allNodes }: WorkflowEdgePropertiesProps) {
    const { workflow, updateWorkflow } = useStudioStore();

    const sourceNode = useMemo(() => allNodes.find(n => n.id === edge.source), [allNodes, edge.source]);
    const targetNode = useMemo(() => allNodes.find(n => n.id === edge.target), [allNodes, edge.target]);

    const statusConfig = edge.data?.statusConfig;

    const updateEdgeStatusConfig = (updates: Partial<EdgeStatusConfig>) => {
        const newEdges = workflow.edges.map(e => {
            if (e.id !== edge.id) return e;
            const currentConfig = e.data?.statusConfig || {
                statusName: '',
                statusColor: '#22c55e',
                description: '',
            };
            return {
                ...e,
                data: {
                    ...e.data,
                    statusConfig: { ...currentConfig, ...updates },
                },
            };
        });
        updateWorkflow(workflow.nodes, newEdges);
    };

    return (
        <div className="p-5 space-y-6">
            {/* Transition Visual Header */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex-1 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">From</div>
                    <div className="text-sm font-bold text-slate-800 truncate">
                        {sourceNode?.data.label || 'Unknown'}
                    </div>
                </div>
                <ArrowRight size={18} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">To</div>
                    <div className="text-sm font-bold text-slate-800 truncate">
                        {targetNode?.data.label || 'Unknown'}
                    </div>
                </div>
            </div>

            {/* Action Label (from sourceHandle) */}
            {edge.sourceHandle && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Tag size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-blue-700">Action: {edge.sourceHandle}</span>
                </div>
            )}

            {/* Status Configuration Section */}
            <div className="space-y-1">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Status Configuration
                </h3>
                <p className="text-[11px] text-slate-500">
                    Define the status that is set when this transition occurs.
                </p>
            </div>

            {/* Status Name */}
            <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Type size={12} />
                    Status Name
                </Label>
                <Input
                    value={statusConfig?.statusName || ''}
                    onChange={(e) => updateEdgeStatusConfig({ statusName: e.target.value })}
                    placeholder="e.g. In Review, Approved, Rejected"
                    className="h-9 text-sm border-slate-200 focus:border-[var(--brand-red)] focus:ring-[var(--brand-red)]/20"
                />
            </div>

            {/* Status Color */}
            <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Palette size={12} />
                    Status Color
                </Label>
                <div className="grid grid-cols-5 gap-2">
                    {STATUS_COLORS.map(color => {
                        const isActive = (statusConfig?.statusColor || '#22c55e') === color.value;
                        return (
                            <button
                                key={color.value}
                                onClick={() => updateEdgeStatusConfig({ statusColor: color.value })}
                                title={color.label}
                                className={`
                                    w-full aspect-square rounded-lg border-2 transition-all flex items-center justify-center
                                    ${isActive
                                        ? 'border-slate-900 scale-110 shadow-md'
                                        : 'border-transparent hover:border-slate-300 hover:scale-105'
                                    }
                                `}
                                style={{ backgroundColor: color.value }}
                            >
                                {isActive && (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>



            {/* Description */}
            <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <FileText size={12} />
                    Description
                </Label>
                <Textarea
                    value={statusConfig?.description || ''}
                    onChange={(e) => updateEdgeStatusConfig({ description: e.target.value })}
                    placeholder="Optional description for this status transition..."
                    className="min-h-[80px] text-sm border-slate-200 focus:border-[var(--brand-red)] focus:ring-[var(--brand-red)]/20 resize-none"
                />
            </div>

            {/* Preview */}
            {statusConfig?.statusName && (
                <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preview</h3>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200">
                        <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: statusConfig.statusColor || '#22c55e' }}
                        />
                        <span className="text-sm font-semibold text-slate-800">{statusConfig.statusName}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
