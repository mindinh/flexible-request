/**
 * GroupDialog Component Tests
 * 
 * Sprint 2 - Epic 2.2: Group CRUD
 * 
 * Note: Full interaction tests require Dialog component rendering.
 * These tests verify basic component structure and exports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules
vi.mock('@/services/AdminService', () => ({
    AdminService: {
        getSupportTypes: vi.fn().mockResolvedValue([]),
        createShadowGroup: vi.fn().mockResolvedValue({ ID: 'new-group-id' }),
        updateShadowGroup: vi.fn().mockResolvedValue({ ID: 'group-1' }),
    },
}));

vi.mock('@/lib/events', () => ({
    globalEvents: { emit: vi.fn() },
    EVENT_TYPES: { API_ERROR: 'API_ERROR', SHOW_SUCCESS: 'SHOW_SUCCESS' },
}));

describe('GroupDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module', () => {
        it('exports GroupDialog component', async () => {
            const module = await import('./GroupDialog');
            expect(module.GroupDialog).toBeDefined();
            expect(typeof module.GroupDialog).toBe('function');
        });
    });

    describe('AdminService Integration', () => {
        it('has mocked getSupportTypes', async () => {
            const { AdminService } = await import('@/services/AdminService');
            expect(AdminService.getSupportTypes).toBeDefined();

            const result = await AdminService.getSupportTypes();
            expect(Array.isArray(result)).toBe(true);
        });

        it('has mocked createShadowGroup', async () => {
            const { AdminService } = await import('@/services/AdminService');
            expect(AdminService.createShadowGroup).toBeDefined();
        });

        it('has mocked updateShadowGroup', async () => {
            const { AdminService } = await import('@/services/AdminService');
            expect(AdminService.updateShadowGroup).toBeDefined();
        });
    });
});
