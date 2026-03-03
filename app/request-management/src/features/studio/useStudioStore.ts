import { create } from 'zustand';
import type {
    UiRule,
    UiCanvasItem,
    UiWorkflowNode,
    UiWorkflowEdge,
    UiRequestTypeDetails,
    UiStatusNode,
    UiStatusEdge
} from './types';
import { StudioAdapter } from './StudioAdapter';
import { AdminService } from '../../services/AdminService';

interface StudioState {
    // Data
    requestTypeId: string | null;
    metadata: UiRequestTypeDetails | null;
    workflow: { nodes: UiWorkflowNode[], edges: UiWorkflowEdge[] };
    originalNodes: UiWorkflowNode[]; // Track original nodes for diffing
    originalEdges: UiWorkflowEdge[]; // Track edges from backend for diffing
    originalRules: UiRule[]; // Track original rules for diffing
    schemas: Record<string, UiCanvasItem[]>; // Schema per step (stepId -> items)
    schema: UiCanvasItem[]; // Current active step's schema (derived from schemas[activeStepId])
    rules: UiRule[];
    statusNetwork: { nodes: UiStatusNode[], edges: UiStatusEdge[] };

    // UI State
    activeTab: string;
    isLoading: boolean;
    isSaving: boolean;
    isDirty: boolean;
    error: string | null;
    activeStepId: string | null;
    selectedSchemaFieldId: string | null;
    selectedRuleId: string | null;
    isDryRunOpen: boolean;

    // Draft Conflict State
    draftConflict: boolean;               // True when a 409 conflict was detected
    draftConflictMessage: string | null;   // The conflict message to display

    // Actions
    setActiveTab: (tab: string) => void;
    setDirty: (dirty: boolean) => void;

    loadRequestType: (id: string) => Promise<void>;
    saveChanges: () => Promise<void>;
    deleteRequestType: () => Promise<void>;
    deleteStep: (stepId: string) => void;
    resolveDraftConflict: () => Promise<void>; // Discard other user's draft and retry
    discardChanges: () => Promise<void>; // Discard current draft and reset store

    // Updaters (Set Dirty automatically)
    updateMetadata: (data: Partial<UiRequestTypeDetails>) => void;
    updateWorkflow: (nodes: UiWorkflowNode[], edges: UiWorkflowEdge[]) => void;
    updateSchema: (items: UiCanvasItem[]) => void;
    addSchemaItem: (type: string, label: string) => void;
    updateRules: (rules: UiRule[]) => void;
    updateStatusNetwork: (nodes: UiStatusNode[], edges: UiStatusEdge[]) => void;
    setActiveStepId: (id: string | null) => void;
    setSelectedSchemaFieldId: (id: string | null) => void;
    setSelectedRuleId: (id: string | null) => void;
    setIsDryRunOpen: (open: boolean) => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
    // Initial State
    requestTypeId: null,
    metadata: null,
    workflow: { nodes: [], edges: [] },
    originalNodes: [],
    originalEdges: [],
    originalRules: [],
    schemas: {}, // Schema per step
    schema: [], // Active step's schema
    rules: [],
    statusNetwork: { nodes: [], edges: [] },

    activeTab: 'workflow',
    isLoading: false,
    isSaving: false,
    isDirty: false,
    error: null,
    activeStepId: null,
    selectedSchemaFieldId: null,
    selectedRuleId: null,
    isDryRunOpen: false,

    // Draft Conflict
    draftConflict: false,
    draftConflictMessage: null,

    setActiveTab: (tab) => set({ activeTab: tab }),
    setDirty: (dirty) => set({ isDirty: dirty }),
    setActiveStepId: (id) => {
        const schemas = get().schemas;
        const schema = id ? (schemas[id] || []) : [];
        // Clear selected rule when changing steps (rules are step-specific)
        set({ activeStepId: id, schema, selectedSchemaFieldId: null, selectedRuleId: null });
    },
    setSelectedSchemaFieldId: (id) => set({ selectedSchemaFieldId: id }),
    setSelectedRuleId: (id) => set({ selectedRuleId: id, isDryRunOpen: id ? false : get().isDryRunOpen }),
    setIsDryRunOpen: (open) => set({ isDryRunOpen: open, selectedRuleId: open ? null : get().selectedRuleId }),

