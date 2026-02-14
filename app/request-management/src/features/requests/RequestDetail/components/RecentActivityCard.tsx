import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { History, ChevronRight } from 'lucide-react';
import { Card, Button } from '../../../../components/ui';
import type { HistoryItem } from '../types';
import { ACTION_LABELS } from '../types';

interface RecentActivityCardProps {
    auditLog: HistoryItem[];
    onViewFullLog: () => void;
}

/**
 * Memoized activity item for the compact list
 */
const CompactActivityItem = memo(function CompactActivityItem({
    log
}: {
    log: HistoryItem
}) {
    const dotColor = useMemo(() => {
        if (log.action === 'APPROVE' || log.action === 'COMPLETE') return 'bg-green-500';
        if (log.action === 'REJECT') return 'bg-red-500';
        if (log.action === 'SEND_BACK') return 'bg-amber-500';
        if (log.action === 'STATUS_CHANGE') return 'bg-blue-500';
        return 'bg-slate-300';
    }, [log.action]);

    const formattedTime = useMemo(() => {
        return new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [log.timestamp]);

    return (
        <div className="flex items-start gap-2 text-xs">
            <div
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`}
                aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
                <span className="font-medium text-slate-700">
                    {ACTION_LABELS[log.action] || log.action}
                </span>
                {log.stepName && (
                    <span className="text-slate-400 ml-1">• {log.stepName}</span>
                )}
                <span className="text-slate-400 ml-1">
                    by {log.actor}
                </span>
            </div>
            <span className="text-[10px] text-slate-400 flex-shrink-0">
                {formattedTime}
            </span>
        </div>
    );
});

/**
 * Compact recent activity summary card (max 4 items)
 * Memoized to prevent unnecessary re-renders
 */
export const RecentActivityCard = memo(function RecentActivityCard({
    auditLog,
    onViewFullLog
}: RecentActivityCardProps) {
    // Memoize the sliced array
    const displayedLogs = useMemo(() => {
        return auditLog?.slice(0, 4) || [];
    }, [auditLog]);

    const totalCount = auditLog?.length || 0;
    const hasLogs = totalCount > 0;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
        >
            <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <History className="w-3.5 h-3.5" aria-hidden="true" />
                        Recent Activity
                    </h3>
                    {hasLogs && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {totalCount} total
                        </span>
                    )}
                </div>

                {/* Compact Activity List (Max 4 items) */}
                <div className="space-y-2" role="list" aria-label="Recent activities">
                    {!hasLogs ? (
                        <p className="text-sm text-slate-500 italic">No activity yet</p>
                    ) : (
                        displayedLogs.map((log) => (
                            <CompactActivityItem key={log.ID} log={log} />
                        ))
                    )}
                </div>

                {/* View Full Audit Log Button */}
                {hasLogs && (
                    <Button
                        variant="ghost"
                        onClick={onViewFullLog}
                        className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        View Full Audit Log
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                )}
            </Card>
        </motion.div>
    );
});
