import { api } from '../lib/api';
import type { Request, RequestType } from '../types';

const API_BASE = '/browse';

export const RequestService = {
    /**
     * Fetch all requests with expanded related entities
     */
    async getRequests(): Promise<Request[]> {
        const response = await api.get(`${API_BASE}/Requests?$expand=requestType&$orderby=createdAt desc`);
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
        const response = await api.get(`${API_BASE}/getCoordinatingRequests()`);
        return response.data.value || [];
    }
};

