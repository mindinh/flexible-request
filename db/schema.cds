namespace sap.cre;

using {cuid} from '@sap/cds/common';

// Import custom managed aspect with UUID-based user references
using {sap.cre.managedWithUser} from './schema/common';

// Import identity schema (Shadow Directory)
using {
    sap.cre.ShadowUsers,
    sap.cre.ShadowGroups,
    sap.cre.SupportTypes,
    sap.cre.GroupMembers
} from './schema/identity';

// Import notifications schema
using {sap.cre.Notifications} from './schema/notifications';

// Import system settings schema (NumberRanges)
using {sap.cre.NumberRanges} from './schema/settings';

// Import value help schema
using {sap.cre.ValueHelpList} from './schema/valuehelp';

// ----------------------------------------------------------------------------
// Configuration Entities (Blueprints)
// ----------------------------------------------------------------------------

/**
 * Defines a type of request (e.g. "Leave Request", "New Plant").
 */
entity RequestTypes : cuid, managedWithUser {
    title              : String @mandatory;
    description        : String;
    isEnabled          : Boolean default true;
    icon               : String default 'workflow'; // Icon identifier (e.g., 'plane', 'cart', 'key')
    dataSchemaContent  : LargeString; // Centralized data schema JSON (field definitions)
    formSchemasContent : LargeString; // Named form layouts JSON: [{ id, name, items }]
    statusFlowContent  : LargeString; // Status Flow JSON: { actors, actions, statuses, nodes, transitions }
    steps              : Composition of many StepDefinitions
                             on steps.requestType = $self;
    statusNetwork      : Composition of many StatusNetwork
                             on statusNetwork.requestType = $self;
}

/**
 * Defines the steps within a Request Type.
 * Steps are connected via dependencies (predecessors) instead of a simple sequence.
 */
entity StepDefinitions : cuid, managedWithUser {
    requestType          : Association to RequestTypes;
    stepName             : String @mandatory;
    isStartStep          : Boolean default false; // True if this step starts when request is submitted
    // Node type for workflow canvas rendering
    stepType             : String(20) default 'action'; // start, end, action, condition
    actionSubType        : String(20); // form, email, approval (only for stepType=action)
    formId               : String(36); // UUID reference to a form in RequestTypes.formSchemasContent
    positionX            : Integer default 0; // Canvas X coordinate for workflow visualization
    positionY            : Integer default 0; // Canvas Y coordinate for workflow visualization
    slaDays              : Integer default 3; // Number of days to complete this step (SLA)
    schemaContent        : LargeString; // Form schema JSON (each step has its own schema)
    inputsContent        : LargeString; // JSON: Array<{ sourcePath, alias?, type? }>
    outputsContent       : LargeString; // JSON: Array<{ sourcePath, alias?, type?, derivedFrom? }>
    inputMapping         : LargeString; // JSON: Map of field ID to source {stepId, fieldId}
    approversContent     : LargeString; // JSON: Array<{ id, type, displayName }>
    notificationsContent : LargeString; // JSON: { channels: string[], emailConfig?: {...} }
    conditionExpr        : LargeString; // JSON condition expression for condition nodes (AND/OR/NOT groups)
    // Sync Trigger: When to sync data to S/4HANA or external system
    syncTrigger          : String enum {
        NONE; // Do not sync after this step
        IMMEDIATE; // Sync immediately after approval
        WITH_NEXT; // Wait and sync with next step
        ON_COMPLETE; // Sync when entire workflow completes
    } default 'NONE';

    // Email Template (Custom fields from HEAD)
    emailSubject         : String;      // Email subject template (supports {{requestId}}, {{requestTitle}}, etc.)
    emailBody            : LargeString; // Email body template (HTML, supports {{requestId}}, {{requestTitle}}, etc.)

    // API Call (Custom fields from HEAD)
    apiMethod            : String(10); // GET, POST, PUT, DELETE
    apiUrl               : String(1024);
    apiHeaders           : LargeString; // JSON: Array<{ key, value }>
    apiBody              : LargeString; // JSON body or template
    apiAuthType          : String(20); // none, basic, bearer
    apiAuthToken         : String;
    apiAuthUser          : String;
    apiAuthPass          : String;
    apiResponseMapping   : LargeString; // JSON: Array<{ sourcePath, targetField }>

    // Default Step Owner (set at design time) - JOIN with ShadowUsers/Groups for display
    ownerType            : String(20); // Principal type (USER/GROUP/TEAM/etc.)
    ownerId              : UUID; // ShadowUser or ShadowGroup ID

    // Fixed Approver (design-time configuration)
    approverType         : String(20); // Principal type (USER/GROUP/TEAM/etc.)
    approverId           : UUID; // ShadowUser or ShadowGroup ID

    // Dependencies: What must complete before this step can start
    predecessors         : Composition of many StepDependencies
                               on predecessors.step = $self;
    // Dynamic Approver Rules for this step
    approverRules        : Composition of many ApproverRules
                               on approverRules.stepDefinition = $self;
}

