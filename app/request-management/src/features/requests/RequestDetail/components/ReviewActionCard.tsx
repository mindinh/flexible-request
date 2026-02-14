import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { Card, Button } from '../../../../components/ui';

interface ReviewActionCardProps {
    stepName: string;
    onStartReview: () => void;
    isProcessing: boolean;
}

/**
 * Action card for pure review steps (no data entry)
 */
export function ReviewActionCard({
    stepName,
    onStartReview,
    isProcessing
}: ReviewActionCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className="p-6 border-l-4 border-l-blue-500 bg-blue-50/30">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Action Required
                </h3>
                <div className="space-y-4">
                    <div className="bg-white rounded-md p-3 border border-blue-100">
                        <p className="text-xs text-slate-600 mb-1">Step:</p>
                        <p className="text-sm font-medium text-slate-900">{stepName}</p>
                        <p className="text-xs text-slate-500 mt-2">
                            This step has no data entry requirements. Please initialize the review process to proceed with approvals.
                        </p>
                    </div>
                    <Button
                        onClick={onStartReview}
                        disabled={isProcessing}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        {isProcessing ? 'Initializing...' : 'Start Review Process'}
                    </Button>
                </div>
            </Card>
        </motion.div>
    );
}
