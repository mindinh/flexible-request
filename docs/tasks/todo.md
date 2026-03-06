# Bug Fixes Round 2

## 1. Carol's notification missing
- [x] Investigate why Carol's notification is missing (found race condition & ignored `notificationsContent`)
- [x] Fix Database Race Condition by passing full approval data in `sap.cre.StepApprovalCreated`
- [x] Honor `notificationsContent` from `StepDefinition` to selectively send bell/email
- [x] Fix the true Database Race Condition (where the first User Task failed to send notifications) by delaying `.emit('sap.cre.StepApprovalCreated')` and `.emit('sap.cre.StepActivated')` until `req.on('succeeded')` in `WorkflowEngine.ts`.

## 2. Custom actions in footer 
- [ ] Replace old Approve/Reject/SendBack footer buttons with form's custom actions
- [ ] Keep only Cancel button alongside custom actions
- [ ] Remove duplicate custom action rendering from StepFormSection

## 3. Workflow End node auto-completion
- [x] End node should auto-complete, not require review process
- [x] Check workflow engine handling of `stepType: 'end'` 

## 4. Rejected decision styling
- [ ] If decisionAction is "reject", show different icon/color from approve
- [ ] Apply in WorkflowTimeline and approval status rendering

## 5. User Task / Annotations / Notifications
- [x] Explicitly map legacy username/email string to `ShadowUser.ID` (UUID) in `NotificationHandler.ts` (handleStepApprovalCreated and handleStepActivated).

## 6. End Node auto-completion & UI rendering
- [x] Fix `NODE_TO_STEP_TYPE` mapping in `useStudioStore.ts` so `endNode` evaluates to `stepType: 'end'`. (Was already correct)
- [x] Ensure `ReviewActionCard.tsx` / `useRequestDetailData.tsx` correctly handles end nodes without prompting for manual review.

## 7. Timeline navigation restriction
- [x] Remove `onStepClick` from `WorkflowTimeline.tsx` instances in `InboxTaskDetail.tsx` and `RequestDetail/index.tsx`.

## 8. Organization Management & Hierarchy (Backend)
- [ ] Add `OrgHierarchies` entity to `db/schema/identity.cds`
- [ ] Expose `OrgHierarchies` in `srv/admin-service.cds`
- [ ] Implement `OrgHierarchyHandler` with logic to prevent cycles/self-reference
- [ ] Register `OrgHierarchyHandler` in `srv/admin-service.ts`
- [ ] Create unit tests for OrgHierarchy rules in `tests/unit/`

## 9. Org Hierarchy Builder (Frontend)
- [x] Add "Hierarchy Builder" tab to `OrganizationPage.tsx`
- [x] Create Drag-and-Drop Hierarchy Palette with User/Group Search
- [x] Implement React Flow Canvas with Custom Nodes (`UserNode`, `GroupNode`)
- [x] Build Relationship Properties panel (Right Sidebar)
- [x] Integrate React Flow state management for creating hierarchy links
