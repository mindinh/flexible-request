# Unified Workflow - Implementation Plan

> **Detailed changes for development team handover**

---

## Overview

This document specifies all changes needed to implement the Unified Workflow Model.

| Layer | Files Affected | Change Type |
|-------|----------------|-------------|
| **Database** | 1 file | Schema changes (7 modifications) |
| **Services** | 3 files | Remove condition logic, add isFinal, remove masterData |
| **UI** | 10 files | Remove masterSchema/schemaMode/condition/masterData |

---

## 1. Database Schema Changes

### File: `db/schema.cds`

#### 1.1 Remove `masterSchema` from RequestTypes

```diff
entity RequestTypes : cuid, managed {
    title         : String @mandatory;
    description   : String;
    isEnabled     : Boolean default true;
    icon          : String default 'workflow';
-   masterSchema  : LargeString;  // REMOVE THIS LINE
    steps         : Composition of many StepDefinitions
                        on steps.requestType = $self;
    statusNetwork : Composition of many StatusNetwork
                        on statusNetwork.requestType = $self;
}
```

#### 1.2 Remove `schemaMode` from StepDefinitions

```diff
entity StepDefinitions : cuid, managed {
    requestType      : Association to RequestTypes;
    stepName         : String @mandatory;
    sequenceNum      : Integer;
    isStartStep      : Boolean default false;
    slaDays          : Integer default 3;
    schemaContent    : LargeString;  // KEEP - always CUSTOM now
-   schemaMode       : String enum {
-       INHERIT;
-       CUSTOM;
-   } default 'INHERIT';  // REMOVE THESE LINES
    syncTrigger      : String enum {
        NONE;
        IMMEDIATE;
        WITH_NEXT;
        ON_COMPLETE;
    } default 'NONE';
    predecessors     : Composition of many StepDependencies
                           on predecessors.step = $self;
    approverRules    : Composition of many ApproverRules
                           on approverRules.stepDefinition = $self;
}
```

#### 1.3 Remove `condition` from StepDependencies

```diff
entity StepDependencies : cuid {
    step        : Association to StepDefinitions;
    dependsOn   : Association to StepDefinitions;
-   condition   : LargeString;  // REMOVE - branching handled by ApproverRules.isFinal
}
```

**Rationale:** Step branching is no longer needed because:
- Classical workflow branching → handled by `ApproverRules.isFinal`
- Governance workflows → all steps sequential, no branching

#### 1.4 Add `isFinal` to ApproverRules

```diff
entity ApproverRules : cuid, managed {
    requestType   : Association to RequestTypes;
    stepDefinition: Association to StepDefinitions;
    priority      : Integer default 0;
    conditionExpr : LargeString;
    approverType  : String enum {
        USER;
        ROLE;
        GROUP;
    } default 'ROLE';
    approverValue : String;
+   isFinal       : Boolean default false;  // ADD THIS LINE
    description   : String;
}
```

### Migration Script

```sql
-- No data migration needed for schemaMode/masterSchema removal
-- For isFinal, default false is safe

-- Optional: Set isFinal=true for single-step request types
UPDATE ApproverRules 
SET isFinal = true 
WHERE stepDefinition_ID IN (
    SELECT ID FROM StepDefinitions 
    WHERE requestType_ID IN (
        SELECT requestType_ID FROM StepDefinitions 
        GROUP BY requestType_ID 
        HAVING COUNT(*) = 1
    )
);
```

#### 1.5 Add `WAITING` Status to StepApprovals

```diff
entity StepApprovals : cuid, managed {
    step        : Association to Steps;
    sequenceNum : Integer;
    approver    : String;
    status      : String enum {
        PENDING;
+       WAITING;    // ADD: Waiting for previous approver
        APPROVED;
        REJECTED;
    } default 'PENDING';
    comment     : String;
    decisionAt  : Timestamp;
}
```

**Rationale:** For classical workflow, multiple approvers are created at once. Only the first is `PENDING`, subsequent ones are `WAITING` until their turn.

#### 1.6 Remove `masterData` from Requests

> [!IMPORTANT]
> Since `masterSchema` was removed from `RequestTypes`, the corresponding `masterData` in `Requests` should also be removed. All data is now stored per-step in `RequestData`.

