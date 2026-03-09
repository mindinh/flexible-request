# Status Flow Reverse Flow Implementation Plan

- [x] Update `StatusFlowTransition` interface in `types.ts` to include `isReverse?: boolean`.
- [x] Modify `statusFlowGenerator.ts` to implement 3-phase Data Entry lifecycle: `Draft` -> `In Progress` -> `Exit`.
- [x] Implement back-edge detection in `statusFlowGenerator.ts` using topological sort processing order.
- [x] Connect reverse transitions to the correct target card (`In Progress` for Data Entry, `Pending` for Approval).
- [x] Update `StatusFlowTab.tsx` to visually distinguish reverse edges (red dashed + animated) and add arrow markers to ALL edges.
