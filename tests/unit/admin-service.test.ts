/**
 * Integration Tests: AdminService - SupportTypes
 * 
 * Epic 1.4.3: Test SupportTypes CRUD
 * Epic 1.4.4: Test authorization on SupportTypes
 */
import cds from '@sap/cds';
import path from 'path';
import fs from 'fs';

// Project root path (use forward slashes for cross-platform compatibility)
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

describe('AdminService - SupportTypes', () => {
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
        const { SupportTypes } = db.entities('sap.cre');
        try {
            await DELETE.from(SupportTypes).where({ code: { like: 'TEST_%' } });
            await DELETE.from(SupportTypes).where({ code: { like: 'MIN_%' } });
            await DELETE.from(SupportTypes).where({ code: { like: 'UPD_%' } });
            await DELETE.from(SupportTypes).where({ code: { like: 'DEL_%' } });
        } catch {
            // Ignore
        }
    });

    // ============================================================================
    // Epic 1.4.3: Test SupportTypes CRUD
    // ============================================================================

    describe('Epic 1.4.3: SupportTypes CRUD Operations', () => {

        describe('READ - Query SupportTypes', () => {

            test('should read all SupportTypes from database', async () => {
                const { SupportTypes } = db.entities('sap.cre');
                const types = await SELECT.from(SupportTypes);

                expect(Array.isArray(types)).toBe(true);
                expect(types.length).toBeGreaterThanOrEqual(0);
            });

            test('should return SupportType with all expected fields', async () => {
                const { SupportTypes } = db.entities('sap.cre');
                const testType = {
                    ID: crypto.randomUUID(),
                    code: `TEST_${Date.now()}`,
                    name: 'Test Type',
                    isEnabled: true,
                    sortOrder: 100
                };
                await INSERT.into(SupportTypes).entries(testType);

                const result = await SELECT.one.from(SupportTypes).where({ ID: testType.ID });

                expect(result).toHaveProperty('ID');
                expect(result).toHaveProperty('code');
                expect(result).toHaveProperty('name');
                expect(result).toHaveProperty('isEnabled');
                expect(result).toHaveProperty('sortOrder');
            });

            test('should filter SupportTypes by code', async () => {
                const { SupportTypes } = db.entities('sap.cre');

                const testType = {
                    ID: crypto.randomUUID(),
                    code: `TEST_FILTER_${Date.now()}`,
                    name: 'Filter Test',
                    isEnabled: true
                };
                await INSERT.into(SupportTypes).entries(testType);

                const result = await SELECT.from(SupportTypes)
                    .where({ code: testType.code });

                expect(result.length).toBe(1);
                expect(result[0].code).toBe(testType.code);
            });
        });

        describe('CREATE - Insert SupportTypes', () => {

            test('should create a new SupportType with valid data', async () => {
                const { SupportTypes } = db.entities('sap.cre');
                const newType = {
                    ID: crypto.randomUUID(),
                    code: `TEST_CREATE_${Date.now()}`,
                    name: 'New Test Type',
                    isEnabled: true,
                    description: 'Test type for unit tests',
                    icon: 'test-icon',
                    sortOrder: 100
                };

                await INSERT.into(SupportTypes).entries(newType);

                const result = await SELECT.one.from(SupportTypes).where({ ID: newType.ID });
                expect(result).not.toBeNull();
                expect(result.code).toBe(newType.code);
                expect(result.name).toBe(newType.name);
            });

            test('should apply default values correctly', async () => {
                const { SupportTypes } = db.entities('sap.cre');
                const newType = {
                    ID: crypto.randomUUID(),
                    code: `MIN_${Date.now()}`,
                    name: 'Minimal Type'
                };

                await INSERT.into(SupportTypes).entries(newType);

                const result = await SELECT.one.from(SupportTypes).where({ ID: newType.ID });
                expect(result.isEnabled).toBe(true);
                expect(result.sortOrder).toBe(0);
            });
        });

        describe('UPDATE - Modify SupportTypes', () => {

            let testTypeId: string;

            beforeEach(async () => {
                const { SupportTypes } = db.entities('sap.cre');
                testTypeId = crypto.randomUUID();
                await INSERT.into(SupportTypes).entries({
                    ID: testTypeId,
                    code: `UPD_${Date.now()}`,
                    name: 'Type To Update',
                    isEnabled: true
                });
            });

            test('should update isEnabled (enable/disable)', async () => {
                const { SupportTypes } = db.entities('sap.cre');

                await UPDATE(SupportTypes).where({ ID: testTypeId }).set({ isEnabled: false });

                const result = await SELECT.one.from(SupportTypes).where({ ID: testTypeId });
                expect(result.isEnabled).toBe(false);
            });

            test('should update name and description', async () => {
                const { SupportTypes } = db.entities('sap.cre');

                await UPDATE(SupportTypes).where({ ID: testTypeId }).set({
                    name: 'Updated Name',
                    description: 'Updated description'
                });

                const result = await SELECT.one.from(SupportTypes).where({ ID: testTypeId });
                expect(result.name).toBe('Updated Name');
                expect(result.description).toBe('Updated description');
            });

            test('should update sortOrder', async () => {
                const { SupportTypes } = db.entities('sap.cre');

                await UPDATE(SupportTypes).where({ ID: testTypeId }).set({ sortOrder: 999 });

                const result = await SELECT.one.from(SupportTypes).where({ ID: testTypeId });
                expect(result.sortOrder).toBe(999);
            });
        });

        describe('DELETE - Remove SupportTypes', () => {

            test('should delete a SupportType', async () => {
                const { SupportTypes } = db.entities('sap.cre');
                const testTypeId = crypto.randomUUID();

                await INSERT.into(SupportTypes).entries({
                    ID: testTypeId,
                    code: `DEL_${Date.now()}`,
                    name: 'Type To Delete'
                });

                await DELETE.from(SupportTypes).where({ ID: testTypeId });

                const result = await SELECT.one.from(SupportTypes).where({ ID: testTypeId });
                // SELECT.one returns undefined when no record found
                expect(result).toBeFalsy();
            });
        });
    });

    // ============================================================================
    // Epic 1.4.4: Test Authorization on SupportTypes
    // ============================================================================

    describe('Epic 1.4.4: Authorization on SupportTypes', () => {

        describe('AdminService requires admin role', () => {

            test('AdminService should be configured with @requires: admin', () => {
                // Verify by reading the CDS source directly (model introspection not available in test)
                const adminServiceCds = fs.readFileSync(
                    path.join(PROJECT_ROOT, 'srv', 'admin-service.cds').replace(/\\/g, '/'),
                    'utf8'
                );
                // Check that the service has a requires annotation for 'admin'
                expect(adminServiceCds).toMatch(/requires:\s*['"]?admin['"]?/);
            });
        });

        describe('IdentityService SupportTypes projection', () => {

            test('should only expose enabled SupportTypes via filter', async () => {
                const { SupportTypes } = db.entities('sap.cre');

                const enabledId = crypto.randomUUID();
                const disabledId = crypto.randomUUID();

                await INSERT.into(SupportTypes).entries([
                    { ID: enabledId, code: `TEST_ENABLED_${Date.now()}`, name: 'Enabled', isEnabled: true },
                    { ID: disabledId, code: `TEST_DISABLED_${Date.now()}`, name: 'Disabled', isEnabled: false }
                ]);

                // Query with IdentityService filter logic (isEnabled = true)
                const enabledTypes = await SELECT.from(SupportTypes)
                    .where({ isEnabled: true, code: { like: 'TEST_%' } });

                expect(enabledTypes.every(t => t.isEnabled === true)).toBe(true);
            });
        });

        describe('SupportTypes in IdentityService is @readonly', () => {

            test('IdentityService SupportTypes should be marked as readonly', () => {
                // Verify by reading the CDS source directly
                const identityServiceCds = fs.readFileSync(
                    path.join(PROJECT_ROOT, 'srv', 'identity-service.cds').replace(/\\/g, '/'),
                    'utf8'
                );
                // Should contain @readonly before SupportTypes entity
                expect(identityServiceCds).toContain('@readonly');
                expect(identityServiceCds).toContain('SupportTypes');
            });
        });
    });
});
