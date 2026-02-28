import { cds, SELECT, INSERT, DELETE } from '../../lib/db';
import { SharedRequestTypeHandler } from '../SharedRequestTypeHandler';

const LOG = cds.log('request-type-handler');

/**
 * Handles RequestTypes operations: validation, clone action, draft takeover, response enrichment.
 */
export class RequestTypeHandler {
    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all RequestTypes handlers
     */
    register() {
        this.srv.before('DELETE', 'RequestTypes', this.beforeDelete.bind(this));
        this.srv.on('clone', 'RequestTypes', this.onClone.bind(this));
        this.srv.on('discardDraft', 'RequestTypes', this.onDiscardDraft.bind(this));

        // IMPORTANT:
        // Do NOT override READ with srv.on('READ', ...) unless you fully implement the read yourself.
        // Use after('READ') to enrich the payload (works for $expand and doesn't break default read).
        this.srv.after('READ', 'RequestTypes', this.afterRead.bind(this));
        this.srv.after('READ', 'RequestTypes.drafts', this.afterRead.bind(this));

        // Enrich child entities directly — ensures virtual fields are populated
        // even when CAP resolves $expand children independently
        const sharedHandler = new SharedRequestTypeHandler(this.srv);
        this.srv.after('READ', 'StepDefinitions', (data: any) => sharedHandler.enrichStepDefinitions(data));
        this.srv.after('READ', 'StepDefinitions.drafts', (data: any) => sharedHandler.enrichStepDefinitions(data));
        this.srv.after('READ', 'ApproverRules', (data: any) => sharedHandler.enrichApproverRules(data));
        this.srv.after('READ', 'ApproverRules.drafts', (data: any) => sharedHandler.enrichApproverRules(data));
    }

    /**
     * After READ: Enrich expanded steps and approverRules with display names.
     */
    private async afterRead(data: any, req?: cds.Request) {
        await new SharedRequestTypeHandler(this.srv).enrichRequestTypes(data);
    }
    /**
     * Before Delete: Check for active requests
     */
    private async beforeDelete(req: cds.Request) {
        const { Requests } = cds.entities;
        const param = req.params[0] as { ID: string };

        const activeRequests = await SELECT.from(Requests)
            .where({
                requestType_ID: param.ID,
                status: { '!=': 'COMPLETED' },
            })
            .columns('ID');

        if (activeRequests.length > 0) {
            return req.error(409, `Cannot delete: ${activeRequests.length} active request(s) use this type`);
        }
    }

    /**
     * Discard Draft (Force Unlock / Draft Takeover)
     * 
     * Directly deletes the draft of a RequestType from the DB,
     * bypassing CAP's exclusive draft lock. This allows an admin
     * to take over editing when another admin's session is abandoned.
     */
    private async onDiscardDraft(req: cds.Request) {
        const param = req.params[0] as { ID: string };
        const requestTypeId = param.ID;

        LOG.info(`Discarding draft for RequestType ${requestTypeId} (requested by ${req.user?.id})`);

        try {
            const db = await cds.connect.to('db');
            const { RequestTypes: RT } = db.entities;

            // Delete draft rows directly from the drafts table
            // This bypasses the framework-level lock check
            const draftTable = `${RT.name}.drafts`;
            await DELETE.from(draftTable).where({ ID: requestTypeId });

            LOG.info(`Draft discarded for RequestType ${requestTypeId}`);
        } catch (err: any) {
            LOG.error(`Failed to discard draft for ${requestTypeId}:`, err.message);
            return req.error(500, `Failed to discard draft: ${err.message}`);
        }
    }

    /**
     * Clone a RequestType with all its StepDefinitions, Configs, and Dependencies
     */
    private async onClone(req: cds.Request) {
        const { RequestTypes, StepDefinitions, StepDependencies, ApproverRules, StatusNetwork } = this.srv.entities;
        const param = req.params[0] as { ID: string };
        const sourceId = param.ID;

        // 1) Get source RequestType
        const source = await SELECT.one.from(RequestTypes, sourceId);
        if (!source) return req.error(404, 'Request Type not found');

        // 2) Create new RequestType
        const newTypeId = cds.utils.uuid();
        await INSERT.into(RequestTypes).entries({
            ID: newTypeId,
            title: `${source.title} (Copy)`,
            description: source.description,
            isEnabled: source.isEnabled,
            icon: source.icon, // keep icon too if desired
        });

        // 3) Clone Status Network
        const statusEdges = await SELECT.from(StatusNetwork).where({ requestType_ID: sourceId });
        for (const edge of statusEdges) {
            await INSERT.into(StatusNetwork).entries({
                requestType_ID: newTypeId,
                fromStatus: edge.fromStatus,
                toStatus: edge.toStatus,
                action: edge.action,
                description: edge.description,
            });
        }

        // 4) Get all StepDefinitions
        const steps = await SELECT.from(StepDefinitions).where({ requestType_ID: sourceId });

        // 5) Clone StepDefinitions with ID mapping
        const stepIdMap = new Map<string, string>();
        for (const step of steps) {
            const newStepId = cds.utils.uuid();
            stepIdMap.set(step.ID, newStepId);

            await INSERT.into(StepDefinitions).entries({
                ID: newStepId,
                requestType_ID: newTypeId,
                stepName: step.stepName,
                isStartStep: step.isStartStep,
                slaDays: step.slaDays,
                syncTrigger: step.syncTrigger,
                schemaContent: step.schemaContent,
                ownerType: step.ownerType,
                ownerId: step.ownerId,
            });

            // Clone ApproverRules
            const rules = await SELECT.from(ApproverRules).where({ stepDefinition_ID: step.ID });

            for (const rule of rules) {
                await INSERT.into(ApproverRules).entries({
                    stepDefinition_ID: newStepId,
                    priority: rule.priority,
                    conditionExpr: rule.conditionExpr,
                    principalType: rule.principalType,
                    principalId: rule.principalId,
                    isFinal: rule.isFinal,
                    description: rule.description,
                    requestType_ID: rule.requestType_ID, // keep if your data uses it
                });
            }
        }

        // 6) Clone StepDependencies with remapped IDs
        for (const step of steps) {
            const deps = await SELECT.from(StepDependencies).where({ step_ID: step.ID });

            for (const dep of deps) {
                const newStepId = stepIdMap.get(step.ID);
                const newDependsOnId = stepIdMap.get(dep.dependsOn_ID);

                if (newStepId && newDependsOnId) {
                    await INSERT.into(StepDependencies).entries({
                        step_ID: newStepId,
                        dependsOn_ID: newDependsOnId,
                    });
                }
            }
        }

        console.log(`[RequestTypeHandler] Cloned RequestType ${sourceId} -> ${newTypeId}`);
        return SELECT.from(RequestTypes, newTypeId);
    }
}
