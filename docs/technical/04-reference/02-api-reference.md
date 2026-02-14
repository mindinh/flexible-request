# API Reference

This document describes the API endpoints and service layer patterns for the Request Management frontend.

**Last Updated**: January 13, 2026

---

## Service Layer Overview

All API calls are encapsulated in service classes located in `src/services/`. Never call `api.get()` directly in components.

```
src/services/
├── RequestService.ts      # Request CRUD operations
├── AdminService.ts        # Admin/studio operations
└── InboxService.ts        # Inbox/approval operations
```

---

## Base URL

```
Development: http://localhost:4004
```

The API client is configured in `src/lib/api.ts` with:
- Base URL from environment
- Credential handling
- Error interceptors
- Global error event emission

---

## Request Service

Located at `src/services/RequestService.ts`.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Requests` | List all requests for current user |
| GET | `/Requests/:id` | Get request by ID with steps/approvals |
| POST | `/Requests` | Create new request |
| PUT | `/Requests/:id` | Update request |
| POST | `/Requests/:id/submit` | Submit request for approval |
| POST | `/Requests/:id/cancel` | Cancel/withdraw request |
| POST | `/Requests/:id/resubmit` | Resubmit after rejection |

### Usage Examples

```tsx
import { RequestService } from '@/services';

// List all requests
const requests = await RequestService.getAll();

// Get single request with expand
const request = await RequestService.getById(id);

// Create new request
const newRequest = await RequestService.create({
    title: 'New Request',
    requestTypeId: 'rt-001',
    priority: 'MEDIUM',
});

// Submit request
await RequestService.submit(id);
```

---

## Admin Service

Located at `src/services/AdminService.ts`.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/RequestTypes` | List all request types |
| GET | `/admin/RequestTypes/:id` | Get request type with steps |
| POST | `/admin/RequestTypes` | Create new request type |
| PUT | `/admin/RequestTypes/:id` | Update request type |
| POST | `/admin/publishRequestType` | Publish request type changes |

### Usage Examples

```tsx
import { AdminService } from '@/services';

// Get request type for studio
const type = await AdminService.getRequestType(id);

// Update request type
await AdminService.updateRequestType(id, {
    name: 'Updated Name',
    steps: [...],
});

// Publish changes
await AdminService.publish(id);
```

---

## Step Data Operations

### Save Step Form Data

```tsx
// POST /steps/:stepId/saveData
await api.post(`/steps/${stepId}/saveData`, {
    data: formData,
});
```

### Upload File

```tsx
// 1. Get signed upload URL
const { url, fileId } = await api.post('/files/getUploadUrl', {
    filename: file.name,
    contentType: file.type,
});

// 2. Upload to signed URL
await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
});

// 3. Save file metadata
await api.post('/files/saveMetadata', {
    fileId,
    stepId,
    filename: file.name,
});
```

---

## Approval Operations

### Approve Step

```tsx
await api.post(`/approvals/${approvalId}/approve`, {
    comment: 'Approved',
});
```

### Reject Step

```tsx
await api.post(`/approvals/${approvalId}/reject`, {
    comment: 'Reason for rejection',
});
```

### Send Back for Clarification

```tsx
await api.post(`/approvals/${approvalId}/sendBack`, {
    comment: 'Please provide more details',
    clarificationQuestion: 'What is the budget breakdown?',
});
```

### Respond to Clarification

```tsx
await api.post(`/requests/${requestId}/respondToClarification`, {
    response: 'Here is the budget breakdown...',
});
```

---

## Data Shapes

### Request

```typescript
interface Request {
    ID: string;
    title: string;
    description?: string;
    status: RequestStatus;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    requestTypeId: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    steps?: Step[];
}
```

### Step

```typescript
interface Step {
    ID: string;
    name: string;
    order: number;
    status: StepStatus;
    data?: Record<string, FieldValue>;
    approvals?: StepApproval[];
    schema?: FormSchema;
}
```

### Step Approval

```typescript
interface StepApproval {
    ID: string;
    stepId: string;
    approverId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT_BACK';
    comment?: string;
    decidedAt?: string;
}
```

### Audit Log Entry

```typescript
interface HistoryItem {
    ID: string;
    action: string;
    actor: string;
    timestamp: string;
    stepName?: string;
    fromValue?: string;
    toValue?: string;
    comment?: string;
}
```

---

## Error Handling

All API errors are intercepted and emitted to the global toast:

```tsx
// In api.ts interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.error?.message || 'Request failed';
        globalEvents.emit(EVENT_TYPES.API_ERROR, message);
        return Promise.reject(error);
    }
);
```

To handle errors in components:

```tsx
try {
    await RequestService.submit(id);
    globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Request submitted!');
} catch (error) {
    // Error already shown by interceptor
    // Handle any additional logic here
}
```

---

## React Query Integration

### Query Keys

```tsx
// Consistent key structure
const queryKeys = {
    requests: ['requests'] as const,
    request: (id: string) => ['request', id] as const,
    requestTypes: ['requestTypes'] as const,
    inbox: ['inbox'] as const,
};
```

### Query Example

