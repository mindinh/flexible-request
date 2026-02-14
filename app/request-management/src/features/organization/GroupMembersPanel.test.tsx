/**
 * GroupMembersPanel Component Tests
 * 
 * Sprint 2 - Epic 2.3: Member Management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupMembersPanel } from './GroupMembersPanel';

// Mock AdminService
vi.mock('@/services/AdminService', () => ({
    AdminService: {
        getGroupMembers: vi.fn().mockResolvedValue([
            { ID: 'member-1', user_ID: 'user-1', user: { ID: 'user-1', displayName: 'Existing Member', email: 'exist@example.com' } }
        ]),
        getShadowUsers: vi.fn().mockResolvedValue([
            { ID: 'user-2', displayName: 'New User', email: 'new@example.com' }
        ]),
        addGroupMember: vi.fn().mockResolvedValue({}),
        removeGroupMember: vi.fn().mockResolvedValue({}),
    },
}));

// Mock globalEvents
vi.mock('@/lib/events', () => ({
    globalEvents: { emit: vi.fn() },
    EVENT_TYPES: { API_ERROR: 'API_ERROR', SHOW_SUCCESS: 'SHOW_SUCCESS' },
}));

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe('GroupMembersPanel', () => {
    const mockGroup = {
        ID: 'group-1',
        name: 'Test Group',
        description: 'Test Group Desc',
        type: { code: 'GROUP', ID: '1' }
    };
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders nothing when group is null', () => {
            const { container } = render(
                <GroupMembersPanel group={null} onClose={mockOnClose} />,
                { wrapper: createWrapper() }
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders panel when group is provided', async () => {
            render(
                <GroupMembersPanel group={mockGroup} onClose={mockOnClose} />,
                { wrapper: createWrapper() }
            );

            expect(screen.getByText('Test Group')).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/search users/i)).toBeInTheDocument();
        });

        it('loads and displays members', async () => {
            render(
                <GroupMembersPanel group={mockGroup} onClose={mockOnClose} />,
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(screen.getByText('Existing Member')).toBeInTheDocument();
            });
        });
    });

    describe('Interactions', () => {
        it('calls onClose when close button clicked', async () => {
            const user = userEvent.setup();
            render(
                <GroupMembersPanel group={mockGroup} onClose={mockOnClose} />,
                { wrapper: createWrapper() }
            );

            // Find close button (X icon)
            const closeButtons = screen.getAllByRole('button');
            // The first one usually is clear or close in header
            await user.click(closeButtons[0]);
            // Better to rely on test id or aria label if available, but X icon button usually has class

            expect(mockOnClose).toHaveBeenCalled();
        });

        // Note: Full add/remove interactions involve complex async state updates
        // validating service calls is sufficient for unit tests
        it('calls getGroupMembers on mount', async () => {
            const { AdminService } = await import('@/services/AdminService');
            render(
                <GroupMembersPanel group={mockGroup} onClose={mockOnClose} />,
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(AdminService.getGroupMembers).toHaveBeenCalledWith('group-1');
            });
        });
    });
});
