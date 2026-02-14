import { useState, useMemo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, X, ListChecks, AlertTriangle, Files, CheckCircle } from 'lucide-react';
import { Button, Card, Table, Badge, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui';
import { api } from '../../lib/api';
import { RequestService } from '../../services/RequestService';
import { RequestTypeSelectionDialog } from './RequestTypeSelectionDialog';
import { RequestTypeIcon } from '../../components/shared/RequestTypeIcon';
import { RequestStatus, RequestPriority } from '../../types';
import type { Request, RequestType } from '../../types';
import { REQUEST_STATUS_CONFIG, PRIORITY_CONFIG } from '../../config';

// Use centralized configs (imported above)

// Statistics Card Component
const StatCard = ({ icon, label, value, color }: { icon: ReactNode; label: string; value: number; color: string }) => (
    <Card className="flex items-center gap-4 p-4">
        <div className={`p-3 rounded-xl ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
        </div>
    </Card>
);

export const RequestList = () => {
    const navigate = useNavigate();
    const [showTypeDialog, setShowTypeDialog] = useState(false);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const handleTypeSelect = (typeId: string) => {
        setShowTypeDialog(false);
        navigate(`/requests/create/${typeId}`);
    };

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['myRequests'],
        queryFn: RequestService.getRequests,
    });

    const { data: requestTypes = [] } = useQuery<RequestType[]>({
        queryKey: ['requestTypes'],
        queryFn: RequestService.getRequestTypes,
    });

    // Statistics calculations
    const stats = useMemo(() => {
        const total = requests.length;
        const pending = requests.filter((r: Request) => r.status === 'SUBMITTED' || r.status === 'IN_PROGRESS').length;
        const highPriority = requests.filter((r: Request) => r.priority === 'HIGH').length;
        const completed = requests.filter((r: Request) => r.status === 'COMPLETED').length;
        return { total, pending, highPriority, completed };
    }, [requests]);

    // Filtered requests
    const filteredRequests = useMemo(() => {
        return requests.filter((request: Request) => {
            const matchesSearch = !searchTerm || request.title?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
            const matchesType = typeFilter === 'all' || request.requestType?.ID === typeFilter;
            return matchesSearch && matchesStatus && matchesPriority && matchesType;
        });
    }, [requests, searchTerm, statusFilter, priorityFilter, typeFilter]);

    const hasFilters = searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all';

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setPriorityFilter('all');
        setTypeFilter('all');
    };

    const columns = [
        {
            key: 'title',
            header: 'Title',
            render: (row: Request) => (
                <div className="font-medium text-slate-900">{row.title}</div>
            )
        },
        {
            key: 'requestType.title',
            header: 'Type',
            render: (row: Request) => (
                <div className="flex items-center gap-2">
                    <RequestTypeIcon icon={row.requestType?.icon} variant="withBackground" size="sm" />
                    <span className="text-slate-700 font-medium">{row.requestType?.title || '-'}</span>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            render: (row: Request) => {
                const config = REQUEST_STATUS_CONFIG[row.status] || REQUEST_STATUS_CONFIG.DRAFT;
                return (
                    <Badge variant={config.variant} className="inline-flex items-center gap-1.5">
                        {config.icon}
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            key: 'priority',
            header: 'Priority',
            render: (row: Request) => {
                const config = PRIORITY_CONFIG[row.priority] || PRIORITY_CONFIG.MEDIUM;
                return (
                    <Badge variant={config.variant}>
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            key: 'createdAt',
            header: 'Created',
            render: (row: Request) => (
                <span className="text-slate-500 text-sm">
                    {new Date(row.createdAt).toLocaleDateString()}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
                    <p className="text-slate-500 mt-1">View and manage your submitted requests</p>
                </div>
                <Button
                    onClick={() => setShowTypeDialog(true)}
                >
                    <Plus className="w-4 h-4" />
                    New Request
                </Button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Files className="w-5 h-5 text-blue-600" />}
                    label="Total Requests"
                    value={stats.total}
                    color="bg-blue-100"
                />
                <StatCard
                    icon={<ListChecks className="w-5 h-5 text-amber-600" />}
                    label="Pending"
                    value={stats.pending}
                    color="bg-amber-100"
                />
                <StatCard
                    icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                    label="High Priority"
                    value={stats.highPriority}
                    color="bg-red-100"
                />
                <StatCard
                    icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                    label="Completed"
                    value={stats.completed}
                    color="bg-emerald-100"
                />
            </div>

            {/* Filter Bar */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search requests..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40 bg-white border-slate-200">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="all">All Statuses</SelectItem>
                                {Object.values(RequestStatus).map((status) => {
                                    const config = REQUEST_STATUS_CONFIG[status];
                                    return (
                                        <SelectItem key={status} value={status}>
                                            <span className="flex items-center gap-2">
                                                <Badge variant={config.variant} className="inline-flex items-center gap-1">
                                                    {config.icon} {config.label}
                                                </Badge>
                                            </span>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>

                        {/* Priority Filter */}
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-40 bg-white border-slate-200">
                                <SelectValue placeholder="All Priorities" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="all">All Priorities</SelectItem>
                                {Object.values(RequestPriority).map((priority) => {
                                    const config = PRIORITY_CONFIG[priority];
                                    return (
                                        <SelectItem key={priority} value={priority}>
                                            <Badge variant={config.variant}>{config.label}</Badge>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>

                        {/* Type Filter */}
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-48 bg-white border-slate-200">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="all">All Types</SelectItem>
                                {requestTypes.map((type) => (
                                    <SelectItem key={type.ID} value={type.ID}>
                                        <span className="flex items-center gap-2">
                                            <RequestTypeIcon icon={type.icon} variant="withBackground" size="sm" />
                                            {type.title}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Clear Filters Button - Always visible */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            disabled={!hasFilters}
                        >
                            <X className="w-4 h-4" />
                            Clear
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Requests Table */}
            <Card padding="none">
                <Table
                    columns={columns}
                    data={filteredRequests}
                    isLoading={isLoading}
                    emptyMessage="You haven't submitted any requests yet."
                    onRowClick={(row) => navigate(`/requests/${row.ID}`)}
                />
            </Card>

            {/* Request Type Selection Dialog */}
            <RequestTypeSelectionDialog
                open={showTypeDialog}
                onClose={() => setShowTypeDialog(false)}
                onSelect={handleTypeSelect}
            />
        </div>
    );
};
