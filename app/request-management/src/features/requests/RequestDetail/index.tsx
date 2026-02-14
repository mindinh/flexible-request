import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Drawer } from '../../../components/ui';
import { WorkflowTimeline } from '../../../components/shared';
import { ConfirmDialog } from '../../../components/studio';
import { parseSchemaContent } from '../../../lib/schemaParser';
import { api } from '../../../lib/api';
import { useAuth, checkIsGroupMember, isGroupLikeType } from '../../../lib/auth-context';

// Local imports
import { useRequestDetailData, useApprovalActions } from './hooks';
import {
    RequestDetailHeader,
    RequestInfoCard,
    StepFormSection,
    ApprovalActionCard,
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
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [showAuditLogDrawer, setShowAuditLogDrawer] = useState(false);

    // Data and state from custom hook
    const {
        request,
        auditLog,
        isLoading,
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
        approve,
        reject,
        sendBack,
        respondToClarification,
        isSaving,
        isProcessing,
        isRespondingClarification,
    } = useApprovalActions(id);

    // Get current user from auth context (Moved up to avoid conditional hook call)
    const { currentUser, currentUserId } = useAuth();

    // Redirect DRAFT requests to edit page
    useEffect(() => {
        if (request?.status === 'DRAFT' && id) {
            navigate(`/requests/${id}/edit`, { replace: true });
        }
    }, [request?.status, id, navigate]);

    // Calculate current user's approval responsibility
    // Moved from hook to here to access currentUserId and checkIsGroupMember
    // MUST BE BEFORE EARLY RETURNS
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

        // Direct equality check (both are UUIDs now) or group membership check
        return ownerId === currentUserId || checkIsGroupMember(currentUserId, ownerId);
    };



    // Context-aware claim state computation for current step
    // Based on step status, different parties can claim:
    // - STARTED / IN_CLARIFICATION → Step Owner's turn
    // - IN_PROGRESS → Approvers' turn
    const stepStatus = (currentStep as any)?.status;
    const ownerType = (currentStep as any)?.ownerType;
    const ownerId = (currentStep as any)?.ownerId;
    const pendingApprovals = (currentStep as any)?.approvals?.filter(
        (a: any) => a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED'
    ) || [];

    // Determine if current user is authorized to claim based on step status
    let canUserClaim = false;
    let isGroupAssigned = false;

    if (stepStatus === 'STARTED' || stepStatus === 'IN_CLARIFICATION') {
        // Step Owner's turn - check if user is step owner
        if (isGroupLikeType(ownerType)) {
            isGroupAssigned = true;
            canUserClaim = checkIsGroupMember(currentUserId, ownerId);
        } else if (ownerType === 'USER') {
            canUserClaim = ownerId === currentUserId;
        }
    } else if (stepStatus === 'IN_PROGRESS') {
        // Approvers' turn - check if user is pending approver (or needs reapproval)
        for (const approval of pendingApprovals) {
            if (isGroupLikeType(approval.approverType)) {
                isGroupAssigned = true;
                if (checkIsGroupMember(currentUserId, approval.approver)) {
                    // Only prompt for claim if it's not already claimed by me (handled later) or if I need to work on it
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
    const handleStepSubmit = (step: any, stepDef: any) => {
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

    // Handle clarification response with data save
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
            {/* Header */}
            <RequestDetailHeader
                request={request}
                onBack={() => navigate('/requests')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content (Left Column) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Request Information Card */}
                    <RequestInfoCard request={request} />

                    {/* Dynamic Sections for SELECTED Step Only */}
                    {sortedSteps.map((step) => {
                        if (step.stepDefinition_ID !== selectedStepId) return null;

                        const stepDef = request.requestType?.steps?.find(s => s.ID === step.stepDefinition_ID);
                        if (!stepDef?.schemaContent) return null;

                        const stepSchemaItems = parseSchemaContent(stepDef.schemaContent);
                        if (stepSchemaItems.length === 0) return null;

                        // Allow editing if status is STARTED or IN_CLARIFICATION
                        // AND current user is either the original Requester OR the Step Owner (normalized)
                        // AND if group-assigned, user must have claimed the step
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

                        const formData = stepFormData[step.ID] || (() => {
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
                                formData={formData}
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

                {/* Sidebar (Right Column) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6 space-y-6">
                        {/* Step Claim/Release Panel for Group-Assigned Steps */}
                        {currentStep && (
                            <ClaimReleasePanel
                                step={{
                                    ID: currentStep.ID,
                                    claimedBy: (currentStep as any).claimedBy,
                                    claimedAt: (currentStep as any).claimedAt,
                                    // Only show as group-assigned if user can actually claim
                                    isGroupAssigned: isGroupAssigned && canUserClaim,
                                }}
                                currentUserId={currentUserId}
                                isCoordinator={isCoordinator}
                            />
                        )}

                        {/* Review Action for Pure Review Steps */}
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

                        {/* Approval Actions */}
                        {currentUserApproval && currentStep && (
                            <ApprovalActionCard
                                stepName={currentStep.stepDefinition?.stepName || 'Unknown'}
                                onApprove={(comment) => approve(currentUserApproval.ID, comment)}
                                onReject={() => setShowRejectConfirm(true)}
                                onSendBack={(comment) => sendBack({
                                    approvalId: currentUserApproval.ID,
                                    comment
                                })}
                                isProcessing={isProcessing}
                                claimRequired={claimRequired}
                                claimedByOther={isClaimedByOther}
                                claimedByName={claimedBy?.displayName}
                            />
                        )}

                        {/* Clarification Response */}
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

                        {/* Workflow Timeline */}
                        <WorkflowTimeline
                            title="Workflow Progress"
                            steps={workflowSteps}
                            requestStatus={request?.status}
                            showCompletion={true}
                            onStepClick={(stepId) => setSelectedStepId(stepId)}
                            selectedStepId={selectedStepId || undefined}
                        />

                        {/* Recent Activity */}
                        <RecentActivityCard
                            auditLog={auditLog || []}
                            onViewFullLog={() => setShowAuditLogDrawer(true)}
                        />
                    </div>
                </div>
            </div>

            {/* Full Audit Log Drawer */}
            <Drawer
                isOpen={showAuditLogDrawer}
                onClose={() => setShowAuditLogDrawer(false)}
                title="Request Audit Log"
                size="lg"
            >
                <AuditLogDrawerContent auditLog={auditLog || []} />
            </Drawer>

            {/* Reject Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showRejectConfirm}
                title="Reject Request"
                message="Are you sure you want to reject this request? This action cannot be undone."
                confirmLabel="Reject Request"
                variant="danger"
                onConfirm={() => {
                    if (currentUserApproval) {
                        reject(currentUserApproval.ID);
                    }
                    setShowRejectConfirm(false);
                }}
                onCancel={() => setShowRejectConfirm(false)}
            />
        </div>
    );
}

// Default export for backward compatibility
export default RequestDetail;