    loadRequestType: async (id: string) => {
        // Guard: Skip if already loading the same request type
        if (get().isLoading && get().requestTypeId === id) {
            console.log("Already loading this Request Type, skipping duplicate call.");
            return;
        }

        set({ isLoading: true, error: null, draftConflict: false, draftConflictMessage: null, requestTypeId: id });
        try {
            console.log("Loading Request Type...", id);
            let fullDraft;

            // 1. Try to fetch existing draft first (Active=false)
            try {
                fullDraft = await AdminService.getRequestTypeById(id, true);
                console.log("Draft found, using existing draft.");
            } catch (e: unknown) {
                // If 404, it means no draft exists. Try to create one from active.
                const error = e as { response?: { status?: number; data?: unknown } };
                if (error.response && error.response.status === 404) {
                    console.log("No draft found (404), attempting to edit active entity...");
                    try {
                        const editResult = await AdminService.editRequestType(id);
                        console.log("Edit successful, draft created:", editResult);
                        fullDraft = await AdminService.getRequestTypeById(id, true);
                        console.log("Fetched newly created draft.");
                    } catch (editError: unknown) {
                        const editErr = editError as { response?: { status?: number; data?: unknown }; message?: string };
                        console.error("Edit failed:", editErr.response?.status, editErr.response?.data);
                        // If edit also fails with 404, the active entity doesn't exist
                        if (editErr.response?.status === 404) {
                            throw new Error("Request Type not found. It may have been deleted.");
                        }
                        // 409 = Draft conflict - another user has a draft lock
                        if (editErr.response?.status === 409) {
                            set({
                                isLoading: false,
                                draftConflict: true,
                                draftConflictMessage: 'Another user is currently editing this Request Type. Do you want to discard their unsaved changes and take over?'
                            });
                            return;
                        }
                        throw new Error(`Could not create draft: ${editErr.message || 'Unknown error'}`);
                    }
                } else {
                    const errMsg = e instanceof Error ? e.message : 'Unknown error';
                    console.error("Unexpected error fetching draft:", error.response?.status, errMsg);
                    throw e;
                }
            }

            // 2. Adapt to UI
            const metadata = StudioAdapter.toUiMetadata(fullDraft);

            // Map Rules (Aggregate from all steps)
            const rules = fullDraft.steps?.flatMap(step =>
                StudioAdapter.toUiRules(step.approverRules, step.ID)
            ) || [];

            const workflow = StudioAdapter.toUiWorkflow(fullDraft.steps);

            // Build schemas map for all steps
            const schemas: Record<string, UiCanvasItem[]> = {};
            fullDraft.steps?.forEach(step => {
                schemas[step.ID] = step.schemaContent
                    ? StudioAdapter.toUiSchemaFromContent(step.schemaContent)
                    : [];
            });

            // Set active step to the start step
            const startStep = fullDraft.steps?.find(s => s.isStartStep) || fullDraft.steps?.[0];
            const activeStepId = startStep?.ID || null;
            const schema = activeStepId ? (schemas[activeStepId] || []) : [];

            // Status Network
            const statusNetwork = StudioAdapter.toUiStatusNetwork(fullDraft.statusNetwork);

            set({
                metadata,
                rules,
                originalRules: rules, // Store original rules for diffing
                workflow,
                originalNodes: workflow.nodes, // Store original nodes for diffing
                originalEdges: workflow.edges, // Store original edges for diffing
                schemas,
                schema,
                activeStepId,
                statusNetwork,
                isDirty: false,
                isLoading: false
            });
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to load request type';
            console.error("Failed to load request type", err);
            set({
                isLoading: false,
                error: errMsg
            });
        }
    },

