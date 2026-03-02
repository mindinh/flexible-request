import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, User, Users, ChevronRight, Briefcase } from 'lucide-react';
import { Button, Card, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, TextArea, Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui';
import { useState } from 'react';
import { api } from '../../lib/api';
import { RequestService } from '../../services/RequestService';
import type { Request as ProRequest } from '../../types';


// InboxItem format returned by backend functions (getMyTasks, getTeamTasks, getCoordinatingRequests)
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
}

type InboxTab = 'my-tasks' | 'team-tasks' | 'coordinating';

export const Inbox = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedInboxItem, setSelectedInboxItem] = useState<InboxItem | null>(null);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState<InboxTab>('my-tasks');

    // My direct approvals - uses getMyTasks() backend function which filters by logged-in user
    const { data: myApprovals = [], isLoading: isLoadingMy } = useQuery({
        queryKey: ['myApprovals'],
        queryFn: () => RequestService.getMyTasks(),
    });

    // Team approvals (group-assigned) - uses InboxItem format
    const { data: teamApprovals = [], isLoading: isLoadingTeam } = useQuery({
        queryKey: ['teamApprovals'],
        queryFn: () => RequestService.getTeamApprovals(),
        enabled: activeTab === 'team-tasks',
    });

    // Requests I'm coordinating - uses InboxItem format
    const { data: coordinatingRequests = [], isLoading: isLoadingCoordinating } = useQuery({
        queryKey: ['coordinatingRequests'],
        queryFn: () => RequestService.getCoordinatingRequests(),
        enabled: activeTab === 'coordinating',
    });

    const approveMutation = useMutation({
        mutationFn: async (approvalId: string) => {
            await api.post(`/browse/StepApprovals(${approvalId})/RequestService.approve`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            setSelectedInboxItem(null);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ approvalId, reason }: { approvalId: string; reason: string }) => {
            await api.post(`/browse/StepApprovals(${approvalId})/RequestService.rejectApproval`, { reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['teamApprovals'] });
            setSelectedInboxItem(null);
            setShowRejectDialog(false);
            setRejectReason('');
        },
    });

    const handleApproveInboxItem = (item: InboxItem) => {
        if (item.stepApprovalId) {
            approveMutation.mutate(item.stepApprovalId);
        }
    };

    const handleReject = () => {
        if (selectedInboxItem?.stepApprovalId && rejectReason.trim()) {
            rejectMutation.mutate({ approvalId: selectedInboxItem.stepApprovalId, reason: rejectReason });
        }
    };

    // Render inbox item card (for InboxItem format from backend functions)
    const renderInboxItemCard = (item: InboxItem, isTeamTask = false) => (
        <Card key={item.stepApprovalId || item.requestId} className="hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTeamTask ? 'bg-violet-100' : 'bg-amber-100'}`}>
                        {isTeamTask ? (
                            <Users className="w-5 h-5 text-violet-600" />
                        ) : (
                            <Clock className="w-5 h-5 text-amber-600" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-medium text-gray-900">
                            {item.requestTitle || 'Unknown Request'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="neutral">
                                {item.requestType}
                            </Badge>
                            <span className="text-sm text-gray-500">
                                Step: {item.stepName}
                            </span>
                            {isTeamTask && (
                                <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                                    Team Task
                                </Badge>
                            )}
                            {item.claimedBy && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                    Claimed by: {item.claimedBy}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {item.stepApprovalId && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedInboxItem(item);
                                    setShowRejectDialog(true);
                                }}
                            >
                                <XCircle className="w-4 h-4" />
                                Reject
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => handleApproveInboxItem(item)}
                                isLoading={approveMutation.isPending}
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                            </Button>
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (item.requestId && item.requestId !== 'null') {
                                navigate(`/requests/${item.requestId}`);
                            }
                        }}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </Card>
    );

    // Render coordinating request card (uses Project Request format)
    const renderCoordinatingCard = (item: ProRequest) => (
        <Card key={item.ID} className="hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-gray-900">{item.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="neutral">
                                {item.requestType?.title || 'Unknown Type'}
                            </Badge>
                            <Badge
                                variant={item.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}
                            >
                                {item.status}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (item.ID && item.ID !== 'null') {
                                navigate(`/requests/${item.ID}`);
                            }
                        }}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </Card>
    );

    // Empty state component
    const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
        <Card>
            <div className="text-center py-12">
                <Icon className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                <p className="text-gray-500 mt-1">{subtitle}</p>
            </div>
        </Card>
    );

    // Loading skeleton
    const LoadingSkeleton = () => (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                </Card>
            ))}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                <p className="text-gray-500 mt-1">Tasks and approvals requiring your attention</p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as InboxTab)}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="my-tasks" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        My Tasks
                        {myApprovals.length > 0 && (
                            <Badge variant="secondary" className="ml-1">
                                {myApprovals.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="team-tasks" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Team Tasks
                        {teamApprovals.length > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-violet-100 text-violet-700">
                                {teamApprovals.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="coordinating" className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Coordinating
                        {coordinatingRequests.length > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-emerald-100 text-emerald-700">
                                {coordinatingRequests.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* My Tasks Tab */}
                <TabsContent value="my-tasks" className="mt-4">
                    {isLoadingMy ? (
                        <LoadingSkeleton />
                    ) : myApprovals.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle}
                            title="All caught up!"
                            subtitle="No pending approvals for you."
                        />
                    ) : (
                        <div className="space-y-4">
                            {myApprovals.map((item: InboxItem) => renderInboxItemCard(item))}
                        </div>
                    )}
                </TabsContent>

                {/* Team Tasks Tab */}
                <TabsContent value="team-tasks" className="mt-4">
                    {isLoadingTeam ? (
                        <LoadingSkeleton />
                    ) : teamApprovals.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title="No team tasks"
                            subtitle="No group-assigned tasks available."
                        />
                    ) : (
                        <div className="space-y-4">
                            {teamApprovals.map((item: InboxItem) => renderInboxItemCard(item, true))}
                        </div>
                    )}
                </TabsContent>

                {/* Coordinating Tab */}
                <TabsContent value="coordinating" className="mt-4">
                    {isLoadingCoordinating ? (
                        <LoadingSkeleton />
                    ) : coordinatingRequests.length === 0 ? (
                        <EmptyState
                            icon={Briefcase}
                            title="Not coordinating any requests"
                            subtitle="You are not assigned as coordinator for any active requests."
                        />
                    ) : (
                        <div className="space-y-4">
                            {coordinatingRequests.map((item: ProRequest) => renderCoordinatingCard(item))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Reject Dialog */}
            <Dialog
                open={showRejectDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowRejectDialog(false);
                        setRejectReason('');
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Approval</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <label className="text-sm font-medium text-gray-700">Reason for rejection</label>
                        <TextArea
                            placeholder="Please provide a reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={!rejectReason.trim()}
                            isLoading={rejectMutation.isPending}
                        >
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

