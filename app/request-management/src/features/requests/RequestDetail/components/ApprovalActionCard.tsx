import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ThumbsUp, ThumbsDown, MessageCircle, AlertCircle, Hand, Lock } from 'lucide-react';
import { Card, Button, TextArea } from '../../../../components/ui';

interface ApprovalActionCardProps {
    stepName: string;
    onApprove: (comment: string) => void;
    onReject: () => void;
    onSendBack: (comment: string) => void;
    isProcessing: boolean;
    /** If true, step is group-assigned but not yet claimed */
    claimRequired?: boolean;
    /** If true, step is claimed by someone else */
    claimedByOther?: boolean;
    /** Name of the user who claimed the step */
    claimedByName?: string;
}

/**
 * Approval action card for approvers to approve/reject/request clarification
 */
export function ApprovalActionCard({
    stepName,
    onApprove,
    onReject,
    onSendBack,
    isProcessing,
    claimRequired = false,
    claimedByOther = false,
    claimedByName
}: ApprovalActionCardProps) {
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    const handleSendBack = () => {
        if (comment.trim() === '') {
            setError('Please provide a comment explaining what clarification is needed.');
            return;
        }
        onSendBack(comment);
    };

    // Determine if actions should be blocked
    const isBlocked = claimRequired || claimedByOther;
    const blockReason = claimRequired
        ? 'Claim this step before taking action'
        : claimedByOther
            ? `This step is claimed by ${claimedByName || 'another user'}`
            : '';

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className="p-6 border-l-4 border-l-blue-500 bg-blue-50/30">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Your Action Required
                </h3>

                {/* Blocked State Banner */}
                {isBlocked && (
                    <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 ${claimRequired ? 'bg-amber-50 border border-amber-200' : 'bg-slate-100 border border-slate-200'
                        }`}>
                        {claimRequired ? (
                            <Hand className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        ) : (
                            <Lock className="w-5 h-5 text-slate-500 flex-shrink-0" />
                        )}
                        <div>
                            <p className={`text-sm font-medium ${claimRequired ? 'text-amber-800' : 'text-slate-700'}`}>
                                {blockReason}
                            </p>
                            {claimRequired && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                    Use the panel above to claim this step
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="bg-white rounded-md p-3 border border-blue-100">
                        <p className="text-xs text-slate-600 mb-1">Step:</p>
                        <p className="text-sm font-medium text-slate-900">{stepName}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Comment (optional)
                        </label>
                        <TextArea
                            value={comment}
                            onChange={(e) => {
                                setComment(e.target.value);
                                if (error && e.target.value.trim()) setError('');
                            }}
                            placeholder="Add your comments or feedback..."
                            rows={3}
                            disabled={isBlocked}
                            className={`resize-none ${error ? 'border-red-500 focus-visible:ring-red-500' : ''} ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {error && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => onApprove(comment)}
                            disabled={isProcessing || isBlocked}
                            className={`flex-1 ${isBlocked ? 'opacity-50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            Approve
                        </Button>
                        <Button
                            onClick={onReject}
                            disabled={isProcessing || isBlocked}
                            variant="destructive"
                            className={`flex-1 ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <ThumbsDown className="w-4 h-4 mr-2" />
                            Reject
                        </Button>
                    </div>
                    <Button
                        onClick={handleSendBack}
                        disabled={isProcessing || isBlocked}
                        variant="outline"
                        className={`w-full ${isBlocked ? 'opacity-50 cursor-not-allowed' : 'border-amber-500 text-amber-700 hover:bg-amber-50'}`}
                    >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Request Clarification
                    </Button>
                    {isProcessing && (
                        <p className="text-xs text-blue-600 text-center animate-pulse">
                            Processing your decision...
                        </p>
                    )}
                </div>
            </Card>
        </motion.div>
    );
}

