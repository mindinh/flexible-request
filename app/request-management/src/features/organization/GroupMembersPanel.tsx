import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Trash2, Loader2, Users, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AdminService } from '../../services/AdminService';
import type { ShadowGroup, ShadowUser, GroupMember } from '../../types/IdentityEntities';
import { globalEvents, EVENT_TYPES } from '../../lib/events';

interface GroupMembersPanelProps {
    group: ShadowGroup | null;
    onClose: () => void;
}

/**
 * GroupMembersPanel - Slide-in panel for managing group members.
 * 
 * Features:
 * - View current members
 * - Search and add new members
 * - Remove existing members
 */
export function GroupMembersPanel({ group, onClose }: GroupMembersPanelProps) {
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ShadowUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addingUserId, setAddingUserId] = useState<string | null>(null);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

    // Load members when group changes
    useEffect(() => {
        if (group) {
            loadMembers();
        }
    }, [group?.ID]);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(() => {
            searchUsers();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    async function loadMembers() {
        if (!group) return;

        try {
            setIsLoading(true);
            const data = await AdminService.getGroupMembers(group.ID);
            setMembers(data);
        } catch (error) {
            console.error('Failed to load members:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to load group members');
        } finally {
            setIsLoading(false);
        }
    }

    async function searchUsers() {
        try {
            setIsSearching(true);
            const users = await AdminService.getShadowUsers(searchQuery);
            // Filter out users who are already members
            const memberUserIds = new Set(members.map(m => m.user_ID));
            const availableUsers = users.filter(u => !memberUserIds.has(u.ID));
            setSearchResults(availableUsers);
        } catch (error) {
            console.error('Failed to search users:', error);
        } finally {
            setIsSearching(false);
        }
    }

    async function handleAddMember(user: ShadowUser) {
        if (!group) return;

        try {
            setAddingUserId(user.ID);
            await AdminService.addGroupMember(group.ID, user.ID);
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, `Added ${user.displayName || user.email} to group`);

            // Refresh members and clear search
            await loadMembers();
            setSearchQuery('');
            setSearchResults([]);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.error?.message || 'Failed to add member';
            globalEvents.emit(EVENT_TYPES.API_ERROR, errorMessage);
        } finally {
            setAddingUserId(null);
        }
    }

    async function handleRemoveMember(member: GroupMember) {
        try {
            setRemovingMemberId(member.ID);
            await AdminService.removeGroupMember(member.ID);
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, 'Member removed from group');

            // Refresh members
            await loadMembers();
        } catch (error: any) {
            const errorMessage = error?.response?.data?.error?.message || 'Failed to remove member';
            globalEvents.emit(EVENT_TYPES.API_ERROR, errorMessage);
        } finally {
            setRemovingMemberId(null);
        }
    }

    if (!group) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50"
                onClick={onClose}
            >
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">{group.name}</h2>
                                <p className="text-sm text-slate-500">
                                    {members.length} {members.length === 1 ? 'member' : 'members'}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-9 w-9"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </Button>
                    </div>

                    {/* Search to Add */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search users to add..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Search Results */}
                        {searchQuery && (
                            <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                                {isSearching ? (
                                    <div className="p-4 text-center text-sm text-slate-500">
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                                        Searching...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">
                                        No users found
                                    </div>
                                ) : (
                                    searchResults.map(user => (
                                        <div
                                            key={user.ID}
                                            className="flex items-center justify-between p-3 hover:bg-slate-50 border-b last:border-b-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">
                                                        {user.displayName || 'Unknown'}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAddMember(user)}
                                                disabled={addingUserId === user.ID}
                                            >
                                                {addingUserId === user.ID ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <UserPlus className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Members List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <h3 className="text-sm font-medium text-slate-700 mb-3">Members</h3>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3 animate-pulse">
                                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                                        <div className="flex-1">
                                            <div className="h-4 bg-slate-200 rounded w-32 mb-1" />
                                            <div className="h-3 bg-slate-100 rounded w-48" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">No members yet</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Search above to add members
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {members.map(member => (
                                    <motion.div
                                        key={member.ID}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                                                <User className="w-5 h-5 text-slate-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">
                                                    {member.user?.displayName || 'Unknown'}
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    {member.user?.email}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveMember(member)}
                                            disabled={removingMemberId === member.ID}
                                            className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                        >
                                            {removingMemberId === member.ID ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
