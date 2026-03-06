import { cds, SELECT } from '../../lib/db';

export class OrgHierarchyHandler {
    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.srv.before(['CREATE', 'UPDATE'], 'OrgHierarchies', this.validateHierarchy.bind(this));
    }

    private async validateHierarchy(req: cds.Request) {
        const data = req.data as any;

        // For updates, we might not get all fields if they are not changed.
        // If it's a partial update, we need to fetch the existing record first to get full context.
        let parentType = data.parentType;
        let childType = data.childType;

        if (!parentType || !childType) {
            return req.error(400, 'parentType and childType are required');
        }

        if (parentType !== 'USER' && parentType !== 'GROUP') {
            return req.error(400, 'parentType must be USER or GROUP');
        }

        if (childType !== 'USER' && childType !== 'GROUP') {
            return req.error(400, 'childType must be USER or GROUP');
        }

        let parentId = parentType === 'USER' ? data.parentUser_ID : data.parentGroup_ID;
        let childId = childType === 'USER' ? data.childUser_ID : data.childGroup_ID;

        if (req.event === 'UPDATE') {
            const { OrgHierarchies } = cds.entities;
            const existing = await SELECT.one.from(OrgHierarchies, data.ID);
            if (existing) {
                parentType = parentType || existing.parentType;
                childType = childType || existing.childType;
                parentId = parentId || (parentType === 'USER' ? existing.parentUser_ID : existing.parentGroup_ID);
                childId = childId || (childType === 'USER' ? existing.childUser_ID : existing.childGroup_ID);
            }
        }

        if (!parentId || !childId) {
            return req.error(400, 'parentType, childType, and respective ID fields are required');
        }

        if (parentType !== 'USER' && parentType !== 'GROUP') {
            return req.error(400, 'parentType must be USER or GROUP');
        }

        if (childType !== 'USER' && childType !== 'GROUP') {
            return req.error(400, 'childType must be USER or GROUP');
        }

        // 1. Self-reference check
        if (parentType === childType && parentId === childId) {
            return req.error(400, 'An entity cannot be its own parent (self-reference is not allowed)');
        }

        // 2. Immediate cycle check
        const { OrgHierarchies } = cds.entities;
        const immediateCycle = await SELECT.from(OrgHierarchies).where({
            parentType: childType,
            // the child of the new record becomes the parent
            [childType === 'USER' ? 'parentUser_ID' : 'parentGroup_ID']: childId,
            childType: parentType,
            // the parent of the new record becomes the child
            [parentType === 'USER' ? 'childUser_ID' : 'childGroup_ID']: parentId
        });

        if (immediateCycle.length > 0) {
            return req.error(400, 'Immediate circular reference detected');
        }

        // 3. Deep cycle check
        // Check if the new child is already an ancestor of the new parent.
        // We traverse up from the parentId to see if we ever hit the childId.
        const hasCycle = await this.checkDeepCycle(parentType, parentId, childType, childId);
        if (hasCycle) {
            return req.error(400, 'Circular reference detected in the organizational hierarchy');
        }
    }

    private async checkDeepCycle(
        currentParentType: string,
        currentParentId: string,
        targetChildType: string,
        targetChildId: string,
        visited = new Set<string>()
    ): Promise<boolean> {
        const { OrgHierarchies } = cds.entities;

        // Create a unique key for the current parent node to track visited nodes
        const nodeKey = `${currentParentType}:${currentParentId}`;

        if (visited.has(nodeKey)) {
            // We've hit a loop in the existing data
            return false;
        }
        visited.add(nodeKey);

        // Fetch all parents of the current parent node
        const condition: any = {
            childType: currentParentType,
            [currentParentType === 'USER' ? 'childUser_ID' : 'childGroup_ID']: currentParentId
        };

        const ancestors = await SELECT.from(OrgHierarchies).where(condition);

        for (const ancestor of ancestors) {
            const ancestorParentId = ancestor.parentType === 'USER' ? ancestor.parentUser_ID : ancestor.parentGroup_ID;

            // If an ancestor is exactly the node we are trying to add as a child, it's a cycle
            if (ancestor.parentType === targetChildType && ancestorParentId === targetChildId) {
                return true;
            }

            // Recurse up the tree
            const isCycleDeep = await this.checkDeepCycle(
                ancestor.parentType,
                ancestorParentId,
                targetChildType,
                targetChildId,
                visited
            );

            if (isCycleDeep) {
                return true;
            }
        }

        return false;
    }
}
