import { create } from 'zustand';
import type {
    UiRule,
    UiCanvasItem,
    UiForm,
    UiDataField,
    UiWorkflowNode,
    UiWorkflowEdge,
    UiRequestTypeDetails,
    UiStatusNode,
    UiStatusEdge,
    UiNodeInput,
    UiNodeOutput,
    StatusFlowModel
} from './types';
import { StudioAdapter } from './StudioAdapter';
import { AdminService } from '../../services/AdminService';
import { syncOutputsFromForm } from './workflowIOHelpers';
import { generateStatusFlow } from './statusFlowGenerator';
import {
    collectRequesterFormUiState,
    isRequesterRequestFormNode,
    syncRequesterRequestFormNode,
    getRequesterRequestFormNode,
    type RequesterFormUiState,
} from './requestFormNode';

const edgeIdentity = (e: any) =>
    `${e.source}|${e.target}|${e.sourceHandle || ''}|${e.targetHandle || ''}`;

interface StudioState {
    // Data
    requestTypeId: string | null;
    metadata: UiRequestTypeDetails | null;
    workflow: { nodes: UiWorkflowNode[], edges: UiWorkflowEdge[] };
    originalNodes: UiWorkflowNode[]; // Track original nodes for diffing
    originalEdges: UiWorkflowEdge[]; // Track edges from backend for diffing
    originalRules: UiRule[]; // Track original rules for diffing
    forms: UiForm[]; // Named form layouts
    activeFormId: string | null; // Currently selected form
    schema: UiCanvasItem[]; // Current active form's items (derived)
    rules: UiRule[];
    statusNetwork: { nodes: UiStatusNode[], edges: UiStatusEdge[] };
    statusFlow: StatusFlowModel;
    requesterFormUiState: Record<string, RequesterFormUiState>;

    // UI State
    activeTab: string;
    isLoading: boolean;
    isSaving: boolean;
    isDirty: boolean;
    error: string | null;
    activeStepId: string | null;
    activeEdgeId: string | null;
    selectedSchemaFieldId: string | null;
    selectedFooterActionId: string | null;
    selectedRuleId: string | null;
    isDryRunOpen: boolean;

    // Data Schema
    dataSchema: UiDataField[];
    selectedDataFieldId: string | null;

    // Draft Conflict State
    // Editor sub-tabs
    isFormEditorOpen: boolean;
    isEmailEditorOpen: boolean;
    isFormPreviewOpen: boolean;
    previewFormId: string | null;

    draftConflict: boolean;               // True when a 409 conflict was detected
    draftConflictMessage: string | null;   // The conflict message to display

    // Simulation State
    isSimulationMode: boolean;
    isSimulationAutoPlaying: boolean;
    simulationActiveNodeId: string | null;
    simulationHistory: string[];
    simulationVariables: Record<string, any>;
    simulationPendingBranches: UiWorkflowEdge[] | null;

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
    addSchemaItem: (type: string, label: string, key?: string) => void;
    // Form CRUD
    addForm: (name: string) => void;
    deleteForm: (formId: string) => void;
    selectForm: (formId: string | null) => void;
    updateFormName: (formId: string, name: string) => void;
    updateFormActions: (formId: string, actions: import('./types').UiFormAction[]) => void;
    updateRules: (rules: UiRule[]) => void;
    updateStatusNetwork: (nodes: UiStatusNode[], edges: UiStatusEdge[]) => void;
    updateStatusFlow: (model: StatusFlowModel) => void;
    setActiveStepId: (id: string | null) => void;
    setActiveEdgeId: (id: string | null) => void;
    setSelectedSchemaFieldId: (id: string | null) => void;
    setSelectedFooterActionId: (id: string | null) => void;
    setSelectedRuleId: (id: string | null) => void;
    setIsDryRunOpen: (open: boolean) => void;
    // Data Schema actions
    updateDataSchema: (fields: UiDataField[]) => void;
    setSelectedDataFieldId: (id: string | null) => void;
    updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
    setIsFormEditorOpen: (open: boolean) => void;
    updateForms: (forms: UiForm[]) => void;
    setIsEmailEditorOpen: (open: boolean) => void;
    setIsFormPreviewOpen: (open: boolean) => void;
    setPreviewFormId: (id: string | null) => void;
    // I/O mapping actions
    updateNodeInputs: (nodeId: string, inputs: UiNodeInput[]) => void;
    updateNodeOutputs: (nodeId: string, outputs: UiNodeOutput[]) => void;
    syncUserTaskOutputs: (nodeId: string) => void;

