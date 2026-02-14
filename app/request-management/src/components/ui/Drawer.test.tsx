import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { Drawer } from './Drawer';

describe('Drawer', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Test Drawer',
        children: <div data-testid="drawer-content">Content</div>,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('renders when open', () => {
        render(<Drawer {...defaultProps} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Test Drawer')).toBeInTheDocument();
        expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<Drawer {...defaultProps} isOpen={false} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('has correct ARIA attributes', () => {
        render(<Drawer {...defaultProps} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'drawer-title');
    });

    it('has accessible close button', () => {
        render(<Drawer {...defaultProps} />);

        const closeButton = screen.getByLabelText('Close drawer');
        expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<Drawer {...defaultProps} />);

        const closeButton = screen.getByLabelText('Close drawer');
        fireEvent.click(closeButton);

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
        render(<Drawer {...defaultProps} />);

        // The backdrop has aria-hidden="true"
        const backdrop = document.querySelector('[aria-hidden="true"]');
        if (backdrop) {
            fireEvent.click(backdrop);
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        }
    });

    it('calls onClose when Escape is pressed', () => {
        render(<Drawer {...defaultProps} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('renders with different sizes', () => {
        const { rerender } = render(<Drawer {...defaultProps} size="sm" />);
        expect(screen.getByRole('dialog')).toHaveClass('max-w-sm');

        rerender(<Drawer {...defaultProps} size="lg" />);
        expect(screen.getByRole('dialog')).toHaveClass('max-w-lg');

        rerender(<Drawer {...defaultProps} size="xl" />);
        expect(screen.getByRole('dialog')).toHaveClass('max-w-xl');
    });

    it('uses default title when not provided', () => {
        render(<Drawer isOpen={true} onClose={vi.fn()}>Content</Drawer>);

        expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('prevents body scroll when open', () => {
        render(<Drawer {...defaultProps} />);

        expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
        const { rerender } = render(<Drawer {...defaultProps} />);

        rerender(<Drawer {...defaultProps} isOpen={false} />);

        // Need to wait for cleanup
        expect(document.body.style.overflow).toBe('');
    });
});
