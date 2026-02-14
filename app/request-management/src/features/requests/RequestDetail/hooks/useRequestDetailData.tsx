import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, User } from 'lucide-react';
import { api } from '../../../../lib/api';
import { DEV_USERS, DEV_GROUPS } from '../../../../lib/auth-context';
import { useApproverResolver } from '../../../../hooks/useApproverResolver';
import { parseSchemaContent } from '../../../../lib/schemaParser';
import type { WorkflowTimelineStep } from '../../../../components/shared';
import type { RequestDetailData, HistoryItem, Step, mapStepStatus } from '../types';
import { mapStepStatus as mapStatus } from '../types';

/**
 * Custom hook for fetching and managing request detail data
 */
export function useRequestDetailData(id: string | undefined) {
    // Fetch request details with expanded request type and steps
    const { data: request, isLoading } = useQuery({
        queryKey: ['request', id],
        queryFn: async () => {
            const response = await api.get(
                `/browse/Requests(${id})?$expand=requestType($expand=steps($expand=approverRules)),steps($expand=approvals,stepDefinition,data,claimedBy)`
            );
            return response.data as RequestDetailData;
        },
        enabled: !!id,
    });

    // Fetch unified audit log
    const { data: auditLog } = useQuery({
        queryKey: ['auditLog', id],
        queryFn: async () => {
            const response = await api.get(
                `/browse/getAuditLog(requestId=${id})`
            );
            return response.data.value as HistoryItem[];
        },
        enabled: !!id,
    });

    // Extract start step and form data
    const startStep = request?.steps?.find((s: Step) => s.stepDefinition?.isStartStep) || request?.steps?.[0];
    const startStepData = useMemo(() => {
        if (!startStep?.data?.payload) return null;
        try {
            return JSON.parse(startStep.data.payload);
        } catch {
            return null;
        }
    }, [startStep?.data?.payload]);

    // Form data state
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [stepFormData, setStepFormData] = useState<Record<string, any>>({});
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

    // Initialize formData when startStepData is loaded
    useEffect(() => {
        if (startStepData) {
            setFormData(startStepData);
        }
    }, [startStepData]);

    // Initialize selectedStepId to the active step
    // Priority: 1. Step with pending approvals, 2. Data entry/active step, 3. Start step
    useEffect(() => {
        if (request?.steps && !selectedStepId) {
            const steps = request.steps;

            // First priority: Step with pending approvals (group approval scenario)
            const stepWithPendingApproval = steps.find((s: Step) =>
                (s.status === 'PENDING' || s.status === 'IN_PROGRESS') &&
                s.approvals?.some((a: any) => a.status === 'PENDING')
            );

            if (stepWithPendingApproval) {
                setSelectedStepId(stepWithPendingApproval.stepDefinition_ID || null);
                return;
            }

            // Second priority: Active data entry steps
            const activeStep = steps.find((s: Step) =>
                s.status === 'STARTED' ||
                s.status === 'IN_PROGRESS' ||
                s.status === 'IN_CLARIFICATION'
            );

            if (activeStep) {
                setSelectedStepId(activeStep.stepDefinition_ID || null);
            } else {
                const startStep = steps.find((s: Step) => s.stepDefinition?.isStartStep) || steps[0];
                if (startStep) {
                    setSelectedStepId(startStep.stepDefinition_ID || null);
                }
            }
        }
    }, [request, selectedStepId]);

    // Sort steps for timeline
    const sortedSteps = useMemo(() => {
        return request?.steps?.slice().sort((a, b) => {
            if (a.stepDefinition?.isStartStep && !b.stepDefinition?.isStartStep) return -1;
            if (!a.stepDefinition?.isStartStep && b.stepDefinition?.isStartStep) return 1;
            return 0;
        }) || [];
    }, [request?.steps]);

    // Get schema items - render exactly as defined in the Form Schema
    const schemaItems = useMemo(() => {
        const startStepSchema = request?.requestType?.steps?.find(s => s.isStartStep) || request?.requestType?.steps?.[0];
        return parseSchemaContent(startStepSchema?.schemaContent);
    }, [request?.requestType?.steps]);

    // Use approver resolver
    const approverContext = {
        ...startStepData,
        ...formData,
        title: request?.title,
        description: request?.description,
        priority: request?.priority
    };
    const resolvedApprovers = useApproverResolver(request?.requestType, approverContext);

    // Build a map of known user IDs to display names from all available sources
    const knownUsers = useMemo(() => {
        const map = new Map<string, string>();

        // 1. From Request Coordinator
        if (request?.coordinatorId && request?.coordinatorDisplayName) {
            map.set(request.coordinatorId, request.coordinatorDisplayName);
        }

        // 2. From Audit Log
        if (auditLog) {
            auditLog.forEach(item => {
                if (item.actorId && item.actor) {
                    map.set(item.actorId, item.actor);
                }
            });
        }

        // 3. From Approvals (Snapshots)
        if (request?.steps) {
            request.steps.forEach(step => {
                if (step.approvals) {
                    step.approvals.forEach(app => {
                        if (app.approver && app.approverDisplayName) {
                            map.set(app.approver, app.approverDisplayName);
                        }
                        if (app.decidedByDisplayName) {
                            // decidedBy is an association, ID might not be easily available here unless expanded deeply
                            // but decidedByDisplayName is useful if we had the ID.
                        }
                    });
                }
                // Also check if step has an owner name resolved
                if (step.ownerId && step.ownerDisplayName && step.ownerDisplayName !== step.ownerId) {
                    map.set(step.ownerId, step.ownerDisplayName);
                }
            });
        }

        return map;
    }, [request, auditLog]);

    // Prepare workflow timeline steps
    const workflowSteps: WorkflowTimelineStep[] = useMemo(() => {
        const allStepDefinitions = request?.requestType?.steps || [];

        return allStepDefinitions.map((stepDef) => {
            const runtimeStep = sortedSteps.find(s => s.stepDefinition_ID === stepDef.ID);
            const stepResolvedApprovers = resolvedApprovers[stepDef.ID] || [];
            const completedApprovals = runtimeStep?.approvals?.filter(a => a.status === 'APPROVED' || a.status === 'REJECTED') || [];
            const status = runtimeStep?.status || 'UPCOMING';

            // Check for re-approval condition
            const hasPastActivity = auditLog?.some(l =>
                l.stepName === stepDef.stepName &&
                (l.action === 'SEND_BACK' || l.action === 'COMPLETE' || l.action === 'AUTO_COMPLETE')
            );
            const isReapproval = hasPastActivity && (status === 'IN_PROGRESS' || status === 'PENDING' || status === 'STARTED');

            const stepSchema = parseSchemaContent(stepDef.schemaContent);
            const hasSchema = stepSchema.length > 0;

            const getSubtitle = () => {
                const statusUpper = status?.toUpperCase();
                let statusBadge;

                if (isReapproval) {
                    statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            Re-approval Needed
                        </span>
                    );
                } else if (statusUpper === 'COMPLETED' && completedApprovals.length > 0) {
                    // Prefer decidedByDisplayName (actual decider) over approverDisplayName (assigned approver)
                    const approverName = completedApprovals[0].decidedByDisplayName ||
                        completedApprovals[0].approverDisplayName ||
                        completedApprovals[0].approver;
                    statusBadge = <span className="text-emerald-600 font-medium">Approved by {approverName}</span>;
                } else if (statusUpper === 'REJECTED' && completedApprovals.length > 0) {
                    const approverName = completedApprovals[0].decidedByDisplayName ||
                        completedApprovals[0].approverDisplayName ||
                        completedApprovals[0].approver;
                    statusBadge = <span className="text-rose-600 font-medium">Rejected by {approverName}</span>;
                } else if (statusUpper === 'IN_PROGRESS') {
                    statusBadge = <span className="text-blue-600 font-medium">In Progress</span>;
                } else if (statusUpper === 'STARTED') {
                    if (!hasSchema) {
                        statusBadge = <span className="text-blue-600 font-medium">Review Pending</span>;
                    } else {
                        statusBadge = <span className="text-amber-600 font-medium">Data entry required</span>;
                    }
                } else if (statusUpper === 'IN_CLARIFICATION') {
                    statusBadge = <span className="text-purple-600 font-medium">Clarification needed</span>;
                } else if (statusUpper === 'SKIPPED') {
                    statusBadge = <span className="text-slate-500">Skipped</span>;
                } else {
                    statusBadge = <span className="text-slate-500">Upcoming</span>;
                }

                // Determine Step Owner
                // Prioritize runtime step owner (if assigned), then definition default
                const ownerId = runtimeStep?.ownerId || stepDef.ownerId;
                let ownerDisplayName = runtimeStep?.ownerDisplayName || stepDef.ownerDisplayName;

                // Resolution Logic:
                // 1. If we have a name that looks like a UUID (or is missing), try to resolve it using knownUsers map
                const isUuid = (text: string | undefined) => text && text.length > 30 && /^[0-9a-fA-F-]+$/.test(text);

                if (!ownerDisplayName || isUuid(ownerDisplayName)) {
                    if (ownerId && knownUsers.has(ownerId)) {
                        ownerDisplayName = knownUsers.get(ownerId);
                    }
                }

                // 2. If we still have a UUID/missing name, and it matches the fallback coordinator logic
                if ((!ownerDisplayName || isUuid(ownerDisplayName)) && ownerId && request?.coordinatorId && ownerId === request.coordinatorId) {
                    ownerDisplayName = request.coordinatorDisplayName;
                }

                // 3. Fallback to Dev Users/Groups configuration for name resolution
                if ((!ownerDisplayName || isUuid(ownerDisplayName)) && ownerId) {
                    const devUser = DEV_USERS.find(u => u.id === ownerId);
                    const devGroup = DEV_GROUPS.find(g => g.id === ownerId);

                    if (devUser) {
                        ownerDisplayName = devUser.name;
                    } else if (devGroup) {
                        ownerDisplayName = devGroup.name;
                    }
                }

                // 4. Final Fallback: ID or "Request Coordinator" (implied)
                if ((!ownerDisplayName || isUuid(ownerDisplayName)) && !ownerDisplayName) {
                    // Try ID as last resort if not UUID, otherwise stay empty? 
                    // If ownerId is present but we can't resolve it, showing it is technically correct debugging but bad UX.
                    // Let's use the ID if we have nothing else, as hiding it might be misleading.
                    ownerDisplayName = ownerId;
                }

                return (
                    <div className="space-y-1">
                        <div>{statusBadge}</div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            {ownerDisplayName ? (
                                <span>{ownerDisplayName}</span>
                            ) : (
                                <span className="italic">Request Coordinator</span>
                            )}
                        </div>
                    </div>
                );
            };

            return {
                id: stepDef.ID,
                title: stepDef.stepName || 'Unknown Step',
                status: mapStatus(status),
                subtitle: getSubtitle(),
                slaDays: stepDef.slaDays,
                approvalRules: runtimeStep?.approvals && runtimeStep.approvals.length > 0
                    ? runtimeStep.approvals.map(approval => ({
                        ruleName: approval.ruleName || approval.approverDisplayName || approval.approver,
                        approvers: [{
                            name: approval.approverDisplayName || approval.approver,
                            type: (approval.approverType || 'ROLE') as 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION',
                            status: approval.status as 'PENDING' | 'WAITING' | 'APPROVED' | 'REJECTED' | 'SENDBACK',
                            comment: approval.comment,
                            timestamp: approval.decisionAt,
                            decidedBy: approval.decidedByDisplayName  // Who actually made the decision
                        }]
                    }))
                    : stepResolvedApprovers.length > 0
                        ? stepResolvedApprovers.map(resolved => ({
                            ruleName: resolved.ruleName,
                            approvers: [{
                                name: resolved.approverValue, // Fallback to ID
                                type: (resolved.approverType?.toUpperCase() || 'ROLE') as 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION'
                            }]
                        }))
                        : undefined
            };
        });
    }, [request?.requestType?.steps, sortedSteps, resolvedApprovers, auditLog]);

    // Determine current step for actions
    // Priority: 1. User-selected step, 2. Step with pending approval for current user, 3. Active data entry step
    const currentStep = useMemo(() => {
        if (selectedStepId) {
            return sortedSteps.find(s => s.stepDefinition_ID === selectedStepId);
        }

        // First, check for steps with PENDING approvals (approval steps assigned to groups/users)
        const stepWithPendingApproval = sortedSteps.find(s =>
            (s.status === 'PENDING' || s.status === 'IN_PROGRESS') &&
            s.approvals?.some(a => a.status === 'PENDING')
        );
        if (stepWithPendingApproval) {
            return stepWithPendingApproval;
        }

        // Then check for active data entry steps
        return sortedSteps.find(s => {
            if (['IN_PROGRESS', 'IN_CLARIFICATION'].includes(s.status)) return true;
            if (s.status === 'STARTED') {
                const stepDef = request?.requestType?.steps?.find(d => d.ID === s.stepDefinition_ID);
                const schema = parseSchemaContent(stepDef?.schemaContent);
                return schema.length === 0;
            }
            return false;
        });
    }, [selectedStepId, sortedSteps, request?.requestType?.steps]);

    // Check if current step is pure review (no schema)
    const isPureReviewStep = useMemo(() => {
        if (currentStep?.status === 'STARTED') {
            const stepDef = request?.requestType?.steps?.find(d => d.ID === currentStep.stepDefinition_ID);
            const schema = parseSchemaContent(stepDef?.schemaContent);
            return schema.length === 0;
        }
        return false;
    }, [currentStep, request?.requestType?.steps]);



    // Find step in clarification
    const stepInClarification = useMemo(() => {
        return sortedSteps?.find(s => s.status === 'IN_CLARIFICATION');
    }, [sortedSteps]);

    const clarificationComment = stepInClarification?.approvals?.find(a => a.status === 'SENDBACK')?.comment;

    return {
        request,
        auditLog,
        isLoading,
        startStep,
        startStepData,
        formData,
        setFormData,
        stepFormData,
        setStepFormData,
        selectedStepId,
        setSelectedStepId,
        sortedSteps,
        schemaItems,
        workflowSteps,
        resolvedApprovers,
        currentStep,
        isPureReviewStep,
        stepInClarification,
        clarificationComment,
    };
}
