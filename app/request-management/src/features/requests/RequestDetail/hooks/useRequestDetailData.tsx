import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, User } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useApproverResolver } from '../../../../hooks/useApproverResolver';
import { usePrincipalNames } from '../../../../hooks/usePrincipalNames';
import { parseSchemaContent } from '../../../../lib/schemaParser';
import { useAuth, isGroupLikeType, checkIsGroupMember } from '../../../../lib/auth-context';
import type { WorkflowTimelineStep } from '../../../../components/shared';
import { sortStepsTopologically } from '../../../../lib/workflowUtils';
import { resolveStepOutcomeBusinessStatus } from '../../../../lib/statusFlowResolver';
import type { RequestDetailData, HistoryItem, Step } from '../types';
import { mapStepStatus as mapStatus } from '../types';

/**
 * Custom hook for fetching and managing request detail data
 */
export function useRequestDetailData(id: string | undefined) {
    const { currentUserId } = useAuth();
    // Fetch request details with expanded request type and steps
    const { data: request, isLoading, isFetching } = useQuery({

        queryKey: ['request', id],
        queryFn: async () => {
            const response = await api.get(
                `/browse/Requests(${id})?$expand=requestType($expand=steps($expand=approverRules,predecessors)),steps($expand=approvals,stepDefinition,data,claimedBy)`
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

    // Reset transient state when switching requests
    useEffect(() => {
        setFormData({});
        setStepFormData({});
        setSelectedStepId(null);
    }, [id]);

    // Pre-initialize stepFormData from server payloads when request is loaded
    useEffect(() => {
        if (!request?.steps) return;

        setStepFormData(prev => {
            if (!request?.steps) return prev;
            const next = { ...prev };
            let hasChanged = false;

            request.steps.forEach(step => {
                if (step.ID && step.data?.payload) {
                    try {
                        const payload = JSON.parse(step.data.payload);
                        // Only initialize if not already in state (to avoid overwriting user edits)
                        // This ensures that mapped data from server is picked up immediately.
                        if (!next[step.ID]) {
                            next[step.ID] = payload;
                            hasChanged = true;
                        }
                    } catch (e) {
                        console.warn(`Failed to parse payload for step ${step.ID}`, e);
                    }
                }
            });

            return hasChanged ? next : prev;
        });
    }, [request?.steps]);

    // Handle Input Mapping propagation for the selected step
    useEffect(() => {
        if (!selectedStepId || !request?.requestType?.steps || !request?.steps) return;

        const currentStep = request.steps.find(s => s.ID === selectedStepId);
        const currentStepDef = request.requestType.steps.find(s => s.ID === currentStep?.stepDefinition_ID);
        if (!currentStepDef?.inputMapping) return;

        try {
            const mapping = JSON.parse(currentStepDef.inputMapping);
            const resolvedMappingData: Record<string, any> = {};
            let hasChanges = false;

            Object.entries(mapping).forEach(([targetFieldId, mapInfo]: [string, any]) => {
                const { sourceStepId, sourceFieldId } = mapInfo;

                // Find the source step in runtime steps
                const sourceStep = request.steps?.find(s => s.stepDefinition_ID === sourceStepId);
                if (sourceStep?.data?.payload) {
                    try {
                        const sourcePayload = JSON.parse(sourceStep.data.payload);
                        const sourceValue = sourcePayload[sourceFieldId];

                        if (sourceValue !== undefined) {
                            resolvedMappingData[targetFieldId] = sourceValue;
                            hasChanges = true;
                        }
                    } catch (e) {
                        console.warn('Failed to parse source payload', e);
                    }
                }
            });

            if (hasChanges) {
                setStepFormData(prev => ({
                    ...prev,
                    [selectedStepId]: {
                        ...resolvedMappingData,
                        ...(prev[selectedStepId] || {}) // Keep user edits if any
                    }
                }));
            }
        } catch (e) {
            console.error('Failed to resolve input mapping', e);
        }
    }, [selectedStepId, request?.steps, request?.requestType?.steps]);

    // Initialize selectedStepId to the active step
    // Priority: 1. Step with pending approvals, 2. Data entry/active step, 3. Start step
    useEffect(() => {
        if (request?.steps && !selectedStepId && currentUserId) {
            const steps = request.steps;

            // 1. Try to find a step where the current user is an approver or owner
            const actionableStep = steps.find((s: Step) => {
                const isStarted = s.status === 'STARTED' || s.status === 'IN_PROGRESS' || s.status === 'IN_CLARIFICATION';
                if (!isStarted) return false;

                // Check approvals
                const hasMyApproval = s.approvals?.some((a: any) =>
                    (a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED') && (
                        (a.approverType === 'USER' && a.approver === currentUserId) ||
                        (currentUserId && a.approver && isGroupLikeType(a.approverType) && checkIsGroupMember(currentUserId, a.approver))
                    )
                );
                if (hasMyApproval) return true;

                // Check ownership
                const isMyOwnership = (s.ownerId === currentUserId) || (currentUserId && s.ownerId && isGroupLikeType(s.ownerType) && checkIsGroupMember(currentUserId, s.ownerId));
                if (isMyOwnership) return true;

                return false;
            });

            if (actionableStep) {
                setSelectedStepId(actionableStep.ID || null);
                return;
            }

            // 2. Fallback: If no actionable step, just show the Start Step (requester view)
            const startStep = steps.find((s: Step) => s.stepDefinition?.isStartStep) || steps[0];
            if (startStep) {
                setSelectedStepId(startStep.ID || null);
            }
        }
    }, [request, selectedStepId, currentUserId]);

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

    // Consolidate data for real-time rule evaluation
    // Merges: 
    // 1. Initial/Start form data (formData)
    // 2. Persisted data from all steps in request records
    // 3. Live, unsaved changes currently in the UI (stepFormData)
    const approverContext = useMemo(() => {
        let combinedData: Record<string, any> = {
            ...formData,
            title: request?.title,
            description: request?.description,
            priority: request?.priority,
            __request_priority: request?.priority || 'MEDIUM'
        };

        // Merge persisted data from all steps
        if (request?.steps) {
            request.steps.forEach(step => {
                if (step.data?.payload) {
                    try {
                        const parsed = JSON.parse(step.data.payload);
                        combinedData = { ...combinedData, ...parsed };
                    } catch (e) {
                        console.warn(`Failed to parse step ${step.ID} data`, e);
                    }
                }
            });
        }

        // Merge live, unsaved edits from the UI
        Object.values(stepFormData).forEach(liveData => {
            combinedData = { ...combinedData, ...liveData };
        });

        return combinedData;
    }, [formData, request, stepFormData]);

    const resolvedApprovers = useApproverResolver(request?.requestType as any, approverContext);

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

        // 4. From RequestType ApproverRules (principalId → principalDisplayName)
        //    Ensures pre-submission workflow preview shows names instead of UUIDs
        if (request?.requestType?.steps) {
            request.requestType.steps.forEach(stepDef => {
                (stepDef.approverRules || []).forEach((rule: any) => {
                    if (rule.principalId && rule.principalDisplayName) {
                        map.set(rule.principalId, rule.principalDisplayName);
                    }
                    // Legacy shape fallback (older projections/services)
                    if (rule.approverValue && rule.approverDisplayName) {
                        map.set(rule.approverValue, rule.approverDisplayName);
                    }
                });
            });
        }

        return map;
    }, [request, auditLog]);

    // Augment knownUsers with dynamically fetched principal names
    // for UUIDs produced by the client-side approver resolver.
    const enrichedKnownUsers = usePrincipalNames(resolvedApprovers, knownUsers);

    // Resolve principal display names for timeline rows (approvers/owners).
    const resolvePrincipalName = (id?: string, explicitName?: string) => {
        if (explicitName && explicitName !== id) return explicitName;
        if (!id) return id;

        const known = enrichedKnownUsers.get(id);
        if (known) return known;

        return id;
    };

    // Shared helper: resolve a step's schema items using schemaContent OR formId → formSchemasContent
    const resolveStepSchema = (stepDef: any) => {
        // 1. Direct schemaContent (legacy)
        const direct = parseSchemaContent(stepDef?.schemaContent);
        if (direct.length > 0) return direct;

        // 2. Resolve via formId → formSchemasContent
        if (stepDef?.formId && request?.requestType?.formSchemasContent) {
            try {
                const forms = JSON.parse(request.requestType.formSchemasContent);
                const assignedForm = forms.find((f: any) => f.id === stepDef.formId);
                if (assignedForm?.items) return parseSchemaContent(JSON.stringify(assignedForm.items));
            } catch { /* ignore */ }
        }
        return [];
    };

    // Prepare workflow timeline steps
    const workflowSteps: WorkflowTimelineStep[] = useMemo(() => {
        const allStepDefinitions = sortStepsTopologically(request?.requestType?.steps || [])
            .filter(stepDef => stepDef.stepType !== 'end');

        const statusFlowContent = (request?.requestType as any)?.statusFlowContent as string | null | undefined;

        return allStepDefinitions.map((stepDef) => {
            const runtimeStep = sortedSteps.find(s => s.stepDefinition_ID === stepDef.ID);
            const stepResolvedApprovers = resolvedApprovers[stepDef.ID] || [];
            const completedApprovals = runtimeStep?.approvals?.filter(a => a.status === 'APPROVED' || a.status === 'REJECTED') || [];

            // Determine base status
            let status = runtimeStep?.status || 'UPCOMING';

            // Determination of completion:
            // 1. Backend says COMPLETED
            // 2. It's a data-entry step (no approvals), has been STARTED, and has data
            const hasData = !!runtimeStep?.data?.payload;
            const isDataEntryOnly = (stepDef.actionSubType === 'form' ||
                (stepDef.isStartStep && (stepDef.approverRules?.length || 0) === 0));

            if (isDataEntryOnly && hasData && (status === 'STARTED' || status === 'IN_PROGRESS' || status === 'PENDING')) {
                status = 'COMPLETED';
            }

            // Force REJECTED status if there's an explicit rejection record or action
            const isTechnicalReject = runtimeStep?.approvals?.some(a => a.status === 'REJECTED');

            // Re-resolve branch intent from action label/variant if it's a form action ID
            let isBranchReject = /reject/i.test(runtimeStep?.decisionAction || '');
            if (!isBranchReject && runtimeStep?.decisionAction && stepDef.formId && request?.requestType?.formSchemasContent) {
                try {
                    const forms = JSON.parse(request.requestType.formSchemasContent);
                    const form = forms.find((f: any) => f.id === stepDef.formId);
                    const allActions = [...(form?.actions || []), ...(form?.footerActions || [])];
                    const action = allActions.find((a: any) => a.id === runtimeStep.decisionAction);
                    if (action) {
                        isBranchReject = /reject/i.test(action.label || '') || action.variant === 'destructive' || action.variant === 'danger';
                    }
                } catch { /* ignore */ }
            }

            if (isTechnicalReject || isBranchReject) {
                status = 'REJECTED';
            }

            const statusUpper = (status || '').toUpperCase();

            const decisionActionRaw = (runtimeStep as any)?.decisionAction as string | undefined;

            const isIdLike = (text: string | undefined) =>
                !!text && (
                    // UUID-ish
                    (text.length > 30 && /^[0-9a-fA-F-]+$/.test(text)) ||
                    // Studio-generated action IDs (SchemaTab.tsx)
                    /^action-\d+$/.test(text)
                );

            // Resolve decision/action label for Status Flow mapping (e.g. "Approve"/"Reject", "True"/"False")
            let decisionLabel: string | null = null;
            if ((stepDef as any).stepType === 'condition') {
                if (decisionActionRaw === 'true') decisionLabel = 'True';
                else if (decisionActionRaw === 'false') decisionLabel = 'False';
            } else if (decisionActionRaw && stepDef.formId && request?.requestType?.formSchemasContent) {
                try {
                    const forms = JSON.parse(request.requestType.formSchemasContent);
                    const form = forms.find((f: any) => f.id === stepDef.formId);
                    const allActions = [...(form?.actions || []), ...(form?.footerActions || [])];
                    const matchedAction = allActions.find((a: any) => a.id === decisionActionRaw);
                    if (matchedAction?.label) decisionLabel = matchedAction.label;
                } catch { /* ignore */ }
                if (!decisionLabel && !isIdLike(decisionActionRaw)) {
                    decisionLabel = decisionActionRaw;
                }
            } else if (decisionActionRaw && !isIdLike(decisionActionRaw)) {
                // If backend already provides a readable label, accept it (fallback).
                decisionLabel = decisionActionRaw;
            }

            const outcomeStatus = (statusUpper === 'COMPLETED' || statusUpper === 'REJECTED')
                ? resolveStepOutcomeBusinessStatus(statusFlowContent, stepDef.ID, decisionLabel)
                : null;

            // Check for re-approval condition
            const hasPastActivity = auditLog?.some(l =>
                l.stepName === stepDef.stepName &&
                (l.action === 'SEND_BACK' || l.action === 'COMPLETE' || l.action === 'AUTO_COMPLETE')
            );
            const isReapproval = hasPastActivity && (status === 'IN_PROGRESS' || status === 'PENDING' || status === 'STARTED');

            // Determine Step Owner (Consolidated)
            const ownerId = runtimeStep?.ownerId || stepDef.ownerId;
            let ownerDisplayName = runtimeStep?.ownerDisplayName || stepDef.ownerDisplayName;
            const isUuid = (text: string | undefined) => text && text.length > 30 && /^[0-9a-fA-F-]+$/.test(text);

            if (!ownerDisplayName || isUuid(ownerDisplayName)) {
                if (ownerId && enrichedKnownUsers.has(ownerId)) {
                    ownerDisplayName = enrichedKnownUsers.get(ownerId);
                }
            }
            if ((!ownerDisplayName || isUuid(ownerDisplayName)) && ownerId && request?.coordinatorId && ownerId === request.coordinatorId) {
                ownerDisplayName = request.coordinatorDisplayName;
            }
            if ((!ownerDisplayName || isUuid(ownerDisplayName)) && ownerId) {
                const resolved = enrichedKnownUsers.get(ownerId);
                if (resolved) ownerDisplayName = resolved;
            }
            if ((!ownerDisplayName || isUuid(ownerDisplayName)) && !ownerDisplayName) {
                ownerDisplayName = ownerId;
            }

            const getSubtitle = () => {
                let statusBadge;

                if (isReapproval) {
                    statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            Re-approval Needed
                        </span>
                    );
                } else if (statusUpper === 'COMPLETED') {
                    const label = outcomeStatus?.label || decisionLabel || 'Completed';
                    if (completedApprovals.length > 0) {
                        const approverName = completedApprovals[0].decidedByDisplayName ||
                            completedApprovals[0].approverDisplayName ||
                            completedApprovals[0].approver;

                        statusBadge = (
                            <span
                                className={outcomeStatus ? 'font-medium' : 'text-emerald-600 font-medium'}
                                style={outcomeStatus ? { color: outcomeStatus.color } : undefined}
                            >
                                {label} by {approverName}
                            </span>
                        );
                    } else if (hasData) {
                        statusBadge = (
                            <span
                                className={outcomeStatus ? 'font-medium' : 'text-emerald-600 font-medium'}
                                style={outcomeStatus ? { color: outcomeStatus.color } : undefined}
                            >
                                {label}
                            </span>
                        );
                    } else {
                        statusBadge = <span className="text-slate-500">{label}</span>;
                    }
                } else if (statusUpper === 'REJECTED') {
                    const label = outcomeStatus?.label || decisionLabel || 'Rejected';
                    const approverName = completedApprovals[0]?.decidedByDisplayName ||
                        completedApprovals[0]?.approverDisplayName ||
                        completedApprovals[0]?.approver || 'Approver';

                    statusBadge = (
                        <span
                            className={outcomeStatus ? 'font-medium' : 'text-rose-600 font-medium'}
                            style={outcomeStatus ? { color: outcomeStatus.color } : undefined}
                        >
                            {label} by {approverName}
                        </span>
                    );
                } else if (statusUpper === 'IN_PROGRESS') {
                    statusBadge = <span className="text-blue-600 font-medium">In Progress</span>;
                } else if (statusUpper === 'STARTED') {
                    const stepSchema = parseSchemaContent(stepDef.schemaContent);
                    const hasSchema = stepSchema.length > 0 || !!stepDef.formId;
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


            const decisionApproval = completedApprovals.find(a => a.comment);
            const decisionNote = decisionApproval?.comment || null;
            const decisionDate = completedApprovals[0]?.decisionAt || null;

            let slaInfo: string | null = null;
            if (stepDef.slaDays && runtimeStep) {
                if (status === 'COMPLETED' || status === 'REJECTED') {
                } else if (status === 'IN_PROGRESS' || status === 'STARTED' || status === 'IN_CLARIFICATION') {
                    const startedAt = (runtimeStep as any).startedAt || (runtimeStep as any).createdAt;
                    if (startedAt) {
                        const start = new Date(startedAt);
                        const dueDate = new Date(start.getTime() + stepDef.slaDays * 24 * 60 * 60 * 1000);
                        const now = new Date();
                        const diffMs = dueDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                            slaInfo = `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;
                        } else if (diffDays === 0) {
                            slaInfo = 'Due today';
                        } else {
                            slaInfo = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
                        }
                    }
                }
            }

            // Resolve branch label based on step type
            let branchLabel: string | null = null;

            // For condition nodes: show which path was taken
            if ((stepDef as any).stepType === 'condition') {
                const decision = (runtimeStep as any)?.decisionAction;
                if (decision === 'true') {
                    branchLabel = 'True Path Taken';
                } else if (decision === 'false') {
                    branchLabel = 'False Path Taken';
                } else {
                    branchLabel = 'Condition';
                }
            }
            // For steps with form actions: show decision taken (completed/rejected) or available decisions (pending)
            else if (stepDef.formId && request?.requestType?.formSchemasContent) {
                try {
                    const forms = JSON.parse(request.requestType.formSchemasContent);
                    const form = forms.find((f: any) => f.id === stepDef.formId);
                    const allActions = [...(form?.actions || []), ...(form?.footerActions || [])];
                    if (allActions.length > 0 && !stepDef.isStartStep) {
                        const decisionAction = (runtimeStep as any)?.decisionAction;
                        if (decisionAction && (status === 'COMPLETED' || status === 'REJECTED')) {
                            // Show the decision that was actually taken
                            const matchedAction = allActions.find((a: any) => a.id === decisionAction);
                            const label = matchedAction?.label || decisionAction;
                            branchLabel = label.charAt(0).toUpperCase() + label.slice(1);
                        } else if (status === 'IN_PROGRESS' || status === 'PENDING') {
                            branchLabel = `Decisions: ${allActions.map((a: any) => a.label).join(' / ')}`;
                        }
                    }
                } catch { /* ignore */ }
            }

            return {
                id: runtimeStep?.ID || stepDef.ID,
                title: stepDef.stepName || 'Unknown Step',
                status: mapStatus(status),
                subtitle: getSubtitle(),
                stepDefId: stepDef.ID,
                slaDays: stepDef.slaDays,
                ownerName: ownerDisplayName || null,
                decisionDate,
                decisionNote,
                slaInfo,
                branchLabel,
                approvalRules: runtimeStep?.approvals && runtimeStep.approvals.length > 0
                    ? runtimeStep.approvals.map(approval => ({
                        ruleName: approval.ruleName || approval.approverDisplayName || approval.approver || 'Approval Rule',
                        approvers: [{
                            name: resolvePrincipalName(approval.approver, approval.approverDisplayName) || 'Unknown Approver',
                            type: (approval.approverType || 'ROLE') as 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION',
                            status: (() => {
                                if (outcomeStatus && (statusUpper === 'COMPLETED' || statusUpper === 'REJECTED') && (approval.status === 'APPROVED' || approval.status === 'REJECTED')) {
                                    return outcomeStatus.label;
                                }
                                if (statusUpper === 'REJECTED' && approval.status === 'APPROVED') return 'REJECTED';
                                return approval.status;
                            })(),
                            statusStyle: (outcomeStatus && (statusUpper === 'COMPLETED' || statusUpper === 'REJECTED') && (approval.status === 'APPROVED' || approval.status === 'REJECTED'))
                                ? { color: outcomeStatus.color, bgColor: outcomeStatus.bgColor, borderColor: outcomeStatus.borderColor }
                                : undefined,
                            comment: approval.comment,
                            timestamp: approval.decisionAt,
                            decidedBy: approval.decidedByDisplayName
                        }]
                    }))
                    : stepResolvedApprovers.length > 0
                        ? stepResolvedApprovers.map(resolved => {
                            return {
                                ruleName: resolved.ruleName || 'Approval Rule',
                                approvers: [{
                                    name: resolvePrincipalName(resolved.approverValue, resolved.approverDisplayName) || 'Unknown Approver',
                                    type: (resolved.approverType?.toUpperCase() || 'ROLE') as 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION'
                                }]
                            };
                        })
                        : undefined
            };
        });
    }, [request?.requestType?.steps, sortedSteps, resolvedApprovers, auditLog, enrichedKnownUsers]);

    // Determine current step for actions
    // Priority: 1. User-selected step, 2. Step with pending approval for current user, 3. Active data entry step
    const currentStep = useMemo(() => {
        if (selectedStepId && sortedSteps) {
            return sortedSteps.find(s => s.ID === selectedStepId);
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
                const schema = resolveStepSchema(stepDef);
                return schema.length === 0;
            }
            return false;
        });
    }, [selectedStepId, sortedSteps, request?.requestType?.steps]);

    // Check if current step is pure review (no schema)
    // Exclude end-type steps — they should auto-complete, never prompt for review.
    const isPureReviewStep = useMemo(() => {
        if (currentStep?.status === 'STARTED') {
            const stepDef = request?.requestType?.steps?.find(d => d.ID === currentStep.stepDefinition_ID);
            if ((stepDef as any)?.stepType === 'end') return false;
            const schema = resolveStepSchema(stepDef);
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
        isFetching,
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
