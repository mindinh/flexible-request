/**
 * Value Help — Shared TypeScript interfaces for React components and hooks.
 */

/** A single value help entry (key-text pair with optional extra columns) */
export interface ValueHelpEntry {
    key: string;
    text: string;
    /** Extra columns from reference table or static entries */
    [extra: string]: any;
}

/** A mapping rule: sourceColumn → targetField */
export interface ReturnMapping {
    sourceColumn: string;
    targetField: string;
}

/** Search config for SearchHelpDialog */
export interface SearchConfig {
    title: string;
    searchFields: SearchField[];
    resultColumns: ResultColumn[];
    returnField: string;
}

export interface SearchField {
    column: string;
    label?: string;
}

export interface ResultColumn {
    column: string;
    label?: string;
    width?: string;
}

/** Common props shared by all value help widgets */
export interface ValueHelpBaseProps {
    /** Current field value (key) */
    value?: string;
    /** Single-field change handler */
    onChange?: (value: string) => void;
    /** Document object type (e.g. 'INV') */
    objectType: string;
    /** Value help list ID (e.g. 'companyCodes') */
    valueHelpID: string;
    /** Parent field value for cascading */
    dependsOnValue?: string;
    /** Display format */
    displayFormat?: 'keyOnly' | 'textOnly' | 'keyAndText';
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    /** OData service base URL (default: /odata/v4/browse) */
    baseUrl?: string;
}

/** Props for widgets that support returnMapping auto-fill */
export interface WithBatchUpdate {
    /** Multi-field update handler for returnMapping */
    onBatchFieldUpdate?: (updates: Record<string, any>) => void;
}

/** Props for SearchHelpDialog */
export interface SearchHelpDialogProps {
    objectType: string;
    valueHelpID: string;
    dependsOnValue?: string;
    baseUrl?: string;
    onSelect: (selectedRow: Record<string, any>, returnMapping: ReturnMapping[]) => void;
    onClose: () => void;
}

/** Return type of useValueHelp hook */
export interface UseValueHelpReturn {
    entries: ValueHelpEntry[];
    returnMapping: ReturnMapping[];
    loading: boolean;
    error: string | null;
    handleSelection: (selectedKey: string) => Record<string, any>;
}

/** Options for useValueHelp hook */
export interface UseValueHelpOptions {
    objectType: string;
    valueHelpID: string;
    dependsOnValue?: string;
    baseUrl?: string;
}

/** Return type of useSearchHelp hook */
export interface UseSearchHelpReturn {
    config: SearchConfig | null;
    results: Record<string, any>[];
    total: number;
    loading: boolean;
    error: string | null;
    search: (filters: Record<string, string>) => void;
    paginate: (skip: number) => void;
    returnMapping: ReturnMapping[];
}

/** Options for useSearchHelp hook */
export interface UseSearchHelpOptions {
    objectType: string;
    valueHelpID: string;
    baseUrl?: string;
}
