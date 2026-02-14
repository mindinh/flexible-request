/**
 * Test Fixtures for Identity & Authorization Tests
 * 
 * Provides mock users, JWT attributes, and test data for unit tests.
 */
import cds from '@sap/cds';

// ============================================================================
// Mock CAP Users (simulating JWT claims)
// ============================================================================

/**
 * Mock admin user with full Administrator role.
 * Simulates a user authenticated via XSUAA/IAS with admin privileges.
 */
export const mockAdminUser: cds.User = {
    id: 'alice@test.company.com',
    attr: {
        email: 'alice@test.company.com',
        given_name: 'Alice',
        family_name: 'Admin',
        name: 'Alice Admin'
    },
    is: (role: string) => role === 'admin' || role === 'authenticated-user',
    _roles: {}
} as unknown as cds.User;

/**
 * Mock regular user without admin role.
 * Has 'approver' and 'authenticated-user' roles.
 */
export const mockRegularUser: cds.User = {
    id: 'bob@test.company.com',
    attr: {
        email: 'bob@test.company.com',
        given_name: 'Bob',
        family_name: 'Approver',
        name: 'Bob Approver'
    },
    is: (role: string) => role === 'approver' || role === 'authenticated-user',
    _roles: {}
} as unknown as cds.User;

/**
 * Mock new user (first time login).
 * Does not exist in ShadowUsers yet.
 */
export const mockNewUser: cds.User = {
    id: 'charlie@test.company.com',
    attr: {
        email: 'charlie@test.company.com',
        given_name: 'Charlie',
        family_name: 'New',
        name: 'Charlie New'
    },
    is: (role: string) => role === 'authenticated-user',
    _roles: {}
} as unknown as cds.User;

/**
 * Mock user with minimal JWT attributes (edge case).
 * Only has id, no additional attributes.
 */
export const mockMinimalUser: cds.User = {
    id: 'minimal@test.company.com',
    attr: {},
    is: (role: string) => role === 'authenticated-user',
    _roles: {}
} as unknown as cds.User;

// ============================================================================
// Test Data: SupportTypes
// ============================================================================

/**
 * Valid SupportType for creation tests.
 */
export const mockSupportType = {
    code: 'TEST_TYPE',
    name: 'Test Type',
    isEnabled: true,
    description: 'Test type for unit tests',
    icon: 'test-icon',
    sortOrder: 100
};

/**
 * Seed data matching db/data/sap.cre-SupportTypes.csv
 */
export const defaultSupportTypes = [
    { code: 'USER', name: 'Individual User', isEnabled: true, sortOrder: 1 },
    { code: 'GROUP', name: 'Custom Group', isEnabled: true, sortOrder: 2 },
    { code: 'TEAM', name: 'Team', isEnabled: true, sortOrder: 3 },
    { code: 'DEPARTMENT', name: 'Department', isEnabled: true, sortOrder: 4 },
    { code: 'ROLE', name: 'Business Role', isEnabled: true, sortOrder: 5 },
    { code: 'POSITION', name: 'Position', isEnabled: false, sortOrder: 6 }
];

// ============================================================================
// Test Data: ShadowUsers
// ============================================================================

/**
 * Existing ShadowUser record for update tests.
 */
export const existingShadowUser = {
    userId: 'alice@test.company.com',
    email: 'alice@test.company.com',
    firstName: 'Alice',
    lastName: 'Admin',
    displayName: 'Alice Admin',
    isActive: true,
    lastLoginAt: new Date('2026-01-01T10:00:00Z')
};

// ============================================================================
// Test Data: ShadowGroups
// ============================================================================

/**
 * Test group for membership tests.
 */
export const mockShadowGroup = {
    name: 'Test Team',
    description: 'A test team for unit tests',
    externalId: null,
    isActive: true
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a unique user ID for isolated tests.
 */
export function createUniqueUserId(prefix = 'user'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
}

/**
 * Create a mock user with a unique ID.
 */
export function createMockUser(id: string, attributes: Record<string, string> = {}): cds.User {
    return {
        id,
        attr: {
            email: attributes.email ?? id,
            given_name: attributes.given_name ?? 'Test',
            family_name: attributes.family_name ?? 'User',
            name: attributes.name ?? 'Test User'
        },
        is: (role: string) => role === 'authenticated-user',
        _roles: {}
    } as unknown as cds.User;
}
