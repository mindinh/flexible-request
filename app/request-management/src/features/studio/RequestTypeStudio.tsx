import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Eye, Sparkles, Loader2, ArrowLeft, ExternalLink, FormInput, Type, Copy, Settings2, ChevronDown, Trash2, List, FlaskConical, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StudioLayout } from '../../layouts/StudioLayout';
import { StepDetailsPanel, StudioHeader, TabNavigation, LeftPanel, RightPanel, FormField, StudioToastProvider, useStudioToast, getTopologicalSortedNodes } from '../../components/studio';
import { WorkflowTab } from './WorkflowTab';
import { SchemaTab } from './SchemaTab';
import { ApprovalRulesTab } from './ApprovalRulesTab';
import { StatusActionsTab } from './StatusActionsTab';
import { useStudioStore } from './useStudioStore';
import { motion } from 'framer-motion';
import type { UiCanvasItem, UiSection, UiFormField } from './types';


import { StepDetailsContent } from './StepDetailsContent';
import { FieldPropertiesContent } from './FieldPropertiesContent';
import { SimulationContent } from './SimulationContent';
import { RuleDetailsContent } from './RuleDetailsContent';
import { SchemaPalette } from './SchemaPalette';




// Tab definitions
const TABS = [
    { id: 'workflow', label: 'Workflow' },
    { id: 'schema', label: 'Form Schema' },
    { id: 'rules', label: 'Approval Rules' },
    { id: 'statuses', label: 'Statuses and Action' },
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
        isDryRunOpen,
        setIsDryRunOpen,
        selectedRuleId,
        setSelectedRuleId,
        rules,
        updateRules,
        schemas,
        updateMetadata,
        updateWorkflow,
        activeStepId,
        setActiveStepId,
        // Schema state
        schema,
        updateSchema,
        selectedSchemaFieldId,
        setSelectedSchemaFieldId,
        // Draft conflict
        draftConflict,
        draftConflictMessage,
        resolveDraftConflict,
        discardChanges
    } = useStudioStore();

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

    // Derived state for Left Panel
    const stepsForPanel = (() => {
        const sorted = getTopologicalSortedNodes(workflow.nodes, workflow.edges);
        // Fallback if sorting fails or nodes is empty (though helper handles it)
        const nodesToUse = sorted.length === workflow.nodes.length ? sorted : workflow.nodes;

        return nodesToUse.map((node, index) => ({
            id: node.id,
            name: (node.data.label as string) || 'Unnamed Step',
            order: index + 1
        }));
    })();

    // Derived state for Right Panel (Step Details)
    const selectedNode = workflow.nodes.find(n => n.id === activeStepId);

    const handleNodeSelect = (nodeId: string | null) => {
        setActiveStepId(nodeId);
    };

    const handleNodeUpdate = (nodeId: string, data: any) => {
        // Exclusivity logic for isStartStep
        const newNodes = workflow.nodes.map(node => {
            let newData = { ...node.data };

            // If setting this node as start step, unmark others
            if (data.isStart && node.id !== nodeId) {
                newData.isStart = false;
            }

            // Update target node
            if (node.id === nodeId) {
                newData = { ...newData, ...data };
            }

            return { ...node, data: newData };
        });

        // Ensure at least one start step if we are unchecking? 
        // For now, allow unchecking (user might want to switch). 
        // Validation should happen on save.

        updateWorkflow(newNodes, workflow.edges);
    };

    const handleGoToSchema = () => {
        setActiveTab('schema');
    };

    const handleAddStep = () => {
        // Use crypto.randomUUID() for compliance with backend CUID
        const newId = crypto.randomUUID();

        // Calculate smart position offset for new nodes
        // If we have nodes, place next to the last one, otherwise start at 100,100
        const xOffset = workflow.nodes.length * 250;
        const position = { x: 100 + xOffset, y: 100 };

        const newNode: any = {
            id: newId,
            type: 'stepNode', // Use custom node type 'stepNode' instead of 'step'
            position: position,
            data: {
                label: `Step ${workflow.nodes.length + 1}`,
                isStart: workflow.nodes.length === 0, // First step is start
                sla: 3
            }
        };

        // Add to workflow
        const newNodes = [...workflow.nodes, newNode];
        updateWorkflow(newNodes, workflow.edges);

        // Select the new step
        setActiveStepId(newId);
    };

    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'workflow':
                return <WorkflowTab onNodeSelect={handleNodeSelect} />;
            case 'schema':
                return <SchemaTab />;
            case 'rules':
                return <ApprovalRulesTab />;
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
            leftPanel={(collapsed) => (
                <LeftPanel
                    steps={stepsForPanel.map(s => ({
                        ...s,
                        role: workflow.nodes.find(n => n.id === s.id)?.data?.role as string | undefined
                    }))}
                    activeStepId={activeStepId}
                    onStepSelect={setActiveStepId}
                    onAddStep={handleAddStep}
                    isCollapsed={collapsed}
                >
                    {activeTab === 'schema' && (
                        <SchemaPalette isCollapsed={collapsed} />
                    )}
                </LeftPanel>
            )}
            rightPanel={
                activeTab === 'schema' && selectedSchemaFieldId ? (
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
                ) : activeTab === 'workflow' && activeStepId && selectedNode ? (
                    <RightPanel
                        isOpen={!!activeStepId}
                        onClose={() => setActiveStepId(null)}
                        width={500}
                        title="Step Details"
                    >
                        <StepDetailsContent
                            node={selectedNode}
                            allNodes={workflow.nodes}
                            edges={workflow.edges}
                            onUpdate={(id, data) => handleNodeUpdate(id, data)}
                            onUpdateEdges={(newEdges) => updateWorkflow(workflow.nodes, newEdges)}
                            onEditSchema={handleGoToSchema}
                            onManageRules={() => setActiveTab('rules')}
                        />
                    </RightPanel>
                ) : activeTab === 'rules' && isDryRunOpen ? (
                    <RightPanel
                        isOpen={true}
                        onClose={() => setIsDryRunOpen(false)}
                        width={500}
                        title="Approval Simulation"
                        icon={<FlaskConical size={18} />}
                    >
                        <SimulationContent
                            rules={rules}
                            steps={getTopologicalSortedNodes(workflow.nodes, workflow.edges)}
                            workflow={workflow}
                            requestTypeMetadata={metadata}
                        />
                    </RightPanel>
                ) : activeTab === 'rules' && selectedRuleId ? (
                    <RightPanel
                        isOpen={!!selectedRuleId}
                        onClose={() => setSelectedRuleId(null)}
                        width={500}
                        title="Rule Details"
                    >
                        <RuleDetailsContent
                            ruleId={selectedRuleId}
                            rules={rules}
                            schemas={schemas}
                            onUpdateRule={(updatedRule) => updateRules(rules.map(r => r.id === updatedRule.id ? updatedRule : r))}
                            onDeleteRule={(ruleId) => {
                                updateRules(rules.filter(r => r.id !== ruleId));
                                setSelectedRuleId(null);
                            }}
                        />
                    </RightPanel>
                ) : null
            }
            tabs={
                <TabNavigation
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
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
