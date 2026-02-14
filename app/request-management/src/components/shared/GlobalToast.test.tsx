import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@/test/utils';
import { GlobalToast } from './GlobalToast';
import { globalEvents, EVENT_TYPES } from '@/lib/events';

describe('GlobalToast', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('renders nothing when no toasts', () => {
        const { container } = render(<GlobalToast />);
        expect(container.firstChild).toBeNull();
    });

    it('shows toast when API_ERROR event is emitted', async () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Something went wrong');
        });

        expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
    });

    it('shows toast when SHOW_TOAST event is emitted', async () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Info message');
        });

        expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    it('auto-dismisses toast after 4 seconds', async () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Auto dismiss');
        });

        expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(4000);
        });

        expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
    });

    it('dismisses toast when close button is clicked', async () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Dismissible');
        });

        const dismissButton = screen.getByLabelText(/dismiss.*notification/i);
        act(() => {
            dismissButton.click();
        });

        expect(screen.queryByText('Dismissible')).not.toBeInTheDocument();
    });

    it('error toasts have role="alert"', () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Error message');
        });

        const toast = screen.getByRole('alert');
        expect(toast).toBeInTheDocument();
    });

    it('info toasts have role="status"', () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Info message');
        });

        const toast = screen.getByRole('status');
        expect(toast).toBeInTheDocument();
    });

    it('error toasts have aria-live="assertive"', () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Critical error');
        });

        const toast = screen.getByRole('alert');
        expect(toast).toHaveAttribute('aria-live', 'assertive');
    });

    it('info toasts have aria-live="polite"', () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Gentle info');
        });

        const toast = screen.getByRole('status');
        expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    it('can display multiple toasts', () => {
        render(<GlobalToast />);

        act(() => {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'First');
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Second');
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Third');
        });

        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Error: Third')).toBeInTheDocument();
    });
});
