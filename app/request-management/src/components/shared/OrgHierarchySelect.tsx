import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronRight, Users, User, Building2, Briefcase, Network, Loader2, FolderTree } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AdminService } from '../../services/AdminService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Principal } from './PrincipalSelect';

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
}: {
    node: OrgTreeNode;
    depth: number;
    expanded: Set<string>;
    onToggle: (id: string) => void;
    onSelect: (node: OrgTreeNode) => void;
    searchQuery: string;
    excludeIds: Set<string>;
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
                    'w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors rounded-md group',
                    isExcluded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-50 cursor-pointer',
                )}
                style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
                {/* Expand/collapse chevron */}
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
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
                        <span className="w-3 h-px bg-slate-200 block" />
                    )}
                </span>

                {/* Icon */}
                <div
                    className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                        node.type === 'USER' ? 'bg-blue-100' : 'bg-violet-100',
                    )}
                >
                    <Icon
                        size={12}
                        className={node.type === 'USER' ? 'text-blue-600' : 'text-violet-600'}
                    />
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
                    className={cn(
                        'text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0',
                        node.type === 'USER'
                            ? 'bg-blue-50 text-blue-500'
                            : 'bg-violet-50 text-violet-500',
                    )}
                >
                    {node.groupTypeCode || node.type}
                </span>
            </button>

            {/* Render children when expanded */}
            {hasChildren && isExpanded && (
                <div>
                    {node.children.map((child) => (
                        <TreeNodeRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            expanded={expanded}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            searchQuery={searchQuery}
                            excludeIds={excludeIds}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OrgHierarchySelect({
    onChange,
    placeholder = 'Select from organization...',
    disabled = false,
    excludeIds = [],
    className,
}: OrgHierarchySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
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

    // Fetch and build tree when dropdown opens
    useEffect(() => {
        if (isOpen) {
            buildTree();
        }
    }, [isOpen]);

    const buildTree = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch all hierarchy records with expanded associations
            const hierarchies = await AdminService.getOrgHierarchies();
            const groups = await AdminService.getShadowGroups();

            // Index groups by ID
            const groupMap = new Map<string, any>();
            for (const g of groups) {
                groupMap.set(g.ID, g);
            }

            // Build adjacency: parent → children
            // Track which IDs appear as children (so we can find roots)
            const childrenMap = new Map<string, OrgTreeNode[]>();
            const childIds = new Set<string>();

            for (const h of hierarchies) {
                const parentId = h.parentType === 'GROUP' ? h.parentGroup_ID : h.parentUser_ID;
                const childId = h.childType === 'GROUP' ? h.childGroup_ID : h.childUser_ID;

                if (!parentId || !childId) continue;
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
                    children: [], // filled later
                };

                if (!childrenMap.has(parentId)) {
                    childrenMap.set(parentId, []);
                }
                childrenMap.get(parentId)!.push(childNode);
            }

            // Recursively attach children
            const attachChildren = (node: OrgTreeNode): OrgTreeNode => {
                const kids = childrenMap.get(node.id) || [];
                node.children = kids.map((k) => attachChildren(k));
                return node;
            };

            // Root nodes = groups that appear as parents but NOT as children
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
                // Also check if it could be a user root
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

            // If there are groups with NO hierarchy records, show them as flat roots too
            // so the user can still pick them
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

            // Auto-expand root nodes
            setExpanded(new Set(roots.map((r) => r.id)));
        } catch (err) {
            console.error('Failed to build org tree:', err);
            setTree([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Toggle expand/collapse
    const handleToggle = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Select a node
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

    // Filter the tree by search query (shows matching nodes + their ancestors)
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) return tree;

        const q = searchQuery.toLowerCase();

        const filterNode = (node: OrgTreeNode): OrgTreeNode | null => {
            const nameMatch = node.name.toLowerCase().includes(q);
            const emailMatch = node.email?.toLowerCase().includes(q);

            const filteredChildren = node.children
                .map(filterNode)
                .filter(Boolean) as OrgTreeNode[];

            if (nameMatch || emailMatch || filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }
            return null;
        };

        return tree.map(filterNode).filter(Boolean) as OrgTreeNode[];
    }, [tree, searchQuery]);

    // When searching, auto-expand everything
    const effectiveExpanded = useMemo(() => {
        if (!searchQuery.trim()) return expanded;
        // Collect all node IDs in filtered tree
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
                    isOpen && 'border-violet-500 ring-1 ring-violet-500',
                )}
            >
                <FolderTree className="w-5 h-5 text-slate-400" />
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
                        {/* Search */}
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search organizations..."
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Tree */}
                        <div className="max-h-72 overflow-y-auto py-1">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                                </div>
                            ) : filteredTree.length === 0 ? (
                                <div className="py-8 text-center text-sm text-slate-500">
                                    {searchQuery
                                        ? 'No matching organizations found'
                                        : 'No organization hierarchy defined yet'}
                                </div>
                            ) : (
                                filteredTree.map((node) => (
                                    <TreeNodeRow
                                        key={node.id}
                                        node={node}
                                        depth={0}
                                        expanded={effectiveExpanded}
                                        onToggle={handleToggle}
                                        onSelect={handleSelect}
                                        searchQuery={searchQuery}
                                        excludeIds={excludeSet}
                                    />
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
