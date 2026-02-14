import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PrincipalSelect, type Principal } from './PrincipalSelect';

/**
 * PrincipalSelect is a reusable dropdown component for selecting users or groups.
 * 
 * ## Features
 * - **Type Tabs**: Switch between USER, GROUP, TEAM, DEPARTMENT, ROLE types
 * - **Debounced Search**: Efficient API calls with 300ms debounce
 * - **Avatar/Icon Display**: Visual distinction between users and groups
 * - **Configurable Types**: Limit which principal types are available
 * 
 * ## Usage
 * ```tsx
 * const [principal, setPrincipal] = useState<Principal | null>(null);
 * 
 * <PrincipalSelect
 *   value={principal}
 *   onChange={setPrincipal}
 *   placeholder="Select approver..."
 * />
 * ```
 */
const meta: Meta<typeof PrincipalSelect> = {
    title: 'Components/Shared/PrincipalSelect',
    component: PrincipalSelect,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'A dropdown component for selecting users, groups, teams, departments, or roles from the Shadow Directory.',
            },
        },
    },
    argTypes: {
        value: {
            description: 'The currently selected principal',
            control: 'object',
        },
        onChange: {
            description: 'Callback when selection changes',
            action: 'changed',
        },
        placeholder: {
            description: 'Placeholder text when no principal is selected',
            control: 'text',
        },
        disabled: {
            description: 'Whether the select is disabled',
            control: 'boolean',
        },
        allowedTypes: {
            description: 'Array of allowed principal types (e.g., ["USER", "GROUP"])',
            control: 'object',
        },
        excludeIds: {
            description: 'Array of principal IDs to exclude from results',
            control: 'object',
        },
    },
    decorators: [
        (Story) => (
            <div style={{ width: '320px', padding: '20px' }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof PrincipalSelect>;

/**
 * Default state with no selection.
 */
export const Default: Story = {
    args: {
        placeholder: 'Select a principal...',
    },
};

/**
 * With a pre-selected user.
 */
export const WithUserSelected: Story = {
    args: {
        value: {
            id: 'user-1',
            type: 'USER',
            displayName: 'Alice Johnson',
            email: 'alice.johnson@company.com',
        },
    },
};

/**
 * With a pre-selected group.
 */
export const WithGroupSelected: Story = {
    args: {
        value: {
            id: 'group-1',
            type: 'GROUP',
            displayName: 'Finance Approvers',
            description: 'Finance department approval group',
        },
    },
};

/**
 * With a pre-selected team.
 */
export const WithTeamSelected: Story = {
    args: {
        value: {
            id: 'team-1',
            type: 'TEAM',
            displayName: 'HR Team',
            description: 'Human Resources team',
        },
    },
};

/**
 * Disabled state - cannot be interacted with.
 */
export const Disabled: Story = {
    args: {
        placeholder: 'Cannot select...',
        disabled: true,
    },
};

/**
 * Only showing USER type (no tabs).
 */
export const UsersOnly: Story = {
    args: {
        placeholder: 'Select a user...',
        allowedTypes: ['USER'],
    },
};

/**
 * Only showing GROUP and TEAM types.
 */
export const GroupsAndTeamsOnly: Story = {
    args: {
        placeholder: 'Select a group or team...',
        allowedTypes: ['GROUP', 'TEAM'],
    },
};

/**
 * Interactive example with state management.
 */
export const Interactive: Story = {
    render: () => {
        const [principal, setPrincipal] = useState<Principal | null>(null);

        return (
            <div className="space-y-4">
                <PrincipalSelect
                    value={principal}
                    onChange={setPrincipal}
                    placeholder="Select an approver..."
                />

                {principal && (
                    <div className="mt-4 p-3 bg-slate-100 rounded-lg text-sm">
                        <strong>Selected:</strong>
                        <pre className="mt-2 text-xs overflow-auto">
                            {JSON.stringify(principal, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        );
    },
};

/**
 * Custom placeholder text.
 */
export const CustomPlaceholder: Story = {
    args: {
        placeholder: 'Who should approve this request?',
    },
};

/**
 * For approval workflow - common use case.
 */
export const ApprovalWorkflow: Story = {
    render: () => {
        const [approver, setApprover] = useState<Principal | null>(null);

        return (
            <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                    Assign Approver
                </label>
                <PrincipalSelect
                    value={approver}
                    onChange={setApprover}
                    placeholder="Select who should approve..."
                />
                <p className="text-xs text-slate-500">
                    Choose a user or group to handle approvals for this rule.
                </p>
            </div>
        );
    },
};
