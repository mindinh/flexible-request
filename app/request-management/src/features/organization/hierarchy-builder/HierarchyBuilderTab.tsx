import { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight, Save, Plus, FolderOpen, RefreshCw, ChevronUp, Trash2 } from 'lucide-react';
import { HierarchyCanvas } from './HierarchyCanvas';
import { HierarchyPalette } from './HierarchyPalette';
import { HierarchyProperties } from './HierarchyProperties';
import { useHierarchyStore, type HierarchyNodeData, type HierarchyEdgeData, type SavedOrg } from './useHierarchyStore';
import { AdminService } from '../../../services/AdminService';

const BRAND_RED = '#b10e10';

/**
 * HierarchyBuilderTab — Full hierarchy builder UI matching the Workflow Studio layout.
 *
 * Layout (from reference image):
 * ┌─ Top bar: Org name | UNSAVED badge |  Refresh | Save Changes ─┐
 * ├─ Left panel ─────────┬─ Canvas ─────────┬─ Right Properties ──┤
 * │ ORGANIZATIONS (n)    │                   │                     │
 * │   • BTP Cloud        │                   │                     │
 * │   • Marketing Org    │                   │                     │
 * │   + New Org          │                   │                     │
 * │                      │                   │                     │
 * │ PALETTE              │                   │                     │
 * │   [Group card]       │                   │                     │
 * └──────────────────────┴───────────────────┴─────────────────────┘
 */
