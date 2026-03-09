import { cds, SELECT, INSERT, UPDATE } from '../lib/db';
import { WorkflowEngine } from '../lib/workflow';
import { ApproverResolver } from '../lib/approver-resolver';
import { Request, Step, StepApproval, StatusNetwork } from '../../@cds-models/RequestService';
import { UserResolverHelper } from '../lib/user-resolver-helper';
import { SharedRequestTypeHandler } from './SharedRequestTypeHandler';

/**
 * Handles Request-level lifecycle actions: submit, withdraw
 * Step-level actions (submitStep, respondToClarification) are in StepHandler.
 * Enforces StatusNetwork transitions.
 */
export class RequestHandler {

    private srv: cds.ApplicationService;
    private workflowEngine: WorkflowEngine;
    private userResolver: UserResolverHelper;
    private log = cds.log('request-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
        this.workflowEngine = new WorkflowEngine(srv);
        this.userResolver = new UserResolverHelper(srv);
    }

    /**
     * Register all request-related handlers
     */
    register() {
        // Use object reference for entity to ensure correct binding
        const { Requests } = this.srv.entities;

        this.log.info('Registering Request Handlers...');
        this.srv.on('submit', Requests, this.onSubmit.bind(this));
        this.srv.on('withdraw', Requests, this.onWithdraw.bind(this));

        // Initialize fields before creation
        this.srv.before('CREATE', Requests, this.beforeCreate.bind(this));
        // Advance workflow after creation
        this.srv.after('CREATE', Requests, this.afterCreate.bind(this));

        // Enrich requests with display names
        this.srv.after('READ', Requests, this.afterRead.bind(this));

        // Status transition validation
        this.srv.before('UPDATE', Requests, this.validateStatusTransition.bind(this));

        // Enrich RequestTypes (for browsing)
        this.srv.after('READ', 'RequestTypes', this.afterReadRequestTypes.bind(this));

        // Enrich child entities directly — ensures virtual fields are populated
        // even when CAP resolves $expand children independently
        const sharedHandler = new SharedRequestTypeHandler(this.srv);
        this.srv.after('READ', 'StepDefinitions', (data: any) => sharedHandler.enrichStepDefinitions(data));
        this.srv.after('READ', 'ApproverRules', (data: any) => sharedHandler.enrichApproverRules(data));
    }

    /**
     * Enrich RequestTypes with display names
     */
    private async afterReadRequestTypes(data: any) {
        await new SharedRequestTypeHandler(this.srv).enrichRequestTypes(data);
    }

