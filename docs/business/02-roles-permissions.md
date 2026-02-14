# Roles & Permissions

> **Owner:** BA Lead | **Last Updated:** 2026-01-17 | **Audience:** Business Analysts

This document defines all roles and their permissions. **No code samples included.**

---

## Role Types

| Type | Assigned By | Scope |
|------|-------------|-------|
| **System Role** | IT Administrator (BTP) | Global - applies everywhere |
| **Workflow Role** | Request Creator | Per-request - applies to one request |

---

## System Roles (XSUAA)

| Role | Who Gets It | Main Purpose |
|------|-------------|--------------|
| **Administrator** | IT Support, System Admins | Full access to everything |
| **Requester** | All Employees | Create and manage requests |
| **Approver** | Managers, Designated Approvers | Approve/reject assigned steps |
| **Viewer** | Auditors, Observers | Read-only access |

---

## Workflow Roles

| Role | Assigned To | How Assigned |
|------|-------------|--------------|
| **Coordinator** | Individual or Group | By request creator |
| **Step Owner** | Individual or Group | Configured per request type |
| **Step Approver** | Individual or Group | Configured per request type |

---

## Permission Matrix

### What Each Role Can Do

| Action | Admin | Requester | Approver | Viewer |
|--------|:-----:|:---------:|:--------:|:------:|
| Create new request | ✅ | ✅ | ❌ | ❌ |
| Edit draft request | ✅ | ✅ (own) | ❌ | ❌ |
| Submit request | ✅ | ✅ (own) | ❌ | ❌ |
| Approve/Reject step | ✅ | ❌ | ✅ (assigned) | ❌ |
| Submit step data | ✅ | ✅ (if owner) | ❌ | ❌ |
| View all requests | ✅ | ❌ | ❌ | ✅ |
| Manage groups | ✅ | ❌ | ❌ | ❌ |

### What Each Workflow Role Can Do

| Action | Coordinator | Step Owner | Approver |
|--------|:-----------:|:----------:|:--------:|
| View request progress | ✅ | ✅ | ✅ |
| Reassign step owners | ✅ | ❌ | ❌ |
| Delegate coordination | ✅ | ❌ | ❌ |
| Complete step form | ❌ | ✅ | ❌ |
| Approve/Reject | ❌ | ❌ | ✅ |
| Send back for clarification | ❌ | ❌ | ✅ |
| Respond to clarification | ✅ | ✅ | ❌ |

---

## Visibility Matrix

### Who Can See What

| User Context | Draft | Submitted | In Progress | Completed | Rejected |
|--------------|:-----:|:---------:|:-----------:|:---------:|:--------:|
| Request Creator | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coordinator | ✅ | ✅ | ✅ | ✅ | ✅ |
| Step Owner | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approver | ❌ | ✅ | ✅ | ✅ | ✅ |
| Administrator | ✅ | ✅ | ✅ | ✅ | ✅ |
| Viewer | ❌ | ✅ | ✅ | ✅ | ✅ |

> **Privacy Rule:** Users can only see requests where they have a role. No cross-organization visibility.

---

## Common Questions

**Q: Can someone have multiple roles?**
A: Yes! A person can be both Requester and Approver.

**Q: Who assigns system roles?**
A: IT Administrators using SAP BTP Role Collections.

**Q: Who assigns workflow roles?**
A: The request creator (or template) assigns Coordinator and Step Owners.

---

## Related Documents

- [Data Dictionary](./data-dictionary.md) - Entity definitions
- [Process Flows](./process-flows/README.md) - How workflows work
