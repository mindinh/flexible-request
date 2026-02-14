import { cds } from '../lib/db';

/**
 * Security Handler - Field Protection Layer
 * 
 * Prevents manipulation of system-managed fields via direct API calls.
 * Part of the defense-in-depth security model for ISO 27001 compliance.
 * 
 * Protection Strategy:
 * - Strip system-only fields on CREATE and UPDATE
 * - Block modification of immutable fields (ownerId, coordinatorId) on UPDATE
 */
export class SecurityHandler {

    private srv: cds.ApplicationService;
    private log = cds.log('security-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.log.info('Registering Security Handlers (Field Protection)...');

        // Request field protection
        this.srv.before(['CREATE', 'UPDATE'], 'Requests', this.sanitizeRequest.bind(this));

        // Step field protection
        this.srv.before(['CREATE', 'UPDATE'], 'Steps', this.sanitizeStep.bind(this));

        // StepApproval field protection
        this.srv.before(['CREATE', 'UPDATE'], 'StepApprovals', this.sanitizeApproval.bind(this));
    }

    /**
     * Sanitize Request fields
     * - delegatedFrom/At: System-managed (set by delegate() action only)
     * - coordinatorId/Type: User can set at CREATE, but not UPDATE (use delegate())
     */
    private sanitizeRequest(req: cds.Request) {
        if (!req.data) return;

        const items = Array.isArray(req.data) ? req.data : [req.data];

        for (const data of items) {
            // Always strip delegation fields (system-managed)
            if ('delegatedFrom' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'delegatedFrom' from ${req.event} Requests`);
                delete data.delegatedFrom;
            }
            if ('delegatedAt' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'delegatedAt' from ${req.event} Requests`);
                delete data.delegatedAt;
            }

            // Block coordinator modification on UPDATE (use delegate() action instead)
            if (req.event === 'UPDATE') {
                if ('coordinatorId' in data) {
                    this.log.warn(`[SECURITY] Stripping forged 'coordinatorId' from UPDATE Requests - use delegate() action`);
                    delete data.coordinatorId;
                }
                if ('coordinatorType' in data) {
                    this.log.warn(`[SECURITY] Stripping forged 'coordinatorType' from UPDATE Requests`);
                    delete data.coordinatorType;
                }
            }
        }
    }

    /**
     * Sanitize Step fields
     * - claimedBy/At: System-managed (set by claimStep() action only)
     * - ownerId/Type: User can set at CREATE, immutable on UPDATE
     */
    private sanitizeStep(req: cds.Request) {
        if (!req.data) return;

        const items = Array.isArray(req.data) ? req.data : [req.data];

        for (const data of items) {
            // Always strip claim fields (system-managed via claimStep action)
            if ('claimedBy_ID' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'claimedBy_ID' from ${req.event} Steps`);
                delete data.claimedBy_ID;
            }
            if ('claimedAt' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'claimedAt' from ${req.event} Steps`);
                delete data.claimedAt;
            }

            // Block owner modification on UPDATE (immutable after creation)
            if (req.event === 'UPDATE') {
                if ('ownerId' in data) {
                    this.log.warn(`[SECURITY] Stripping forged 'ownerId' from UPDATE Steps - immutable field`);
                    delete data.ownerId;
                }
                if ('ownerType' in data) {
                    this.log.warn(`[SECURITY] Stripping forged 'ownerType' from UPDATE Steps`);
                    delete data.ownerType;
                }
            }
        }
    }

    /**
     * Sanitize StepApproval fields
     * - approver/Type: System-managed (set by workflow engine)
     * - decidedBy_ID/decisionAt: System-managed (set by approve/reject actions)
     */
    private sanitizeApproval(req: cds.Request) {
        if (!req.data) return;

        const items = Array.isArray(req.data) ? req.data : [req.data];

        for (const data of items) {
            // Always strip approver fields (set by workflow engine only)
            if ('approver' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'approver' from ${req.event} StepApprovals`);
                delete data.approver;
            }
            if ('approverType' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'approverType' from ${req.event} StepApprovals`);
                delete data.approverType;
            }

            // Always strip decision fields (set by approve/reject actions only)
            if ('decidedBy_ID' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'decidedBy_ID' from ${req.event} StepApprovals`);
                delete data.decidedBy_ID;
            }
            if ('decisionAt' in data) {
                this.log.warn(`[SECURITY] Stripping forged 'decisionAt' from ${req.event} StepApprovals`);
                delete data.decisionAt;
            }

            // Also strip status (only changed via actions)
            if ('status' in data && req.event === 'UPDATE') {
                this.log.warn(`[SECURITY] Stripping forged 'status' from UPDATE StepApprovals`);
                delete data.status;
            }
        }
    }
}