    /**
     * After READ: Enrich requests with coordinator display name
     */
    private async afterRead(data: any, req: cds.Request) {
        const items = Array.isArray(data) ? data : data ? [data] : [];
        if (items.length === 0) return;

        this.log.info(`[RequestHandler] Enriching ${items.length} requests with coordinator/owner/step names`);

        const { ShadowUsers, ShadowGroups, Steps, StepDefinitions } = this.srv.entities;
        const userIds = new Set<string>();
        const groupIds = new Set<string>();
        const requestIds = items.map(i => i.ID);

        // 1. Collect Coordinator IDs
        for (const item of items) {
            if (item.coordinatorId) {
                if (item.coordinatorType === 'USER') {
                    userIds.add(item.coordinatorId);
                } else if (['GROUP', 'TEAM'].includes(item.coordinatorType)) {
                    groupIds.add(item.coordinatorId);
                }
            }
        }

        // 2. Fetch Active Steps for all requests (Bulk)
        // We look for steps that are "active" (not COMPLETE/SKIPPED/REJECTED/UPCOMING)
        const activeSteps = await SELECT.from(Steps)
            .where({
                request_ID: { in: requestIds },
                status: { in: ['STARTED', 'IN_PROGRESS', 'IN_CLARIFICATION'] }
            })
            .columns('request_ID', 'stepDefinition_ID', 'dueDate');

        // Resolve step names by batch-fetching the relevant StepDefinitions
        const stepDefIds = [...new Set(activeSteps.map((s: any) => s.stepDefinition_ID).filter(Boolean))];
        const stepDefinitionMap = new Map<string, string>();
        if (stepDefIds.length > 0) {
            const defs = await SELECT.from(StepDefinitions)
                .where({ ID: { in: stepDefIds } })
                .columns('ID', 'stepName');
            for (const def of defs) {
                stepDefinitionMap.set(def.ID, def.stepName);
            }
        }

        const stepMap = new Map<string, { name: string, dueDate: string }>();
        for (const s of activeSteps) {
            // Note: If multiple active steps (parallel), we just take the first one for the list view
            if (!stepMap.has(s.request_ID)) {
                stepMap.set(s.request_ID, {
                    name: stepDefinitionMap.get(s.stepDefinition_ID) || 'Active',
                    dueDate: s.dueDate
                });
            }
        }

        // 3. Resolve Display Names (Users/Groups)
        const nameMap = new Map<string, string>();

        // Fetch Users
        if (userIds.size > 0) {
            try {
                const users = await SELECT.from(ShadowUsers)
                    .where({ ID: { in: [...userIds] } })
                    .columns('ID', 'displayName', 'email');
                for (const u of users) {
                    nameMap.set(u.ID, u.displayName || u.email || u.ID);
                }
            } catch (e) {
                this.log.warn('Failed to fetch users for coordinator display names', e);
            }
        }

        // Fetch Groups
        if (groupIds.size > 0) {
            try {
                const groups = await SELECT.from(ShadowGroups)
                    .where({ ID: { in: [...groupIds] } })
                    .columns('ID', 'name');
                for (const g of groups) {
                    nameMap.set(g.ID, g.name || g.ID);
                }
            } catch (e) {
                this.log.warn('Failed to fetch groups for coordinator display names', e);
            }
        }

        // 4. Apply to items
        for (const item of items) {
            // Step Name & Due Date
            const activeStep = stepMap.get(item.ID);
            item.currentStepName = activeStep?.name || (item.status === 'COMPLETED' ? 'Completed' : '-');
            item.dueDate = activeStep?.dueDate || null;

            // Coordinator Name
            if (item.coordinatorId) {
                const resolvedName = nameMap.get(item.coordinatorId);
                item.coordinatorDisplayName = resolvedName || item.coordinatorId;
            }
        }
    }

    /**
     * Before Create: Initialize fields like coordinator and displayId
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async beforeCreate(req: cds.Request) {
        const data = req.data;
        const origin = (req.user as any).origin || 'sap.default';
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);

        this.log.info(`[RequestHandler] beforeCreate for user: ${req.user.id} (UUID: ${userUUID})`);

        // 1. Set default coordinator if missing
        if (!data.coordinatorId) {
            const { ShadowUsers } = this.srv.entities;
            const creator = await SELECT.one.from(ShadowUsers, userUUID).columns('displayName');

            this.log.info(`[RequestHandler] Defaulting coordinator to creator: ${creator?.displayName || userUUID}`);

            data.coordinatorId = userUUID;
            data.coordinatorType = 'USER';
            data.coordinatorValue = creator?.displayName || (req.user as any).id;
        }

        // 2. Generate displayId synchronously for the INSERT
        const displayId = await this.generateDisplayId(data.requestType_ID, userUUID);
        if (displayId) {
            data.displayId = displayId;
        }
    }

    /**
     * After Create: Initialize workflow and record history
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async afterCreate(data: any, req: cds.Request) {
        const requestId = data.ID as string;
        this.log.info(`[RequestHandler] afterCreate for Request: ${requestId}`);

        const origin = (req.user as any).origin || 'sap.default';
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);

        // 1. Record request creation history
        await this.recordHistory(requestId, null, 'CREATE', userUUID, 'Request Created');

        // 2. Resolve source request ID for copying Step 1 data
        let sourceRequestId = data.refRequest_ID;
        if (!sourceRequestId) {
            this.log.debug(`[RequestHandler] refRequest_ID not in data, fetching from DB for request ${requestId}`);
            const { Requests } = this.srv.entities;
            const res = await SELECT.one.from(Requests, requestId).columns('refRequest_ID');
            sourceRequestId = res?.refRequest_ID;
        }
        if (sourceRequestId) {
            this.log.info(`[RequestHandler] Detected copy from source request: ${sourceRequestId}`);
        }

        // 3. Initialize workflow
        try {
            await this.workflowEngine.advance(requestId, userUUID, sourceRequestId);
        } catch (err) {
            this.log.error(`Failed to initialize workflow for ${requestId}`, err);
        }
    }

    /**
     * Generate a human-readable displayId using the NumberRange configured for the request type.
     * Format: PADDED_NUMBER (no prefix)
     * e.g., 001023 (currentNumber=1023, digits=6)
     * Atomically increments the counter.
     */
    private async generateDisplayId(requestTypeId: string | undefined, userUUID: string | null): Promise<string | null> {
        if (!requestTypeId) return null;

        try {
            const db = await cds.connect.to('db');
            const { NumberRanges } = db.entities('sap.cre');

            // Find active number range for this request type
            const range = await SELECT.one.from(NumberRanges)
                .where({ requestType_ID: requestTypeId, isActive: true })
                .columns('ID', 'currentNumber', 'digits', 'requestType');

            if (!range) {
                this.log.info(`[RequestHandler] No active NumberRange for requestType ${requestTypeId} – skipping displayId`);
                return null;
            }

            // Build the displayId: PADDED_NUMBER (no prefix)
            const displayId = String(range.currentNumber).padStart(range.digits, '0');

            // Atomically increment the counter
            await UPDATE(NumberRanges, range.ID).with({
                currentNumber: range.currentNumber + 1,
                modifiedBy_ID: userUUID
            });

            this.log.info(`[RequestHandler] Generated displayId "${displayId}" for requestType ${requestTypeId}`);
            return displayId;
        } catch (err) {
            // Non-fatal: displayId is optional decoration
            this.log.warn(`[RequestHandler] Failed to generate displayId for requestType ${requestTypeId}:`, err);
            return null;
        }
    }

