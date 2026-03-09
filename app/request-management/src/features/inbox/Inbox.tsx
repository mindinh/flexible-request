import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle,
    CheckCircle2,
    User,
    Users,
    Search,
    Inbox as InboxIcon,
    Hand,
    Lock,
    ClipboardList,
    Trash2,
} from 'lucide-react';
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui';
import { useState, useMemo } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';
import { RequestService } from '../../services/RequestService';
import type { } from '../../types';
import { InboxTaskDetail } from './components/InboxTaskDetail';
import { getPriorityConfig } from '../../config';
import { useAuth } from '../../lib/auth-context';


interface InboxItem {
    stepApprovalId: string | null;
    stepId: string | null;
    requestId: string;
    requestTitle: string;
    displayId?: string | null;
    requestType: string;
    stepName: string;
    status: string;
    assignedTo: string;
    assignedType: string;
    claimedBy: string | null;
    claimedByUserId: string | null;
    createdAt: string;
    dueDate: string | null;
    priority?: string;
    requester?: string;
}

type InboxTab = 'my-tasks' | 'team-tasks';

/** Unified shape for the task list regardless of source */
interface UnifiedTask {
    id: string;
    stepApprovalId?: string | null;
    requestId: string;
    title: string;
    displayId?: string | null;
    requestType: string;
    stepName: string;
    stepId?: string | null;
    priority?: string;
    requester?: string;
    dueDate?: string | null;
    isTeamTask?: boolean;
    claimedBy?: string | null;
    claimedByMe?: boolean;
    assignedTo?: string;
    assignedType?: string;
}

/**
 * Determine the action title for the card based on step name.
 * Data-entry steps show "Complete …", approval steps show "Approve …"
 */
function getActionTitle(task: UnifiedTask): string {
    const stepLower = (task.stepName || '').toLowerCase();
    const isDataEntry = stepLower.includes('data entry') || stepLower.includes('submission') || stepLower.includes('fill') || stepLower.includes('complete') || stepLower.includes('form');
    const prefix = isDataEntry ? 'Complete' : 'Approve';
    return `${prefix} ${task.requestType || 'Request'}`;
}

/**
 * Inbox Page — Master-Detail Layout
 *
 * Left pane: Task list with tabs (My Tasks, Group Tasks)
 * Center pane + Right pane: InboxTaskDetail (form schema + collapsible workflow)
 */