```diff
entity Requests : cuid, managed {
    title       : String;
    requestType : Association to RequestTypes;
    priority    : String enum { HIGH; MEDIUM; LOW; } default 'MEDIUM';
    status      : String enum { DRAFT; SUBMITTED; IN_PROGRESS; COMPLETED; REJECTED; WITHDRAWN; } default 'DRAFT';
    steps       : Composition of many Steps on steps.request = $self;
-   masterData  : Composition of one RequestMasterData on masterData.request = $self;  // REMOVE
    history     : Composition of many RequestHistory on history.request = $self;
}
```

#### 1.7 Remove `RequestMasterData` Entity

```diff
- /**
-  * Master data payload for Classical Workflows.
-  * One record per Request - shared by all steps with schemaMode = INHERIT.
-  */
- entity RequestMasterData : cuid, managed {
-     request : Association to Requests;
-     payload : LargeString;
- }
```

**Rationale:** 
- All form data now stored in `RequestData` linked to the step
- Classical workflow = 1 step, data goes to that step's `RequestData`
- Governance workflow = N steps, each step has its own `RequestData`

---

## 2. Service Layer Changes

### Files Affected

| File | Changes Required |
|------|------------------|
| `srv/lib/workflow.ts` | Remove condition evaluation for StepDependencies |
| `srv/lib/approver-resolver.ts` | Add `isFinal` support for multi-approver chains |
| `srv/lib/condition-evaluator.ts` | No changes (still used by ApproverRules) |
| `srv/request-service.cds` | Remove `RequestMasterData` projection |
| `srv/handlers/RequestHandler.ts` | Update data storage to use `RequestData` instead of `masterData` |

---

### 2.1 File: `srv/lib/workflow.ts`

**Major simplification** - remove all step-level condition logic

#### Lines to Remove (93-95, 112-134, 137-165)

```diff
// Line 93-95: Remove condition column from query
const predecessors = await SELECT.from(StepDependencies)
    .where({ step_ID: def.ID })
-   .columns('dependsOn_ID', 'condition');
+   .columns('dependsOn_ID');

// Lines 112-134: Remove condition evaluation block
- // Evaluate activation conditions for each predecessor path
- let shouldActivate = false;
- let conditionFailed = false;
-
- for (const pred of predecessors) {
-     // Only evaluate condition if predecessor was COMPLETED
-     if (completedDefIds.has(pred.dependsOn_ID)) {
-         if (conditionEvaluator.evaluate(pred.condition, requestData)) {
-             shouldActivate = true;
-             break;
-         } else {
-             conditionFailed = true;
-         }
-     }
- }
-
- if (shouldActivate) {
-     stepsToActivate.push(def);
- } else if (conditionFailed && !shouldActivate) {
-     stepsToSkip.push(def);
- }

+ // Simplified: All steps activate when predecessors complete
+ stepsToActivate.push(def);

// Lines 137-165: Remove entire SKIPPED step creation block
- // 6. Create SKIPPED steps (condition not met)
- for (const def of stepsToSkip) {
-     ... entire block ...
- }
```

#### Remove Unused Imports/Variables

```diff
// Line 3
- import { conditionEvaluator } from './condition-evaluator.ts';

// Line 68-73
- // Track steps that were skipped due to conditions
- const skippedDefIds = new Set(
-     existingSteps
-         .filter((s: any) => s.status === 'SKIPPED')
-         .map((s: any) => s.stepDefinition_ID)
- );

// Line 80
- const stepsToSkip: any[] = [];

// Lines 216-220
- // 8. If we skipped steps, continue advancing
- if (stepsToSkip.length > 0) {
-     await this.advance(requestId);
-     return;
- }
```

---

### 2.2 File: `srv/lib/approver-resolver.ts`

**Enhance for multi-approver chains with isFinal**

