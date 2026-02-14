using { sap.cre as db } from '../db/schema';

/**
 * Identity Service - Exposes Shadow Directory for user/group resolution.
 * 
 * Used by:
 * - PrincipalSelect UI component (search users/groups)
 * - Workflow engine (resolve group members)
 * - Inbox queries (filter by group membership)
 */
service IdentityService @(path: '/identity') {

    // Principal Types (read-only, filtered to enabled types)
    @readonly 
    entity SupportTypes as projection on db.SupportTypes
        where isEnabled = true
        order by sortOrder asc;
    
    // Users (read-only, everyone can search)
    @readonly 
    entity ShadowUsers as projection on db.ShadowUsers
        where isActive = true;
    
    // Groups (read-only, everyone can search) 
    @readonly 
    entity ShadowGroups as projection on db.ShadowGroups
        where isActive = true;
    
    // Group Members (read-only)
    @readonly 
    entity GroupMembers as projection on db.GroupMembers;
    
    // Get current user's ShadowUser record
    function me() returns ShadowUsers;
    
    // Resolve all users in a group (for approval resolution)
    function resolveGroupMembers(groupId: UUID) returns array of ShadowUsers;
    
    // Get groups that a user belongs to
    function getUserGroups(userId: UUID) returns array of ShadowGroups;
}
