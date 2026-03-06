import type { NodeTypes } from '@xyflow/react';
import { UserNode } from './UserNode';
import { GroupNode } from './GroupNode';

export const hierarchyNodeTypes: NodeTypes = {
    userNode: UserNode,
    groupNode: GroupNode,
};
