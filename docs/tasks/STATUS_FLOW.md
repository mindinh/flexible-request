# Workflow → Status Flow Transformation Algorithm

This section defines the algorithm that converts a **Workflow Definition Graph** into a **Status Flow visualization**.

The goal is to produce a **lane-based lifecycle view** derived entirely from workflow structure.

---

# 1. Input Model

Workflow steps follow this structure:

```
stepId
stepName
actionSubType
formActions
assignee
predecessors
```

Example:

```
Start
 ↓
Input Data
 ↓
Input Data 2
 ↓
Please Approve
 ↓
End
```

---

# 2. Step Classification

Each workflow step must be classified before rendering.

### Step Type Detection

```
function detectStepType(step):
```

Rule priority:

1️⃣ Start Step

```
step.type == start
```

Result:

```
REQUESTOR_STEP
```

---

2️⃣ Data Entry Step

```
step.actionSubType == user_task
AND formActions contain Submit/Save/Continue
```

Result:

```
DATA_ENTRY_STEP
```

---

3️⃣ Approval Step

```
formActions contain:
Approve
Reject
```

Result:

```
APPROVAL_STEP
```

---

4️⃣ System Step (fallback)

```
SYSTEM_STEP
```

---

# 3. Workflow Ordering

The workflow graph must be sorted to ensure correct status ordering.

Algorithm:

```
topologicalSort(workflowGraph)
```

Result:

```
orderedSteps[]
```

Example:

```
1 Start
2 Input Data
3 Input Data 2
4 Please Approve
5 End
```

---

# 4. Lane Generation

Each lane represents a **unique actor role in the workflow**.

Algorithm:

```
for step in orderedSteps:
    actor = detectActor(step)
    if actor not in lanes:
        createLane(actor)
```

Actor detection:

```
if stepType == REQUESTOR_STEP
    actor = Requestor

if stepType == DATA_ENTRY_STEP
    actor = step.assignee

if stepType == APPROVAL_STEP
    actor = step.approverDisplayName
```

Example result:

```
Lane 1 Requestor
Lane 2 Giang
Lane 3 Nhan
Lane 4 Bob Finance
```

---

# 5. Data Entry Block Detection

Sequential data entry steps must be grouped logically.

Algorithm:

```
dataEntryBlock = []

for step in orderedSteps:

    if stepType == DATA_ENTRY_STEP
        add step to dataEntryBlock

    else
        close current block
```

Example workflow:

```
Input Data
Input Data 2
Input Data 3
```

Detected block:

```
DATA_ENTRY_BLOCK
  Input Data
  Input Data 2
  Input Data 3
```

This block belongs to **Step Owner lanes**.

---

# 6. Requestor Data Entry Handling

If Requestor owns multiple data entry steps:

```
Start
 ↓
Draft Step 1
 ↓
Draft Step 2
```

Display in Requestor lane:

```
Draft – Step 1
Draft – Step 2
```

Do NOT collapse into one step.

---

# 7. Overall Status Generation

Overall Status represents **workflow stages**.

Stage detection:

```
stage changes when actor changes
```

Example:

```
Requestor → Step Owner → Approver
```

Generated stages:

```
Draft
Processing
Under Review
Final Approval
Completed
```

Rule:

```
one overall status per lane
```

---

# 8. Individual Status Generation

Individual statuses are derived from:

```
workflow step states
workflow actions
```

Example:

Data Entry Step:

```
Started
In Progress
Completed
```

Approval Step:

```
Pending
Reviewing
Approved
Rejected
```

No hardcoded statuses allowed.

---

# 9. Status Mapping Logic

Status generation rules:

Data Entry Step:

```
Draft
Started
In Progress
Completed
```

Approval Step:

```
Pending
Reviewing
Approved
Rejected
```

Terminal Step:

```
Completed
Rejected
```

---

# 10. Status Card Construction

Each lane contains **cards**.

Structure:

```
Lane
 ├ Overall Status
 │
 └ Status Card
      ├ Individual Status
      ├ Individual Status
      └ Individual Status
```

Example:

```
Step Owner

Processing

Started
In Progress
Completed
```

---

# 11. Transition Rendering

Transitions represent **state movement between statuses**.

Rule:

```
edges must follow workflow direction
```

Allowed:

```
Lane A → Lane B
Lane B → Lane C
```

Not allowed:

```
Lane B → Lane A
```

Rejected requests must terminate.

```
Rejected → End
```

---

# 12. Legend Generation

Legend must be generated dynamically.

Source data:

```
lanes
workflow actions
generated statuses
```

Example legend:

User Roles

```
Requestor
Step Owner
Approver
```

Actions

```
Submit
Approve
Reject
Return
```

Statuses

```
Draft
Pending
Approved
Rejected
Completed
```

---

# 13. Rendering Order

Final rendering order:

```
1 generate lanes
2 generate overall statuses
3 generate individual statuses
4 generate transitions
5 generate legend
```

---

# 14. Validation Rules

Before rendering, validate workflow.

Checks:

```
every step has actor
every step has type
workflow has start
workflow has terminal state
```

Fallback:

```
unknown actor → Generic Step Owner
unknown step → Generic Step
```

---

# 15. Final Rendering Output

The final Status Flow must:

✓ derive lanes from workflow actors
✓ group sequential data entry steps
✓ generate statuses dynamically
✓ maintain UI structure
✓ avoid reverse transitions
✓ remain read-only

The Status Flow acts as a **visual lifecycle representation of the workflow execution**.
