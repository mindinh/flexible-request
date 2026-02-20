/**
 * Schema Parser Utility
 * 
 * Shared parsing logic for form schema content from backend.
 * This module handles the parsing of JSON schema definitions used
 * for dynamic form rendering throughout the application.
 */

/**
 * Represents a single form field definition
 */
export interface SchemaField {
    id: string;
    label: string;
    type?: string;
    controlType: string;
    dataType?: string;
    required?: boolean;
    placeholder?: string;
    colSpan?: number;
    disabled?: boolean;
    readOnly?: boolean;
    options?: Array<{ value: string; label: string }>;
}

/**
 * Represents a section containing multiple fields
 */
export interface SchemaSection {
    type: 'section';
    id: string;
    title?: string;
    label?: string;
    columns?: number;
    fields: SchemaField[];
}

/**
 * Represents a table with columns for tabular data entry
 */
export interface SchemaTable {
    type: 'table';
    id: string;
    label: string;
    columns: SchemaField[];
    headerActions?: {
        downloadTemplate?: boolean;
        uploadExcel?: boolean;
    };
}

/**
 * Union type for schema items - section, table, or standalone field
 */
export type SchemaItem = SchemaSection | SchemaTable | SchemaField;

/**
 * Type guard to check if a schema item is a section
 */
export function isSchemaSection(item: SchemaItem): item is SchemaSection {
    return item.type === 'section';
}

/**
 * Type guard to check if a schema item is a table
 */
export function isSchemaTable(item: SchemaItem): item is SchemaTable {
    return item.type === 'table';
}

/**
 * Parse schema content from JSON string.
 * Handles both {items: [...]} and plain array [...] formats.
 * 
 * @param content - JSON string containing schema definition
 * @returns Array of schema items (sections or fields)
 * 
 * @example
 * // Plain array format
 * parseSchemaContent('[{"id": "name", "label": "Name", "controlType": "text"}]')
 * 
 * @example
 * // Object with items property
 * parseSchemaContent('{"items": [{"id": "name", "label": "Name", "controlType": "text"}]}')
 */
export function parseSchemaContent(content: string | null | undefined): SchemaItem[] {
    if (!content) return [];

    try {
        const parsed = JSON.parse(content);

        // Handle {items: [...]} format
        if (parsed && !Array.isArray(parsed) && parsed.items) {
            return Array.isArray(parsed.items) ? parsed.items : [];
        }

        // Handle plain array format
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.warn('Failed to parse schema content:', content?.substring(0, 100));
        return [];
    }
}

/**
 * Extract all fields from schema items, flattening sections and tables
 * Note: For tables, this returns the column definitions, not the table data
 * 
 * @param items - Array of schema items
 * @returns Flat array of all fields
 */
export function flattenSchemaFields(items: SchemaItem[]): SchemaField[] {
    return items.flatMap(item => {
        if (isSchemaSection(item)) {
            return item.fields;
        }
        if (isSchemaTable(item)) {
            // Return columns as fields for validation purposes
            return item.columns;
        }
        return [item as SchemaField];
    });
}
