import { User, Clock, Users } from 'lucide-react';
import { Card } from '../../../../components/ui';
import { PrincipalSelect, type Principal } from '../../../../components/shared/PrincipalSelect';
import type { StepDefinition } from '../../../../types';

interface StepAssignmentHeaderProps {
    step: StepDefinition | null;
    stepOwnerValue: Principal | null;
    onStepOwnerChange: (principal: Principal | null) => void;
}

/**
 * Step Assignment Header
 * 
 * Displays step-level metadata and allows editing the step owner.
 * Appears above the dynamic form sections to provide context about
 * which step is being filled and who is responsible.
 */
export function StepAssignmentHeader({
    step,
    stepOwnerValue,
    onStepOwnerChange
}: StepAssignmentHeaderProps) {
    if (!step) return null;

    return (
        <Card className="border-l-4 border-l-amber-500">
            <div className="bg-gradient-to-r from-amber-50 to-white px-6 py-4 border-b border-amber-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                Step: {step.stepName}
                            </h2>
                            <p className="text-sm text-slate-500">
                                Data entry required for this step
                            </p>
                        </div>
                    </div>

                    {/* SLA Badge */}
                    {step.slaDays && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                            <Clock className="w-4 h-4" />
                            <span>{step.slaDays} days SLA</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-6 py-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step Owner Picker */}
                    <div className="relative z-20">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            Step Owner
                        </label>
                        <PrincipalSelect
                            value={stepOwnerValue}
                            onChange={onStepOwnerChange}
                            placeholder="Assign step owner (optional)"
                        />
                        <p className="text-xs text-slate-500 mt-1.5">
                            Person or group responsible for completing this step's data entry
                        </p>
                    </div>

                    {/* Due Date (calculated from SLA - read only) */}
                    {step.slaDays && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                Target Due Date
                            </label>
                            <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-slate-600">
                                {new Date(Date.now() + step.slaDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5">
                                Based on {step.slaDays} day SLA from submission
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
