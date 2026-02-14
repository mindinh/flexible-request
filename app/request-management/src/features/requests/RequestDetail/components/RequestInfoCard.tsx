import { motion } from 'framer-motion';
import { Card, Badge } from '../../../../components/ui';
import { getPriorityConfig } from '../../../../config';
import { User, Users, ArrowRightLeft } from 'lucide-react';
import type { RequestDetailData } from '../types';

interface RequestInfoCardProps {
    request: RequestDetailData;
}

/**
 * Card displaying request title, priority, justification, and coordinator
 */
export function RequestInfoCard({ request }: RequestInfoCardProps) {
    const priorityConfig = getPriorityConfig(request.priority);

    // Construct coordinator object from flat fields
    // Display name is now provided by backend enrichment (coordinatorDisplayName)
    const coordinator = request.coordinatorId ? {
        displayName: request.coordinatorDisplayName || request.coordinatorId,
        id: request.coordinatorId
    } : null;

    const delegatedFrom = request.delegatedFrom;
    const delegatedAt = request.delegatedAt;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
        >
            <Card className="p-6 border-t-4 border-t-primary">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                    Request Information
                </h2>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Request Title
                            </label>
                            <p className="text-slate-900 font-medium">{request.title}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Priority
                            </label>
                            <Badge variant={priorityConfig.variant}>
                                {priorityConfig.label}
                            </Badge>
                        </div>
                    </div>

                    {/* Coordinator Section */}
                    {coordinator && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Coordinator
                                </label>
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">
                                            {coordinator.displayName || coordinator.email || 'Unknown'}
                                        </p>
                                        {coordinator.email && (
                                            <p className="text-xs text-slate-500">{coordinator.email}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Delegation Info */}
                                {delegatedFrom && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                        <ArrowRightLeft className="w-4 h-4" />
                                        <span>
                                            Delegated from {delegatedFrom ? 'Previous Coordinator' : 'Duplicate Coordinator'}
                                            {delegatedAt && (
                                                <span className="text-amber-500 ml-1">
                                                    on {new Date(delegatedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {request.description && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Justification
                            </label>
                            <p className="text-slate-900 text-sm leading-relaxed whitespace-pre-wrap">
                                {request.description}
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    );
}

