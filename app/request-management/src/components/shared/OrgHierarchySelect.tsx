import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronRight, Users, User, Building2, Briefcase, Network, Loader2, FolderTree } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AdminService } from '../../services/AdminService';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Principal } from './PrincipalSelect';

const BRAND_RED = '#b10e10';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A node in the computed org tree */
interface OrgTreeNode {
    id: string;
    type: 'GROUP' | 'USER';
    name: string;
    email?: string;
    groupTypeCode?: string;
    children: OrgTreeNode[];
}

interface OrgHierarchySelectProps {
    onChange: (principal: Principal | null) => void;
    placeholder?: string;
    disabled?: boolean;
    excludeIds?: string[];
    className?: string;
}

// ─── Icon helpers ───────────────────────────────────────────────────────────

const typeIcons: Record<string, React.ElementType> = {
    USER: User,
    GROUP: Users,
    TEAM: Users,
    DEPARTMENT: Building2,
    ROLE: Briefcase,
    POSITION: Network,
};

// ─── TreeNodeRow ────────────────────────────────────────────────────────────

function TreeNodeRow({
    node,
    depth,
    expanded,
    onToggle,
    onSelect,
    searchQuery,
    excludeIds,
    isLast,
}: {
    node: OrgTreeNode;
    depth: number;
    expanded: Set<string>;
    onToggle: (id: string) => void;
    onSelect: (node: OrgTreeNode) => void;
    searchQuery: string;
    excludeIds: Set<string>;
    isLast: boolean;
}) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isExcluded = excludeIds.has(node.id);
    const Icon = typeIcons[node.groupTypeCode || node.type] || Users;

    // Highlight matching text
    const highlightMatch = (text: string) => {
        if (!searchQuery) return text;
        const idx = text.toLowerCase().indexOf(searchQuery.toLowerCase());
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <mark className="bg-amber-200/60 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + searchQuery.length)}</mark>
                {text.slice(idx + searchQuery.length)}
            </>
        );
    };

    return (
        <>
            <button
                disabled={isExcluded}
                onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren && node.type === 'GROUP') {
                        onToggle(node.id);
                    }
                    onSelect(node);
                }}
                className={cn(
                    'w-full flex items-center gap-2 py-1.5 text-left transition-colors rounded-md group relative',
                    isExcluded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-red-50/50 cursor-pointer',
                )}
                style={{ paddingLeft: `${8 + depth * 20}px`, paddingRight: '8px' }}
            >
                {/* Tree connector lines */}
                {depth > 0 && (
                    <>
                        {/* Horizontal branch line */}
                        <span
                            className="absolute border-t border-slate-300"
                            style={{
                                left: `${depth * 20 - 4}px`,
                                width: '12px',
                                top: '50%',
                            }}
                        />
                        {/* Vertical line from parent */}
                        <span
                            className="absolute border-l border-slate-300"
                            style={{
                                left: `${depth * 20 - 4}px`,
                                top: 0,
                                height: isLast ? '50%' : '100%',
                            }}
                        />
                    </>
                )}

                {/* Expand/collapse chevron */}
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 z-10">
                    {hasChildren ? (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(node.id);
                            }}
                            className="cursor-pointer"
                        >
                            {isExpanded ? (
                                <ChevronDown size={14} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={14} className="text-slate-400" />
                            )}
                        </span>
                    ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />
                    )}
                </span>

                {/* Icon */}
                <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#fef2f2' }}
                >
                    <Icon size={12} style={{ color: BRAND_RED }} />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700 truncate block">
                        {highlightMatch(node.name)}
                    </span>
                    {node.email && (
                        <span className="text-[10px] text-slate-400 truncate block">
                            {node.email}
                        </span>
                    )}
                </div>

                {/* Type badge */}
                <span
                    className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#fef2f2', color: BRAND_RED }}
                >
                    {node.groupTypeCode || node.type}
                </span>
            </button>

            {/* Render children when expanded */}
            {hasChildren && isExpanded && (
                <div className="relative">
                    <span
                        className="absolute border-l border-slate-300"
                        style={{
                            left: `${(depth + 1) * 20 - 4}px`,
                            top: 0,
                            bottom: 0,
                        }}
                    />
                    {node.children.map((child, idx) => (
                        <TreeNodeRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            expanded={expanded}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            searchQuery={searchQuery}
                            excludeIds={excludeIds}
                            isLast={idx === node.children.length - 1}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Individual User Tab Content ────────────────────────────────────────────

function IndividualUserList({
    searchQuery,
    excludeIds,
    onSelect,
}: {
    searchQuery: string;
    excludeIds: Set<string>;
    onSelect: (principal: Principal) => void;
}) {
    const [users, setUsers] = useState<Principal[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => fetchUsers(), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            let url = '/browse/ShadowUsers?$orderby=displayName';
            if (searchQuery) {
                const filter = `contains(displayName,'${searchQuery}') or contains(email,'${searchQuery}')`;
                url += `&$filter=${encodeURIComponent(filter)}`;
            }
            const response = await api.get(url);
            const raw = response.data.value;
            setUsers(
                raw
                    .filter((u: any) => !excludeIds.has(u.ID))
                    .map((u: any) => ({
                        id: u.ID,
                        type: 'USER',
                        displayName: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
                        email: u.email,
                    }))
            );
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_RED }} />
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="py-8 text-center text-sm text-slate-500">
                {searchQuery ? 'No matching users found' : 'No users available'}
            </div>
        );
    }

    return (
        <div className="py-1">
            {users.map((user) => (
                <button
                    key={user.id}
                    onClick={() => onSelect(user)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-red-50/50 transition-colors rounded-md"
                >
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#fef2f2' }}
                    >
                        <User size={14} style={{ color: BRAND_RED }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium text-slate-700 truncate">{user.displayName}</div>
                        {user.email && (
                            <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OrgHierarchySelect({
    onChange,
    placeholder = 'Add recipient(s)...',
    disabled = false,
    excludeIds = [],
    className,
}: OrgHierarchySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'user' | 'org'>('user');
    const [searchQuery, setSearchQuery] = useState('');
    const [tree, setTree] = useState<OrgTreeNode[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch org tree when dropdown opens on Org tab
    useEffect(() => {
        if (isOpen && activeTab === 'org' && tree.length === 0) {
            buildTree();
        }
    }, [isOpen, activeTab]);

    const buildTree = useCallback(async () => {
        setIsLoading(true);
        try {
            const hierarchies = await AdminService.getOrgHierarchies();
            const groups = await AdminService.getShadowGroups();

            const groupMap = new Map<string, any>();
            for (const g of groups) {
                groupMap.set(g.ID, g);
            }

            const childrenMap = new Map<string, OrgTreeNode[]>();
            const childIds = new Set<string>();

            for (const h of hierarchies) {
                const parentId = h.parentType === 'GROUP' ? h.parentGroup_ID : h.parentUser_ID;
                const childId = h.childType === 'GROUP' ? h.childGroup_ID : h.childUser_ID;

                if (!parentId || !childId) continue;
                if (parentId === childId) continue; // skip self-referencing
                childIds.add(childId);

                const childNode: OrgTreeNode = {
                    id: childId,
                    type: h.childType as 'GROUP' | 'USER',
                    name:
                        h.childType === 'GROUP'
                            ? h.childGroup?.name || groupMap.get(childId)?.name || 'Group'
                            : h.childUser?.displayName || h.childUser?.email || 'User',
                    email: h.childType === 'USER' ? h.childUser?.email : undefined,
                    groupTypeCode:
                        h.childType === 'GROUP'
                            ? h.childGroup?.type?.code || groupMap.get(childId)?.type?.code
                            : undefined,
                    children: [],
                };

                if (!childrenMap.has(parentId)) {
                    childrenMap.set(parentId, []);
                }
                childrenMap.get(parentId)!.push(childNode);
            }

            const attachChildren = (node: OrgTreeNode): OrgTreeNode => {
                const kids = childrenMap.get(node.id) || [];
                node.children = kids.map((k) => attachChildren(k));
                return node;
            };

            const rootIds = new Set<string>();
            for (const h of hierarchies) {
                const parentId = h.parentType === 'GROUP' ? h.parentGroup_ID : h.parentUser_ID;
                if (parentId && !childIds.has(parentId)) {
                    rootIds.add(parentId);
                }
            }

            const roots: OrgTreeNode[] = [];
            for (const rootId of rootIds) {
                const group = groupMap.get(rootId);
                const parentHierarchy = hierarchies.find(
                    (h: any) =>
                        (h.parentType === 'GROUP' && h.parentGroup_ID === rootId) ||
                        (h.parentType === 'USER' && h.parentUser_ID === rootId),
                );
                const isGroup = parentHierarchy?.parentType === 'GROUP';

                const rootNode: OrgTreeNode = {
                    id: rootId,
                    type: isGroup ? 'GROUP' : 'USER',
                    name: isGroup
                        ? group?.name || 'Group'
                        : parentHierarchy?.parentUser?.displayName || 'User',
                    email: !isGroup ? parentHierarchy?.parentUser?.email : undefined,
                    groupTypeCode: isGroup ? group?.type?.code : undefined,
                    children: [],
                };

                attachChildren(rootNode);
                roots.push(rootNode);
            }

            // Groups with no hierarchy records → flat roots
            const allHierarchyGroupIds = new Set<string>();
            for (const h of hierarchies) {
                if (h.parentGroup_ID) allHierarchyGroupIds.add(h.parentGroup_ID);
                if (h.childGroup_ID) allHierarchyGroupIds.add(h.childGroup_ID);
            }
            for (const g of groups) {
                if (!allHierarchyGroupIds.has(g.ID)) {
                    roots.push({
                        id: g.ID,
                        type: 'GROUP',
                        name: g.name,
                        groupTypeCode: g.type?.code,
                        children: [],
                    });
                }
            }

            setTree(roots);
            setExpanded(new Set(roots.map((r) => r.id)));
        } catch (err) {
            console.error('Failed to build org tree:', err);
            setTree([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleToggle = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelect = (node: OrgTreeNode) => {
        if (excludeSet.has(node.id)) return;
        onChange({
            id: node.id,
            type: node.groupTypeCode || node.type,
            displayName: node.name,
            email: node.email,
        });
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleUserSelect = (principal: Principal) => {
        onChange(principal);
        setIsOpen(false);
        setSearchQuery('');
    };

    // Filter tree by search query
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) return tree;
        const q = searchQuery.toLowerCase();
        const filterNode = (node: OrgTreeNode): OrgTreeNode | null => {
            const nameMatch = node.name.toLowerCase().includes(q);
            const emailMatch = node.email?.toLowerCase().includes(q);
            const filteredChildren = node.children.map(filterNode).filter(Boolean) as OrgTreeNode[];
            if (nameMatch || emailMatch || filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }
            return null;
        };
        return tree.map(filterNode).filter(Boolean) as OrgTreeNode[];
    }, [tree, searchQuery]);

    const effectiveExpanded = useMemo(() => {
        if (!searchQuery.trim()) return expanded;
        const allIds = new Set<string>();
        const collect = (nodes: OrgTreeNode[]) => {
            for (const n of nodes) {
                allIds.add(n.id);
                collect(n.children);
            }
        };
        collect(filteredTree);
        return allIds;
    }, [searchQuery, expanded, filteredTree]);

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Trigger */}
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen);
                        if (!isOpen) {
                            setTimeout(() => inputRef.current?.focus(), 100);
                        }
                    }
                }}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 h-auto justify-start',
                    isOpen && 'ring-1',
                )}
                style={isOpen ? { borderColor: BRAND_RED, '--tw-ring-color': BRAND_RED } as any : undefined}
            >
                <User className="w-5 h-5 text-slate-400" />
                <span className="flex-1 text-slate-500 text-left">{placeholder}</span>
                <ChevronDown
                    className={cn(
                        'w-4 h-4 text-slate-400 transition-transform',
                        isOpen && 'rotate-180',
                    )}
                />
            </Button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
                    >
                        {/* Tabs: Individual User | User Group */}
                        <div className="flex border-b border-slate-100">
                            <button
                                onClick={() => { setActiveTab('user'); setSearchQuery(''); }}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2',
                                    activeTab === 'user'
                                        ? 'text-slate-800 border-current'
                                        : 'text-slate-400 border-transparent hover:text-slate-600',
                                )}
                                style={activeTab === 'user' ? { color: BRAND_RED } : undefined}
                            >
                                <User size={14} />
                                Individual User
                            </button>
                            <button
                                onClick={() => { setActiveTab('org'); setSearchQuery(''); }}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2',
                                    activeTab === 'org'
                                        ? 'text-slate-800 border-current'
                                        : 'text-slate-400 border-transparent hover:text-slate-600',
                                )}
                                style={activeTab === 'org' ? { color: BRAND_RED } : undefined}
                            >
                                <FolderTree size={14} />
                                User Group
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={activeTab === 'user' ? 'Search users...' : 'Search groups...'}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="max-h-72 overflow-y-auto">
                            {activeTab === 'user' ? (
                                <IndividualUserList
                                    searchQuery={searchQuery}
                                    excludeIds={excludeSet}
                                    onSelect={handleUserSelect}
                                />
                            ) : (
                                /* Org hierarchy tree */
                                isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_RED }} />
                                    </div>
                                ) : filteredTree.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-slate-500">
                                        {searchQuery
                                            ? 'No matching organizations found'
                                            : 'No organization hierarchy defined yet'}
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {filteredTree.map((node, idx) => (
                                            <TreeNodeRow
                                                key={node.id}
                                                node={node}
                                                depth={0}
                                                expanded={effectiveExpanded}
                                                onToggle={handleToggle}
                                                onSelect={handleSelect}
                                                searchQuery={searchQuery}
                                                excludeIds={excludeSet}
                                                isLast={idx === filteredTree.length - 1}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
