import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

interface Step {
    id: string;
    name: string;
    order: number;
    role?: string;
}

interface LeftPanelProps {
    description?: string;
    steps: Step[];
    activeStepId: string | null;
    onStepSelect: (stepId: string) => void;
    onAddStep: () => void;
    isCollapsed?: boolean;
    /** Optional extra content rendered below the steps list (e.g. SchemaPalette) */
    children?: ReactNode;
}

/**
 * Get 2-letter abbreviation from step name
 * e.g., "Define Plant" -> "DP", "Finance Setup" -> "FS"
 */
function getAbbreviation(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export function LeftPanel({
    description,
    steps,
    activeStepId,
    onStepSelect,
    onAddStep,
    isCollapsed = false,
    children
}: LeftPanelProps) {
    return (
        <div className="flex flex-col h-full ">
            {/* Description - Hidden when collapsed */}
            {!isCollapsed && description && (
                <div className="px-4 py-3 border-b border-slate-200">
                    <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                </div>
            )}

            {/* Steps Section */}
            <div className={children ? "overflow-y-auto" : "flex-1 overflow-y-auto"}>
                {/* Steps Header - with inline Add button when Schema tab active */}
                {!isCollapsed && (
                    <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Steps
                        </span>
                        {children && (
                            <button
                                onClick={onAddStep}
                                className="flex items-center gap-1 text-xs font-medium text-[#b10e10] hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                            >
                                <Plus size={14} />
                                <span>Step</span>
                            </button>
                        )}
                    </div>
                )}

                <div className="px-2 space-y-1">
                    {steps.map((step) => (
                        <motion.button
                            key={step.id}
                            onClick={() => onStepSelect(step.id)}
                            className={`
                                w-full flex items-center gap-3 rounded-lg transition-all
                                ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}
                                ${activeStepId === step.id
                                    ? 'bg-[#b10e10] text-white'
                                    : 'hover:bg-slate-100 text-slate-700'
                                }
                            `}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            title={isCollapsed ? step.name : undefined}
                        >
                            {/* Step Number/Abbreviation */}
                            <div className={`
                                flex items-center justify-center flex-shrink-0
                                ${isCollapsed ? 'w-10 h-10 text-sm font-bold' : 'w-6 h-6 text-xs font-semibold'}
                                ${activeStepId === step.id
                                    ? 'bg-white/20 rounded-md'
                                    : 'bg-slate-200 rounded-md'
                                }
                            `}>
                                {isCollapsed ? getAbbreviation(step.name) : step.order}
                            </div>

                            {/* Step Details - Hidden when collapsed */}
                            {!isCollapsed && (
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-medium truncate">{step.name}</div>
                                    {step.role && (
                                        <div className={`text-xs truncate ${activeStepId === step.id ? 'text-white/70' : 'text-slate-400'}`}>
                                            {step.role}
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Extra Content (e.g. Schema Palette) - placed between steps and add button */}
            {children && (
                <div className="flex-1 overflow-y-auto border-t border-slate-200 px-3 py-3">
                    {children}
                </div>
            )}
            {/* Add Step Button - only shown when NOT in schema mode (no children) */}
            {!children && (
                <div className={`p-3 border-t border-slate-200 ${isCollapsed ? 'flex justify-center' : ''}`}>
                    <motion.button
                        onClick={onAddStep}
                        className={`
                            flex items-center justify-center gap-2 rounded-lg font-medium transition-all
                            text-[#b10e10] border border-[#b10e10] hover:bg-red-50
                            ${isCollapsed ? 'w-10 h-10' : 'w-full py-2 text-sm'}
                        `}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        title={isCollapsed ? "Add New Step" : undefined}
                    >
                        <Plus size={isCollapsed ? 20 : 16} />
                        {!isCollapsed && <span>Add New Step</span>}
                    </motion.button>
                </div>
            )}

        </div>
    );
}

