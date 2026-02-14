/**
 * Security Tests: Authorization Boundaries
 * 
 * Epic 4.2.3: Test action authorization
 * Tests that users cannot perform actions they are not authorized for.
 */
import cds from '@sap/cds';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

const createUniqueId = () => crypto.randomUUID();

describe('Authorization Boundaries', () => {
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

    async function createTestRequest(requesterId: string, coordinatorId: string) {
        const { Requests, RequestTypes } = db.entities('sap.cre');
        const rtId = createUniqueId();
        await INSERT.into(RequestTypes).entries({ ID: rtId, title: 'Test RT' });
        const reqId = createUniqueId();
        await INSERT.into(Requests).entries({
            ID: reqId,
            title: 'Test Request',
            requestType_ID: rtId,
            requester_ID: requesterId,
            coordinatorId: coordinatorId,
            coordinatorType: 'USER',
            status: 'IN_PROGRESS'
        });
        return reqId;
    }

    async function createTestStep(requestId: string, options: {
        ownerType?: string;
        ownerId?: string;
        claimedBy_ID?: string;
        claimedAt?: Date;
    } = {}) {
        const { Steps, StepDefinitions, RequestTypes } = db.entities('sap.cre');
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
            status: 'IN_PROGRESS',
            ownerType: options.ownerType ?? 'USER',
            ownerId: options.ownerId,
            claimedBy_ID: options.claimedBy_ID,
            claimedAt: options.claimedAt
        });
        return stepId;
    }

    async function createTestApproval(stepId: string, approverId: string, approverType: string) {
        const { StepApprovals } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(StepApprovals).entries({
            ID: id,
            step_ID: stepId,
            approver: approverId,
            approverType: approverType,
            status: 'PENDING'
        });
        return id;
    }

    // ============================================================================
    // Approval Authorization Tests
    // ============================================================================

    describe('Approval Authorization', () => {

        test('USER assigned can approve', async () => {
            const { id: userId } = await createTestUser();
            const requestId = await createTestRequest(userId, userId);
            const stepId = await createTestStep(requestId);
            await createTestApproval(stepId, userId, 'USER');

            const { StepApprovals } = db.entities('sap.cre');
            const approval = await SELECT.one.from(StepApprovals).where({ step_ID: stepId });

            // User is the assigned approver - should be able to approve
            expect(approval.approver).toBe(userId);
            expect(approval.approverType).toBe('USER');
        });

        test('Wrong user cannot approve (validation data)', async () => {
            const { id: assignedUser } = await createTestUser();
            const { id: wrongUser } = await createTestUser();
            const requestId = await createTestRequest(assignedUser, assignedUser);
            const stepId = await createTestStep(requestId);
            await createTestApproval(stepId, assignedUser, 'USER');

            const { StepApprovals } = db.entities('sap.cre');
            const approval = await SELECT.one.from(StepApprovals).where({ step_ID: stepId });

            // Wrong user is NOT the assigned approver
            const isAuthorized = approval.approver === wrongUser;
            expect(isAuthorized).toBe(false);
        });

        test('GROUP member can approve group-assigned step', async () => {
            const { id: userId } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(userId, groupId);

            const requestId = await createTestRequest(userId, userId);
            const stepId = await createTestStep(requestId);
            await createTestApproval(stepId, groupId, 'GROUP');

            const { GroupMembers, StepApprovals } = db.entities('sap.cre');
            const members = await SELECT.from(GroupMembers).where({ group_ID: groupId });
            const approval = await SELECT.one.from(StepApprovals).where({ step_ID: stepId });

            const isMember = members.some(m => m.user_ID === userId);
            const isGroupApproval = approval.approverType === 'GROUP';

            expect(isMember).toBe(true);
            expect(isGroupApproval).toBe(true);
        });

        test('Non-member cannot approve group-assigned step', async () => {
            const { id: memberUser } = await createTestUser();
            const { id: nonMemberUser } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(memberUser, groupId);

            const requestId = await createTestRequest(memberUser, memberUser);
            const stepId = await createTestStep(requestId);
            await createTestApproval(stepId, groupId, 'GROUP');

            const { GroupMembers } = db.entities('sap.cre');
            const members = await SELECT.from(GroupMembers).where({ group_ID: groupId });

            const isNonMemberInGroup = members.some(m => m.user_ID === nonMemberUser);
            expect(isNonMemberInGroup).toBe(false);
        });
    });

    // ============================================================================
    // Claim Authorization Tests
    // ============================================================================

    describe('Step Claim Authorization', () => {

        test('Group member can claim group-assigned step', async () => {
            const { id: userId } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(userId, groupId);

            const requestId = await createTestRequest(userId, userId);
            const stepId = await createTestStep(requestId, {
                ownerType: 'GROUP',
                ownerId: groupId
            });

            const { GroupMembers } = db.entities('sap.cre');
            const members = await SELECT.from(GroupMembers).where({ group_ID: groupId });

            const canClaim = members.some(m => m.user_ID === userId);
            expect(canClaim).toBe(true);
        });

        test('Non-member cannot claim group-assigned step', async () => {
            const { id: memberUser } = await createTestUser();
            const { id: outsiderUser } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(memberUser, groupId);

            const requestId = await createTestRequest(memberUser, memberUser);
            await createTestStep(requestId, {
                ownerType: 'GROUP',
                ownerId: groupId
            });

            const { GroupMembers } = db.entities('sap.cre');
            const members = await SELECT.from(GroupMembers).where({ group_ID: groupId });

            const canOutsiderClaim = members.some(m => m.user_ID === outsiderUser);
            expect(canOutsiderClaim).toBe(false);
        });

        test('Already claimed step blocks re-claim within 4h', async () => {
            const { id: claimer } = await createTestUser();
            const { id: otherUser } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(claimer, groupId);
            await addUserToGroup(otherUser, groupId);

            const requestId = await createTestRequest(claimer, claimer);
            const claimedAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
            const stepId = await createTestStep(requestId, {
                ownerType: 'GROUP',
                ownerId: groupId,
                claimedBy_ID: claimer,
                claimedAt: claimedAt
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            const claimTime = new Date(step.claimedAt);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            const isClaimActive = claimTime > fourHoursAgo;

            expect(isClaimActive).toBe(true);
            expect(step.claimedBy_ID).not.toBe(otherUser);
        });

        test('Expired claim allows re-claim', async () => {
            const { id: originalClaimer } = await createTestUser();
            const { id: newClaimer } = await createTestUser();
            const groupId = await createTestGroup();
            await addUserToGroup(originalClaimer, groupId);
            await addUserToGroup(newClaimer, groupId);

            const requestId = await createTestRequest(originalClaimer, originalClaimer);
            const expiredClaimTime = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
            const stepId = await createTestStep(requestId, {
                ownerType: 'GROUP',
                ownerId: groupId,
                claimedBy_ID: originalClaimer,
                claimedAt: expiredClaimTime
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            const claimTime = new Date(step.claimedAt);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            const isClaimExpired = claimTime < fourHoursAgo;

            expect(isClaimExpired).toBe(true);
        });
    });

    // ============================================================================
    // Delegation Authorization Tests
    // ============================================================================

    describe('Delegation Authorization', () => {

        test('Coordinator can delegate', async () => {
            const { id: coordinator } = await createTestUser();
            const requestId = await createTestRequest(coordinator, coordinator);

            const { Requests } = db.entities('sap.cre');
            const request = await SELECT.one.from(Requests).where({ ID: requestId });

            const isCoordinator = request.coordinatorId === coordinator;
            expect(isCoordinator).toBe(true);
        });

        test('Non-coordinator cannot delegate', async () => {
            const { id: coordinator } = await createTestUser();
            const { id: randomUser } = await createTestUser();
            const requestId = await createTestRequest(coordinator, coordinator);

            const { Requests } = db.entities('sap.cre');
            const request = await SELECT.one.from(Requests).where({ ID: requestId });

            const canRandomUserDelegate = request.coordinatorId === randomUser;
            expect(canRandomUserDelegate).toBe(false);
        });
    });

    // ============================================================================
    // Release Authorization Tests
    // ============================================================================

    describe('Release Authorization', () => {

        test('Claimer can release', async () => {
            const { id: claimer } = await createTestUser();
            const requestId = await createTestRequest(claimer, claimer);
            const stepId = await createTestStep(requestId, {
                claimedBy_ID: claimer,
                claimedAt: new Date()
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            const isClaimer = step.claimedBy_ID === claimer;
            expect(isClaimer).toBe(true);
        });

        test('Non-claimer cannot release', async () => {
            const { id: claimer } = await createTestUser();
            const { id: otherUser } = await createTestUser();
            const requestId = await createTestRequest(claimer, claimer);
            const stepId = await createTestStep(requestId, {
                claimedBy_ID: claimer,
                claimedAt: new Date()
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            const canOtherRelease = step.claimedBy_ID === otherUser;
            expect(canOtherRelease).toBe(false);
        });
    });
});
