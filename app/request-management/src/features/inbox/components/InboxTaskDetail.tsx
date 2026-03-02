import { useState, useMemo } from 'react';
import { Card, Button, Badge } from '../../../components/ui';
import { WorkflowTimeline } from '../../../components/shared';
import { ConfirmDialog } from '../../../components/studio';
import { parseSchemaContent } from '../../../lib/schemaParser';
import { api } from '../../../lib/api';
import { useAuth, checkIsGroupMember, isGroupLikeType } from '../../../lib/auth-context';
import {
    RequestInfoCard,
    StepFormSection,
    ClarificationCard,
    ClaimReleasePanel,
    ReviewActionCard,
} from '../../requests/RequestDetail/components';
import { useRequestDetailData, useApprovalActions } from '../../requests/RequestDetail/hooks';
import {
    ChevronRight,
    ChevronLeft,
    ThumbsUp,
    ThumbsDown,
    MessageCircle,
    Undo2,
    Loader2,
} from 'lucide-react';

interface InboxTaskDetailProps {
    /** The request ID to display */
    requestId: string;
    /** Callback to deselect the task */
    onDeselect: () => void;
}

/**
 * Detail pane for the Inbox redesign.
 * Renders the request form schema (center) and workflow timeline (right)
 * along with action buttons in a fixed footer.
 */
