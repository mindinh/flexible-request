# Role Management (Administrator Guide)

This guide explains how to manage roles in SAP BTP for Flexible Request Management.

---

## Prerequisites

- Access to **SAP BTP Cockpit**
- **Security Administrator** role in your subaccount

---

## Available Roles

| Role Template | Scope | Purpose |
|---------------|-------|---------|
| `Administrator` | `admin` | Full system access |
| `Requester` | `Requester` | Create and manage requests |
| `Approver` | `Approver` | Approve/reject assigned steps |
| `Viewer` | `Viewer` | Read-only access |

---

## Creating Role Collections

### Step 1: Navigate to Role Collections

1. Open SAP BTP Cockpit
2. Go to **Security** → **Role Collections**
3. Click **Create**

### Step 2: Create Role Collection

1. **Name**: e.g., "Request Management - Approvers"
2. **Description**: "Users who can approve workflow steps"
3. Click **Create**

### Step 3: Add Role Templates

1. Open the new Role Collection
2. Click **Edit**
3. Under **Roles**, click **Add**
4. Search for "flexible-request-management"
5. Select the appropriate role template:
   - `Approver` for approvers
   - `Requester` for requesters
6. Click **Add**
7. Click **Save**

---

## Assigning Users to Role Collections

### Via BTP Cockpit

1. Open the Role Collection
2. Click **Edit**
3. Under **Users**, click **Add**
4. Enter the user's email or ID
5. Select the Identity Provider
6. Click **Add**
7. Click **Save**

### Via IAS Group Mapping (Recommended for Large Groups)

1. In SAP IAS, create a group (e.g., "Approvers")
2. In BTP Cockpit, open the Role Collection
3. Under **User Groups**, add the IAS group name
4. All members of the IAS group will inherit the role

---

## Recommended Setup

| Team | Role Collection |
|------|-----------------|
| General Employees | Requester |
| Department Heads | Requester + Approver |
| IT Support | Administrator |
| External Auditors | Viewer |

---

## Troubleshooting

**"User cannot create requests"**
- Verify user has `Requester` role in a Role Collection
- Check that the Role Collection is assigned to the user

**"User cannot approve"**
- Verify user has `Approver` role
- Verify user is **also** assigned as approver in the specific workflow step

**Role changes not taking effect**
- User needs to log out and log back in
- Clear browser cache if using SSO