/**
 * Defines dependencies between steps.
 * A step can only start when ALL its predecessors are COMPLETED.
 */
entity StepDependencies : cuid {
    step      : Association to StepDefinitions; // This step...
    dependsOn : Association to StepDefinitions; // ...waits for this step to complete
    action    : String; // If set, only activates when predecessor completes with this action (e.g. 'approve', 'reject')
}

/**
 * Defines valid status transitions for a Request Type.
 * Enforces which status changes are allowed (e.g., DRAFT -> SUBMITTED, not DRAFT -> COMPLETED).
 */
entity StatusNetwork : cuid, managedWithUser {
    requestType : Association to RequestTypes;
    fromStatus  : String @mandatory; // e.g., "DRAFT"
    toStatus    : String @mandatory; // e.g., "SUBMITTED"
    action      : String; // Optional: action name that triggers this transition
    description : String; // Human-readable description
}

/**
 * Stores API connections for dynamic dropdown data sources.
 * Shared across all users — managed by admins via the Integrations page.
 */
entity ApiConnections : cuid, managedWithUser {
    name        : String @mandatory;
    baseUrl     : String @mandatory;
    authType    : String enum {
        none;
        basic;
        bearer
    } default 'none';
    username    : String; // Basic Auth
    password    : String; // Basic Auth
    token       : String; // Bearer token
    description : String;
}

/**
 * Decision table for dynamic approver resolution.
 * Maps conditions (based on request data) to specific approvers.
 *
 * Example: If Plant Country = "DE", assign to "DE_FINANCE_TEAM"
 */
entity ApproverRules : cuid, managedWithUser {
    requestType    : Association to RequestTypes;
    stepDefinition : Association to StepDefinitions;
    priority       : Integer default 0; // Higher priority rules evaluated first
    // Condition (JSON expression evaluated against RequestData)
    conditionExpr  : LargeString; // e.g., {"field": "country", "operator": "eq", "value": "DE"}

    // Principal Model - JOIN with ShadowUsers/Groups for display name
    principalType  : String(20); // Links to SupportTypes.code (USER, GROUP, TEAM, etc.)
    principalId    : UUID; // ID of ShadowUsers or ShadowGroups

    isFinal        : Boolean default false; // If true, stop approval chain when this approver approves
    description    : String;
}

// SchemaDefinitions removed - schemaContent is now stored directly on StepDefinitions


// ----------------------------------------------------------------------------
// Transactional Entities (Runtime)
// ----------------------------------------------------------------------------

/**
 * An instance of a Request.
 */
entity Requests : cuid, managedWithUser {
    displayId       : String(50); // Human-readable ID (e.g., LVE-001023), generated on creation
    title           : String;
    description     : LargeString; // Justification for the request
    requestType     : Association to RequestTypes;
    refRequest      : Association to Requests; // Source request for copies
    priority        : String enum {
        HIGH;
        MEDIUM;
        LOW;
    } default 'MEDIUM';
    status          : String enum {
        DRAFT;
        SUBMITTED;
        IN_PROGRESS;
        COMPLETED;
        REJECTED;
        WITHDRAWN;
    } default 'DRAFT';

    // Coordinator Assignment - JOIN with ShadowUsers/Groups for display name
    coordinatorType : String(20); // Principal type (USER/GROUP)
    coordinatorId   : UUID; // ShadowUser or ShadowGroup ID
    delegatedFrom   : UUID; // Previous coordinator (if delegated)
    delegatedAt     : Timestamp; // When delegation occurred

    steps           : Composition of many Steps
                          on steps.request = $self;
    history         : Composition of many RequestHistory
                          on history.request = $self;
}

/**
 * A runtime step within a Request.
 */
