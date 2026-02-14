import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export class SchemaValidator {

    /**
     * Checks if the schema is a valid JSON Schema (vs our custom UI format)
     * JSON Schema must have 'type' property at root level or '$schema' keyword
     * 
     * Our custom UI format uses: { items: [ { type: "section", ... } ] }
     * JSON Schema 'items' is used inside an array type: { type: "array", items: { ... } }
     */
    private static isJsonSchema(schema: any): boolean {
        if (!schema || typeof schema !== 'object') return false;

        // JSON Schema indicators
        if (schema.$schema) return true;

        // Check for JSON Schema 'type' at root level
        if (schema.type && ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(schema.type)) return true;

        // Check for JSON Schema 'properties' (object validation)
        if (schema.properties && typeof schema.properties === 'object') return true;

        // JSON Schema 'items' is only valid with 'type: array'
        // Our custom UI format uses 'items' at root WITHOUT 'type', so skip those
        // Don't trigger on { items: [ { type: "section" } ] } which is custom UI format

        return false;
    }

    /**
     * Validates a JSON payload against a JSON Schema (if the schema is in JSON Schema format).
     * If the schema is in our custom UI format (sections/fields), validation is skipped.
     * @param schema The schema object (JSON Schema Draft 07 or custom UI format)
     * @param data The JSON data payload to validate
     * @returns { valid: boolean, errors: string[] }
     */
    public static validate(schema: any, data: any): { valid: boolean; errors: string[] } {
        if (!schema || !data) {
            return { valid: true, errors: [] }; // No schema = valid by default
        }

        // If it's our custom UI format (array of sections/fields), skip AJV validation
        // These schemas are for form rendering, not strict validation
        if (Array.isArray(schema) || !this.isJsonSchema(schema)) {
            return { valid: true, errors: [] };
        }

        try {
            const validate = ajv.compile(schema);
            const valid = validate(data);

            if (!valid) {
                const errors = validate.errors?.map(err => `${err.instancePath} ${err.message}`) || ['Unknown validation error'];
                return { valid: false, errors: errors };
            }

            return { valid: true, errors: [] };

        } catch (error) {
            return { valid: false, errors: [`Schema compilation error: ${(error as Error).message}`] };
        }
    }
}
