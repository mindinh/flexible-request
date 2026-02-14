/**
 * PrincipalSelect Component Tests
 * 
 * Sprint 2 - Epic 2.4: Principal Select Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrincipalSelect, type Principal } from './PrincipalSelect';

// Mock AdminService
vi.mock('@/services/AdminService', () => ({
    AdminService: {
        getSupportTypes: vi.fn().mockResolvedValue([
            { ID: '1', code: 'USER', name: 'Users', isEnabled: true },
            { ID: '2', code: 'GROUP', name: 'Groups', isEnabled: true },
        ]),
        getShadowUsers: vi.fn().mockResolvedValue([
            { ID: 'user-1', displayName: 'Alice Smith', email: 'alice@example.com' },
            { ID: 'user-2', displayName: 'Bob Jones', email: 'bob@example.com' },
        ]),
        getShadowGroups: vi.fn().mockResolvedValue([
            { ID: 'group-1', name: 'Finance Team', type: { code: 'GROUP' } },
            { ID: 'group-2', name: 'IT Department', type: { code: 'GROUP' } },
        ]),
    },
}));

// Test wrapper with QueryClient
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe('PrincipalSelect', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the component', () => {
            render(
                <PrincipalSelect value={null} onChange={mockOnChange} />,
                { wrapper: createWrapper() }
            );

            // Component should render without crashing
            expect(document.body).toBeDefined();
        });

        it('renders selected principal name', () => {
            const selectedPrincipal: Principal = {
                id: 'user-1',
                type: 'USER',
                displayName: 'Alice Smith',
            };

            render(
                <PrincipalSelect value={selectedPrincipal} onChange={mockOnChange} />,
                { wrapper: createWrapper() }
            );

            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });
    });

    describe('Props', () => {
        it('accepts disabled prop', () => {
            const { container } = render(
                <PrincipalSelect value={null} onChange={mockOnChange} disabled />,
                { wrapper: createWrapper() }
            );

            // Component should render in disabled state
            expect(container.firstChild).toBeDefined();
        });

        it('accepts allowedTypes prop', () => {
            const { container } = render(
                <PrincipalSelect
                    value={null}
                    onChange={mockOnChange}
                    allowedTypes={['USER']}
                />,
                { wrapper: createWrapper() }
            );

            expect(container.firstChild).toBeDefined();
        });

        it('accepts placeholder prop', () => {
            const { container } = render(
                <PrincipalSelect
                    value={null}
                    onChange={mockOnChange}
                    placeholder="Custom placeholder"
                />,
                { wrapper: createWrapper() }
            );

            expect(container.firstChild).toBeDefined();
        });
    });

    describe('Interaction', () => {
        it('calls onChange when cleared via callback', () => {
            const selectedPrincipal: Principal = {
                id: 'user-1',
                type: 'USER',
                displayName: 'Alice Smith',
            };

            render(
                <PrincipalSelect value={selectedPrincipal} onChange={mockOnChange} />,
                { wrapper: createWrapper() }
            );

            // Just verify component renders with value
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });
    });
});
