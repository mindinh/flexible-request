export interface AdminRequestType {
    ID: string;
    title: string;
    description?: string;
    isEnabled?: boolean;
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
    predecessors?: AdminStepDependency[];
    approverRules?: AdminApproverRule[];
    // Schema content stored directly on step
    schemaContent?: string;
    // Sync trigger
    syncTrigger?: string;
    // Default Step Owner (design-time configuration)
    ownerType?: string;
    ownerId?: string;
}

// ApprovalConfig removed

export interface AdminStepDependency {
    ID: string;
    step_ID?: string;
    dependsOn_ID?: string;
    // We might expand this to include the step name if needed
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
    principalType: 'USER' | 'ROLE' | 'GROUP' | 'TEAM' | 'POSITION';
    principalId: string;    // UUID of ShadowUsers or ShadowGroups
    isFinal?: boolean;
    description?: string;
}
// AdminSchemaDefinition removed - schemaContent is now stored directly on AdminStepDefinition