```diff
async resolveApprover(
    stepDefinitionId: string,
    requestTypeId: string,
    requestData: Record<string, any>
- ): Promise<{ approverType: string; approverValue: string } | null> {
+ ): Promise<Array<{ approverType: string; approverValue: string; isFinal: boolean }>> {
    const { ApproverRules } = this.db.entities;

    const rules = await SELECT.from(ApproverRules)
        .where({
            requestType_ID: requestTypeId,
            stepDefinition_ID: stepDefinitionId
        })
        .orderBy('priority desc');

-   // Return first matching rule
-   for (const rule of rules) {
-       if (conditionEvaluator.evaluate(rule.conditionExpr, requestData)) {
-           return {
-               approverType: rule.approverType || 'ROLE',
-               approverValue: rule.approverValue
-           };
-       }
-   }
-   return null;

+   // Return ALL matching approvers until isFinal is true
+   const approvers: Array<{ approverType: string; approverValue: string; isFinal: boolean }> = [];
+   
+   for (const rule of rules) {
+       if (conditionEvaluator.evaluate(rule.conditionExpr, requestData)) {
+           approvers.push({
+               approverType: rule.approverType || 'ROLE',
+               approverValue: rule.approverValue,
+               isFinal: rule.isFinal || false
+           });
+           
+           if (rule.isFinal) {
+               break; // Stop adding more approvers
+           }
+       }
+   }
+   
+   return approvers;
}
```

---

### 2.3 File: `srv/lib/workflow.ts` - Update StepApproval Creation

```diff
// Lines 196-213: Create multiple approvals
- const resolved = await this.approverResolver.resolveApprover(...);
- if (resolved) {
-     await INSERT.into(StepApprovals).entries({
-         step_ID: newStepId,
-         sequenceNum: 1,
-         approver: resolved.approverValue,
-         status: 'PENDING'
-     });
- }

+ const approvers = await this.approverResolver.resolveApprover(...);
+ for (let i = 0; i < approvers.length; i++) {
+     const approver = approvers[i];
+     await INSERT.into(StepApprovals).entries({
+         step_ID: newStepId,
+         sequenceNum: i + 1,
+         approver: approver.approverValue,
+         status: i === 0 ? 'PENDING' : 'WAITING'  // Only first is active
+     });
+ }
```

## Summary: Service Layer Changes

| File | Action | Lines Affected |
|------|--------|----------------|
| `workflow.ts` | Remove condition import | Line 3 |
| `workflow.ts` | Remove skippedDefIds tracking | Lines 68-73 |
| `workflow.ts` | Remove stepsToSkip variable | Line 80 |
| `workflow.ts` | Simplify predecessor query | Lines 93-95 |
| `workflow.ts` | Remove condition evaluation | Lines 112-134 |
| `workflow.ts` | Remove SKIPPED step creation | Lines 137-165 |
| `workflow.ts` | Remove recursive skip call | Lines 216-220 |
| `workflow.ts` | Update approval creation | Lines 196-213 |
| `approver-resolver.ts` | Return array with isFinal | Lines 29-59 |
| `schema.cds` | Add WAITING status | StepApprovals entity |

---

## 3. UI Changes

### Files Affected

| File | References Found | Action |
|------|------------------|--------|
| `studio/types.ts` | schemaMode, SchemaMode type | Remove type and property |
| `studio/useStudioStore.ts` | ~14 refs (masterSchema, MASTER_SCHEMA_KEY, schemaMode) | Major cleanup |
| `studio/SchemaTab.tsx` | ~15 refs (masterSchema, INHERIT, schemaMode) | Remove mode toggle UI |
| `studio/StudioAdapter.ts` | 2 refs (schemaMode, INHERIT) | Remove from API calls |
| `studio/LeftPanel.tsx` | 3 refs (MASTER_SCHEMA_KEY) | Remove "Request Data" item |
| `requests/DynamicRequestForm.tsx` | 4 refs (schemaMode, masterSchema, INHERIT) | Simplify schema resolution |
| `requests/RequestDetail.tsx` | 1 ref (masterSchema) | Simplify schema resolution |

---

### 3.1 File: `features/studio/types.ts`

**Lines to modify:**

```diff
// Line 106: Remove SchemaMode type
- export type SchemaMode = 'INHERIT' | 'CUSTOM';

// Line 113: Remove schemaMode property
export interface Step {
    // ...
-   schemaMode?: SchemaMode;  // REMOVE
    // ...
}

// Line 147: Add isFinal to ApproverRule (already exists but for status, need new one)
export interface ApproverRule {
    // ...
+   isFinal: boolean;  // ADD: Stop approval chain when this approver approves
    // ...
}
```

