# Approval Flow

> **Owner:** BA Lead | **Last Updated:** 2026-01-17 | **Audience:** Business Analysts

This document describes how approval works for each step in a request.

---

## Step Status Diagram

```mermaid
stateDiagram-v2
    [*] --> NOT_STARTED: Step created
    
    NOT_STARTED --> STARTED: Previous step completes
    
    STARTED --> IN_PROGRESS: Owner submits data
    
    IN_PROGRESS --> COMPLETED: All approvers approve
    IN_PROGRESS --> REJECTED: Any approver rejects
    IN_PROGRESS --> IN_CLARIFICATION: Approver sends back
    IN_PROGRESS --> REAPPROVAL_NEEDED: After clarification response
    
    IN_CLARIFICATION --> REAPPROVAL_NEEDED: Owner responds
    
    REAPPROVAL_NEEDED --> COMPLETED: Approver approves
    REAPPROVAL_NEEDED --> REJECTED: Approver rejects
    REAPPROVAL_NEEDED --> IN_CLARIFICATION: Approver sends back again
    
    COMPLETED --> [*]
    REJECTED --> [*]
```

---

## Step Status Definitions

| Status | Description | Active Party |
|--------|-------------|--------------|
| **NOT_STARTED** | Waiting for previous steps | None |
| **STARTED** | Ready for step owner | Step Owner |
| **IN_PROGRESS** | Data submitted, waiting approval | Approver |
| **IN_CLARIFICATION** | Approver requested changes | Step Owner |
| **REAPPROVAL_NEEDED** | Clarification provided | Approver |
| **COMPLETED** | Approved by all approvers | None |
| **REJECTED** | Rejected by any approver | None |

---

## Approval Process Flow

```mermaid
flowchart TD
    A[Step Owner receives step] --> B[Claim step if group-assigned]
    B --> C[Fill in required data]
    C --> D[Submit step]
    D --> E[Approver reviews]
    E --> F{Decision?}
    
    F -->|Approve| G[Step Completed]
    F -->|Reject| H[Step Rejected]
    F -->|Send Back| I[Request Clarification]
    
    I --> J[Step Owner responds]
    J --> K[Resubmit to Approver]
    K --> E
    
    G --> L{More Approvers?}
    L -->|Yes| E
    L -->|No| M[All Approved]
```

---

## Multi-Approver Scenarios

| Scenario | Behavior |
|----------|----------|
| Sequential approvers | Each approver reviews in order |
| Any approver rejects | Step is immediately rejected |
| All approvers approve | Step is completed |
| One approver sends back | Step goes to clarification |

---

## Related Documents

- [Request Lifecycle](./request-lifecycle.md) - Overall request flow
- [Claim Mechanism](./claim-mechanism.md) - How claiming works
