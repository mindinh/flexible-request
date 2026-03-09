import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';

const BRAND_RED = '#b10e10';

export type MemberInfo = {
    userId: string;
    displayName: string;
    email?: string;
    memberId?: string;
};

export type HierarchyNodeData = {
    entityType: 'USER' | 'GROUP';
    entityId: string;
    label: string;
    subtitle?: string;
    description?: string;
    memberCount?: number;
    groupTypeCode?: string;
    members?: MemberInfo[];
    isNew?: boolean;
    collapsed?: boolean;
};

export type HierarchyEdgeData = {
    relationship: string;
    accessLevel: string;
    effectiveDate: string;
    offsets?: number[];
};

export type SavedOrg = {
    id: string;
    name: string;
};

interface HierarchyState {
    nodes: Node[];
    edges: Edge[];
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    isDirty: boolean;
    /** Monotonic counter bumped on every data change so subscribers can detect updates */
    revision: number;

    savedOrgs: SavedOrg[];
    currentOrgId: string | null;
    currentOrgName: string;

    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    addNode: (node: Node) => void;
    removeNode: (nodeId: string) => void;
    updateNodeData: (nodeId: string, data: Partial<HierarchyNodeData>) => void;
    toggleNodeCollapsed: (nodeId: string) => void;
    selectNode: (nodeId: string | null) => void;
    selectEdge: (edgeId: string | null) => void;
    updateEdgeData: (edgeId: string, data: Partial<HierarchyEdgeData>) => void;
    clearSelection: () => void;
    addChildNode: (parentNodeId: string, childNode: Node) => void;
    reset: () => void;

    setSavedOrgs: (orgs: SavedOrg[]) => void;
    removeSavedOrg: (orgName: string) => void;
    setCurrentOrg: (orgId: string | null, orgName: string) => void;
    setCurrentOrgName: (name: string) => void;
    setIsDirty: (dirty: boolean) => void;
}

export const useHierarchyStore = create<HierarchyState>((set) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    isDirty: false,
    revision: 0,

    savedOrgs: [],
    currentOrgId: null,
    currentOrgName: 'New Organization',

    setNodes: (nodes) => set((s) => ({ nodes, isDirty: true, revision: s.revision + 1 })),
    setEdges: (edges) => set((s) => ({ edges, isDirty: true, revision: s.revision + 1 })),

    addNode: (node) =>
        set((state) => ({
            nodes: [...state.nodes, node],
            isDirty: true,
            revision: state.revision + 1,
        })),

    removeNode: (nodeId) =>
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== nodeId),
            edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
            isDirty: true,
            revision: state.revision + 1,
        })),

    updateNodeData: (nodeId, data) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId
                    ? { ...n, data: { ...(n.data as HierarchyNodeData), ...data } }
                    : n
            ),
            isDirty: true,
            revision: state.revision + 1,
        })),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
    toggleNodeCollapsed: (nodeId) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId
                    ? {
                        ...n,
                        data: {
                            ...(n.data as HierarchyNodeData),
                            collapsed: !(n.data as HierarchyNodeData)?.collapsed,
                        },
                    }
                    : n
            ),
            isDirty: true,
            revision: state.revision + 1,
        })),
    selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),
    clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),

    updateEdgeData: (edgeId, data) =>
        set((state) => ({
            edges: state.edges.map((e) =>
                e.id === edgeId
                    ? { ...e, data: { ...(e.data as HierarchyEdgeData), ...data } }
                    : e
            ),
            isDirty: true,
            revision: state.revision + 1,
        })),

    addChildNode: (parentNodeId, childNode) =>
        set((state) => {
            const parentNode = state.nodes.find((n) => n.id === parentNodeId);
            if (!parentNode) return state;

            const newEdge: Edge = {
                id: `e-${parentNodeId}-${childNode.id}`,
                source: parentNodeId,
                target: childNode.id,
                type: 'editableHierarchyEdge',
                animated: false,
                style: { stroke: BRAND_RED, strokeWidth: 2 },
                data: {
                    relationship: 'Direct Report',
                    accessLevel: 'View Only',
                    effectiveDate: '',
                    offsets: [0, 0, 0],
                } satisfies HierarchyEdgeData,
            };

            return {
                nodes: state.nodes.map((n) =>
                    n.id === parentNodeId
                        ? { ...n, data: { ...(n.data as HierarchyNodeData), collapsed: false } }
                        : n
                ).concat(childNode),
                edges: [...state.edges, newEdge],
                selectedNodeId: childNode.id,
                selectedEdgeId: null,
                isDirty: true,
                revision: state.revision + 1,
            };
        }),

    reset: () => set({
        nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null,
        isDirty: false, revision: 0, currentOrgId: null, currentOrgName: 'New Organization',
    }),

    setSavedOrgs: (orgs) => set({ savedOrgs: orgs }),
    removeSavedOrg: (orgName) => set((state) => ({
        savedOrgs: state.savedOrgs.filter((o) => o.name !== orgName),
    })),
    setCurrentOrg: (orgId, orgName) => set({ currentOrgId: orgId, currentOrgName: orgName }),
    setCurrentOrgName: (name) => set({ currentOrgName: name, isDirty: true }),
    setIsDirty: (dirty) => set({ isDirty: dirty }),
}));
