import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Badge } from '../../../components/ui';
import { WorkflowTimeline } from '../../../components/shared';
import { ConfirmDialog } from '../../../components/studio';
import { parseSchemaContent } from '../../../lib/schemaParser';
import { api } from '../../../lib/api';
import { useAuth, checkIsGroupMember, isGroupLikeType } from '../../../lib/auth-context';
import { RequestService } from '../../../services/RequestService';
import {
    StepFormSection,
    ClarificationCard,
    ClaimReleasePanel,
    ReviewActionCard,
} from '../../requests/RequestDetail/components';
import { useRequestDetailData, useApprovalActions } from '../../requests/RequestDetail/hooks';
import { getPriorityConfig } from '../../../config';
import {
    ChevronRight,
    ChevronLeft,
    ThumbsUp,
    ThumbsDown,
    Undo2,
    Loader2,
    Users,
    X,
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
    const queryClient = useQueryClient();
    const [isWorkflowOpen, setIsWorkflowOpen] = useState(true);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [approveComment, setApproveComment] = useState('');
    const [sendBackComment, setSendBackComment] = useState('');
    const [showSendBackDialog, setShowSendBackDialog] = useState(false);
    const [panelWidth, setPanelWidth] = useState(320);

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
    const { currentUserId } = useAuth();

    // Calculate current user's approval responsibility
    const currentUserApproval = useMemo(() => {
        if (!currentStep || !currentUserId) {
            return null;
        }
        if ((currentStep as any).status === 'IN_CLARIFICATION') {
            return null;
        }

        const pendingApprovals = (currentStep as any).approvals?.filter((a: any) =>
            a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED'
        ) || [];

        // 1st priority: exact USER match
        const directMatch = pendingApprovals.find((a: any) =>
            a.approverType === 'USER' && a.approver === currentUserId
        );
        if (directMatch) return directMatch;

        // 2nd priority: group match via local membership cache
        const groupMatch = pendingApprovals.find((a: any) =>
            isGroupLikeType(a.approverType) && checkIsGroupMember(currentUserId, a.approver)
        );
        if (groupMatch) return groupMatch;

        // 3rd priority (INBOX CONTEXT): if the task is in the user's inbox,
        // the backend already validated group membership. Accept any pending
        // group-like approval as a fallback so action buttons show correctly.
        const groupFallback = pendingApprovals.find((a: any) =>
            isGroupLikeType(a.approverType)
        );
        if (groupFallback) return groupFallback;

        return null;
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
        (request as any).coordinator?.userId === currentUserId ||
        (request as any).coordinatorId === currentUserId;

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
            canUserClaim = checkIsGroupMember(currentUserId, ownerId) || true; // fallback: trust backend
        } else if (ownerType === 'USER') {
            canUserClaim = ownerId === currentUserId;
        }
    } else if (stepStatus === 'IN_PROGRESS') {
        for (const approval of pendingApprovals) {
            if (isGroupLikeType(approval.approverType)) {
                isGroupAssigned = true;
                canUserClaim = true; // Trust backend — task is in inbox
                break;
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
    const canForceRelease = isCoordinator && isClaimedByOther;

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

    const handleStepSubmit = (step: any) => {
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
                {/* Header Bar: displayId · title  group badge  [Release Task] [X] */}
                <div className="border-b border-slate-200 px-6 py-3 bg-white shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-slate-900 whitespace-nowrap">
                                {(request as any).displayId || request.ID?.substring(0, 8)}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-700 truncate">{request.title}</span>
                            {/* Group badge if the current step is group-assigned */}
                            {isGroupAssigned && currentStep && (
                                <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-[10px] shrink-0 ml-1">
                                    <Users className="w-3 h-3 mr-1" />
                                    {(currentStep as any).approvals?.find((a: any) =>
                                        isGroupLikeType(a.approverType) && (a.status === 'PENDING' || a.status === 'REAPPROVAL_NEEDED')
                                    )?.approverDisplayName || 'Team'}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Release Task button shown when current user has claimed */}
                            {isClaimedByMe && currentStep && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        RequestService.releaseStep(currentStep.ID).then(() => {
                                            queryClient.invalidateQueries({ queryKey: ['request'] });
                                            queryClient.invalidateQueries({ queryKey: ['requests'] });
                                            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
                                            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
                                        });
                                    }}
                                >
                                    Release Task
                                </Button>
                            )}
                            {/* Force Release button for coordinators on locked tasks */}
                            {canForceRelease && currentStep && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        RequestService.releaseStep(currentStep.ID).then(() => {
                                            queryClient.invalidateQueries({ queryKey: ['request', requestId] });
                                            queryClient.invalidateQueries({ queryKey: ['requests'] });
                                            queryClient.invalidateQueries({ queryKey: ['myRequests'] });
                                            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
                                            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
                                            queryClient.invalidateQueries({ queryKey: ['notifications'] });
                                        });
                                    }}
                                >
                                    Force Release
                                </Button>
                            )}
                            <button
                                onClick={onDeselect}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    {/* Subtitle: request type */}
                    {request.requestType?.title && (
                        <p className="text-sm text-slate-500 mt-0.5">{request.requestType.title}</p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

                    {/* Inline Request Form Fields (matching mockup) */}
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Request Title
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={request.title || ''}
                                    placeholder="Enter request title"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none cursor-default"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Priority
                                </label>
                                <div className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                                    <span className="text-slate-900">
                                        {getPriorityConfig(request.priority).label}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Coordinator
                            </label>
                            <input
                                type="text"
                                readOnly
                                value={(request as any).coordinatorDisplayName || (request as any).coordinatorId || ''}
                                placeholder="Enter coordinator name"
                                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none cursor-default"
                            />
                        </div>
                        {request.description && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Justification
                                </label>
                                <textarea
                                    readOnly
                                    value={request.description}
                                    placeholder="Enter justification"
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none cursor-default resize-none"
                                />
                            </div>
                        )}
                    </div>

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
                                onSubmit={() => handleStepSubmit(step)}
                                isSubmitting={isSaving}
                                claimRequired={stepClaimRequired}
                                claimedByOther={stepClaimedByOther}
                                claimedByName={stepClaimedBy?.displayName}
                            />
                        );
                    })}
                </div>

                {/* Fixed Action Footer — Cancel always visible, action buttons conditional */}
                <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-end gap-3 shrink-0">
                    <Button
                        variant="ghost"
                        onClick={onDeselect}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    {showApprovalActions && (
                        <>
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
                                onClick={() => setShowApproveConfirm(true)}
                                disabled={isProcessing || isBlocked}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <ThumbsUp className="w-4 h-4 mr-2" />
                                Approve
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Right Pane – Resizable Collapsible Workflow Timeline */}
            <div
                className={`relative border-l border-slate-200 bg-slate-50/50 flex flex-col transition-all duration-200 overflow-hidden ${isWorkflowOpen ? '' : 'w-10'}`}
                style={isWorkflowOpen ? { width: `${panelWidth}px`, minWidth: `${panelWidth}px` } : undefined}
            >
                {/* Drag handle for resizing */}
                {isWorkflowOpen && (
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = panelWidth;
                            const onMouseMove = (ev: MouseEvent) => {
                                const delta = startX - ev.clientX;
                                const newWidth = Math.min(480, Math.max(240, startWidth + delta));
                                setPanelWidth(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                    />
                )}

                {isWorkflowOpen ? (
                    <div className="flex-1 overflow-y-auto p-4">
                        <WorkflowTimeline
                            title="Workflow"
                            steps={workflowSteps}
                            requestStatus={request?.status}
                            showCompletion={true}
                            isSimulation={false}
                            variant="preview"
                            onStepClick={(stepId) => setSelectedStepId(stepId)}
                            selectedStepId={selectedStepId || undefined}
                        />
                    </div>
                ) : (
                    /* Spacer pushes button to bottom when collapsed */
                    <div className="flex-1" />
                )}

                {/* Collapse/Expand Toggle — pinned to bottom, centered */}
                <button
                    onClick={() => setIsWorkflowOpen(!isWorkflowOpen)}
                    className="flex items-center justify-center gap-2 h-10 border-t border-slate-200 hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 shrink-0"
                    aria-label={isWorkflowOpen ? 'Collapse workflow panel' : 'Expand workflow panel'}
                >
                    {isWorkflowOpen ? (
                        <>
                            <ChevronRight className="w-4 h-4" />
                            <span className="text-xs font-medium">Collapse</span>
                        </>
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Approve Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showApproveConfirm}
                title="Approve Request"
                message="Add an optional note for this approval."
                confirmLabel="Approve"
                variant="default"
                onConfirm={() => {
                    if (currentUserApproval) {
                        approve(currentUserApproval.ID, approveComment.trim() || undefined);
                    }
                    setShowApproveConfirm(false);
                    setApproveComment('');
                }}
                onCancel={() => {
                    setShowApproveConfirm(false);
                    setApproveComment('');
                }}
            >
                <textarea
                    value={approveComment}
                    onChange={(e) => setApproveComment(e.target.value)}
                    placeholder="Add your approval note (optional)..."
                    maxLength={200}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </ConfirmDialog>

            {/* Reject Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showRejectConfirm}
                title="Reject Request"
                message="Please provide a reason for rejecting this request. This action cannot be undone."
                confirmLabel="Reject Request"
                variant="danger"
                confirmDisabled={!rejectComment.trim()}
                onConfirm={() => {
                    if (currentUserApproval && rejectComment.trim()) {
                        reject(currentUserApproval.ID, rejectComment.trim());
                    }
                    setShowRejectConfirm(false);
                    setRejectComment('');
                }}
                onCancel={() => {
                    setShowRejectConfirm(false);
                    setRejectComment('');
                }}
            >
                <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Reason for rejection (required)..."
                    maxLength={200}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
            </ConfirmDialog>

            {/* Send Back Dialog */}
            <ConfirmDialog
                isOpen={showSendBackDialog}
                title="Send Back for Clarification"
                message="Please provide a comment explaining what clarification is needed."
                confirmLabel="Send Back"
                variant="default"
                confirmDisabled={!sendBackComment.trim()}
                onConfirm={handleSendBack}
                onCancel={() => {
                    setShowSendBackDialog(false);
                    setSendBackComment('');
                }}
            >
                <textarea
                    value={sendBackComment}
                    onChange={(e) => setSendBackComment(e.target.value)}
                    placeholder="Explain what clarification is needed (required)..."
                    maxLength={200}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </ConfirmDialog>
        </div >
    );
}
