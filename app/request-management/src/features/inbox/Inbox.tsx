import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle,
    Clock,
    User,
    Users,
    Briefcase,
    Search,
    Inbox as InboxIcon,
} from 'lucide-react';
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui';
import { useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { RequestService } from '../../services/RequestService';
import { InboxTaskDetail } from './components/InboxTaskDetail';
import { getPriorityConfig } from '../../config';

/** Format returned by the legacy OData $expand query for My Tasks */
interface ApprovalItem {
    ID: string;
    status: string;
    isGroupAssigned?: boolean;
    step?: {
        stepName: string;
        request?: {
            ID: string;
            title: string;
            priority?: string;
            requestType?: { title: string };
            createdBy?: string;
        };
    };
}

/** Format returned by backend functions (getTeamTasks, getCoordinatingRequests) */
interface InboxItem {
    stepApprovalId: string | null;
    stepId: string | null;
    requestId: string;
    requestTitle: string;
    requestType: string;
    stepName: string;
    status: string;
    assignedTo: string;
    assignedType: string;
    claimedBy: string | null;
    createdAt: string;
    dueDate: string | null;
    priority?: string;
    requester?: string;
}

type InboxTab = 'my-tasks' | 'team-tasks' | 'coordinating';

/** Unified shape for the task list regardless of source */
interface UnifiedTask {
    id: string;
    requestId: string;
    title: string;
    requestType: string;
    stepName: string;
    priority?: string;
    requester?: string;
    dueDate?: string | null;
    isTeamTask?: boolean;
    claimedBy?: string | null;
    status?: string;
}

/**
 * Inbox Page — Master-Detail Layout
 *
 * Left pane: Task list with tabs (My Tasks, Team Tasks, Coordinating)
 * Center pane + Right pane: InboxTaskDetail (form schema + collapsible workflow)
 */
export const Inbox = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<InboxTab>('my-tasks');
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ─── Data Fetching ────────────────────────────────────────
    const { data: myApprovals = [], isLoading: isLoadingMy } = useQuery({
        queryKey: ['myApprovals'],
        queryFn: async () => {
            const response = await api.get(
                "/browse/StepApprovals?$filter=status eq 'PENDING'&$expand=step($expand=request($expand=requestType))"
            );
            return response.data.value || [];
        },
    });

    const { data: teamApprovals = [], isLoading: isLoadingTeam } = useQuery({
        queryKey: ['teamApprovals'],
        queryFn: () => RequestService.getTeamApprovals(),
        enabled: activeTab === 'team-tasks',
    });

    const { data: coordinatingRequests = [], isLoading: isLoadingCoordinating } = useQuery({
        queryKey: ['coordinatingRequests'],
        queryFn: () => RequestService.getCoordinatingRequests(),
        enabled: activeTab === 'coordinating',
    });

    // ─── Normalize to UnifiedTask ────────────────────────────
    const myTasks: UnifiedTask[] = useMemo(
        () =>
            myApprovals.map((item: ApprovalItem) => ({
                id: item.ID,
                requestId: item.step?.request?.ID || '',
                title: item.step?.request?.title || 'Unknown Request',
                requestType: item.step?.request?.requestType?.title || '',
                stepName: item.step?.stepName || '',
                priority: item.step?.request?.priority,
                requester: item.step?.request?.createdBy,
            })),
        [myApprovals],
    );

    const teamTasks: UnifiedTask[] = useMemo(
        () =>
            teamApprovals.map((item: InboxItem) => ({
                id: item.stepApprovalId || item.requestId,
                requestId: item.requestId,
                title: item.requestTitle,
                requestType: item.requestType,
                stepName: item.stepName,
                priority: item.priority,
                requester: item.requester,
                dueDate: item.dueDate,
                isTeamTask: true,
                claimedBy: item.claimedBy,
            })),
        [teamApprovals],
    );

    const coordTasks: UnifiedTask[] = useMemo(
        () =>
            coordinatingRequests.map((item: InboxItem) => ({
                id: item.requestId,
                requestId: item.requestId,
                title: item.requestTitle,
                requestType: item.requestType,
                stepName: item.stepName,
                status: item.status,
                priority: item.priority,
                requester: item.requester,
                dueDate: item.dueDate,
            })),
        [coordinatingRequests],
    );

    // ─── Active list based on tab ─────────────────────────────
    const activeList =
        activeTab === 'my-tasks'
            ? myTasks
            : activeTab === 'team-tasks'
                ? teamTasks
                : coordTasks;

    const isLoadingList =
        activeTab === 'my-tasks'
            ? isLoadingMy
            : activeTab === 'team-tasks'
                ? isLoadingTeam
                : isLoadingCoordinating;

    // ─── Filter by search ─────────────────────────────────────
    const filteredList = useMemo(() => {
        if (!searchQuery.trim()) return activeList;
        const q = searchQuery.toLowerCase();
        return activeList.filter(
            (t) =>
                t.title.toLowerCase().includes(q) ||
                t.requestType.toLowerCase().includes(q) ||
                t.stepName.toLowerCase().includes(q),
        );
    }, [activeList, searchQuery]);

    // ─── Handlers ─────────────────────────────────────────────
    const handleSelectTask = (task: UnifiedTask) => {
        setSelectedRequestId(task.requestId);
    };

    const handleDeselect = () => {
        setSelectedRequestId(null);
        // Refresh inbox queries after actions
        queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
        queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
        queryClient.invalidateQueries({ queryKey: ['coordinatingRequests'] });
    };

    // ─── Render ───────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100vh-4rem)] -m-6 bg-white">
            {/* ─── LEFT PANE: Task List ─── */}
            <div className="w-[400px] min-w-[340px] border-r border-slate-200 flex flex-col bg-white">
                {/* Search */}
                <div className="p-3 border-b border-slate-200">
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
                        setSelectedRequestId(null);
                    }}
                >
                    <div className="px-3 pt-3">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="my-tasks" className="text-xs gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                My Tasks
                                {myTasks.length > 0 && (
                                    <Badge variant="secondary" size="sm" className="ml-1">
                                        {myTasks.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="team-tasks" className="text-xs gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                Group Tasks
                                {teamTasks.length > 0 && (
                                    <Badge variant="secondary" size="sm" className="ml-1 bg-violet-100 text-violet-700">
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
    emptyIcon: React.ElementType;
    emptyTitle: string;
    emptySubtitle: string;
}

function TaskList({ tasks, isLoading, selectedRequestId, onSelect, emptyIcon: EmptyIcon, emptyTitle, emptySubtitle }: TaskListProps) {
    if (isLoading) {
        return (
            <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse p-4 rounded-lg border border-slate-100">
                        <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
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
        <div className="p-2 space-y-1">
            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={task.requestId === selectedRequestId}
                    onSelect={() => onSelect(task)}
                />
            ))}
        </div>
    );
}

interface TaskCardProps {
    task: UnifiedTask;
    isSelected: boolean;
    onSelect: () => void;
}

function TaskCard({ task, isSelected, onSelect }: TaskCardProps) {
    const priorityCfg = task.priority ? getPriorityConfig(task.priority) : null;

    return (
        <button
            onClick={onSelect}
            className={`
                w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer
                ${isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/80'
                }
            `}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${task.isTeamTask ? 'bg-violet-100' : 'bg-amber-100'
                        }`}>
                        {task.isTeamTask ? (
                            <Users className="w-4 h-4 text-violet-600" />
                        ) : (
                            <Clock className="w-4 h-4 text-amber-600" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                            {task.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                            {task.requestType}
                        </p>
                    </div>
                </div>
                {priorityCfg && (
                    <Badge variant={priorityCfg.variant} size="sm" className="shrink-0">
                        {priorityCfg.label}
                    </Badge>
                )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 pl-11">
                {task.requester && <span>Requester: {task.requester}</span>}
                {task.dueDate && (
                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                )}
            </div>

            {task.isTeamTask && (
                <div className="mt-1.5 pl-11">
                    {task.claimedBy ? (
                        <Badge variant="secondary" size="sm" className="bg-blue-100 text-blue-700 text-[10px]">
                            Claimed by: {task.claimedBy}
                        </Badge>
                    ) : (
                        <Badge variant="secondary" size="sm" className="bg-violet-100 text-violet-700 text-[10px]">
                            Team Task
                        </Badge>
                    )}
                </div>
            )}
        </button>
    );
}
