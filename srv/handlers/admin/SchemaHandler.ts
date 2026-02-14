import { cds } from '../../lib/db';

const LOG = cds.log('schema-handler');

/**
 * Handles schema validation for StepDefinitions.
 * Validates that schemaContent is valid JSON when provided.
 */
export class SchemaHandler {

    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all schema-related handlers
     */
    register() {
        // Validate schemaContent on StepDefinitions (where schema is now stored)
        this.srv.before(['CREATE', 'UPDATE'], 'StepDefinitions', this.validateSchemaContent.bind(this));
    }

    /**
     * Validate JSON content in schemaContent field before save.
     * Ensures that if schemaContent is provided, it is valid JSON.
     */
    private async validateSchemaContent(req: cds.Request) {
        const data = req.data as { schemaContent?: string };

        // Skip if no schemaContent provided
        if (!data.schemaContent) return;

        try {
            const schema = JSON.parse(data.schemaContent);

            // Basic validation: must be an object
            if (typeof schema !== 'object' || schema === null) {
                return req.error(400, 'schemaContent must be a valid JSON object');
            }

            // Warn if neither JSON Schema nor UI format detected
            const isJsonSchema = schema.$schema || schema.type || schema.properties;
            const isUiFormat = Array.isArray(schema.items) || Array.isArray(schema);

            if (!isJsonSchema && !isUiFormat) {
                LOG.warn('schemaContent appears to be neither JSON Schema nor UI format');
            }
        } catch (e) {
            return req.error(400, `Invalid JSON in schemaContent: ${(e as Error).message}`);
        }
    }
}

