/**
 * Priority Configuration - Centralized priority to badge mapping
 * 
 * This file provides consistent styling for priority badges across the app.
 * Import this instead of defining priorityConfig locally in components.
 */
import { RequestPriority } from '@/types';
import type { BadgeVariant } from './statusConfig';

// ============================================================================
// Priority Config
// ============================================================================
export interface PriorityConfigItem {
    variant: BadgeVariant;
    label: string;
}

export const PRIORITY_CONFIG: Record<RequestPriority, PriorityConfigItem> = {
    [RequestPriority.HIGH]: { variant: 'error', label: 'High' },
    [RequestPriority.MEDIUM]: { variant: 'warning', label: 'Medium' },
    [RequestPriority.LOW]: { variant: 'success', label: 'Low' },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get priority config with fallback to MEDIUM
 */
export function getPriorityConfig(priority: string | undefined): PriorityConfigItem {
    return PRIORITY_CONFIG[priority as RequestPriority] || PRIORITY_CONFIG.MEDIUM;
}

/**
 * Get all priority options for dropdowns
 */
export function getPriorityOptions() {
    return Object.values(RequestPriority).map(priority => ({
        value: priority,
        label: PRIORITY_CONFIG[priority].label,
        variant: PRIORITY_CONFIG[priority].variant,
    }));
}
