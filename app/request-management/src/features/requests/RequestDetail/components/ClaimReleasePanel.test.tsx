/**
 * ClaimReleasePanel Component Tests
 * 
 * Sprint 3 - Epic 3.3: Step Claim/Release
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClaimReleasePanel } from './ClaimReleasePanel';

// Mock RequestService
vi.mock('@/services/RequestService', () => ({
    RequestService: {
        claimStep: vi.fn().mockResolvedValue(undefined),
        releaseStep: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock globalEvents
vi.mock('@/lib/events', () => ({
    globalEvents: {
        emit: vi.fn(),
    },
    EVENT_TYPES: {
        API_ERROR: 'API_ERROR',
        SHOW_SUCCESS: 'SHOW_SUCCESS',
    },
}));

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe('ClaimReleasePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Unclaimed Group-Assigned Step', () => {
        const unclaimedStep = {
            ID: 'step-1',
            claimedBy: undefined,
            claimedAt: undefined,
            isGroupAssigned: true,
        };

        it('shows "Claim Step" button for unclaimed group step', () => {
            render(
                <ClaimReleasePanel
                    step={unclaimedStep}
                    currentUserId="user-1"
                />,
                { wrapper: createWrapper() }
            );

            expect(screen.getByRole('button', { name: /claim step/i })).toBeInTheDocument();
            expect(screen.getByText(/team task available/i)).toBeInTheDocument();
        });

        it('calls claimStep when Claim button is clicked', async () => {
            const user = userEvent.setup();
            const { RequestService } = await import('@/services/RequestService');

            render(
                <ClaimReleasePanel
                    step={unclaimedStep}
                    currentUserId="user-1"
                />,
                { wrapper: createWrapper() }
            );

            const claimButton = screen.getByRole('button', { name: /claim step/i });
            await user.click(claimButton);

            expect(RequestService.claimStep).toHaveBeenCalledWith('step-1');
        });
    });

    describe('Claimed by Current User', () => {
        const claimedByMeStep = {
            ID: 'step-1',
            claimedBy: { ID: 'user-1', displayName: 'Alice' },
            claimedAt: new Date().toISOString(),
            isGroupAssigned: true,
        };

        it('shows "Release" button when claimed by current user', () => {
            render(
                <ClaimReleasePanel
                    step={claimedByMeStep}
                    currentUserId="user-1"
                />,
                { wrapper: createWrapper() }
            );

            expect(screen.getByRole('button', { name: /release/i })).toBeInTheDocument();
            expect(screen.getByText(/claimed by you/i)).toBeInTheDocument();
        });

        it('shows time remaining', () => {
            render(
                <ClaimReleasePanel
                    step={claimedByMeStep}
                    currentUserId="user-1"
                />,
                { wrapper: createWrapper() }
            );

            // Should show some time remaining (e.g., "3h 59m remaining")
            expect(screen.getByText(/remaining/i)).toBeInTheDocument();
        });
    });

    describe('Claimed by Another User', () => {
        const claimedByOtherStep = {
            ID: 'step-1',
            claimedBy: { ID: 'user-2', displayName: 'Bob' },
            claimedAt: new Date().toISOString(),
            isGroupAssigned: true,
        };

        it('shows claimed by other user name', () => {
            render(
                <ClaimReleasePanel
                    step={claimedByOtherStep}
                    currentUserId="user-1"
                />,
                { wrapper: createWrapper() }
            );

            expect(screen.getByText(/claimed by bob/i)).toBeInTheDocument();
        });

        it('does not show Claim or Release button for non-coordinator', () => {
            render(
                <ClaimReleasePanel
                    step={claimedByOtherStep}
                    currentUserId="user-1"
                    isCoordinator={false}
                />,
                { wrapper: createWrapper() }
            );

            expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /^release$/i })).not.toBeInTheDocument();
        });

        it('shows Force Release for coordinator', () => {
            render(
                <ClaimReleasePanel
                    step={claimedByOtherStep}
                    currentUserId="user-1"
                    isCoordinator={true}
                />,
                { wrapper: createWrapper() }
            );

            expect(screen.getByRole('button', { name: /force release/i })).toBeInTheDocument();
        });
    });

    describe('Non-Group Step', () => {
        it('does not render for non-group steps without claim', () => {
            const directStep = {
                ID: 'step-1',
                claimedBy: undefined,
                isGroupAssigned: false,
            };

            const { container } = render(
                <ClaimReleasePanel
                    step={directStep}
                    currentUserId="user-1"
                />,
                { wrapper: createWrapper() }
            );

            // Should render nothing (null)
            expect(container.firstChild).toBeNull();
        });
    });
});
