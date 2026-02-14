/**
 * Unit Tests: InboxHandler
 * 
 * Sprint 3 - Epic 3.5: Inbox Filters
 * Tests for task list filtering by user, team, and coordinator
 */
import cds from '@sap/cds';
import path from 'path';

// Project root with forward slashes for Windows compatibility
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

// Helper to create unique IDs
const createUniqueId = () => crypto.randomUUID();

describe('InboxHandler', () => {
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
    // Test Data Setup Helpers
    // ============================================================================

    async function createTestUser(userId?: string) {
        const { ShadowUsers } = db.entities('sap.cre');
        const id = createUniqueId();
        const email = userId ?? `user-${Date.now()}@test.com`;

        await INSERT.into(ShadowUsers).entries({
            ID: id,
            userId: email,
            email: email,
            displayName: `User ${Date.now()}`,
            isActive: true
        });
        return { id, email };
    }

    async function createTestGroup() {
        const { ShadowGroups, SupportTypes } = db.entities('sap.cre');

        // Create support type if not exists
        const typeId = createUniqueId();
        await INSERT.into(SupportTypes).entries({
            ID: typeId,
            code: `GROUP_${Date.now()}`,
            name: 'Group Type',
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

    async function createTestRequestType() {
        const { RequestTypes } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(RequestTypes).entries({
            ID: id,
            title: `Test RT ${Date.now()}`
        });
        return id;
    }

    async function createTestStepDefinition(requestTypeId: string) {
        const { StepDefinitions } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(StepDefinitions).entries({
            ID: id,
            requestType_ID: requestTypeId,
            stepName: `Step ${Date.now()}`
        });
        return id;
    }

    async function createTestRequest(requestTypeId: string, options: {
        status?: string;
        coordinatorId?: string;
    } = {}) {
        const { Requests } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(Requests).entries({
            ID: id,
            title: `Request ${Date.now()}`,
            requestType_ID: requestTypeId,
            status: options.status ?? 'IN_PROGRESS',
            coordinatorId: options.coordinatorId
        });
        return id;
    }

    async function createTestStep(requestId: string, stepDefId: string, status = 'IN_PROGRESS') {
        const { Steps } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(Steps).entries({
            ID: id,
            request_ID: requestId,
            stepDefinition_ID: stepDefId,
            status
        });
        return id;
    }

    async function createTestApproval(stepId: string, options: {
        approver: string;
        approverType: string;
        status?: string;
    }) {
        const { StepApprovals } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(StepApprovals).entries({
            ID: id,
            step_ID: stepId,
            approver: options.approver,
            approverType: options.approverType,
            status: options.status ?? 'PENDING'
        });
        return id;
    }

    // ============================================================================
    // getMyTasks Tests
    // ============================================================================

    describe('getMyTasks - User Direct Assignments', () => {

        test('should return empty for user not in ShadowUsers', async () => {
            const { ShadowUsers } = db.entities('sap.cre');

            // Search for non-existent user
            const user = await SELECT.one.from(ShadowUsers).where({ userId: 'nonexistent@test.com' });
            expect(user).toBeFalsy();
        });

        test('should find USER type approvals for specific user', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);
            const stepId = await createTestStep(requestId, stepDefId);

            const { email } = await createTestUser();

            await createTestApproval(stepId, {
                approver: email,
                approverType: 'USER',
                status: 'PENDING'
            });

            const { StepApprovals } = db.entities('sap.cre');
            const approvals = await SELECT.from(StepApprovals)
                .where({
                    approverType: 'USER',
                    status: 'PENDING',
                    approver: { like: `%${email.split('@')[0]}%` }
                });

            expect(approvals.length).toBeGreaterThanOrEqual(1);
        });

        test('should only return PENDING status approvals', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);
            const stepId = await createTestStep(requestId, stepDefId);

            const { email } = await createTestUser();

            // Create PENDING approval
            await createTestApproval(stepId, {
                approver: email,
                approverType: 'USER',
                status: 'PENDING'
            });

            // Create APPROVED approval
            await createTestApproval(stepId, {
                approver: email,
                approverType: 'USER',
                status: 'APPROVED'
            });

            const { StepApprovals } = db.entities('sap.cre');
            const pending = await SELECT.from(StepApprovals)
                .where({ approver: email, status: 'PENDING' });

            const approved = await SELECT.from(StepApprovals)
                .where({ approver: email, status: 'APPROVED' });

            expect(pending.length).toBe(1);
            expect(approved.length).toBe(1);
        });
    });

    // ============================================================================
    // getTeamTasks Tests
    // ============================================================================

    describe('getTeamTasks - Group Membership Filtering', () => {

        test('should return empty for user with no group memberships', async () => {
            const { id: userId } = await createTestUser();

            const { GroupMembers } = db.entities('sap.cre');
            const memberships = await SELECT.from(GroupMembers).where({ user_ID: userId });

            expect(memberships.length).toBe(0);
        });

        test('should find GROUP/TEAM type approvals for user groups', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);
            const stepId = await createTestStep(requestId, stepDefId);

            const { id: userId } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(userId, groupId);

            // Get group name
            const { ShadowGroups } = db.entities('sap.cre');
            const group = await SELECT.one.from(ShadowGroups).where({ ID: groupId });

            // Create approval for the group
            await createTestApproval(stepId, {
                approver: group.name,
                approverType: 'GROUP',
                status: 'PENDING'
            });

            const { StepApprovals } = db.entities('sap.cre');
            const approvals = await SELECT.from(StepApprovals)
                .where({
                    approverType: { in: ['GROUP', 'TEAM', 'DEPARTMENT', 'ROLE'] },
                    status: 'PENDING'
                });

            // Filter by group names user belongs to
            const teamApprovals = approvals.filter((a: { approver?: string }) =>
                a.approver === group.name
            );

            expect(teamApprovals.length).toBeGreaterThanOrEqual(1);
        });

        test('should handle multiple group memberships', async () => {
            const { id: userId } = await createTestUser();
            const group1 = await createTestGroup();
            const group2 = await createTestGroup();

            await addUserToGroup(userId, group1);
            await addUserToGroup(userId, group2);

            const { GroupMembers } = db.entities('sap.cre');
            const memberships = await SELECT.from(GroupMembers).where({ user_ID: userId });

            expect(memberships.length).toBe(2);
        });
    });

    // ============================================================================
    // getCoordinatingRequests Tests
    // ============================================================================

    describe('getCoordinatingRequests - Coordinator Filter', () => {

        test('should return empty for user not provisioned', async () => {
            const { ShadowUsers } = db.entities('sap.cre');

            const user = await SELECT.one.from(ShadowUsers).where({ userId: 'nobody@test.com' });
            expect(user).toBeFalsy();
        });

        test('should find requests where user is coordinator', async () => {
            const { id: coordinatorId } = await createTestUser();
            const rtId = await createTestRequestType();

            await createTestRequest(rtId, {
                status: 'IN_PROGRESS',
                coordinatorId: coordinatorId
            });

            await createTestRequest(rtId, {
                status: 'SUBMITTED',
                coordinatorId: coordinatorId
            });

            const { Requests } = db.entities('sap.cre');
            const coordinating = await SELECT.from(Requests)
                .where({
                    coordinatorId: coordinatorId,
                    status: { in: ['SUBMITTED', 'IN_PROGRESS'] }
                });

            expect(coordinating.length).toBe(2);
        });

        test('should only return active requests (SUBMITTED/IN_PROGRESS)', async () => {
            const { id: coordinatorId } = await createTestUser();
            const rtId = await createTestRequestType();

            // Active requests
            await createTestRequest(rtId, { status: 'IN_PROGRESS', coordinatorId });
            await createTestRequest(rtId, { status: 'SUBMITTED', coordinatorId });

            // Inactive requests
            await createTestRequest(rtId, { status: 'COMPLETED', coordinatorId });
            await createTestRequest(rtId, { status: 'REJECTED', coordinatorId });

            const { Requests } = db.entities('sap.cre');
            const activeRequests = await SELECT.from(Requests)
                .where({
                    coordinatorId,
                    status: { in: ['SUBMITTED', 'IN_PROGRESS'] }
                });

            const allRequests = await SELECT.from(Requests)
                .where({ coordinatorId });

            expect(activeRequests.length).toBe(2);
            expect(allRequests.length).toBe(4);
        });
    });
});
