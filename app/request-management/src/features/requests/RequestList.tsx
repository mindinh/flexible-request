import { useState, useMemo } from 'react';
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Copy,
    Trash2,
    TrendingUp,
    Clock,
    RotateCcw,
    XCircle,
    SlidersHorizontal,
    EyeOff,
    Search,
    Calendar,
} from 'lucide-react';
import {
    Badge,
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Checkbox,
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
    toast,
} from '../../components/ui';
import { RequestService } from '../../services/RequestService';
import { RequestTypeSelectionDialog } from './RequestTypeSelectionDialog';
import { RequestStatus, RequestPriority } from '../../types';
import type { Request, RequestType } from '../../types';
import { REQUEST_STATUS_CONFIG, PRIORITY_CONFIG } from '../../config';
import { useAuth } from '../../lib/auth-context';

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────
interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    iconColor: string;
    iconBg: string;
}

const StatCard = ({ label, value, icon, iconColor, iconBg }: StatCardProps) => (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
            <span className={`p-1.5 rounded-full ${iconBg}`}>
                <span className={iconColor}>{icon}</span>
            </span>
        </div>
        <p className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Priority Dot
// ─────────────────────────────────────────────────────────────
const PRIORITY_DOT: Record<string, { dot: string; label: string }> = {
    HIGH: { dot: 'bg-red-500', label: 'High' },
    MEDIUM: { dot: 'bg-orange-400', label: 'Medium' },
    LOW: { dot: 'bg-blue-400', label: 'Low' },
};

function PriorityDot({ priority }: { priority?: string }) {
    const cfg = PRIORITY_DOT[priority || ''] || PRIORITY_DOT.MEDIUM;
    return (
        <span className="flex items-center gap-1.5 text-sm text-slate-700 font-medium">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────
// Coordinator Avatar
// ─────────────────────────────────────────────────────────────
function CoordinatorAvatar({ name }: { name?: string | null }) {
    if (!name) return <span className="text-slate-400 text-sm">-</span>;
    const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
    const colors = [
        'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
        'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
    ];
    const colorIdx = name.charCodeAt(0) % colors.length;
    return (
        <span className="flex items-center gap-2">
            <span
                className={`w-7 h-7 rounded-full ${colors[colorIdx]} text-white text-[11px] font-bold flex items-center justify-center shrink-0`}
            >
                {initials}
            </span>
            <span className="text-sm text-slate-700">{name}</span>
        </span>
    );
}

// ─────────────────────────────────────────────────────────────
// Status Chip
// ─────────────────────────────────────────────────────────────
const STATUS_CHIP: Record<string, string> = {
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    DRAFT: 'bg-slate-100 text-slate-700',
    WITHDRAWN: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL: Record<string, string> = {
    IN_PROGRESS: 'In Progress',
    SUBMITTED: 'Submitted',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    DRAFT: 'Draft',
    WITHDRAWN: 'Withdrawn',
};

function StatusChip({ status }: { status?: string }) {
    const cls = STATUS_CHIP[status || ''] || STATUS_CHIP.DRAFT;
    const lbl = STATUS_LABEL[status || ''] || status || '-';
    return (
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}>{lbl}</span>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export const RequestList = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showTypeDialog, setShowTypeDialog] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Filter states
    const [search, setSearch] = useState('');
    const [requestIdFilter, setRequestIdFilter] = useState('');
    const [refFilter, setRefFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [stepFilter, setStepFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [dueDateFilter, setDueDateFilter] = useState('all');
    const [coordinatorFilter, setCoordinatorFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(true);
    const [visibleFilters, setVisibleFilters] = useState({
        search: true,
        requestId: true,
        refRequest: true,
        requestType: true,
        status: true,
        step: true,
        priority: true,
        dueDate: true,
        coordinator: true,
    });

    const { isAdmin, currentUserId } = useAuth();

    const handleTypeSelect = (typeId: string) => {
        setShowTypeDialog(false);
        navigate(`/requests/create/${typeId}`);
    };

    // ── Copy mutation: creates a draft copy of each selected request ──
    const copyMutation = useMutation({
        mutationFn: async () => {
            const ids = Array.from(selected);
            const results = await Promise.all(ids.map((id) => RequestService.copyRequest(id)));
            return results;
        },
        onSuccess: (newRequests) => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['myRequests'] });
            setSelected(new Set());
            toast.success(`${newRequests.length} request(s) copied successfully.`);
        },
        onError: () => toast.error('Failed to copy request(s). Please try again.'),
    });

    // ── Delete mutation: removes each selected request ──
    const deleteMutation = useMutation({
        mutationFn: async () => {
            const ids = Array.from(selected);
            await Promise.all(ids.map((id) => RequestService.deleteRequest(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['myRequests'] });
            setSelected(new Set());
            setShowDeleteConfirm(false);
            toast.success('Selected request(s) deleted.');
        },
        onError: () => {
            setShowDeleteConfirm(false);
            toast.error('Failed to delete request(s). Please try again.');
        },
    });

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['myRequests', isAdmin ? 'all' : currentUserId],
        queryFn: () => RequestService.getRequests(isAdmin ? undefined : currentUserId),
    });

    const { data: requestTypes = [] } = useQuery<RequestType[]>({
        queryKey: ['requestTypes'],
        queryFn: RequestService.getRequestTypes,
    });

    const { data: users = [] } = useQuery({
        queryKey: ['shadowUsers'],
        queryFn: RequestService.getShadowUsers,
    });

    // Statistics
    const stats = useMemo(() => {
        const total = requests.length;
        const pending = requests.filter((r: Request) => r.status === 'SUBMITTED' || r.status === 'IN_PROGRESS').length;
        const returned = requests.filter((r: Request) => r.status === 'DRAFT').length;
        const rejected = requests.filter((r: Request) => r.status === 'REJECTED').length;
        return { total, pending, returned, rejected };
    }, [requests]);

    // Filtered list
    const filteredRequests = useMemo(() => {
        return requests.filter((r: Request) => {
            const q = search.toLowerCase();
            const matchSearch = !search || r.title?.toLowerCase().includes(q);
            const matchId = !requestIdFilter || (r.displayId || '').toLowerCase().includes(requestIdFilter.toLowerCase());
            const matchStatus = statusFilter === 'all' || r.status === statusFilter;
            const matchPriority = priorityFilter === 'all' || r.priority === priorityFilter;
            const matchType = typeFilter === 'all' || (r as any).requestType?.ID === typeFilter;

            let matchDueDate = true;
            if (dueDateFilter !== 'all' && (r as any).dueDate) {
                const d = parseISO((r as any).dueDate);
                if (dueDateFilter === 'today') matchDueDate = isToday(d);
                else if (dueDateFilter === 'week') matchDueDate = isThisWeek(d, { weekStartsOn: 1 });
                else if (dueDateFilter === 'month') matchDueDate = isThisMonth(d);
            } else if (dueDateFilter !== 'all') {
                matchDueDate = false;
            }

            const matchCoordinator = coordinatorFilter === 'all' || (r as any).coordinatorId === coordinatorFilter || (coordinatorFilter === 'creator' && !r.coordinatorId);

            return matchSearch && matchId && matchStatus && matchPriority && matchType && matchDueDate && matchCoordinator;
        });
    }, [requests, search, requestIdFilter, statusFilter, priorityFilter, typeFilter, dueDateFilter, coordinatorFilter]);

    const clearAll = () => {
        setSearch('');
        setRequestIdFilter('');
        setRefFilter('');
        setTypeFilter('all');
        setStatusFilter('all');
        setStepFilter('all');
        setPriorityFilter('all');
        setDueDateFilter('');
        setCoordinatorFilter('');
        setSelected(new Set());
    };

    const toggleRow = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === filteredRequests.length && filteredRequests.length > 0) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredRequests.map((r: Request) => r.ID || '')));
        }
    };

    const allSelected = filteredRequests.length > 0 && selected.size === filteredRequests.length;

    return (
        <div className="space-y-5 pb-8">
            {/* ─── Header ─── */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
                <p className="text-sm text-blue-600 mt-0.5">View and manage your submitted requests</p>
            </div>

            {/* ─── Stat Cards ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Requests"
                    value={stats.total}
                    icon={<TrendingUp className="w-4 h-4" />}
                    iconColor="text-blue-500"
                    iconBg="bg-blue-50"
                />
                <StatCard
                    label="Pending Approval"
                    value={stats.pending}
                    icon={<Clock className="w-4 h-4" />}
                    iconColor="text-amber-500"
                    iconBg="bg-amber-50"
                />
                <StatCard
                    label="Returned"
                    value={stats.returned}
                    icon={<RotateCcw className="w-4 h-4" />}
                    iconColor="text-orange-500"
                    iconBg="bg-orange-50"
                />
                <StatCard
                    label="Rejected"
                    value={stats.rejected}
                    icon={<XCircle className="w-4 h-4" />}
                    iconColor="text-red-500"
                    iconBg="bg-red-50"
                />
            </div>

            {showFilters && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    {/* Row 1 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Search */}
                        {visibleFilters.search && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="ProRequest..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Request ID */}
                        {visibleFilters.requestId && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Request ID</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">REQ-</span>
                                    <input
                                        type="text"
                                        value={requestIdFilter}
                                        onChange={(e) => setRequestIdFilter(e.target.value)}
                                        className="w-full pl-12 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Ref. Request */}
                        {visibleFilters.refRequest && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Ref.Request</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">REF-</span>
                                    <input
                                        type="text"
                                        value={refFilter}
                                        onChange={(e) => setRefFilter(e.target.value)}
                                        className="w-full pl-12 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Request Type */}
                        {visibleFilters.requestType && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Request Type</label>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm">
                                        <SelectValue placeholder="All Types" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Types</SelectItem>
                                        {requestTypes.map((t) => (
                                            <SelectItem key={t.ID || 'unknown'} value={t.ID || ''}>{t.title || ''}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                        {/* Overall Status */}
                        {visibleFilters.status && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Overall Status</label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm">
                                        <SelectValue placeholder="Any Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">Any Status</SelectItem>
                                        {Object.values(RequestStatus).map((s) => {
                                            const cfg = REQUEST_STATUS_CONFIG[s];
                                            return (
                                                <SelectItem key={s} value={s}>
                                                    <span className="flex items-center gap-2">
                                                        <Badge variant={cfg.variant} className="inline-flex items-center gap-1">
                                                            {cfg.icon} {cfg.label}
                                                        </Badge>
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Step */}
                        {visibleFilters.step && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Step</label>
                                <Select value={stepFilter} onValueChange={setStepFilter}>
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm">
                                        <SelectValue placeholder="All Steps" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Steps</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Priority */}
                        {visibleFilters.priority && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
                                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm">
                                        <SelectValue placeholder="All Priorities" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Priorities</SelectItem>
                                        {Object.values(RequestPriority).map((p) => {
                                            const cfg = PRIORITY_CONFIG[p];
                                            return (
                                                <SelectItem key={p} value={p}>
                                                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Due Date */}
                        {visibleFilters.dueDate && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Due Date</label>
                                <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <SelectValue placeholder="Select Date" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Dates</SelectItem>
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="week">This Week</SelectItem>
                                        <SelectItem value="month">This Month</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Row 3 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                        {/* Coordinator */}
                        {visibleFilters.coordinator && (
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Coordinator</label>
                                <Select value={coordinatorFilter} onValueChange={setCoordinatorFilter}>
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Search className="w-3.5 h-3.5 text-slate-400" />
                                            <SelectValue placeholder="Select User..." />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-white max-h-60 overflow-y-auto">
                                        <SelectItem value="all">All Users</SelectItem>
                                        {users.map((u: any) => (
                                            <SelectItem key={u.ID} value={u.ID}>
                                                {u.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-5 flex-wrap">
                        <button
                            className="px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Go
                        </button>
                        <button
                            className="px-4 py-2 text-sm font-medium border border-red-400 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            onClick={clearAll}
                        >
                            Clear All
                        </button>
                        <button
                            className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                            onClick={() => setShowFilters(false)}
                        >
                            <EyeOff className="w-3.5 h-3.5" />
                            Hidden Filter
                        </button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    Filter
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2 bg-white shadow-lg border border-slate-200" align="start">
                                <div className="space-y-1">
                                    <h4 className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 mb-1">Configure Filters</h4>
                                    <div className="space-y-0.5">
                                        {[
                                            { id: 'search', label: 'Search' },
                                            { id: 'requestId', label: 'Request ID' },
                                            { id: 'refRequest', label: 'Ref. Request' },
                                            { id: 'requestType', label: 'Request Type' },
                                            { id: 'status', label: 'Overall Status' },
                                            { id: 'step', label: 'Step' },
                                            { id: 'priority', label: 'Priority' },
                                            { id: 'dueDate', label: 'Due Date' },
                                            { id: 'coordinator', label: 'Coordinator' },
                                        ].map((filter) => (
                                            <div key={filter.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors">
                                                <Checkbox
                                                    id={`filter-${filter.id}`}
                                                    checked={(visibleFilters as any)[filter.id]}
                                                    onCheckedChange={(checked) =>
                                                        setVisibleFilters(prev => ({ ...prev, [filter.id]: !!checked }))
                                                    }
                                                />
                                                <label
                                                    htmlFor={`filter-${filter.id}`}
                                                    className="text-sm text-slate-600 cursor-pointer flex-1"
                                                >
                                                    {filter.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            )}

            {!showFilters && (
                <div className="flex justify-start">
                    <button
                        className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm bg-white"
                        onClick={() => setShowFilters(true)}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Show Filter Bar
                    </button>
                </div>
            )}

            {/* ─── Table Area ─── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
                    <button
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        onClick={() => setShowTypeDialog(true)}
                    >
                        <Plus className="w-4 h-4" />
                        Create New Request
                    </button>
                    <button
                        disabled={selected.size === 0 || copyMutation.isPending}
                        onClick={() => copyMutation.mutate()}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                        <Copy className="w-4 h-4" />
                        {copyMutation.isPending ? 'Copying…' : 'Copy'}
                    </button>
                    {isAdmin && (
                        <button
                            disabled={selected.size === 0 || deleteMutation.isPending}
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                        </button>
                    )}
                    {selected.size > 0 && (
                        <span className="ml-auto text-xs text-slate-500 font-medium">{selected.size} selected</span>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="w-10 pl-5 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        className="w-4 h-4 accent-red-600 rounded"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Request ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Request Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Reference Request</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Step</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Due Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Coordinator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-100">
                                        {[...Array(10)].map((__, j) => (
                                            <td key={j} className="px-4 py-4">
                                                <div className="h-3 rounded bg-slate-200 animate-pulse w-full" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-16 text-slate-400 text-sm">
                                        You haven't submitted any requests yet.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((row: Request) => {
                                    const isRowSelected = selected.has(row.ID || '');
                                    const dueDate = (row as any).dueDate
                                        ? new Date((row as any).dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                                        : '-';
                                    const coordinator = (row as any).coordinatorDisplayName || (row as any).createdBy?.displayName || '-';
                                    const currentStep = (row as any).currentStepName || '-';

                                    return (
                                        <tr
                                            key={row.ID}
                                            className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50/70 transition-colors ${isRowSelected ? 'bg-red-50/40' : ''}`}
                                            onClick={() => { if (row.ID && row.ID !== 'null') navigate(`/requests/${row.ID}`); }}
                                        >
                                            <td className="w-10 pl-5 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isRowSelected}
                                                    onChange={() => toggleRow(row.ID || '')}
                                                    className="w-4 h-4 accent-red-600 rounded"
                                                />
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-bold text-blue-600 text-sm">{row.displayId || '-'}</span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900 max-w-[220px] truncate">
                                                {row.title}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {row.requestType?.title ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                        {row.requestType.title}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap text-sm">
                                                {row.refRequest?.displayId ? (
                                                    <span className="cursor-pointer hover:underline" onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/requests/${row.refRequest_ID}`);
                                                    }}>
                                                        {row.refRequest.displayId}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <StatusChip status={row.status ?? undefined} />
                                            </td>
                                            <td className="px-4 py-3 text-left">
                                                <span className="text-slate-700 font-medium">{currentStep}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <PriorityDot priority={row.priority ?? undefined} />
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-sm">{dueDate}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <CoordinatorAvatar name={coordinator} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Request Type Selection Dialog */}
            <RequestTypeSelectionDialog
                open={showTypeDialog}
                onClose={() => setShowTypeDialog(false)}
                onSelect={handleTypeSelect}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selected.size} request(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action is permanent and cannot be undone. The selected request(s) will be removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
