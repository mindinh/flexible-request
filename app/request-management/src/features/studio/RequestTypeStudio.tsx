import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Loader2, Type, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StudioLayout } from '../../layouts/StudioLayout';
import { StudioHeader, TabNavigation, LeftPanel, RightPanel, StudioToastProvider, useStudioToast } from '../../components/studio';
import { WorkflowTab } from './WorkflowTab';
import { SchemaTab } from './SchemaTab';
import { DataSchemaTab } from './DataSchemaTab';
import { DataFieldPropertiesContent } from './DataFieldPropertiesContent';
import { StatusActionsTab } from './StatusActionsTab';
import { useStudioStore } from './useStudioStore';
import { motion } from 'framer-motion';
import type { UiCanvasItem, UiFormField } from './types';

import { FieldPropertiesContent } from './FieldPropertiesContent';
import { SchemaPalette } from './SchemaPalette';
import { SchemaPreviewTab } from './SchemaPreviewTab';
import { WorkflowPalette } from './WorkflowPalette';
import { WorkflowNodeProperties } from './WorkflowNodeProperties';
import { Settings2 } from 'lucide-react';



// Base tab definitions (dynamic tabs added at runtime)
interface TabDef { id: string; label: string; closeable?: boolean; indent?: boolean }
const BASE_TABS: TabDef[] = [
    { id: 'data-schema', label: 'Data Schema' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'statuses', label: 'Statuses' },
];

