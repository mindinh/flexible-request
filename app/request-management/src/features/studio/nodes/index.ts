import { StartNode } from './TriggerNode';
import { EndNode } from './EndNode';
import { ActionNode } from './ActionNode';
import { ConditionNode } from './LogicNode';

export { StartNode, EndNode, ActionNode, ConditionNode };

/**
 * React Flow nodeTypes registry – pass this to <ReactFlow nodeTypes={nodeTypes} />.
 */
export const nodeTypes = {
    startNode: StartNode,
    endNode: EndNode,
    actionNode: ActionNode,
    conditionNode: ConditionNode,
};
