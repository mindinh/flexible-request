/**
 * Unit Tests: OrgHierarchyHandler
 */
import cds from '@sap/cds';
import path from 'path';
import { OrgHierarchyHandler } from '../../srv/handlers/admin/OrgHierarchyHandler';

// Project root with forward slashes for Windows compatibility
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

// Helper to create unique IDs
const createUniqueId = () => crypto.randomUUID();

describe('OrgHierarchyHandler', () => {
    let db: cds.Service;
    let handler: OrgHierarchyHandler;

    beforeAll(async () => {
        cds.root = PROJECT_ROOT;

        await cds.load([
            PROJECT_ROOT + '/db/schema.cds',
            PROJECT_ROOT + '/srv/admin-service.cds',
            PROJECT_ROOT + '/srv/identity-service.cds'
        ]);

        await cds.deploy('*').to('sqlite::memory:');
        db = await cds.connect.to('db');
        handler = new OrgHierarchyHandler(db);
    }, 60000);

    // ============================================================================
    // Test Data Setup Helpers
    // ============================================================================

    async function createTestUser() {
        const { ShadowUsers } = db.entities('sap.cre');
        const userId = createUniqueId();
        const uniqueEmail = `user-${userId}@test.com`;
        await INSERT.into(ShadowUsers).entries({
            ID: userId,
            userId: uniqueEmail,
            email: uniqueEmail,
            isActive: true
        });
        return userId;
    }

    async function createTestGroup() {
        const { SupportTypes, ShadowGroups } = db.entities('sap.cre');
        const typeId = createUniqueId();
        await INSERT.into(SupportTypes).entries({
            ID: typeId,
            code: createUniqueId().substring(0, 10),
            name: `Test Type`,
            isEnabled: true
        });

        const groupId = createUniqueId();
        await INSERT.into(ShadowGroups).entries({
            ID: groupId,
            name: `Test Group ${Date.now()}`,
            type_ID: typeId
        });
        return groupId;
    }

    async function clearHierarchies() {
        const { OrgHierarchies } = db.entities('sap.cre');
        await DELETE.from(OrgHierarchies);
    }

    beforeEach(async () => {
        await clearHierarchies();
    });

    // ============================================================================
    // Tests
    // ============================================================================

    describe('Validation', () => {
        it('should require parentType and childType', async () => {
            const userA = await createTestUser();
            const userB = await createTestUser();

            const req = {
                data: {
                    ID: createUniqueId(),
                    parentType: 'USER',
                    parentUser_ID: userA,
                    childUser_ID: userB
                },
                event: 'CREATE',
                error: (code: any, msg: any) => { throw new Error(msg); }
            };

            try {
                await handler['validateHierarchy'](req as any);
                fail('Should have thrown an error');
            } catch (e: any) {
                expect(e.message).toContain('parentType and childType are required');
            }
        });

        it('should validate parentType and childType values', async () => {
            const userA = await createTestUser();
            const userB = await createTestUser();

            const req = {
                data: {
                    ID: createUniqueId(),
                    parentType: 'INVALID',
                    childType: 'USER',
                    parentUser_ID: userA,
                    childUser_ID: userB
                },
                event: 'CREATE',
                error: (code: any, msg: any) => { throw new Error(msg); }
            };

            try {
                await handler['validateHierarchy'](req as any);
                fail('Should have thrown an error');
            } catch (e: any) {
                expect(e.message).toContain('parentType must be USER or GROUP');
            }
        });

        it('should prevent self-reference', async () => {
            const userA = await createTestUser();

            const req = {
                data: {
                    ID: createUniqueId(),
                    parentType: 'USER',
                    childType: 'USER',
                    parentUser_ID: userA,
                    childUser_ID: userA
                },
                event: 'CREATE',
                error: (code: any, msg: any) => { throw new Error(msg); }
            };

            try {
                await handler['validateHierarchy'](req as any);
                fail('Should have thrown an error');
            } catch (e: any) {
                expect(e.message).toContain('self-reference is not allowed');
            }
        });
    });

    describe('Cycle Detection', () => {
        it('should prevent immediate cycles (A -> B -> A)', async () => {
            const { OrgHierarchies } = db.entities('sap.cre');
            const userA = await createTestUser();
            const userB = await createTestUser();

            // A -> B
            await INSERT.into(OrgHierarchies).entries({
                ID: createUniqueId(),
                parentType: 'USER',
                childType: 'USER',
                parentUser_ID: userA,
                childUser_ID: userB
            });

            const req = {
                data: {
                    ID: createUniqueId(),
                    parentType: 'USER',
                    childType: 'USER',
                    parentUser_ID: userB,
                    childUser_ID: userA
                },
                event: 'CREATE',
                error: (code: any, msg: any) => { throw new Error(msg); }
            };

            // B -> A should fail
            try {
                await handler['validateHierarchy'](req as any);
                fail('Should have thrown an error');
            } catch (e: any) {
                expect(e.message).toContain('Immediate circular reference detected');
            }
        });

        it('should prevent deep cycles (A -> B -> C -> A)', async () => {
            const { OrgHierarchies } = db.entities('sap.cre');
            const userA = await createTestUser();
            const groupB = await createTestGroup();
            const groupC = await createTestGroup();

            // A -> B
            await INSERT.into(OrgHierarchies).entries({
                ID: createUniqueId(),
                parentType: 'USER',
                childType: 'GROUP',
                parentUser_ID: userA,
                childGroup_ID: groupB
            });

            // B -> C
            await INSERT.into(OrgHierarchies).entries({
                ID: createUniqueId(),
                parentType: 'GROUP',
                childType: 'GROUP',
                parentGroup_ID: groupB,
                childGroup_ID: groupC
            });

            const req = {
                data: {
                    ID: createUniqueId(),
                    parentType: 'GROUP',
                    childType: 'USER',
                    parentGroup_ID: groupC,
                    childUser_ID: userA
                },
                event: 'CREATE',
                error: (code: any, msg: any) => { throw new Error(msg); }
            };

            // C -> A should fail
            try {
                await handler['validateHierarchy'](req as any);
                fail('Should have thrown an error');
            } catch (e: any) {
                expect(e.message).toContain('Circular reference detected');
            }
        });

        it('should allow building deep hierarchies without cycles', async () => {
            const { OrgHierarchies } = db.entities('sap.cre');
            const userA = await createTestUser();
            const groupB = await createTestGroup();
            const groupC = await createTestGroup();
            const groupD = await createTestGroup();

            // A -> B -> C -> D
            const req1 = {
                data: { ID: createUniqueId(), parentType: 'USER', childType: 'GROUP', parentUser_ID: userA, childGroup_ID: groupB },
                event: 'CREATE', error: (code: any, msg: any) => { throw new Error(msg); }
            };
            await handler['validateHierarchy'](req1 as any);
            await INSERT.into(OrgHierarchies).entries(req1.data);

            const req2 = {
                data: { ID: createUniqueId(), parentType: 'GROUP', childType: 'GROUP', parentGroup_ID: groupB, childGroup_ID: groupC },
                event: 'CREATE', error: (code: any, msg: any) => { throw new Error(msg); }
            };
            await handler['validateHierarchy'](req2 as any);
            await INSERT.into(OrgHierarchies).entries(req2.data);

            const req3 = {
                data: { ID: createUniqueId(), parentType: 'GROUP', childType: 'GROUP', parentGroup_ID: groupC, childGroup_ID: groupD },
                event: 'CREATE', error: (code: any, msg: any) => { throw new Error(msg); }
            };
            await handler['validateHierarchy'](req3 as any);
            await INSERT.into(OrgHierarchies).entries(req3.data);

            // Verification that it didn't throw
            const count = await SELECT.from('sap.cre.OrgHierarchies');
            expect(count.length).toBe(3);
        });

        it('should not false positive if A->B and A->C and C->B is added', async () => {
            // Wait, A->B, A->C, C->B is not a cycle. It's just a DAG where A is ancestor of B twice.
            const { OrgHierarchies } = db.entities('sap.cre');
            const a = await createTestGroup();
            const b = await createTestGroup();
            const c = await createTestGroup();

            await INSERT.into(OrgHierarchies).entries({ ID: createUniqueId(), parentType: 'GROUP', childType: 'GROUP', parentGroup_ID: a, childGroup_ID: b });
            await INSERT.into(OrgHierarchies).entries({ ID: createUniqueId(), parentType: 'GROUP', childType: 'GROUP', parentGroup_ID: a, childGroup_ID: c });

            // C->B
            const req = {
                data: { ID: createUniqueId(), parentType: 'GROUP', childType: 'GROUP', parentGroup_ID: c, childGroup_ID: b },
                event: 'CREATE', error: (code: any, msg: any) => { throw new Error(msg); }
            };
            await handler['validateHierarchy'](req as any);
            await INSERT.into(OrgHierarchies).entries(req.data);

            const count = await SELECT.from('sap.cre.OrgHierarchies');
            expect(count.length).toBe(3);
        });
    });
});
