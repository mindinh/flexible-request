import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { RequestTypeIcon } from '../../components/shared/RequestTypeIcon';
import { Button, Input } from '../../components/ui';

interface RequestType {
    ID: string;
    title: string;
    description?: string;
    icon?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (typeId: string) => void;
}

export function RequestTypeSelectionDialog({ open, onClose, onSelect }: Props) {
    const [search, setSearch] = useState('');

    // Fetch available (enabled) request types
    const { data: requestTypes = [], isLoading } = useQuery({
        queryKey: ['availableRequestTypes'],
        queryFn: async () => {
            const response = await api.get('/browse/AvailableRequestTypes');
            return response.data.value || [];
        },
        enabled: open, // Only fetch when dialog is open
    });

    // Filter by search
    const filtered = requestTypes.filter((rt: RequestType) =>
        rt.title.toLowerCase().includes(search.toLowerCase())
    );

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (open) window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Select Request Type</h2>
                            <p className="text-sm text-slate-500 mt-1">Choose the category that best fits your needs</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Search */}
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                        <Input
                            type="text"
                            placeholder="Search request types..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <FileText className="w-12 h-12 mb-3 opacity-30" />
                            <p>No request types found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((rt: RequestType) => (
                                <button
                                    key={rt.ID}
                                    onClick={() => onSelect(rt.ID)}
                                    className={cn(
                                        "p-5 rounded-xl border-2 border-slate-100 bg-white text-left transition-all group",
                                        "hover:border-primary/30 hover:shadow-md hover:bg-primary/5",
                                        "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                    )}
                                >
                                    <RequestTypeIcon icon={rt.icon} variant="withBackground" size="md" className="mb-4 group-hover:scale-110 transition-transform duration-200" />
                                    <h3 className="font-semibold text-slate-900 mb-1">{rt.title}</h3>
                                    <p className="text-sm text-slate-500 line-clamp-2">
                                        {rt.description || 'No description available'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-slate-600 hover:text-slate-900"
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}
