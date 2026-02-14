import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hand,
    Clock,
    Unlock,
    User,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Button, Badge } from '../../../../components/ui';
import { RequestService } from '../../../../services/RequestService';
import { globalEvents, EVENT_TYPES } from '../../../../lib/events';

interface StepData {
    ID: string;
    claimedBy?: {
        ID: string;
        displayName?: string;
        email?: string;
    };
    claimedAt?: string;
    ownerType?: string;
    isGroupAssigned?: boolean;
}

interface ClaimReleasePanelProps {
    step: StepData;
    currentUserId?: string;
    isCoordinator?: boolean;
}

/**
 * Panel for claiming/releasing steps in group-assigned workflows.
 * Shows claim status and provides claim/release buttons.
 */
export function ClaimReleasePanel({ step, currentUserId, isCoordinator }: ClaimReleasePanelProps) {
    const queryClient = useQueryClient();

    const isClaimedByCurrentUser = step.claimedBy?.ID === currentUserId;
    const isClaimedByOther = step.claimedBy && !isClaimedByCurrentUser;
    const canClaim = step.isGroupAssigned && !step.claimedBy;
    const canRelease = isClaimedByCurrentUser;
    const canForceRelease = isCoordinator && isClaimedByOther;

    // Calculate claim timeout (4 hours)
    const getClaimTimeRemaining = () => {
        if (!step.claimedAt) return null;
        const claimedTime = new Date(step.claimedAt).getTime();
        const expiryTime = claimedTime + (4 * 60 * 60 * 1000); // 4 hours
        const remaining = expiryTime - Date.now();
        if (remaining <= 0) return 'Expired';

        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        return `${hours}h ${minutes}m remaining`;
    };

    // Claim mutation
    const claimMutation = useMutation({
        mutationFn: () => RequestService.claimStep(step.ID),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['request'] });
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, 'Step claimed successfully!');
        },
        onError: (error: any) => {
            globalEvents.emit(EVENT_TYPES.API_ERROR,
                error?.response?.data?.error?.message || 'Failed to claim step'
            );
        }
    });

    // Release mutation
    const releaseMutation = useMutation({
        mutationFn: () => RequestService.releaseStep(step.ID),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['request'] });
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, 'Step released successfully!');
        },
        onError: (error: any) => {
            globalEvents.emit(EVENT_TYPES.API_ERROR,
                error?.response?.data?.error?.message || 'Failed to release step'
            );
        }
    });

    const isLoading = claimMutation.isPending || releaseMutation.isPending;

    // Don't show panel if step is not group-assigned
    if (!step.isGroupAssigned && !step.claimedBy) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-50 border border-slate-200 rounded-lg p-4"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.claimedBy
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                        }`}>
                        {step.claimedBy ? <User className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
                    </div>

                    <div>
                        {step.claimedBy ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-800">
                                        Claimed by {isClaimedByCurrentUser ? 'You' : step.claimedBy.displayName || 'Unknown'}
                                    </span>
                                    {isClaimedByCurrentUser && (
                                        <Badge variant="secondary" className="text-xs">You</Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>{getClaimTimeRemaining()}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="font-medium text-slate-800">Team Task Available</span>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Claim this step to work on it
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                        {canClaim && (
                            <motion.div
                                key="claim"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                            >
                                <Button
                                    onClick={() => claimMutation.mutate()}
                                    disabled={isLoading}
                                    variant="default"
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                    ) : (
                                        <Hand className="w-4 h-4 mr-1" />
                                    )}
                                    Claim Step
                                </Button>
                            </motion.div>
                        )}

                        {canRelease && (
                            <motion.div
                                key="release"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                            >
                                <Button
                                    onClick={() => releaseMutation.mutate()}
                                    disabled={isLoading}
                                    variant="outline"
                                    size="sm"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                    ) : (
                                        <Unlock className="w-4 h-4 mr-1" />
                                    )}
                                    Release
                                </Button>
                            </motion.div>
                        )}

                        {canForceRelease && (
                            <motion.div
                                key="force-release"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                            >
                                <Button
                                    onClick={() => releaseMutation.mutate()}
                                    disabled={isLoading}
                                    variant="destructive"
                                    size="sm"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                    )}
                                    Force Release
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
