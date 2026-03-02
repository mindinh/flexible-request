import { cds, SELECT, INSERT, UPDATE } from './db';
import { ApproverResolver, ResolvedApprover } from './approver-resolver';
import { Request, Step, StepApproval, RequestData, StepDefinition, StepDependency, ApproverRule } from '../../@cds-models/RequestService';


// Type definitions for runtime Step data
interface RuntimeStep {
    ID: string;
    stepDefinition_ID: string;
    status: string;
}

// Extended type for StepDefinition with owner fields (not in RequestService projection types)
type StepDefinitionWithOwner = StepDefinition & {
    ownerType?: string | null;
    ownerId?: string | null;
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

    constructor(db: cds.Service) {
        this.db = db;
        this.approverResolver = new ApproverResolver(db);
    }

    /**
     * Advance the workflow for a given request.
     * Evaluates the current state of all steps and activates next steps based on dependencies.
     * @param requestId - The request ID
     * @param userUUID - Optional ShadowUser UUID for audit trail (null for system operations)
     */
    public async advance(requestId: string, userUUID?: string | null): Promise<void> {
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
            .columns('*', 'ownerType', 'ownerId') as StepDefinitionWithOwner[];
        const validDefinitions = definitions.filter(d => d.ID);

        // 3. Fetch Existing Steps
        const existingSteps = await SELECT.from(Steps)
            .where({ request_ID: requestId })
            .columns('ID', 'stepDefinition_ID', 'status') as RuntimeStep[];

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

            // Check dependencies
            const predecessors = await SELECT.from(StepDependencies)
                .where({ step_ID: defId })
                .columns('dependsOn_ID') as StepDependency[];

            if (predecessors.length > 0) {
                // Explicit dependencies
                const allPredecessorsComplete = predecessors.every(
                    (p) => p.dependsOn_ID && completedDefIds.has(p.dependsOn_ID)
                );
                if (allPredecessorsComplete) stepsToActivate.push(def);
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
            await this.activateNewSteps(requestId, request, stepsToActivate, userUUID);
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
        userUUID?: string | null
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

            if (def.isStartStep) {
                initialStatus = request.status === Request.status.DRAFT ? Step.status.STARTED : Step.status.IN_PROGRESS;
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
            await INSERT.into(RequestData).entries({
                step_ID: newStepId,
                payload: JSON.stringify({}),
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
                (cds as any).emit('sap.cre.StepActivated', {
                    stepId: newStepId,
                    requestId
                });
            }

            // Create Approvals if needed
            if (initialStatus === Step.status.IN_PROGRESS && request.requestType_ID) {
                const approvers = await this.approverResolver.resolveApprovers(
                    defId,
                    request.requestType_ID,
                    requestData
                );

                if (approvers.length > 0) {
                    await this.createApprovals(requestId, newStepId, approvers, auditActor);
                } else {
                    // Auto-complete (no approvers defined)
                    this.log.info(`No approvers for step ${def.stepName} - auto-completing`);
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
                    await this.advance(requestId, userUUID);
                }
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

        // Re-fetch steps to be safe? Or trust existingSteps? 
        // existingSteps might be stale if we just auto-completed something recursively...
        // But this method is called only if NO new steps were activated in this pass.
        // However, auto-complete calls advance() recursively, so we should be fine.

        const allDefinitionsCreated = existingSteps.length >= totalStepDefinitions;

        const allStepsTerminal = existingSteps.every((s) =>
            s.status === Step.status.COMPLETED || s.status === Step.status.SKIPPED
        );

        const anyStepsInProgress = existingSteps.some((s) =>
            s.status === Step.status.IN_PROGRESS ||
            s.status === Step.status.STARTED ||
            s.status === Step.status.IN_CLARIFICATION
        );

        this.log.info(`Workflow status check: ${existingSteps.length}/${totalStepDefinitions} steps, allTerminal=${allStepsTerminal}`);

        if (allDefinitionsCreated && allStepsTerminal && !anyStepsInProgress && existingSteps.length > 0) {
            this.log.info(`All steps completed for Request ${requestId}.`);
            await UPDATE(Requests, requestId).with({
                status: Request.status.COMPLETED,
                modifiedBy_ID: userUUID
            });

            await INSERT.into(RequestHistory).entries({
                request_ID: requestId,
                action: 'STATUS_CHANGE',
                actor_ID: null, // System action
                createdBy_ID: userUUID,
                modifiedBy_ID: userUUID,
                timestamp: new Date().toISOString(),
                comment: 'Request COMPLETED'
            });
        } else if (request.status === Request.status.SUBMITTED) {
            // Ensure IN_PROGRESS if submitted but not done
            await UPDATE(Requests, requestId).with({ status: Request.status.IN_PROGRESS });
        }
    }

    /**
     * Helper to get consolidated request data for rule evaluation.
     * RESOLVED N+1 ISSUE: Performs a single bulk query for all steps.
     */
    public async getRequestDataPayload(requestId: string): Promise<Record<string, unknown>> {
        const { Steps, RequestData, RequestMasterData } = this.db.entities;

        // 1. Get Master Data (Flat) - Assuming 1:1 with Request
        // Not implemented fully yet but placeholder
        // const masterData = ...

        // 2. Get All Steps for Request
        const steps = await SELECT.from(Steps)
            .where({ request_ID: requestId })
            .columns('ID');

        let combinedData: Record<string, unknown> = {};

        if (steps.length > 0) {
            // Bulk fetch all payload data
            const stepIds = steps.map((s: { ID: string }) => s.ID);
            const allRequestData = await SELECT.from(RequestData)
                .where({ step_ID: { in: stepIds } })
                .columns('payload');

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
        }

        return combinedData;
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
            (cds as any).emit('sap.cre.StepApprovalCreated', {
                stepApprovalId: approvalId,
                stepId,
                requestId
            });
        }
        this.log.info(`Created ${approvers.length} approval(s) for step ${stepId}`);
    }
}