    saveChanges: async () => {
        const { requestTypeId, metadata, rules, workflow, schemas, statusNetwork, isDirty } = get();
        console.log("saveChanges called. Dirty:", isDirty, "ID:", requestTypeId);

        if (!requestTypeId || !metadata || !isDirty) {
            console.warn("Save aborted: Missing ID/Metadata or Not Dirty");
            return;
        }

        set({ isSaving: true, error: null });
        try {
            // 0. Validate schemas – reject empty option labels in select-type fields
            const SELECT_TYPES = ['select', 'radio', 'checkbox', 'dropdown'];
            for (const [_stepId, schemaItems] of Object.entries(schemas)) {
                const checkFields = (fields: UiCanvasItem[]) => {
                    for (const item of fields) {
                        // Check sections
                        if (item.type === 'section' && 'fields' in item) {
                            checkFields(item.fields as unknown as UiCanvasItem[]);
                            continue;
                        }
                        // Check tables
                        if (item.type === 'table' && 'columns' in item) {
                            checkFields((item as any).columns as UiCanvasItem[]);
                            continue;
                        }
                        // Check select-type fields for empty options
                        if (SELECT_TYPES.includes(item.type)) {
                            const field = item as any;
                            const items = field.valueHelp?.items as Array<{ key: string; label: string }> | undefined;
                            if (items && items.length > 0) {
                                const emptyOpts = items.filter((opt: any) => !opt.label?.trim());
                                if (emptyOpts.length > 0) {
                                    throw new Error(
                                        `Field "${field.label}" has ${emptyOpts.length} option(s) with empty labels. Please fill in or remove them before saving.`
                                    );
                                }
                            }
                        }
                    }
                };
                checkFields(schemaItems);
            }

            // 1. Update Request Type metadata
            const metadataPayload = {
                title: metadata.name,
                description: metadata.description,
                isEnabled: metadata.isEnabled,
                icon: metadata.icon
            };

            console.log("Saving metadata...", metadataPayload);
            await AdminService.updateRequestType(requestTypeId, metadataPayload);

            // 2. Create/Update Steps - diff against original nodes
            const { originalNodes } = get();
            const originalNodeIds = new Set(originalNodes.map(n => n.id));

            console.log("Processing steps...", workflow.nodes.length);
            for (const node of workflow.nodes) {
                const stepData = {
                    ID: node.id,
                    stepName: node.data.label,
                    isStartStep: node.data.isStart,
                    slaDays: node.data.sla,
                    syncTrigger: node.data.syncTrigger || 'NONE',
                    // Default owner fields
                    ownerType: node.data.ownerType || null,
                    ownerId: node.data.owner_ID || null,
                };

                if (originalNodeIds.has(node.id)) {
                    // Existing step - use PATCH to update
                    console.log("Updating existing step:", node.id);
                    await AdminService.updateStep(node.id, stepData);
                } else {
                    // New step - use POST to create
                    console.log("Creating new step:", node.id);
                    await AdminService.createStep(requestTypeId, stepData);
                }
            }

            // 2.1 Find steps to DELETE (in originalNodes but not in current nodes)
            const currentNodeIds = new Set(workflow.nodes.map(n => n.id));
            const nodesToDelete = originalNodes.filter(n => !currentNodeIds.has(n.id));

            console.log("Deleting steps...", nodesToDelete.length);
            for (const node of nodesToDelete) {
                console.log("Deleting step:", node.id);
                try {
                    await AdminService.deleteStep(node.id);
                } catch (e) {
                    // Try/catch individually so one failure doesn't stop others
                    console.warn("Failed to delete step:", node.id, e);
                }
            }

            // 2.5. Manage Step Dependencies (edges/predecessors)
            // Compare current edges with original to determine adds/deletes
            const { originalEdges } = get();

            // Helper to create edge key for comparison
            const edgeKey = (source: string, target: string) => `${source}|${target}`;

            // Build sets for comparison
            const currentEdgeKeys = new Set(workflow.edges.map(e => edgeKey(e.source, e.target)));
            const originalEdgeKeys = new Set(originalEdges.map(e => edgeKey(e.source, e.target)));

            // Find edges to DELETE (in original but not in current)
            const edgesToDelete = originalEdges.filter(e => !currentEdgeKeys.has(edgeKey(e.source, e.target)));
            console.log("Deleting dependencies...", edgesToDelete.length);
            for (const edge of edgesToDelete) {
                if (edge.id) {
                    await AdminService.deleteStepDependency(edge.id);
                }
            }

            // Find edges to CREATE (in current but not in original)
            const edgesToCreate = workflow.edges.filter(e => !originalEdgeKeys.has(edgeKey(e.source, e.target)));
            console.log("Creating dependencies...", edgesToCreate.length);
            for (const edge of edgesToCreate) {
                // edge.source is the predecessor (dependsOn)
                // edge.target is the step that depends on source
                await AdminService.createStepDependency(edge.target, edge.source);
            }

            // 3. Save Schema Content for all steps
            console.log("Saving schemas for all steps...");
            for (const [stepId, schemaItems] of Object.entries(schemas)) {
                const schemaContent = schemaItems.length > 0
                    ? JSON.stringify(StudioAdapter.fromUiSchema(schemaItems))
                    : null;
                console.log(`  Step ${stepId}:`, schemaContent?.substring(0, 50) + "...");
                await AdminService.updateStep(stepId, { schemaContent });
            }

            // 4. Save Approval Rules - diff originalRules vs current rules
            const { originalRules } = get();
            const originalRuleIds = new Set(originalRules.map(r => r.id));
            const currentRuleIds = new Set(rules.map(r => r.id));

            // Find rules to DELETE (in original but not in current)
            const rulesToDelete = originalRules.filter(r => !currentRuleIds.has(r.id));
            console.log("Deleting rules...", rulesToDelete.length);
            for (const rule of rulesToDelete) {
                try {
                    await AdminService.deleteApproverRule(rule.id);
                } catch (e) {
                    console.warn("Failed to delete rule (may not exist):", rule.id);
                }
            }

            // Find rules to CREATE (in current but not in original)
            const rulesToCreate = rules.filter(r => !originalRuleIds.has(r.id));
            console.log("Creating rules...", rulesToCreate.length);
            for (const rule of rulesToCreate) {
                if (!rule.stepId) continue;
                // Direct mapping - no conversion needed
                const ruleData = {
                    priority: rule.priority,
                    description: rule.name,
                    principalType: rule.assignType,
                    principalId: rule.assignTo,
                    isFinal: rule.isFinal ?? false,
                    conditionExpr: JSON.stringify(rule.conditions.length > 0 ? { conditions: rule.conditions } : {})
                };
                await AdminService.createApproverRule(rule.stepId, ruleData);
            }

            // Find rules to UPDATE (in both original and current)
            const rulesToUpdate = rules.filter(r => originalRuleIds.has(r.id));
            console.log("Updating rules...", rulesToUpdate.length);
            for (const rule of rulesToUpdate) {
                // Direct mapping - no conversion needed
                const ruleData = {
                    priority: rule.priority,
                    description: rule.name,
                    principalType: rule.assignType,
                    principalId: rule.assignTo,
                    isFinal: rule.isFinal ?? false,
                    conditionExpr: JSON.stringify(rule.conditions.length > 0 ? { conditions: rule.conditions } : {})
                };
                await AdminService.updateApproverRule(rule.id, ruleData);
            }


            // 5. Activate the draft
            console.log("Activating draft...");
            await AdminService.activateRequestType(requestTypeId);

            set({ isSaving: false, isDirty: false });

            // After activation, the draft is gone. Create a new draft for continued editing.
            console.log("Creating new draft for continued editing...");
            try {
                await AdminService.editRequestType(requestTypeId);
            } catch (e) {
                // If edit fails (e.g., already in draft), ignore
                console.log("Edit after save:", e);
            }

            // Now reload - the draft should exist
            await get().loadRequestType(requestTypeId);

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to save changes';
            console.error("Failed to save changes", err);
            set({
                isSaving: false,
                error: errMsg
            });
        }
    },

