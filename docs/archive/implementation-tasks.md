# Workflow Enhancement - Implementation Tasks

> **Status:** In Progress  
> **Created:** 2026-01-08  
> **Concepts:** [workflow-enhancement-concepts.md](workflow-enhancement-concepts.md)

---

## Overview

| Phase | Owner | Status |
|-------|-------|--------|
| Phase 1: Schema Changes | CAP Architect | ✅ Complete |
| Phase 2: Backend Logic | CAP Architect | ✅ Complete |
| Phase 3: Form Schema UI | Frontend Lead | 🔄 In Progress |
| Phase 4: Workflow Tab UI | Frontend Lead | ⏳ Pending |
| Phase 5: Verification | QA | ⏳ Pending |

---

## Phase 1: Schema Changes (CAP Architect) ✅

### Tasks

- [x] **1.1** Add `masterSchema : LargeString` to `RequestTypes`
- [x] **1.2** Add `schemaMode : String enum { INHERIT; CUSTOM }` to `StepDefinitions`
- [x] **1.3** Add `syncTrigger : String enum { NONE; IMMEDIATE; WITH_NEXT; ON_COMPLETE }` to `StepDefinitions`
- [x] **1.4** Add `condition : LargeString` to `StepDependencies`
- [x] **1.5** Create new entity `RequestMasterData` with `request` and `payload` fields
- [x] **1.6** Run database migration: `cds deploy --to sqlite`
- [x] **1.7** Restart backend server and verify no errors

### Files Modified

- [db/schema.cds](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/db/schema.cds)

---

## Phase 2: Backend Logic (CAP Architect) ✅

### Tasks

- [x] **2.1** Create shared `ConditionEvaluator` utility
- [x] **2.2** Update `WorkflowEngine.advance()` to evaluate `StepDependencies.condition`
- [x] **2.3** Update step creation to check conditions before creating
- [x] **2.4** Handle workflow completion when no valid paths remain (SKIPPED steps)
- [x] **2.5** Update data reading to use `RequestMasterData` when available
- [x] **2.6** Refactor `ApproverResolver` to use shared `ConditionEvaluator`
- [x] **2.7** Expose `RequestMasterData` via `RequestService`

### Files Modified

- [srv/lib/condition-evaluator.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/srv/lib/condition-evaluator.ts) (NEW)
- [srv/lib/workflow.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/srv/lib/workflow.ts)
- [srv/lib/approver-resolver.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/srv/lib/approver-resolver.ts)
- [srv/request-service.cds](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/srv/request-service.cds)

---

## Phase 3: Form Schema Tab UI (Frontend Lead) ✅

### Tasks

- [x] **3.1** Add "Request Data" item to step list (above all steps)
- [x] **3.2** Add `masterSchema` state to `useStudioStore` with load/save
- [x] **3.3** Update `SchemaTab` to support master schema editing
- [x] **3.4** Add `schemaMode` toggle to step canvas header (INHERIT/CUSTOM)
- [x] **3.5** Implement INHERIT mode (read-only view of masterSchema)
- [x] **3.6** Implement CUSTOM mode (existing form builder behavior)

### Files Modified

- [types.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/types.ts) - Added SchemaMode, SyncTrigger types
- [useStudioStore.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/useStudioStore.ts) - Added masterSchema state and actions
- [LeftPanel.tsx](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/components/studio/LeftPanel.tsx) - Added Request Data item
- [SchemaTab.tsx](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/SchemaTab.tsx) - Added master schema editing and INHERIT read-only mode
- [StudioAdapter.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/StudioAdapter.ts) - Added schemaMode/syncTrigger mapping

### UI Mockups

- [mockup-request-data.png](mockup-request-data.png)
- [mockup-inherit-mode.png](mockup-inherit-mode.png)
- [mockup-custom-mode.png](mockup-custom-mode.png)

---

## Phase 4: Workflow Tab UI (Frontend Lead) ✅

### Tasks

- [x] **4.1** Add "Sync Trigger" dropdown to Step Details panel
- [x] **4.2** Add "Schema Mode" toggle to Step Details panel
- [x] **4.3** Create "Activation Conditions" section with condition builder
- [x] **4.4** Condition builder: Field dropdown, Operator dropdown, Value input
- [x] **4.5** Update API calls to save/load conditions from `StepDependencies`

### Files Modified

- [RightPanel.tsx](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/components/studio/RightPanel.tsx) - Added schemaMode toggle, syncTrigger dropdown, activation conditions builder
- [types.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/types.ts) - Added ConditionItem type
- [StudioAdapter.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/StudioAdapter.ts) - Added condition loading from edges
- [useStudioStore.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/features/studio/useStudioStore.ts) - Added condition save logic
- [AdminService.ts](file:///c:/Users/HieuNgoXuan/Documents/Antigravity/flexible-request-management/app/request-management/src/services/AdminService.ts) - Added updateStepDependency method

### UI Mockups

- [mockup-step-details.png](mockup-step-details.png)

---

## Phase 5: Verification ✅

### Automated Test Results

| Test Case | Result |
|-----------|--------|
| Studio loads successfully | ✅ Pass |
| Request Data item visible | ✅ Pass |
| Master Schema editor | ✅ Pass |
| Schema Mode toggle | ✅ Pass |
| Sync Trigger dropdown | ✅ Pass |
| INHERIT read-only mode | ✅ Pass |
| Activation Conditions builder | ✅ Pass |

### Manual Test Cases (Recommended)

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Classical Workflow: PR with 150M VND | Stops at FC (step 2) |
| 2 | Classical Workflow: PR with 500M VND | Goes to EVP (step 3), stops |
| 3 | Governance Workflow: New Plant | All 4 steps execute with different forms |

---

## Notes

- Basic Auth added to AdminService for development testing (alice/alice)
- Backend and frontend can be developed in parallel after Phase 1 is complete
- Restart servers after any changes to `srv/` or `db/`

---

**Completed:** 2026-01-08