    // Simulation Actions
    startSimulation: () => void;
    stopSimulation: () => void;
    playSimulation: () => void;
    pauseSimulation: () => void;
    stepSimulation: () => void;
    updateSimulationVariable: (key: string, value: any) => void;
    selectSimulationBranch: (edgeId: string) => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
    // Initial State
    requestTypeId: null,
    metadata: null,
    workflow: { nodes: [], edges: [] },
    originalNodes: [],
    originalEdges: [],
    originalRules: [],
    forms: [], // Named form layouts
    activeFormId: null,
    schema: [], // Active form's items
    rules: [],
    statusNetwork: { nodes: [], edges: [] },
    statusFlow: { title: '', lanes: [], phases: [], transitions: [] },
    requesterFormUiState: {},

    activeTab: 'data-schema',
    isLoading: false,
    isSaving: false,
    isDirty: false,
    error: null,
    activeStepId: null,
    activeEdgeId: null,
    selectedSchemaFieldId: null,
    selectedFooterActionId: null,
    selectedRuleId: null,
    isDryRunOpen: false,

    // Data Schema
    dataSchema: [],
    selectedDataFieldId: null,

    // Editor sub-tabs
    isFormEditorOpen: false,
    isEmailEditorOpen: false,
    isFormPreviewOpen: false,
    previewFormId: null,

    // Draft Conflict
    draftConflict: false,
    draftConflictMessage: null,

    // Simulation
    isSimulationMode: false,
    isSimulationAutoPlaying: false,
    simulationActiveNodeId: null,
    simulationHistory: [],
    simulationVariables: {},
    simulationPendingBranches: null,

    // Auto-close editors when switching to a base tab
    setActiveTab: (tab) => {
        const BASE_TABS = ['data-schema', 'workflow', 'value-help', 'statuses', 'status-flow'];
        if (BASE_TABS.includes(tab)) {
            set({ activeTab: tab, isFormEditorOpen: false, isEmailEditorOpen: false, isFormPreviewOpen: false });
        } else {
            set({ activeTab: tab });
        }
    },
    setDirty: (dirty) => set({ isDirty: dirty }),
    setActiveStepId: (id) => {
        // Clear selected rule and edge when changing steps
        set({ activeStepId: id, activeEdgeId: null, selectedSchemaFieldId: null, selectedRuleId: null });
    },
    setActiveEdgeId: (id) => {
        // Clear active step when selecting an edge
        set({ activeEdgeId: id, activeStepId: id ? null : get().activeStepId });
    },
    setSelectedSchemaFieldId: (id) => set({ selectedSchemaFieldId: id, selectedFooterActionId: null }),
    setSelectedFooterActionId: (id) => set({ selectedFooterActionId: id, selectedSchemaFieldId: null }),
    setSelectedRuleId: (id) => set({ selectedRuleId: id, isDryRunOpen: id ? false : get().isDryRunOpen }),
    setIsDryRunOpen: (open) => set({ isDryRunOpen: open, selectedRuleId: open ? null : get().selectedRuleId }),
    // Data Schema actions
    updateDataSchema: (fields) => set({ dataSchema: fields, isDirty: true }),
    setSelectedDataFieldId: (id) => set({ selectedDataFieldId: id }),
    setIsFormEditorOpen: (open) => set({ isFormEditorOpen: open }),
    setIsEmailEditorOpen: (open) => set({ isEmailEditorOpen: open }),
    setIsFormPreviewOpen: (open) => set({ isFormPreviewOpen: open }),
    setPreviewFormId: (id) => set({ previewFormId: id }),

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

            const persistedWorkflow = StudioAdapter.toUiWorkflow(fullDraft.steps);
            const workflow = syncRequesterRequestFormNode(
                persistedWorkflow.nodes,
                persistedWorkflow.edges,
                get().requesterFormUiState
            );