export function InboxTaskDetail({ requestId, onDeselect }: InboxTaskDetailProps) {
    const [isWorkflowOpen, setIsWorkflowOpen] = useState(true);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [sendBackComment, setSendBackComment] = useState('');
    const [showSendBackDialog, setShowSendBackDialog] = useState(false);

    // Data fetching
    const {
        request,
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
    } = useRequestDetailData(requestId);

    // Mutations
    const {
        saveStepData,
        approve,
        reject,
        sendBack,
        respondToClarification,
        isSaving,
        isProcessing,
        isRespondingClarification,
    } = useApprovalActions(requestId);

    // Auth context
    const { currentUser, currentUserId } = useAuth();

    // Calculate current user's approval responsibility
    const currentUserApproval = useMemo(() => {
        if (!currentStep || !currentUserId) return null;
        if ((currentStep as any).status === 'IN_CLARIFICATION') return null;

        return (currentStep as any).approvals?.find((a: any) =>
            (a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED') && (
                (a.approverType === 'USER' && a.approver === currentUserId) ||
                (isGroupLikeType(a.approverType) && checkIsGroupMember(currentUserId, a.approver))
            )
        );
    }, [currentStep, currentUserId]);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
        );
    }

    if (!request) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-500">Request not found</p>
            </div>
        );
    }

    // User checks
    const isRequester = (request as any).createdBy === currentUserId ||
        (request as any).requester?.userId === currentUserId;
    const isCoordinator = (request as any).coordinator?.ID === currentUserId ||
        (request as any).coordinator?.userId === currentUserId;

    const isOwner = (ownerId: string | null | undefined) => {
        if (!ownerId || !currentUserId) return false;
        return ownerId === currentUserId || checkIsGroupMember(currentUserId, ownerId);
    };

    // Context-aware claim state
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

    // Step form handlers
    const handleStepFieldChange = (stepId: string, fieldId: string, value: any) => {
        setStepFormData((prev: Record<string, any>) => ({
            ...prev,
            [stepId]: {
                ...prev[stepId],
                [fieldId]: value
            }
        }));
    };

    const handleStepSubmit = (step: any, stepDef: any) => {
        const data = stepFormData[step.ID] || (() => {
            try {
                return step.data?.payload ? JSON.parse(step.data.payload) : {};
            } catch {
                return {};
            }
        })();

        saveStepData({
            stepId: step.ID,
            dataId: step.data?.ID,
            payload: data
        });
    };

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

    const handleSendBack = () => {
        if (currentUserApproval && sendBackComment.trim()) {
            sendBack({
                approvalId: currentUserApproval.ID,
                comment: sendBackComment
            });
            setShowSendBackDialog(false);
            setSendBackComment('');
        }
    };

    // Determine which actions are available
    const showApprovalActions = !!currentUserApproval && !!currentStep;
    const isBlocked = claimRequired || isClaimedByOther;

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Center Pane – Form Schema Details */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Request Information Card */}
                    <RequestInfoCard request={request} />

                    {/* Claim/Release Panel (if applicable) */}
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

                    {/* Clarification Card */}
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

                    {/* Dynamic Step Form Sections */}
                    {sortedSteps.map((step) => {
                        if (step.stepDefinition_ID !== selectedStepId) return null;

                        const stepDef = request.requestType?.steps?.find(s => s.ID === step.stepDefinition_ID);
                        if (!stepDef?.schemaContent) return null;

                        const stepSchemaItems = parseSchemaContent(stepDef.schemaContent);
                        if (stepSchemaItems.length === 0) return null;

                        const isStepOwner = isOwner(step.ownerId);
                        const stepIsGroupAssigned = isGroupLikeType((step as any).ownerType) ||
                            (step as any).approvals?.some((a: any) =>
                                (a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED') && isGroupLikeType(a.approverType)
                            );
                        const stepClaimedBy = (step as any).claimedBy;
                        const stepClaimedByMe = stepClaimedBy?.ID === currentUserId;
                        const stepClaimRequired = stepIsGroupAssigned && !stepClaimedBy;
                        const stepClaimedByOther = stepClaimedBy && !stepClaimedByMe;

                        const canEditStep = !stepClaimRequired && !stepClaimedByOther;
                        const isEditable = (step.status === 'STARTED' ||
                            (step.status === 'IN_CLARIFICATION' && (isRequester || isStepOwner))) && canEditStep;

                        const currentFormData = stepFormData[step.ID] || (() => {
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
                                formData={currentFormData}
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

                {/* Fixed Action Footer */}
                {showApprovalActions && (
                    <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-end gap-3 shrink-0">
                        <Button
                            variant="ghost"
                            onClick={onDeselect}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowSendBackDialog(true)}
                            disabled={isProcessing || isBlocked}
                            className="border-amber-500 text-amber-700 hover:bg-amber-50"
                        >
                            <Undo2 className="w-4 h-4 mr-2" />
                            Send Back
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setShowRejectConfirm(true)}
                            disabled={isProcessing || isBlocked}
                        >
                            <ThumbsDown className="w-4 h-4 mr-2" />
                            Reject
                        </Button>
                        <Button
                            onClick={() => approve(currentUserApproval.ID)}
                            disabled={isProcessing || isBlocked}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            Approve
                        </Button>
                    </div>
                )}
            </div>

            {/* Right Pane – Collapsible Workflow Timeline */}
            <div className={`border-l border-slate-200 bg-slate-50/50 flex flex-col transition-all duration-300 ${isWorkflowOpen ? 'w-80' : 'w-10'
                }`}>
                {/* Toggle Button */}
                <button
                    onClick={() => setIsWorkflowOpen(!isWorkflowOpen)}
                    className="flex items-center justify-center h-10 border-b border-slate-200 hover:bg-slate-100 transition-colors"
                    aria-label={isWorkflowOpen ? 'Collapse workflow panel' : 'Expand workflow panel'}
                >
                    {isWorkflowOpen ? (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 text-slate-500" />
                    )}
                </button>

                {isWorkflowOpen && (
                    <div className="flex-1 overflow-y-auto p-4">
                        <WorkflowTimeline
                            title="Workflow"
                            steps={workflowSteps}
                            requestStatus={request?.status}
                            showCompletion={true}
                            isSimulation={false}
                            onStepClick={(stepId) => setSelectedStepId(stepId)}
                            selectedStepId={selectedStepId || undefined}
                        />
                    </div>
                )}
            </div>

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

            {/* Send Back Dialog */}
            <ConfirmDialog
                isOpen={showSendBackDialog}
                title="Send Back for Clarification"
                message="Please provide a comment explaining what clarification is needed."
                confirmLabel="Send Back"
                variant="warning"
                onConfirm={handleSendBack}
                onCancel={() => {
                    setShowSendBackDialog(false);
                    setSendBackComment('');
                }}
            />
        </div>
    );
}