---

### 3.2 File: `features/studio/useStudioStore.ts`

**Major cleanup required - 14 references**

```diff
// Line 16: Remove constant
- export const MASTER_SCHEMA_KEY = '__MASTER__';

// Line 27: Remove from state interface
interface StudioState {
-   masterSchema: UiCanvasItem[];
    // ...
}

// Line 71: Remove from initial state
const initialState = {
-   masterSchema: [],
    // ...
}

// Lines 150-155: Remove masterSchema loading
- const masterSchema = fullDraft.masterSchema
-     ? StudioAdapter.toUiSchemaFromContent(fullDraft.masterSchema)
-     : [];
- if (masterSchema.length > 0) {
-     schemas[MASTER_SCHEMA_KEY] = masterSchema;
- }

// Lines 201-214: Remove masterSchema saving
- const { masterSchema } = get();
- const masterSchemaJson = masterSchema.length > 0
-     ? JSON.stringify(StudioAdapter.fromUiSchema(masterSchema))
-     : null;
// ...
-     masterSchema: masterSchemaJson

// Line 228: Remove schemaMode from step conversion
-     schemaMode: node.data.schemaMode || 'INHERIT',

// Line 288: Remove MASTER_SCHEMA_KEY skip logic
- if (stepId === MASTER_SCHEMA_KEY) continue;

// Lines 389-394: Remove setMasterSchema and isEditingMasterSchema
- setMasterSchema: (items) => set({
-     masterSchema: items,
-     schemas: { ...get().schemas, [MASTER_SCHEMA_KEY]: items },
- }),
- isEditingMasterSchema: () => get().activeStepId === MASTER_SCHEMA_KEY
```

---

### 3.3 File: `features/studio/SchemaTab.tsx`

**Major UI cleanup - 15 references**

```diff
// Line 2: Remove MASTER_SCHEMA_KEY import
- import { useStudioStore, MASTER_SCHEMA_KEY } from './useStudioStore';
+ import { useStudioStore } from './useStudioStore';

// Line 411: Remove masterSchema from store destructure
-     masterSchema,

// Lines 420-428: Remove schemaMode logic
- // Get the active step's schemaMode (INHERIT or CUSTOM)
- const stepSchemaMode = (activeStep?.data?.schemaMode as string) || 'INHERIT';
- const isEditingMaster = activeStepId === MASTER_SCHEMA_KEY;
- // If step uses INHERIT mode, show master schema in read-only
- const isInheritMode = !isEditingMaster && stepSchemaMode === 'INHERIT';

// Line 431: Simplify currentSchema
- const currentSchema = isEditingMaster || isInheritMode ? masterSchema : schema;
+ const currentSchema = schema;

// Lines 435-442: Remove handleSchemaModeChange
- const handleSchemaModeChange = (mode: 'INHERIT' | 'CUSTOM') => { ... }

// Line 581: Remove disabled state comment
- {/* Left Palette - Disabled in INHERIT mode */}

// Lines 625-632: Remove schemaMode dropdown
- { value: 'INHERIT', label: 'Inherit' },
- { value: 'CUSTOM', label: 'Custom' },
// ... entire dropdown component
```

---

### 3.4 File: `components/studio/LeftPanel.tsx`

**Remove "Request Data" tree item**

```diff
// Line 3: Remove MASTER_SCHEMA_KEY import
- import { MASTER_SCHEMA_KEY } from '../../features/studio/useStudioStore';

// Line 42: Remove master schema active check
- const isMasterSchemaActive = activeStepId === MASTER_SCHEMA_KEY;

// Lines 65-70: Remove "Request Data" tree item entirely
- <TreeItem 
-     label="Request Data"
-     icon={fileText}
-     isActive={isMasterSchemaActive}
-     onClick={() => onStepSelect(MASTER_SCHEMA_KEY)}
- />
```

---

### 3.5 File: `services/AdminService.ts`

**Remove `condition` parameter from StepDependency methods**

