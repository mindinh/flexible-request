import { useAuth, DEV_USERS, type DevUser } from '@/lib/auth-context';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
} from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { User, Shield, UserCheck } from 'lucide-react';

/**
 * Development-only user switcher component.
 * Displays in the header to allow quick switching between test users.
 * Only renders in development mode.
 */
export function DevUserSwitcher() {
    const { currentUser, setCurrentUser, isDevMode } = useAuth();

    // Don't render in production
    if (!isDevMode) return null;

    const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (role) {
            case 'admin': return 'destructive';
            case 'approver': return 'default';
            default: return 'secondary';
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return <Shield className="h-3 w-3 mr-1" />;
            case 'approver': return <UserCheck className="h-3 w-3 mr-1" />;
            default: return <User className="h-3 w-3 mr-1" />;
        }
    };

    const handleUserChange = (userId: string) => {
        const user = DEV_USERS.find(u => u.id === userId);
        if (user) {
            setCurrentUser(user);
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* Dev Mode Indicator */}
            <span className="text-xs text-orange-500 font-medium">🧪 DEV</span>

            <Select value={currentUser.id} onValueChange={handleUserChange}>
                <SelectTrigger
                    className="w-[200px] border-dashed border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20"
                >
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-orange-500" />
                        <SelectValue placeholder="Select user" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    {DEV_USERS.map((user: DevUser) => (
                        <SelectItem
                            key={user.id}
                            value={user.id}
                            className="cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                {getRoleIcon(user.role)}
                                <span>{user.name}</span>
                                <Badge
                                    variant={getRoleBadgeVariant(user.role)}
                                    className="text-xs ml-auto"
                                >
                                    {user.role}
                                </Badge>
                            </div>
                        </SelectItem>
                    ))}
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Page reloads on switch
                    </div>
                </SelectContent>
            </Select>
        </div>
    );
}
