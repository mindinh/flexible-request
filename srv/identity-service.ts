import { cds, SELECT } from './lib/db';
import { IdentityProvisioner } from './lib/identity-provisioner';

/**
 * IdentityService - Handles identity resolution and user lookups.
 * 
 * Service Path: /identity
 * 
 * Provides:
 * - me() - Get current user's ShadowUser record
 * - resolveGroupMembers() - Get all users in a group
 * - getUserGroups() - Get all groups a user belongs to
 */
export default class IdentityService extends cds.ApplicationService {

    async init() {
        const { ShadowUsers, ShadowGroups, GroupMembers } = this.entities;

        /**
         * Get current authenticated user's ShadowUser record.
         * Triggers JIT provisioning if user doesn't exist.
         * Returns ShadowUser record + isAdmin flag + group memberships.
         */
        this.on('me', async (req) => {
            const LOG = cds.log('identity');

            if (!req.user?.id) {
                req.error(401, 'Not authenticated');
                return;
            }

            // Debug: Log origin for troubleshooting (only at debug level)
            const origin = IdentityProvisioner.getOrigin(req.user);
            LOG.debug(`Resolving user: ${origin}:${req.user.id}`);

            // Ensure user is provisioned
            await IdentityProvisioner.provisionUser(req.user);

            const shadowUser = await SELECT.one.from(ShadowUsers)
                .where({ origin, userId: req.user.id });

            if (!shadowUser) {
                req.error(404, 'User not found after provisioning');
                return;
            }

            // Fetch user's group memberships for frontend authorization checks
            const memberships = await SELECT.from(GroupMembers)
                .columns('group_ID')
                .where({ user_ID: shadowUser.ID });

            const groupIds = memberships.map((m: { group_ID: string }) => m.group_ID);
            LOG.debug(`User ${shadowUser.ID} belongs to ${groupIds.length} groups: ${groupIds.join(', ')}`);

            // Add admin status based on XSUAA scope + group memberships
            return {
                ...shadowUser,
                isAdmin: req.user.is('admin'),  // Check if user has admin scope
                groupIds  // Array of group IDs the user belongs to
            };
        });

        /**
         * Resolve all users who are members of a group.
         * Used by ApproverResolver to expand group assignments.
         */
        this.on('resolveGroupMembers', async (req) => {
            const { groupId } = req.data;

            if (!groupId) {
                req.error(400, 'groupId is required');
                return;
            }

            const members = await SELECT.from(GroupMembers)
                .columns('user_ID')
                .where({ group_ID: groupId });

            const userIds = members.map((m: { user_ID: string }) => m.user_ID);

            if (userIds.length === 0) {
                return [];
            }

            const users = await SELECT.from(ShadowUsers)
                .where({ ID: { in: userIds }, isActive: true });

            return users;
        });

        /**
         * Get all groups that a user belongs to.
         * Used for inbox filtering and RLS.
         */
        this.on('getUserGroups', async (req) => {
            const { userId } = req.data;

            if (!userId) {
                req.error(400, 'userId is required');
                return;
            }

            const memberships = await SELECT.from(GroupMembers)
                .columns('group_ID')
                .where({ user_ID: userId });

            const groupIds = memberships.map((m: { group_ID: string }) => m.group_ID);

            if (groupIds.length === 0) {
                return [];
            }

            const groups = await SELECT.from(ShadowGroups)
                .where({ ID: { in: groupIds }, isActive: true });

            return groups;
        });

        await super.init();
    }
}