```diff
// Lines 102-107: Remove condition parameter from createStepDependency
- async createStepDependency(stepId: string, dependsOnId: string, condition?: any): Promise<any> {
-     const payload: any = { dependsOn_ID: dependsOnId };
-     if (condition && Array.isArray(condition) && condition.length > 0) {
-         payload.condition = JSON.stringify(condition);
-     }

+ async createStepDependency(stepId: string, dependsOnId: string): Promise<any> {
+     const payload = { dependsOn_ID: dependsOnId };

// Lines 117-119: Remove updateStepDependency method entirely (only used for conditions)
- async updateStepDependency(dependencyId: string, data: { condition?: string }): Promise<any> { ... }
```

---

### 3.6 File: `features/studio/StudioAdapter.ts`

**Remove condition handling from edge conversion**

```diff
// Line 104: Remove schemaMode from step conversion
-     schemaMode: (step as any).schemaMode || 'INHERIT',

// Lines 113-130: Remove condition parsing from predecessors
- // Parse condition from backend (stored as JSON string)
- let condition = [];
- if ((pred as any).condition) {
-     try {
-         const parsed = JSON.parse((pred as any).condition);
-         condition = Array.isArray(parsed) ? parsed : parsed.conditions || [];
-     } catch (e) {
-         console.warn('Failed to parse condition', e);
-     }
- }
// ...
-     condition

+ // Simplified: No condition on edges
```

---

### 3.7 File: `features/studio/useStudioStore.ts`

**Remove condition from edge handling**

```diff
// Line 269: Remove condition from createStepDependency call
- await AdminService.createStepDependency(edge.target, edge.source, edge.condition);
+ await AdminService.createStepDependency(edge.target, edge.source);

// Lines 272-277: Remove edge update logic (only used for conditions)
- // Find edges to UPDATE (exist in both, but may have condition changes)
- // ...
- console.log("Updating dependencies with conditions...", edgesToUpdate.length);
```

---

### 3.8 File: `types/AdminEntities.ts`

**Remove condition from AdminStepDependency interface**

```diff
// Around line 30-35
export interface AdminStepDependency {
    ID: string;
    step_ID: string;
    dependsOn_ID?: string;
-   condition?: string;  // REMOVE
}
```

---

### 3.9 File: `features/requests/DynamicRequestForm.tsx`

**Lines 213-218: Simplify schema resolution**

```diff
- // 1. If step has schemaMode=CUSTOM and schemaContent, use that
- // 2. Otherwise, use RequestType.masterSchema (Classical Workflow pattern)
- const stepSchemaMode = startStep?.schemaMode || 'INHERIT';
- const schemaSource = stepSchemaMode === 'CUSTOM' && startStep?.schemaContent
-     ? startStep.schemaContent
-     : requestType?.masterSchema;

+ // Always use step's schemaContent
+ const schemaSource = startStep?.schemaContent;
```

---

### 3.7 File: `features/requests/RequestDetail.tsx`

```diff
// Line 36: Remove masterSchema from interface
interface RequestType {
-   masterSchema?: string;
    // ...
}

// Update schema resolution (if present)
- const schema = request.requestType?.masterSchema;
+ const schema = step.stepDefinition?.schemaContent;
```

---

## Summary: UI Changes

| File | Action | Lines Affected |
|------|--------|----------------|
| `studio/types.ts` | Remove SchemaMode type | Line 106 |
| `studio/types.ts` | Remove schemaMode property | Line 113 |
| `studio/types.ts` | Add isFinal to ApproverRule | Line 147 |
| `studio/useStudioStore.ts` | Remove MASTER_SCHEMA_KEY | Line 16 |
| `studio/useStudioStore.ts` | Remove masterSchema state | Lines 27, 71 |
| `studio/useStudioStore.ts` | Remove masterSchema loading | Lines 150-155 |
| `studio/useStudioStore.ts` | Remove masterSchema saving | Lines 201-214 |
| `studio/useStudioStore.ts` | Remove schemaMode from steps | Line 228 |
| `studio/useStudioStore.ts` | Remove condition from edge calls | Line 269 |
| `studio/useStudioStore.ts` | Remove edge update for conditions | Lines 272-277 |
| `studio/useStudioStore.ts` | Remove MASTER_SCHEMA_KEY skip | Line 288 |
| `studio/useStudioStore.ts` | Remove setMasterSchema | Lines 389-394 |
| `studio/SchemaTab.tsx` | Remove MASTER_SCHEMA_KEY import | Line 2 |
| `studio/SchemaTab.tsx` | Remove mode toggle logic | Lines 420-442 |
| `studio/SchemaTab.tsx` | Simplify currentSchema | Line 431 |
| `studio/SchemaTab.tsx` | Remove schemaMode dropdown | Lines 625-632 |
| `studio/LeftPanel.tsx` | Remove "Request Data" item | Lines 42, 65-70 |
| `studio/StudioAdapter.ts` | Remove schemaMode from API | Line 104 |
| `studio/StudioAdapter.ts` | Remove condition parsing | Lines 113-130 |
| `services/AdminService.ts` | Remove condition param | Lines 102-107 |
| `services/AdminService.ts` | Remove updateStepDependency | Lines 117-119 |
| `types/AdminEntities.ts` | Remove condition property | Line ~33 |
| `requests/DynamicRequestForm.tsx` | Simplify schema resolution | Lines 213-218 |
| `requests/RequestDetail.tsx` | Remove masterSchema | Line 36 |

