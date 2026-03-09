/**
 * Shared utility functions for the backend.
 */

/**
 * Formats an enum-like string (e.g., "MEDIUM", "HIGH_PRIORITY") 
 * into a human-readable label (e.g., "Medium", "High Priority").
 */
export function formatEnumLabel(val: string | null | undefined): string {
    if (!val) return '';
    return val.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
