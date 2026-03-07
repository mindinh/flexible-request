/**
 * Value Help — Barrel export for all components, hooks, and types.
 */

// Components
export { default as ValueHelpSelect } from './components/ValueHelpSelect';
export { default as ValueHelpComboBox } from './components/ValueHelpComboBox';
export { default as ValueHelpMultiSelect } from './components/ValueHelpMultiSelect';
export { default as ValueHelpSearchInput } from './components/ValueHelpSearchInput';
export { default as SearchHelpDialog } from './components/SearchHelpDialog';

// Hooks
export { useValueHelp } from './hooks/useValueHelp';
export { useSearchHelp } from './hooks/useSearchHelp';

// Admin
export { ValueHelpManager } from './admin';
export type { ValueHelpManagerProps, HttpClient } from './admin';

// Types (re-export for consumers)
export type {
    ValueHelpEntry,
    ReturnMapping,
    SearchConfig,
    SearchField,
    ResultColumn,
    ValueHelpBaseProps,
    WithBatchUpdate,
    SearchHelpDialogProps,
    UseValueHelpReturn,
    UseValueHelpOptions,
    UseSearchHelpReturn,
    UseSearchHelpOptions,
} from './types';
