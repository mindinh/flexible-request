# Data Dictionary

> **Owner:** BA Lead | **Last Updated:** 2026-01-17 | **Audience:** Business Analysts

This document defines all data entities in plain language. **No code samples included.**

---

## Core Entities

### Request
A formal submission that requires one or more approval steps.

| Field | Description | Example |
|-------|-------------|---------|
| Title | Short description of the request | "New Plant: Munich Facility" |
| Status | Current state of the request | DRAFT, SUBMITTED, IN_PROGRESS |
| Justification | Reason for the request | Business need description |
| Coordinator | Person overseeing the workflow | Alice Admin |
| Owner | Person who created the request | Bob Requester |

### Step
A unit of work within a request. Each request has one or more steps.

| Field | Description | Example |
|-------|-------------|---------|
| Name | Step identifier | "Finance Review" |
| Status | Current state of the step | STARTED, IN_PROGRESS, COMPLETED |
| Order | Sequence position | 1, 2, 3... |
| Owner | Person/group responsible | Finance Team |
| Form Data | Collected information | Budget amount, cost center |

### Step Approval
A review/approval record for a step.

| Field | Description | Example |
|-------|-------------|---------|
| Approver | Person/group who reviews | Department Head |
| Status | Approval state | PENDING, APPROVED, REJECTED |
| Decision | Approval decision made | Approved with comments |
| Timestamp | When decision was made | 2026-01-17 09:00 |

---

## Identity Entities

### Shadow User
Local copy of a user from the identity system.

| Field | Description |
|-------|-------------|
| Display Name | Full name shown in UI |
| Email | Contact email |
| Last Login | When user last accessed system |

### Shadow Group
A collection of users for group assignments.

| Field | Description |
|-------|-------------|
| Name | Group display name |
| Description | Purpose of the group |
| Members | Users in the group |

---

## Assignment Types

Users and groups can be assigned to steps in different capacities:

| Type | Description | Example |
|------|-------------|---------|
| USER | Individual person | alice@example.com |
| GROUP | Defined group | Finance Approvers |
| TEAM | Work team | Plant Operations Team |
| DEPARTMENT | Organizational unit | Finance Department |
| ROLE | Job function | Plant Manager |
| POSITION | Org position | CFO |

---

## Status Values

### Request Status
| Value | Meaning |
|-------|---------|
| DRAFT | Created but not submitted |
| SUBMITTED | Submitted, waiting for processing |
| IN_PROGRESS | Being worked on |
| COMPLETED | All steps approved |
| REJECTED | At least one step rejected |
| WITHDRAWN | Cancelled by requester |

### Step Status
| Value | Meaning |
|-------|---------|
| UPCOMING | Not started yet (waiting for previous steps) |
| STARTED | Ready for step owner |
| IN_PROGRESS | Submitted, waiting approval |
| IN_CLARIFICATION | Sent back for changes |
| COMPLETED | Approved |
| REJECTED | Rejected |
| SKIPPED | Approval not required |
| PENDING | Legacy status (maps to UPCOMING) |

> **Note:** REAPPROVAL_NEEDED is handled at frontend level, not in DB.

### Approval Status
| Value | Meaning |
|-------|---------|
| PENDING | Waiting for review |
| WAITING | Waiting for previous approver |
| APPROVED | Approved |
| REJECTED | Rejected |
| SENDBACK | Sent back for clarification |

---

## Related Documents

- [Roles & Permissions](./roles-permissions.md) - Who can access what
- [Process Flows](./process-flows/README.md) - How things work
