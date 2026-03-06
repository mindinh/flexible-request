import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui';
import { ConfirmDialog } from '../../../components/studio';

// Local imports
import { useRequestFormData } from './hooks';
import { useAuth } from '../../../lib/auth-context';
import {
    FormHeader,
    RequestInfoForm,
    StepAssignmentHeader,
    DynamicFormSection,
    FormActions,
    WorkflowPreviewPanel
} from './components';
import { parseSchemaContent } from '../../../lib/schemaParser';
import type { Principal } from '../../../components/shared/PrincipalSelect';

/**
 * Dynamic Request Form
 * 
 * Used for creating new requests and editing draft requests.
 * Renders dynamic form fields based on request type schema.
 * Supports step owner assignment for all workflow steps.
 * Allows pre-filling data for future workflow steps.
 */
export function DynamicRequestForm() {
    const { typeId, id: requestId } = useParams<{ typeId?: string; id?: string }>();
    const navigate = useNavigate();
    const { isAdmin, currentUserId } = useAuth();
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Use custom hook for all data management
    const {
        formData,
        requestType,
        existingRequest,
        schemaItems: startStepSchemaItems,
        resolvedApprovers,
        startStep,
        stepAssignments: stepOwners, // Alias to keep existing name
        isEditMode,
        isPageLoading,
        error,
        saveMutation,
        submitMutation,
        deleteMutation,
        handleFieldChange,
        handleAssignmentChange, // Use new handler
        handleSave,
        handleSubmit,
        isLoading,
    } = useRequestFormData({ typeId, requestId });
    // Get all steps
    const steps = useMemo(() => {
        // Steps are now pre-sorted by useRequestFormData
        return requestType?.steps || [];
    }, [requestType?.steps]);

    const isCoordinator = useMemo(() => {
        if (!existingRequest) return true;
        return existingRequest.coordinatorId === currentUserId;
    }, [existingRequest, currentUserId]);

    // Fixed to start step for view-only mode
    const effectiveSelectedStepId = startStep?.ID || steps[0]?.ID;
    const isStartStep = true; // Always show start step form in this view

    // Future steps data map - stores pre-filled data for non-start steps
    const [futureStepsData, setFutureStepsData] = useState<Record<string, Record<string, any>>>({});

    // Get the currently selected step definition
    const selectedStep = useMemo(() => {
        if (!effectiveSelectedStepId) return null;
        return (steps as any[]).find(s => s.ID === effectiveSelectedStepId) || null;
    }, [steps, effectiveSelectedStepId]);

    // Resolve schema items for the selected step
    const currentSchemaItems = useMemo(() => {
        if (isStartStep) return startStepSchemaItems;

        // Decoupled form support for future/non-start steps
        if (selectedStep?.formId) {
            try {
                const forms = requestType?.formSchemasContent ? JSON.parse(requestType.formSchemasContent) : [];
                const form = forms.find((f: any) => f.id === selectedStep.formId);
                if (form) return form.items || [];
            } catch (e) {
                console.warn('Failed to parse formSchemasContent for step form resolution', e);
            }
        }

        return parseSchemaContent(selectedStep?.schemaContent);
    }, [isStartStep, startStepSchemaItems, selectedStep, requestType?.formSchemasContent]);

    // Resolve form data for the selected step
    const currentFormData = isStartStep ? formData : (futureStepsData[effectiveSelectedStepId] || {});

    // Handle field changes for the selected step
    const handleCurrentFieldChange = (fieldId: string, value: any) => {
        if (isStartStep) {
            handleFieldChange(fieldId, value);
        } else {
            setFutureStepsData(prev => ({
                ...prev,
                [effectiveSelectedStepId]: {
                    ...prev[effectiveSelectedStepId],
                    [fieldId]: value
                }
            }));
        }
    };

    // Get the current step owner value for the selected step
    const stepOwnerValue: Principal | null = useMemo(() => {
        if (!effectiveSelectedStepId) return null;

        const assignment = stepOwners[effectiveSelectedStepId];

        // If an assignment exists (even if empty/cleared), use it
        if (assignment) {
            // If it has an ID, it's a valid user/group
            if (assignment.ownerId) {
                return {
                    id: assignment.ownerId,
                    type: assignment.ownerType,
                    displayName: assignment.ownerName,
                };
            }
            // If it exists but has no ID, it means "Explicitly Cleared/Unassigned"
            return null;
        }

        // Fall back to default from step definition ONLY if no assignment record exists
        const step = (steps as any[]).find(s => s.ID === effectiveSelectedStepId);
        if (step?.ownerId) {
            return {
                id: step.ownerId,
                type: step.ownerType || 'USER',
                displayName: step.ownerDisplayName || step.ownerId,
            };
        }

        return null;
    }, [effectiveSelectedStepId, stepOwners, steps]);

    // Handle step owner change for the selected step
    const handleStepOwnerChange = (principal: Principal | null) => {
        if (!effectiveSelectedStepId) return;

        if (principal) {
            handleAssignmentChange(effectiveSelectedStepId, {
                ownerId: principal.id,
                ownerType: principal.type,
                ownerName: principal.displayName,
            });

            // Also update formData for backward compatibility (start step)
            if (isStartStep) {
                handleFieldChange('stepOwnerId', principal.id);
                handleFieldChange('stepOwnerType', principal.type);
                handleFieldChange('stepOwnerName', principal.displayName);
            }
        } else {
            handleAssignmentChange(effectiveSelectedStepId, null);

            // Clear formData for start step
            if (isStartStep) {
                handleFieldChange('stepOwnerId', null);
                handleFieldChange('stepOwnerType', null);
                handleFieldChange('stepOwnerName', null);
            }
        }
    };

    // handleStepClick removed (view-only)

    // Loading state
    if (isPageLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Error state
    if (error || !requestType) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <AlertCircle className="w-12 h-12 mb-4 text-destructive" />
                <h3 className="text-lg font-semibold">Request Type Not Found</h3>
                <p className="mt-2">The request type you're looking for doesn't exist.</p>
                <Button className="mt-4" onClick={() => navigate('/requests')}>
                    Go Back
                </Button>
            </div>
        );
    }

    const status = isEditMode ? existingRequest?.status : 'DRAFT';

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-8">
            {/* Header */}
            <FormHeader
                requestType={requestType}
                status={status}
                onBack={() => navigate('/requests')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content (Left Column) */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Request Metadata */}
                        <RequestInfoForm
                            formData={formData}
                            onFieldChange={handleFieldChange}
                        />

                        {/* Step Assignment Header - Shows SELECTED step */}
                        <StepAssignmentHeader
                            step={selectedStep}
                            stepOwnerValue={stepOwnerValue}
                            onStepOwnerChange={handleStepOwnerChange}
                        />

                        {/* Dynamic Form Fields - Shows for SELECTED step */}
                        {currentSchemaItems.length > 0 ? (
                            <DynamicFormSection
                                schemaItems={currentSchemaItems}
                                formData={currentFormData}
                                onFieldChange={handleCurrentFieldChange}
                                isEditMode={isEditMode}
                            />
                        ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                                <p className="text-slate-600">
                                    No form fields defined for this step.
                                </p>
                            </div>
                        )}

                        {(!isAdmin && !isCoordinator) ? null : (!isStartStep && currentSchemaItems.length > 0 && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">Pre-fill Information</p>
                                    <p className="text-xs text-blue-600 mt-0.5">
                                        You are viewing a future step. Information entered here will be pre-filled for the assigned step owner.
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Action Buttons */}
                        <FormActions
                            isEditMode={isEditMode}
                            isDraft={existingRequest?.status === 'DRAFT'}
                            isLoading={isLoading}
                            isSaving={saveMutation.isPending}
                            isSubmitting={submitMutation.isPending}
                            isDeleting={deleteMutation.isPending}
                            onSave={handleSave}
                            onCancel={() => navigate('/requests')}
                            onDiscard={() => setShowDiscardConfirm(true)}
                        />
                    </form>
                </div>

                {/* Sidebar (Right Column) */}
                <div className="lg:col-span-1">
                    <WorkflowPreviewPanel
                        steps={steps}
                        resolvedApprovers={resolvedApprovers}
                        isEditMode={isEditMode}
                        selectedStepId={undefined}
                        onStepClick={() => { }}
                        stepOwners={stepOwners}
                    />
                </div>
            </div>

            {/* Discard Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDiscardConfirm}
                onCancel={() => setShowDiscardConfirm(false)}
                onConfirm={() => deleteMutation.mutate()}
                title="Discard Request?"
                message="Are you sure you want to discard this request? This action cannot be undone and the request will be permanently deleted."
                confirmLabel="Discard Request"
                variant="danger"
            />
        </div>
    );
}

// Default export for backward compatibility
export default DynamicRequestForm;

