import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Drawer } from '../../../components/ui';
import { WorkflowTimeline } from '../../../components/shared';
// Removed ConfirmDialog import used for rejection
import { parseSchemaContent } from '../../../lib/schemaParser';
import { api } from '../../../lib/api';
import { useAuth, checkIsGroupMember, isGroupLikeType } from '../../../lib/auth-context';

// Local imports
import { useRequestDetailData, useApprovalActions } from './hooks';
import {
    RequestDetailHeader,
    RequestInfoCard,
    StepFormSection,
    ClarificationCard,
    RecentActivityCard,
    AuditLogDrawerContent,
    ReviewActionCard,
    ClaimReleasePanel
} from './components';

/**
 * Request Detail Page
 * 
 * Displays full request information, workflow timeline,
 * and action cards for approvals/clarifications.
 */
export function RequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // UI State
    const [showAuditLogDrawer, setShowAuditLogDrawer] = useState(false);

    // Data and state from custom hook
    const {
        request,
        auditLog,
        isLoading,
        isFetching,
        startStep,
        formData,
        stepFormData,
        setStepFormData,
        selectedStepId,
        setSelectedStepId,
        sortedSteps,
        workflowSteps,
        currentStep,
        isPureReviewStep,
        stepInClarification,
        clarificationComment,
    } = useRequestDetailData(id);

    // Mutations from custom hook
    const {
        saveStepData,
        respondToClarification,
        isSaving,
        isRespondingClarification,
    } = useApprovalActions(id);

    // Get current user from auth context
    const { currentUserId } = useAuth();

    // Redirect DRAFT requests to edit page — only when data is fully settled.
    // Key: use `isFetching` (not `isLoading`) because React Query's `isLoading` is only true
    // on the FIRST fetch with no cache. After a submit triggers invalidation, React Query does
    // a BACKGROUND refetch — `isLoading` stays false but the stale cache still shows DRAFT,
    // causing a bogus redirect. `isFetching` covers both first-load AND background refetches.
    useEffect(() => {
        if (!isFetching && request?.status === 'DRAFT' && id) {
            navigate(`/requests/${id}/edit`, { replace: true });
        }
    }, [request?.status, id, navigate, isFetching]);

    // Calculate current user's approval responsibility
    const currentUserApproval = useMemo(() => {
        if (!currentStep || !currentUserId) return null;
        if ((currentStep as any).status === 'IN_CLARIFICATION') return null;

        return (currentStep as any).approvals?.find((a: any) =>
            (a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED') && (
                // Direct user assignment
                (a.approverType === 'USER' && a.approver === currentUserId) ||
                // Group assignment - check membership
                (isGroupLikeType(a.approverType) && checkIsGroupMember(currentUserId, a.approver))
            )
        );
    }, [currentStep, currentUserId]);

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-slate-200 rounded w-1/3" />
                <Card><div className="h-32 bg-slate-100 rounded" /></Card>
            </div>
        );
    }

    // Not found state
    if (!request) {
        return (
            <Card>
                <div className="text-center py-12">
                    <p className="text-slate-500">Request not found</p>
                    <Button variant="ghost" className="mt-4" onClick={() => navigate('/requests')}>
                        Back to Requests
                    </Button>
                </div>
            </Card>
        );
    }

    // User checks
    const isRequester = (request as any).createdBy === currentUserId ||
        (request as any).requester?.userId === currentUserId;
    const isCoordinator = (request as any).coordinator?.ID === currentUserId ||
        (request as any).coordinator?.userId === currentUserId;

    // Helper to check if current user is owner of a step
    const isOwner = (ownerId: string | null | undefined) => {
        if (!ownerId || !currentUserId) return false;
        return ownerId === currentUserId || checkIsGroupMember(currentUserId, ownerId);
    };

    // Context-aware claim state computation
    const stepStatus = (currentStep as any)?.status;
    const ownerType = (currentStep as any)?.ownerType;
    const ownerId = (currentStep as any)?.ownerId;
    const pendingApprovals = (currentStep as any)?.approvals?.filter(
        (a: any) => a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED'
    ) || [];

    let canUserClaim = false;
    let isGroupAssigned = false;

    if (stepStatus === 'STARTED' || stepStatus === 'IN_CLARIFICATION') {
        if (isGroupLikeType(ownerType)) {
            isGroupAssigned = true;
            canUserClaim = checkIsGroupMember(currentUserId, ownerId);
        } else if (ownerType === 'USER') {
            canUserClaim = ownerId === currentUserId;
        }
    } else if (stepStatus === 'IN_PROGRESS') {
        for (const approval of pendingApprovals) {
            if (isGroupLikeType(approval.approverType)) {
                isGroupAssigned = true;
                if (checkIsGroupMember(currentUserId, approval.approver)) {
                    canUserClaim = true;
                    break;
                }
            } else if (approval.approverType === 'USER' && approval.approver === currentUserId) {
                canUserClaim = true;
                break;
            }
        }
    }

    const claimedBy = (currentStep as any)?.claimedBy;
    const isClaimedByMe = claimedBy?.ID === currentUserId;
    const isClaimedByOther = claimedBy && !isClaimedByMe;
    const claimRequired = isGroupAssigned && !claimedBy && canUserClaim;

    // Handle step form data changes
    const handleStepFieldChange = (stepId: string, fieldId: string, value: any) => {
        setStepFormData((prev: Record<string, any>) => ({
            ...prev,
            [stepId]: {
                ...prev[stepId],
                [fieldId]: value
            }
        }));
    };

    // Handle step form submission
    const handleStepSubmit = (step: any, _stepDef: any) => {
        const formData = stepFormData[step.ID] || (() => {
            try {
                return step.data?.payload ? JSON.parse(step.data.payload) : {};
            } catch {
                return {};
            }
        })();

        saveStepData({
            stepId: step.ID,
            dataId: step.data?.ID,
            payload: formData
        });
    };

    // Handle clarification response
    const handleClarificationSubmit = async (response: string) => {
        try {
            if (startStep?.data?.ID) {
                await api.patch(`/browse/RequestData(${startStep.data.ID})`, {
                    payload: JSON.stringify(formData)
                });
            }
        } catch (error) {
            console.error("Failed to save data", error);
            throw error;
        }

        respondToClarification({
            stepId: stepInClarification!.ID,
            comment: response
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-8">
            <RequestDetailHeader
                request={request}
                onBack={() => navigate('/requests')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <RequestInfoCard request={request} />

                    {sortedSteps.map((step) => {
                        if (step.stepDefinition_ID !== selectedStepId) return null;

                        const stepDef = request.requestType?.steps?.find(s => s.ID === step.stepDefinition_ID);
                        if (!stepDef?.schemaContent) return null;

                        const stepSchemaItems = parseSchemaContent(stepDef.schemaContent);
                        if (stepSchemaItems.length === 0) return null;

                        const isStepOwner = isOwner(step.ownerId);
                        const stepIsGroupAssigned = isGroupLikeType((step as any).ownerType) ||
                            (step as any).approvals?.some((a: any) => (a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED') && isGroupLikeType(a.approverType));
                        const stepClaimedBy = (step as any).claimedBy;
                        const stepClaimedByMe = stepClaimedBy?.ID === currentUserId;
                        const stepClaimRequired = stepIsGroupAssigned && !stepClaimedBy;
                        const stepClaimedByOther = stepClaimedBy && !stepClaimedByMe;

                        const canEditStep = !stepClaimRequired && !stepClaimedByOther;
                        const isEditable = (step.status === 'STARTED' ||
                            (step.status === 'IN_CLARIFICATION' && (isRequester || isStepOwner))) && canEditStep;

                        const currentStepFormData = stepFormData[step.ID] || (() => {
                            try {
                                return step.data?.payload ? JSON.parse(step.data.payload) : {};
                            } catch {
                                return {};
                            }
                        })();

                        return (
                            <StepFormSection
                                key={step.ID}
                                step={step}
                                stepDefinition={stepDef}
                                formData={currentStepFormData}
                                isEditable={isEditable}
                                onFieldChange={(fieldId, value) =>
                                    handleStepFieldChange(step.ID, fieldId, value)
                                }
                                onSubmit={() => handleStepSubmit(step, stepDef)}
                                isSubmitting={isSaving}
                                claimRequired={stepClaimRequired}
                                claimedByOther={stepClaimedByOther}
                                claimedByName={stepClaimedBy?.displayName}
                            />
                        );
                    })}
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-6 space-y-6">
                        {currentStep && (
                            <ClaimReleasePanel
                                step={{
                                    ID: currentStep.ID,
                                    claimedBy: (currentStep as any).claimedBy,
                                    claimedAt: (currentStep as any).claimedAt,
                                    isGroupAssigned: isGroupAssigned && canUserClaim,
                                }}
                                currentUserId={currentUserId}
                                isCoordinator={isCoordinator}
                            />
                        )}

                        {isPureReviewStep && !currentUserApproval && currentStep && (
                            <ReviewActionCard
                                stepName={currentStep.stepDefinition?.stepName || 'Unknown'}
                                onStartReview={() => {
                                    saveStepData({
                                        stepId: currentStep.ID,
                                        dataId: currentStep.data?.ID,
                                        payload: {}
                                    });
                                }}
                                isProcessing={isSaving}
                            />
                        )}

                        {/* ApprovalActionCard removed here */}

                        {stepInClarification && (isRequester || isOwner(stepInClarification.ownerId)) && (
                            <ClarificationCard
                                stepName={stepInClarification.stepDefinition?.stepName || 'Unknown'}
                                approverComment={clarificationComment || ''}
                                onSubmit={handleClarificationSubmit}
                                isSubmitting={isRespondingClarification}
                                claimRequired={claimRequired}
                                claimedByOther={isClaimedByOther}
                                claimedByName={claimedBy?.displayName}
                            />
                        )}

                        <WorkflowTimeline
                            title="Workflow Progress"
                            steps={workflowSteps}
                            requestStatus={request?.status}
                            showCompletion={true}
                            onStepClick={(stepId) => setSelectedStepId(stepId)}
                            selectedStepId={selectedStepId || undefined}
                        />

                        <RecentActivityCard
                            auditLog={auditLog || []}
                            onViewFullLog={() => setShowAuditLogDrawer(true)}
                        />
                    </div>
                </div>
            </div>

            <Drawer
                isOpen={showAuditLogDrawer}
                onClose={() => setShowAuditLogDrawer(false)}
                title="Request Audit Log"
                size="lg"
            >
                <AuditLogDrawerContent auditLog={auditLog || []} />
            </Drawer>

            {/* Reject Confirmation Dialog removed here */}
        </div>
    );
}

export default RequestDetail;
