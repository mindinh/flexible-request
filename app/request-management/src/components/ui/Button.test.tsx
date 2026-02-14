import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { Button } from './Button';

describe('Button', () => {
    it('renders with default variant', () => {
        render(<Button>Click me</Button>);

        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-[#b10e10]');
    });

    it('renders with outline variant', () => {
        render(<Button variant="outline">Outline</Button>);

        const button = screen.getByRole('button', { name: /outline/i });
        expect(button).toHaveClass('border');
        expect(button).toHaveClass('bg-white');
    });

    it('renders with destructive variant', () => {
        render(<Button variant="destructive">Delete</Button>);

        const button = screen.getByRole('button', { name: /delete/i });
        expect(button).toHaveClass('bg-red-500');
    });

    it('renders with different sizes', () => {
        const { rerender } = render(<Button size="sm">Small</Button>);
        expect(screen.getByRole('button')).toHaveClass('h-8');

        rerender(<Button size="lg">Large</Button>);
        expect(screen.getByRole('button')).toHaveClass('h-10');

        rerender(<Button size="icon">Icon</Button>);
        expect(screen.getByRole('button')).toHaveClass('w-9');
    });

    it('handles click events', async () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click</Button>);

        const button = screen.getByRole('button');
        button.click();

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled when disabled prop is passed', () => {
        render(<Button disabled>Disabled</Button>);

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveClass('disabled:opacity-50');
    });

    it('renders as child component when asChild is true', () => {
        render(
            <Button asChild>
                <a href="/test">Link Button</a>
            </Button>
        );

        const link = screen.getByRole('link', { name: /link button/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/test');
    });

    it('forwards ref correctly', () => {
        const ref = vi.fn();
        render(<Button ref={ref}>Ref Button</Button>);

        expect(ref).toHaveBeenCalled();
    });

    it('accepts additional className', () => {
        render(<Button className="custom-class">Custom</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveClass('custom-class');
    });
});
