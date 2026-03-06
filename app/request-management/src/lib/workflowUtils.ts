/**
 * Sorts steps topologically based on their dependencies.
 * Start step comes first, then steps that depend on it.
 */
export function sortStepsTopologically(steps: any[]): any[] {
    if (!steps || steps.length <= 1) return steps;

    const sorted: any[] = [];
    const visited = new Set<string>();

    const traverse = (current: any) => {
        if (!current || visited.has(current.ID)) return;

        visited.add(current.ID);
        sorted.push(current);

        // Find steps that depend on the current step
        const dependents = steps.filter(s =>
            s.predecessors?.some((p: any) => p.dependsOn_ID === current.ID)
        );

        // Sort dependents for stability (e.g. by posY/posX)
        dependents.sort((a, b) => {
            if (a.posY !== b.posY) return (a.posY || 0) - (b.posY || 0);
            return (a.posX || 0) - (b.posX || 0);
        });

        for (const dep of dependents) {
            traverse(dep);
        }
    };

    // 1. Start with the "start" step(s)
    const startSteps = steps.filter(s => s.isStartStep);
    if (startSteps.length > 0) {
        startSteps.forEach(s => traverse(s));
    } else {
        // Fallback: start with the first step in the list if no isStartStep
        traverse(steps[0]);
    }

    // 2. Add any remaining steps (orphans or disconnected components)
    for (const s of steps) {
        if (!visited.has(s.ID)) {
            traverse(s);
        }
    }

    return sorted;
}
