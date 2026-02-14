import { Check, X, Loader2, Share2, Clock, Hourglass, Circle, ChevronDown, ChevronRight, User, Users } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Card } from '../ui';

export type WorkflowStepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'STARTED' | 'IN_CLARIFICATION' | 'UPCOMING' | 'PENDING' | 'REJECTED' | 'SKIPPED';

// Approval rule with grouped approvers
export interface ApprovalRule {
    ruleName: string;
    approvers: {
        name: string;
        type?: 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION' | string;
        status?: 'PENDING' | 'WAITING' | 'APPROVED' | 'REJECTED' | 'SENDBACK';
        comment?: string;
        timestamp?: string;
        decidedBy?: string;  // Who actually made the decision (for group approvals)
    }[];
}


export interface WorkflowTimelineStep {
    id: string;
    title: string;
    subtitle?: React.ReactNode;
    status: WorkflowStepStatus;
    slaDays?: number;
    /** @deprecated Use approvalRules instead for grouped display */
    approvers?: { name: string; type?: string }[];
    /** Grouped approval rules with rule name and approvers */
    approvalRules?: ApprovalRule[];
}

interface WorkflowTimelineProps {
    title?: string;
    steps: WorkflowTimelineStep[];
    requestStatus?: 'COMPLETED' | 'REJECTED' | 'WITHDRAWN' | string;
    showCompletion?: boolean;
    className?: string;
    isSimulation?: boolean; // New prop to control "Live Simulation" badge
    onStepClick?: (stepId: string) => void;
    selectedStepId?: string;
}

