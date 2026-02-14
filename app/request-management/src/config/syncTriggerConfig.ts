/**
 * Sync Trigger Configuration - Centralized sync trigger options
 */
import { SyncTrigger } from '@/types';
import type { BadgeVariant } from './statusConfig';

export interface SyncTriggerConfigItem {
    label: string;
    description: string;
    variant: BadgeVariant;
}

export const SYNC_TRIGGER_CONFIG: Record<SyncTrigger, SyncTriggerConfigItem> = {
    [SyncTrigger.NONE]: {
        label: 'None',
        description: 'No sync',
        variant: 'neutral'
    },
    [SyncTrigger.IMMEDIATE]: {
        label: 'Immediate',
        description: 'Sync on save',
        variant: 'info'
    },
    [SyncTrigger.WITH_NEXT]: {
        label: 'With Next',
        description: 'With Next Step',
        variant: 'warning'
    },
    [SyncTrigger.ON_COMPLETE]: {
        label: 'On Complete',
        description: 'On Complete (Final step)',
        variant: 'success'
    },
};

/**
 * Get all sync trigger options for dropdowns
 */
export function getSyncTriggerOptions() {
    return Object.values(SyncTrigger).map(trigger => ({
        value: trigger,
        label: SYNC_TRIGGER_CONFIG[trigger].label,
        description: SYNC_TRIGGER_CONFIG[trigger].description,
    }));
}
