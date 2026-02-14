import { getIconConfig } from '../../config/iconConfig';
import { cn } from '../../lib/utils';

interface RequestTypeIconProps {
    icon?: string;
    /**
     * Display variant:
     * - 'default': Just the icon with color
     * - 'withBackground': Icon with colored background (for cards)
     */
    variant?: 'default' | 'withBackground';
    /**
     * Size of the icon
     */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
};

const backgroundSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
};

/**
 * Reusable Request Type Icon Component
 * Ensures consistent icon rendering across the application
 */
export function RequestTypeIcon({
    icon,
    variant = 'default',
    size = 'md',
    className
}: RequestTypeIconProps) {
    const iconConfig = getIconConfig(icon);
    const Icon = iconConfig.icon;

    if (variant === 'withBackground') {
        return (
            <div className={cn(
                'rounded-xl flex items-center justify-center',
                iconConfig.bgColor,
                backgroundSizeClasses[size],
                className
            )}>
                <Icon className={cn(sizeClasses[size], iconConfig.color)} />
            </div>
        );
    }

    return <Icon className={cn(sizeClasses[size], iconConfig.color, className)} />;
}
