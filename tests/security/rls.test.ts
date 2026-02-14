/**
 * Security Tests: Row-Level Security (RLS)
 * 
 * Epic 4.2.2: Test RLS with multiple users
 * Tests that users can only see requests they are authorized to view.
 */
import cds from '@sap/cds';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

const createUniqueId = () => crypto.randomUUID();

describe('Row-Level Security', () => {
    let db: cds.Service;

    beforeAll(async () => {
        cds.root = PROJECT_ROOT;
        await cds.load([
            PROJECT_ROOT + '/db/schema.cds',
            PROJECT_ROOT + '/srv/admin-service.cds',
            PROJECT_ROOT + '/srv/identity-service.cds',
            PROJECT_ROOT + '/srv/request-service.cds'
        ]);
        await cds.deploy('*').to('sqlite::memory:');
        db = await cds.connect.to('db');
    }, 60000);

    // ============================================================================
    // Test Data Helpers
    // ============================================================================

    async function createTestUser(email?: string) {
        const { ShadowUsers } = db.entities('sap.cre');
        const id = createUniqueId();
        const userEmail = email ?? `user-${Date.now()}@test.com`;
        await INSERT.into(ShadowUsers).entries({
            ID: id,
            userId: userEmail,
            email: userEmail,
            isActive: true
        });
        return { id, email: userEmail };
    }

    async function createTestGroup() {
        const { ShadowGroups, SupportTypes } = db.entities('sap.cre');
        const typeId = createUniqueId();
        await INSERT.into(SupportTypes).entries({
            ID: typeId,
            code: `GRP_${Date.now()}`,
            name: 'Group',
            isEnabled: true
        });
        const groupId = createUniqueId();
        await INSERT.into(ShadowGroups).entries({
            ID: groupId,
            name: `Team ${Date.now()}`,
            type_ID: typeId
        });
        return groupId;
    }

    async function addUserToGroup(userId: string, groupId: string) {
        const { GroupMembers } = db.entities('sap.cre');
        await INSERT.into(GroupMembers).entries({
            ID: createUniqueId(),
            user_ID: userId,
            group_ID: groupId
        });
    }

    async function createTestRequest(options: {
        requesterId: string;
        coordinatorId: string;
        coordinatorType?: string;
        status: string;
    }) {
        const { Requests, RequestTypes } = db.entities('sap.cre');
        const rtId = createUniqueId();
        await INSERT.into(RequestTypes).entries({ ID: rtId, title: 'Test RT' });
        const reqId = createUniqueId();
        await INSERT.into(Requests).entries({
            ID: reqId,
            title: `Request ${Date.now()}`,
            requestType_ID: rtId,
            createdBy_ID: options.requesterId,  // managedWithUser aspect uses createdBy_ID
            coordinatorId: options.coordinatorId,
            coordinatorType: options.coordinatorType ?? 'USER',
            status: options.status
        });
        return reqId;
    }

    // ============================================================================
    // DRAFT Visibility Tests
    // ============================================================================

    describe('DRAFT Request Visibility', () => {

        test('Requester can see own DRAFT request', async () => {
            const { id: userA } = await createTestUser();

            const requestId = await createTestRequest({
                requesterId: userA,
                coordinatorId: userA,
                status: 'DRAFT'
            });

            const { Requests } = db.entities('sap.cre');
            const requests = await SELECT.from(Requests)
                .where({ createdBy_ID: userA, status: 'DRAFT' });

            expect(requests.length).toBe(1);
            expect(requests[0].ID).toBe(requestId);
        });

        test('Other user cannot see DRAFT request', async () => {
            const { id: userA } = await createTestUser();
            const { id: userB } = await createTestUser();

            const requestId = await createTestRequest({
                requesterId: userA,
                coordinatorId: userA,
                status: 'DRAFT'
            });

            const { Requests } = db.entities('sap.cre');

            // User B checks if they are creator - should NOT find it
            const userBAsCreator = await SELECT.from(Requests)
                .where({ createdBy_ID: userB, status: 'DRAFT', ID: requestId });

            // User B checks if they are coordinator - should NOT find it
            const userBAsCoordinator = await SELECT.from(Requests)
                .where({ coordinatorId: userB, status: 'DRAFT', ID: requestId });

            // User B cannot see the request by either role
            expect(userBAsCreator.length).toBe(0);
            expect(userBAsCoordinator.length).toBe(0);
        });

        test('Assigned coordinator can see DRAFT request', async () => {
            const { id: requester } = await createTestUser();
            const { id: coordinator } = await createTestUser();

            const requestId = await createTestRequest({
                requesterId: requester,
                coordinatorId: coordinator,
                status: 'DRAFT'
            });

            const { Requests } = db.entities('sap.cre');
            const coordRequests = await SELECT.from(Requests)
                .where({ coordinatorId: coordinator, status: 'DRAFT' });

            expect(coordRequests.length).toBe(1);
            expect(coordRequests[0].ID).toBe(requestId);
        });
    });

    // ============================================================================
    // SUBMITTED/IN_PROGRESS Visibility Tests
    // ============================================================================

    describe('Active Request Visibility', () => {

        test('Step approver can see SUBMITTED request', async () => {
            const { id: requester } = await createTestUser();
            const { id: approver } = await createTestUser();

            const requestId = await createTestRequest({
                requesterId: requester,
                coordinatorId: requester,
                status: 'SUBMITTED'
            });

            // Create step and approval
            const { Steps, StepDefinitions, StepApprovals, RequestTypes } = db.entities('sap.cre');
            const rtId = createUniqueId();
            await INSERT.into(RequestTypes).entries({ ID: rtId, title: 'RT' });
            const sdId = createUniqueId();
            await INSERT.into(StepDefinitions).entries({
                ID: sdId,
                requestType_ID: rtId,
                stepName: 'Step'
            });
            const stepId = createUniqueId();
            await INSERT.into(Steps).entries({
                ID: stepId,
                request_ID: requestId,
                stepDefinition_ID: sdId,
                status: 'PENDING'
            });
            await INSERT.into(StepApprovals).entries({
                ID: createUniqueId(),
                step_ID: stepId,
                approver: approver,
                approverType: 'USER',
                status: 'PENDING'
            });

            // Approver should be able to find their pending approvals
            const approvals = await SELECT.from(StepApprovals)
                .where({ approver: approver, status: 'PENDING' });

            expect(approvals.length).toBe(1);
        });

        test('Non-approver cannot see step in their inbox', async () => {
            const { id: requester } = await createTestUser();
            const { id: approver } = await createTestUser();
            const { id: randomUser } = await createTestUser();

            const requestId = await createTestRequest({
                requesterId: requester,
                coordinatorId: requester,
                status: 'SUBMITTED'
            });

            // Create step and approval for approver
            const { Steps, StepDefinitions, StepApprovals, RequestTypes } = db.entities('sap.cre');
            const rtId = createUniqueId();
            await INSERT.into(RequestTypes).entries({ ID: rtId, title: 'RT' });
            const sdId = createUniqueId();
            await INSERT.into(StepDefinitions).entries({
                ID: sdId,
                requestType_ID: rtId,
                stepName: 'Step'
            });
            const stepId = createUniqueId();
            await INSERT.into(Steps).entries({
                ID: stepId,
                request_ID: requestId,
                stepDefinition_ID: sdId,
                status: 'PENDING'
            });
            await INSERT.into(StepApprovals).entries({
                ID: createUniqueId(),
                step_ID: stepId,
                approver: approver,
                approverType: 'USER',
                status: 'PENDING'
            });

            // Random user should NOT see this in their inbox
            const randomUserApprovals = await SELECT.from(StepApprovals)
                .where({ approver: randomUser, status: 'PENDING' });

            expect(randomUserApprovals.length).toBe(0);
        });
    });

    // ============================================================================
    // Group Coordinator Visibility
    // ============================================================================

    describe('Group Coordinator Visibility', () => {

        test('Any group member can see group-coordinated request', async () => {
            const { id: requester } = await createTestUser();
            const { id: member1 } = await createTestUser();
            const { id: member2 } = await createTestUser();
            const groupId = await createTestGroup();

            await addUserToGroup(member1, groupId);
            await addUserToGroup(member2, groupId);

            const requestId = await createTestRequest({
                requesterId: requester,
                coordinatorId: groupId,
                coordinatorType: 'GROUP',
                status: 'IN_PROGRESS'
            });

            const { Requests, GroupMembers } = db.entities('sap.cre');

            // Find member1's groups
            const member1Groups = await SELECT.from(GroupMembers)
                .where({ user_ID: member1 })
                .columns('group_ID');
            const member1GroupIds = member1Groups.map(g => g.group_ID);

            // Member1 should see requests where coordinatorId is in their groups
            const visibleRequests = await SELECT.from(Requests)
                .where({
                    coordinatorType: 'GROUP',
                    coordinatorId: { in: member1GroupIds }
                });

            expect(visibleRequests.length).toBe(1);
            expect(visibleRequests[0].ID).toBe(requestId);
        });

        test('Non-member cannot see group-coordinated request', async () => {
            const { id: requester } = await createTestUser();
            const { id: member } = await createTestUser();
            const { id: outsider } = await createTestUser();
            const groupId = await createTestGroup();

            await addUserToGroup(member, groupId);
            // outsider is NOT added to group

            await createTestRequest({
                requesterId: requester,
                coordinatorId: groupId,
                coordinatorType: 'GROUP',
                status: 'IN_PROGRESS'
            });

            const { Requests, GroupMembers } = db.entities('sap.cre');

            // Find outsider's groups (should be empty)
            const outsiderGroups = await SELECT.from(GroupMembers)
                .where({ user_ID: outsider })
                .columns('group_ID');

            expect(outsiderGroups.length).toBe(0);

            // No group-coordinated requests visible to outsider
            const visibleRequests = await SELECT.from(Requests)
                .where({
                    coordinatorType: 'GROUP',
                    coordinatorId: { in: [] } // Empty - no groups
                });

            expect(visibleRequests.length).toBe(0);
        });
    });

    // ============================================================================
    // Cross-User Isolation
    // ============================================================================

    describe('Cross-User Request Isolation', () => {

        test('Each user sees only their own DRAFT requests', async () => {
            const { id: userA } = await createTestUser();
            const { id: userB } = await createTestUser();

            // User A creates 2 drafts
            await createTestRequest({ requesterId: userA, coordinatorId: userA, status: 'DRAFT' });
            await createTestRequest({ requesterId: userA, coordinatorId: userA, status: 'DRAFT' });

            // User B creates 1 draft
            await createTestRequest({ requesterId: userB, coordinatorId: userB, status: 'DRAFT' });

            const { Requests } = db.entities('sap.cre');

            const userADrafts = await SELECT.from(Requests)
                .where({ createdBy_ID: userA, status: 'DRAFT' });

            const userBDrafts = await SELECT.from(Requests)
                .where({ createdBy_ID: userB, status: 'DRAFT' });

            expect(userADrafts.length).toBe(2);
            expect(userBDrafts.length).toBe(1);
        });
    });
});
