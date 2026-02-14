import { memo } from 'react';
import { User, ThumbsUp, ThumbsDown, MessageCircle, CheckCircle } from 'lucide-react';
import type { HistoryItem } from '../types';
import { ACTION_LABELS } from '../types';

interface ActivityLogItemProps {
    log: HistoryItem;
}

/**
 * Memoized activity log item component
 * Only re-renders when the log item changes
 */
export const ActivityLogItem = memo(function ActivityLogItem({ log }: ActivityLogItemProps) {
    const isSystem = log.actor === 'system';
    const { Icon, bgClass, textClass } = getIconAndStyle(log.action);

    return (
        <div className="relative flex gap-4 py-1">
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white ring-1 ring-slate-100 ${bgClass}`}>
                <Icon className={`w-4 h-4 ${textClass}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                {/* Row 1: Action + Timestamp */}
                <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${isSystem ? 'text-slate-600' : 'text-slate-900'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                    </p>
                    <span className="text-xs text-slate-400 tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="ml-1 text-[10px] text-slate-300">
                            {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                    </span>
                </div>

                {/* Row 2: Actor + Transition + Comment */}
                <div className="text-xs text-slate-500 mt-0.5 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" aria-hidden="true" />
                            <span className={isSystem ? 'italic' : 'font-medium text-slate-700'}>
                                {log.actor}
                            </span>
                        </span>

                        {/* Transition visual (Inline) */}
                        {log.fromValue && log.toValue && (
                            <span className="flex items-center gap-1.5 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 text-[10px]">
                                <span className="line-through opacity-60">{log.fromValue}</span>
                                <span className="text-slate-300">→</span>
                                <span className="font-medium text-slate-700">{log.toValue}</span>
                            </span>
                        )}
                    </div>

                    {log.comment && (
                        <div className="text-slate-600 italic border-l-2 border-slate-200 pl-2 py-0.5 mt-1">
                            "{log.comment}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// Helper function to get icon and styles based on action
function getIconAndStyle(action: string) {
    let Icon = User;
    let bgClass = 'bg-slate-100';
    let textClass = 'text-slate-500';

    if (action === 'APPROVE' || action === 'COMPLETE') {
        Icon = ThumbsUp;
        bgClass = 'bg-green-100';
        textClass = 'text-green-600';
    } else if (action === 'REJECT') {
        Icon = ThumbsDown;
        bgClass = 'bg-red-100';
        textClass = 'text-red-600';
    } else if (action === 'SEND_BACK') {
        Icon = MessageCircle;
        bgClass = 'bg-amber-100';
        textClass = 'text-amber-600';
    } else if (action === 'STATUS_CHANGE') {
        Icon = CheckCircle;
        bgClass = 'bg-blue-50';
        textClass = 'text-blue-500';
    }

    return { Icon, bgClass, textClass };
}

// Export the helper for use in other components
export { getIconAndStyle };
