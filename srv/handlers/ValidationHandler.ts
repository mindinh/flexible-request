import { cds, SELECT } from '../lib/db';
import { SchemaValidator } from '../lib/validation';

/**
 * Handles validation hooks for RequestData
 */
export class ValidationHandler {

    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all validation-related handlers
     */
    register() {
        this.srv.before('UPDATE', 'RequestData', this.beforeUpdateRequestData.bind(this));
    }

    /**
     * Before Saving RequestData: Validate against the Step's Schema
     */
    private async beforeUpdateRequestData(req: cds.Request) {
        const { RequestData, Steps, StepDefinitions } = this.srv.entities;
        const data = req.data as { ID: string; payload?: string; step_ID?: string };

        if (!data.payload) return; // Nothing to validate

        // 1. Get the Step -> StepDefinition -> schemaContent
        const requestData = await SELECT.one.from(RequestData, data.ID).columns('step_ID');
        if (!requestData?.step_ID) return;

        const step = await SELECT.one.from(Steps, requestData.step_ID).columns('stepDefinition_ID');
        if (!step?.stepDefinition_ID) return;

        // schemaContent is now stored directly on StepDefinitions
        const stepDef = await SELECT.one.from(StepDefinitions, step.stepDefinition_ID).columns('schemaContent');
        if (!stepDef?.schemaContent) return;

        // 2. Parse and Validate
        try {
            const schema = JSON.parse(stepDef.schemaContent);
            const payload = JSON.parse(data.payload);
            const result = SchemaValidator.validate(schema, payload);

            if (!result.valid) {
                return req.error(400, `Validation failed: ${result.errors.join(', ')}`);
            }
        } catch (e) {
            return req.error(400, `Invalid JSON: ${(e as Error).message}`);
        }
    }
}
