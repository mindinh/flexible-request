import cds from '@sap/cds';

const LOG = cds.log('valuehelp');

/**
 * Runtime handler for F4 Value Help — fetches entries, handles search.
 * Registered on RequestService.
 *
 * Supports 3 source types:
 *   - static:    Inline JSON entries (staticEntries field)
 *   - reference: Dynamic DB table lookup (referenceTable/keyColumn/textColumn)
 *   - external:  Reserved for future S/4HANA OData (stub)
 */
export class ValueHelpHandler {

    private srv: cds.ApplicationService;
    private entityName = 'sap.cre.ValueHelpList';

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
        this.srv.on('getValueHelp', this.getValueHelp.bind(this));
        this.srv.on('getValueHelpSearch', this.getValueHelpSearch.bind(this));
    }

    // ──────────────────────────────────────────────
    // getValueHelp — Fetch entries + returnMapping
    // ──────────────────────────────────────────────

    private async getValueHelp(req: cds.Request): Promise<string> {
        const { objectType, valueHelpID, filter, dependsOnValue } = req.data;

        if (!objectType || !valueHelpID) {
            return JSON.stringify({ entries: [], returnMapping: [] });
        }

        try {
            const db = await cds.connect.to('db');
            const list = await db.run(
                SELECT.one.from(this.entityName)
                    .where({ valueHelpID, objectType, isActive: true })
            );

            if (!list) {
                LOG.warn(`ValueHelp not found: ${valueHelpID} for ${objectType}`);
                return JSON.stringify({ entries: [], returnMapping: [] });
            }

            const returnMapping = this.safeParseJSON(list.returnMapping, []);

            let entries: any[] = [];

            switch (list.sourceType) {
                case 'static':
                    entries = this.handleStaticSource(list, filter, dependsOnValue);
                    break;
                case 'reference':
                    entries = await this.handleReferenceSource(db, list, returnMapping, filter, dependsOnValue);
                    break;
                case 'external':
                    entries = await this.handleExternalSource(list, filter, dependsOnValue);
                    break;
                default:
                    LOG.warn(`Unknown sourceType: ${list.sourceType}`);
            }

            // Apply displayFormat
            entries = this.applyDisplayFormat(entries, list);

            // Apply sortBy
            entries = this.applySortBy(entries, list.sortBy);

            return JSON.stringify({ entries, returnMapping });

        } catch (err: any) {
            LOG.error(`getValueHelp error: ${err.message}`);
            return JSON.stringify({ entries: [], returnMapping: [] });
        }
    }

    // ──────────────────────────────────────────────
    // getValueHelpSearch — Multi-criteria + pagination
    // ──────────────────────────────────────────────

    private async getValueHelpSearch(req: cds.Request): Promise<string> {
        const { objectType, valueHelpID, filters: filtersJson, columns: columnsJson, top, skip } = req.data;

        if (!objectType || !valueHelpID) {
            return JSON.stringify({ data: [], total: 0, returnMapping: [] });
        }

        try {
            const db = await cds.connect.to('db');
            const list = await db.run(
                SELECT.one.from(this.entityName)
                    .where({ valueHelpID, objectType, isActive: true })
            );

            if (!list) {
                return JSON.stringify({ data: [], total: 0, returnMapping: [] });
            }

            const returnMapping = this.safeParseJSON(list.returnMapping, []);
            const searchFilters = this.safeParseJSON(filtersJson, {});
            const requestedColumns = this.safeParseJSON(columnsJson, []);
            const pageSize = top || 20;
            const offset = skip || 0;

            if (list.sourceType === 'static') {
                let entries = this.safeParseJSON(list.staticEntries, []);
                entries = this.applySearchFilters(entries, searchFilters, list.dependsOn);
                const total = entries.length;
                const data = entries.slice(offset, offset + pageSize);
                return JSON.stringify({ data, total, returnMapping });
            }

            if (list.sourceType === 'reference') {
                const entityName = this.allowedReferenceTables[list.referenceTable];
                if (!entityName) {
                    LOG.error(`Reference table not allowed: ${list.referenceTable}`);
                    return JSON.stringify({ data: [], total: 0, returnMapping: [] });
                }

                const columns = new Set<string>([list.keyColumn, list.textColumn]);
                for (const m of returnMapping) {
                    columns.add(m.sourceColumn);
                }
                if (requestedColumns.length > 0) {
                    for (const c of requestedColumns) columns.add(c);
                }

                const whereConditions: any[] = [];

                if (list.filterColumn) {
                    whereConditions.push({ [list.filterColumn]: objectType });
                }

                for (const [col, val] of Object.entries(searchFilters)) {
                    if (!val || typeof val !== 'string' || !val.trim()) continue;

                    if (col === '_dependsOn' && list.dependsOn) {
                        whereConditions.push({ [list.dependsOn]: val });
                    } else if (col !== '_dependsOn') {
                        const lowerVal = val.toLowerCase().replace(/'/g, "''");
                        whereConditions.push(`LOWER(${col}) LIKE '%${lowerVal}%'`);
                    }
                }

                let countQuery = SELECT.from(entityName).columns('count(*) as count');
                for (const cond of whereConditions) {
                    countQuery = countQuery.where(cond);
                }
                const countResult = await db.run(countQuery);
                const total = countResult[0]?.count || 0;

                try {
                    let dataQuery = SELECT.distinct.from(entityName)
                        .columns(...columns)
                        .limit(pageSize, offset);
                    for (const cond of whereConditions) {
                        dataQuery = dataQuery.where(cond);
                    }
                    const rows = await db.run(dataQuery);

                    const data = rows.map((row: any) => ({
                        key: row[list.keyColumn],
                        text: row[list.textColumn],
                        ...row,
                    }));

                    return JSON.stringify({ data, total, returnMapping });
                } catch (queryErr: any) {
                    LOG.error(`Reference query failed for ${entityName} with columns [${[...columns]}]: ${queryErr.message}`);
                    return JSON.stringify({ data: [], total: 0, returnMapping: [] });
                }
            }

            return JSON.stringify({ data: [], total: 0, returnMapping: [] });

        } catch (err: any) {
            LOG.error(`getValueHelpSearch error: ${err.message}`);
            return JSON.stringify({ data: [], total: 0, returnMapping: [] });
        }
    }

    // ──────────────────────────────────────────────
    // Source Type Handlers
    // ──────────────────────────────────────────────

    private handleStaticSource(list: any, filter?: string, dependsOnValue?: string): any[] {
        let entries = this.safeParseJSON(list.staticEntries, []);

        if (dependsOnValue && list.dependsOn) {
            entries = entries.filter((e: any) =>
                e[list.dependsOn] === dependsOnValue || e.dependsOnValue === dependsOnValue
            );
        }

        if (filter && filter.trim()) {
            const lowerFilter = filter.toLowerCase();
            entries = entries.filter((e: any) =>
                (e.key && e.key.toLowerCase().includes(lowerFilter)) ||
                (e.text && e.text.toLowerCase().includes(lowerFilter))
            );
        }

        return entries;
    }

    private async handleReferenceSource(
        db: any, list: any, returnMapping: any[],
        filter?: string, dependsOnValue?: string
    ): Promise<any[]> {
        const entityName = this.allowedReferenceTables[list.referenceTable];
        if (!entityName) {
            LOG.error(`Reference table not allowed: ${list.referenceTable}`);
            return [];
        }

        const columns = new Set<string>([list.keyColumn, list.textColumn]);
        for (const m of returnMapping) {
            columns.add(m.sourceColumn);
        }

        try {
            let query = SELECT.distinct.from(entityName)
                .columns(...columns)
                .limit(200);

            if (list.filterColumn) {
                query = query.where({ [list.filterColumn]: list.objectType });
            }

            if (dependsOnValue && list.dependsOn) {
                query = query.where({ [list.dependsOn]: dependsOnValue });
            }

            if (filter && filter.trim()) {
                const lowerFilter = filter.toLowerCase().replace(/'/g, "''");
                query = query.where(`LOWER(${list.textColumn}) LIKE '%${lowerFilter}%'`);
            }

            const rows = await db.run(query);

            return rows.map((row: any) => ({
                key: row[list.keyColumn],
                text: row[list.textColumn],
                ...row,
            }));
        } catch (queryErr: any) {
            LOG.error(`Reference query failed for ${entityName} with columns [${[...columns]}]: ${queryErr.message}`);
            return [];
        }
    }

    private async handleExternalSource(
        _list: any, _filter?: string, _dependsOnValue?: string
    ): Promise<any[]> {
        LOG.info('External source type is reserved for future S/4HANA integration');
        return [];
    }

    // ──────────────────────────────────────────────
    // Formatting & Sorting
    // ──────────────────────────────────────────────

    private applyDisplayFormat(entries: any[], list: any): any[] {
        const format = list.displayFormat || 'keyAndText';

        return entries.map(entry => {
            const formatted = { ...entry };
            const key = String(entry.key);
            switch (format) {
                case 'keyOnly':
                    formatted.text = key;
                    break;
                case 'textOnly':
                    break;
                case 'keyAndText':
                default:
                    const prefix = `${key} - `;
                    if (entry.text && !entry.text.startsWith(prefix)) {
                        formatted.text = prefix + entry.text;
                    }
                    break;
            }
            return formatted;
        });
    }

    private applySortBy(entries: any[], sortBy?: string): any[] {
        const field = sortBy || 'text';
        return [...entries].sort((a, b) => {
            const aVal = (a[field] || '').toString().toLowerCase();
            const bVal = (b[field] || '').toString().toLowerCase();
            return aVal.localeCompare(bVal);
        });
    }

    // ──────────────────────────────────────────────
    // Search Helpers
    // ──────────────────────────────────────────────

    private applySearchFilters(entries: any[], filters: Record<string, string>, dependsOnColumn?: string): any[] {
        let result = entries;
        for (const [col, val] of Object.entries(filters)) {
            if (!val || typeof val !== 'string' || !val.trim()) continue;

            if (col === '_dependsOn' && dependsOnColumn) {
                result = result.filter((e: any) =>
                    e[dependsOnColumn] && e[dependsOnColumn].toString() === val
                );
            } else if (col !== '_dependsOn') {
                const lowerVal = val.toLowerCase();
                result = result.filter((e: any) =>
                    e[col] && e[col].toString().toLowerCase().includes(lowerVal)
                );
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────
    // JSON Utilities
    // ──────────────────────────────────────────────

    private safeParseJSON(json: string | null | undefined, fallback: any): any {
        if (!json) return fallback;
        try {
            return JSON.parse(json);
        } catch {
            LOG.warn(`Failed to parse JSON: ${json.substring(0, 100)}`);
            return fallback;
        }
    }
}
