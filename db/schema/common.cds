namespace sap.cre;

using { sap.cre.ShadowUsers } from './identity';

// ----------------------------------------------------------------------------
// Custom Managed Aspect with UUID-Based User References
// ----------------------------------------------------------------------------

/**
 * Custom managed aspect that uses UUID references to ShadowUsers
 * instead of the default string-based user IDs.
 * 
 * This provides:
 * - Referential integrity (FK to ShadowUsers)
 * - Easy JOINs for display name resolution
 * - Consistent with ownerId/principalId pattern
 * 
 * The handler (ManagedUserHandler) automatically resolves the user UUID
 * from req.user.id on CREATE/UPDATE operations.
 */
aspect managedWithUser {
    createdAt  : Timestamp @cds.on.insert: $now;
    createdBy  : Association to ShadowUsers;
    modifiedAt : Timestamp @cds.on.insert: $now @cds.on.update: $now;
    modifiedBy : Association to ShadowUsers;
}
