import cds from '@sap/cds';
import { RequestHandler } from './handlers/RequestHandler';
import { ApprovalHandler } from './handlers/ApprovalHandler';
import { ValidationHandler } from './handlers/ValidationHandler';
import { AttachmentHandler } from './handlers/AttachmentHandler';
import { AuditLogHandler } from './handlers/AuditLogHandler';
import { StepHandler } from './handlers/StepHandler';
import { CoordinatorHandler } from './handlers/CoordinatorHandler';
import { InboxHandler } from './handlers/InboxHandler';
import { RLSHandler } from './handlers/RLSHandler';
import { ManagedUserHandler } from './handlers/ManagedUserHandler';
import { SecurityHandler } from './handlers/SecurityHandler';
import { NotificationHandler } from './handlers/NotificationHandler';
import { ValueHelpHandler } from './handlers/ValueHelpHandler';

/**
 * RequestService - Entry point for End Users and Approvers.
 * 
 * This file should remain thin. All business logic is delegated to handlers.
 */
export default class RequestService extends cds.ApplicationService {

    async init() {
        // Register all handlers
        new ManagedUserHandler(this).register();  // UUID-based createdBy/modifiedBy
        new SecurityHandler(this).register();     // Field protection - strip forged fields
        new RLSHandler(this).register();          // RLS - security filter
        new RequestHandler(this).register();
        new ApprovalHandler(this).register();
        new StepHandler(this).register();
        new ValidationHandler(this).register();
        new AttachmentHandler(this).register();
        new AuditLogHandler(this).register();
        new CoordinatorHandler(this).register();
        new InboxHandler(this).register();
        NotificationHandler.register(this);
        new ValueHelpHandler(this).register();

        await super.init();
    }
}
