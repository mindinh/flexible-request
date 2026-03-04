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

    // Save and Submit Step Data
    const saveStepDataMutation = useMutation({
        mutationFn: async ({ stepId, dataId, payload }: SaveStepDataParams) => {
            const jsonPayload = JSON.stringify(payload);

            // 1. Save Data
            if (dataId) {
                await api.patch(`/browse/RequestData(${dataId})`, { payload: jsonPayload });
            } else {
                // Fallback: create RequestData if it doesn't exist for some reason
                await api.post('/browse/RequestData', {
                    step_ID: stepId,
                    payload: jsonPayload
                });
            }


            // 2. Submit Step (Transition Status)
            await api.post(`/browse/Requests(${requestId})/RequestService.submitStep`, {
                stepId
            });
        },
        onSuccess: invalidateQueries,
    });

    // Approval action mutation
    const approvalMutation = useMutation({
        mutationFn: async ({ approvalId, decision, comment }: ApprovalParams) => {
            const endpoint = decision === 'approve'
                ? `/browse/StepApprovals(${approvalId})/RequestService.approve`
                : `/browse/StepApprovals(${approvalId})/RequestService.rejectApproval`;
            await api.post(endpoint, { comment: comment || '' });
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
        saveStepData: saveStepDataMutation.mutate,
        approve: (approvalId: string, comment?: string) =>
            approvalMutation.mutate({ approvalId, decision: 'approve', comment }),
        reject: (approvalId: string, comment?: string) =>
            approvalMutation.mutate({ approvalId, decision: 'reject', comment }),
        sendBack: sendBackMutation.mutate,
        respondToClarification: respondToClarificationMutation.mutate,
        submitStep: submitStepMutation.mutate,

        // Loading states
        isSaving: saveStepDataMutation.isPending,
        isApproving: approvalMutation.isPending,
        isSendingBack: sendBackMutation.isPending,
        isRespondingClarification: respondToClarificationMutation.isPending,
        isSubmittingStep: submitStepMutation.isPending,
        isProcessing: approvalMutation.isPending || sendBackMutation.isPending,
    };
}
