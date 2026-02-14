import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { AdminService } from '../../services/AdminService';
import type { ShadowUser } from '../../types/IdentityEntities';
import { globalEvents, EVENT_TYPES } from '../../lib/events';

/**
 * UsersTab - Display JIT-provisioned users from the Shadow Directory.
 * 
 * This is a read-only view of all users who have logged into the system.
 * Users are automatically provisioned on first login via JIT.
 */
export function UsersTab() {
    const [users, setUsers] = useState<ShadowUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        try {
            setIsLoading(true);
            const data = await AdminService.getShadowUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    }

    // Filter users based on search query
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;

        const query = searchQuery.toLowerCase();
        return users.filter(user =>
            user.displayName?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.userId?.toLowerCase().includes(query)
        );
    }, [users, searchQuery]);

    // Format date for display
    function formatDate(dateStr?: string): string {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const columns = [
        {
            key: 'displayName',
            header: 'User',
            render: (user: ShadowUser) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900">
                            {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'}
                        </div>
                        <div className="text-sm text-slate-500">{user.email || user.userId}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'origin',
            header: 'IDP Origin',
            width: '150px',
            render: (user: ShadowUser) => (
                <Badge variant="secondary">
                    {user.origin || 'sap.default'}
                </Badge>
            )
        },
        {
            key: 'isActive',
            header: 'Status',
            width: '120px',
            render: (user: ShadowUser) => (
                <Badge variant={user.isActive ? 'success' : 'error'}>
                    {user.isActive ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                    ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                    )}
                </Badge>
            )
        },
        {
            key: 'lastLoginAt',
            header: 'Last Login',
            width: '200px',
            render: (user: ShadowUser) => (
                <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{formatDate(user.lastLoginAt)}</span>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-white/60 backdrop-blur rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-600">
                    Users are automatically provisioned when they first log in (JIT - Just-In-Time provisioning).
                    This list shows all users who have accessed the application.
                </p>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="text-sm text-slate-500">
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
                </div>
            </div>

            {/* Users Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <Table
                    columns={columns}
                    data={filteredUsers}
                    isLoading={isLoading}
                    emptyMessage={
                        searchQuery
                            ? 'No users match your search criteria'
                            : 'No users have logged in yet'
                    }
                />
            </motion.div>
        </div>
    );
}