```tsx
const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['request', id],
    queryFn: () => RequestService.getById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Mutation Example

```tsx
const mutation = useMutation({
    mutationFn: (id: string) => RequestService.submit(id),
    onSuccess: () => {
        queryClient.invalidateQueries(['request', id]);
        navigate('/requests');
    },
});
```

---

## OData Query Options

The backend supports OData query parameters:

| Parameter | Example | Description |
|-----------|---------|-------------|
| `$expand` | `$expand=steps,steps($expand=approvals)` | Expand relations |
| `$filter` | `$filter=status eq 'PENDING'` | Filter results |
| `$orderby` | `$orderby=createdAt desc` | Sort results |
| `$top` | `$top=10` | Limit results |
| `$skip` | `$skip=10` | Pagination offset |

### Example

```tsx
const requests = await api.get('/Requests', {
    params: {
        '$expand': 'steps($expand=approvals)',
        '$filter': `status eq 'IN_PROGRESS'`,
        '$orderby': 'createdAt desc',
        '$top': 20,
    },
});
```

---

## Inbox Service (Sprint 3)

Located in `src/services/InboxService.ts` (mapped to `InboxHandler`).

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/getMyTasks()` | pending approvals assigned to current user |
| GET | `/getTeamTasks()` | pending approvals assigned to user's groups |
| GET | `/getCoordinatingRequests()` | requests where user is coordinator |

### Usage Examples

```tsx
// Get my direct tasks
const myTasks = await api.get('/getMyTasks()');

// Get team/group tasks
const teamTasks = await api.get('/getTeamTasks()');
```

---

## Coordinator Actions (Sprint 3)

### Delegate Request

Transfer coordinator responsibility to another user.

```tsx
// POST /Requests(ID)/delegate
await api.post(`/Requests/${requestId}/delegate`, {
    newCoordinatorType: 'USER',
    newCoordinatorId: 'user-guid',
    newCoordinatorValue: 'john.doe@example.com'
});
```

---

## Step Actions (Sprint 3)

### Claim Step

Claim ownership of a step (typically for group-assigned steps).

```tsx
// POST /Steps(ID)/claimStep
await api.post(`/Steps/${stepId}/claimStep`, {});
```

### Release Step

Release a claimed step back to the pool.

```tsx
// POST /Steps(ID)/releaseStep
await api.post(`/Steps/${stepId}/releaseStep`, {});
```

---

## Identity Service (Authorization & Roles)

APIs for managing the Shadow Directory (users, groups, and memberships).

### SupportTypes (Principal Configuration)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/SupportTypes` | List all principal types |
| PATCH | `/admin/SupportTypes({ID})` | Update type (enable/disable) |

```tsx
// List enabled types
const types = await api.get('/admin/SupportTypes', {
    params: { '$filter': 'isEnabled eq true' }
});

// Disable a type
await api.patch(`/admin/SupportTypes(${id})`, { isEnabled: false });
```

### ShadowUsers (Read-Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/ShadowUsers` | List all provisioned users |
| GET | `/admin/ShadowUsers({ID})` | Get user by ID |

```tsx
// Search users
const users = await api.get('/admin/ShadowUsers', {
    params: { '$filter': `contains(displayName, '${search}')` }
});
```

> **Note:** Users are auto-provisioned on login (JIT). No manual create/update.

### ShadowGroups (Group Management)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/ShadowGroups` | List all groups |
| GET | `/admin/ShadowGroups({ID})` | Get group with members |
| POST | `/admin/ShadowGroups` | Create new group |
| PATCH | `/admin/ShadowGroups({ID})` | Update group |
| DELETE | `/admin/ShadowGroups({ID})` | Delete group |

```tsx
// Create group
await api.post('/admin/ShadowGroups', {
    name: 'Finance Approvers',
    type_ID: 'department-type-uuid',
    description: 'Department-level finance approvers'
});

// List with type filter
const teams = await api.get('/admin/ShadowGroups', {
    params: {
        '$expand': 'type,members($expand=user)',
        '$filter': `type/code eq 'TEAM'`
    }
});
```

### GroupMembers (Membership Management)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/ShadowGroups({ID})/members` | List group members |
| POST | `/admin/ShadowGroups({ID})/members` | Add member to group |
| DELETE | `/admin/GroupMembers({ID})` | Remove member |

```tsx
// Add member
await api.post(`/admin/ShadowGroups(${groupId})/members`, {
    user_ID: userId
});

// Remove member
await api.delete(`/admin/GroupMembers(${membershipId})`);
```

### Data Shapes (Identity)

```typescript
interface SupportType {
    ID: string;
    code: 'USER' | 'GROUP' | 'TEAM' | 'DEPARTMENT' | 'ROLE' | 'POSITION';
    name: string;
    isEnabled: boolean;
    sortOrder: number;
}

interface ShadowUser {
    ID: string;
    userId: string;      // IDP Subject ID
    email: string;
    displayName: string;
    isActive: boolean;
    lastLoginAt: string;
}

interface ShadowGroup {
    ID: string;
    name: string;
    description?: string;
    type: SupportType;
    isActive: boolean;
    members?: GroupMember[];
}

interface GroupMember {
    ID: string;
    user: ShadowUser;
    group: ShadowGroup;
    memberRole: 'MEMBER' | 'LEAD';
    addedAt: string;
}
```


