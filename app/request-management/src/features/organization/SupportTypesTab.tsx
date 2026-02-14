import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Building2, Briefcase, UserCog, Network, Loader2, AlertCircle } from 'lucide-react';
import { Switch } from '../../components/ui/Switch';
import { AdminService } from '../../services/AdminService';
import type { SupportType } from '../../types/IdentityEntities';
import { globalEvents, EVENT_TYPES } from '../../lib/events';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../components/ui/AlertDialog";

// Icon mapping for principal types
const typeIcons: Record<string, React.ElementType> = {
    USER: User,
    GROUP: Users,
    TEAM: Users,
    DEPARTMENT: Building2,
    ROLE: Briefcase,
    POSITION: Network,
};

/**
 * SupportTypesTab - Configure which principal types are enabled.
 * 
 * Administrators can toggle types on/off. When disabled, a type
 * won't appear in PrincipalSelect dropdowns throughout the app.
 */
export function SupportTypesTab() {
    const [types, setTypes] = useState<SupportType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Error Dialog State
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        loadTypes();
    }, []);

    async function loadTypes() {
        try {
            setIsLoading(true);
            const data = await AdminService.getSupportTypes();
            setTypes(data);
        } catch (error) {
            console.error('Failed to load support types:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to load principal types');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleToggle(type: SupportType) {
        try {
            setUpdatingId(type.ID);
            const newValue = !type.isEnabled;

            await AdminService.updateSupportType(type.ID, { isEnabled: newValue });

            // Update local state
            setTypes(prev =>
                prev.map(t => t.ID === type.ID ? { ...t, isEnabled: newValue } : t)
            );

            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, `${type.name} ${newValue ? 'enabled' : 'disabled'}`);
        } catch (error: any) {
            console.error('Failed to update type:', error);
            const msg = error.response?.data?.error?.message || error.message || `Failed to update ${type.name}`;
            setErrorMessage(msg);
            setErrorDialogOpen(true);
        } finally {
            setUpdatingId(null);
        }
    }

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-200" />
                            <div className="flex-1 space-y-2">
                                <div className="h-5 bg-slate-200 rounded w-24" />
                                <div className="h-4 bg-slate-100 rounded w-full" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur rounded-xl border border-slate-200 p-4 mb-6">
                <p className="text-sm text-slate-600">
                    Configure which principal types are available for workflow assignment.
                    Disabling a type will hide it from selection dropdowns, but won't affect existing assignments.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {types.map((type, index) => {
                    const Icon = typeIcons[type.code] || User;
                    const isUpdating = updatingId === type.ID;

                    return (
                        <motion.div
                            key={type.ID}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                bg-white rounded-xl border border-slate-200 p-5
                transition-all duration-200 hover:shadow-md
                ${!type.isEnabled ? 'opacity-60' : ''}
              `}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${type.isEnabled
                                            ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                            : 'bg-slate-200'
                                        }
                  `}>
                                        <Icon className={`w-6 h-6 ${type.isEnabled ? 'text-white' : 'text-slate-500'}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{type.name}</h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {type.description || `${type.code} principal type`}
                                        </p>
                                        <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded">
                                            {type.code}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    {isUpdating ? (
                                        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                                    ) : (
                                        <Switch
                                            checked={type.isEnabled}
                                            onCheckedChange={() => handleToggle(type)}
                                            disabled={type.code === 'USER'} // USER type cannot be disabled
                                        />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="flex items-center gap-2 text-destructive mb-2">
                            <AlertCircle className="h-6 w-6" />
                            <AlertDialogTitle>Operation Failed</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-base text-slate-700">
                            {errorMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="bg-red-50 p-3 rounded-md border border-red-100 mt-2">
                        <p className="text-xs text-red-600">
                            You must remove all references to this type in Approval Rules or Groups before disabling it.
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
