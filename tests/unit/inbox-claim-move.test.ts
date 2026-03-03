/**
 * Unit Tests: Claimed group tasks appear in My Tasks
 *
 * Validates the DB-level query logic that powers the InboxHandler fix:
 * when a user claims a GROUP-assigned approval step, the query for My Tasks
 * should include that approval alongside direct USER approvals.
 *
 * Sprint 3 - Bug Fix: "Claim group task → My Tasks" flow
 */
import cds from '@sap/cds';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');
const uuid = () => crypto.randomUUID();

describe('Inbox: Claimed group task moves to My Tasks', () => {
    let db: cds.Service;

    beforeAll(async () => {
        cds.root = PROJECT_ROOT;
        await cds.load([
            PROJECT_ROOT + '/db/schema.cds',
            PROJECT_ROOT + '/srv/admin-service.cds',
            PROJECT_ROOT + '/srv/identity-service.cds',
            PROJECT_ROOT + '/srv/request-service.cds',
        ]);
        await cds.deploy('*').to('sqlite::memory:');
        db = await cds.connect.to('db');
    }, 60000);

    // ─── helpers ─────────────────────────────────────────────

    function E() {
        return db.entities('sap.cre');
    }

    async function seedUser(email?: string) {
        const id = uuid();
        const e = email ?? `u-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
        await INSERT.into(E().ShadowUsers).entries({
            ID: id, userId: e, email: e,
            displayName: `User ${e}`, isActive: true,
        });
        return { id, email: e };
    }

    async function seedGroup() {
        const typeId = uuid();
        await INSERT.into(E().SupportTypes).entries({
            ID: typeId, code: `GRP_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: 'Group', isEnabled: true,
        });
        const gid = uuid();
        await INSERT.into(E().ShadowGroups).entries({
            ID: gid, name: `Team-${Date.now()}`, type_ID: typeId,
        });
        return gid;
    }

    async function addMember(userId: string, groupId: string) {
        await INSERT.into(E().GroupMembers).entries({
            ID: uuid(), user_ID: userId, group_ID: groupId,
        });
    }

    async function seedWorkflow() {
        const rtId = uuid();
        await INSERT.into(E().RequestTypes).entries({ ID: rtId, title: `RT-${Date.now()}` });

        const sdId = uuid();
        await INSERT.into(E().StepDefinitions).entries({
            ID: sdId, requestType_ID: rtId, stepName: `Step-${Date.now()}`,
        });

        const reqId = uuid();
        await INSERT.into(E().Requests).entries({
            ID: reqId, title: `Req-${Date.now()}`, requestType_ID: rtId, status: 'IN_PROGRESS',
        });

        const stepId = uuid();
        await INSERT.into(E().Steps).entries({
            ID: stepId, request_ID: reqId, stepDefinition_ID: sdId,
            status: 'IN_PROGRESS',
        });

        return { rtId, sdId, reqId, stepId };
    }

    async function seedApproval(stepId: string, approver: string, type: string) {
        const id = uuid();
        await INSERT.into(E().StepApprovals).entries({
            ID: id, step_ID: stepId, approver, approverType: type, status: 'PENDING',
        });
        return id;
    }

    async function claimStep(stepId: string, shadowUserId: string) {
        await UPDATE(E().Steps).where({ ID: stepId }).set({
            claimedBy_ID: shadowUserId,
            claimedAt: new Date(),
        });
    }

    // ─── Simulated getMyTasks queries (matching InboxHandler fix) ───

    /**
     * Mirrors the fixed InboxHandler.onGetMyTasks:
     *   1. Direct USER approvals where approver = shadowUserId  
     *   2. Group approvals where the step's claimedBy_ID = shadowUserId
     *   3. Merge and deduplicate
     * 
     * Uses simple column projections to avoid CQL inference issues in SQLite.
     */
    async function simulateGetMyTasks(shadowUserId: string) {
        // Query 1: Direct USER approvals
        const directApprovals = await SELECT.from(E().StepApprovals)
            .columns('ID', 'approver', 'approverType', 'status', 'step_ID')
            .where({
                approverType: 'USER',
                approver: shadowUserId,
                status: 'PENDING',
            });

        // Query 2: Group approvals claimed by this user
        //   We join manually: find step IDs claimed by user, then find matching group approvals
        const claimedSteps = await SELECT.from(E().Steps)
            .columns('ID')
            .where({ claimedBy_ID: shadowUserId });

        const claimedStepIds = claimedSteps.map((s: any) => s.ID);

        let claimedGroupApprovals: any[] = [];
        if (claimedStepIds.length > 0) {
            claimedGroupApprovals = await SELECT.from(E().StepApprovals)
                .columns('ID', 'approver', 'approverType', 'status', 'step_ID')
                .where({
                    approverType: { in: ['GROUP', 'TEAM', 'DEPARTMENT', 'ROLE'] },
                    status: 'PENDING',
                    step_ID: { in: claimedStepIds },
                });
        }

        // Deduplicate
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const a of [...directApprovals, ...claimedGroupApprovals]) {
            if (!seen.has(a.ID)) {
                seen.add(a.ID);
                merged.push(a);
            }
        }
        return merged;
    }

    /** Get claimedBy_ID for a step */
    async function getStepClaimedBy(stepId: string) {
        const step = await SELECT.one.from(E().Steps).where({ ID: stepId }).columns('claimedBy_ID');
        return step?.claimedBy_ID;
    }

    // ================================================================
    // Tests
    // ================================================================

    test('BUG REPRO: unclaimed group task does NOT appear in My Tasks', async () => {
        const user = await seedUser();
        const group = await seedGroup();
        await addMember(user.id, group);

        const { stepId } = await seedWorkflow();
        await seedApproval(stepId, group, 'GROUP');

        const myTasks = await simulateGetMyTasks(user.id);
        expect(myTasks.length).toBe(0);
    });

    test('FIX VALIDATION: claimed group task DOES appear in My Tasks', async () => {
        const user = await seedUser();
        const group = await seedGroup();
        await addMember(user.id, group);

        const { stepId } = await seedWorkflow();
        const approvalId = await seedApproval(stepId, group, 'GROUP');

        // Claim the step
        await claimStep(stepId, user.id);

        const myTasks = await simulateGetMyTasks(user.id);
        expect(myTasks.length).toBe(1);
        expect(myTasks[0].ID).toBe(approvalId);
        expect(myTasks[0].approverType).toBe('GROUP');
    });

    test('claimedBy_ID is populated after claiming a step', async () => {
        const user = await seedUser();
        const { stepId } = await seedWorkflow();
        await seedApproval(stepId, user.id, 'USER');

        await claimStep(stepId, user.id);

        const claimedById = await getStepClaimedBy(stepId);
        expect(claimedById).toBe(user.id);
    });

    test('claimedBy_ID is null when step is unclaimed', async () => {
        const user = await seedUser();
        const { stepId } = await seedWorkflow();
        await seedApproval(stepId, user.id, 'USER');

        const claimedById = await getStepClaimedBy(stepId);
        expect(claimedById).toBeFalsy();
    });

    test('No duplicates when user has both direct and group approval on same step', async () => {
        const user = await seedUser();
        const group = await seedGroup();
        await addMember(user.id, group);

        const { stepId } = await seedWorkflow();
        await seedApproval(stepId, user.id, 'USER');
        await seedApproval(stepId, group, 'GROUP');

        await claimStep(stepId, user.id);

        const myTasks = await simulateGetMyTasks(user.id);
        // Should have exactly 2 (one USER, one GROUP) — both unique
        expect(myTasks.length).toBe(2);

        const types = myTasks.map((t: any) => t.approverType).sort();
        expect(types).toEqual(['GROUP', 'USER']);
    });

    test('Other user\'s claimed group tasks do NOT appear in my tasks', async () => {
        const me = await seedUser();
        const other = await seedUser();
        const group = await seedGroup();
        await addMember(me.id, group);
        await addMember(other.id, group);

        const { stepId } = await seedWorkflow();
        await seedApproval(stepId, group, 'GROUP');

        // Other user claims the step
        await claimStep(stepId, other.id);

        // My Tasks should NOT include it (someone else claimed)
        const myTasks = await simulateGetMyTasks(me.id);
        expect(myTasks.length).toBe(0);
    });
});
