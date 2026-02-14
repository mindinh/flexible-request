# Workflow Architecture Reference

> **Core Philosophy:** Request = Container | Step = Execution Unit

This document is the single source of truth for understanding the workflow system's statuses, actions, and handler responsibilities.

---

## 1. Architecture Overview

```mermaid
flowchart TB
 subgraph subGraph0["Request Level (Container)"]
        R["Request"]
        RH["RequestHistory<br>(CREATE, SUBMIT, WITHDRAW)"]
  end
 subgraph subGraph1["Step Level (Execution)"]
        S1["Step 1"]
        S2["Step 2"]
        SH["StepHistory<br>(APPROVE, REJECT, etc.)"]
  end
 subgraph subGraph2["Approval Level"]
        A1["Approver 1"]
        A2["Approver 2"]
  end
    R --> S1 & S2
    S1 --> A1 & A2
```

**Key Principles:**
- **Request Status** is derived from the aggregated status of its Steps
- **Actions** (Approve, Reject, Send Back) happen at the **Step** level
- The Request does not "self-approve"—its fate is determined by its Steps

---

## 2. Handler Responsibilities

| Handler | Scope | Actions |
|---------|-------|---------|
| **RequestHandler** | Request lifecycle | `CREATE`, `SUBMIT`, `WITHDRAW` |
| **StepHandler** | Step lifecycle | `submitStep`, `respondToClarification` |
| **ApprovalHandler** | Approver decisions | `APPROVE`, `REJECT`, `SEND_BACK` |
| **WorkflowEngine** | Orchestration | `advance()`, `createApprovals()` |
| **AuditLogHandler** | Read operations | `getAuditLog()` |

---

## 3. Request Statuses

| Status | Meaning | Derived From |
|--------|---------|--------------|
| `DRAFT` | Requester is filling in data. Not yet submitted. | Initial state |
| `SUBMITTED` | Requester clicked "Submit". Workflow is now active. | User action |
| `IN_PROGRESS` | At least one step is actively being worked on. | Any Step is `IN_PROGRESS` or `STARTED` |
| `COMPLETED` | All Steps are `COMPLETED` or `SKIPPED`. | All Steps terminal |
| `REJECTED` | Any single Step is `REJECTED`. | Any Step is `REJECTED` |
| `WITHDRAWN` | Requester cancelled the request. | User action |

```mermaid
stateDiagram-v2
  direction LR
  [*] --> DRAFT:Requester(CREATE)
  DRAFT --> SUBMITTED:Requester(SUBMIT)
  SUBMITTED --> IN_PROGRESS:System(1st Step Activated)
  IN_PROGRESS --> COMPLETED:System(All Steps Done)
  IN_PROGRESS --> REJECTED:System(Any Step Rejected)
  DRAFT --> WITHDRAWN:Requester(WITHDRAW)
  SUBMITTED --> WITHDRAWN:Requester(WITHDRAW)
  IN_PROGRESS --> WITHDRAWN:Requester(WITHDRAW)
```

---

## 4. Step Statuses

| Status | Meaning |
|--------|---------|
| `UPCOMING` | Waiting for predecessor(s) to complete. |
| `STARTED` | Active for data entry (form filling). |
| `IN_PROGRESS` | Data submitted; awaiting approver decisions. |
| `IN_CLARIFICATION` | Approver requested more information. |
| `COMPLETED` | All required approvals granted. |
| `SKIPPED` | No approval required (or explicitly skipped). |
| `REJECTED` | Approver rejected the step. |

```mermaid
stateDiagram-v2
  direction LR
  [*] --> UPCOMING:System(Default)
  [*] --> STARTED:System(1st Step Created)
  UPCOMING --> STARTED:System(ACTIVATED)
  STARTED --> IN_PROGRESS:StepOwner(SUBMIT_STEP)
  IN_PROGRESS --> IN_CLARIFICATION:Approver(SEND_BACK)
  IN_CLARIFICATION --> IN_PROGRESS:StepOwner(CLARIFICATION_PROVIDED)
  IN_PROGRESS --> COMPLETED:Approver(APPROVE) / System(AUTO_COMPLETE)
  IN_PROGRESS --> SKIPPED:Approver(SKIP)
  IN_PROGRESS --> REJECTED:Approver(REJECT)
```

---

## 5. StepApproval Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | This approver is currently active. |
| `WAITING` | In the queue (sequential approval). |
| `APPROVED` | This approver approved. |
| `REJECTED` | This approver rejected. |
| `SENDBACK` | Sent back for clarification. |
| `REAPPROVAL_NEEDED` | Must re-approve after clarification. |

---

## 6. Action Logging Reference

### Request-Level Actions (→ RequestHistory)

| Action | Handler | Description |
|--------|---------|-------------|
| `CREATE` | RequestHandler | User creates a new request |
| `SUBMIT` | RequestHandler | User submits the request |
| `WITHDRAW` | RequestHandler | User cancels the request |
| `STATUS_CHANGE` | WorkflowEngine | Request status transition (system) |

### Step-Level Actions (→ StepHistory)

| Action | Handler | Description |
|--------|---------|-------------|
| `ACTIVATED` | WorkflowEngine | Step transitions `UPCOMING` → `STARTED` |
| `SUBMIT_STEP` | StepHandler | User submits step data for approval |
| `APPROVE` | ApprovalHandler | Approver approves |
| `REJECT` | ApprovalHandler | Approver rejects |
| `SEND_BACK` | ApprovalHandler | Approver requests clarification |
| `CLARIFICATION_PROVIDED` | StepHandler | User provides clarification |
| `AUTO_COMPLETE` | WorkflowEngine | No approvers → auto-completes |
| `SKIP` | ApprovalHandler | Step not required |

---

## 7. Auto-Complete Behavior

When a step has **no approval rules defined**, it automatically:
1. Transitions to `COMPLETED` immediately
2. Records `AUTO_COMPLETE` in StepHistory
3. Advances workflow to next step
4. Cascades through consecutive no-approver steps

---

## 8. Rejection Handling

**Approach: Hard Rejection**

- When any step is `REJECTED`, the Request status becomes `REJECTED`
- Completed steps remain `COMPLETED` (immutable)
- `UPCOMING` steps are never executed
- Request is final—requester creates a new request if needed

---

## 9. Unified Audit Log

The `getAuditLog()` function merges `RequestHistory` and `StepHistory` into a single chronological view, providing complete visibility into all actions.

```
GET /browse/Requests({ID})/RequestService.getAuditLog()
```

Returns: Unified list sorted by timestamp with source (`REQUEST`/`STEP`) and step names.
