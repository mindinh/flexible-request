import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { Badge } from './Badge';

describe('Badge', () => {
    it('renders with default variant', () => {
        render(<Badge>Default</Badge>);

        const badge = screen.getByText('Default');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-[#b10e10]');
        expect(badge).toHaveClass('text-white');
    });

    it('renders with success variant', () => {
        render(<Badge variant="success">Success</Badge>);

        const badge = screen.getByText('Success');
        expect(badge).toHaveClass('bg-green-100');
        expect(badge).toHaveClass('text-green-800');
    });

    it('renders with warning variant', () => {
        render(<Badge variant="warning">Warning</Badge>);

        const badge = screen.getByText('Warning');
        expect(badge).toHaveClass('bg-yellow-100');
        expect(badge).toHaveClass('text-yellow-800');
    });

    it('renders with error variant', () => {
        render(<Badge variant="error">Error</Badge>);

        const badge = screen.getByText('Error');
        expect(badge).toHaveClass('bg-red-100');
        expect(badge).toHaveClass('text-red-800');
    });

    it('renders with info variant', () => {
        render(<Badge variant="info">Info</Badge>);

        const badge = screen.getByText('Info');
        expect(badge).toHaveClass('bg-blue-100');
        expect(badge).toHaveClass('text-blue-800');
    });

    it('renders with secondary variant', () => {
        render(<Badge variant="secondary">Secondary</Badge>);

        const badge = screen.getByText('Secondary');
        expect(badge).toHaveClass('bg-slate-100');
    });

    it('renders with outline variant', () => {
        render(<Badge variant="outline">Outline</Badge>);

        const badge = screen.getByText('Outline');
        expect(badge).toHaveClass('border-slate-200');
    });

    it('accepts additional className', () => {
        render(<Badge className="custom-badge">Custom</Badge>);

        const badge = screen.getByText('Custom');
        expect(badge).toHaveClass('custom-badge');
    });

    it('renders children correctly', () => {
        render(
            <Badge>
                <span data-testid="child">Child Element</span>
            </Badge>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('has correct base styles', () => {
        render(<Badge>Base</Badge>);

        const badge = screen.getByText('Base');
        expect(badge).toHaveClass('inline-flex');
        expect(badge).toHaveClass('items-center');
        expect(badge).toHaveClass('rounded-md');
        expect(badge).toHaveClass('text-xs');
        expect(badge).toHaveClass('font-semibold');
    });
});
