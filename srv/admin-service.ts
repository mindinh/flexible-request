import cds from '@sap/cds';
import { SchemaHandler } from './handlers/admin/SchemaHandler';
import { RequestTypeHandler } from './handlers/admin/RequestTypeHandler';
import { StepHandler } from './handlers/admin/StepHandler';
import { IdentityHandler } from './handlers/admin/IdentityHandler';
import { ApproverRulesHandler } from './handlers/admin/ApproverRulesHandler';
import { OrgHierarchyHandler } from './handlers/admin/OrgHierarchyHandler';
import { ManagedUserHandler } from './handlers/ManagedUserHandler';

/**
 * AdminService - Configuration management for Request Types and Workflows.
 * 
 * This file should remain thin. All business logic is delegated to handlers.
 * 
 * Handlers:
 * - ManagedUserHandler: UUID-based createdBy/modifiedBy resolution
 * - SchemaHandler: JSON Schema validation
 * - RequestTypeHandler: Clone action, delete validation
 * - StepHandler: Sequence validation, dependency checks
 * - IdentityHandler: ShadowGroups/SupportTypes validation
 */
export default class AdminService extends cds.ApplicationService {

    async init() {

        // Register all handlers
        new ManagedUserHandler(this).register();
        new SchemaHandler(this).register();
        new RequestTypeHandler(this).register();
        new StepHandler(this).register();
        new IdentityHandler(this).register();
        new ApproverRulesHandler(this).register();
        new OrgHierarchyHandler(this).register();

        await super.init();
    }
}