function StudioContent() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useStudioToast();

    // Global state
    const {
        requestTypeId,
        metadata,
        workflow,
        activeTab,
        isLoading,
        isDirty,
        isSaving,
        error,
        saveChanges,
        setActiveTab,
        loadRequestType,
        updateMetadata,
        activeStepId,
        setActiveStepId,
        // Schema state
        schema,
        updateSchema,
        selectedSchemaFieldId,
        setSelectedSchemaFieldId,
        // Data Schema state
        selectedDataFieldId,
        setSelectedDataFieldId,
        // Draft conflict
        draftConflict,
        draftConflictMessage,
        resolveDraftConflict,
        discardChanges,
        // Form state
        activeFormId,
        forms,
        // Form Editor sub-tab
        isFormEditorOpen,
        setIsFormEditorOpen,
    } = useStudioStore();

    // Form Preview tab state
    const [isFormPreviewOpen, setIsFormPreviewOpen] = useState(false);
    const [previewFormId, setPreviewFormId] = useState<string | null>(null);

    // Build sub-tabs list (Form Editor, Form Preview) — rendered in a second row
    const subTabs: TabDef[] = [];
    if (isFormEditorOpen) {
        const activeFormName = forms.find(f => f.id === activeFormId)?.name || 'Form Editor';
        subTabs.push({ id: 'schema', label: activeFormName, closeable: true });
    }
    if (isFormPreviewOpen) {
        subTabs.push({ id: 'form-preview', label: 'Form Preview', closeable: true });
    }

    // To track previous saving state for toast
    const prevIsSaving = useRef(isSaving);

    // Initial Load
    useEffect(() => {
        if (id && id !== requestTypeId) {
            loadRequestType(id);
        }
    }, [id, loadRequestType, requestTypeId]);

    // Toast Logic
    useEffect(() => {
        if (prevIsSaving.current && !isSaving && !error) {
            showToast('Changes saved successfully', 'success');
        } else if (prevIsSaving.current && !isSaving && error) {
            showToast(`Failed to save: ${error}`, 'error');
        }
        prevIsSaving.current = isSaving;
    }, [isSaving, error, showToast]);

    const handleNodeSelect = (nodeId: string | null) => {
        setActiveStepId(nodeId);
    };

    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'data-schema':
                return <DataSchemaTab />;
            case 'workflow':
                return <WorkflowTab onNodeSelect={handleNodeSelect} />;
            case 'schema':
                return <SchemaTab onPreview={() => {
                    setPreviewFormId(activeFormId);
                    setIsFormPreviewOpen(true);
                    setActiveTab('form-preview');
                }} />;
            case 'form-preview':
                return <SchemaPreviewTab formId={previewFormId} />;
            case 'statuses':
                return <StatusActionsTab />;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--studio-bg-secondary)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-[var(--studio-primary)]" size={48} />
                    <p className="text-[var(--studio-text-secondary)] font-medium">Loading Request Type Studio...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--studio-bg-secondary)]">
                <div className="max-w-md text-center">
                    <h2 className="text-xl font-bold text-[var(--studio-error)] mb-2">Failed to Load</h2>
                    <p className="text-[var(--studio-text-secondary)] mb-4">{error}</p>
                    <Button
                        onClick={() => id && loadRequestType(id)}
                    >
                        Retry
                    </Button>
                    <Button
                        variant="ghost"
                        className="mt-2"
                        onClick={() => navigate('/studio')}
                    >
                        Back to Studio
                    </Button>
                </div>
            </div>
        );
    }

    // Draft conflict screen
    if (draftConflict) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--studio-bg-secondary)]">
                <div className="max-w-md text-center p-8 rounded-xl bg-[var(--studio-bg-primary)] border border-[var(--studio-border)] shadow-lg">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
                            <AlertTriangle className="text-amber-500" size={32} />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--studio-text-primary)] mb-2">Draft Conflict</h2>
                    <p className="text-[var(--studio-text-secondary)] mb-6">
                        {draftConflictMessage || 'Another user is currently editing this Request Type.'}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button
                            variant="ghost"
                            onClick={() => navigate('/studio')}
                        >
                            Go Back
                        </Button>
                        <Button
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={resolveDraftConflict}
                        >
                            Edit
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Safety guard: metadata not yet loaded (or store was reset).
    // Show the loading spinner so we never render StudioLayout with null data.
    if (!metadata) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--studio-bg-secondary)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-[var(--studio-primary)]" size={48} />
                    <p className="text-[var(--studio-text-secondary)] font-medium">Loading Request Type Studio...</p>
                </div>
            </div>
        );
    }

    const handleDiscard = async () => {
        await discardChanges();
        navigate('/studio');
    };

    const handleBack = async () => {
        if (isDirty) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave? Your draft will be discarded.');
            if (!confirmed) return;
        }
        await discardChanges();
        navigate('/studio');
    };

    return (
        <StudioLayout
            header={
                <StudioHeader
                    title={metadata?.name || 'Loading...'}
                    description={metadata?.description}
                    isActive={metadata?.isEnabled ?? true}
                    icon={metadata?.icon || 'workflow'}
                    onTitleChange={(name) => updateMetadata({ name })}
                    onDescriptionChange={(description) => updateMetadata({ description })}
                    onActiveChange={(isEnabled) => updateMetadata({ isEnabled })}
                    onIconChange={(icon) => updateMetadata({ icon })}
                    onDiscard={handleDiscard}
                    onBack={handleBack}
                    isDirty={isDirty}
                    actions={
                        <motion.button
                            className={`studio-btn studio-btn--primary ${isDirty ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                            onClick={saveChanges}
                            disabled={isSaving || !isDirty}
                            whileTap={{ scale: 0.95 }}
                            animate={isDirty ? {
                                scale: [1, 1.05, 1],
                                transition: { repeat: Infinity, duration: 2, repeatDelay: 5 }
                            } : {}}
                        >
                            {isSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </motion.button>
                    }
                />
            }
            leftPanel={activeTab === 'schema' ? (collapsed) => (
                <LeftPanel
                    steps={[]}
                    activeStepId={null}
                    onStepSelect={() => { }}
                    onAddStep={() => { }}
                    isCollapsed={collapsed}
                    hideSteps
                >
                    <SchemaPalette isCollapsed={collapsed} />
                </LeftPanel>
            ) : activeTab === 'workflow' ? (collapsed) => (
                <LeftPanel
                    steps={[]}
                    activeStepId={null}
                    onStepSelect={() => { }}
                    onAddStep={() => { }}
                    isCollapsed={collapsed}
                    hideSteps
                >
                    <WorkflowPalette isCollapsed={collapsed} />
                </LeftPanel>
            ) : (activeTab === 'data-schema' || activeTab === 'statuses') ? undefined : undefined}
            rightPanel={
                activeTab === 'workflow' && activeStepId ? (() => {
                    const selectedNode = workflow.nodes.find(n => n.id === activeStepId);
                    if (!selectedNode) return null;
                    return (
                        <RightPanel
                            isOpen={!!activeStepId}
                            onClose={() => setActiveStepId(null)}
                            width={380}
                            title="Step Details"
                            icon={<Settings2 size={16} />}
                        >
                            <WorkflowNodeProperties
                                node={selectedNode}
                                allNodes={workflow.nodes}
                                edges={workflow.edges}
                            />
                        </RightPanel>
                    );
                })() : activeTab === 'data-schema' && selectedDataFieldId ? (
                    <RightPanel
                        isOpen={!!selectedDataFieldId}
                        onClose={() => setSelectedDataFieldId(null)}
                        width={420}
                        title="Field Details"
                        icon={<Type size={16} />}
                    >
                        <DataFieldPropertiesContent />
                    </RightPanel>
                ) : activeTab === 'schema' && selectedSchemaFieldId ? (
                    <RightPanel
                        isOpen={!!selectedSchemaFieldId}
                        onClose={() => setSelectedSchemaFieldId(null)}
                        width={500}
                        title="Field Properties"
                        icon={<Type size={16} />}
                    >
                        <FieldPropertiesContent
                            schema={schema}
                            selectedFieldId={selectedSchemaFieldId}
                            onUpdate={(id, updates) => {
                                const newSchema = schema.map(item => {
                                    if (item.id === id) return { ...item, ...updates };
                                    if (item.type === 'section' && 'fields' in item) {
                                        return {
                                            ...item,
                                            fields: item.fields.map(f => f.id === id ? { ...f, ...updates } : f)
                                        };
                                    }
                                    if (item.type === 'table' && 'columns' in item) {
                                        return {
                                            ...item,
                                            columns: (item as any).columns.map((c: any) => c.id === id ? { ...c, ...updates } : c)
                                        };
                                    }
                                    return item;
                                });
                                updateSchema(newSchema);
                            }}
                            onDuplicate={(id) => {
                                let itemToDuplicate: UiCanvasItem | UiFormField | null = null;
                                for (const item of schema) {
                                    if (item.id === id) { itemToDuplicate = item; break; }
                                    if (item.type === 'section' && 'fields' in item) {
                                        const field = item.fields.find(f => f.id === id);
                                        if (field) { itemToDuplicate = field; break; }
                                    }
                                    if (item.type === 'table' && 'columns' in item) {
                                        const column = (item as any).columns.find((c: any) => c.id === id);
                                        if (column) { itemToDuplicate = column; break; }
                                    }
                                }
                                if (itemToDuplicate) {
                                    const newItem = {
                                        ...itemToDuplicate,
                                        id: `${itemToDuplicate.type}-${Date.now()}`,
                                        label: `${itemToDuplicate.label} (Copy)`
                                    };
                                    updateSchema([...schema, newItem]);
                                    setSelectedSchemaFieldId(newItem.id);
                                }
                            }}
                            onDelete={(id) => {
                                const newSchema = schema.filter(item => item.id !== id).map(item => {
                                    if (item.type === 'section' && 'fields' in item) {
                                        return {
                                            ...item,
                                            fields: item.fields.filter(f => f.id !== id)
                                        };
                                    }
                                    if (item.type === 'table' && 'columns' in item) {
                                        return {
                                            ...item,
                                            columns: (item as any).columns.filter((c: any) => c.id !== id)
                                        };
                                    }
                                    return item;
                                });
                                updateSchema(newSchema);
                                setSelectedSchemaFieldId(null);
                            }}
                        />
                    </RightPanel>
                ) : null
            }
            tabs={
                <>
                    <TabNavigation
                        tabs={BASE_TABS}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                    {subTabs.length > 0 && (
                        <div className="w-full basis-full flex items-center gap-1 pl-6 py-1 border-t border-slate-100 bg-slate-50/50">
                            <span className="text-[10px] text-slate-400 mr-1 select-none">└</span>
                            <TabNavigation
                                tabs={subTabs}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                onTabClose={(tabId) => {
                                    if (tabId === 'form-preview') {
                                        setIsFormPreviewOpen(false);
                                        setActiveTab('schema');
                                    }
                                    if (tabId === 'schema') {
                                        setIsFormEditorOpen(false);
                                        setActiveTab('workflow');
                                    }
                                }}
                            />
                        </div>
                    )}
                </>
            }
        >
            {renderTabContent()}
        </StudioLayout>
    );
}

// Wrapper to provide toast context
export function RequestTypeStudio() {
    return (
        <StudioToastProvider>
            <StudioContent />
        </StudioToastProvider>
    );
}
