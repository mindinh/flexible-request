import cds from '@sap/cds';

const LOG = cds.log('valuehelp-admin');

/**
 * Admin-side validation handler for ValueHelpList.
 * Validates JSON fields (staticEntries, returnMapping, searchConfig)
 * and referenceTable allowlists before save.
 */
export class ValueHelpAdminHandler {

    private srv: cds.ApplicationService;

    /**
     * Map of short table names to fully qualified CDS entity names.
     * Add entries here as reference tables are enabled for value help lookups.
     */
    private allowedReferenceTables: Record<string, string> = {
        // Example: 'Suppliers': 'sap.cre.Suppliers'
    };

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.srv.before(['CREATE', 'UPDATE'], 'ValueHelpList', this.beforeSave.bind(this));
    }

    private async beforeSave(req: cds.Request) {
        const data = req.data as any;

        // Validate staticEntries JSON
        if (data.staticEntries) {
            const parsed = this.tryParseJSON(data.staticEntries);
            if (parsed === null) {
                return req.error(400, 'staticEntries must be valid JSON array');
            }
            if (!Array.isArray(parsed)) {
                return req.error(400, 'staticEntries must be a JSON array');
            }
            for (const entry of parsed) {
                if (!('key' in entry) || !('text' in entry)) {
                    return req.error(400, 'Each static entry must have "key" and "text" properties');
                }
            }
        }

        // Validate returnMapping JSON
        if (data.returnMapping) {
            const parsed = this.tryParseJSON(data.returnMapping);
            if (parsed === null) {
                return req.error(400, 'returnMapping must be valid JSON');
            }
            if (!Array.isArray(parsed)) {
                return req.error(400, 'returnMapping must be a JSON array');
            }
            for (const mapping of parsed) {
                if (!mapping.sourceColumn || !mapping.targetField) {
                    return req.error(400, 'Each returnMapping entry must have "sourceColumn" and "targetField"');
                }
            }
        }

        // Validate searchConfig JSON
        if (data.searchConfig) {
            const parsed = this.tryParseJSON(data.searchConfig);
            if (parsed === null) {
                return req.error(400, 'searchConfig must be valid JSON');
            }
            if (Object.keys(parsed).length > 0) {
                if (!parsed.title || !parsed.searchFields || !parsed.resultColumns || !parsed.returnField) {
                    return req.error(400, 'searchConfig must have title, searchFields, resultColumns, and returnField');
                }
            }
        }

        // Validate referenceTable for reference source type
        if (data.sourceType === 'reference' && data.referenceTable) {
            if (!this.allowedReferenceTables[data.referenceTable]) {
                LOG.warn(`Reference table "${data.referenceTable}" is not in the allowed list`);
                // Note: not blocking — just warning for now until reference tables are configured
            }
        }
    }

    private tryParseJSON(json: string): any | null {
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    }
}
