import { cds, SELECT, INSERT, UPDATE } from './db';
import { ApproverResolver, ResolvedApprover } from './approver-resolver';
import { ConditionEvaluator } from './condition-evaluator';
import { Request, Step, StepApproval, RequestData, StepDefinition, StepDependency, ApproverRule } from '../../@cds-models/RequestService';


// Type definitions for runtime Step data
interface RuntimeStep {
    ID: string;
    stepDefinition_ID: string;
    status: string;
    decisionAction?: string | null; // The action taken to complete this step
}

// Extended type for StepDefinition with owner fields (not in RequestService projection types)
type StepDefinitionWithOwner = StepDefinition & {
    ownerType?: string | null;
    ownerId?: string | null;
    approverType?: string | null;
    approverId?: string | null;
    inputMapping?: string | null;
    conditionLogic?: string | null;
    actionSubType?: string | null;
    stepType?: string | null;
};

/**
 * WorkflowEngine
 * 
 * Central engine for orchestrating workflow transitions.
 * Handles:
 * - Starting workflows (Request Create -> Start Step)
 * - Advancing workflow (Step Completion -> Next Step Activation)
 * - Assigning Approvers (Dynamic Resolution)
 * - SLA Monitoring (TBD)
 */
export class WorkflowEngine {

    private db: cds.Service;
    private log = cds.log('workflow');
    private approverResolver: ApproverResolver;
    private conditionEvaluator: ConditionEvaluator;

    constructor(db: cds.Service) {
        this.db = db;
        this.approverResolver = new ApproverResolver(db);
        this.conditionEvaluator = new ConditionEvaluator();
    }