            // Load forms from formSchemasContent
            let forms: UiForm[] = [];
            try {
                if (fullDraft.formSchemasContent) {
                    forms = JSON.parse(fullDraft.formSchemasContent);
                    // Preserve saved actions and migrate legacy footerActions without injecting defaults
                    forms = forms.map((f: any) => ({
                        ...f,
                        actions: f.actions !== undefined ? f.actions : (f.footerActions !== undefined ? f.footerActions : [])
                    }));
                }
            } catch (e) {
                console.warn('Failed to parse formSchemasContent:', e);
            }
            // Backward compat: migrate step-level schemas to forms if no forms exist
            if (forms.length === 0 && fullDraft.steps?.some((s: any) => s.schemaContent)) {
                fullDraft.steps?.forEach((step: any) => {
                    if (step.schemaContent) {
                        const items = StudioAdapter.toUiSchemaFromContent(step.schemaContent);
                        if (items.length > 0) {
                            forms.push({
                                id: crypto.randomUUID(),
                                name: step.stepName || 'Migrated Form',
                                items,
                            });
                        }
                    }
                });
            }
            const activeFormId = forms.length > 0 ? forms[0].id : null;
            const schema = activeFormId ? (forms.find(f => f.id === activeFormId)?.items || []) : [];

            // Enrich workflow nodes with form actions (for dynamic handles on ActionNode)
            for (const node of workflow.nodes) {
                if (node.data.formId) {
                    const matchedForm = forms.find(f => f.id === node.data.formId);
                    if (matchedForm?.actions && matchedForm.actions.length > 0) {
                        node.data.formActions = matchedForm.actions;
                    }
                }
            }

            // Set active step to the start step
            const startStep = fullDraft.steps?.find(s => s.isStartStep) || fullDraft.steps?.[0];
            const activeStepId = startStep?.ID || null;

            // Status Network
            const statusNetwork = StudioAdapter.toUiStatusNetwork(fullDraft.statusNetwork);

            // Status Flow – Auto-generate from workflow (read-only derived)
            const statusFlow = generateStatusFlow(workflow.nodes, workflow.edges, forms);

            // Data Schema
            let dataSchema: UiDataField[] = [];
            try {
                if (fullDraft.dataSchemaContent) {
                    dataSchema = JSON.parse(fullDraft.dataSchemaContent);
                }
            } catch (e) {
                console.warn('Failed to parse dataSchemaContent:', e);
            }