export const Inbox = () => {
    const queryClient = useQueryClient();
    const { currentUserId } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<InboxTab>('my-tasks');

    // Derive selectedRequestId from the URL instead of local state
    const selectedRequestId = useMemo(() => {
        const match = matchPath('/inbox/request/:requestId', location.pathname);
        return match?.params.requestId || null;
    }, [location.pathname]);
    const [searchQuery, setSearchQuery] = useState('');

    // ─── Data Fetching ────────────────────────────────────────
    // My Tasks: direct user assignments + claimed group tasks (via backend)
    const { data: myApprovals = [], isLoading: isLoadingMy } = useQuery({
        queryKey: ['myApprovals'],
        queryFn: () => RequestService.getMyTasks(),
    });

    const { data: teamApprovals = [], isLoading: isLoadingTeam } = useQuery({
        queryKey: ['teamApprovals'],
        queryFn: () => RequestService.getTeamApprovals(),
        enabled: activeTab === 'team-tasks',
    });


    // ─── Mutations ────────────────────────────────────────────

    // ─── Claim Step Mutation (quick claim from card) ──────────
    const claimMutation = useMutation({
        mutationFn: (stepId: string) => RequestService.claimStep(stepId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
        },
    });

    // ─── Force Release Mutation (coordinator action) ──────────
    const releaseMutation = useMutation({
        mutationFn: (stepId: string) => RequestService.releaseStep(stepId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
        },
    });

    // ─── Delete Request Mutation ──────────
    const deleteMutation = useMutation({
        mutationFn: ({ requestId, stepApprovalId }: { requestId: string, stepApprovalId?: string | null }) =>
            RequestService.deleteTask(requestId, stepApprovalId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
        },
    });

    // ─── Normalize to UnifiedTask ────────────────────────────
    const myTasks: UnifiedTask[] = useMemo(
        () =>
            myApprovals.map((item: InboxItem) => ({
                id: item.stepApprovalId || item.requestId,
                stepApprovalId: item.stepApprovalId,
                requestId: item.requestId,
                title: item.requestTitle,
                displayId: item.displayId || null,
                requestType: item.requestType,
                stepName: item.stepName,
                stepId: item.stepId,
                priority: item.priority,
                requester: item.requester,
                dueDate: item.dueDate,
                claimedBy: item.claimedBy,
                claimedByMe: item.claimedByUserId === currentUserId || (item.assignedType !== 'USER' && !!item.claimedBy),
                assignedTo: item.assignedTo,
                assignedType: item.assignedType,
            })),
        [myApprovals, currentUserId],
    );

    const teamTasks: UnifiedTask[] = useMemo(
        () =>
            teamApprovals.map((item: InboxItem) => ({
                id: item.stepApprovalId || item.requestId,
                stepApprovalId: item.stepApprovalId,
                requestId: item.requestId,
                title: item.requestTitle,
                displayId: item.displayId || null,
                requestType: item.requestType,
                stepName: item.stepName,
                stepId: item.stepId,
                priority: item.priority,
                requester: item.requester,
                dueDate: item.dueDate,
                isTeamTask: true,
                claimedBy: item.claimedBy,
                claimedByMe: false,
                assignedTo: item.assignedTo,
                assignedType: item.assignedType,
            })),
        [teamApprovals],
    );

    // ─── Active list based on tab, sorted most recent first ──
    const activeList = useMemo(() => {
        const list = activeTab === 'my-tasks' ? myTasks : teamTasks;
        return [...list].sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            // Sort by dueDate descending (most recent first); if no dates, keep order
            return dateB - dateA;
        });
    }, [activeTab, myTasks, teamTasks]);
    const isLoadingList = activeTab === 'my-tasks' ? isLoadingMy : isLoadingTeam;

    // ─── Filter by search ─────────────────────────────────────
    const filteredList = useMemo(() => {
        if (!searchQuery.trim()) return activeList;
        const q = searchQuery.toLowerCase();
        return activeList.filter(
            (t) =>
                (t.title || '').toLowerCase().includes(q) ||
                (t.requestType || '').toLowerCase().includes(q) ||
                (t.stepName || '').toLowerCase().includes(q) ||
                (t.displayId && t.displayId.toLowerCase().includes(q)),
        );
    }, [activeList, searchQuery]);

    // ─── Handlers ─────────────────────────────────────────────
    const handleSelectTask = (task: UnifiedTask) => {
        navigate(`/inbox/request/${task.requestId}`);
    };

    const handleDeselect = () => {
        navigate('/inbox');
        queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
        queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
    };


    const handleClaimTask = (e: React.MouseEvent, stepId: string) => {
        e.stopPropagation();
        claimMutation.mutate(stepId);
    };

    const handleForceRelease = (e: React.MouseEvent, stepId: string) => {
        e.stopPropagation();
        releaseMutation.mutate(stepId);
    };

    const handleDeleteTask = (e: React.MouseEvent, requestId: string, stepApprovalId?: string | null) => {
        e.stopPropagation();
        deleteMutation.mutate({ requestId, stepApprovalId });
        if (selectedRequestId === requestId) {
            handleDeselect();
        }
    };


    return (
        <div className="flex flex-1 min-h-0 -m-6 bg-white">
            {/* ─── LEFT PANE: Task List ─── */}
            <div className="w-[320px] min-w-[300px] border-r border-slate-200 flex flex-col bg-white">
                {/* Header */}
                <div className="px-4 pt-4 pb-2">
                    <h1 className="text-xl font-bold text-slate-900">Inbox</h1>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <Tabs
                    value={activeTab}
                    onValueChange={(val) => {
                        setActiveTab(val as InboxTab);
                        navigate('/inbox');
                    }}
                    className="flex-1 flex flex-col min-h-0"
                >
                    <div className="px-4">
                        <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none p-0 h-auto">
                            <TabsTrigger
                                value="my-tasks"
                                className="text-sm gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-4 pb-2"
                            >
                                My Tasks
                                {myTasks.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-[10px]">
                                        {myTasks.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="team-tasks"
                                className="text-sm gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-4 pb-2"
                            >
                                Group Tasks
                                {teamTasks.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 bg-violet-100 text-violet-700 text-[10px]">
                                        {teamTasks.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Task List */}
                    <div className="flex-1 overflow-y-auto">
                        <TabsContent value="my-tasks" className="mt-0 p-0">
                            <TaskList
                                tasks={filteredList}
                                isLoading={isLoadingList}
                                selectedRequestId={selectedRequestId}
                                onSelect={handleSelectTask}
                                onClaimTask={handleClaimTask}
                                onDeleteTask={handleDeleteTask}
                                isClaimPending={claimMutation.isPending}
                                isDeletePending={deleteMutation.isPending}
                                emptyIcon={CheckCircle}
                                emptyTitle="All caught up!"
                                emptySubtitle="No pending approvals for you."
                            />
                        </TabsContent>
                        <TabsContent value="team-tasks" className="mt-0 p-0">
                            <TaskList
                                tasks={filteredList}
                                isLoading={isLoadingList}
                                selectedRequestId={selectedRequestId}
                                onSelect={handleSelectTask}
                                onClaimTask={handleClaimTask}
                                onForceRelease={handleForceRelease}
                                onDeleteTask={handleDeleteTask}
                                isClaimPending={claimMutation.isPending}
                                isReleasePending={releaseMutation.isPending}
                                isDeletePending={deleteMutation.isPending}
                                emptyIcon={Users}
                                emptyTitle="No team tasks"
                                emptySubtitle="No group-assigned tasks available."
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* ─── CENTER + RIGHT PANES ─── */}
            {selectedRequestId ? (
                <InboxTaskDetail
                    key={selectedRequestId}
                    requestId={selectedRequestId}
                    onDeselect={handleDeselect}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <InboxIcon className="w-16 h-16 text-slate-200" />
                    <p className="text-lg font-medium text-slate-500">Select a task</p>
                    <p className="text-sm">Choose a task from the list to view its details</p>
                </div>
            )}

        </div>
    );
};

// ─── Sub‑Components ───────────────────────────────────────

interface TaskListProps {
    tasks: UnifiedTask[];
    isLoading: boolean;
    selectedRequestId: string | null;
    onSelect: (task: UnifiedTask) => void;
    onClaimTask: (e: React.MouseEvent, stepId: string) => void;
    onForceRelease?: (e: React.MouseEvent, stepId: string) => void;
    onDeleteTask: (e: React.MouseEvent, requestId: string, stepApprovalId?: string | null) => void;
    isClaimPending: boolean;
    isReleasePending?: boolean;
    isDeletePending: boolean;
    emptyIcon: React.ElementType;
    emptyTitle: string;
    emptySubtitle: string;
}

function TaskList({ tasks, isLoading, selectedRequestId, onSelect, onClaimTask, onForceRelease, onDeleteTask, isClaimPending, isReleasePending, isDeletePending, emptyIcon: EmptyIcon, emptyTitle, emptySubtitle }: TaskListProps) {
    if (isLoading) {
        return (
            <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse p-4 rounded-lg border border-slate-100">
                        <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                    </div>
                ))}
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <EmptyIcon className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
                <p className="text-xs text-slate-500 mt-1">{emptySubtitle}</p>
            </div>
        );
    }

    return (
        <div className="p-3 space-y-2">
            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={task.requestId === selectedRequestId}
                    onSelect={() => onSelect(task)}
                    onClaimTask={onClaimTask}
                    onForceRelease={onForceRelease}
                    onDeleteTask={onDeleteTask}
                    isClaimPending={isClaimPending}
                    isReleasePending={isReleasePending}
                    isDeletePending={isDeletePending}
                />
            ))}
        </div>
    );
}

