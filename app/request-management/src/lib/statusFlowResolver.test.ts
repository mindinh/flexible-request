import { describe, it, expect } from 'vitest';
import { resolveStepOutcomeBusinessStatus } from './statusFlowResolver';

describe('resolveStepOutcomeBusinessStatus', () => {
    it('resolves exit status by transition action for a step', () => {
        const statusFlowContent = JSON.stringify({
            lanes: [],
            phases: [
                {
                    id: 'card-step-1-entry',
                    phaseNumber: 1,
                    label: 'Pending',
                    laneIndex: 0,
                    statuses: [{ id: 's1', label: 'Pending', color: '#111', bgColor: '#eee', borderColor: '#ddd' }],
                    sourceStepIds: ['step-1'],
                },
                {
                    id: 'card-step-1-exit-0',
                    phaseNumber: 2,
                    label: 'Mono',
                    laneIndex: 0,
                    statuses: [{ id: 's2', label: 'Mono', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' }],
                    sourceStepIds: ['step-1'],
                },
            ],
            transitions: [
                { id: 't1', from: 'card-step-1-entry', to: 'card-step-1-exit-0', action: 'Reject' },
            ],
        });

        const resolved = resolveStepOutcomeBusinessStatus(statusFlowContent, 'step-1', 'reject');
        expect(resolved).toEqual({
            label: 'Mono',
            color: '#dc2626',
            bgColor: '#fef2f2',
            borderColor: '#fecaca',
        });
    });

    it('returns null when action does not match', () => {
        const statusFlowContent = JSON.stringify({
            lanes: [],
            phases: [
                {
                    id: 'card-step-1-entry',
                    phaseNumber: 1,
                    label: 'Pending',
                    laneIndex: 0,
                    statuses: [{ id: 's1', label: 'Pending', color: '#111', bgColor: '#eee', borderColor: '#ddd' }],
                    sourceStepIds: ['step-1'],
                },
                {
                    id: 'card-step-1-exit-0',
                    phaseNumber: 2,
                    label: 'Mono',
                    laneIndex: 0,
                    statuses: [{ id: 's2', label: 'Mono', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' }],
                    sourceStepIds: ['step-1'],
                },
            ],
            transitions: [
                { id: 't1', from: 'card-step-1-entry', to: 'card-step-1-exit-0', action: 'Reject' },
            ],
        });

        const resolved = resolveStepOutcomeBusinessStatus(statusFlowContent, 'step-1', 'Approve');
        expect(resolved).toBeNull();
    });
});

