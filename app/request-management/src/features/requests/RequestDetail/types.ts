import type { WorkflowStepStatus } from '../../../components/shared';

/**
 * Step definition from request type
 */
export interface StepDefinition {
    ID: string;
    stepName: string;
    isStartStep?: boolean;
}

/**
 * Runtime step instance
 */
export interface Step {
    ID: string;
    status: string;
    stepDefinition_ID?: string;
    stepDefinition: StepDefinition;
    ownerId?: string;
    ownerType?: string;
    ownerDisplayName?: string;
    decisionAction?: string;
    data?: {
        ID: string;
        payload?: string;
    };
    approvals?: Approval[];
}

/**
 * Step approval record
 */
export interface Approval {
    ID: string;
    status: string;
    approver?: string;
    approverDisplayName?: string;
    approverType?: string;
    ruleName?: string;
    comment?: string;
    decisionAt?: string;
    decidedByDisplayName?: string;
}

/**
 * Audit log / history item
 */
export interface HistoryItem {
    ID: string;
    source: 'REQUEST' | 'STEP';
    action: string;
    actor: string;
    actorId?: string;
    timestamp: string;
    comment?: string;
    stepName?: string;
    fromValue?: string;
    toValue?: string;
}

/**
 * Step definition from request type (with full data)
 */
export interface RequestTypeStep {
    ID: string;
    stepName: string;
    isStartStep?: boolean;
    schemaContent?: string;
    formId?: string;
    stepType?: string;
    actionSubType?: string;
    sequenceNum?: number;
    slaDays?: number;
    ownerId?: string;
    ownerType?: string;
    ownerDisplayName?: string;
    inputMapping?: string;
    approverRules?: ApproverRule[];
    predecessors?: any[];
}

/**
 * Approver rule definition
 */
export interface ApproverRule {
    ID: string;
    ruleName?: string;
    approverType?: string;
    approverValue?: string;
    condition?: string;
}

/**
 * Request type metadata
 */
export interface RequestType {
    ID: string;
    title: string;
    description?: string;
    icon?: string;
    steps?: RequestTypeStep[];
    formSchemasContent?: string;
}

/**
 * Full request detail data
 */
export interface RequestDetailData {
    ID: string;
    title: string;
    status: string;
    priority: string;
    description?: string;
    createdAt: string;
    createdBy?: string;
    requestType?: RequestType;
    requestType_ID?: string;
    coordinatorType?: string;
    coordinatorId?: string;
    coordinatorDisplayName?: string; // Virtual field from backend
    delegatedFrom?: string;
    delegatedAt?: string;
    steps?: Step[];
}

/**
 * Map backend step status to WorkflowStepStatus (UI component)
 */
export function mapStepStatus(status: string): WorkflowStepStatus {
    switch (status?.toUpperCase()) {
        case 'COMPLETED':
            return 'COMPLETED';
        case 'IN_PROGRESS':
            return 'IN_PROGRESS';
        case 'STARTED':
            return 'STARTED';
        case 'REJECTED':
            return 'REJECTED';
        case 'SKIPPED':
            return 'SKIPPED';
        case 'IN_CLARIFICATION':
            return 'IN_CLARIFICATION';
        case 'UPCOMING':
            return 'UPCOMING';
        case 'PENDING':
        default:
            return 'PENDING';
    }
}

/**
 * Action map for audit log display
 */
export const ACTION_LABELS: Record<string, string> = {
    'STATUS_CHANGE': 'Status Changed',
    'SEND_BACK': 'Sent Back',
    'APPROVE': 'Approved',
    'REJECT': 'Rejected',
    'CREATE': 'Created',
    'SUBMIT': 'Submitted',
    'CLARIFICATION_PROVIDED': 'Clarification Provided',
    'AUTO_COMPLETE': 'Auto-Completed',
    'CREATED': 'Step Created',
    'COMPLETE': 'Completed',
    'ACTIVATED': 'Activated'
};