---

## 4. Testing Checklist

### 4.1 Schema Migration
- [ ] CDS compiles without errors after schema changes
- [ ] Existing data not corrupted (schemaContent preserved)
- [ ] New `isFinal` field defaults to false
- [ ] New `WAITING` status available for StepApprovals

### 4.2 Service Layer
- [ ] Steps activate without condition evaluation
- [ ] No SKIPPED steps created (feature removed)
- [ ] Multiple approvers created when rules match
- [ ] Approver chain stops when `isFinal = true`
- [ ] First approver is PENDING, rest are WAITING

### 4.3 Studio UI
- [ ] "Request Data" item removed from tree
- [ ] No schemaMode dropdown visible
- [ ] Each step's schema is editable
- [ ] Save works without masterSchema/schemaMode
- [ ] Step dependencies work without condition field

### 4.4 Runtime Form
- [ ] DynamicRequestForm loads schema from step
- [ ] Form renders correctly
- [ ] Submit/Save works

### 4.5 Workflow Engine
- [ ] Single-step workflows work (classical pattern)
- [ ] Multi-step workflows work (governance pattern)
- [ ] Multiple approvers in sequence work correctly

---

## 5. Summary Table

| Change | File | Action |
|--------|------|--------|
| Remove `masterSchema` | `db/schema.cds` | Delete from RequestTypes |
| Remove `schemaMode` | `db/schema.cds` | Delete from StepDefinitions |
| Remove `condition` | `db/schema.cds` | Delete from StepDependencies |
| Add `isFinal` | `db/schema.cds` | Add to ApproverRules |
| Add `WAITING` status | `db/schema.cds` | Add to StepApprovals |
| Remove condition logic | `srv/lib/workflow.ts` | Simplify step activation |
| Add multi-approver | `srv/lib/approver-resolver.ts` | Return array with isFinal |
| Remove `masterData` | `db/schema.cds` | Delete from Requests |
| Remove entity | `db/schema.cds` | Delete RequestMasterData |
| Remove projection | `srv/request-service.cds` | Remove RequestMasterData |
| Update handler | `srv/handlers/RequestHandler.ts` | Use RequestData instead of masterData |
| Remove types | `studio/types.ts` | Remove SchemaMode, add isFinal |
| Simplify store | `studio/useStudioStore.ts` | Remove masterSchema, MASTER_SCHEMA_KEY |
| Simplify SchemaTab | `studio/SchemaTab.tsx` | Remove INHERIT mode UI |
| Remove tree item | `components/studio/LeftPanel.tsx` | Remove "Request Data" |
| Remove schemaMode | `studio/StudioAdapter.ts` | Remove from API, remove condition |
| Remove condition | `services/AdminService.ts` | Remove from createStepDependency |
| Remove interface | `types/AdminEntities.ts` | Remove condition property |
| Simplify form | `requests/DynamicRequestForm.tsx` | Use RequestData instead of masterData |
| Simplify detail | `requests/RequestDetail.tsx` | Use RequestData instead of masterData |

---

**Estimated Effort:** 2-3 days for a developer familiar with the codebase

**Risk Level:** Medium (affects core schema resolution logic)

**Recommendation:** Implement in feature branch, test thoroughly before merge

---

**Created:** 2026-01-09  
**Author:** Solution Architect
