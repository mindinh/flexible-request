/**
 * TypeScript interfaces for Shadow Directory entities.
 * These map to the CDS entities defined in db/schema/identity.cds
 */

/**
 * Principal Types configuration.
 * Controls which types of principals can be assigned to workflow roles.
 */
export interface SupportType {
    ID: string;
    code: string;
    name: string;
    description?: string;
    icon?: string;
    isEnabled: boolean;
    sortOrder: number;
    createdAt?: string;
    modifiedAt?: string;
}

/**
 * Shadow User - Auto-provisioned via JIT on login.
 * Represents a user in the local Shadow Directory.
 */
export interface ShadowUser {
    ID: string;
    origin?: string;  // IDP origin (e.g., 'sap.default', 'azure-ad')
    userId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    isActive: boolean;
    lastLoginAt?: string;
    createdAt?: string;
    modifiedAt?: string;
}

/**
 * Shadow Group - Local groups managed by Business Admins.
 * Can represent Teams, Departments, Roles, etc.
 */
export interface ShadowGroup {
    ID: string;
    name: string;
    description?: string;
    type_ID: string;
    type?: SupportType;
    externalId?: string;
    isActive: boolean;
    members?: GroupMember[];
    createdAt?: string;
    modifiedAt?: string;
}

/**
 * Group Member - Links Users to Groups.
 */
export interface GroupMember {
    ID: string;
    user_ID: string;
    user?: ShadowUser;
    group_ID: string;
    group?: ShadowGroup;
    memberRole?: string;
    addedBy?: string;
    addedAt?: string;
}
