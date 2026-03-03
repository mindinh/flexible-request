import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, FileText, AlertCircle, Clock, Trash2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    Button,
    Badge
} from '../../components/ui';
import { RequestService } from '../../services/RequestService';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { PRIORITY_CONFIG } from '../../config/priorityConfig';
import { RequestPriority } from '../../types';

export const NotificationPopover = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: RequestService.getNotifications,
        refetchInterval: 15000, // Refresh every 30 seconds
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAsReadMutation = useMutation({
        mutationFn: RequestService.markNotificationAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: RequestService.markAllNotificationsAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const deleteNotificationMutation = useMutation({
        mutationFn: RequestService.deleteNotification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const deleteAllNotificationsMutation = useMutation({
        mutationFn: RequestService.deleteAllNotifications,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const handleNotificationClick = async (notification: any) => {
        if (!notification.isRead) {
            await markAsReadMutation.mutateAsync(notification.ID);
        }
        if (notification.request?.ID) {
            navigate(`/requests/${notification.request.ID}`);
        }
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteNotificationMutation.mutate(id);
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteAllNotificationsMutation.mutate();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative focus-visible:ring-0 focus-visible:ring-offset-0"
                    aria-label="View notifications"
                >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center p-0 text-[10px] border-2 border-white"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[400px] p-0 overflow-hidden bg-white shadow-xl border-slate-200 z-[100]">
                <div className="flex flex-col h-[500px]">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-lg">Notifications</h3>
                                {unreadCount > 0 && (
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-700 text-white text-[12px] font-bold">
                                        {unreadCount}
                                    </div>
                                )}
                            </div>
                            {notifications.length > 0 && (
                                <div className="flex items-center gap-3">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={() => markAllAsReadMutation.mutate()}
                                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            Mark all as read
                                        </button>
                                    )}
                                    <button
                                        onClick={handleClearAll}
                                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-slate-500">
                            {unreadCount > 0
                                ? `You have ${unreadCount} pending action item${unreadCount > 1 ? 's' : ''}`
                                : 'No new notifications'}
                        </p>
                    </div>

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div
                                    key={n.ID}
                                    onClick={() => handleNotificationClick(n)}
                                    className={cn(
                                        "p-4 hover:bg-slate-50 cursor-pointer transition-colors relative group",
                                        !n.isRead && "bg-blue-50/30"
                                    )}
                                >
                                    <div className="flex gap-4 items-start">
                                        <div className={cn(
                                            "w-11 h-11 flex items-center justify-center rounded-2xl transition-colors shrink-0 mt-0.5",
                                            n.type === 'APPROVAL' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                                        )}>
                                            {n.type === 'APPROVAL' ? (
                                                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
                                            ) : (
                                                <FileText className="w-6 h-6 stroke-[2]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <p className="font-bold text-slate-900 leading-tight">
                                                    {n.title}
                                                </p>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {n.priority === 'HIGH' && (
                                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDelete(e, n.ID)}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                        aria-label="Delete notification"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-2 truncate">
                                                {n.message}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider h-5">
                                                    {n.role || 'Approver'}
                                                </Badge>
                                                {n.priority && (
                                                    <Badge
                                                        variant={PRIORITY_CONFIG[n.priority as RequestPriority]?.variant || 'secondary'}
                                                        className="text-[10px] font-bold uppercase tracking-wider h-5"
                                                    >
                                                        {n.priority}
                                                    </Badge>
                                                )}
                                                <div className="flex items-center gap-1 text-[11px] text-slate-400 ml-auto">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {!n.isRead && (
                                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                                <Bell className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm">You're all caught up!</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-white text-center sticky bottom-0 z-10">
                        <button
                            onClick={() => navigate('/inbox')}
                            className="text-sm text-red-800 font-bold"
                        >
                            View All Notifications
                        </button>
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
