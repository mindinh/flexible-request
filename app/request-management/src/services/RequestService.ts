import { api } from '../lib/api';
import type { Request, RequestType } from '../types';

const API_BASE = '/browse';

export const RequestService = {
    /**
     * Fetch all requests with expanded related entities
     * @param creatorId - Optional ID to filter by creator
     */
    async getRequests(creatorId?: string): Promise<Request[]> {
        let url = `${API_BASE}/Requests?$expand=requestType,createdBy,refRequest&$orderby=createdAt desc`;
        if (creatorId) {
            const filter = `createdBy_ID eq '${creatorId}'`;
            url += `&$filter=${encodeURIComponent(filter)}`;
        }
        const response = await api.get(url);
        return response.data.value || [];
    },

    /**
     * Fetch all available request types
     */
    async getRequestTypes(): Promise<RequestType[]> {
        const response = await api.get(`${API_BASE}/RequestTypes`);
        return response.data.value || [];
    },

    /**
     * Fetch a single request by ID with all details
     */
    async getRequestById(id: string): Promise<Request> {
        // Use flat coordinator fields (coordinatorId, coordinatorType, coordinatorValue)
        const expand = 'requestType,steps($expand=stepDefinition,approvals,claimedBy),history';
        const response = await api.get(`${API_BASE}/Requests/${id}?$expand=${expand}`);
        return response.data;
    },

    /**
     * Create a new request
     */
    async createRequest(data: Partial<Request>): Promise<Request> {
        const response = await api.post(`${API_BASE}/Requests`, data);
        return response.data;
    },

    /**
     * Update an existing request
     */
    async updateRequest(id: string, data: Partial<Request>): Promise<Request> {
        const response = await api.patch(`${API_BASE}/Requests/${id}`, data);
        return response.data;
    },

    /**
     * Delete a request
     */
    async deleteRequest(id: string): Promise<void> {
        await api.delete(`${API_BASE}/Requests/${id}`);
    },

    /**
     * Copy a request: creates a new draft, then explicitly copies Step 1 data client-side.
     * Client-side copy is used instead of relying on the backend `after CREATE` hook because
     * CAP does not consistently expose `refRequest_ID` in the after-handler's data payload.
     */
    async copyRequest(id: string): Promise<Request> {
        // 1. Fetch source request with steps and step data
        const expand = 'requestType,steps($expand=stepDefinition,data)';
        const sourceResp = await api.get(`${API_BASE}/Requests/${id}?$expand=${expand}`);
        const source = sourceResp.data;

        // 2. Find the source start step's data payload
        const sourceStartStep = source.steps?.find((s: any) => s.stepDefinition?.isStartStep) || source.steps?.[0];
        const sourcePayload: string | null = sourceStartStep?.data?.payload || null;

        // 3. Create the new draft request with refRequest_ID (for audit trail)
        const createResp = await api.post(`${API_BASE}/Requests`, {
            title: `Copy of ${source.title}`,
            description: source.description,
            priority: source.priority,
            requestType_ID: source.requestType?.ID,
            refRequest_ID: source.ID,
        });
        const newRequest = createResp.data;
        const newRequestId = newRequest.ID;

        // 4. Only proceed if source had real data to copy
        if (sourcePayload && sourcePayload !== '{}') {
            // Fetch the newly created request's steps to find the start step
            const newReqResp = await api.get(
                `${API_BASE}/Requests(${newRequestId})?$expand=steps($expand=stepDefinition,data)`
            );
            const newStartStep =
                newReqResp.data.steps?.find((s: any) => s.stepDefinition?.isStartStep) ||
                newReqResp.data.steps?.[0];

            if (newStartStep) {
                if (newStartStep.data?.ID) {
                    // PATCH existing RequestData record with source payload
                    await api.patch(`${API_BASE}/RequestData(${newStartStep.data.ID})`, {
                        payload: sourcePayload,
                    });
                } else {
                    // POST new RequestData record if one wasn't created by the workflow
                    await api.post(`${API_BASE}/RequestData`, {
                        step_ID: newStartStep.ID,
                        payload: sourcePayload,
                    });
                }
            }
        }

        return newRequest;
    },

    // =========================================
    // Sprint 3: Step Claim/Release Actions
    // =========================================

    /**
     * Claim a step for the current user (for group-assigned steps)
     */
    async claimStep(stepId: string): Promise<void> {
        await api.post(`${API_BASE}/Steps/${stepId}/RequestService.claimStep`);
    },

    /**
     * Release a claimed step (allows others to claim)
     */
    async releaseStep(stepId: string): Promise<void> {
        await api.post(`${API_BASE}/Steps/${stepId}/RequestService.releaseStep`);
    },

    // =========================================
    // Sprint 3: Inbox Filters
    // =========================================

    /**
     * Fetch approvals directly assigned to the current user (My Tasks)
     * Uses backend getMyTasks() function which filters by logged-in user's Shadow ID
     */
    async getMyTasks(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/getMyTasks()`);
        return response.data.value || [];
    },

    /**
     * Fetch approvals assigned to user's groups (Team Tasks)
     * Uses backend getTeamTasks() function which handles group membership lookup
     */
    async getTeamApprovals(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/getTeamTasks()`);
        return response.data.value || [];
    },


    /**
     * Fetch requests where current user is coordinator
     * Uses backend getCoordinatingRequests() function which handles user lookup
     */
    async getCoordinatingRequests(): Promise<Request[]> {
        const response = await api.get(`${API_BASE}/getCoordinatingRequests()?$expand=refRequest`);
        return response.data.value || [];
    },

    // =========================================
    // Notifications (Header Bell Icon)
    // =========================================

    /**
     * Fetch latest notifications for current user
     */
    async getNotifications(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/Notifications?$expand=request&$orderby=createdAt desc&$top=20`);
        return response.data.value || [];
    },

    /**
     * Mark all notifications as read for current user
     */
    async markAllNotificationsAsRead(): Promise<void> {
        await api.post(`${API_BASE}/markAllAsRead`);
    },

    /**
     * Mark a specific notification as read
     */
    async markNotificationAsRead(id: string): Promise<void> {
        await api.post(`${API_BASE}/Notifications(${id})/RequestService.markAsRead`);
    },

    /**
     * Delete a specific notification
     */
    async deleteNotification(id: string): Promise<void> {
        await api.delete(`${API_BASE}/Notifications(${id})`);
    },

    /**
     * Delete all notifications for current user
     */
    async deleteAllNotifications(): Promise<void> {
        await api.post(`${API_BASE}/deleteAll`);
    },

    /**
     * Fetch all shadow users for coordinator filtering
     */
    async getShadowUsers(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/ShadowUsers?$orderby=displayName`);
        return response.data.value || [];
    }
};