    /**
     * Advance the workflow for a given request.
     * Evaluates the current state of all steps and activates next steps based on dependencies.
     * @param requestId - The request ID
     * @param userUUID - Optional ShadowUser UUID for audit trail (null for system operations)
     * @param sourceRequestId - Optional source request ID for copying data
     */
    public async advance(requestId: string, userUUID?: string | null, sourceRequestId?: string): Promise<void> {
        this.log.info(`Advancing Request ${requestId}`);

        const { Requests, StepDefinitions, Steps, StepDependencies } = this.db.entities;

        // 1. Fetch Request (include coordinator for fallback step ownership)
        const request = await SELECT.one.from(Requests).where({ ID: requestId }).columns('ID', 'requestType_ID', 'status', 'priority', 'createdBy', 'coordinatorType', 'coordinatorId') as Request & { createdBy: string; coordinatorType?: string; coordinatorId?: string };
        if (!request) {
            this.log.error(`Request ${requestId} not found during advance.`);
            return;
        }

        // 2. Fetch all Step Definitions (include ownerType/ownerId for default assignment)
        const definitions = await SELECT.from(StepDefinitions)
            .where({ requestType_ID: request.requestType_ID })
            .columns('*', 'ownerType', 'ownerId', 'approverType', 'approverId') as StepDefinitionWithOwner[];
        const validDefinitions = definitions.filter(d => d.ID);

        // 3. Fetch Existing Steps (include decisionAction for conditional branching)
        const existingSteps = await SELECT.from(Steps)
            .where({ request_ID: requestId })
            .columns('ID', 'stepDefinition_ID', 'status', 'decisionAction') as RuntimeStep[];

        const createdDefIds = new Set(existingSteps.map(s => s.stepDefinition_ID));
        const completedDefIds = new Set(existingSteps
            .filter(s => s.status === Step.status.COMPLETED || s.status === Step.status.SKIPPED)
            .map(s => s.stepDefinition_ID));

        // 4. Determine Steps to Activate
        const stepsToActivate: StepDefinitionWithOwner[] = [];
        const sortedDefs = [...validDefinitions];

        // Build index map for sequential fallback
        const defIndexMap = new Map<string, number>();
        sortedDefs.forEach((def, idx) => {
            if (def.ID) defIndexMap.set(def.ID as string, idx);
        });

        for (const def of sortedDefs) {
            const defId = def.ID as string;
            if (createdDefIds.has(defId)) continue; // Already created

            if (def.isStartStep) {
                stepsToActivate.push(def);
                continue;
            }

            // 1. Get ALL StepDefinitions that could possibly follow this step
            // 2. Filter them based on the specific ACTION taken in the completed predecessors
            // This is a more complex multi-branching logic.

            const completedSteps = await SELECT.from(Steps)
                .where({ request_ID: requestId, status: { in: [Step.status.COMPLETED, Step.status.SKIPPED] } })
                .columns('ID', 'stepDefinition_ID', 'modifiedBy_ID');

            // Find the most recently completed step to determine the "action" context
            // In a better design, we'd pass the action ID explicitly to advance(), 
            // but for now we look at the last completed step's history to find the action label.
            // Or better: StepDependencies has 'action' field. We match it.

            const predecessors = await SELECT.from(StepDependencies)
                .where({ step_ID: defId })
                .columns('dependsOn_ID', 'action') as (StepDependency & { action?: string | null })[];

            if (predecessors.length > 0) {
                // Explicit dependencies — use ANY (some) logic for merge nodes.
                // A node activates if AT LEAST ONE incoming edge has a completed
                // predecessor whose decisionAction matches the edge's action constraint.
                // This is critical for branching: untaken branches will never complete,
                // so requiring ALL predecessors would deadlock merge nodes.
                const anyPredecessorComplete = predecessors.some(
                    (p) => {
                        if (!p.dependsOn_ID || !completedDefIds.has(p.dependsOn_ID)) return false;
                        // If edge has an action constraint, verify the runtime step's decisionAction matches
                        if (p.action) {
                            const runtimeStep = existingSteps.find(s => s.stepDefinition_ID === p.dependsOn_ID);
                            const matches = runtimeStep?.decisionAction === p.action;
                            this.log.info(`  Edge ${p.dependsOn_ID} -> ${defId} [action=${p.action}]: runtimeAction=${runtimeStep?.decisionAction}, match=${matches}`);
                            return matches;
                        }
                        return true; // No action constraint = any completion activates
                    }
                );
                if (anyPredecessorComplete) stepsToActivate.push(def);
            } else {
                // Sequential fallback
                const currentDefIndex = defIndexMap.get(defId) ?? 999;
                const previousDefs = sortedDefs.filter((d, idx) => idx < currentDefIndex);
                const allPreviousComplete = previousDefs.every(
                    (d) => d.ID && completedDefIds.has(d.ID as string)
                );
                if (allPreviousComplete && previousDefs.length > 0) {
                    this.log.info(`Sequential fallback: ${def.stepName} activating`);
                    stepsToActivate.push(def);
                }
            }
        }

        // 5. Activate New Steps
        if (stepsToActivate.length > 0) {
            await this.activateNewSteps(requestId, request, stepsToActivate, userUUID, sourceRequestId);
        } else {
            // 6. Check Completion
            await this.checkWorkflowCompletion(requestId, request, definitions.length, existingSteps, userUUID);
        }
    }

