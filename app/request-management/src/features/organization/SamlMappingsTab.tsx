import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Link2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { AdminService } from '../../services/AdminService';
import { globalEvents, EVENT_TYPES } from '../../lib/events';

interface SamlMapping {
    ID: string;
    externalGroupName: string;
    localGroup?: { ID: string; name: string };
    localGroup_ID?: string;
    isEnabled: boolean;
    description?: string;
}

interface ShadowGroup {
    ID: string;
    name: string;
}

/**
 * SamlMappingsTab - Manage SAML-to-Local group mappings.
 * 
 * Allows admins to configure which SAML groups (from IDP) map to local ShadowGroups.
 * When users log in, they are automatically assigned to local groups based on these mappings.
 */
export function SamlMappingsTab() {
    const [mappings, setMappings] = useState<SamlMapping[]>([]);
    const [groups, setGroups] = useState<ShadowGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create form state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newExternalGroup, setNewExternalGroup] = useState('');
    const [newLocalGroupId, setNewLocalGroupId] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setIsLoading(true);
            const [mappingsData, groupsData] = await Promise.all([
                AdminService.getSamlMappings(),
                AdminService.getShadowGroups()
            ]);
            setMappings(mappingsData);
            setGroups(groupsData);
        } catch (error) {
            console.error('Failed to load SAML mappings:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to load SAML mappings');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreate() {
        if (!newExternalGroup.trim() || !newLocalGroupId) return;

        try {
            setIsCreating(true);
            await AdminService.createSamlMapping({
                externalGroupName: newExternalGroup.trim(),
                localGroup_ID: newLocalGroupId,
                description: newDescription.trim() || undefined
            });
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, { type: 'success', message: 'Mapping created successfully' });
            setShowCreateForm(false);
            setNewExternalGroup('');
            setNewLocalGroupId('');
            setNewDescription('');
            loadData();
        } catch (error) {
            console.error('Failed to create mapping:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to create mapping');
        } finally {
            setIsCreating(false);
        }
    }

    async function handleToggle(mapping: SamlMapping) {
        try {
            await AdminService.updateSamlMapping(mapping.ID, { isEnabled: !mapping.isEnabled });
            setMappings(prev => prev.map(m =>
                m.ID === mapping.ID ? { ...m, isEnabled: !m.isEnabled } : m
            ));
        } catch (error) {
            console.error('Failed to toggle mapping:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to toggle mapping');
        }
    }

    async function handleDelete(mapping: SamlMapping) {
        if (!confirm(`Delete mapping "${mapping.externalGroupName}" → "${mapping.localGroup?.name}"?`)) return;

        try {
            await AdminService.deleteSamlMapping(mapping.ID);
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, { type: 'success', message: 'Mapping deleted' });
            loadData();
        } catch (error) {
            console.error('Failed to delete mapping:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to delete mapping');
        }
    }

    const columns = [
        {
            key: 'externalGroupName',
            header: 'SAML Group (from IDP)',
            render: (mapping: SamlMapping) => (
                <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono">
                        {mapping.externalGroupName}
                    </code>
                </div>
            )
        },
        {
            key: 'arrow',
            header: '',
            width: '50px',
            render: () => (
                <Link2 className="w-4 h-4 text-slate-400 mx-auto" />
            )
        },
        {
            key: 'localGroup',
            header: 'Local Group',
            render: (mapping: SamlMapping) => (
                <Badge variant="secondary">
                    {mapping.localGroup?.name || 'Unknown'}
                </Badge>
            )
        },
        {
            key: 'status',
            header: 'Status',
            width: '100px',
            render: (mapping: SamlMapping) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className={mapping.isEnabled ? 'text-green-600' : 'text-slate-400'}
                    onClick={() => handleToggle(mapping)}
                >
                    {mapping.isEnabled ? (
                        <>
                            <ToggleRight className="w-5 h-5" />
                            <span className="ml-1">Active</span>
                        </>
                    ) : (
                        <>
                            <ToggleLeft className="w-5 h-5" />
                            <span className="ml-1">Off</span>
                        </>
                    )}
                </Button>
            )
        },
        {
            key: 'actions',
            header: '',
            width: '50px',
            render: (mapping: SamlMapping) => (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(mapping)}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-white/60 backdrop-blur rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-600">
                    Map SAML groups from your Identity Provider to local groups.
                    Users are automatically assigned to local groups on login based on their SAML claims.
                    When users are removed from SAML groups in the IDP, they are automatically removed here too.
                </p>
            </div>

            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">
                    {mappings.length} {mappings.length === 1 ? 'mapping' : 'mappings'}
                </div>
                <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowCreateForm(true)}
                >
                    <Plus className="w-4 h-4" />
                    Add Mapping
                </Button>
            </div>

            {/* Create Form (inline) */}
            {showCreateForm && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-white rounded-xl border border-violet-200 p-4 space-y-4"
                >
                    <h3 className="font-medium text-slate-900">New SAML Mapping</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                SAML Group Name
                            </label>
                            <input
                                type="text"
                                value={newExternalGroup}
                                onChange={(e) => setNewExternalGroup(e.target.value)}
                                placeholder="e.g., CNMA_CUST_PURCHASER"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Exact name from IDP (case-sensitive)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Local Group
                            </label>
                            <select
                                value={newLocalGroupId}
                                onChange={(e) => setNewLocalGroupId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            >
                                <option value="">Select a group...</option>
                                {groups.map(g => (
                                    <option key={g.ID} value={g.ID}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description (optional)
                        </label>
                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Notes about this mapping"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowCreateForm(false);
                                setNewExternalGroup('');
                                setNewLocalGroupId('');
                                setNewDescription('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleCreate}
                            disabled={isCreating || !newExternalGroup.trim() || !newLocalGroupId}
                        >
                            {isCreating ? 'Creating...' : 'Create Mapping'}
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Mappings Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <Table
                    columns={columns}
                    data={mappings}
                    isLoading={isLoading}
                    emptyMessage="No SAML mappings configured. Click 'Add Mapping' to map IDP groups to local groups."
                />
            </motion.div>
        </div>
    );
}
