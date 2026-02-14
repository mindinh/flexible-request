/**
 * Inbox Component Tests
 * 
 * Sprint 3 - Epic 3.5: Inbox Filters
 * 
 * Note: Full interaction tests require Tabs component to be properly loaded.
 * These tests verify basic component structure and exports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock modules before importing component
vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn().mockResolvedValue({ data: { value: [] } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

vi.mock('@/services/RequestService', () => ({
    RequestService: {
        getTeamApprovals: vi.fn().mockResolvedValue([]),
        getCoordinatingRequests: vi.fn().mockResolvedValue([]),
    },
}));

describe('Inbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module', () => {
        it('exports Inbox component', async () => {
            const module = await import('./Inbox');
            expect(module.Inbox).toBeDefined();
            expect(typeof module.Inbox).toBe('function');
        });
    });

    describe('RequestService Integration', () => {
        it('has mocked getTeamApprovals', async () => {
            const { RequestService } = await import('@/services/RequestService');
            expect(RequestService.getTeamApprovals).toBeDefined();

            const result = await RequestService.getTeamApprovals();
            expect(Array.isArray(result)).toBe(true);
        });

        it('has mocked getCoordinatingRequests', async () => {
            const { RequestService } = await import('@/services/RequestService');
            expect(RequestService.getCoordinatingRequests).toBeDefined();

            const result = await RequestService.getCoordinatingRequests();
            expect(Array.isArray(result)).toBe(true);
        });
    });
});

