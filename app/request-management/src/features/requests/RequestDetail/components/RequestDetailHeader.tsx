import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge, Button } from '../../../../components/ui';
import { getRequestStatusConfig, getIconConfig } from '../../../../config';
import type { RequestDetailData } from '../types';

interface RequestDetailHeaderProps {
    request: RequestDetailData;
    currentStepName?: string;
    pendingApprovers?: string[];
    onBack: () => void;
}

/**
 * Request detail page header with back button, icon, title, and status
 */
export function RequestDetailHeader({ request, currentStepName, pendingApprovers, onBack }: RequestDetailHeaderProps) {
    const statusInfo = getRequestStatusConfig(request.status);
    const iconConfig = getIconConfig(request.requestType?.icon);

    return (
        <div className="space-y-4">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
            >
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    aria-label="Go back to requests"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${iconConfig.bgColor}`}>
                        <iconConfig.icon className={`w-6 h-6 ${iconConfig.color}`} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">{request.title}</h1>
                            <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
                        </div>
                        <p className="text-slate-500 mt-1">
                            {request.requestType?.title} • Created {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </motion.div>

            {currentStepName && request.status === 'IN_PROGRESS' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded-lg shrink-0">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                                <ArrowLeft className="w-5 h-5 text-white rotate-180" />
                            </motion.div>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-blue-900">Current Progress</p>
                            <p className="text-sm text-blue-700">
                                Step: <span className="font-bold underline decoration-blue-300 decoration-2 underline-offset-4">{currentStepName}</span>
                            </p>
                        </div>
                    </div>

                    {pendingApprovers && pendingApprovers.length > 0 && (
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Pending With</p>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {pendingApprovers.map((approver, i) => (
                                    <Badge key={i} variant="secondary" className="bg-white/80 text-blue-700 border-blue-100">
                                        {approver}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