    /**
     * Validate status transitions against StatusNetwork configuration
     */
    private async validateStatusTransition(req: cds.Request) {
        const { Requests, StatusNetwork } = this.srv.entities;
        const data = req.data as { ID?: string; status?: string };

        if (!data.status) return; // No status change

        const param = req.params[0] as { ID: string } | undefined;
        const requestID = param?.ID || data.ID;
        if (!requestID) return;

        // Get current request
        const current = await SELECT.one.from(Requests, requestID).columns('status', 'requestType_ID') as { status: string; requestType_ID: string } | null;
        if (!current) return;
        if (current.status === data.status) return; // No change

        // Check if transition is allowed
        const allowedTransition = await SELECT.one.from(StatusNetwork)
            .where({
                requestType_ID: current.requestType_ID,
                fromStatus: current.status,
                toStatus: data.status
            });

        if (!allowedTransition) {
            // Check if there are ANY rules for this request type
            const hasRules = await SELECT.one.from(StatusNetwork)
                .where({ requestType_ID: current.requestType_ID });

            if (hasRules) {
                // Rules exist but this transition is not allowed
                return req.error(400, `Invalid status transition: ${current.status} -> ${data.status}`);
            }
            // No rules configured - allow any transition (backward compatible)
        }
    }

    /**
     * Submit a Request - transitions from DRAFT to SUBMITTED
     * Per status concept:
     * - Request: DRAFT → SUBMITTED
     * - 1st Step: STARTED → IN_PROGRESS (data entry complete, ready for approval)
     */
    private async onSubmit(req: cds.Request) {
        const { Requests, Steps, StepApprovals, StepHistory, RequestHistory } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const requestID = param.ID;

        this.log.info(`Submitting Request ID: ${requestID}`);

        // 1. Get the request to find first step
        const request = await SELECT.one.from(Requests, requestID).columns('ID', 'requestType_ID', 'priority') as { ID: string; requestType_ID: string; priority: string } | null;
        if (!request) {
            return req.error(404, 'Request not found');
        }

        // 2. Resolve user UUID for audit (supports multi-IDP)
        const origin = (req.user as any).origin || 'sap.default'; // Fallback for dev/local
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);
        if (!userUUID) {
            return req.error(500, `Shadow user not found for ${origin}:${req.user.id}`);
        }

        // 3. Update Request Status to SUBMITTED
        await UPDATE(Requests, requestID).with({ status: Request.status.SUBMITTED });

        // 4. Record SUBMIT action FIRST (before step changes)
        await this.recordHistory(requestID, null, 'SUBMIT', userUUID, undefined);

        // 5. Find the start step (should be in STARTED status)
        const startStep = await SELECT.one.from(Steps)
            .where({ request_ID: requestID })
            .and(`stepDefinition.isStartStep = true`)
            .columns('ID', 'stepDefinition_ID', 'status') as { ID: string; stepDefinition_ID: string; status: string } | null;

