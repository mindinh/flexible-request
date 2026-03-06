import { useState, useEffect, useMemo } from 'react';
import { useHierarchyStore, type HierarchyEdgeData, type HierarchyNodeData, type MemberInfo } from './useHierarchyStore';
import { Calendar, Shield, Trash2, User, Users, Plus, Minus, Search, X, Settings2 } from 'lucide-react';
import { AdminService } from '../../../services/AdminService';

const BRAND_RED = '#b10e10';

const RELATIONSHIP_OPTIONS = [
    'Direct Report', 'Matrix Manager', 'Dotted Line', 'Mentorship', 'Budget Owner', 'Custom',
];
const ACCESS_LEVEL_OPTIONS = ['View Only', 'Full Access', 'Restricted'];

/** Generates 2-char initials from a display name */
function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

/** Deterministic color from a string */
const AVATAR_COLORS = ['#6366f1', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
function getAvatarColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ──────────────────────────────────────────────
// User Picker Dialog
// ──────────────────────────────────────────────
function UserPickerDialog({
    title,
    excludeIds,
    onPick,
    onClose,
}: {
    title: string;
    excludeIds: Set<string>;
    onPick: (user: { ID: string; displayName: string; email?: string }) => void;
    onClose: () => void;
}) {
    const [search, setSearch] = useState('');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        AdminService.getShadowUsers()
            .then(setAllUsers)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return allUsers.filter(
            (u) =>
                !excludeIds.has(u.ID) &&
                (!q || u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        );
    }, [allUsers, search, excludeIds]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] max-h-[520px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                        <X size={16} />
                    </button>
                </div>
                <div className="px-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text" placeholder="Search users…" value={search}
                            onChange={(e) => setSearch(e.target.value)} autoFocus
                            className="w-full pl-9 pr-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {isLoading ? (
                        <div className="text-center text-[11px] text-slate-400 py-8">Loading users…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-[11px] text-slate-400 py-8">
                            {search ? 'No matching users' : 'No users available'}
                        </div>
                    ) : (
                        filtered.map((user) => {
                            const name = user.displayName || user.email || user.userId;
                            const initials = getInitials(name);
                            const color = getAvatarColor(user.ID);
                            return (
                                <div
                                    key={user.ID}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition group cursor-pointer"
                                    onClick={() => onPick(user)}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                                        style={{ backgroundColor: color }}
                                    >
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-medium text-slate-700 truncate">{name}</div>
                                        {user.email && <div className="text-[10px] text-slate-400 truncate">{user.email}</div>}
                                    </div>
                                    <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// Main HierarchyProperties Panel
// ──────────────────────────────────────────────
export function HierarchyProperties() {
    const { selectedEdgeId, selectedNodeId, edges, nodes, updateEdgeData, updateNodeData, removeNode, clearSelection } =
        useHierarchyStore();

    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [showUserPicker, setShowUserPicker] = useState(false);

    // === Edge Properties ===
    if (selectedEdgeId) {
        const edge = edges.find((e) => e.id === selectedEdgeId);
        if (!edge) return null;
        const edgeData = (edge.data || {}) as HierarchyEdgeData;
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
                        <Settings2 size={14} style={{ color: BRAND_RED }} />
                        Relationship Details
                    </h3>
                    <button onClick={clearSelection} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition"><X size={16} /></button>
                </div>
                <div className="flex flex-col gap-4 px-4 py-4">
                    <div className="rounded-xl border border-slate-200 p-3">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Connection Path</div>
                        <div className="text-[12px] text-slate-700 flex items-center gap-2">
                            <span className="font-medium">{(sourceNode?.data as HierarchyNodeData)?.label || 'Node'}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-medium">{(targetNode?.data as HierarchyNodeData)?.label || 'Node'}</span>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Relationship Type</label>
                        <select value={edgeData.relationship || 'Direct Report'} onChange={(e) => updateEdgeData(edge.id, { relationship: e.target.value })}
                            className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400">
                            {RELATIONSHIP_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5"><Shield size={10} className="inline mr-1" />Access Level</label>
                        <div className="flex gap-1.5">
                            {ACCESS_LEVEL_OPTIONS.map((level) => (
                                <button key={level} onClick={() => updateEdgeData(edge.id, { accessLevel: level })}
                                    className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all font-medium ${(edgeData.accessLevel || 'View Only') === level ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5"><Calendar size={10} className="inline mr-1" />Effective Date</label>
                        <input type="date" value={edgeData.effectiveDate || ''} onChange={(e) => updateEdgeData(edge.id, { effectiveDate: e.target.value })}
                            className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                    </div>
                </div>
            </div>
        );
    }

    // === Node Properties ===
    if (selectedNodeId) {
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (!node) return null;
        const nodeData = node.data as HierarchyNodeData;
        const isGroup = nodeData.entityType === 'GROUP';
        const isUser = nodeData.entityType === 'USER';
        const members: MemberInfo[] = nodeData.members || [];

        const handleAddMember = (user: { ID: string; displayName: string; email?: string }) => {
            const newMembers: MemberInfo[] = [...members, { userId: user.ID, displayName: user.displayName || user.email || '', email: user.email }];
            updateNodeData(selectedNodeId, { members: newMembers, memberCount: newMembers.length });
        };

        const handleRemoveMember = (userId: string) => {
            const newMembers = members.filter((m) => m.userId !== userId);
            updateNodeData(selectedNodeId, { members: newMembers, memberCount: newMembers.length });
        };

        const handleAssignUser = (user: { ID: string; displayName: string; email?: string }) => {
            updateNodeData(selectedNodeId, {
                entityId: user.ID,
                label: user.displayName || user.email || 'User',
                subtitle: user.email,
                isNew: false,
            });
            setShowUserPicker(false);
        };

        return (
            <div className="flex flex-col h-full">
                {/* Title Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
                        {isGroup ? <Users size={14} className="text-blue-600" /> : <User size={14} className="text-indigo-500" />}
                        {isGroup ? 'Group Details' : 'User Details'}
                    </h3>
                    <button onClick={clearSelection} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition"><X size={16} /></button>
                </div>

                <div className="flex flex-col gap-4 px-4 py-4 flex-1 overflow-y-auto">
                    {/* === USER NODE: Select User === */}
                    {isUser && (
                        <div className="rounded-xl border border-slate-200 p-3">
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Assigned User</label>
                            {nodeData.entityId ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                        style={{ backgroundColor: getAvatarColor(nodeData.entityId) }}>
                                        {getInitials(nodeData.label)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-medium text-slate-700 truncate">{nodeData.label}</div>
                                        {nodeData.subtitle && <div className="text-[10px] text-slate-400 truncate">{nodeData.subtitle}</div>}
                                    </div>
                                    <button onClick={() => setShowUserPicker(true)} className="text-[10px] text-blue-600 hover:underline font-medium">Change</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowUserPicker(true)}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-medium rounded-lg border-2 border-dashed border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 transition">
                                    <User size={14} /> Select User
                                </button>
                            )}
                        </div>
                    )}

                    {/* === GROUP NODE: Editable fields === */}
                    {isGroup && (
                        <>
                            {/* Section header */}
                            <div className="flex items-center gap-2">
                                <Settings2 size={12} className="text-slate-400" />
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Group Information</span>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Name</label>
                                <input type="text" value={nodeData.label}
                                    onChange={(e) => updateNodeData(selectedNodeId, { label: e.target.value })}
                                    placeholder="Group name"
                                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
                                <p className="text-[10px] text-slate-400 mt-1">Display name on the canvas</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Description</label>
                                <textarea value={nodeData.description || ''}
                                    onChange={(e) => updateNodeData(selectedNodeId, { description: e.target.value })}
                                    placeholder="Optional description" rows={2}
                                    className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none" />
                            </div>

                            {/* Members */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Members ({members.length})</label>
                                    <button onClick={() => setShowMemberPicker(true)}
                                        className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 transition">
                                        <Plus size={10} /> Add Member
                                    </button>
                                </div>

                                {members.length === 0 ? (
                                    <div className="text-[11px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                        No members yet
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
                                        {members.map((member) => {
                                            const initials = getInitials(member.displayName);
                                            const color = getAvatarColor(member.userId);
                                            return (
                                                <div key={member.userId}
                                                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition group">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                                        style={{ backgroundColor: color }}>
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[12px] font-medium text-slate-700 truncate">{member.displayName}</div>
                                                        {member.email && <div className="text-[10px] text-slate-400 truncate">{member.email}</div>}
                                                    </div>
                                                    <button onClick={() => handleRemoveMember(member.userId)}
                                                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                                                        title="Remove member">
                                                        <Minus size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* User info for user nodes */}
                    {isUser && nodeData.subtitle && (
                        <div className="rounded-xl border border-slate-200 p-3">
                            <div className="text-[10px] text-slate-400">Email</div>
                            <div className="text-[12px] text-slate-700 mt-0.5">{nodeData.subtitle}</div>
                        </div>
                    )}

                    {/* Delete */}
                    <button onClick={() => { removeNode(node.id); clearSelection(); }}
                        className="mt-auto flex items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-medium rounded-lg border border-red-200 hover:bg-red-50 transition"
                        style={{ color: BRAND_RED }}>
                        <Trash2 size={14} />
                        Remove from Canvas
                    </button>
                </div>

                {showMemberPicker && (
                    <UserPickerDialog title="Add Members" excludeIds={new Set(members.map((m) => m.userId))}
                        onPick={handleAddMember} onClose={() => setShowMemberPicker(false)} />
                )}
                {showUserPicker && (
                    <UserPickerDialog title="Select User" excludeIds={new Set()}
                        onPick={handleAssignUser} onClose={() => setShowUserPicker(false)} />
                )}
            </div>
        );
    }

    // === Empty State ===
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Settings2 size={28} className="text-slate-300 mb-3" />
            <p className="text-[12px] font-medium text-slate-500">Select a node or connection</p>
            <p className="text-[10px] text-slate-400 mt-1">Click on a node to view its details, or click a connection line to edit the relationship.</p>
        </div>
    );
}
