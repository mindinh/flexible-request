import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    Hand,
    Clock,
    Lock,
    User,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Info,
} from 'lucide-react';
import { Button } from '../../../../components/ui';
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
 * 
 * Three states:
 * 1. Unclaimed — "Claim this step to edit" prompt with Claim button
 * 2. Claimed by You — Green panel with countdown timer + Release button
 * 3. Claimed by Another — Orange panel with lock message + Force-Release for coordinators
 */
export function ClaimReleasePanel({ step, currentUserId, isCoordinator }: ClaimReleasePanelProps) {
    const queryClient = useQueryClient();
    const [timeRemaining, setTimeRemaining] = useState('');

    const isClaimedByCurrentUser = step.claimedBy?.ID === currentUserId;
    const isClaimedByOther = step.claimedBy && !isClaimedByCurrentUser;
    const canClaim = step.isGroupAssigned && !step.claimedBy;
    const canRelease = isClaimedByCurrentUser;
    const canForceRelease = isCoordinator && isClaimedByOther;

    // Check if claim has expired (4 hours)
    const isExpired = (() => {
        if (!step.claimedAt) return false;
        const claimedTime = new Date(step.claimedAt).getTime();
        const expiryTime = claimedTime + (4 * 60 * 60 * 1000);
        return Date.now() >= expiryTime;
    })();

    // Live countdown timer
    useEffect(() => {
        if (!step.claimedAt || !isClaimedByCurrentUser) return;

        const updateTimer = () => {
            const claimedTime = new Date(step.claimedAt!).getTime();
            const expiryTime = claimedTime + (4 * 60 * 60 * 1000);
            const remaining = expiryTime - Date.now();

            if (remaining <= 0) {
                setTimeRemaining('00:00:00');
                return;
            }

            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            setTimeRemaining(
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            );
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [step.claimedAt, isClaimedByCurrentUser]);

    // Format claimed date
    const formatClaimedDate = () => {
        if (!step.claimedAt) return '';
        const d = new Date(step.claimedAt);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    // Claim mutation
    const claimMutation = useMutation({
        mutationFn: () => RequestService.claimStep(step.ID),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['request'] });
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
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
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, 'Step released successfully!');
        },
        onError: (error: any) => {
            globalEvents.emit(EVENT_TYPES.API_ERROR,
                error?.response?.data?.error?.message || 'Failed to release step'
            );
        }
    });

    const isLoading = claimMutation.isPending || releaseMutation.isPending;

    // Don't show panel if step is not group-assigned and not claimed
    if (!step.isGroupAssigned && !step.claimedBy) {
        return null;
    }

    // ═══════════════════════════════════════════
    // STATE 1: Unclaimed — Prompt to claim
    // ═══════════════════════════════════════════
    if (canClaim) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-4 border-emerald-500 bg-emerald-50 rounded-lg p-4"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Hand className="w-5 h-5 text-emerald-600" />
                        <div>
                            <p className="font-semibold text-slate-800">Claim this step to edit</p>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Use the Claim panel in the sidebar to take ownership
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => claimMutation.mutate()}
                        disabled={isLoading}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : (
                            <Hand className="w-4 h-4 mr-1.5" />
                        )}
                        Claim Step
                    </Button>
                </div>
            </motion.div>
        );
    }

    // ═══════════════════════════════════════════
    // STATE 2: Claimed by You — Green with timer
    // ═══════════════════════════════════════════
    if (isClaimedByCurrentUser && !isExpired) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-4 border-emerald-500 bg-emerald-50 rounded-lg p-4"
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-slate-800">Task Claimed by You</p>
                            <p className="text-sm text-emerald-700 mt-1">
                                You claimed this task on {formatClaimedDate()}.
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <Clock className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-emerald-700">
                                    Time Remaining: {timeRemaining}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Button
                        onClick={() => releaseMutation.mutate()}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : null}
                        Release Task
                    </Button>
                </div>
            </motion.div>
        );
    }

    // ═══════════════════════════════════════════
    // STATE 3: Claim Expired — Red warning
    // ═══════════════════════════════════════════
    if (isClaimedByCurrentUser && isExpired) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4"
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-slate-800">Task Claim Expired</p>
                            <p className="text-sm text-slate-600 mt-1">
                                Your 4-hour claim period has expired. Please release the task or complete it immediately.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => releaseMutation.mutate()}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : null}
                        Release Task
                    </Button>
                </div>
            </motion.div>
        );
    }

    // ═══════════════════════════════════════════
    // STATE 4: Locked — Claimed by another user
    // ═══════════════════════════════════════════
    if (isClaimedByOther) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-4 border-orange-500 bg-orange-50 rounded-lg p-4"
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-slate-800">Task Locked - Claimed by Another User</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <User className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-medium text-orange-700">
                                    {step.claimedBy?.displayName || 'Unknown'} claimed this task on {formatClaimedDate()}.
                                </span>
                            </div>
                            <div className="flex items-start gap-1.5 mt-1.5">
                                <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                <span className="text-sm text-slate-500">
                                    This task is currently locked to prevent duplicate work. You cannot edit or complete this task while it's claimed by another user.
                                </span>
                            </div>
                            {canForceRelease && (
                                <div className="mt-3">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Info className="w-4 h-4 text-orange-500" />
                                        <span className="text-sm font-medium text-orange-600">Coordinator Action Available</span>
                                    </div>
                                    <Button
                                        onClick={() => releaseMutation.mutate()}
                                        disabled={isLoading}
                                        size="sm"
                                        className="bg-orange-600 hover:bg-orange-700 text-white"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                        ) : (
                                            <Lock className="w-4 h-4 mr-1.5" />
                                        )}
                                        Force-Release Task
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    {!canForceRelease && (
                        <Button
                            disabled
                            variant="outline"
                            size="sm"
                            className="opacity-50"
                        >
                            Release Task
                        </Button>
                    )}
                </div>
            </motion.div>
        );
    }

    return null;
}
