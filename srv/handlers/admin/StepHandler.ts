import { cds, SELECT } from '../../lib/db';

/**
 * Handles StepDefinitions and StepDependencies validation.
 * Also handles ownerDisplayName resolution for steps.
 */
export class StepHandler {

    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all step-related handlers
     */
    register() {
        this.srv.before('CREATE', 'StepDependencies', this.validateDependency.bind(this));
        this.srv.after('READ', 'StepDefinitions', this.afterReadSteps.bind(this));
    }

    /**
     * After READ: Populate ownerDisplayName by looking up ShadowUsers/ShadowGroups
     * This fires for both direct reads and $expand scenarios
     */
    private async afterReadSteps(results: any[]) {
        // Redundant with SharedRequestTypeHandler which is registered in RequestTypeHandler
        return;
    }

    /**
     * Prevent circular dependencies and self-references
     */
    private async validateDependency(req: cds.Request) {
        const { StepDependencies } = this.srv.entities;
        const data = req.data as { step_ID?: string; dependsOn_ID?: string };

        // Check self-reference
        if (data.step_ID === data.dependsOn_ID) {
            return req.error(400, 'A step cannot depend on itself');
        }

        // Check for circular dependency (A depends on B, B depends on A)
        if (data.step_ID && data.dependsOn_ID) {
            const reverseDep = await SELECT.one.from(StepDependencies)
                .where({
                    step_ID: data.dependsOn_ID,
                    dependsOn_ID: data.step_ID
                });

            if (reverseDep) {
                return req.error(400, 'Circular dependency detected');
            }
        }
    }
}
