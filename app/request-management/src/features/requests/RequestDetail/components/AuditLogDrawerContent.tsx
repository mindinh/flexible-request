import { memo, useMemo } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { HistoryItem } from '../types';
import { ActivityLogItem } from './ActivityLogItem';

interface AuditLogDrawerContentProps {
    auditLog: HistoryItem[];
}

interface LogGroup {
    name: string;
    items: HistoryItem[];
}

/**
 * Memoized group header component
 */
const GroupHeader = memo(function GroupHeader({
    name,
    itemCount
}: {
    name: string;
    itemCount: number;
}) {
    const isRequestHistory = name === 'Request History';

    return (
        <div className="sticky top-0 bg-white z-10 py-2 mb-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {isRequestHistory ? (
                    <div className="p-1 bg-blue-50 rounded text-blue-600">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    </div>
                ) : (
                    <div className="p-1 bg-slate-100 rounded text-slate-600">
                        <CheckCircle className="w-3 h-3" aria-hidden="true" />
                    </div>
                )}
                {name}
            </h4>
            <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-50 rounded-full">
                {itemCount} event{itemCount !== 1 ? 's' : ''}
            </span>
        </div>
    );
});

/**
 * Full audit log content for drawer display
 * Groups consecutive logs by stepName
 * Uses memoization to prevent unnecessary re-renders
 */
export const AuditLogDrawerContent = memo(function AuditLogDrawerContent({
    auditLog
}: AuditLogDrawerContentProps) {
    // Memoize the grouping computation
    const groups = useMemo(() => {
        if (!auditLog || auditLog.length === 0) {
            return [];
        }

        const result: LogGroup[] = [];
        let currentGroup: LogGroup | null = null;

        auditLog.forEach(log => {
            const key = log.stepName || 'Request History';

            if (!currentGroup || currentGroup.name !== key) {
                currentGroup = { name: key, items: [] };
                result.push(currentGroup);
            }
            currentGroup.items.push(log);
        });

        return result;
    }, [auditLog]);

    if (groups.length === 0) {
        return <p className="text-sm text-slate-500 italic">No activity yet</p>;
    }

    return (
        <div className="space-y-6" role="log" aria-label="Audit log">
            {groups.map((group, index) => (
                <div key={`${group.name}-${index}`} className="relative">
                    {/* Group Header */}
                    <GroupHeader name={group.name} itemCount={group.items.length} />

                    {/* Group Items Timeline */}
                    <div className="relative pl-4 space-y-4 before:absolute before:top-2 before:bottom-0 before:left-[19px] before:w-0.5 before:bg-slate-100">
                        {group.items.map((log) => (
                            <ActivityLogItem key={log.ID} log={log} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});