entity Steps : cuid, managedWithUser {
    request        : Association to Requests;
    stepDefinition : Association to StepDefinitions;
    status         : String enum {
        UPCOMING; // Not started yet (default for 2nd+ steps)
        STARTED; // Data entry required (1st step in DRAFT, or 2nd+ steps activated)
        IN_PROGRESS; // Under approval review
        COMPLETED; // All approvals given
        REJECTED; // Approver rejected
        SKIPPED; // Approval not required
        IN_CLARIFICATION; // Approver needs more information
        PENDING; // Legacy status (maps to UPCOMING)
    } default 'UPCOMING';

    // SLA Tracking
    dueDate        : Timestamp; // Deadline for this step
    reminderSent   : Boolean default false;

    // Step Owner Assignment - JOIN with ShadowUsers/Groups for display
    ownerType      : String(20); // Principal type (USER/GROUP)
    ownerId        : UUID; // ShadowUser or ShadowGroup ID

    // Decision Branching
    decisionAction : String; // The action taken to complete this step (e.g. 'approve', 'reject', 'sendToLegal')

    // Step Claim/Release
    claimedBy      : Association to ShadowUsers; // Who claimed this step
    claimedAt      : Timestamp; // When claimed (for 4-hour timeout)

    // Relationships
    approvals      : Composition of many StepApprovals
                         on approvals.step = $self;
    data           : Composition of one RequestData
                         on data.step = $self;
    history        : Composition of many StepHistory
                         on history.step = $self;
}

/**
 * Runtime tracking of internal approvals within a step.
 */
entity StepApprovals : cuid, managedWithUser {
    step                : Association to Steps;
    approver            : UUID; // ShadowUser or ShadowGroup ID (JOIN for display)
    status              : String enum {
        PENDING; // Currently waiting for approval (active approver)
        WAITING; // Queued, waiting for previous approver
        APPROVED; // Approver approved
        REJECTED; // Approver rejected
        SENDBACK; // Sent back for clarification
    } default 'PENDING';
    comment             : String;
    decisionAt          : Timestamp;
    ruleName            : String; // Name/Description of the rule (e.g. "Head of Department")
    approverType        : String; // e.g. "GROUP", "USER"
    approverDisplayName : String; // KEPT: audit snapshot of who approved

    // Tracking Actual Approver
    decidedBy           : Association to ShadowUsers; // The actual user who made the decision
}


// ----------------------------------------------------------------------------
// Data Entities (JSON Storage)
// ----------------------------------------------------------------------------

/**
 * The actual business data payload.
 * Validated against SchemaDefinitions by the Application Logic.
 */
entity RequestData : cuid, managedWithUser {
    step    : Association to Steps;
    payload : LargeString; // The JSON Blob (per-step data for Governance Workflow)
}


// ----------------------------------------------------------------------------
// Audit Entities
// ----------------------------------------------------------------------------

/**
 * Immutable audit log of all significant actions.
 */
entity RequestHistory : cuid, managedWithUser {
    request   : Association to Requests;
    step      : Association to Steps;
    action    : String; // SUBMIT, APPROVE, REJECT, UPDATE
    actor     : Association to ShadowUsers; // Who performed the action
    timestamp : Timestamp;
    comment   : String;
    snapshot  : LargeString; // JSON snapshot of data at this point
}

/**
 * Granular step-level audit log.
 * Tracks individual events within a step (data updates, status changes, SLA breaches).
 */
entity StepHistory : cuid, managedWithUser {
    step      : Association to Steps;
    action    : String enum {
        CREATED;
        ACTIVATED; // Step became ready for action
        DATA_UPDATED; // RequestData was modified
        STATUS_CHANGED; // Step status transition
        SLA_BREACHED; // Due date passed
        APPROVAL_STARTED; // Approval process began
        SENT_BACK; // Step was sent back for rework
        APPROVE; // Approver approved
        REJECT; // Approver rejected
        CLARIFICATION_PROVIDED; // Requester provided clarification
        AUTO_COMPLETE; // System auto-completed (no approvers)
        COMPLETE; // All approvals granted
        SKIP; // Step skipped
        SUBMIT_STEP; // User submitted step data for approval
    };
    fromValue : String; // Previous value (e.g., old status)
    toValue   : String; // New value (e.g., new status)
    actor     : Association to ShadowUsers; // Who performed the action (null for system actions)
    timestamp : Timestamp;
    comment   : String;
}


// ----------------------------------------------------------------------------
// Attachment Entities (Object Store Integration)
// ----------------------------------------------------------------------------

/**
 * Stores file attachment metadata.
 * The actual binary is stored in SAP BTP Object Store (S3/Azure Blob/GCP Bucket).
 *
 * Design: Metadata in HANA, Binary in Object Store (cost-effective).
 * Reference: docs/01 end user requirements/SAP ObjectStore-EN.pdf
 */
entity Attachments : cuid, managedWithUser {
    fileName  : String @mandatory;
    mimeType  : String;
    size      : Integer64; // File size in bytes
    contentId : String; // Unique key/path in Object Store (e.g., S3 key)
    // Associations (attach to either a Request or a specific Step)
    request   : Association to Requests;
    step      : Association to Steps;
}
