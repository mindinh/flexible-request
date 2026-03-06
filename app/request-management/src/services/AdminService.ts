import { api } from '../lib/api'; // Use shared api with CSRF interceptor
import type { AdminRequestType } from '../types/AdminEntities';

const API_BASE = '/admin';

export const AdminService = {
    /**
     * Fetch all request types (Active entities by default)
     */
    async getRequestTypes(): Promise<AdminRequestType[]> {
        const response = await api.get(`${API_BASE}/RequestTypes`);
        return response.data.value;
    },

    /**
     * Fetch a single request type by ID, expanding all necessary relations.
     * By default, this tries to fetch the active entity.
     * If you want to edit, you should check for a draft or create one.
     */
    async getRequestTypeById(id: string, isDraft = false): Promise<AdminRequestType> {
        const expand = 'steps($expand=predecessors,approverRules),statusNetwork';
        const isActive = !isDraft;
        // Suppress global error toast for draft checks (expected 404 when no draft exists)
        const config = isDraft ? { headers: { 'X-Quiet-Error': 'true' } } : undefined;
        const response = await api.get(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=${isActive})?$expand=${expand}`, config);
        return response.data;
    },

    /**
     * Create a new Request Type (Draft)
     */
    async createRequestType(initialData: Partial<AdminRequestType>): Promise<AdminRequestType> {
        const response = await api.post(`${API_BASE}/RequestTypes`, initialData);
        return response.data;
    },

    /**
     * Edit an existing Request Type (Creates a Draft if one doesn't exist)
     */
    async editRequestType(id: string): Promise<AdminRequestType> {
        // OData v4 action to create a draft from an active entity
        // Note: ID in URL is the Active Entity ID
        const response = await api.post(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=true)/AdminService.draftEdit`, {
            PreserveChanges: true
        });
        return response.data;
    },

    /**
     * Update a Request Type Draft
     */
    async updateRequestType(id: string, data: Partial<AdminRequestType>): Promise<AdminRequestType> {
        // We patch the DRAFT entity. IsActiveEntity=false is usually key.
        const response = await api.patch(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=false)`, data);
        return response.data;
    },

    /**
     * Activate a Request Type Draft (Publish/Save)
     */
    async activateRequestType(id: string): Promise<AdminRequestType> {
        const response = await api.post(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=false)/AdminService.draftActivate`);
        return response.data;
    },

    /**
     * Discard a Draft (Force Unlock / Draft Takeover)
     * Uses the custom bound action that bypasses CAP's draft lock
     */
    async discardDraft(id: string): Promise<void> {
        await api.post(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=true)/AdminService.discardDraft`);
    },

    /**
     * Create a Step Definition (Draft)
     */
    async createStep(requestTypeId: string, stepData: any): Promise<any> {
        const response = await api.post(
            `${API_BASE}/RequestTypes(ID='${requestTypeId}',IsActiveEntity=false)/steps`,
            stepData
        );
        return response.data;
    },

    /**
     * Update a Step Definition (Draft)
     */
    async updateStep(stepId: string, stepData: any): Promise<any> {
        const response = await api.patch(
            `${API_BASE}/StepDefinitions(ID='${stepId}',IsActiveEntity=false)`,
            stepData
        );
        return response.data;
    },

    /**
     * Create a Step Dependency (predecessor relationship)
     */
    async createStepDependency(stepId: string, dependsOnId: string, action?: string): Promise<any> {
        const payload: Record<string, string> = { dependsOn_ID: dependsOnId };
        if (action) {
            payload.action = action;
        }
        const response = await api.post(
            `${API_BASE}/StepDefinitions(ID='${stepId}',IsActiveEntity=false)/predecessors`,
            payload
        );
        return response.data;
    },

    /**
     * Delete a Step Dependency
     */
    async deleteStepDependency(dependencyId: string): Promise<void> {
        await api.delete(
            `${API_BASE}/StepDependencies(ID='${dependencyId}',IsActiveEntity=false)`
        );
    },

    /**
     * Delete a Request Type (Draft or Active)
     */
    async deleteRequestType(id: string): Promise<void> {
        // Try deleting draft first
        try {
            await api.delete(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=false)`);
        } catch (e: any) {
            // Ignore 404
        }
        // Delete active entity
        try {
            await api.delete(`${API_BASE}/RequestTypes(ID='${id}',IsActiveEntity=true)`);
        } catch (e: any) {
            // Ignore 404 (if it was draft-only), throw other errors
            if (e.response && e.response.status === 404) {
                return;
            }
            throw e;
        }
    },

    /**
     * Delete a Step (Draft)
     */
    async deleteStep(stepId: string): Promise<void> {
        await api.delete(`${API_BASE}/StepDefinitions(ID='${stepId}',IsActiveEntity=false)`);
    },

    /**
     * Create an Approver Rule (child of Step)
     */
    async createApproverRule(stepId: string, ruleData: any): Promise<any> {
        const response = await api.post(
            `${API_BASE}/StepDefinitions(ID='${stepId}',IsActiveEntity=false)/approverRules`,
            ruleData
        );
        return response.data;
    },

    /**
     * Update an Approver Rule
     */
    async updateApproverRule(ruleId: string, ruleData: any): Promise<any> {
        const response = await api.patch(
            `${API_BASE}/ApproverRules(ID='${ruleId}',IsActiveEntity=false)`,
            ruleData
        );
        return response.data;
    },

    /**
     * Delete an Approver Rule
     */
    async deleteApproverRule(ruleId: string): Promise<void> {
        await api.delete(
            `${API_BASE}/ApproverRules(ID='${ruleId}',IsActiveEntity=false)`
        );
    },

    // === Identity Management (Epic 2.1) ===

    /**
     * Fetch all Support Types (principal types configuration)
     */
    async getSupportTypes(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/SupportTypes?$orderby=sortOrder`);
        return response.data.value;
    },

    /**
     * Update a Support Type (e.g., toggle isEnabled)
     */
    async updateSupportType(id: string, data: { isEnabled?: boolean }): Promise<any> {
        const response = await api.patch(`${API_BASE}/SupportTypes(ID='${id}')`, data);
        return response.data;
    },

    /**
     * Fetch all Shadow Users (JIT provisioned users)
     */
    async getShadowUsers(search?: string): Promise<any[]> {
        let url = `${API_BASE}/ShadowUsers?$orderby=displayName`;
        if (search) {
            const filter = `contains(displayName,'${search}') or contains(email,'${search}')`;
            url += `&$filter=${encodeURIComponent(filter)}`;
        }
        const response = await api.get(url);
        return response.data.value;
    },

    /**
     * Fetch all Shadow Groups with type expansion
     */
    async getShadowGroups(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/ShadowGroups?$expand=type&$orderby=name`);
        return response.data.value;
    },

    /**
     * Create a new Shadow Group
     */
    async createShadowGroup(data: { name: string; description?: string; type_ID: string }): Promise<any> {
        const response = await api.post(`${API_BASE}/ShadowGroups`, data);
        return response.data;
    },

    /**
     * Update a Shadow Group
     */
    async updateShadowGroup(id: string, data: { name?: string; description?: string }): Promise<any> {
        const response = await api.patch(`${API_BASE}/ShadowGroups(ID='${id}')`, data);
        return response.data;
    },

    /**
     * Delete a Shadow Group
     */
    async deleteShadowGroup(id: string): Promise<void> {
        await api.delete(`${API_BASE}/ShadowGroups(ID='${id}')`);
    },

    /**
     * Get members of a group
     */
    async getGroupMembers(groupId: string): Promise<any[]> {
        const response = await api.get(
            `${API_BASE}/GroupMembers?$filter=group_ID eq '${groupId}'&$expand=user`
        );
        return response.data.value;
    },

    /**
     * Add a member to a group
     */
    async addGroupMember(groupId: string, userId: string): Promise<any> {
        const response = await api.post(`${API_BASE}/GroupMembers`, {
            group_ID: groupId,
            user_ID: userId
        });
        return response.data;
    },

    /**
     * Remove a member from a group
     */
    async removeGroupMember(memberId: string): Promise<void> {
        await api.delete(`${API_BASE}/GroupMembers(ID='${memberId}')`);
    },

    // === SAML Group Mappings ===

    /**
     * Fetch all SAML group mappings
     */
    async getSamlMappings(): Promise<any[]> {
        const response = await api.get(`${API_BASE}/SamlGroupMappings?$expand=localGroup&$orderby=externalGroupName`);
        return response.data.value;
    },

    /**
     * Create a new SAML group mapping
     */
    async createSamlMapping(data: { externalGroupName: string; localGroup_ID: string; description?: string }): Promise<any> {
        const response = await api.post(`${API_BASE}/SamlGroupMappings`, data);
        return response.data;
    },

    /**
     * Update a SAML group mapping
     */
    async updateSamlMapping(id: string, data: { isEnabled?: boolean; description?: string }): Promise<any> {
        const response = await api.patch(`${API_BASE}/SamlGroupMappings(ID='${id}')`, data);
        return response.data;
    },

    /**
     * Delete a SAML group mapping
     */
    async deleteSamlMapping(id: string): Promise<void> {
        await api.delete(`${API_BASE}/SamlGroupMappings(ID='${id}')`);
    },

    // === Organization Hierarchies ===

    /**
     * Fetch OrgHierarchy records, optionally filtered by org name (stored in relationship field)
     */
    async getOrgHierarchies(orgName?: string): Promise<any[]> {
        let url = `${API_BASE}/OrgHierarchies?$expand=parentUser,parentGroup($expand=type),childUser,childGroup($expand=type)`;
        if (orgName) {
            url += `&$filter=relationship eq '${encodeURIComponent(orgName)}'`;
        }
        const response = await api.get(url);
        return response.data.value;
    },

    /**
     * Create an OrgHierarchy record
     */
    async createOrgHierarchy(data: any): Promise<any> {
        const response = await api.post(`${API_BASE}/OrgHierarchies`, data);
        return response.data;
    },

    /**
     * Delete an OrgHierarchy record
     */
    async deleteOrgHierarchy(id: string): Promise<void> {
        await api.delete(`${API_BASE}/OrgHierarchies(ID='${id}')`);
    },
};
