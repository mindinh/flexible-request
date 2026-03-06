import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../lib/api';
import { parseSchemaContent, flattenSchemaFields } from '../../../../lib/schemaParser';
import { globalEvents, EVENT_TYPES } from '../../../../lib/events';
import { useApproverResolver } from '../../../../hooks/useApproverResolver';
import { useAuth } from '../../../../lib/auth-context';

interface UseRequestFormDataOptions {
    typeId?: string;
    requestId?: string;
}

interface ExistingStepData {
    stepId: string;
    dataId: string | null;
    data: Record<string, any>;
}

/**
 * Custom hook for managing DynamicRequestForm data
 */
export function useRequestFormData({ typeId, requestId }: UseRequestFormDataOptions) {
    const { currentUser, currentUserId } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<Record<string, any>>({});
    const isEditMode = !!requestId;

    const invalidateQueries = async (id?: string) => {
        const targetId = id || requestId;
        const promises = [];

        if (targetId) {
            promises.push(queryClient.invalidateQueries({ queryKey: ['request', targetId] }));
            promises.push(queryClient.invalidateQueries({ queryKey: ['auditLog', targetId] }));
            promises.push(queryClient.invalidateQueries({ queryKey: ['requestForEdit', targetId] }));
            promises.push(queryClient.invalidateQueries({ queryKey: ['requestStepDataForEdit', targetId] }));
        }

        // List queries
        promises.push(queryClient.invalidateQueries({ queryKey: ['requests'] }));
        promises.push(queryClient.invalidateQueries({ queryKey: ['myRequests'] }));
        promises.push(queryClient.invalidateQueries({ queryKey: ['myApprovals'] }));
        promises.push(queryClient.invalidateQueries({ queryKey: ['teamApprovals'] }));
        promises.push(queryClient.invalidateQueries({ queryKey: ['notifications'] }));

        await Promise.all(promises);
    };

    // Fetch existing request data (edit mode only)
    const { data: existingRequest, isLoading: isLoadingRequest } = useQuery({
        queryKey: ['requestForEdit', requestId],
        queryFn: async () => {
            const response = await api.get(`/browse/Requests(${requestId})?$expand=requestType`);
            return response.data;
        },
        enabled: isEditMode,
    });

    // Fetch existing step data for edit mode
    const { data: existingStepData, isLoading: isLoadingStepData } = useQuery<ExistingStepData | null>({
        queryKey: ['requestStepDataForEdit', requestId],
        queryFn: async () => {
            const response = await api.get(`/browse/Requests(${requestId})?$expand=steps($expand=data,stepDefinition)`);
            const request = response.data;
            const startStep = request.steps?.find((s: any) => s.stepDefinition?.isStartStep) || request.steps?.[0];
            if (startStep?.data?.payload) {
                try {
                    return { stepId: startStep.ID, dataId: startStep.data.ID, data: JSON.parse(startStep.data.payload) };
                } catch {
                    return { stepId: startStep.ID, dataId: null, data: {} };
                }
            }
            return startStep ? { stepId: startStep.ID, dataId: null, data: {} } : null;
        },
        enabled: isEditMode,
    });

    // Determine effective type ID
    const effectiveTypeId = isEditMode ? existingRequest?.requestType_ID : typeId;

    // Fetch Request Type with steps
    const { data: requestType, isLoading: isLoadingType, error } = useQuery({
        queryKey: ['requestTypeForForm', effectiveTypeId],
        queryFn: async () => {
            // Fetch full definition including steps and rules from public service
            // Remove IsActiveEntity filter as /browse/RequestTypes is read-only active view
            const response = await api.get(`/browse/RequestTypes('${effectiveTypeId}')?$expand=steps($expand=approverRules)`);
            return response.data;
        },
        enabled: !!effectiveTypeId,
    });

    // Get start step definition - used for schema and default owner
    const startStep = requestType?.steps?.find((s: any) => s.isStartStep) || requestType?.steps?.[0];

    // Real-time approver resolution
    const resolvedApprovers = useApproverResolver(requestType, formData);

    // Get display name - works for both dev (.name) and production (.displayName)
    const currentUserDisplayName = (currentUser as any).displayName || (currentUser as any).name || '';

    const [isInitializing, setIsInitializing] = useState(isEditMode);

    // Populate form data when editing
    useEffect(() => {
        if (isEditMode && existingStepData?.data && existingRequest) {
            setFormData(prev => ({
                ...prev,
                ...existingStepData.data,
                title: existingRequest.title || prev.title || '',
                description: existingRequest.description || prev.description || '',
                priority: existingRequest.priority || prev.priority || 'MEDIUM'
            }));
            setIsInitializing(false);
        } else if (!isEditMode) {
            setFormData(prev => ({
                ...prev,
                priority: prev.priority || 'MEDIUM',
                coordinatorId: prev.coordinatorId || currentUserId,
                coordinatorType: prev.coordinatorType || 'USER',
                coordinatorName: prev.coordinatorName || currentUserDisplayName
            }));
            setIsInitializing(false);
        }
    }, [isEditMode, existingStepData, existingRequest, currentUserId, currentUserDisplayName]);

    // Initialize step owner from StepDefinition's default owner, fallback to coordinator
    useEffect(() => {
        if (startStep && !formData.stepOwnerId && !isInitializing) {
            // Use StepDefinition's default owner if defined
            if (startStep.ownerId) {
                setFormData(prev => ({
                    ...prev,
                    stepOwnerId: startStep.ownerId,
                    stepOwnerType: startStep.ownerType || 'USER',
                    stepOwnerName: startStep.ownerDisplayName || startStep.ownerId
                }));
            } else if (formData.coordinatorId) {
                // Fall back to request coordinator
                setFormData(prev => ({
                    ...prev,
                    stepOwnerId: prev.coordinatorId,
                    stepOwnerType: prev.coordinatorType || 'USER',
                    stepOwnerName: prev.coordinatorName
                }));
            }
        }
    }, [startStep, formData.coordinatorId, formData.stepOwnerId, isInitializing]);

    // Get schema items - render exactly as defined in the Form Schema
    // Fallback: if schemaContent is empty but formId exists, resolve from formSchemasContent
    const schemaItems = useMemo(() => {
        let schemaContent = startStep?.schemaContent;
        if (!schemaContent && startStep?.formId && requestType?.formSchemasContent) {
            try {
                const forms = JSON.parse(requestType.formSchemasContent);
                const assignedForm = forms.find((f: any) => f.id === startStep.formId);
                if (assignedForm?.items) schemaContent = JSON.stringify(assignedForm.items);
            } catch { /* ignore malformed formSchemasContent */ }
        }
        return parseSchemaContent(schemaContent);
    }, [startStep?.schemaContent, startStep?.formId, requestType?.formSchemasContent]);

    // Step owners map - tracks owner assignment for ALL steps
    const [stepAssignments, setStepAssignments] = useState<Record<string, {
        ownerId: string;
        ownerType: string;
        ownerName: string;
    }>>({});

    const handleAssignmentChange = (stepId: string, assignment: { ownerId: string; ownerType: string; ownerName: string } | null) => {
        if (assignment) {
            setStepAssignments(prev => ({
                ...prev,
                [stepId]: assignment
            }));
        } else {
            // Explicitly set to empty assignment to override default
            setStepAssignments(prev => ({
                ...prev,
                [stepId]: {
                    ownerId: '',
                    ownerType: '',
                    ownerName: '',
                }
            }));
        }
    };

    const saveAssignments = async (_requestId: string, steps: any[]) => {
        const updates = Object.entries(stepAssignments).map(async ([stepDefId, assignment]) => {
            // Find the actual step instance for this definition
            const stepInstance = steps.find(s => s.stepDefinition_ID === stepDefId || s.stepDefinition?.ID === stepDefId);

            if (stepInstance) {
                if (assignment.ownerId) {
                    await api.patch(`/browse/Steps(${stepInstance.ID})`, {
                        ownerId: assignment.ownerId,
                        ownerDisplayName: assignment.ownerName,
                        ownerType: assignment.ownerType
                    });
                } else if (assignment.ownerId === '') {
                    // Explicitly clear owner
                    await api.patch(`/browse/Steps(${stepInstance.ID})`, {
                        ownerId: null,
                        ownerDisplayName: null,
                        ownerType: null
                    });
                }
            }
        });
        await Promise.all(updates);
    };

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            let reqId = requestId;
            let currentSteps: any[] = [];

            if (isEditMode && existingStepData?.stepId) {
                if (existingStepData.dataId) {
                    await api.patch(`/browse/RequestData(${existingStepData.dataId})`, {
                        payload: JSON.stringify(formData),
                    });
                } else {
                    await api.post('/browse/RequestData', {
                        step_ID: existingStepData.stepId,
                        payload: JSON.stringify(formData),
                    });
                }
                await api.patch(`/browse/Requests(${requestId})`, {
                    title: formData.title || existingRequest?.title,
                    description: formData.description || existingRequest?.description,
                    priority: formData.priority || existingRequest?.priority,
                    coordinatorId: formData.coordinatorId,
                    coordinatorType: formData.coordinatorType,
                });

                // Get steps for assignment, expanding data to handle existing placeholders
                const updatedReq = await api.get(`/browse/Requests(${requestId})?$expand=steps($expand=stepDefinition,data)`);
                currentSteps = updatedReq.data.steps || [];
                reqId = requestId;

            } else {
                const response = await api.post('/browse/Requests', {
                    title: formData.title || `New ${requestType?.title} Request`,
                    description: formData.description,
                    requestType_ID: effectiveTypeId,
                    priority: formData.priority || 'MEDIUM',
                    status: 'DRAFT',
                    coordinatorId: formData.coordinatorId,
                    coordinatorType: formData.coordinatorType,
                });
                reqId = response.data.ID;

                const createdRequest = await api.get(`/browse/Requests(${reqId})?$expand=steps($expand=stepDefinition,data)`);
                currentSteps = createdRequest.data.steps || [];
                const startStep = currentSteps.find((s: any) => s.stepDefinition?.isStartStep) || currentSteps[0];

                if (startStep) {
                    if (startStep.data?.ID) {
                        await api.patch(`/browse/RequestData(${startStep.data.ID})`, {
                            payload: JSON.stringify(formData),
                        });
                    } else {
                        await api.post('/browse/RequestData', {
                            step_ID: startStep.ID,
                            payload: JSON.stringify(formData),
                        });
                    }
                }
            }

            // Save Assignments
            await saveAssignments(reqId!, currentSteps);

            return { ID: reqId };
        },
        onSuccess: async (data) => {
            await invalidateQueries(data.ID);
            navigate(`/requests/${data.ID}/edit`);
        },
    });

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: async () => {
            let reqId = requestId;
            let currentSteps: any[] = [];

            if (isEditMode) {
                if (existingStepData?.dataId) {
                    await api.patch(`/browse/RequestData(${existingStepData.dataId})`, {
                        payload: JSON.stringify(formData),
                    });
                } else if (existingStepData?.stepId) {
                    await api.post('/browse/RequestData', {
                        step_ID: existingStepData.stepId,
                        payload: JSON.stringify(formData),
                    });
                }
                await api.patch(`/browse/Requests(${requestId})`, {
                    title: formData.title || existingRequest?.title,
                    priority: formData.priority || existingRequest?.priority,
                    coordinatorId: formData.coordinatorId,
                    coordinatorType: formData.coordinatorType,
                });

                // Get steps
                const updatedReq = await api.get(`/browse/Requests(${requestId})?$expand=steps($expand=stepDefinition,data)`);
                currentSteps = updatedReq.data.steps || [];

            } else {
                const createResponse = await api.post('/browse/Requests', {
                    title: formData.title || `New ${requestType?.title} Request`,
                    description: formData.description,
                    requestType_ID: effectiveTypeId,
                    priority: formData.priority || 'MEDIUM',
                    status: 'DRAFT',
                    coordinatorId: formData.coordinatorId,
                    coordinatorType: formData.coordinatorType,
                });
                reqId = createResponse.data.ID;

                const createdRequest = await api.get(`/browse/Requests(${reqId})?$expand=steps($expand=stepDefinition,data)`);
                currentSteps = createdRequest.data.steps || [];
                const startStep = currentSteps.find((s: any) => s.stepDefinition?.isStartStep) || currentSteps[0];

                if (startStep) {
                    if (startStep.data?.ID) {
                        await api.patch(`/browse/RequestData(${startStep.data.ID})`, {
                            payload: JSON.stringify(formData),
                        });
                    } else {
                        await api.post('/browse/RequestData', {
                            step_ID: startStep.ID,
                            payload: JSON.stringify(formData),
                        });
                    }
                }
            }

            // Save Assignments
            await saveAssignments(reqId!, currentSteps);

            await api.post(`/browse/Requests(${reqId})/RequestService.submit`);
            return { ID: reqId };
        },
        onSuccess: async (data) => {
            await invalidateQueries(data.ID);
            navigate(`/requests/${data.ID}`);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/browse/Requests(${requestId})`);
        },
        onSuccess: async () => {
            await invalidateQueries();
            navigate('/requests');
        },
    });

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const isPageLoading = isLoadingType || (isEditMode && (isLoadingRequest || isLoadingStepData)) || isInitializing;

    return {
        // Data
        formData,
        requestType,
        existingRequest,
        schemaItems,
        resolvedApprovers,
        startStep,  // Step definition for current step
        stepAssignments, // Expose assignments

        // State
        isEditMode,
        isPageLoading,
        isInitializing,
        error,

        // Mutations
        saveMutation,
        submitMutation,
        deleteMutation,

        // Handlers
        handleFieldChange,
        handleAssignmentChange, // New handler
        handleSave: () => saveMutation.mutate(),
        handleSubmit: (e: React.FormEvent) => {
            e.preventDefault();

            // Validate required fields before submitting
            const fields = flattenSchemaFields(schemaItems);
            const missingFields = fields.filter(
                f => f.required && !f.readOnly && !formData[f.id] && formData[f.id] !== 0
            );

            if (missingFields.length > 0) {
                const names = missingFields.map(f => f.label).join(', ');
                globalEvents.emit(EVENT_TYPES.API_ERROR, `Please fill in required fields: ${names}`);
                return;
            }

            submitMutation.mutate();
        },

        // Loading states
        isLoading: saveMutation.isPending || submitMutation.isPending,
    };
}
