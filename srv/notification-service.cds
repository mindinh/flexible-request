namespace sap.cre.notifications;

/**
 * Events emitted by the core workflow engine for notification purposes.
 * These are consumed by the NotificationHandler to send emails.
 */
event StepApprovalCreated {
    stepApprovalId : UUID;
    stepId         : UUID;
    requestId      : UUID;
}
