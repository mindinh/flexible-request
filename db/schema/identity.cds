namespace sap.cre;

using {
    cuid,
    managed
} from '@sap/cds/common';

// ----------------------------------------------------------------------------
// Identity & Authorization Entities (Shadow Directory)
// Reference: docs/concepts/authorization-and-roles/solution-design.md
// ----------------------------------------------------------------------------

/**
 * Configuration of supported principal types.
 * Admins can enable/disable types based on organizational needs.
 *
 * Examples: USER, GROUP, TEAM, DEPARTMENT, ROLE, POSITION
 */
entity SupportTypes : cuid, managed {
    code        : String(20) not null; // USER, GROUP, DEPARTMENT, TEAM, ROLE, POSITION
    name        : String(50) not null; // Display name
    isEnabled   : Boolean default true; // Toggle availability in UI
    description : String; // Optional description
    icon        : String(50); // UI icon identifier (e.g., 'person', 'group')
    sortOrder   : Integer default 0; // Display order in dropdowns
}

/**
 * Shadow table for Users.
 * Auto-populated via JIT (Just-In-Time) provisioning on login.
 * NEVER manually created - always synced from IDP (IAS/XSUAA).
 *
 * Composite unique key enforced: (origin, userId)
 */
@assert.unique: {idpIdentity: [
    origin,
    userId
]}
entity ShadowUsers : cuid, managed {
    // IDP Identity (Composite Unique Key: origin + userId)
    origin      : String(100) default 'sap.default'; // IDP origin (e.g., 'sap.default', 'azure-ad', 'custom-idp')
    userId      : String(100) not null; // IDP Subject ID (preferred) or Email
    idpUserId   : String(100); // Stable IDP user UUID (user_uuid from JWT) - never changes even if email changes

    email       : String(255); // User's email address
    firstName   : String(100); // First name from IDP
    lastName    : String(100); // Last name from IDP
    displayName : String(255); // Full display name
    isActive    : Boolean default true; // Set to false when user leaves org
    lastLoginAt : Timestamp; // Track activity for cleanup

    // Associations
    memberships : Association to many GroupMembers
                      on memberships.user = $self;
}

/**
 * Local Groups (Teams, Departments, Roles, etc.)
 * Created and managed by Business Admins via Studio UI.
 */
entity ShadowGroups : cuid, managed {
    name        : String(100) not null; // Group display name
    description : String; // Optional description

    // Type linked to SupportTypes for strict consistency
    type        : Association to SupportTypes not null;

    // Optional: External ID for sync with IAS/HR systems
    externalId  : String(255);

    isActive    : Boolean default true; // Soft delete support

    // Associations
    members     : Composition of many GroupMembers
                      on members.group = $self;
}

/**
 * Many-to-Many link between Users and Groups.
 * Tracks group membership with audit information.
 */
entity GroupMembers : cuid, managed {
    user       : Association to ShadowUsers not null; // The user
    group      : Association to ShadowGroups not null; // The group

    // Optional: Role within the group (e.g., "LEAD", "MEMBER")
    memberRole : String(50) default 'MEMBER';

    // Track how membership was created (MANUAL, SAML, HR_SYNC)
    // SAML memberships are auto-synced on login (added/removed based on IDP claims)
    source     : String(20) default 'MANUAL';

    // Audit: Who added this member and when
    addedBy    : Association to ShadowUsers;
    addedAt    : Timestamp;
}

/**
 * Mapping between external SAML groups and local ShadowGroups.
 * Admin configures these mappings once, then users are auto-assigned on login.
 *
 * When a user logs in:
 * - If their JWT contains a SAML group that is mapped, they are added to the local group
 * - If their JWT no longer contains a SAML group, they are removed (only SAML-sourced memberships)
 */
entity SamlGroupMappings : cuid, managed {
    externalGroupName : String(255) not null; // SAML group name (e.g., "CNMA_CUST_PURCHASER")
    localGroup        : Association to ShadowGroups not null;
    isEnabled         : Boolean default true; // Toggle mapping on/off
    description       : String; // Optional notes for admins
}

/**
 * Organization Hierarchies
 * Defines parent-child relationships between Users and Groups.
 * Supports building arbitrary reporting and org structures.
 */
entity OrgHierarchies : cuid, managed {
    parentType    : String(20) not null; // 'USER' or 'GROUP'
    childType     : String(20) not null; // 'USER' or 'GROUP'

    // Explicit associations based on type
    parentUser    : Association to ShadowUsers;
    parentGroup   : Association to ShadowGroups;
    childUser     : Association to ShadowUsers;
    childGroup    : Association to ShadowGroups;

    // Relationship Metadata
    relationship  : String(100); // e.g., 'Direct Report', 'Matrix Manager'
    accessLevel   : String(50) default 'View Only'; // e.g., 'View Only', 'Full Access'
    effectiveDate : Date; // Date when relationship becomes active
}