export function WorkflowTimeline({
    title = "Workflow Preview",
    steps,
    requestStatus,
    showCompletion = true,
    className,
    isSimulation,
    onStepClick,
    selectedStepId
}: WorkflowTimelineProps) {
    // Default isSimulation to true if title is "Workflow Preview", otherwise false
    const showSimulationBadge = isSimulation !== undefined ? isSimulation : title === "Workflow Preview";

    // Calculate initial expanded state - auto-expand active steps
    const initialExpandedSteps = useMemo(() => {
        const activeStatuses = ['IN_PROGRESS', 'STARTED', 'IN_CLARIFICATION'];
        return steps.reduce((acc, step) => {
            if (activeStatuses.includes(step.status)) {
                acc[step.id] = true;
            }
            return acc;
        }, {} as Record<string, boolean>);
    }, []); // Empty deps - only calculate once on mount

    const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(initialExpandedSteps);

    const toggleStep = (stepId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent step selection when clicking expand/collapse
        setExpandedSteps(prev => ({
            ...prev,
            [stepId]: !prev[stepId]
        }));
    };

    const getTypeStyles = (status: WorkflowStepStatus) => {
        // ... (existing implementation)
        switch (status) {
            case 'COMPLETED':
                return {
                    bg: 'bg-emerald-500',
                    border: 'border-emerald-500',
                    icon: Check,
                    iconColor: 'text-white',
                    lineColor: 'bg-emerald-500', // Solid background for solid line
                    lineStyle: 'solid'
                };
            case 'REJECTED':
                return {
                    bg: 'bg-rose-500',
                    border: 'border-rose-500',
                    icon: X,
                    iconColor: 'text-white',
                    lineColor: 'bg-rose-500',
                    lineStyle: 'solid'
                };
            case 'IN_PROGRESS':
                return {
                    bg: 'bg-blue-600',
                    border: 'border-blue-600',
                    icon: Loader2,
                    iconColor: 'text-white',
                    lineColor: 'text-blue-200', // Text color for dashed line gradient
                    lineStyle: 'dashed'
                };
            case 'STARTED':
                return {
                    bg: 'bg-white',
                    border: 'border-amber-500',
                    icon: Hourglass,
                    iconColor: 'text-amber-600',
                    lineColor: 'text-amber-200',
                    lineStyle: 'dashed'
                };
            case 'IN_CLARIFICATION':
                return {
                    bg: 'bg-white',
                    border: 'border-purple-500',
                    icon: Loader2,
                    iconColor: 'text-purple-600',
                    lineColor: 'text-purple-200',
                    lineStyle: 'dashed'
                };
            case 'SKIPPED':
                return {
                    bg: 'bg-slate-50',
                    border: 'border-slate-300 border-dashed',
                    icon: Share2,
                    iconColor: 'text-slate-400',
                    lineColor: 'text-slate-200',
                    lineStyle: 'dashed'
                };
            case 'UPCOMING':
            case 'PENDING':
            default:
                return {
                    bg: 'bg-white',
                    border: 'border-slate-200',
                    icon: Circle,
                    iconColor: 'text-slate-300',
                    lineColor: 'text-slate-200',
                    lineStyle: 'dashed'
                };
        }
    };

    // Helper to get completion step styles
    const getCompletionStyles = () => {
        if (requestStatus === 'COMPLETED') {
            return {
                bg: 'bg-emerald-500',
                border: 'border-emerald-500',
                icon: Check,
                iconColor: 'text-white',
                opacity: 'opacity-100'
            };
        }
        if (requestStatus === 'REJECTED') {
            return {
                bg: 'bg-rose-500',
                border: 'border-rose-500',
                icon: X,
                iconColor: 'text-white',
                opacity: 'opacity-100'
            };
        }
        // Default / Pending
        return {
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            icon: Circle, // Changed to Circle
            iconColor: 'text-slate-300',
            opacity: 'opacity-60' // Kept opaque for pending state
        };
    };

    const completionStyle = getCompletionStyles();
    const CompletionIcon = completionStyle.icon;

    return (

        <Card className={`p-6 ${className || ''}`}>
            {/* Header ... */}
            <div className="flex items-center gap-3 mb-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{title}</h3>
                {showSimulationBadge && (
                    <div className="flex items-center gap-2 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Live Simulation</span>
                    </div>
                )}
            </div>

            <div className="relative pl-2">
                <div className="space-y-0">
                    {steps.map((step, idx) => {
                        const isLast = idx === steps.length - 1;
                        const config = getTypeStyles(step.status);
                        const StepIcon = config.icon;
                        const hasApprovers = (step.approvers && step.approvers.length > 0) || (step.approvalRules && step.approvalRules.length > 0);
                        const isExpanded = expandedSteps[step.id];
                        const isSelected = selectedStepId === step.id;

                        return (
                            <div
                                key={step.id}
                                onClick={() => onStepClick?.(step.id)}
                                className={`
                                    relative flex gap-4 pb-8 last:pb-0 -mx-4 px-4 rounded-xl transition-all duration-200 group
                                    ${onStepClick ? 'cursor-pointer' : ''}
                                    ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50/80'}
                                `}
                            >
                                {/* Connector Line */}
                                {(!isLast || showCompletion) && (
                                    <div
                                        className={`absolute left-[27px] top-10 bottom-0 w-0.5 -ml-px ${config.lineColor} ${config.lineStyle === 'dashed' ? 'opacity-60' : ''}`}
                                        style={config.lineStyle === 'dashed' ? {
                                            backgroundImage: `linear-gradient(to bottom, currentColor 50%, transparent 50%)`,
                                            backgroundSize: '2px 8px',
                                            backgroundColor: 'transparent'
                                        } : {}}
                                    />
                                )}

                                <div className="relative z-10 flex-none pt-1">
                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center border
                                        ${config.bg} ${config.border} ${config.iconColor}
                                        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                                        ${!isSelected && step.status === 'IN_PROGRESS' ? 'ring-4 ring-blue-50 shadow-lg shadow-blue-100 scale-110' : ''}
                                        ${!isSelected && step.status === 'STARTED' ? 'ring-4 ring-amber-50 shadow-lg shadow-amber-100 scale-110' : ''}
                                        ${!isSelected && step.status === 'IN_CLARIFICATION' ? 'ring-4 ring-purple-50 shadow-lg shadow-purple-100 scale-110' : ''}
                                        transition-all duration-300 z-20
                                    `}>
                                        <StepIcon className={`w-3.5 h-3.5 ${step.status === 'IN_PROGRESS' || step.status === 'IN_CLARIFICATION' ? 'animate-spin' : ''}`} />
                                    </div>
                                </div>
                                <div className="pt-0.5 flex-1 pl-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className={`
                                                text-sm flex items-center gap-2 transition-colors duration-200
                                                ${isSelected ? 'text-blue-700 font-bold' : (step.status === 'IN_PROGRESS' || step.status === 'COMPLETED' ? 'font-bold text-slate-900' : 'font-medium text-slate-500')}
                                                ${!isSelected && step.status === 'STARTED' ? 'font-bold text-amber-700' : ''}
                                                ${!isSelected && step.status === 'UPCOMING' ? 'text-slate-400 font-normal' : ''}
                                            `}>
                                                {step.title}
                                                {hasApprovers && (
                                                    <span
                                                        onClick={(e) => toggleStep(step.id, e)}
                                                        className={`
                                                            text-slate-400 hover:text-slate-600 transition-all duration-200 cursor-pointer p-1 rounded hover:bg-slate-200/50
                                                            ${isExpanded ? 'rotate-180 text-slate-600' : 'rotate-0'}
                                                        `}
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </p>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {step.subtitle}
                                            </div>
                                            {step.slaDays && (
                                                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <Clock className="w-3 h-3" />
                                                    <span>SLA: {step.slaDays} days</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Approval Rules - Hierarchical Display */}
                                    {hasApprovers && isExpanded && (
                                        <div className="mt-3 space-y-2">
                                            {/* New grouped format: approvalRules */}
                                            {step.approvalRules?.map((rule, rIdx) => (
                                                <div
                                                    key={rIdx}
                                                    className="bg-slate-50/80 rounded-md px-3 py-2 border border-slate-100"
                                                >
                                                    {/* Rule Name - Primary */}
                                                    <p className="text-xs font-medium text-slate-700 mb-1.5">
                                                        {rule.ruleName}
                                                    </p>
                                                    {/* Approvers - Secondary */}
                                                    <div className="space-y-1 pl-2">
                                                        {rule.approvers.map((approver, aIdx) => (
                                                            <div
                                                                key={aIdx}
                                                                className="flex flex-col gap-1"
                                                            >
                                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {['ROLE', 'GROUP', 'TEAM'].includes(approver.type as string) ? (
                                                                            <Users className="w-2.5 h-2.5 text-slate-400" />
                                                                        ) : (
                                                                            <User className="w-2.5 h-2.5 text-slate-400" />
                                                                        )}
                                                                        <span className="font-medium">{approver.name}</span>
                                                                        {/* Status Badge */}
                                                                        {approver.status && (
                                                                            <span className={`
                                                                                ml-1 px-1.5 py-0.5 rounded text-[8px] font-medium uppercase
                                                                                ${approver.status === 'PENDING' ? 'bg-blue-100 text-blue-700' : ''}
                                                                                ${approver.status === 'WAITING' ? 'bg-slate-100 text-slate-500' : ''}
                                                                                ${approver.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : ''}
                                                                                ${approver.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : ''}
                                                                                ${approver.status === 'SENDBACK' ? 'bg-amber-100 text-amber-700' : ''}
                                                                            `}>
                                                                                {approver.status}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {approver.timestamp && (
                                                                        <span className="text-[9px] text-slate-400">
                                                                            {new Date(approver.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Show who actually approved/rejected for group assignments */}
                                                                {approver.decidedBy && ['ROLE', 'GROUP', 'TEAM'].includes(approver.type as string) && (approver.status === 'APPROVED' || approver.status === 'REJECTED') && (
                                                                    <div className={`text-[9px] pl-4 flex items-center gap-1 ${approver.status === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        <User className="w-2.5 h-2.5" />
                                                                        <span>{approver.status === 'APPROVED' ? 'Approved' : 'Rejected'} by: {approver.decidedBy}</span>
                                                                    </div>
                                                                )}
                                                                {approver.comment && (
                                                                    <div className="text-[9px] text-slate-500 italic pl-5 text-left border-l-2 border-slate-200 ml-1">
                                                                        &quot;{approver.comment}&quot;
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Legacy flat format fallback */}
                                            {!step.approvalRules && step.approvers?.map((approver, aIdx) => (
                                                <div key={aIdx} className="flex items-center gap-2 text-xs text-slate-600 pl-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                    <User className="w-3 h-3 text-slate-400" />
                                                    <span className="font-medium">{approver.name}</span>
                                                    {approver.type && (
                                                        <span className="text-slate-400 text-[10px] uppercase border border-slate-200 px-1 rounded">
                                                            {approver.type}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Completion Step */}
                    {showCompletion && (
                        <div className="flex gap-4 pt-8 -mx-4 px-4">
                            <div className="relative z-10 flex-none pt-1 ml-4">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${completionStyle.bg} ${completionStyle.border}`}>
                                    {requestStatus === 'COMPLETED' || requestStatus === 'REJECTED' ? (
                                        <CompletionIcon className={`w-3.5 h-3.5 ${completionStyle.iconColor}`} />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                    )}
                                </div>
                            </div>
                            <div className={`${completionStyle.opacity} pt-0.5`}>
                                <p className="text-sm font-medium text-slate-900">Completion</p>
                                {requestStatus === 'COMPLETED' && <p className="text-xs text-emerald-600">Request Completed</p>}
                                {requestStatus === 'REJECTED' && <p className="text-xs text-rose-600">Request Rejected</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
