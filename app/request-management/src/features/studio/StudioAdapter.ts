import type {
    AdminRequestType,
    AdminStepDefinition,
    AdminApproverRule,
    AdminStatusNetwork
} from '../../types/AdminEntities';
import type {
    UiRule,
    UiCanvasItem,
    UiWorkflowNode,
    UiWorkflowEdge,
    UiStatusNode,
    UiStatusEdge,
    UiNodeInput,
    UiNodeOutput,
    SyncTrigger
} from './types';

// Helper to parse/stringify JSON safely
function parseJson<T>(str: string | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch (e) {
        console.error("Failed to parse JSON", e);
        return fallback;
    }
}

interface ConditionExpr {
    field?: string;
    operator?: string;
    value?: string;
    conditions?: Array<{ id?: string; field: string; operator: string; value: string }>;
}

export const StudioAdapter = {
    // --- Request Type Metadata ---
    toUiMetadata: (entity: AdminRequestType) => ({
        id: entity.ID,
        name: entity.title,
        description: entity.description || '',
        isEnabled: entity.isEnabled ?? true,
        icon: (entity as AdminRequestType & { icon?: string }).icon || 'workflow'
    }),


    // --- Approval Rules ---
    toUiRules: (backendRules: AdminApproverRule[] = [], stepId?: string): UiRule[] => {
        return backendRules.map(rule => {
            const condition = parseJson<ConditionExpr>(rule.conditionExpr, {});
            // Check if condition is simple or complex (array)
            // For now, assuming our UI only supports the array format we defined
            // If backend has different format, we might need migration logic

            // If conditionExpr is a single object {field, op, value}, wrap in array
            // If it's { conditions: [...] }, use that.
            let conditions: Array<{ id?: string; field: string; operator: string; value: string }> = [];
            if (condition.conditions) {
                conditions = condition.conditions;
            } else if (condition.field) {
                conditions = [{ field: condition.field, operator: condition.operator || '', value: condition.value || '' }];
            }

            return {
                id: rule.ID,
                stepId: stepId || rule.stepDefinition_ID,
                name: rule.description || 'Rule',
                priority: rule.priority,
                conditions: conditions.map((c, idx) => ({
                    id: c.id || `c-${rule.ID}-${idx}`,
                    field: c.field,
                    operator: c.operator,
                    value: c.value
                })),
                assignTo: rule.principalId || '',
                assignToName: (rule as any).principalDisplayName || '', // Use virtual field from backend
                assignType: rule.principalType || 'USER', // Direct mapping - no conversion needed
                isFinal: rule.isFinal ?? false,
                expanded: false,
                isActive: true
            };
        });
    },

    toBackendRules: (uiRules: UiRule[], stepId: string): Partial<AdminApproverRule>[] => {
        return uiRules
            .filter(r => r.stepId === stepId)
            .map(rule => {
                return {
                    priority: rule.priority,
                    description: rule.name,
                    principalType: rule.assignType, // Direct mapping - no conversion needed
                    principalId: rule.assignTo,
                    isFinal: rule.isFinal ?? false,
                    conditionExpr: JSON.stringify(rule.conditions.length > 0 ? { conditions: rule.conditions } : {})
                };
            });
    },


    // --- Workflow (Nodes/Edges) ---
    toUiWorkflow: (steps: AdminStepDefinition[] = []): { nodes: UiWorkflowNode[], edges: UiWorkflowEdge[] } => {
        const nodes: UiWorkflowNode[] = [];
        const edges: UiWorkflowEdge[] = [];

        // Map backend stepType to React Flow node type key
        const STEP_TYPE_TO_NODE: Record<string, string> = {
            start: 'startNode',
            end: 'endNode',
            action: 'actionNode',
            condition: 'conditionNode',
        };

        // Fallback: infer React Flow node type from legacy step data
        const inferNodeType = (step: AdminStepDefinition): string => {
            if (step.isStartStep) return 'startNode';
            if (step.syncTrigger === 'END' || step.stepName?.toLowerCase().includes('end')) return 'endNode';
            return 'actionNode';
        };

        steps.forEach(step => {
            // Use stored stepType if available, else infer from legacy data
            const nodeType = step.stepType
                ? (STEP_TYPE_TO_NODE[step.stepType] || 'actionNode')
                : inferNodeType(step);
            const rawActionSubType = step.actionSubType || undefined;
            const isBackgroundTask = rawActionSubType === 'api_call' || rawActionSubType === 'apiCall' || rawActionSubType === 'formula';
            const normalizedBackgroundTaskType = rawActionSubType === 'apiCall' ? 'api_call' : rawActionSubType;

            nodes.push({
                id: step.ID,
                type: nodeType,
                position: { x: step.positionX ?? 0, y: step.positionY ?? 0 },
                data: {
                    label: step.stepName,
                    sla: step.slaDays,
                    isStart: step.isStartStep,
                    syncTrigger: step.syncTrigger as SyncTrigger || 'NONE',
                    actionSubType: isBackgroundTask ? 'background_task' : rawActionSubType,
                    backgroundTaskType: isBackgroundTask ? normalizedBackgroundTaskType : undefined,
                    formId: step.formId || undefined,
                    inputMapping: step.inputMapping || '{}',
                    // Default owner fields
                    owner_ID: step.ownerId,
                    ownerType: step.ownerType,
                    ownerName: (step as any).ownerDisplayName || '',
                    // I/O mappings
                    inputs: parseJson<UiNodeInput[]>(step.inputsContent, []),
                    outputs: parseJson<UiNodeOutput[]>(step.outputsContent, []),
                    // Approvers & Notifications
                    approvers: parseJson<Array<{ id: string; type: string; displayName: string }>>(step.approversContent, []),
                    // Parse notificationsContent: new object format or legacy string[]
                    ...(() => {
                        const raw = parseJson<any>(step.notificationsContent, null);
                        if (!raw) return { notificationTypes: [], emailConfig: undefined, bellConfig: undefined };
                        // Legacy: plain string[] like ["bell","email"]
                        if (Array.isArray(raw)) return { notificationTypes: raw as string[], emailConfig: undefined, bellConfig: undefined };
                        // New object contract: { channels, emailConfig?, bellConfig? }
                        return {
                            notificationTypes: Array.isArray(raw.channels) ? raw.channels : [],
                            emailConfig: raw.emailConfig ?? undefined,
                            bellConfig: raw.bellConfig ?? undefined,
                            // Map bellConfig fields to top-level for UI consistency
                            bellTitle: raw.bellConfig?.titleTemplate || '',
                            bellBody: raw.bellConfig?.bodyTemplate || '',
                            bellType: raw.bellConfig?.typeTemplate || 'DATA_INPUT',
                            bellPriority: raw.bellConfig?.priorityTemplate || 'MEDIUM',
                            bellRole: raw.bellConfig?.roleTemplate || 'Step Owner',
                        };
                    })(),
                    conditionExpr: step.conditionExpr ? parseJson<any>(step.conditionExpr, null) : null,
                    conditionLogic: step.conditionExpr ? parseJson<any>(step.conditionExpr, null) : null,
                    formulas: step.formulas ? parseJson<any>(step.formulas, []) : [],
                    // Legacy/Custom fields (from HEAD)
                    approver_ID: step.approverId,
                    approverType: step.approverType,
                    approverName: step.approverDisplayName || '',
                    // Email & API Configuration
                    emailSubject: step.emailSubject || '',
                    emailBody: step.emailBody || '',
                    apiMethod: step.apiMethod as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined,
                    apiUrl: step.apiUrl,
                    apiHeaders: step.apiHeaders ? parseJson<any[]>(step.apiHeaders, []) : [],
                    apiBody: step.apiBody || '',
                    apiAuthType: (step.apiAuthType || 'none') as "none" | "bearer" | "basic" | undefined,
                    apiAuthToken: step.apiAuthToken || '',
                    apiAuthUser: step.apiAuthUser || '',
                    apiAuthPass: step.apiAuthPass || '',
                    apiResponseMapping: step.apiResponseMapping ? parseJson<any[]>(step.apiResponseMapping, []) : [],
                }
            });

            // Edges (Dependencies)
            if (step.predecessors) {
                step.predecessors.forEach(pred => {
                    if (pred.dependsOn_ID) {
                        const rawAction = (pred as any).action as string | undefined;
                        const rawStatusConfigContent = (pred as any).statusConfigContent as string | undefined;
                        let handleId = rawAction;
                        let offsets = [0, 0, 0];
                        let targetHandle: string | undefined;
                        let sourceHandle: string | undefined;
                        let statusConfig: Record<string, unknown> | undefined;

                        if (rawStatusConfigContent) {
                            try {
                                const parsedStatus = JSON.parse(rawStatusConfigContent);
                                if (parsedStatus?.editor?.o) offsets = parsedStatus.editor.o;
                                if (parsedStatus?.editor?.t) targetHandle = parsedStatus.editor.t;
                                if (parsedStatus?.editor?.s) sourceHandle = parsedStatus.editor.s;
                                if (parsedStatus?.statusConfig) {
                                    statusConfig = parsedStatus.statusConfig;
                                } else if (parsedStatus?.statusName || parsedStatus?.statusColor || parsedStatus?.statusType) {
                                    statusConfig = parsedStatus;
                                }
                            } catch (e) {
                                console.warn("Failed to parse edge statusConfigContent:", rawStatusConfigContent);
                            }
                        }

                        // Legacy metadata encoding in action: handleId|{"o":[x,y,z],"t":"left-target","s":"right"}
                        if (rawAction && rawAction.includes('|')) {
                            const separatorIndex = rawAction.indexOf('|');
                            const id = rawAction.slice(0, separatorIndex);
                            const metaStr = rawAction.slice(separatorIndex + 1);
                            handleId = id;
                            try {
                                const meta = JSON.parse(metaStr);
                                if (meta.o) offsets = meta.o;
                                if (meta.t) targetHandle = meta.t;
                                if (meta.s) sourceHandle = meta.s;
                            } catch (e) {
                                console.warn("Failed to parse edge metadata:", metaStr);
                            }
                        }

                        sourceHandle = sourceHandle || handleId || undefined;

                        const isLegacyDefaultOffsets =
                            Array.isArray(offsets) &&
                            offsets.length === 3 &&
                            offsets[0] === 40 &&
                            offsets[1] === 0 &&
                            offsets[2] === 40;

                        if (isLegacyDefaultOffsets) {
                            offsets = [0, 0, 0];
                        }

                        // Parse statusConfigContent from backend
                        const statusConfig = parseJson<any>((pred as any).statusConfigContent, null);

                        edges.push({
                            id: pred.ID,
                            source: pred.dependsOn_ID,
                            target: step.ID,
                            ...(targetHandle ? { targetHandle } : {}),
                            type: 'editableEdge',
                            data: {
                                offsets,
                                ...(statusConfig ? { statusConfig } : {}),
                                action: handleId // Preserve the actual handle mapping
                            },
                            ...(sourceHandle ? { sourceHandle } : {}),
                        });
                    }
                });
            }
        });

        return { nodes, edges };
    },

    // --- Schema ---
    // Note: Schema is per-step in the backend, but the SchemaTab currently shows a "Single Form" design
    // The current UI assumes a Request Type has ONE schema (or one monolithic form).
    // However, backend has `StepDefinitions -> SchemaDefinition`.
    // Strategy: We can aggregate all schemas, OR if the UI is meant to define the "Request Form" (Start Step), we map to the Start Step's schema.
    // For this implementation, we will map to the Schema of the "Start Step" or a specific "Request Data" schema.
    // Backend `RequestTypes` doesn't have a direct schema relation. `StepDefinitions` does.

    // We will assume the FIRST step (or IsStartStep) holds the main form schema.

    // Legacy method (kept for backward compatibility if needed)
    toUiSchema: (schemaDef?: { content?: string }): UiCanvasItem[] => {
        if (!schemaDef || !schemaDef.content) return [];
        const json = parseJson<UiCanvasItem[]>(schemaDef.content, []);
        return Array.isArray(json) ? json : []; // Validate it's an array
    },

    // Parse schema from content string directly (new simplified approach)
    // Handles both formats: plain array [] or object with items property {items:[]}
    toUiSchemaFromContent: (content?: string): UiCanvasItem[] => {
        if (!content) return [];
        const json = parseJson<UiCanvasItem[] | { items?: UiCanvasItem[] }>(content, []);
        // If it's an object with items property, extract items
        if (json && typeof json === 'object' && !Array.isArray(json) && 'items' in json) {
            return Array.isArray(json.items) ? json.items : [];
        }
        return Array.isArray(json) ? json : [];
    },

    toBackendSchema: (uiItems: UiCanvasItem[]): string => {
        return JSON.stringify(uiItems);
    },

    // Alias for easier reading in save flows
    fromUiSchema: (uiItems: UiCanvasItem[]): UiCanvasItem[] => {
        return uiItems; // Return as-is; caller will JSON.stringify
    },

    // --- Status Network ---
    toUiStatusNetwork: (network: AdminStatusNetwork[] = []): { nodes: UiStatusNode[], edges: UiStatusEdge[] } => {
        const nodesMap = new Map<string, UiStatusNode>();
        const edges: UiStatusEdge[] = [];

        // Helper to ensure node exists
        const ensureNode = (status: string) => {
            if (!nodesMap.has(status)) {
                nodesMap.set(status, {
                    id: status,
                    type: 'statusNode',
                    position: { x: 0, y: 0 },
                    data: {
                        label: status,
                        isInitial: status === 'DRAFT', // Convention
                        isFinal: ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(status)
                    }
                });
            }
        };

        network.forEach(item => {
            ensureNode(item.fromStatus);
            ensureNode(item.toStatus);

            edges.push({
                id: item.ID,
                source: item.fromStatus,
                target: item.toStatus,
                label: item.action || '',
                type: 'smoothstep',
                data: {
                    action: item.action,
                    description: item.description
                }
            });
        });

        // Ensure DRAFT exists at least
        if (nodesMap.size === 0) {
            ensureNode('DRAFT');
        }

        return {
            nodes: Array.from(nodesMap.values()),
            edges
        };
    },

    toBackendStatusNetwork: (edges: UiStatusEdge[]): Partial<AdminStatusNetwork>[] => {
        return edges.map(edge => ({
            fromStatus: edge.source,
            toStatus: edge.target,
            action: edge.data?.action || edge.label,
            description: edge.data?.description
        }));
    }
};