            set({
                metadata,
                rules,
                originalRules: rules,
                workflow,
                originalNodes: persistedWorkflow.nodes,
                originalEdges: persistedWorkflow.edges,
                forms,
                activeFormId,
                schema,
                activeStepId,
                statusNetwork,
                statusFlow,
                requesterFormUiState: collectRequesterFormUiState(workflow.nodes, workflow.edges),
                dataSchema,
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
        const { requestTypeId, metadata, rules, workflow, forms, isDirty } = get();
        console.log("saveChanges called. Dirty:", isDirty, "ID:", requestTypeId);

        if (!requestTypeId || !metadata || !isDirty) {
            console.warn("Save aborted: Missing ID/Metadata or Not Dirty");
            return;
        }

        set({ isSaving: true, error: null });
        try {
            // 0. Validate form schemas – reject empty option labels in select-type fields
            const SELECT_TYPES = ['select', 'radio', 'checkbox', 'dropdown'];
            for (const form of forms) {
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
                                        `Field "${field.label}" in form "${form.name}" has ${emptyOpts.length} option(s) with empty labels. Please fill in or remove them before saving.`
                                    );
                                }
                            }
                        }
                    }
                };
                checkFields(form.items);
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

            // 1.1 Save Data Schema at request type level
            const { dataSchema, statusFlow } = get();
            const dataSchemaContent = dataSchema.length > 0 ? JSON.stringify(dataSchema) : undefined;
            console.log("Saving data schema...", dataSchemaContent?.substring(0, 50));
            await AdminService.updateRequestType(requestTypeId, { dataSchemaContent });

            // 1.2 Save Status Flow at request type level
            const statusFlowContent = (statusFlow.phases.length > 0)
                ? JSON.stringify(statusFlow)
                : undefined;
            console.log("Saving status flow...", statusFlowContent?.substring(0, 50));
            await AdminService.updateRequestType(requestTypeId, { statusFlowContent });

            // 2. Create/Update Steps - diff against original nodes
            const { originalNodes } = get();
            const originalNodeIds = new Set(originalNodes.map(n => n.id));

            // Map React Flow node type to backend stepType
            const NODE_TO_STEP_TYPE: Record<string, string> = {
                startNode: 'start',
                endNode: 'end',
                actionNode: 'action',
                conditionNode: 'condition',
            };
            const resolveDependencyAction = (edge: UiWorkflowEdge) => {
                const sourceNode = workflow.nodes.find((node) => node.id === edge.source);
                const sourceHandle = edge.sourceHandle as string | undefined;

                if (!sourceNode || !sourceHandle) {
                    return { action: '', sourceHandleMeta: sourceHandle };
                }

                if (sourceNode.type === 'conditionNode') {
                    const isDecisionHandle = sourceHandle === 'true' || sourceHandle === 'false';
                    return {
                        action: isDecisionHandle ? sourceHandle : '',
                        sourceHandleMeta: isDecisionHandle ? undefined : sourceHandle,
                    };
                }

                const formActions = (sourceNode.data.formActions as Array<{ id?: string }> | undefined) || [];
                const isFormActionHandle = formActions.some((action) => action.id === sourceHandle);

                return {
                    action: isFormActionHandle ? sourceHandle : '',
                    sourceHandleMeta: isFormActionHandle ? undefined : sourceHandle,
                };
            };

            console.log("Processing steps...", workflow.nodes.length);
            for (const node of workflow.nodes) {
                // Skip the virtual "Requester: Request Form" node - it's not a real backend step
                if (isRequesterRequestFormNode(node)) {
                    console.log("Skipping virtual requester form node:", node.id);
                    continue;
                }
                const inputs = (node.data.inputs as UiNodeInput[]) || [];
                const outputs = (node.data.outputs as UiNodeOutput[]) || [];
                const persistedActionSubType = node.data.actionSubType === 'background_task'
                    ? ((node.data.backgroundTaskType as string) || null)
                    : (node.data.actionSubType as string) || null;
                const stepData = {
                    ID: node.id,
                    stepName: node.data.label,
                    isStartStep: node.data.isStart,
                    slaDays: node.data.sla,
                    stepType: NODE_TO_STEP_TYPE[node.type || 'actionNode'] || 'action',
                    actionSubType: persistedActionSubType,
                    formId: node.data.formId || null,
                    syncTrigger: node.data.syncTrigger || 'NONE',
                    inputMapping: (node.data.inputMapping as string) || null,
                    // Canvas position
                    positionX: Math.round(node.position.x),
                    positionY: Math.round(node.position.y),
                    // Default owner fields
                    ownerType: node.data.ownerType || null,
                    ownerId: node.data.owner_ID || null,
                    approverType: node.data.approverType || null,
                    approverId: node.data.approver_ID || null,
                    // I/O mapping content
                    inputsContent: inputs.length > 0 ? JSON.stringify(inputs) : null,
                    outputsContent: outputs.length > 0 ? JSON.stringify(outputs) : null,
                    // Approvers & Notifications content
                    approversContent: (() => {
                        const approvers = (node.data.approvers as Array<{ id: string; type: string; displayName: string }>) || [];
                        return approvers.length > 0 ? JSON.stringify(approvers) : null;
                    })(),
                    notificationsContent: (() => {
                        const notifTypes = (node.data.notificationTypes as string[]) || [];
                        if (notifTypes.length === 0 && !node.data.emailConfig && !node.data.bellTitle && !node.data.bellBody && !node.data.emailSubject && !node.data.emailBody) return null;

                        const payload: { channels: string[]; emailConfig?: any; bellConfig?: any } = {
                            channels: notifTypes,
                        };

                        // Sync emailConfig: prefer explicit emailConfig, fallback to top-level sidebar fields
                        if (node.data.emailConfig) {
                            payload.emailConfig = node.data.emailConfig;
                        } else if (node.data.emailSubject || node.data.emailBody) {
                            payload.emailConfig = {
                                recipientMode: (node.data.emailRecipient as string) || 'requester',
                                subjectTemplate: (node.data.emailSubject as string) || '',
                                bodyTemplate: (node.data.emailBody as string) || '',
                            };
                        }

                        if (node.data.bellTitle || node.data.bellBody || node.data.bellType || node.data.bellPriority || node.data.bellRole) {
                            payload.bellConfig = {
                                titleTemplate: node.data.bellTitle,
                                bodyTemplate: node.data.bellBody,
                                typeTemplate: node.data.bellType,
                                priorityTemplate: node.data.bellPriority,
                                roleTemplate: node.data.bellRole,
                            };
                        }
                        return JSON.stringify(payload);
                    })(),
                    conditionExpr: node.data.conditionLogic ? JSON.stringify(node.data.conditionLogic) : null,
                    formulas: node.data.formulas ? JSON.stringify(node.data.formulas) : null,
                    // Email & API Configuration (Custom fields from HEAD)
                    emailSubject: (node.data.emailSubject as string) || null,
                    emailBody: (node.data.emailBody as string) || null,
                    apiMethod: (node.data.apiMethod as string) || null,
                    apiUrl: (node.data.apiUrl as string) || null,
                    apiHeaders: node.data.apiHeaders ? JSON.stringify(node.data.apiHeaders) : null,
                    apiBody: (node.data.apiBody as string) || null,
                    apiAuthType: (node.data.apiAuthType as string) || null,
                    apiAuthToken: (node.data.apiAuthToken as string) || null,
                    apiAuthUser: (node.data.apiAuthUser as string) || null,
                    apiAuthPass: (node.data.apiAuthPass as string) || null,
                    apiResponseMapping: node.data.apiResponseMapping ? JSON.stringify(node.data.apiResponseMapping) : null,
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
            // Compare current edges with original to determine adds/deletes/updates
            const { originalEdges } = get();

            // Find Start and Requester nodes for de-normalization
            const startNode = workflow.nodes.find(n => n.type === 'startNode' || n.data?.isStart);
            const requesterNode = getRequesterRequestFormNode(workflow.nodes, startNode?.id);

            // De-normalize edges: point any edge coming from the virtual requester node back to the start node
            const denormalizedEdges = workflow.edges.map(edge => {
                let source = edge.source;
                let target = edge.target;

                if (requesterNode && edge.source === requesterNode.id) {
                    source = startNode!.id;
                }
                if (requesterNode && edge.target === requesterNode.id && !(edge.data as any)?.isRequesterBridge) {
                    target = startNode!.id;
                }

                if (source !== edge.source || target !== edge.target) {
                    return { ...edge, source, target };
                }
                return edge;
            }).filter(edge => {
                // Skip the bridge edge between Start and Requester
                if (requesterNode && edge.source === startNode?.id && edge.target === requesterNode.id) {
                    return false;
                }
                return true;
            });

            // Helper to create edge key for comparison - include offsets to detect wiggle changes
            const edgeKey = (e: any) => {
                const offsets = e.data?.offsets || [0, 0, 0];
                return `${e.source}|${e.target}|${e.sourceHandle || ''}|${e.targetHandle || ''}|${JSON.stringify(offsets)}`;
            };

            // Build sets for comparison
            const currentEdgeKeys = new Set(denormalizedEdges.map(e => edgeKey(e)));
            const originalEdgeKeys = new Set(originalEdges.map(e => edgeKey(e)));


            // Build identity maps for update detection
            const originalByIdentity = new Map(originalEdges.map(e => [edgeIdentity(e), e]));

            // Find edges to DELETE (in original but not in current by identity)
            const currentIdentities = new Set(denormalizedEdges.map(e => edgeIdentity(e)));
            const edgesToDelete = originalEdges.filter(e => !currentIdentities.has(edgeIdentity(e)));
            console.log("Deleting dependencies...", edgesToDelete.length);
            for (const edge of edgesToDelete) {
                if (edge.id) {
                    await AdminService.deleteStepDependency(edge.id);
                }
            }

            // Find edges to CREATE (in current but not in original)
            const edgesToCreate = denormalizedEdges.filter(e => !originalEdgeKeys.has(edgeKey(e)));
            console.log("Creating dependencies...", edgesToCreate.length);
            for (const edge of edgesToCreate) {
                // Metadata Encoding for persistence
                const offsets = (edge.data as any)?.offsets as number[] | undefined;
                const { action: baseAction, sourceHandleMeta } = resolveDependencyAction(edge);
                const targetHandle = (edge.targetHandle as string) || undefined;
                const statusConfig = (edge.data as any)?.statusConfig;
                const editorMeta: Record<string, unknown> = {};

                if (offsets && offsets.some(v => v !== 0)) {
                    editorMeta.o = offsets;
                }
                if (sourceHandleMeta) {
                    editorMeta.s = sourceHandleMeta;
                }
                if (targetHandle) {
                    editorMeta.t = targetHandle;
                }
                const statusConfigPayload = Object.keys(editorMeta).length > 0 || statusConfig
                    ? JSON.stringify({
                        ...(Object.keys(editorMeta).length > 0 ? { editor: editorMeta } : {}),
                        ...(statusConfig ? { statusConfig } : {}),
                    })
                    : undefined;

                try {
                    await AdminService.createStepDependency(edge.target, edge.source, baseAction || undefined, statusConfigPayload);
                } catch (err) {
                    console.error("Failed to create dependency:", edge.source, "->", edge.target, err);
                }
            }

            // 3. Save Form Schemas at Request Type level
            console.log("Saving form schemas...", forms.length, "forms");
            const formSchemasContent = forms.length > 0 ? JSON.stringify(forms) : undefined;
            await AdminService.updateRequestType(requestTypeId, { formSchemasContent });

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

        // Only dismiss the conflict dialog. Do NOT set isLoading here —
        // loadRequestType will set it, and setting it here triggers the
        // duplicate-load guard ("already loading, skipping").
        set({ draftConflict: false, draftConflictMessage: null, error: null });
        try {
            console.log("Resolving draft conflict: discarding other user's draft...");
            await AdminService.discardDraft(requestTypeId);
            console.log("Draft discarded. Retrying load...");
            // Reset requestTypeId so loadRequestType doesn't skip as "same ID"
            set({ requestTypeId: null });
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

        // Show loading spinner while the API call runs.
        set({ isLoading: true, error: null });

        try {
            console.log('Discarding draft for:', requestTypeId);
            await AdminService.discardDraft(requestTypeId);
            console.log('Draft discarded successfully.');
        } catch (err: unknown) {
            // Ignore errors (draft may already be gone)
            console.warn('Failed to discard draft (may already be deleted):', err);
        }

        // Reset key identifiers so that re-entering the same Request Type
        // will pass the useEffect guard (id !== requestTypeId) and trigger
        // a fresh loadRequestType call. Without this, navigating back to the
        // same RT would get stuck on the loading screen.
        set({ requestTypeId: null, metadata: null, isLoading: false });
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
        const nodeToDelete = state.workflow.nodes.find(n => n.id === stepId);
        if (nodeToDelete && isRequesterRequestFormNode(nodeToDelete)) {
            return {};
        }

        const isStartNode = nodeToDelete?.type === 'startNode' || nodeToDelete?.data?.isStart;
        const formIdToDelete = isStartNode ? nodeToDelete?.data?.formId : null;

        // Remove node
        const newNodes = state.workflow.nodes.filter(n => n.id !== stepId);

        // Remove connected edges
        const newEdges = state.workflow.edges.filter(e => e.source !== stepId && e.target !== stepId);

        // Conditional form deletion
        let newForms = state.forms;
        let newActiveFormId = state.activeFormId;
        let newSchema = state.schema;

        if (formIdToDelete) {
            newForms = state.forms.filter(f => f.id !== formIdToDelete);
            if (state.activeFormId === formIdToDelete) {
                newActiveFormId = newForms[0]?.id || null;
                newSchema = newActiveFormId ? (newForms.find(f => f.id === newActiveFormId)?.items || []) : [];
            }
        }

        // Apply synchronization to handle virtual nodes (e.g., removing requester form if start is deleted)
        const { nodes: syncedNodes, edges: syncedEdges } = syncRequesterRequestFormNode(newNodes, newEdges);

        return {
            workflow: { nodes: syncedNodes, edges: syncedEdges },
            forms: newForms,
            activeFormId: newActiveFormId,
            schema: newSchema,
            activeStepId: state.activeStepId === stepId ? null : state.activeStepId,
            requesterFormUiState: collectRequesterFormUiState(syncedNodes, syncedEdges),
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

    updateWorkflow: (nodes, edges) => set(state => {
        const normalizedWorkflow = syncRequesterRequestFormNode(nodes, edges);
        const statusFlow = generateStatusFlow(normalizedWorkflow.nodes, normalizedWorkflow.edges, state.forms);
        return {
            workflow: normalizedWorkflow,
            statusFlow,
            requesterFormUiState: collectRequesterFormUiState(normalizedWorkflow.nodes, normalizedWorkflow.edges),
            isDirty: true,
        };
    }),

    updateSchema: (items) => set(state => {
        const { activeFormId, forms } = state;
        if (!activeFormId) return { schema: items, isDirty: true };
        return {
            schema: items,
            forms: forms.map(f => f.id === activeFormId ? { ...f, items } : f),
            isDirty: true
        };
    }),

    addSchemaItem: (type, label, key) => set(state => {
        const { activeFormId, forms } = state;
        if (!activeFormId) return {};

        const newItem: UiCanvasItem = {
            id: `${type}-${Date.now()}`,
            type,
            label,
            required: false,
            key: key || undefined, // Local key
            bindTo: key || undefined, // Global binding
            ...(type === 'section' ? { fields: [], collapsed: false } : {}),
            ...(type === 'table' ? { columns: [] } : {}),
        } as UiCanvasItem;

        const currentForm = forms.find(f => f.id === activeFormId);
        const currentItems = currentForm?.items || [];
        const newItems = [...currentItems, newItem];

        return {
            schema: newItems,
            forms: forms.map(f => f.id === activeFormId ? { ...f, items: newItems } : f),
            selectedSchemaFieldId: newItem.id,
            isDirty: true
        };
    }),

    // Form CRUD
    addForm: (name) => set(state => {
        const newForm: UiForm = {
            id: crypto.randomUUID(),
            name,
            items: [],
            actions: [],
        };
        return {
            forms: [...state.forms, newForm],
            activeFormId: newForm.id,
            schema: [],
            selectedSchemaFieldId: null,
            isDirty: true,
        };
    }),

    deleteForm: (formId) => set(state => {
        const newForms = state.forms.filter(f => f.id !== formId);
        const wasActive = state.activeFormId === formId;
        const newActiveId = wasActive ? (newForms[0]?.id || null) : state.activeFormId;
        const newSchema = newActiveId ? (newForms.find(f => f.id === newActiveId)?.items || []) : [];
        return {
            forms: newForms,
            activeFormId: newActiveId,
            schema: newSchema,
            selectedSchemaFieldId: null,
            isDirty: true,
        };
    }),

    selectForm: (formId) => set(state => {
        if (!formId) return { activeFormId: null, schema: [], selectedSchemaFieldId: null };
        const form = state.forms.find(f => f.id === formId);
        return {
            activeFormId: formId,
            schema: form?.items || [],
            selectedSchemaFieldId: null,
        };
    }),

    updateFormName: (formId, name) => set(state => ({
        forms: state.forms.map(f => f.id === formId ? { ...f, name } : f),
        isDirty: true,
    })),

    updateFormActions: (formId, actions) => set(state => {
        // Update the form's actions
        const newForms = state.forms.map(f => f.id === formId ? { ...f, actions } : f);
        // Also sync formActions on any workflow node that uses this form
        const newNodes = state.workflow.nodes.map(n => {
            if (n.data.formId === formId) {
                return { ...n, data: { ...n.data, formActions: actions } };
            }
            return n;
        });
        return {
            forms: newForms,
            workflow: { ...state.workflow, nodes: newNodes },
            isDirty: true,
        };
    }),

    updateRules: (rules) => set({
        rules,
        isDirty: true
    }),

    updateStatusNetwork: (nodes, edges) => set({
        statusNetwork: { nodes, edges },
        isDirty: true
    }),

    updateStatusFlow: (model) => set({
        statusFlow: model,
        // Not marked dirty – Status Flow is auto-derived, always regenerated on save
    }),

    updateNodeData: (nodeId, data) => set(state => {
        const nextNodes = state.workflow.nodes.map(n =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, ...data } }
                : n
        );
        const normalizedWorkflow = syncRequesterRequestFormNode(nextNodes, state.workflow.edges);
        return {
            workflow: normalizedWorkflow,
            requesterFormUiState: collectRequesterFormUiState(normalizedWorkflow.nodes, normalizedWorkflow.edges),
            isDirty: true,
        };
    }),
    updateForms: (forms) => set({ forms, isDirty: true }),

    // Simulation Actions
    startSimulation: () => {
        const { workflow } = get();
        const startNode = workflow.nodes.find(n => n.data.isStart || n.type === 'startNode');
        if (!startNode) {
            set({ error: 'Cannot start simulation: No start node found.' });
            return;
        }
        const requesterFormNode = getRequesterRequestFormNode(workflow.nodes, startNode.id);
        const triggerType = (startNode.data?.triggerType as string) || 'FORM_SUB';
        const initialActiveNodeId = triggerType === 'FORM_SUB' && requesterFormNode
            ? requesterFormNode.id
            : startNode.id;
        set({
            isSimulationMode: true,
            isSimulationAutoPlaying: false,
            simulationActiveNodeId: initialActiveNodeId,
            simulationHistory: initialActiveNodeId === startNode.id ? [startNode.id] : [startNode.id, initialActiveNodeId],
            simulationVariables: {},
            simulationPendingBranches: null,
            error: null
        });
    },

    stopSimulation: () => set({
        isSimulationMode: false,
        isSimulationAutoPlaying: false,
        simulationActiveNodeId: null,
        simulationHistory: [],
        simulationVariables: {},
        simulationPendingBranches: null
    }),

    playSimulation: () => set({ isSimulationAutoPlaying: true }),
    pauseSimulation: () => set({ isSimulationAutoPlaying: false }),

    updateSimulationVariable: (key, value) => set(state => ({
        simulationVariables: { ...state.simulationVariables, [key]: value }
    })),

    stepSimulation: () => set(state => {
        const { workflow, simulationActiveNodeId, simulationVariables, simulationPendingBranches } = state;
        if (!simulationActiveNodeId || simulationPendingBranches) return {};

        const currentNode = workflow.nodes.find(n => n.id === simulationActiveNodeId);
        if (!currentNode) return {};

        // Find outgoing edges
        const outgoingEdges = workflow.edges.filter(e => e.source === simulationActiveNodeId);

        if (outgoingEdges.length === 0) {
            // End of flow
            return { simulationActiveNodeId: null, isSimulationAutoPlaying: false };
        }

        // If there are multiple branches, pause and ask for selection
        if (outgoingEdges.length > 1) {
            return {
                simulationPendingBranches: outgoingEdges
            };
        }

        let nextNodeId: string | null = null;

        if (currentNode.type === 'conditionNode') {
            // Condition Logic Traversal (Auto-evaluation or first branch if no variable set)
            const trueEdge = outgoingEdges.find(e => e.sourceHandle === 'true');
            const falseEdge = outgoingEdges.find(e => e.sourceHandle === 'false');

            const result = simulationVariables[currentNode.id];
            if (result === undefined) {
                // No result yet, ask for branch
                return {
                    simulationPendingBranches: outgoingEdges
                };
            }
            nextNodeId = result === true ? (trueEdge?.target || null) : (falseEdge?.target || null);
        } else {
            // Sequential traversal (take the first available edge)
            nextNodeId = outgoingEdges[0].target;
        }

        if (!nextNodeId) return { simulationActiveNodeId: null, isSimulationAutoPlaying: false };

        return {
            simulationActiveNodeId: nextNodeId,
            simulationHistory: [...state.simulationHistory, nextNodeId]
        };
    }),

    selectSimulationBranch: (edgeId) => set(state => {
        const edge = state.workflow.edges.find(e => e.id === edgeId);
        if (!edge) return {};

        const nextNodeId = edge.target;

        // If the source was a condition node, update the variable for history/display purposes
        const sourceNode = state.workflow.nodes.find(n => n.id === edge.source);
        let extraState = {};
        if (sourceNode?.type === 'conditionNode') {
            extraState = {
                simulationVariables: {
                    ...state.simulationVariables,
                    [sourceNode.id]: edge.sourceHandle === 'true'
                }
            };
        }

        return {
            ...extraState,
            simulationActiveNodeId: nextNodeId,
            simulationHistory: [...state.simulationHistory, nextNodeId],
            simulationPendingBranches: null
        };
    }),

    // ─── I/O Mapping Actions ─────────────────────────────────────────────
    updateNodeInputs: (nodeId, inputs) => set(state => ({
        workflow: {
            ...state.workflow,
            nodes: state.workflow.nodes.map(n =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, inputs } }
                    : n
            ),
        },
        isDirty: true,
    })),

    updateNodeOutputs: (nodeId, outputs) => set(state => ({
        workflow: {
            ...state.workflow,
            nodes: state.workflow.nodes.map(n =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, outputs } }
                    : n
            ),
        },
        isDirty: true,
    })),

    /**
     * Sync User Task outputs from its assigned form layout.
     * Derives output mappings from all bound fields (fields with a `key`) in the form.
     */
    syncUserTaskOutputs: (nodeId) => {
        const { workflow, forms } = get();
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node || !node.data.formId) return;

        const form = forms.find(f => f.id === node.data.formId);
        if (!form) return;

        const derivedOutputs = syncOutputsFromForm(form.items);

        set(state => ({
            workflow: {
                ...state.workflow,
                nodes: state.workflow.nodes.map(n =>
                    n.id === nodeId
                        ? { ...n, data: { ...n.data, outputs: derivedOutputs } }
                        : n
                ),
            },
            isDirty: true,
        }));
    },
}));
