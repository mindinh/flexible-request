import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api';

interface SaveStepDataParams {
    stepId: string;
    dataId?: string;
    payload: Record<string, any>;
}

interface ApprovalParams {
    approvalId: string;
    decision: 'approve' | 'reject';
    comment?: string;
    decisionAction?: string;  // Custom action ID for workflow branching
}

interface SendBackParams {
    approvalId: string;
    comment: string;
}

interface RespondClarificationParams {
    stepId: string;
    comment: string;
}

/**
 * Custom hook encapsulating all approval-related mutations
 */
export function useApprovalActions(requestId: string | undefined) {
    const queryClient = useQueryClient();

    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['request', requestId] });
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
        queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['auditLog', requestId] });
    };

    // Save Step Data (Data Only)
    const saveStepDataMutation = useMutation({
        mutationFn: async ({ stepId, dataId, payload }: SaveStepDataParams) => {
            const jsonPayload = JSON.stringify(payload);
            if (dataId) {
                await api.patch(`/browse/RequestData(${dataId})`, { payload: jsonPayload });
            } else {
                await api.post('/browse/RequestData', {
                    step_ID: stepId,
                    payload: jsonPayload
                });
            }
        },
        onSuccess: invalidateQueries,
    });

    // Save Data AND Submit Step (Used by Requester to submit a step)
    const submitStepWithDataMutation = useMutation({
        mutationFn: async ({ stepId, dataId, payload }: SaveStepDataParams) => {
            const jsonPayload = JSON.stringify(payload);
            if (dataId) {
                await api.patch(`/browse/RequestData(${dataId})`, { payload: jsonPayload });
            } else {
                await api.post('/browse/RequestData', {
                    step_ID: stepId,
                    payload: jsonPayload
                });
            }
            // Submit Step (Transition Status)
            await api.post(`/browse/Requests(${requestId})/RequestService.submitStep`, {
                stepId
            });
        },
        onSuccess: invalidateQueries,
    });

    // Approval action mutation
    const approvalMutation = useMutation({
        mutationFn: async ({ approvalId, decision, comment, decisionAction }: ApprovalParams) => {
            const endpoint = decision === 'approve'
                ? `/browse/StepApprovals(${approvalId})/RequestService.approve`
                : `/browse/StepApprovals(${approvalId})/RequestService.rejectApproval`;
            const body: Record<string, any> = { comment: comment || '' };
            if (decisionAction) body.decisionAction = decisionAction;
            await api.post(endpoint, body);
        },
        onSuccess: invalidateQueries,
    });

    // Send Back mutation
    const sendBackMutation = useMutation({
        mutationFn: async ({ approvalId, comment }: SendBackParams) => {
            await api.post(`/browse/StepApprovals(${approvalId})/RequestService.sendBack`, { comment });
        },
        onSuccess: invalidateQueries,
    });

    // Respond to Clarification mutation
    const respondToClarificationMutation = useMutation({
        mutationFn: async ({ stepId, comment }: RespondClarificationParams) => {
            await api.post(`/browse/Requests(${requestId})/RequestService.respondToClarification`, { stepId, comment });
        },
        onSuccess: invalidateQueries,
    });

    // Submit Step mutation (for steps without data)
    const submitStepMutation = useMutation({
        mutationFn: async ({ stepId }: { stepId: string }) => {
            await api.post(`/browse/Requests(${requestId})/RequestService.submitStep`, { stepId });
        },
        onSuccess: invalidateQueries,
    });

    return {
        // Mutations
        saveStepData: saveStepDataMutation.mutateAsync,
        submitStepWithData: submitStepWithDataMutation.mutateAsync,
        approve: (approvalId: string, comment?: string, decisionAction?: string) =>
            approvalMutation.mutateAsync({ approvalId, decision: 'approve', comment, decisionAction }),
        reject: (approvalId: string, comment?: string) =>
            approvalMutation.mutateAsync({ approvalId, decision: 'reject', comment }),
        sendBack: sendBackMutation.mutateAsync,
        respondToClarification: respondToClarificationMutation.mutateAsync,
        submitStep: submitStepMutation.mutateAsync,

        // Loading states
        isSaving: saveStepDataMutation.isPending,
        isApproving: approvalMutation.isPending,
        isSendingBack: sendBackMutation.isPending,
        isRespondingClarification: respondToClarificationMutation.isPending,
        isSubmittingStep: submitStepMutation.isPending,
        isProcessing: approvalMutation.isPending || sendBackMutation.isPending,
    };
}