export function HierarchyBuilderTab() {
    const [paletteCollapsed, setPaletteCollapsed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [orgSectionOpen, setOrgSectionOpen] = useState(true);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const store = useHierarchyStore();

    // Load saved orgs on mount
    useEffect(() => { loadSavedOrgs(); }, []);

    const loadSavedOrgs = async () => {
        try {
            const response = await AdminService.getOrgHierarchies();
            const orgMap = new Map<string, SavedOrg>();
            for (const h of response) {
                const orgName = h.relationship || 'Default';
                if (!orgMap.has(orgName)) {
                    orgMap.set(orgName, { id: orgName, name: orgName });
                }
            }
            store.setSavedOrgs(Array.from(orgMap.values()));
        } catch (err) {
            console.error('Failed to load orgs:', err);
        }
    };

    // ── Save the current hierarchy ──
    const handleSave = useCallback(async () => {
        const { nodes, edges, currentOrgName } = useHierarchyStore.getState();

        if (nodes.length === 0) {
            showSaveMsg('Nothing to save', true);
            return;
        }
        if (!currentOrgName.trim()) {
            showSaveMsg('Please enter an organization name', true);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            // Step 1: Get support types once
            const supportTypes = await AdminService.getSupportTypes();

            // Step 2: Upsert ShadowGroups & sync members
            const groupNodeMap = new Map<string, string>(); // canvas node id → backend group ID

            for (const node of nodes) {
                const data = node.data as HierarchyNodeData;
                if (data.entityType !== 'GROUP') continue;

                let groupId = data.entityId;
                if (!groupId || data.isNew) {
                    const groupType = supportTypes.find((t: any) => t.code === (data.groupTypeCode || 'GROUP'));
                    if (!groupType) {
                        showSaveMsg(`Support type "${data.groupTypeCode}" not found. Create it first.`, true);
                        setIsSaving(false);
                        return;
                    }
                    const created = await AdminService.createShadowGroup({
                        name: data.label || 'Unnamed Group',
                        description: data.description,
                        type_ID: groupType.ID,
                    });
                    groupId = created.ID;
                    store.updateNodeData(node.id, { entityId: groupId, isNew: false });
                } else {
                    await AdminService.updateShadowGroup(groupId, {
                        name: data.label,
                        description: data.description,
                    });
                }
                groupNodeMap.set(node.id, groupId);

                // Sync members
                const desiredMembers = data.members || [];
                const existing = await AdminService.getGroupMembers(groupId);
                const existingUserIds = new Set(existing.map((m: any) => m.user_ID));
                const desiredUserIds = new Set(desiredMembers.map((m) => m.userId));

                for (const member of desiredMembers) {
                    if (!existingUserIds.has(member.userId)) {
                        await AdminService.addGroupMember(groupId, member.userId);
                    }
                }
                for (const m of existing) {
                    if (!desiredUserIds.has(m.user_ID)) {
                        await AdminService.removeGroupMember(m.ID);
                    }
                }
            }

            // Step 3: Delete existing OrgHierarchies for this org
            const existingHierarchies = await AdminService.getOrgHierarchies(currentOrgName);
            for (const h of existingHierarchies) {
                await AdminService.deleteOrgHierarchy(h.ID);
            }

            // Step 4: Create OrgHierarchy records from edges, including node positions
            // Build a map of nodeId → position for all nodes involved in edges
            const nodePositionMap = new Map<string, { x: number; y: number }>();
            for (const node of nodes) {
                nodePositionMap.set(node.id, node.position);
            }

            for (const edge of edges) {
                const sourceNode = nodes.find((n) => n.id === edge.source);
                const targetNode = nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) continue;

                const sourceData = sourceNode.data as HierarchyNodeData;
                const targetData = targetNode.data as HierarchyNodeData;
                const edgeData = (edge.data || {}) as HierarchyEdgeData;

                const record: any = {
                    parentType: sourceData.entityType,
                    childType: targetData.entityType,
                    relationship: currentOrgName,
                    accessLevel: edgeData.accessLevel || 'View Only',
                    effectiveDate: edgeData.effectiveDate || null,
                    posX: Math.round(sourceNode.position.x),
                    posY: Math.round(sourceNode.position.y),
                };

                if (sourceData.entityType === 'GROUP') {
                    record.parentGroup_ID = groupNodeMap.get(sourceNode.id) || sourceData.entityId;
                } else {
                    record.parentUser_ID = sourceData.entityId;
                }
                if (targetData.entityType === 'GROUP') {
                    record.childGroup_ID = groupNodeMap.get(targetNode.id) || targetData.entityId;
                } else {
                    record.childUser_ID = targetData.entityId;
                }

                await AdminService.createOrgHierarchy(record);
            }

            // Step 5: Also save isolated nodes (nodes with no edges) as self-referencing records
            // so their positions are preserved
            const nodesInEdges = new Set<string>();
            for (const edge of edges) {
                nodesInEdges.add(edge.source);
                nodesInEdges.add(edge.target);
            }

            for (const node of nodes) {
                if (nodesInEdges.has(node.id)) continue;
                // Isolated node — save it as a single hierarchy record with itself as both parent and child
                const data = node.data as HierarchyNodeData;
                const record: any = {
                    parentType: data.entityType,
                    childType: data.entityType,
                    relationship: currentOrgName,
                    accessLevel: 'View Only',
                    posX: Math.round(node.position.x),
                    posY: Math.round(node.position.y),
                };
                if (data.entityType === 'GROUP') {
                    const gid = groupNodeMap.get(node.id) || data.entityId;
                    record.parentGroup_ID = gid;
                    record.childGroup_ID = gid;
                } else {
                    record.parentUser_ID = data.entityId;
                    record.childUser_ID = data.entityId;
                }
                await AdminService.createOrgHierarchy(record);
            }

            store.setIsDirty(false);
            showSaveMsg('Saved successfully!', false);
            await loadSavedOrgs();
        } catch (err: any) {
            console.error('Failed to save hierarchy:', err);
            showSaveMsg(`Error: ${err.message || 'Save failed'}`, true);
        } finally {
            setIsSaving(false);
        }
    }, [store]);

    function showSaveMsg(msg: string, isError: boolean) {
        setSaveMessage(msg);
        setTimeout(() => setSaveMessage(null), isError ? 5000 : 3000);
    }

    // ── Load an existing org ──
    const handleLoadOrg = async (orgName: string) => {
        try {
            store.reset();
            store.setCurrentOrg(orgName, orgName);

            const hierarchies = await AdminService.getOrgHierarchies(orgName);
            if (hierarchies.length === 0) return;

            const nodeMap = new Map<string, any>();
            const edgesToCreate: any[] = [];

            // Track positions per node key from saved data
            const positionMap = new Map<string, { x: number; y: number }>();

            for (const h of hierarchies) {
                const pk = h.parentType === 'GROUP' ? `GROUP-${h.parentGroup_ID}` : `USER-${h.parentUser_ID}`;
                const ck = h.childType === 'GROUP' ? `GROUP-${h.childGroup_ID}` : `USER-${h.childUser_ID}`;

                if (!nodeMap.has(pk)) {
                    nodeMap.set(pk, { entityType: h.parentType, entityId: h.parentType === 'GROUP' ? h.parentGroup_ID : h.parentUser_ID });
                }
                if (!nodeMap.has(ck)) {
                    nodeMap.set(ck, { entityType: h.childType, entityId: h.childType === 'GROUP' ? h.childGroup_ID : h.childUser_ID });
                }

                // Save position from the record (associated with the parent/source node)
                if (h.posX != null && h.posY != null) {
                    positionMap.set(pk, { x: h.posX, y: h.posY });
                }

                // Skip self-referencing records (isolated nodes saved for position only)
                if (pk !== ck) {
                    edgesToCreate.push({ parentKey: pk, childKey: ck, relationship: h.relationship, accessLevel: h.accessLevel, effectiveDate: h.effectiveDate });
                }
            }

            const [groups, users] = await Promise.all([AdminService.getShadowGroups(), AdminService.getShadowUsers()]);
            const groupById = new Map(groups.map((g: any) => [g.ID, g]));
            const userById = new Map(users.map((u: any) => [u.ID, u]));

            const nodeIdMap = new Map<string, string>();
            const newNodes: any[] = [];
            let autoX = 0, autoY = 0;

            for (const [key, info] of nodeMap) {
                const nid = crypto.randomUUID();
                nodeIdMap.set(key, nid);

                // Use saved position or auto-layout fallback
                const savedPos = positionMap.get(key);
                const position = savedPos || { x: autoX, y: autoY };
                if (!savedPos) {
                    autoX += 250;
                    if (autoX > 500) { autoX = 0; autoY += 120; }
                }

                if (info.entityType === 'GROUP') {
                    const group = groupById.get(info.entityId);
                    const members = group ? await AdminService.getGroupMembers(info.entityId) : [];
                    newNodes.push({
                        id: nid, type: 'groupNode', position,
                        data: {
                            entityType: 'GROUP', entityId: info.entityId,
                            label: group?.name || 'Group', description: group?.description || '',
                            groupTypeCode: group?.type?.code || 'GROUP',
                            members: members.map((m: any) => ({ userId: m.user_ID, displayName: m.user?.displayName || m.user?.email || m.user_ID, email: m.user?.email, memberId: m.ID })),
                            memberCount: members.length, isNew: false,
                        } as HierarchyNodeData,
                    });
                } else {
                    const user = userById.get(info.entityId);
                    newNodes.push({
                        id: nid, type: 'userNode', position,
                        data: { entityType: 'USER', entityId: info.entityId, label: user?.displayName || user?.email || 'User', subtitle: user?.email, isNew: false } as HierarchyNodeData,
                    });
                }
            }

            const newEdges = edgesToCreate.map((e, i) => ({
                id: `e-loaded-${i}`, source: nodeIdMap.get(e.parentKey)!, target: nodeIdMap.get(e.childKey)!,
                type: 'smoothstep', animated: false, style: { stroke: BRAND_RED, strokeWidth: 2 },
                data: { relationship: e.relationship || 'Direct Report', accessLevel: e.accessLevel || 'View Only', effectiveDate: e.effectiveDate || '' } as HierarchyEdgeData,
            }));

            store.setNodes(newNodes);
            store.setEdges(newEdges);
            store.setIsDirty(false);
        } catch (err) {
            console.error('Failed to load org:', err);
        }
    };

    // ── Create a new skeleton org ──
    const handleNewOrg = () => {
        // Generate a unique name based on existing orgs
        const existingNames = new Set(store.savedOrgs.map((o) => o.name));
        let counter = 1;
        let newName = `Org ${counter}`;
        while (existingNames.has(newName)) {
            counter++;
            newName = `Org ${counter}`;
        }

        store.reset();
        store.setCurrentOrgName(newName);
        store.setIsDirty(true);

        // Focus the name input after a tick so the user can immediately rename
        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
                nameInputRef.current.select();
            }
        }, 50);
    };

    // ── Delete a saved org ──
    const handleDeleteOrg = async (orgName: string) => {
        if (!confirm(`Delete "${orgName}" and all its hierarchy data? This cannot be undone.`)) return;

        try {
            // Delete all hierarchy records for this org from backend
            const hierarchies = await AdminService.getOrgHierarchies(orgName);
            for (const h of hierarchies) {
                await AdminService.deleteOrgHierarchy(h.ID);
            }

            // Remove from local state
            store.removeSavedOrg(orgName);

            // If the deleted org was currently loaded, reset
            if (store.currentOrgName === orgName) {
                store.reset();
            }

            showSaveMsg('Organization deleted', false);
        } catch (err: any) {
            console.error('Failed to delete org:', err);
            showSaveMsg(`Error: ${err.message || 'Delete failed'}`, true);
        }
    };

    return (
        <ReactFlowProvider>
            <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 240px)' }}>
                {/* ═══ Top Bar ═══ */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={store.currentOrgName}
                            onChange={(e) => store.setCurrentOrgName(e.target.value)}
                            placeholder="Organization name"
                            className="text-[16px] font-bold text-slate-800 bg-transparent border-none outline-none focus:ring-0 w-[200px] placeholder:text-slate-300 placeholder:font-normal"
                        />

                        {store.isDirty && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: BRAND_RED }}>
                                Unsaved
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {saveMessage && (
                            <span className={`text-[11px] font-medium ${saveMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
                                {saveMessage}
                            </span>
                        )}
                        <button onClick={() => loadSavedOrgs()}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition" title="Refresh orgs">
                            <RefreshCw size={16} />
                        </button>
                        <button onClick={handleSave} disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-lg text-white transition shadow-sm disabled:opacity-50"
                            style={{ backgroundColor: BRAND_RED }}>
                            <Save size={14} />
                            {isSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* ═══ Three Column Layout ═══ */}
                <div className="flex gap-0 flex-1 overflow-hidden">
                    {/* ── Left Panel ── */}
                    <div className="flex flex-col border-r border-slate-200 bg-white transition-all duration-300 flex-shrink-0"
                        style={{ width: paletteCollapsed ? '56px' : '160px' }}>

                        {/* Collapse toggle */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                            {!paletteCollapsed && <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider" />}
                            <button onClick={() => setPaletteCollapsed(!paletteCollapsed)}
                                className="p-1 rounded hover:bg-slate-200 transition text-slate-400 ml-auto">
                                {paletteCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 py-2">
                            {/* Organizations Section */}
                            {!paletteCollapsed && (
                                <div className="mb-4">
                                    <button onClick={() => setOrgSectionOpen(!orgSectionOpen)}
                                        className="flex items-center justify-between w-full text-left px-1 mb-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                            Organizations ({store.savedOrgs.length})
                                        </span>
                                        <ChevronUp size={12} className={`text-slate-400 transition-transform ${orgSectionOpen ? '' : 'rotate-180'}`} />
                                    </button>

                                    {orgSectionOpen && (
                                        <div className="flex flex-col gap-0.5 mb-2">
                                            {store.savedOrgs.map((org) => (
                                                <div key={org.id}
                                                    className={`flex items-center gap-1 w-full rounded-lg text-[12px] transition group ${store.currentOrgName === org.name
                                                        ? 'font-medium'
                                                        : 'text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    style={store.currentOrgName === org.name ? { backgroundColor: '#fef2f2', color: BRAND_RED } : undefined}
                                                >
                                                    <button
                                                        onClick={() => handleLoadOrg(org.name)}
                                                        className="flex items-center gap-2 flex-1 text-left px-2 py-1.5 min-w-0"
                                                    >
                                                        <FolderOpen size={12} className="flex-shrink-0" style={{ color: store.currentOrgName === org.name ? BRAND_RED : '#94a3b8' }} />
                                                        <span className="truncate">{org.name}</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteOrg(org.name); }}
                                                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 flex-shrink-0 mr-1"
                                                        title={`Delete ${org.name}`}
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={handleNewOrg}
                                                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-[12px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
                                                <Plus size={12} />
                                                <span>New Org</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Palette Section */}
                            {!paletteCollapsed && (
                                <div className="flex items-center justify-between px-1 mb-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Palette</span>
                                </div>
                            )}
                            <HierarchyPalette isCollapsed={paletteCollapsed} />
                        </div>
                    </div>

                    {/* ── Center Canvas ── */}
                    <div className="flex-1 min-w-0">
                        <HierarchyCanvas />
                    </div>

                    {/* ── Right Properties ── */}
                    <div className="flex flex-col border-l border-slate-200 bg-white flex-shrink-0"
                        style={{ width: '280px' }}>
                        <HierarchyProperties />
                    </div>
                </div>
            </div>
        </ReactFlowProvider>
    );
}