    resolveDraftConflict: async () => {
        const { requestTypeId } = get();
        if (!requestTypeId) return;

        set({ isLoading: true, draftConflict: false, draftConflictMessage: null, error: null });
        try {
            console.log("Resolving draft conflict: discarding other user's draft...");
            await AdminService.discardDraft(requestTypeId);
            console.log("Draft discarded. Retrying load...");
            // Retry loading (which will create a new draft for the current user)
            await get().loadRequestType(requestTypeId);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to take over draft';
            console.error("Draft conflict resolution failed:", err);
            set({ isLoading: false, error: errMsg });
        }
    },

    discardChanges: async () => {
        const { requestTypeId } = get();
        if (!requestTypeId) return;

        try {
            console.log('Discarding draft for:', requestTypeId);
            await AdminService.discardDraft(requestTypeId);
            console.log('Draft discarded successfully.');
        } catch (err: unknown) {
            // Ignore errors (draft may already be gone)
            console.warn('Failed to discard draft (may already be deleted):', err);
        }

        // Reset store to initial state
        set({
            requestTypeId: null,
            metadata: null,
            workflow: { nodes: [], edges: [] },
            originalNodes: [],
            originalEdges: [],
            originalRules: [],
            schemas: {},
            schema: [],
            rules: [],
            statusNetwork: { nodes: [], edges: [] },
            activeTab: 'workflow',
            isLoading: false,
            isSaving: false,
            isDirty: false,
            error: null,
            activeStepId: null,
            selectedSchemaFieldId: null,
            selectedRuleId: null,
            isDryRunOpen: false,
            draftConflict: false,
            draftConflictMessage: null,
        });
    },

