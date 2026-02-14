# Data Flow

This document explains how data flows through the system for key operations.

---

## 1. Request Submission Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant RequestService
    participant RequestHandler
    participant WorkflowEngine
    participant ApproverResolver
    participant Database

    User->>Frontend: Click "Submit"
    Frontend->>RequestService: POST /Requests(id)/submit
    RequestService->>RequestHandler: onSubmit()
    RequestHandler->>Database: UPDATE status = 'SUBMITTED'
    RequestHandler->>WorkflowEngine: advance(requestId)
    
    WorkflowEngine->>Database: SELECT StepDefinitions (isStartStep=true)
    WorkflowEngine->>Database: INSERT Step (PENDING)
    WorkflowEngine->>Database: SELECT StepApprovalConfig
    WorkflowEngine->>ApproverResolver: resolveApprover()
    ApproverResolver->>Database: SELECT ApproverRules
    ApproverResolver-->>WorkflowEngine: approver value
    WorkflowEngine->>Database: INSERT StepApproval
    WorkflowEngine->>Database: INSERT StepHistory (CREATED)
    WorkflowEngine->>Database: UPDATE Request status = 'IN_PROGRESS'
    
    RequestHandler-->>Frontend: Updated Request
    Frontend-->>User: Show confirmation
```

---

## 2. Approval Flow

```mermaid
sequenceDiagram
    participant Approver
    participant Frontend
    participant RequestService
    participant ApprovalHandler
    participant WorkflowEngine
    participant Database

    Approver->>Frontend: View Inbox
    Frontend->>RequestService: GET /StepApprovals?$filter=status eq 'PENDING'
    RequestService-->>Frontend: List of pending approvals
    
    Approver->>Frontend: Click "Approve"
    Frontend->>RequestService: POST /StepApprovals(id)/approve
    RequestService->>ApprovalHandler: onApprove()
    
    ApprovalHandler->>Database: UPDATE approval status = 'APPROVED'
    ApprovalHandler->>Database: Check all approvals for step
    
    alt All approvals complete
        ApprovalHandler->>Database: UPDATE Step status = 'COMPLETED'
        ApprovalHandler->>WorkflowEngine: advance(requestId)
        WorkflowEngine->>Database: Find next steps (dependencies satisfied)
        WorkflowEngine->>Database: INSERT new Steps
    end
    
    ApprovalHandler->>Database: INSERT RequestHistory
    ApprovalHandler-->>Frontend: Success
```

---

## 3. Dynamic Approver Resolution Flow

```mermaid
flowchart TD
    A[Step Created] --> B[Get RequestData payload]
    B --> C[Load ApproverRules for step]
    C --> D{Rules exist?}
    
    D -->|No| E[Use static StepApprovalConfig]
    D -->|Yes| F[Evaluate rules by priority]
    
    F --> G{Condition matches?}
    G -->|Yes| H[Use rule's approverValue]
    G -->|No| I{More rules?}
    I -->|Yes| F
    I -->|No| E
    
    E --> J[Create StepApproval]
    H --> J
```

### Condition Expression Format

```json
{
  "field": "country",
  "operator": "eq",
  "value": "DE"
}
```

**Supported Operators:**
- `eq` - equals
- `ne` - not equals
- `gt`, `lt`, `gte`, `lte` - comparisons
- `contains` - string contains
- `starts_with` - string starts with
- `ends_with` - string ends with

---

## 4. Attachment Upload Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant RequestService
    participant AttachmentHandler
    participant ObjectStoreProvider
    participant S3

    User->>Frontend: Select file
    Frontend->>RequestService: POST /Attachments/getUploadUrl
    RequestService->>AttachmentHandler: onGetUploadUrl()
    AttachmentHandler->>AttachmentHandler: Generate contentId (UUID/filename)
    AttachmentHandler->>ObjectStoreProvider: getUploadUrl()
    ObjectStoreProvider->>S3: Generate pre-signed PUT URL
    S3-->>ObjectStoreProvider: Pre-signed URL
    ObjectStoreProvider-->>AttachmentHandler: URL
    AttachmentHandler-->>Frontend: { contentId, url }
    
    Frontend->>S3: PUT file binary to pre-signed URL
    S3-->>Frontend: 200 OK
    
    Frontend->>RequestService: POST /Attachments
    Note right of Frontend: { fileName, mimeType, size, contentId, request_ID }
    RequestService->>Database: INSERT Attachment metadata
    RequestService-->>Frontend: Created
```

---

## 5. Status Network Validation Flow

```mermaid
flowchart TD
    A[UPDATE Request status] --> B[Get current status]
    B --> C{status changing?}
    C -->|No| D[Allow]
    C -->|Yes| E[Load StatusNetwork rules]
    E --> F{Rules exist for RequestType?}
    F -->|No| D
    F -->|Yes| G{Transition valid?}
    G -->|Yes| D
    G -->|No| H[Error 400: Invalid transition]
```

### Example Status Network

| From | To | Action |
|------|-----|--------|
| DRAFT | SUBMITTED | submit |
| SUBMITTED | IN_PROGRESS | (auto) |
| SUBMITTED | WITHDRAWN | withdraw |
| IN_PROGRESS | COMPLETED | (auto) |
| IN_PROGRESS | REJECTED | rejectApproval |
| IN_PROGRESS | WITHDRAWN | withdraw |

---

## 6. Step Dependencies Flow

```mermaid
flowchart LR
    A[Step 1: Define Plant<br>isStartStep=true] --> B{Step 2: Finance Setup}
    A --> C{Step 3: Logistics Setup}
    B --> D[Step 4: Final Review]
    C --> D
    
    style A fill:#90EE90
    style D fill:#FFB6C1
```

**Execution Logic:**
1. Submit request → Activate all `isStartStep=true` steps
2. When step completes → Find steps where ALL predecessors are COMPLETED
3. When all steps complete → Mark request COMPLETED
