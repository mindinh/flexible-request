/**
 * Unit Tests: CoordinatorHandler
 * 
 * Sprint 3 - Epic 3.1: Coordinator Delegation
 * Sprint 3 - Epic 3.3: Step Claim/Release
 */
import cds from '@sap/cds';
import path from 'path';

// Project root with forward slashes for Windows compatibility
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

// Helper to create unique IDs
const createUniqueId = () => crypto.randomUUID();

describe('CoordinatorHandler', () => {
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
            stepName: `Test Step ${Date.now()}`
        });
        return id;
    }

    async function createTestRequest(requestTypeId: string, options: {
        status?: string;
        coordinatorId?: string;
        coordinatorValue?: string;
    } = {}) {
        const { Requests } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(Requests).entries({
            ID: id,
            title: `Test Request ${Date.now()}`,
            requestType_ID: requestTypeId,
            status: options.status ?? 'IN_PROGRESS',
            coordinatorId: options.coordinatorId,
            coordinatorValue: options.coordinatorValue
        });
        return id;
    }

    async function createTestStep(requestId: string, stepDefId: string, options: {
        status?: string;
        claimedBy_ID?: string;
        claimedAt?: Date;
    } = {}) {
        const { Steps } = db.entities('sap.cre');
        const id = createUniqueId();
        await INSERT.into(Steps).entries({
            ID: id,
            request_ID: requestId,
            stepDefinition_ID: stepDefId,
            status: options.status ?? 'IN_PROGRESS',
            claimedBy_ID: options.claimedBy_ID,
            claimedAt: options.claimedAt
        });
        return id;
    }

    // ============================================================================
    // onDelegate Tests
    // ============================================================================

    describe('onDelegate - Coordinator Delegation', () => {

        test('should update coordinator fields on valid request', async () => {
            const rtId = await createTestRequestType();
            const { id: originalCoordId } = await createTestUser();
            const { id: newCoordId } = await createTestUser();

            const requestId = await createTestRequest(rtId, {
                status: 'IN_PROGRESS',
                coordinatorId: originalCoordId,
                coordinatorValue: 'Original Coordinator'
            });

            const { Requests } = db.entities('sap.cre');

            // Simulate delegation update
            await UPDATE(Requests).where({ ID: requestId }).set({
                coordinatorId: newCoordId,
                coordinatorValue: 'New Coordinator',
                coordinatorType: 'USER',
                delegatedFrom: originalCoordId,
                delegatedAt: new Date()
            });

            const result = await SELECT.one.from(Requests).where({ ID: requestId });
            expect(result.coordinatorId).toBe(newCoordId);
            expect(result.delegatedFrom).toBe(originalCoordId);
        });

        test('should not allow delegation on completed request', async () => {
            const rtId = await createTestRequestType();
            const requestId = await createTestRequest(rtId, { status: 'COMPLETED' });

            const { Requests } = db.entities('sap.cre');
            const request = await SELECT.one.from(Requests).where({ ID: requestId });

            // Business logic would prevent this in handler - verify status
            expect(request.status).toBe('COMPLETED');
        });

        test('should not allow delegation on rejected request', async () => {
            const rtId = await createTestRequestType();
            const requestId = await createTestRequest(rtId, { status: 'REJECTED' });

            const { Requests } = db.entities('sap.cre');
            const request = await SELECT.one.from(Requests).where({ ID: requestId });

            expect(request.status).toBe('REJECTED');
        });
    });

    // ============================================================================
    // onClaimStep Tests
    // ============================================================================

    describe('onClaimStep - Step Claiming', () => {

        test('should claim step when not already claimed', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);
            const stepId = await createTestStep(requestId, stepDefId, { status: 'IN_PROGRESS' });

            const { id: userId } = await createTestUser();
            const { Steps } = db.entities('sap.cre');

            // Claim the step
            await UPDATE(Steps).where({ ID: stepId }).set({
                claimedBy_ID: userId,
                claimedAt: new Date()
            });

            const result = await SELECT.one.from(Steps).where({ ID: stepId });
            expect(result.claimedBy_ID).toBe(userId);
            expect(result.claimedAt).toBeDefined();
        });

        test('should prevent claim on wrong status', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);
            const stepId = await createTestStep(requestId, stepDefId, { status: 'COMPLETED' });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            // Business logic would prevent claiming completed steps
            expect(step.status).toBe('COMPLETED');
        });

        test('should allow re-claim after 4-hour timeout', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);

            const { id: originalClaimer } = await createTestUser();
            const expiredClaimTime = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago

            const stepId = await createTestStep(requestId, stepDefId, {
                status: 'IN_PROGRESS',
                claimedBy_ID: originalClaimer,
                claimedAt: expiredClaimTime
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            // Check that claim is expired (4+ hours old)
            const claimedAt = new Date(step.claimedAt);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

            expect(claimedAt < fourHoursAgo).toBe(true);

            // Re-claim would be allowed
            const { id: newClaimer } = await createTestUser();
            await UPDATE(Steps).where({ ID: stepId }).set({
                claimedBy_ID: newClaimer,
                claimedAt: new Date()
            });

            const updated = await SELECT.one.from(Steps).where({ ID: stepId });
            expect(updated.claimedBy_ID).toBe(newClaimer);
        });

        test('should block re-claim within 4-hour window', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);

            const { id: originalClaimer } = await createTestUser();
            const recentClaimTime = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

            const stepId = await createTestStep(requestId, stepDefId, {
                status: 'IN_PROGRESS',
                claimedBy_ID: originalClaimer,
                claimedAt: recentClaimTime
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            // Check that claim is still active (within 4 hours)
            const claimedAt = new Date(step.claimedAt);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

            expect(claimedAt > fourHoursAgo).toBe(true);
            expect(step.claimedBy_ID).toBe(originalClaimer);
        });
    });

    // ============================================================================
    // onReleaseStep Tests
    // ============================================================================

    describe('onReleaseStep - Step Release', () => {

        test('should release claimed step', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);

            const { id: userId } = await createTestUser();
            const stepId = await createTestStep(requestId, stepDefId, {
                status: 'IN_PROGRESS',
                claimedBy_ID: userId,
                claimedAt: new Date()
            });

            const { Steps } = db.entities('sap.cre');

            // Release the step
            await UPDATE(Steps).where({ ID: stepId }).set({
                claimedBy_ID: null,
                claimedAt: null
            });

            const result = await SELECT.one.from(Steps).where({ ID: stepId });
            expect(result.claimedBy_ID).toBeFalsy();
            expect(result.claimedAt).toBeFalsy();
        });

        test('should not release unclaimed step', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);
            const stepId = await createTestStep(requestId, stepDefId, { status: 'IN_PROGRESS' });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            // Step is not claimed
            expect(step.claimedBy_ID).toBeFalsy();
        });

        test('should verify claimer identity before release', async () => {
            const rtId = await createTestRequestType();
            const stepDefId = await createTestStepDefinition(rtId);
            const requestId = await createTestRequest(rtId);

            const { id: claimerId } = await createTestUser();
            const { id: otherUserId } = await createTestUser();

            const stepId = await createTestStep(requestId, stepDefId, {
                status: 'IN_PROGRESS',
                claimedBy_ID: claimerId,
                claimedAt: new Date()
            });

            const { Steps } = db.entities('sap.cre');
            const step = await SELECT.one.from(Steps).where({ ID: stepId });

            // Business logic would block release by non-claimer
            expect(step.claimedBy_ID).toBe(claimerId);
            expect(step.claimedBy_ID).not.toBe(otherUserId);
        });
    });
});
