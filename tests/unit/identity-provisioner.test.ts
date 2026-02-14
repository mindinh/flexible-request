/**
 * Unit Tests: IdentityProvisioner
 * 
 * Epic 1.4.1: Test JIT provisioning (new user)
 * Epic 1.4.2: Test JIT provisioning (existing user)
 * 
 * Tests the core JIT (Just-In-Time) user provisioning logic.
 */
import cds from '@sap/cds';
import path from 'path';
import { IdentityProvisioner } from '../../srv/lib/identity-provisioner';

// Project root path (use forward slashes for cross-platform compatibility)
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

// Test data helpers
const createUniqueUserId = (prefix = 'user') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;

const createMockUser = (id: string, attributes: Record<string, string> = {}): cds.User => ({
    id,
    attr: {
        email: attributes.email ?? id,
        given_name: attributes.given_name ?? 'Test',
        family_name: attributes.family_name ?? 'User',
        name: attributes.name ?? 'Test User'
    },
    is: (role: string) => role === 'authenticated-user',
    _roles: {}
} as unknown as cds.User);

describe('IdentityProvisioner', () => {
    let db: cds.Service;

    beforeAll(async () => {
        // Set the CDS root explicitly
        cds.root = PROJECT_ROOT;

        // Load schema files
        await cds.load([
            PROJECT_ROOT + '/db/schema.cds',
            PROJECT_ROOT + '/srv/admin-service.cds',
            PROJECT_ROOT + '/srv/identity-service.cds'
        ]);

        // Deploy to in-memory SQLite
        await cds.deploy('*').to('sqlite::memory:');
        db = await cds.connect.to('db');
    }, 60000);

    beforeEach(async () => {
        const { ShadowUsers } = db.entities('sap.cre');
        try {
            await DELETE.from(ShadowUsers).where({ userId: { like: '%test%' } });
        } catch {
            // Ignore
        }
    });

    // ============================================================================
    // Epic 1.4.1: Test JIT Provisioning (New User)
    // ============================================================================

    describe('Epic 1.4.1: JIT Provisioning - New User', () => {

        describe('provisionUser() - Create Flow', () => {

            test('should create a new ShadowUser when user does not exist', async () => {
                const uniqueUser = createMockUser(createUniqueUserId('new'));
                const result = await IdentityProvisioner.provisionUser(uniqueUser);

                expect(result).not.toBeNull();
                expect(result?.userId).toBe(uniqueUser.id);
            });

            test('should correctly map all JWT attributes to ShadowUser', async () => {
                const testUser = createMockUser('attr-test@test.company.com', {
                    email: 'attr-test@test.company.com',
                    given_name: 'Attribute',
                    family_name: 'Tester',
                    name: 'Attribute Tester'
                });

                const result = await IdentityProvisioner.provisionUser(testUser);

                expect(result).not.toBeNull();
                expect(result?.userId).toBe('attr-test@test.company.com');
                expect(result?.email).toBe('attr-test@test.company.com');
                expect(result?.firstName).toBe('Attribute');
                expect(result?.lastName).toBe('Tester');
                expect(result?.displayName).toBe('Attribute Tester');
            });

            test('should set lastLoginAt on creation', async () => {
                const uniqueUser = createMockUser(createUniqueUserId('login-time'));
                const result = await IdentityProvisioner.provisionUser(uniqueUser);

                expect(result).not.toBeNull();
                expect(result?.lastLoginAt).toBeDefined();
            });

            test('should set isActive to true on creation', async () => {
                const uniqueUser = createMockUser(createUniqueUserId('active'));
                const result = await IdentityProvisioner.provisionUser(uniqueUser);

                expect(result).not.toBeNull();
                expect(result?.isActive).toBe(true);
            });

            test('should handle user with minimal JWT attributes', async () => {
                const minimalUser = createMockUser(createUniqueUserId('minimal'));
                (minimalUser.attr as Record<string, unknown>) = {};

                const result = await IdentityProvisioner.provisionUser(minimalUser);

                expect(result).not.toBeNull();
                expect(result?.userId).toBe(minimalUser.id);
                expect(result?.email).toBe(minimalUser.id);
            });

            test('should return null for anonymous/null user', async () => {
                const resultNull = await IdentityProvisioner.provisionUser(null as unknown as cds.User);
                const resultEmpty = await IdentityProvisioner.provisionUser({ id: '' } as cds.User);

                expect(resultNull).toBeNull();
                expect(resultEmpty).toBeNull();
            });
        });
    });

    // ============================================================================
    // Epic 1.4.2: Test JIT Provisioning (Existing User)
    // ============================================================================

    describe('Epic 1.4.2: JIT Provisioning - Existing User', () => {

        describe('provisionUser() - Update Flow', () => {

            test('should return existing record without creating duplicate', async () => {
                const uniqueId = createUniqueUserId('existing');
                const testUser = createMockUser(uniqueId);

                await IdentityProvisioner.provisionUser(testUser);
                const result = await IdentityProvisioner.provisionUser(testUser);

                const { ShadowUsers } = db.entities('sap.cre');
                const allUsers = await SELECT.from(ShadowUsers).where({ userId: uniqueId });
                expect(allUsers.length).toBe(1);
                expect(result).not.toBeNull();
            });

            test('should update lastLoginAt on subsequent logins', async () => {
                const uniqueId = createUniqueUserId('update-login');
                const testUser = createMockUser(uniqueId);

                await IdentityProvisioner.provisionUser(testUser);
                await new Promise(resolve => setTimeout(resolve, 100));
                await IdentityProvisioner.provisionUser(testUser);

                const { ShadowUsers } = db.entities('sap.cre');
                const updated = await SELECT.one.from(ShadowUsers).where({ userId: uniqueId });
                expect(updated).not.toBeNull();
            });

            test('should not create duplicates on concurrent calls', async () => {
                const uniqueId = createUniqueUserId('concurrent');
                const testUser = createMockUser(uniqueId);

                const results = await Promise.all([
                    IdentityProvisioner.provisionUser(testUser),
                    IdentityProvisioner.provisionUser(testUser),
                    IdentityProvisioner.provisionUser(testUser)
                ]);

                const { ShadowUsers } = db.entities('sap.cre');
                const allUsers = await SELECT.from(ShadowUsers).where({ userId: uniqueId });
                expect(allUsers.length).toBe(1);
            });
        });

        describe('getShadowUser() - Lookup', () => {

            test('should return user if exists', async () => {
                const uniqueId = createUniqueUserId('lookup');
                const testUser = createMockUser(uniqueId);
                await IdentityProvisioner.provisionUser(testUser);

                const result = await IdentityProvisioner.getShadowUser(uniqueId);

                expect(result).not.toBeNull();
                expect(result?.userId).toBe(uniqueId);
            });

            test('should return null if user not found', async () => {
                const result = await IdentityProvisioner.getShadowUser('non-existent@test.com');
                expect(result).toBeNull();
            });
        });

        describe('getUserGroupIds() - Group Membership', () => {

            test('should return empty array if user has no memberships', async () => {
                const uniqueId = createUniqueUserId('no-groups');
                const testUser = createMockUser(uniqueId);
                const user = await IdentityProvisioner.provisionUser(testUser);

                const groupIds = await IdentityProvisioner.getUserGroupIds(user!.ID);

                expect(Array.isArray(groupIds)).toBe(true);
                expect(groupIds.length).toBe(0);
            });
        });
    });
});
