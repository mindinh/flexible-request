import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, User, Users, Building2, Briefcase, Network, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { SupportType, ShadowUser, ShadowGroup } from '../../types/IdentityEntities';

// Principal represents a user or group that can be selected
export interface Principal {
    id: string;
    type: string; // USER, GROUP, TEAM, DEPARTMENT, ROLE, POSITION
    displayName: string;
    email?: string; // For users
    description?: string; // For groups
}

interface PrincipalSelectProps {
    value?: Principal | null;
    onChange: (principal: Principal | null) => void;
    placeholder?: string;
    disabled?: boolean;
    allowedTypes?: string[]; // Filter which types are shown
    excludeIds?: string[]; // IDs to exclude from results
    className?: string;
}

// Icon mapping for principal types
const typeIcons: Record<string, React.ElementType> = {
    USER: User,
    GROUP: Users,
    TEAM: Users,
    DEPARTMENT: Building2,
    ROLE: Briefcase,
    POSITION: Network,
};

// Colors for type tabs
const typeColors: Record<string, string> = {
    USER: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    GROUP: 'bg-violet-100 text-violet-700 hover:bg-violet-200',
    TEAM: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    DEPARTMENT: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    ROLE: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    POSITION: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
};

/**
 * PrincipalSelect - Reusable component for selecting users or groups.
 * 
 * Features:
 * - Type tabs to switch between USER, GROUP, TEAM, etc.
 * - Debounced search with async results
 * - Avatar/icon display for selected principal
 */
