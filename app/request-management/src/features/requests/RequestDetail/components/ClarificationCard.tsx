import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Card, Button, TextArea } from '../../../../components/ui';

interface ClarificationCardProps {
    stepName: string;
    approverComment: string;
    onSubmit: (response: string) => Promise<void>;
    isSubmitting: boolean;
    claimRequired?: boolean;
    claimedByOther?: boolean;
    claimedByName?: string;
}

/**
 * Card for requester to respond to clarification requests
 */
export function ClarificationCard({
    stepName,
    approverComment,
    onSubmit,
    isSubmitting,
    claimRequired,
    claimedByOther,
    claimedByName
}: ClarificationCardProps) {
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!response.trim()) {
            setError('Please provide a response to proceed.');
            return;
        }
        await onSubmit(response);
        setResponse('');
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className="p-6 border-l-4 border-l-amber-500 bg-amber-50/30">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Clarification Requested
                </h3>
                <div className="space-y-4">
                    {/* Blocking Message */}
                    {(claimRequired || claimedByOther) && (
                        <div className="bg-amber-100 border border-amber-200 rounded-md p-3 flex items-start gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                            <p className="text-sm text-amber-800">
                                {claimedByOther
                                    ? `This step is currently claimed by ${claimedByName || 'another user'}. You cannot take action.`
                                    : "Claim this step before submitting your response."}
                            </p>
                        </div>
                    )}

                    <div className="bg-white rounded-md p-3 border border-amber-100">
                        <p className="text-xs text-slate-600 mb-1">Step:</p>
                        <p className="text-sm font-medium text-slate-900 mb-2">
                            {stepName}
                        </p>
                        <p className="text-xs text-slate-600 mb-1">Approver's Request:</p>
                        <p className="text-sm text-slate-700 italic">
                            "{approverComment || 'Please provide additional information'}"
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Your Response <span className="text-red-500">*</span>
                        </label>
                        <TextArea
                            value={response}
                            onChange={(e) => {
                                setResponse(e.target.value);
                                if (error && e.target.value.trim()) setError('');
                            }}
                            placeholder="Provide the requested information..."
                            rows={4}
                            disabled={claimRequired || claimedByOther}
                            className={`resize-none ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        {error && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || claimRequired || claimedByOther}
                        className="w-full bg-amber-600 hover:bg-amber-700"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Clarification'}
                    </Button>
                </div>
            </Card>
        </motion.div>
    );
}
