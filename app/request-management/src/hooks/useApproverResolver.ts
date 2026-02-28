import { useMemo } from 'react';
import { resolveApproversForStep } from '@/utils/approverResolver';
import type { UiRule } from '@/features/studio/types';
import type { RequestTypeConfig, FormData, StepDefinition, ApproverRule, ResolvedApproversMap } from '@/types';

/**
 * Custom hook for real-time approver resolution based on form data.
 * 
 * @param requestType - The request type with steps and approver rules
 * @param formData - Current form field values (e.g., { priority: 'HIGH' })
 * @returns Map of stepId to resolved approvers
 */
export function useApproverResolver(
    requestType: RequestTypeConfig | null | undefined,
    formData: FormData
): ResolvedApproversMap {
    // Flatten all approval rules from steps
    const allApproverRules: UiRule[] = useMemo(() => {
        const steps = requestType?.steps || [];
        return steps.flatMap((step: StepDefinition) =>
            (step.approverRules || []).map((rule: ApproverRule) => ({
                id: rule.ID,
                stepId: step.ID,
                name: (rule as any).description || `Rule #${(rule as any).priority}`,
                priority: (rule as any).priority,
                conditions: (() => {
                    try {
                        const parsed = (rule as any).conditionExpr ? JSON.parse((rule as any).conditionExpr) : {};
                        return parsed.conditions || [];
                    } catch {
                        return [];
                    }
                })(),
                assignTo: rule.approverValue || (rule as any).principalId || '',
                // Robust display name: prefer explicit name, then backend virtual field, then empty (let consumer handle fallback)
                assignToName: rule.approverDisplayName?.trim() || (rule as any).principalDisplayName?.trim() || '',
                assignType: rule.approverType?.toLowerCase() || (rule as any).principalType?.toLowerCase() || 'role',
                isActive: true,
                expanded: false,
                isFinal: (rule as any).isFinal ?? false
            }))
        );
    }, [requestType?.steps]);

    // Enrich formData with system fields
    const enrichedFormData = useMemo(() => ({
        ...formData,
        __request_priority: formData.priority || 'MEDIUM'
    }), [formData]);

    // Resolve approvers for all steps
    const resolvedApprovers = useMemo(() => {
        const result: ResolvedApproversMap = {};
        const steps = requestType?.steps || [];

        steps.forEach((step: StepDefinition) => {
            result[step.ID] = resolveApproversForStep(
                allApproverRules,
                step.ID,
                enrichedFormData
            );
        });

        return result;
    }, [requestType?.steps, allApproverRules, enrichedFormData]);

    return resolvedApprovers;
}