    deleteRequestType: async () => {
        const { requestTypeId } = get();
        if (!requestTypeId) return;
        set({ isSaving: true });
        try {
            await AdminService.deleteRequestType(requestTypeId);
            set({ requestTypeId: null, metadata: null, isLoading: false, isSaving: false });
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to delete Request Type';
            set({ isSaving: false, error: errMsg });
            throw err;
        }
    },

    deleteStep: (stepId) => set(state => {
        // Remove node
        const newNodes = state.workflow.nodes.filter(n => n.id !== stepId);

        // Remove connected edges
        const newEdges = state.workflow.edges.filter(e => e.source !== stepId && e.target !== stepId);

        // Remove schema
        const newSchemas = { ...state.schemas };
        delete newSchemas[stepId];

        return {
            workflow: { nodes: newNodes, edges: newEdges },
            schemas: newSchemas,
            activeStepId: state.activeStepId === stepId ? null : state.activeStepId,
            isDirty: true
        };
    }),

    updateMetadata: (data) => set(state => {
        if (!state.metadata) return {};
        return {
            metadata: { ...state.metadata, ...data },
            isDirty: true
        };
    }),

    updateWorkflow: (nodes, edges) => set({
        workflow: { nodes, edges },
        isDirty: true
    }),

    updateSchema: (items) => set(state => {
        const activeStepId = state.activeStepId;
        if (!activeStepId) return { schema: items, isDirty: true };
        return {
            schema: items,
            schemas: { ...state.schemas, [activeStepId]: items },
            isDirty: true
        };
    }),

    addSchemaItem: (type, label) => set(state => {
        const activeStepId = state.activeStepId;
        if (!activeStepId) return {};

        const newItem: UiCanvasItem = {
            id: `${type}-${Date.now()}`,
            type,
            label,
            required: false,
            ...(type === 'section' ? { fields: [], collapsed: false } : {}),
            ...(type === 'table' ? { columns: [] } : {}),
        } as UiCanvasItem;

        const currentSchema = state.schemas[activeStepId] || [];
        const newSchema = [...currentSchema, newItem];

        return {
            schema: newSchema,
            schemas: { ...state.schemas, [activeStepId]: newSchema },
            selectedSchemaFieldId: newItem.id,
            isDirty: true
        };
    }),

    updateRules: (rules) => set({
        rules,
        isDirty: true
    }),

    updateStatusNetwork: (nodes, edges) => set({
        statusNetwork: { nodes, edges },
        isDirty: true
    })
}));
