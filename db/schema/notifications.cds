namespace sap.cre;

using {cuid} from '@sap/cds/common';
using {sap.cre.ShadowUsers} from './identity';
using {sap.cre.Requests} from '../schema';

// ----------------------------------------------------------------------------
// In-App Notifications
// ----------------------------------------------------------------------------

/**
 * Stores in-app notification records for the Bell icon.
 * Created automatically when workflow tasks are assigned.
 */
entity Notifications : cuid {
    recipient   : Association to ShadowUsers @mandatory;  // Target user
    title       : String(120) @mandatory;                 // e.g., "Approval Required"
    message     : String(500);                            // e.g., "PRC #002045 needs your approval"
    type        : String(100) default 'APPROVAL'; // stores icon name or type
    priority    : String enum {
        HIGH;
        MEDIUM;
        LOW;
    } default 'MEDIUM';
    isRead      : Boolean default false;
    request     : Association to Requests;                // Link to related request
    stepId      : UUID;                                   // Related step ID for deep-linking
    createdAt   : Timestamp @cds.on.insert: $now;
    role        : String(30);                             // e.g., "Approver", "Step Owner"
}
