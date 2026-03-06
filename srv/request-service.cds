using {sap.cre as db} from '../db/schema';

/**
 * Service for End Users and Approvers.
 */
service RequestService @(
    path: '/browse',
    impl: './request-service'
) {

    // ------------------------------------------------------------------------
    // Read-Only Configuration (Cached by Frontend)
    // ------------------------------------------------------------------------
    entity RequestTypes          as
        projection on db.RequestTypes {
            *,
            steps : redirected to StepDefinitions
        };

    @readonly
    entity StepDefinitions       as
        projection on db.StepDefinitions {
            *,
            virtual null as ownerDisplayName : String,
            approverRules                    : redirected to ApproverRules
        };

    // Available (enabled) request types for "New Request" dialog
    @readonly  @cds.redirection.target: false
    entity AvailableRequestTypes as
        projection on db.RequestTypes {
            ID,
            title,
            description,
            icon
        }
        where
            isEnabled = true;

    // ------------------------------------------------------------------------
    // Transactional Data
    // ------------------------------------------------------------------------

    // Users see their own requests. Approvers see requests they need to act on.
    // NOTE: Row-level security to be implemented in handlers/policies.
    // NOTE: Using custom React frontend with our own DRAFT status, no need for OData draft
    entity Requests              as
        projection on db.Requests {
            *,
            requestType                            : redirected to RequestTypes,
            steps                                  : redirected to Steps,
            refRequest                             : redirected to Requests,
            virtual null as coordinatorDisplayName : String, // Virtual field for display
            virtual null as currentStepName        : String, // Virtual field for active step name
            virtual null as dueDate                : Timestamp // Virtual field for active step due date
        }
        actions {
            action submit();
            action withdraw();
            action respondToClarification(stepId: UUID, comment: String);
            action submitStep(stepId: UUID);
            // Epic 3.1: Coordinator delegation
            action delegate(newCoordinatorType: String, newCoordinatorId: UUID, newCoordinatorValue: String);
        };

    entity Steps                 as
        projection on db.Steps {
            *,
            approvals                        : redirected to StepApprovals,
            virtual null as ownerDisplayName : String // Virtual field for display
        }
        actions {
            // Epic 3.3: Step Claim/Release
            action claimStep();
            action releaseStep();
        };

    // Approvers interact here
    entity StepApprovals         as
        projection on db.StepApprovals {
            *,
            virtual null as decidedByDisplayName : String // Resolved from decidedBy association
        }
        actions {
            action approve(comment: String, decisionAction: String);
            action rejectApproval(comment: String);
            action sendBack(comment: String, targetStepId: UUID);
        };

    entity RequestData           as projection on db.RequestData;

    @readonly
    entity RequestHistory        as projection on db.RequestHistory;

    @readonly
    entity StepHistory           as projection on db.StepHistory;

    // Attachments with Object Store integration
    entity Attachments           as projection on db.Attachments
        actions {
            // Unbound action: get pre-signed URL for upload (call before uploading)
            function getUploadUrl(fileName: String, mimeType: String) returns {
                contentId : String;
                url       : String
            };
            // Bound action: get pre-signed URL for download
            function getDownloadUrl()                                 returns String;
        };

    @readonly
    entity ApproverRules         as
        projection on db.ApproverRules {
            *,
            virtual null as principalDisplayName : String
        };

    // API Integrations (ReadOnly for Dynamic Dropdowns)
    @readonly
    entity ApiConnections        as projection on db.ApiConnections;

    // In-App Notifications (Bell Icon)
    entity Notifications         as projection on db.Notifications
        actions {
            action markAsRead();
        };

    action   markAllAsRead();
    action   deleteAll();

    // Organization Data (ReadOnly for Lookup)
    @readonly
    entity ShadowUsers           as projection on db.ShadowUsers;

    @readonly
    entity ShadowGroups          as projection on db.ShadowGroups;

    @readonly
    entity SupportTypes          as projection on db.SupportTypes;

    // ------------------------------------------------------------------------
    // Unbound Functions
    // ------------------------------------------------------------------------

    // Returns unified audit log combining RequestHistory + StepHistory
    function getAuditLog(requestId: UUID) returns array of AuditLogEntry;

    // Return type for getAuditLog function
    type AuditLogEntry {
        ID        : UUID;
        source    : String; // 'REQUEST' or 'STEP'
        action    : String;
        actor     : String; // Display name or 'system'
        actorId   : UUID; // ShadowUser UUID for linking (null for system actions)
        timestamp : Timestamp;
        comment   : String;
        stepName  : String; // Step name (if source is STEP)
        fromValue : String; // For status transitions
        toValue   : String;
    }

    // ------------------------------------------------------------------------
    // Epic 3.5: Inbox Filter Functions
    // ------------------------------------------------------------------------

    // Get direct approvals assigned to current user
    function getMyTasks()                 returns array of InboxItem;

    // Get approvals assigned to groups the user is a member of
    function getTeamTasks()               returns array of InboxItem;

    // Get requests where user is coordinator
    function getCoordinatingRequests()    returns array of InboxItem;

    type InboxItem {
        stepApprovalId  : UUID; // StepApproval ID
        stepId          : UUID; // Step ID
        requestId       : UUID; // Request ID
        requestTitle    : String; // Request title
        displayId       : String; // Human-readable number (e.g. 001023)
        requestType     : String; // Request type name
        stepName        : String; // Step name
        status          : String; // Approval status
        assignedTo      : String; // Assigned approver/group name
        assignedType    : String; // USER or GROUP
        claimedBy       : String; // Who claimed (if any)
        claimedByUserId : UUID; // ShadowUser ID of claimer (for "is me?" check)
        requester       : String; // Display name of the requester
        priority        : String; // Request priority
        createdAt       : Timestamp;
        dueDate         : Timestamp;
    }
}
