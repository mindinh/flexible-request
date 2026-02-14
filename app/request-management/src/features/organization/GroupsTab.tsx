import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Building2, Briefcase, MoreVertical, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { AdminService } from '../../services/AdminService';
import type { ShadowGroup } from '../../types/IdentityEntities';
import { globalEvents, EVENT_TYPES } from '../../lib/events';
import { GroupDialog } from './GroupDialog';
import { DeleteGroupDialog } from './DeleteGroupDialog';
import { GroupMembersPanel } from './GroupMembersPanel';

// Icon mapping for group types
const typeIcons: Record<string, React.ElementType> = {
    GROUP: Users,
    TEAM: Users,
    DEPARTMENT: Building2,
    ROLE: Briefcase,
};

/**
 * GroupsTab - Manage Shadow Groups (Teams, Departments, Roles).
 * 
 * Full CRUD functionality for managing local groups:
 * - Create new groups
 * - Edit group name/description
 * - Delete groups (blocked if used in rules)
 */
export function GroupsTab() {
    const [groups, setGroups] = useState<ShadowGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog states
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ShadowGroup | null>(null);
    const [deletingGroup, setDeletingGroup] = useState<ShadowGroup | null>(null);

    // Dropdown menu state
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Members panel state
    const [managingMembersGroup, setManagingMembersGroup] = useState<ShadowGroup | null>(null);

    useEffect(() => {
        loadGroups();
    }, []);

    async function loadGroups() {
        try {
            setIsLoading(true);
            const data = await AdminService.getShadowGroups();
            setGroups(data);
        } catch (error) {
            console.error('Failed to load groups:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to load groups');
        } finally {
            setIsLoading(false);
        }
    }

    function handleEdit(group: ShadowGroup) {
        setOpenMenuId(null);
        setEditingGroup(group);
    }

    function handleDelete(group: ShadowGroup) {
        setOpenMenuId(null);
        setDeletingGroup(group);
    }

    function handleSuccess() {
        loadGroups();
    }

    const columns = [
        {
            key: 'name',
            header: 'Group',
            render: (group: ShadowGroup) => {
                const Icon = typeIcons[group.type?.code || 'GROUP'] || Users;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                            <div className="font-medium text-slate-900">{group.name}</div>
                            {group.description && (
                                <div className="text-sm text-slate-500 truncate max-w-xs">
                                    {group.description}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'type',
            header: 'Type',
            width: '150px',
            render: (group: ShadowGroup) => (
                <Badge variant="secondary">
                    {group.type?.name || group.type?.code || 'Unknown'}
                </Badge>
            )
        },
        {
            key: 'members',
            header: 'Members',
            width: '120px',
            render: (group: ShadowGroup) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-violet-600 hover:text-violet-700"
                    onClick={() => setManagingMembersGroup(group)}
                >
                    <UserPlus className="w-4 h-4" />
                    Manage
                </Button>
            )
        },
        {
            key: 'actions',
            header: '',
            width: '50px',
            render: (group: ShadowGroup) => (
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === group.ID ? null : group.ID);
                        }}
                    >
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                    </Button>

                    {/* Dropdown Menu */}
                    {openMenuId === group.ID && (
                        <>
                            {/* Backdrop to close menu */}
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-36 animate-in fade-in slide-in-from-top-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handleEdit(group)}
                                >
                                    <Pencil className="w-4 h-4" />
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDelete(group)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-white/60 backdrop-blur rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-600">
                    Create and manage groups for workflow assignment. Groups can represent teams,
                    departments, roles, or any collection of users.
                </p>
            </div>

            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">
                    {groups.length} {groups.length === 1 ? 'group' : 'groups'}
                </div>
                <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsCreateDialogOpen(true)}
                >
                    <Plus className="w-4 h-4" />
                    Create Group
                </Button>
            </div>

            {/* Groups Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <Table
                    columns={columns}
                    data={groups}
                    isLoading={isLoading}
                    emptyMessage="No groups have been created yet. Click 'Create Group' to get started."
                />
            </motion.div>

            {/* Create Dialog */}
            <GroupDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                group={null}
                onSuccess={handleSuccess}
            />

            {/* Edit Dialog */}
            <GroupDialog
                open={!!editingGroup}
                onOpenChange={(open) => !open && setEditingGroup(null)}
                group={editingGroup}
                onSuccess={handleSuccess}
            />

            {/* Delete Dialog */}
            <DeleteGroupDialog
                open={!!deletingGroup}
                onOpenChange={(open) => !open && setDeletingGroup(null)}
                group={deletingGroup}
                onSuccess={handleSuccess}
            />

            {/* Members Panel */}
            {managingMembersGroup && (
                <GroupMembersPanel
                    group={managingMembersGroup}
                    onClose={() => setManagingMembersGroup(null)}
                />
            )}
        </div>
    );
}