    /**
     * Activate a list of new steps
     */
    private async activateNewSteps(
        requestId: string,
        request: Request & { createdBy: string; coordinatorType?: string; coordinatorId?: string },
        stepsToActivate: StepDefinitionWithOwner[],
        userUUID?: string | null,
        sourceRequestId?: string
    ) {
        const { Steps, StepHistory, RequestData } = this.db.entities;
        this.log.info(`Activating ${stepsToActivate.length} new step(s)`);

        // Prepare data for approver resolution once
        const requestData = await this.getRequestDataPayload(requestId);
        requestData['__request_priority'] = request.priority;
        requestData['__request_status'] = request.status;

        for (const def of stepsToActivate) {
            const defId = def.ID as string;
            const slaDays = def.slaDays || 3;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + slaDays);

            let initialStatus: string = Step.status.UPCOMING;
            const isApprovalStep = def.stepType === 'action' && (def.actionSubType === 'approval' || def.actionSubType === 'userTask');
            const isEndStep = def.stepType === 'end' || (def.stepType === 'action' && def.actionSubType === 'end');
            const isConditionStep = def.stepType === 'condition';

            if (def.isStartStep) {
                initialStatus = request.status === Request.status.DRAFT ? Step.status.STARTED : Step.status.IN_PROGRESS;
            } else if (isApprovalStep || def.actionSubType === 'user_task') {
                // Approval and User Task steps skip STARTED and go directly to
                // IN_PROGRESS so approvals are resolved immediately.
                // For user_task: the Approver (not Requestor) fills in the form
                // and takes a decision, so the task must appear in their inbox.
                initialStatus = Step.status.IN_PROGRESS;
            } else if (isEndStep || isConditionStep) {
                // Condition nodes also complete instantly upon activation
                initialStatus = Step.status.COMPLETED;
            } else {
                initialStatus = Step.status.STARTED;
            }

            const newStepId = cds.utils.uuid();

            // Determine the audit actor (use request creator for initial step creation)
            const auditActor = userUUID || request.createdBy || null;

            // Determine step owner: use StepDefinition's default owner if defined,
            // otherwise fall back to Request's coordinator
            const stepOwnerType = def.ownerType || request.coordinatorType || 'USER';
            const stepOwnerId = def.ownerId || request.coordinatorId;

            await INSERT.into(Steps).entries({
                ID: newStepId,
                request_ID: requestId,
                stepDefinition_ID: defId,
                status: initialStatus,
                dueDate: dueDate.toISOString(),
                reminderSent: false,
                ownerType: stepOwnerType,
                ownerId: stepOwnerId,
                createdBy_ID: auditActor,
                modifiedBy_ID: auditActor
            });

            // Ensure RequestData record exists for the new step to enable frontend data capture
            let initialPayload = '{}';

            // Resolve Input Mappings if any
            if (def.inputMapping && def.inputMapping !== '{}') {
                const combinedData = await this.getRequestDataPayload(requestId);
                initialPayload = this.resolveMapping(def.inputMapping, combinedData);
                this.log.info(`[WorkflowEngine] Applied input mapping for step ${def.stepName}`);
            }

            if (sourceRequestId && def.isStartStep) {
                this.log.info(`[WorkflowEngine] Attempting to deep copy Step 1 data from source request ${sourceRequestId} to new request ${requestId}`);

                try {
                    // NOTE: .and('stepDefinition.isStartStep = true') does NOT work in programmatic
                    // SELECT on db entities — association path joins are not supported at runtime.
                    // Instead, we use an explicit 2-step lookup:

                    // 1. Get all steps for the source request that share the SAME stepDefinition
                    //    as the current start step being activated (defId).
                    const sourceStep = await SELECT.one.from(Steps)
                        .where({ request_ID: sourceRequestId, stepDefinition_ID: defId })
                        .columns('ID');

                    if (sourceStep) {
                        this.log.debug(`[WorkflowEngine] Found source step ${sourceStep.ID} for definition ${defId}`);

                        // 2. Fetch the payload from RequestData for that step
                        const sourceData = await SELECT.one.from(RequestData)
                            .where({ step_ID: sourceStep.ID })
                            .columns('payload');

                        if (sourceData?.payload && sourceData.payload !== '{}') {
                            initialPayload = sourceData.payload;
                            this.log.info(`[WorkflowEngine] Copied Step 1 payload (${initialPayload.length} chars) from source request ${sourceRequestId}`);
                        } else {
                            // Fallback: try to find ANY step in source request and grab its RequestData
                            // This handles the case where stepDefinition_ID differs due to schema changes
                            this.log.warn(`[WorkflowEngine] Step found but payload empty - trying any step in source request...`);
                            const anyStep = await SELECT.one.from(Steps)
                                .where({ request_ID: sourceRequestId })
                                .columns('ID');
                            if (anyStep) {
                                const fallbackData = await SELECT.one.from(RequestData)
                                    .where({ step_ID: anyStep.ID })
                                    .columns('payload');
                                if (fallbackData?.payload && fallbackData.payload !== '{}') {
                                    initialPayload = fallbackData.payload;
                                    this.log.info(`[WorkflowEngine] Fallback: copied payload (${initialPayload.length} chars) from step ${anyStep.ID}`);
                                }
                            }
                        }
                    } else {
                        this.log.warn(`[WorkflowEngine] No step found with stepDefinition_ID=${defId} in source request ${sourceRequestId}`);
                    }
                } catch (err) {
                    this.log.error(`[WorkflowEngine] Error during Step 1 data copy from ${sourceRequestId}:`, err);
                }
            }

            await INSERT.into(RequestData).entries({
                step_ID: newStepId,
                payload: initialPayload,
                createdBy_ID: auditActor,
                modifiedBy_ID: auditActor
            });


            // Log Creation
            await INSERT.into(StepHistory).entries({
                step_ID: newStepId,
                action: 'CREATED',
                toValue: initialStatus,
                actor_ID: auditActor,
                createdBy_ID: auditActor,
                modifiedBy_ID: auditActor,
                timestamp: new Date().toISOString(),
                comment: `Step "${def.stepName}" created`
            });

            // Log Activation (system action for non-start steps)
            if (initialStatus === Step.status.STARTED && !def.isStartStep) {
                await INSERT.into(StepHistory).entries({
                    step_ID: newStepId,
                    action: 'ACTIVATED',
                    fromValue: Step.status.UPCOMING,
                    toValue: Step.status.STARTED,
                    actor_ID: null, // System action
                    createdBy_ID: auditActor,
                    modifiedBy_ID: auditActor,
                    timestamp: new Date().toISOString(),
                    comment: `Step "${def.stepName}" activated`
                });

                // Emit notification event for data input (async)
                const payload = {
                    stepId: newStepId,
                    requestId
<<<<<<< HEAD
                };

                const req = (cds as any).context;
                if (req) {
                    req.on('succeeded', () => {
                        (cds as any).emit('sap.cre.StepActivated', payload);
                    });
                } else {
                    (cds as any).emit('sap.cre.StepActivated', payload);
                }
=======
                });
            } else if (isEndStep) {
                await INSERT.into(StepHistory).entries({
                    step_ID: newStepId,
                    action: 'AUTO_COMPLETE',
                    fromValue: Step.status.UPCOMING,
                    toValue: Step.status.COMPLETED,
                    actor_ID: null,
                    createdBy_ID: auditActor,
                    modifiedBy_ID: auditActor,
                    timestamp: new Date().toISOString(),
                    comment: `Step "${def.stepName}" auto-completed (End Step)`
                });

                // Trigger final completion check
                await this.advance(requestId, userUUID, sourceRequestId);
>>>>>>> a267c5224a1b3be3c50640fa8bcba77e119e590f
            }

            // Handle End Nodes: auto-complete and check workflow completion
            if (def.stepType === 'end') {
                this.log.info(`[WorkflowEngine] End node "${def.stepName}" (${defId}) — auto-completing`);

                await UPDATE(Steps, newStepId).with({
                    status: Step.status.COMPLETED,
                    modifiedBy_ID: auditActor
                });

                await INSERT.into(StepHistory).entries({
                    step_ID: newStepId,
                    action: 'AUTO_COMPLETE',
                    fromValue: initialStatus,
                    toValue: Step.status.COMPLETED,
                    actor_ID: null, // System action
                    createdBy_ID: auditActor,
                    modifiedBy_ID: auditActor,
                    timestamp: new Date().toISOString(),
                    comment: `End node "${def.stepName}" auto-completed`
                });

                // Check if workflow should be marked as completed
                // Recurse to handle workflow completion check
                await this.advance(requestId, userUUID, sourceRequestId);
                continue; // Skip normal approval flow
            }

            // Handle Condition Nodes: auto-evaluate and self-complete
            if (def.stepType === 'condition') {
                this.log.info(`[Condition] Node "${def.stepName}" (${defId}) — evaluating conditionExpr`);

                // Read conditionExpr from StepDefinition
                const { StepDefinitions: StepDefs } = this.db.entities;
                const condDef = await SELECT.one.from(StepDefs)
                    .where({ ID: defId })
                    .columns('conditionExpr') as { conditionExpr?: string | null };

                const condExpr = condDef?.conditionExpr || null;
                this.log.info(`[Condition] conditionExpr: ${condExpr}`);
                this.log.info(`[Condition] requestData keys: ${Object.keys(requestData).join(', ')}`);
                const result = this.conditionEvaluator.evaluate(condExpr, requestData);
                const decisionAction = result ? 'true' : 'false';

                this.log.info(`[Condition] Node "${def.stepName}" evaluated to: ${decisionAction} (raw=${result})`);

                // Self-complete with the evaluation result
                await UPDATE(Steps, newStepId).with({
                    status: Step.status.COMPLETED,
                    decisionAction,
                    modifiedBy_ID: auditActor
                });

                await INSERT.into(StepHistory).entries({
                    step_ID: newStepId,
                    action: 'AUTO_COMPLETE',
                    fromValue: initialStatus,
                    toValue: Step.status.COMPLETED,
                    actor_ID: null, // System action
                    createdBy_ID: auditActor,
                    modifiedBy_ID: auditActor,
                    timestamp: new Date().toISOString(),
                    comment: `Condition "${def.stepName}" evaluated to ${decisionAction}`
                });

                // Recurse to advance to the next matching branch
                await this.advance(requestId, userUUID, sourceRequestId);
                continue; // Skip normal approval flow
            }

            // Create Approvals if step is in IN_PROGRESS (start step after submit, or approval step)
            if (initialStatus === Step.status.IN_PROGRESS && request.requestType_ID) {
                let approvers = await this.approverResolver.resolveApprovers(
                    defId,
                    request.requestType_ID,
                    requestData
                );

                // Fallback to fixed approver if no rules matched
                if (approvers.length === 0 && def.approverId) {
                    const displayName = await this.approverResolver.lookupDisplayName(def.approverId, def.approverType || 'USER');
                    approvers = [{
                        approverId: def.approverId,
                        approverDisplayName: displayName,
                        approverType: def.approverType || 'USER',
                        ruleName: 'Fixed Approver'
                    }];
                }

                if (approvers.length > 0) {
                    await this.createApprovals(requestId, newStepId, approvers, auditActor);
                } else if (def.actionSubType === 'approval' || def.actionSubType === 'user_task') {
                    // CRITICAL FIX: Do NOT auto-complete approval/user_task steps.
                    // These steps require human interaction.
                    // Fallback: assign to step owner or coordinator.
                    const fallbackApprover = stepOwnerId || request.coordinatorId;
                    if (fallbackApprover) {
                        this.log.warn(`[WorkflowEngine] No dynamic approvers for ${def.actionSubType} step "${def.stepName}". Falling back to owner/coordinator: ${fallbackApprover}`);
                        await this.createApprovals(requestId, newStepId, [{
                            approverId: fallbackApprover,
                            approverDisplayName: 'Fallback Approver',
                            approverType: stepOwnerType,
                            ruleName: 'Fallback (no dynamic approvers)',
                            principalId: fallbackApprover
                        }], auditActor);
                    } else {
                        // No fallback — leave step as IN_PROGRESS (Unassigned)
                        this.log.error(`[WorkflowEngine] No approvers AND no fallback owner for ${def.actionSubType} step "${def.stepName}". Step left IN_PROGRESS (unassigned).`);
                        // Do NOT auto-complete. Step stays IN_PROGRESS waiting for manual assignment.
                    }
                } else {
                    // Non-approval/user_task steps (e.g., data_input, system) — auto-complete is safe
                    this.log.info(`No approvers for step ${def.stepName} (type=${def.actionSubType}) - auto-completing`);
                    await UPDATE(Steps, newStepId).with({
                        status: Step.status.COMPLETED,
                        modifiedBy_ID: auditActor
                    });

                    await INSERT.into(StepHistory).entries({
                        step_ID: newStepId,
                        action: 'AUTO_COMPLETE',
                        fromValue: Step.status.IN_PROGRESS,
                        toValue: Step.status.COMPLETED,
                        actor_ID: null, // System action
                        createdBy_ID: auditActor,
                        modifiedBy_ID: auditActor,
                        timestamp: new Date().toISOString(),
                        comment: 'Auto-completed (no approvers)'
                    });

                    // Recurse
                    await this.advance(requestId, userUUID, sourceRequestId);
                }
            } else if (isConditionStep) {
                // Instantly evaluate condition against current request payload
                const combinedData = await this.getRequestDataPayload(requestId);
                const conditionResult = this.evaluateConditionLogic(def.conditionLogic, combinedData);

                this.log.info(`Condition Node "${def.stepName}" evaluated to ${conditionResult}`);

                await INSERT.into(StepHistory).entries({
                    step_ID: newStepId,
                    action: 'CONDITION_EVAL',
                    fromValue: Step.status.UPCOMING,
                    toValue: Step.status.COMPLETED,
                    actor_ID: null, // System action
                    createdBy_ID: auditActor,
                    modifiedBy_ID: auditActor,
                    timestamp: new Date().toISOString(),
                    comment: conditionResult ? 'true' : 'false'
                });

                // Immediately advance workflow to evaluate dependent edges
                await this.advance(requestId, userUUID, sourceRequestId);
            }
        }
    }

    /**
     * Check if the entire workflow is complete
     */
    private async checkWorkflowCompletion(
        requestId: string,
        request: Request,
        totalStepDefinitions: number,
        existingSteps: RuntimeStep[],
        userUUID?: string | null
    ) {
        const { Requests, RequestHistory } = this.db.entities;

        // Re-fetch steps to get the latest state (important after recursive advance calls)
        const { Steps: StepsEntity } = this.db.entities;
        const freshSteps = await SELECT.from(StepsEntity)
            .where({ request_ID: requestId })
            .columns('ID', 'stepDefinition_ID', 'status', 'decisionAction') as RuntimeStep[];

        // BRANCHING FIX: Do NOT require all definitions to be created.
        // In a branching workflow, untaken branches are never instantiated,
        // so existingSteps.length will be less than totalStepDefinitions.
        // Instead, check: no steps in progress AND no new steps to activate
        // (the latter is guaranteed since this method is called only when
        // stepsToActivate.length === 0).

        const allStepsTerminal = freshSteps.every((s) =>
            s.status === Step.status.COMPLETED || s.status === Step.status.SKIPPED || s.status === Step.status.REJECTED
        );

        const anyStepsInProgress = freshSteps.some((s) =>
            s.status === Step.status.IN_PROGRESS ||
            s.status === Step.status.STARTED ||
            s.status === Step.status.IN_CLARIFICATION
        );

        this.log.info(`Workflow status check: ${freshSteps.length}/${totalStepDefinitions} created steps, allTerminal=${allStepsTerminal}, anyInProgress=${anyStepsInProgress}`);

        if (allStepsTerminal && !anyStepsInProgress && freshSteps.length > 0) {
            this.log.info(`All steps completed for Request ${requestId}.`);

            // Check if any step was COMPLETED/REJECTED via a "Reject" action or intent
            const { StepApprovals } = this.db.entities;
            const stepIds = freshSteps.map(s => s.ID);

            // 1. Explicit Step Rejection Status
            const hasRejectedStepStatus = freshSteps.some(s => s.status === Step.status.REJECTED);

            // 2. Intent-based Rejection (decisionAction contains "reject")
            const hasRejectionAction = freshSteps.some(s => s.decisionAction && /reject/i.test(s.decisionAction));

            // 3. Any individual approval record was REJECTED
            const rejectedApprovals = await SELECT.from(StepApprovals)
                .where({ step_ID: { in: stepIds }, status: StepApproval.status.REJECTED });

            const wasRejected = hasRejectedStepStatus || hasRejectionAction || rejectedApprovals.length > 0;

            const finalStatus = wasRejected ? Request.status.REJECTED : Request.status.COMPLETED;

            if (request.status !== finalStatus) {
                await UPDATE(Requests, requestId).with({
                    status: finalStatus,
                    modifiedBy_ID: userUUID
                });

                await INSERT.into(RequestHistory).entries({
                    request_ID: requestId,
                    action: 'STATUS_CHANGE',
                    actor_ID: null, // System action
                    createdBy_ID: userUUID,
                    modifiedBy_ID: userUUID,
                    timestamp: new Date().toISOString(),
                    comment: `Request ${finalStatus}`
                });
            }
        } else if (request.status === Request.status.SUBMITTED) {
            // Ensure IN_PROGRESS if submitted but not done
            await UPDATE(Requests, requestId).with({ status: Request.status.IN_PROGRESS });
        }
    }

    /**
     * Helper to get consolidated request data for rule evaluation.
     * RESOLVED N+1 ISSUE: Performs a single bulk query for all steps.
     * 
     * IMPORTANT: Payload data is stored keyed by field IDs (e.g., "text-1772758341638").
     * Conditions and approver rules reference bindTo names (e.g., "department").
     * This method applies the outputsContent mapping from StepDefinitions to create
     * aliased keys so both field-ID keys and bindTo keys are available.
     */
    public async getRequestDataPayload(requestId: string): Promise<Record<string, unknown>> {
        const { Steps, RequestData, Requests, StepDefinitions: StepDefs } = this.db.entities;

        // 1. Get All Steps for Request (with their stepDefinition_ID for output mapping)
        const steps = await SELECT.from(Steps)
            .where({ request_ID: requestId })
            .columns('ID', 'stepDefinition_ID');

        let combinedData: Record<string, unknown> = {};

        if (steps.length > 0) {
            // Bulk fetch all payload data
            const stepIds = steps.map((s: { ID: string }) => s.ID);
            const allRequestData = await SELECT.from(RequestData)
                .where({ step_ID: { in: stepIds } })
                .columns('step_ID', 'payload');

            for (const data of allRequestData) {
                if (data.payload) {
                    try {
                        const parsed = JSON.parse(data.payload);
                        combinedData = { ...combinedData, ...parsed };
                    } catch (e) {
                        this.log.warn(`Failed to parse RequestData payload`, e);
                    }
                }
            }

            // 2. Apply outputsContent bindTo mappings from step definitions.
            //    This translates field-ID keys (e.g., "text-1772758341638") to
            //    their bindTo names (e.g., "department") so conditions can reference them.
            const stepDefIds = [...new Set(steps.map((s: { stepDefinition_ID: string }) => s.stepDefinition_ID).filter(Boolean))];
            if (stepDefIds.length > 0) {
                const defs = await SELECT.from(StepDefs)
                    .where({ ID: { in: stepDefIds } })
                    .columns('ID', 'outputsContent') as { ID: string; outputsContent?: string | null }[];

                for (const def of defs) {
                    if (!def.outputsContent) continue;
                    try {
                        const outputs = JSON.parse(def.outputsContent) as Array<{
                            sourcePath?: string;
                            bindTo?: string;
                        }>;
                        for (const output of outputs) {
                            if (output.sourcePath && output.bindTo && output.sourcePath !== output.bindTo) {
                                const rawValue = combinedData[output.sourcePath];
                                if (rawValue !== undefined) {
                                    combinedData[output.bindTo] = rawValue;
                                    this.log.info(`[DataMapping] ${output.sourcePath} -> ${output.bindTo} = ${rawValue}`);
                                }
                            }
                        }
                    } catch (e) {
                        this.log.warn(`Failed to parse outputsContent for stepDef ${def.ID}`, e);
                    }
                }
            }
        }

        // 3. Inject System Fields for mapping support
        const { ShadowUsers } = this.db.entities;
        const request = await SELECT.one.from(Requests).where({ ID: requestId }).columns('displayId', 'title', 'createdBy_ID');
        if (request) {
            combinedData['__request_uuid'] = requestId;
            combinedData['__request_displayId'] = request.displayId;
            combinedData['__request_title'] = request.title;

            if (request.createdBy_ID) {
                const user = await SELECT.one.from(ShadowUsers).where({ ID: request.createdBy_ID }).columns('displayName', 'email');
                combinedData['__requester_name'] = user?.displayName || user?.email || 'Requester';
            }
        }

        this.log.info(`[getRequestDataPayload] Final keys: ${Object.keys(combinedData).join(', ')}`);
        return combinedData;
    }

    /**
     * Resolve and apply input mapping for a step
     */
    private resolveMapping(mappingStr: string | null | undefined, combinedData: Record<string, unknown>): string {
        if (!mappingStr || mappingStr === '{}') return '{}';

        try {
            const mapping = JSON.parse(mappingStr);
            const payload: Record<string, unknown> = {};

            // Mapping format: { [targetFieldId]: { sourceStepId, sourceFieldId } }
            for (const [targetKey, sourceInfo] of Object.entries(mapping)) {
                if (sourceInfo && typeof sourceInfo === 'object') {
                    const { sourceFieldId } = sourceInfo as any;
                    if (sourceFieldId && combinedData[sourceFieldId] !== undefined) {
                        payload[targetKey] = combinedData[sourceFieldId];
                    }
                }
            }

            return JSON.stringify(payload);
        } catch (e) {
            this.log.error(`Failed to resolve input mapping:`, e);
            return '{}';
        }
    }

    /**
     * Evaluates condition rules against request data payload
     */
    private evaluateConditionLogic(logicStr: string | null | undefined, combinedData: Record<string, unknown>): boolean {
        if (!logicStr || logicStr === '{}') return true; // Default true if no logic

        try {
            const logic = JSON.parse(logicStr) as { matchType: 'AND' | 'OR', rules: { fieldId: string, operator: string, value: string }[] };
            if (!logic.rules || logic.rules.length === 0) return true;

            const evaluateRule = (rule: { fieldId: string, operator: string, value: string }): boolean => {
                const dataValue = combinedData[rule.fieldId];
                if (dataValue === undefined || dataValue === null) return false;

                const stringData = String(dataValue).toLowerCase();
                const stringTarget = String(rule.value || '').toLowerCase();

                switch (rule.operator) {
                    case 'EQUALS':
                        return stringData === stringTarget;
                    case 'NOT_EQUALS':
                        return stringData !== stringTarget;
                    case 'CONTAINS':
                        return stringData.includes(stringTarget);
                    case 'GREATER_THAN':
                        return Number(dataValue) > Number(rule.value);
                    case 'LESS_THAN':
                        return Number(dataValue) < Number(rule.value);
                    default:
                        return false;
                }
            };

            if (logic.matchType === 'AND') {
                return logic.rules.every(evaluateRule);
            } else { // 'OR'
                return logic.rules.some(evaluateRule);
            }
        } catch (e) {
            this.log.error(`Failed to evaluate condition logic:`, e);
            return false;
        }
    }

    /**
     * Shared method to create approvals for a step.
     * Used by WorkflowEngine (automatic) and RequestHandler (manual submit).
     * @param requestId - The request ID (used for notification context)
     * @param stepId - The step ID to create approvals for
     * @param approvers - List of resolved approvers
     * @param userUUID - Optional ShadowUser UUID for audit trail
     */
    public async createApprovals(requestId: string, stepId: string, approvers: ResolvedApprover[], userUUID?: string | null): Promise<void> {
        const { StepApprovals } = this.db.entities;

        for (let i = 0; i < approvers.length; i++) {
            const approver = approvers[i];
            const approvalId = cds.utils.uuid();
            await INSERT.into(StepApprovals).entries({
                ID: approvalId,
                step_ID: stepId,
                approver: approver.approverId,
                approverDisplayName: approver.approverDisplayName,
                status: i === 0 ? StepApproval.status.PENDING : StepApproval.status.WAITING,
                ruleName: approver.ruleName,
                approverType: approver.approverType,
                createdBy_ID: userUUID,
                modifiedBy_ID: userUUID
            });

            // Emit notification event (async, non-blocking)
            // IMPORTANT: Emit the event ONLY after the transaction succeeds (commits)
            // to avoid race conditions where the handler queries uncommitted DB records.
            // Also pass the full approval data to reduce DB lookups.
            const payload = {
                stepApprovalId: approvalId,
                stepId,
                requestId,
                approval: {
                    ID: approvalId,
                    step_ID: stepId,
                    approver: approver.approverId,
                    approverDisplayName: approver.approverDisplayName,
                    status: i === 0 ? StepApproval.status.PENDING : StepApproval.status.WAITING,
                    ruleName: approver.ruleName,
                    approverType: approver.approverType
                }
            };

            const req = (cds as any).context;
            if (req) {
                req.on('succeeded', () => {
                    (cds as any).emit('sap.cre.StepApprovalCreated', payload);
                });
            } else {
                (cds as any).emit('sap.cre.StepApprovalCreated', payload);
            }
        }
        this.log.info(`Created ${approvers.length} approval(s) for step ${stepId}`);
    }
}