        if (startStep && startStep.status === Step.status.STARTED) {
            this.log.info(`Transitioning start step from STARTED to IN_PROGRESS`);

            // Transition step status
            await UPDATE(Steps, startStep.ID).with({
                status: Step.status.IN_PROGRESS,
                modifiedBy_ID: userUUID
            });

            // Record status transition in StepHistory (AFTER SUBMIT is logged)
            await INSERT.into(StepHistory).entries({
                step_ID: startStep.ID,
                action: 'STATUS_CHANGE',
                fromValue: Step.status.STARTED,
                toValue: Step.status.IN_PROGRESS,
                actor_ID: userUUID,
                createdBy_ID: userUUID,
                modifiedBy_ID: userUUID,
                timestamp: new Date().toISOString(),
                comment: 'Step transitioned to approval phase on request submission'
            });

            // Create approvals for the start step now that data is submitted
            const requestData = await this.workflowEngine.getRequestDataPayload(requestID);
            requestData['__request_priority'] = request.priority;

            const approverResolver = new ApproverResolver(this.srv);

            const approvers = await approverResolver.resolveApprovers(
                startStep.stepDefinition_ID,
                request.requestType_ID,
                requestData
            );

            if (approvers.length > 0) {
                await this.workflowEngine.createApprovals(requestID, startStep.ID, approvers, userUUID);
            } else {
                // No approval rules defined → auto-complete this step
                this.log.info(`No approvers for step - auto-completing and advancing workflow`);

                await UPDATE(Steps, startStep.ID).with({
                    status: Step.status.COMPLETED,
                    modifiedBy_ID: userUUID
                });

                const comment = 'Step auto-completed - no approval rules defined';
                const timestamp = new Date().toISOString();

                await INSERT.into(StepHistory).entries({
                    step_ID: startStep.ID,
                    action: 'AUTO_COMPLETE',
                    fromValue: Step.status.IN_PROGRESS,
                    toValue: Step.status.COMPLETED,
                    actor_ID: userUUID,
                    createdBy_ID: userUUID,
                    modifiedBy_ID: userUUID,
                    timestamp: timestamp,
                    comment: comment
                });

                // Advance workflow to next step
                await this.workflowEngine.advance(requestID, userUUID);
            }
        }

        // 6. Advance workflow (will transition SUBMITTED → IN_PROGRESS)
        await this.workflowEngine.advance(requestID, userUUID);

        return SELECT.from(Requests, requestID);
    }

    /**
     * Withdraw a Request - cancels the request if not completed
     */
    private async onWithdraw(req: cds.Request) {
        const { Requests } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const requestID = param.ID;

        this.log.info(`Withdrawing Request ID: ${requestID}`);

        // 1. Check if request can be withdrawn (not COMPLETED)
        const request = await SELECT.one.from(Requests, requestID).columns('status') as { status: string } | null;
        if (request?.status === Request.status.COMPLETED) {
            return req.error(400, 'Cannot withdraw a completed request.');
        }

        // Resolve submitter UUID (supports multi-IDP)
        const origin = (req.user as any).origin || 'sap.default';
        const userUUID = await this.userResolver.resolveUserUUID(req.user.id, origin);
        if (!userUUID) {
            return req.error(500, `Shadow user not found for ${origin}:${req.user.id}`);
        }

        // 3. Update Status
        await UPDATE(Requests, requestID).with({
            status: Request.status.WITHDRAWN,
            modifiedBy_ID: userUUID
        });

        // 4. Record History
        await this.recordHistory(requestID, null, 'WITHDRAW', userUUID, undefined);

        return SELECT.from(Requests, requestID);
    }

    /**
     * Record an event in RequestHistory
     * @param userUUID - The ShadowUser UUID (not IDP user ID)
     */
    private async recordHistory(
        requestId: string,
        stepId: string | null,
        action: string,
        userUUID: string | null,
        comment?: string
    ) {
        const { RequestHistory } = this.srv.entities;
        await INSERT.into(RequestHistory).entries({
            request_ID: requestId,
            step_ID: stepId,
            action,
            actor_ID: userUUID,
            createdBy_ID: userUUID,
            modifiedBy_ID: userUUID,
            timestamp: new Date().toISOString(),
            comment
        });
    }
}
