# Component Reference

This document catalogs the reusable UI components for the Flexible Request Management System.

**Last Updated**: January 13, 2026

---

## UI Component Library

All base UI components are located in `app/request-management/src/components/ui/`.

### Basic Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Button` | Action triggers | `variant`, `size`, `asChild`, `disabled` |
| `Badge` | Status indicators | `variant` (success, warning, error, info, neutral) |
| `Card` | Content containers | `className` |
| `Input` | Text input | Standard HTML input props |
| `TextArea` | Multi-line input | Standard HTML textarea props |
| `Label` | Field labels | `htmlFor`, `variant` |

### Form Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Checkbox` | Boolean selection | `checked`, `onCheckedChange` |
| `Select` | Dropdown selection | `value`, `onValueChange` |
| `Switch` | Toggle on/off | `checked`, `onCheckedChange` |

### Layout Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Separator` | Visual dividers | `orientation` |
| `Table` | Data tables | Children-based API |
| `Tabs` | Tabbed content | `value`, `onValueChange` |

### Overlay Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Dialog` | Modal dialogs | `open`, `onOpenChange` |
| `Drawer` | Side panel with focus trap | `isOpen`, `onClose`, `size`, `title` |
| `Tooltip` | Hover hints | `content` |

### Loading Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Skeleton` | Base shimmer animation | `className` |
| `PageLoadingSkeleton` | Full page loading | — |
| `CardSkeleton` | Card placeholder | `className` |
| `ListSkeleton` | List items placeholder | `count` |
| `TableSkeleton` | Table rows placeholder | `rows`, `columns` |

---

## Shared Components

Located in `app/request-management/src/components/shared/`.

| Component | Purpose | Features |
|-----------|---------|----------|
| `GlobalToast` | Toast notifications | ARIA live regions, auto-dismiss |
| `GlobalErrorBoundary` | Error catching | Full-page error recovery |

---

## Feature Components

### Request Detail Components

Located in `app/request-management/src/features/requests/RequestDetail/components/`.

| Component | Purpose |
|-----------|---------|
| `RequestInfoCard` | Displays request metadata (title, status, dates) |
| `ApprovalActionCard` | Approve/Reject/Send Back actions for current step |
| `ReviewActionCard` | Review actions for pending approvals |
| `ClarificationCard` | Handle clarification requests |
| `RecentActivityCard` | Compact audit log summary (max 4 items) |
| `AuditLogDrawerContent` | Full audit log in drawer |
| `ActivityLogItem` | Memoized individual log entry |
| `StepFormSection` | Dynamic form fields for a step |
| `DisplayField` | Read-only field display |

### Dynamic Form Components

Located in `app/request-management/src/features/requests/DynamicRequestForm/components/`.

| Component | Purpose |
|-----------|---------|
| `FormHeader` | Form title and metadata |
| `RequestInfoForm` | Title, priority, justification fields |
| `DynamicFormSection` | Renders schema-driven form fields |
| `WorkflowPreviewPanel` | Sidebar showing workflow steps and approvers |
| `FormActions` | Submit/Cancel buttons |

### Studio Components

Located in `app/request-management/src/features/studio/`.

| Component | Purpose |
|-----------|---------|
| `RequestTypeLanding` | Landing page for all request types |
| `RequestTypeStudio` | Visual editor for request type configuration |
| `StudioCanvas` | Drag-and-drop form builder |
| `FieldPropertiesContent` | Properties panel for selected field |
| `StudioAdapter` | Transforms backend data to UI format |

---

## Custom Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useRequestFormData` | RequestDetail/hooks/ | Fetches and manages request form data |
| `useApproverResolver` | hooks/ | Resolves approvers based on form data |
| `useStudioStore` | features/studio/ | Zustand store for studio state |

---

## Button Variants

```tsx
<Button variant="default">Primary</Button>     // Red primary action
<Button variant="outline">Secondary</Button>   // Bordered button
<Button variant="destructive">Delete</Button>  // Red destructive
<Button variant="ghost">Subtle</Button>        // No background
<Button variant="link">Link</Button>           // Text link style
<Button size="sm">Small</Button>               // Compact size
<Button size="icon"><Icon /></Button>          // Icon-only button
```

---

## Badge Variants

```tsx
<Badge variant="default">Default</Badge>       // Red primary
<Badge variant="success">Approved</Badge>      // Green
<Badge variant="warning">Pending</Badge>       // Yellow
<Badge variant="error">Rejected</Badge>        // Red
<Badge variant="info">In Progress</Badge>      // Blue
<Badge variant="neutral">Draft</Badge>         // Gray
<Badge variant="secondary">Tag</Badge>         // Slate
```

---

## Status Mapping

| Status | Badge Variant | Color |
|--------|---------------|-------|
| DRAFT | neutral | Gray |
| SUBMITTED | info | Blue |
| IN_PROGRESS | info | Blue |
| PENDING | warning | Yellow |
| APPROVED | success | Green |
| COMPLETED | success | Green |
| REJECTED | error | Red |
| CANCELLED | neutral | Gray |

---

## Accessibility Features

All components follow WCAG 2.1 AA guidelines:

| Feature | Components |
|---------|------------|
| Focus Trap | Drawer, Dialog |
| ARIA Labels | All buttons, form fields |
| Live Regions | GlobalToast |
| Skip Link | AppShell |
| Keyboard Navigation | All interactive elements |

---

## Testing

Components have unit tests using Vitest + React Testing Library:

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
```

Test files are co-located with components:
- `Button.test.tsx`
- `Badge.test.tsx`
- `Drawer.test.tsx`
- `GlobalToast.test.tsx`