interface TaskCardProps {
    task: UnifiedTask;
    isSelected: boolean;
    onSelect: () => void;
    onClaimTask: (e: React.MouseEvent, stepId: string) => void;
    onForceRelease?: (e: React.MouseEvent, stepId: string) => void;
    onDeleteTask: (e: React.MouseEvent, requestId: string, stepApprovalId?: string | null) => void;
    isClaimPending: boolean;
    isReleasePending?: boolean;
    isDeletePending: boolean;
}

function TaskCard({ task, isSelected, onSelect, onClaimTask, onForceRelease, onDeleteTask, isClaimPending, isReleasePending, isDeletePending }: TaskCardProps) {
    const priorityCfg = task.priority ? getPriorityConfig(task.priority) : null;
    const actionTitle = getActionTitle(task);

    // Determine card state
    const isClaimedByMe = task.claimedByMe;
    const isLocked = task.isTeamTask && !!task.claimedBy;
    const isUnclaimed = task.isTeamTask && !task.claimedBy;
    const isGroupTask = task.assignedType && task.assignedType !== 'USER';

    // Card border color
    const borderColor = isClaimedByMe
        ? 'border-l-emerald-500'
        : isLocked
            ? 'border-l-orange-500'
            : 'border-l-transparent';

    // Step icon
    const StepIcon = actionTitle.startsWith('Complete') ? ClipboardList : CheckCircle;
    const iconBg = isClaimedByMe
        ? 'bg-emerald-100 text-emerald-600'
        : isLocked
            ? 'bg-orange-100 text-orange-600'
            : isGroupTask
                ? 'bg-violet-100 text-violet-600'
                : 'bg-slate-100 text-slate-600';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
            className={`
                group w-full text-left px-4 py-3 rounded-xl border-l-4 border border-slate-200 transition-all duration-200 cursor-pointer relative
                ${borderColor}
                ${isSelected
                    ? 'bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                    : 'hover:bg-slate-50/80 hover:shadow-sm'
                }
            `}
        >
            {/* Row 1: Step icon + Action title + Status badge + Priority */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                        <StepIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">
                                {actionTitle}
                            </span>
                            {/* Status badge */}
                            {isClaimedByMe && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Claimed By You
                                </span>
                            )}
                            {isLocked && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full shrink-0">
                                    <Lock className="w-3 h-3" />
                                    Locked
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {priorityCfg && (
                        <Badge variant={priorityCfg.variant} className="text-[10px] py-0 h-4">
                            {priorityCfg.label}
                        </Badge>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
                                onDeleteTask(e, task.requestId, task.stepApprovalId);
                            }
                        }}
                        disabled={isDeletePending}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-90 disabled:opacity-50"
                        title="Delete Task"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Row 2: DisplayId + request title */}
            <div className="mt-0.5 pl-[36px]">
                <p className="text-xs text-slate-500">
                    {task.displayId && (
                        <span className="font-mono font-medium text-slate-600 mr-1.5">{task.displayId}</span>
                    )}
                    {task.title}
                </p>
            </div>

            {/* Row 3: Group badge (if group-assigned) */}
            {isGroupTask && task.assignedTo && (
                <div className="mt-1 pl-[36px]">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600">
                        <Users className="w-3 h-3" />
                        {task.assignedTo}
                    </span>
                </div>
            )}

            {/* Row 4: Requester */}
            {task.requester && (
                <p className="mt-1 pl-[36px] text-xs text-slate-500">
                    Requester: <span className="text-slate-700">{task.requester}</span>
                </p>
            )}

            {/* Row 5: Due Date */}
            {task.dueDate && (
                <p className="mt-0.5 pl-[36px] text-xs text-slate-500">
                    Due Date: <span className="text-slate-700">{new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </p>
            )}

            {/* Row 6: Claimed by + Force Release (for locked tasks in Group Tasks) */}
            {isLocked && task.claimedBy && (
                <div className="mt-1 pl-[36px] flex items-center gap-2">
                    <p className="text-[11px] text-orange-600 font-medium flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Claimed by: {task.claimedBy}
                    </p>
                    {onForceRelease && task.stepId && (
                        <button
                            onClick={(e) => onForceRelease(e, task.stepId!)}
                            disabled={isReleasePending}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                            Force Release
                        </button>
                    )}
                </div>
            )}

            {/* Claim button (for unclaimed group tasks) */}
            {isUnclaimed && task.stepId && (
                <div className="mt-2 pl-[36px]">
                    <button
                        onClick={(e) => onClaimTask(e, task.stepId!)}
                        disabled={isClaimPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                        <Hand className="w-3 h-3" />
                        {isClaimPending ? 'Claiming…' : 'Claim Task'}
                    </button>
                </div>
            )}
        </div>
    );
}
