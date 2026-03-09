# Additional Rules for Status Flow Generation

This document defines additional behavior for generating **Status Flow** from **Workflow Builder**.

The goal is to ensure that:

* Data Entry lanes always have consistent statuses.
* Reverse transitions such as **Sent Back** are correctly visualized in Status Flow.

---

# 1. Data Entry Lane Default Status Flow

For any **Data Entry step** (usually owned by the Requestor / Creator), the Status Flow must always contain the following statuses in order:

```
Draft
   ↓
In Progress
   ↓
Completed
```

These statuses represent the lifecycle of a **data entry step**.

---

## 1.1 Draft Status

Initial status when the request is first created.

Example:

```
Status: Draft
Lane: Data Entry
```

Transition:

```
Action: Save as Draft
```

Flow:

```
Draft → Save as Draft → In Progress
```

---

## 1.2 In Progress Status

Represents the user currently filling or editing the form.

Example:

```
Status: In Progress
Lane: Data Entry
```

Transition to next step is triggered by:

```
Action: Submit
```

Important:

The **Submit action must be taken from the Workflow definition**.

Example mapping:

```
In Progress → Submit → Completed
```

---

## 1.3 Completed Status

Represents the step finishing successfully.

Example:

```
Status: Completed
Lane: Data Entry
```

This status should be **configured from the Workflow transition**.

Example:

Workflow transition:

```
Input Data → User Task
Action: Submit
Status: Completed
```

Status Flow representation:

```
Draft
   ↓ Save as Draft
In Progress
   ↓ Submit
Completed
```

---

# 2. Reverse Transitions (Sent Back)

Workflow may contain transitions where a node **returns to a previous step**.

Example:

```
Approval Step → Data Entry Step
Action: Sent Back
```

This must be visualized in **Status Flow**.

---

## 2.1 Reverse Edge Behavior

When a workflow transition goes **back to a previous step**, the Status Flow must draw a **reverse connection**.

Example:

```
Approval → Sent Back → Data Entry
```

The edge should clearly point **backwards**.

---

# 3. Mapping Reverse Transitions to Statuses

Reverse transitions must connect to specific **entry statuses** depending on the target step type.

---

## 3.1 If Target Step is Data Entry

Reverse transitions should connect to:

```
In Progress
```

Reason:

When a request is sent back to Data Entry, the user must edit the form again.

Example:

Workflow:

```
Approval Step
   ↓ Sent Back
Input Data
```

Status Flow:

```
Approval Pending
   ↓ Sent Back
Data Entry → In Progress
```

---

## 3.2 If Target Step is Approval

Reverse transitions should connect to:

```
Pending
```

Reason:

When an approval step receives a returned request, the approval process restarts.

Example:

Workflow:

```
Manager Approval
   ↓ Sent Back
Finance Approval
```

Status Flow:

```
Manager Approved
   ↓ Sent Back
Finance Approval → Pending
```

---

# 4. Visual Representation in Status Flow

Reverse transitions must remain clear and readable.

Recommended visual rules:

* Use **curved edges** for backward connections.
* Use **clear arrow heads**.
* Label edges with the action name.

Example edge label:

```
Sent Back
```

---

# 5. Generation Logic

When generating Status Flow from Workflow transitions:

Algorithm:

```
For each workflow transition:

IF action == "Sent Back":

    determine target step type

    IF target step type == Data Entry:
        connect edge to "In Progress" status

    IF target step type == Approval:
        connect edge to "Pending" status

ELSE:

    render normal forward transition
```

---

# 6. Example Final Flow

Example workflow:

```
Input Data → Submit → User Task
User Task → Approve → End
User Task → Sent Back → Input Data
```

Generated Status Flow:

```
Data Entry Lane

Draft
   ↓ Save as Draft
In Progress
   ↓ Submit
Completed

Approval Lane

Pending
   ↓ Approve
Approved

Reverse Flow

Pending
   ↓ Sent Back
In Progress
```

---

# 7. Expected Result

Status Flow should clearly show:

* Normal forward progression
* Data Entry lifecycle
* Reverse flows caused by **Sent Back**
* Correct entry status depending on step type
