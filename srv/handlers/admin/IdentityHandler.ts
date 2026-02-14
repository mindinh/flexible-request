import { cds, SELECT, DELETE } from '../../lib/db';

/**
 * Handles Identity-related operations in AdminService:
 * - ShadowGroups: Validation before create/delete
 * - SupportTypes: Prevent deletion if in use
 * - GroupMembers: Cascading deletes
 */
export class IdentityHandler {

    private srv: cds.ApplicationService;
    private log = cds.log('identity-handler');

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all identity-related handlers
     */
    register() {
        // ShadowGroups handlers
        this.srv.before('CREATE', 'ShadowGroups', this.beforeCreateGroup.bind(this));
        this.srv.before('DELETE', 'ShadowGroups', this.beforeDeleteGroup.bind(this));

        // SupportTypes handlers
        this.srv.before('DELETE', 'SupportTypes', this.beforeDeleteSupportType.bind(this));
        this.srv.before('UPDATE', 'SupportTypes', this.beforeUpdateSupportType.bind(this));
    }

    /**
     * Before Create Group: Validate type association exists and is enabled
     */
    private async beforeCreateGroup(req: cds.Request) {
        const data = req.data as { type_ID?: string; name?: string };

        if (!data.type_ID) {
            return req.error(400, 'Group type is required');
        }

        if (!data.name) {
            return req.error(400, 'Group name is required');
        }

        const { SupportTypes } = cds.entities;
        const type = await SELECT.one.from(SupportTypes, data.type_ID)
            .columns('ID', 'isEnabled', 'code');

        if (!type) {
            return req.error(404, 'Group type not found');
        }

        if (!type.isEnabled) {
            return req.error(400, `Cannot create group: type "${type.code}" is disabled`);
        }
    }

    /**
     * Before Delete Group: Block if group is used in ApproverRules
     */
    private async beforeDeleteGroup(req: cds.Request) {
        const param = req.params[0] as { ID: string };
        const groupId = param.ID;

        const { ApproverRules } = cds.entities;

        // Check if group is referenced in ApproverRules (new principal model)
        const rulesUsingGroup = await SELECT.from(ApproverRules)
            .where({ principalId: groupId })
            .columns('ID');

        if (rulesUsingGroup.length > 0) {
            return req.error(409,
                `Cannot delete: ${rulesUsingGroup.length} approval rule(s) reference this group`);
        }

        // Cascade delete: Remove GroupMembers
        const { GroupMembers } = cds.entities;
        await cds.run(DELETE.from(GroupMembers).where({ group_ID: groupId }));

        this.log.info(`Cascade deleted GroupMembers for group: ${groupId}`);
    }

    /**
     * Before Delete SupportType: Block if used by groups or rules
     */
    private async beforeDeleteSupportType(req: cds.Request) {
        const param = req.params[0] as { ID: string };
        const typeId = param.ID;

        const { ShadowGroups, ApproverRules } = cds.entities;

        // Check groups using this type
        const groupsUsingType = await SELECT.from(ShadowGroups)
            .where({ type_ID: typeId })
            .columns('ID');

        if (groupsUsingType.length > 0) {
            return req.error(409,
                `Cannot delete: ${groupsUsingType.length} group(s) use this type`);
        }

        // Check ApproverRules using this type
        const type = await SELECT.one.from(cds.entities.SupportTypes, typeId)
            .columns('code');

        if (type?.code) {
            const rulesUsingType = await SELECT.from(ApproverRules)
                .where({ principalType: type.code })
                .columns('ID');

            if (rulesUsingType.length > 0) {
                return req.error(409,
                    `Cannot delete: ${rulesUsingType.length} approval rule(s) use this type`);
            }
        }
    }

    /**
     * Before Update SupportType: Validate disabling doesn't break active rules
     */
    private async beforeUpdateSupportType(req: cds.Request) {
        const data = req.data as { isEnabled?: boolean };
        const param = req.params[0] as { ID: string };

        // Only check when disabling
        if (data.isEnabled === false) {
            const { SupportTypes, ApproverRules } = cds.entities;

            const type = await SELECT.one.from(SupportTypes, param.ID)
                .columns('code');

            if (type?.code) {
                const activeRules = await SELECT.from(ApproverRules)
                    .where({ principalType: type.code })
                    .columns('ID');

                if (activeRules.length > 0) {
                    return req.error(409,
                        `Cannot disable: ${activeRules.length} approval rule(s) use type "${type.code}"`);
                }
            }
        }
    }
}
