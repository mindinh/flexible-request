import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Loader2, Search } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { AdminService } from '../../services/AdminService';
import type { AdminRequestType } from '../../types/AdminEntities';
import { getIconConfig } from '../../config/iconConfig';
import { useAuth } from '../../lib/auth-context';
import { AccessDenied } from '../../components/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import '../../styles/studio.css';

export function RequestTypeLanding() {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [requestTypes, setRequestTypes] = useState<AdminRequestType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Only load data if user is admin
        if (isAdmin) {
            loadRequestTypes();
        } else {
            setIsLoading(false);
        }
    }, [isAdmin]);

    const loadRequestTypes = async () => {
        try {
            const types = await AdminService.getRequestTypes();
            setRequestTypes(types);
        } catch (error) {
            console.error("Failed to load request types", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = async () => {
        setIsCreating(true);
        try {
            const newType = await AdminService.createRequestType({
                title: 'New Request Type',
                description: 'Draft configuration'
            });
            navigate(`/studio/${newType.ID}`);
        } catch (error) {
            console.error("Failed to create request type", error);
        } finally {
            setIsCreating(false);
        }
    };

    // Fuzzy search filter
    const filteredTypes = useMemo(() => {
        if (!searchQuery.trim()) return requestTypes;
        const query = searchQuery.toLowerCase();
        return requestTypes.filter(type =>
            type.title.toLowerCase().includes(query) ||
            type.description?.toLowerCase().includes(query)
        );
    }, [requestTypes, searchQuery]);

    // Show Access Denied for non-admins
    if (!isAdmin) {
        return (
            <AccessDenied
                title="Admin Access Required"
                message="Only administrators can access the Request Type Studio. Please contact your administrator if you need access."
            />
        );
    }

    return (
        <div style={{
            minHeight: '100%',
            backgroundColor: '#f8fafc',
            padding: '32px',
        }}>
            {/* Header */}
            <motion.div
                style={{ marginBottom: '32px' }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '8px',
                }}>
                    Request Type Studio
                </h1>
                <p style={{ color: '#64748b', fontSize: '16px' }}>
                    Design and configure your request workflows
                </p>
            </motion.div>

            {/* Actions Bar - Search + Create Button */}
            <motion.div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    gap: '16px',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                {/* Search Input */}
                <div className="relative flex-1 max-w-[400px]">
                    <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
                    />
                    <Input
                        type="text"
                        placeholder="Search request types..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Create Button */}
                <Button
                    onClick={handleCreateNew}
                    disabled={isCreating}
                >
                    {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    {isCreating ? 'Creating...' : 'Create New'}
                </Button>
            </motion.div>

            {/* Request Type Cards Grid */}
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 size={32} className="animate-spin text-slate-300" />
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '24px',
                }}>
                    {filteredTypes.map((type, index) => {
                        const iconConfig = getIconConfig((type as any).icon);
                        const IconComponent = iconConfig.icon;
                        const isActive = type.isEnabled !== false;

                        return (
                            <motion.div
                                key={type.ID}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + index * 0.05 }}
                                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)' }}
                            >
                                <Link to={`/studio/${type.ID}`} style={{ textDecoration: 'none' }}>
                                    <div style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        height: '100%',
                                        opacity: isActive ? 1 : 0.7,
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            marginBottom: '16px',
                                        }}>
                                            {/* Icon */}
                                            <div className={`${iconConfig.bgColor}`} style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <IconComponent size={28} className={iconConfig.color} />
                                            </div>

                                            {/* Status Badge */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    backgroundColor: isActive ? '#dcfce7' : '#fee2e2',
                                                    color: isActive ? '#166534' : '#991b1b',
                                                }}>
                                                    {isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>

                                        <h3 style={{
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: '#1e293b',
                                            marginBottom: '6px',
                                        }}>
                                            {type.title}
                                        </h3>
                                        <p style={{
                                            fontSize: '14px',
                                            color: '#64748b',
                                            marginBottom: '16px',
                                            minHeight: '40px',
                                            lineHeight: '1.5'
                                        }}>
                                            {type.description || 'No description provided'}
                                        </p>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            color: 'var(--brand-red)',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                        }}>
                                            Configure
                                            <ArrowRight size={16} />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}

                    {filteredTypes.length === 0 && !isLoading && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                            <Search size={48} className="text-slate-300 mb-4" />
                            <h3 className="text-slate-600 font-medium mb-2">
                                {searchQuery ? 'No matching request types' : 'No Request Types Found'}
                            </h3>
                            {searchQuery ? (
                                <Button
                                    variant="link"
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear search
                                </Button>
                            ) : (
                                <Button
                                    variant="link"
                                    onClick={handleCreateNew}
                                >
                                    Create your first request type
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
