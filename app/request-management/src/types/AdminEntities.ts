export interface AdminRequestType {
    ID: string;
    title: string;
    description?: string;
    isEnabled?: boolean;
    icon?: string;
    dataSchemaContent?: string; // Centralized data schema JSON
    formSchemasContent?: string; // Named form layouts JSON
    statusFlowContent?: string;  // Status Flow JSON (business visualization)
    steps?: AdminStepDefinition[];
    statusNetwork?: AdminStatusNetwork[];
    IsActiveEntity?: boolean;
    HasActiveEntity?: boolean;
    HasDraftEntity?: boolean;
}

export interface AdminStepDefinition {
    ID: string;
    stepName: string;
    isStartStep: boolean;
    slaDays: number;
    requestType_ID?: string;
    stepType?: string; // 'start' | 'end' | 'action' | 'condition'
    actionSubType?: string; // 'form' | 'email' | 'approval'
    formId?: string;
    // Canvas position for workflow visualization
    positionX?: number;
    positionY?: number;
    predecessors?: AdminStepDependency[];
    approverRules?: AdminApproverRule[];
    // Schema content stored directly on step
    schemaContent?: string;
    // Input/Output mapping content (JSON)
    inputsContent?: string;
    outputsContent?: string;
    inputMapping?: string;
    approversContent?: string;
    notificationsContent?: string;
    conditionExpr?: string; // JSON condition expression for condition nodes
    // Sync trigger
    syncTrigger?: string;
    // Default Step Owner (design-time configuration)
    ownerType?: string;
    ownerId?: string;
    ownerDisplayName?: string;
    approverType?: string;
    approverId?: string;
    approverDisplayName?: string;
    // Email Template (Custom fields from HEAD)
    emailSubject?: string;
    emailBody?: string;
    // API Call (Custom fields from HEAD)
    apiMethod?: string;
    apiUrl?: string;
    apiHeaders?: string;
    apiBody?: string;
    apiAuthType?: string;
    apiAuthToken?: string;
    apiAuthUser?: string;
    apiAuthPass?: string;
    apiResponseMapping?: string;
}

// ApprovalConfig removed

export interface AdminStepDependency {
    ID: string;
    step_ID?: string;
    dependsOn_ID?: string;
    action?: string; // If set, only activates when predecessor completes with this action
}

export interface AdminStatusNetwork {
    ID: string;
    requestType_ID?: string;
    fromStatus: string;
    toStatus: string;
    action?: string;
    description?: string;
}

export interface AdminApproverRule {
    ID: string;
    requestType_ID?: string;
    stepDefinition_ID?: string;
    priority: number;
    conditionExpr: string; // JSON string
    principalType: 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION' | 'DEPARTMENT';
    principalId: string;    // UUID of ShadowUsers or ShadowGroups
    isFinal?: boolean;
    description?: string;
}
// AdminSchemaDefinition removed - schemaContent is now stored directly on AdminStepDefinition
