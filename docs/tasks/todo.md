# Fix Workflow Panel UUID Display During Data Entry

## Problem Statement

When a user enters data into a form for a step before submitting it, the frontend rules engine evaluate the conditions and resolves UUIDs for the approvers. However, the workflow preview panel displays the raw UUIDs instead of display names.

**Root Cause:**
* The backend does not generate actual `StepApprovals` (or provide the display names for dynamic principal values) until the step transitions from `STARTED` (data entry phase) to `IN_PROGRESS` (submit phase).
* The frontend tries to resolve the dynamically evaluated UUIDs against a local `knownUsers` map (in `useRequestDetailData.tsx`), but because the backend never sent the display names for these UUIDs, it falls back to rendering the raw UUID.

## Proposed Architectural Solutions

### 1. Hybrid Client-Side Resolution (Recommended)
**Concept:** The frontend continues to evaluate workflow rules locally (via `useApproverResolver.ts`). However, when `useRequestDetailData.tsx` generates `resolvedApprovers` containing UUIDs not found in `knownUsers`, it dispatches an asynchronous API call to fetch their display names and caches them in the `knownUsers` map.

* **Pros:**
  * Keeps the lightweight, local, and extremely responsive rule evaluation intact on the frontend.
  * Very easy to implement. We simply add a `useQuery` or `useEffect` in `useRequestDetailData.tsx` that triggers a `GET /browse/ShadowUsers?$filter=ID in (...)` when unknown UUIDs are detected.
  * Minimal backend changes (if `/browse/ShadowUsers` or similar endpoint is already available; we can use a custom function if needed to cover both Users and Groups).
* **Cons:**
  * Requires a short network round-trip to resolve names right after the user modifies the form data that satisfies a rule.

### 2. Server-Side Workflow Simulation API (The "Single Source of Truth")
**Concept:** Shift all rule evaluation for previews to the backend. Create a custom backend bound action `simulateApprovals(stepId: UUID, data: String)` on the `Step` or `Request` entity. The frontend calls this action (debounced) whenever form data changes. The backend runs its existing `WorkflowEngine` and `ApproverResolver`, definitively resolves the rules and names, and returns a transient array of `ResolvedApprover` objects.

* **Pros:**
  * Guarantees 100% parity between what the user sees in the preview and what will actually be created on Submit, because both use the exact same backend engine.
  * Handles deep security logic, complex organizational structures, and external IDP integrations out-of-the-box.
* **Cons:**
  * Increased network chatter (every relevant form change triggers a backend evaluation).
  * Frontend needs slightly more state management to handle the "loading" state of the workflow preview panel.

### 3. Eager Draft StepApproval Creation (Using CAP Draft)
**Concept:** When the step is in Draft mode (which is how `STARTED` steps are typically edited), a backend `before('SAVE', 'RequestData')` handler orchestrates the `WorkflowEngine` to eagerly evaluate rules and generate genuine draft `StepApproval` records directly in the backend.

* **Pros:**
  * Fully aligns with standard SAP CAP Draft Choreography—no custom endpoints necessary; standard Fiori expansion works automatically.
* **Cons:**
  * High complexity. Orchestrating dynamic child creation inside standard Fiori Draft handlers can cause locking conflicts or ghost data if the draft is discarded. High backend write-overhead.

### 4. Enrich Form Schema to Capture Names Locally
**Concept:** If the UUIDs are populated from dynamic form fields (e.g., User selects an approver from a ComboBox), adjust the User Picker components/schemas so they write *both* the ID and the display name into the form payload (e.g., `{ approver_id: '123-abc', approver_name: 'John Doe' }`).

* **Pros:**
  * Zero API calls needed. Instant, synchronous rendering.
* **Cons:**
  * Only works if the UUIDs strictly originated from user inputs on the form. Doesn't solve the problem if rules dynamically compute UUIDs using other criteria (e.g. system variable).

---

## Action Required
Please review the proposed solutions above. 

I recommend **Solution 1** for the best UX/performance balance, or **Solution 2** if we want to ensure the backend always maintains absolute authority over workflow evaluation.

**Next Steps once approved:**
- [ ] Refactor the frontend `useRequestDetailData.tsx` (or backend depending on choice).
- [ ] Validate that UUIDs are properly replaced by actual names during data entry.
- [ ] Remove hardcoded IDs or raw UUID logic from preview map.