export function PrincipalSelect({
    value,
    onChange,
    placeholder = 'Select a principal...',
    disabled = false,
    allowedTypes,
    excludeIds = [],
    className,
}: PrincipalSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeType, setActiveType] = useState<string>('USER');
    const [supportTypes, setSupportTypes] = useState<SupportType[]>([]);
    const [results, setResults] = useState<Principal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load support types on mount
    useEffect(() => {
        loadSupportTypes();
    }, []);

    // Handle click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;

        const timeoutId = setTimeout(() => {
            searchPrincipals();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, activeType, isOpen]);

    async function loadSupportTypes() {
        try {
            setIsLoadingTypes(true);
            const response = await api.get('/browse/SupportTypes?$orderby=sortOrder');
            const types = response.data.value;
            // Filter to only enabled types
            let enabledTypes = types.filter(t => t.isEnabled);

            // Further filter by allowed types if specified
            if (allowedTypes && allowedTypes.length > 0) {
                enabledTypes = enabledTypes.filter(t => allowedTypes.includes(t.code));
            }

            setSupportTypes(enabledTypes);

            // Set initial active type
            if (enabledTypes.length > 0) {
                setActiveType(enabledTypes[0].code);
            }
        } catch (error) {
            console.error('Failed to load support types:', error);
        } finally {
            setIsLoadingTypes(false);
        }
    }

    async function searchPrincipals() {
        try {
            setIsLoading(true);
            let principals: Principal[] = [];

            if (activeType === 'USER') {
                let url = '/browse/ShadowUsers?$orderby=displayName';
                if (searchQuery) {
                    const filter = `contains(displayName,'${searchQuery}') or contains(email,'${searchQuery}')`;
                    url += `&$filter=${encodeURIComponent(filter)}`;
                }
                const response = await api.get(url);
                const users: ShadowUser[] = response.data.value;
                principals = users
                    .filter(u => !excludeIds.includes(u.ID))
                    .map(u => ({
                        id: u.ID,
                        type: 'USER',
                        displayName: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
                        email: u.email,
                    }));
            } else {
                // For groups, teams, departments, roles - search ShadowGroups filtered by type
                const response = await api.get('/browse/ShadowGroups?$expand=type&$orderby=name');
                const groups: ShadowGroup[] = response.data.value;
                principals = groups
                    .filter(g => g.type?.code === activeType)
                    .filter(g => !excludeIds.includes(g.ID))
                    .filter(g =>
                        !searchQuery ||
                        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .map(g => ({
                        id: g.ID,
                        type: g.type?.code || activeType,
                        displayName: g.name,
                        description: g.description,
                    }));
            }

            setResults(principals);
        } catch (error) {
            console.error('Failed to search principals:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }

    function handleSelect(principal: Principal) {
        onChange(principal);
        setIsOpen(false);
        setSearchQuery('');
    }

    function handleClear() {
        onChange(null);
    }

    // Filter types to show in tabs
    const visibleTypes = useMemo(() => {
        return supportTypes.slice(0, 5); // Show max 5 types
    }, [supportTypes]);

    const Icon = value ? (typeIcons[value.type] || User) : User;

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Trigger Button */}
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen);
                        if (!isOpen) {
                            setTimeout(() => inputRef.current?.focus(), 100);
                        }
                    }
                }}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 h-auto justify-start',
                    isOpen && 'border-violet-500 ring-1 ring-violet-500'
                )}
            >
                {value ? (
                    <>
                        <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                            value.type === 'USER'
                                ? 'bg-slate-200'
                                : 'bg-violet-100'
                        )}>
                            <Icon className={cn(
                                'w-4 h-4',
                                value.type === 'USER' ? 'text-slate-600' : 'text-violet-600'
                            )} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <div className="font-medium text-slate-900 truncate">
                                {value.displayName}
                            </div>
                            {value.email && (
                                <div className="text-xs text-slate-500 truncate">{value.email}</div>
                            )}
                        </div>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClear();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    handleClear();
                                }
                            }}
                            className="h-6 w-6 flex items-center justify-center hover:bg-slate-200 rounded-full cursor-pointer"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </div>
                    </>
                ) : (
                    <>
                        <User className="w-5 h-5 text-slate-400" />
                        <span className="flex-1 text-slate-500 text-left">{placeholder}</span>
                        <ChevronDown className={cn(
                            'w-4 h-4 text-slate-400 transition-transform',
                            isOpen && 'rotate-180'
                        )} />
                    </>
                )}
            </Button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
                    >
                        {/* Type Tabs */}
                        {!isLoadingTypes && visibleTypes.length > 1 && (
                            <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
                                {visibleTypes.map(type => {
                                    const TypeIcon = typeIcons[type.code] || User;
                                    return (
                                        <Button
                                            key={type.code}
                                            type="button"
                                            variant={activeType === type.code ? 'secondary' : 'ghost'}
                                            size="sm"
                                            onClick={() => setActiveType(type.code)}
                                            className={cn(
                                                'whitespace-nowrap',
                                                activeType === type.code && (typeColors[type.code] || '')
                                            )}
                                        >
                                            <TypeIcon className="w-4 h-4" />
                                            {type.name}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={`Search ${activeType.toLowerCase()}s...`}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Results */}
                        <div className="max-h-64 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                                </div>
                            ) : results.length === 0 ? (
                                <div className="py-8 text-center text-sm text-slate-500">
                                    {searchQuery
                                        ? `No ${activeType.toLowerCase()}s found`
                                        : `No ${activeType.toLowerCase()}s available`
                                    }
                                </div>
                            ) : (
                                <div className="py-1">
                                    {results.map(principal => {
                                        const PrincipalIcon = typeIcons[principal.type] || User;
                                        return (
                                            <Button
                                                key={principal.id}
                                                type="button"
                                                variant="ghost"
                                                onClick={() => handleSelect(principal)}
                                                className="w-full flex items-center gap-3 px-3 py-2 h-auto justify-start"
                                            >
                                                <div className={cn(
                                                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                                                    principal.type === 'USER'
                                                        ? 'bg-slate-200'
                                                        : 'bg-violet-100'
                                                )}>
                                                    <PrincipalIcon className={cn(
                                                        'w-4 h-4',
                                                        principal.type === 'USER' ? 'text-slate-600' : 'text-violet-600'
                                                    )} />
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className="font-medium text-slate-900 truncate">
                                                        {principal.displayName}
                                                    </div>
                                                    {(principal.email || principal.description) && (
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {principal.email || principal.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
