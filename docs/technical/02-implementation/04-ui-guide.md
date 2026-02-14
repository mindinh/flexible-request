# Frontend Development Guide

This guide covers development practices, architectural patterns, and conventions for the Request Management frontend application.

**Last Updated**: January 13, 2026

---

## Quick Start

```bash
# Navigate to frontend
cd app/request-management

# Install dependencies
npm install

# Start development server (frontend only)
npm run dev

# Or start full stack from root
npm run dev:all
```

---

## Project Structure

```
app/request-management/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI primitives
│   │   └── shared/          # Global components (Toast, ErrorBoundary)
│   ├── features/
│   │   ├── requests/        # Request management feature
│   │   │   ├── RequestList.tsx
│   │   │   ├── RequestDetail/
│   │   │   │   ├── index.tsx           # Orchestrator
│   │   │   │   ├── types.ts            # Local types
│   │   │   │   ├── components/         # Decomposed components
│   │   │   │   └── hooks/              # Feature-specific hooks
│   │   │   └── DynamicRequestForm/
│   │   ├── inbox/           # Approval inbox
│   │   └── studio/          # Request type builder
│   ├── hooks/               # Shared custom hooks
│   ├── layouts/             # Page layouts (AppShell)
│   ├── lib/                 # Utilities (api, events, utils)
│   ├── services/            # API service layer
│   ├── types/               # Shared type definitions
│   ├── config/              # UI configuration
│   ├── test/                # Test utilities
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # Entry point
├── vitest.config.ts         # Test configuration
└── package.json
```

---

## Architectural Patterns

### 1. Feature-First Organization

Features are self-contained modules with their own components, hooks, and types:

```
features/requests/RequestDetail/
├── index.tsx              # Main orchestrator (thin, ~200 lines)
├── types.ts               # Local type definitions
├── components/            # UI components
│   ├── RequestInfoCard.tsx
│   ├── ApprovalActionCard.tsx
│   └── ...
└── hooks/                 # Data fetching & state
    └── useRequestFormData.ts
```

### 2. Service Layer Pattern

All API calls go through services. Never use `api.get()` directly in components:

```tsx
// ✅ Good - Use service
import { RequestService } from '@/services';
const data = await RequestService.getById(id);

// ❌ Bad - Direct API call
const data = await api.get(`/Requests/${id}`);
```

### 3. Composition over Inheritance

Build complex UIs by composing smaller components:

```tsx
// Orchestrator pattern
export function RequestDetail() {
  const { data, isLoading } = useRequestFormData(id);
  
  return (
    <PageLayout>
      <RequestInfoCard request={data} />
      <StepFormSection step={data.currentStep} />
      <RecentActivityCard auditLog={data.auditLog} />
    </PageLayout>
  );
}
```

### 4. Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       React Components                       │
│                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌────────────────────┐ │
│  │  View   │───▶│ Custom Hooks │───▶│ React Query + API  │ │
│  │  Layer  │◀───│ (useRequest) │◀───│ (TanStack Query)   │ │
│  └─────────┘    └──────────────┘    └────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│                                                             │
│  ┌───────────────┐    ┌─────────────┐    ┌───────────────┐ │
│  │RequestService │    │AdminService │    │ InboxService  │ │
│  └───────────────┘    └─────────────┘    └───────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   CAP Backend   │
                    └─────────────────┘
```

---

## Type Safety

### Shared Types

All shared types are in `src/types/`:

```tsx
// types/requests.ts
export interface RequestData {
  ID: string;
  title: string;
  status: string;
  // ...
}

export type FieldValue = string | number | boolean | null;
export type FormData = Record<string, FieldValue>;
```

### Type Guards

Use type guards for runtime type checking:

```tsx
function isUiSection(item: UiCanvasItem): item is UiSection {
    return item.type === 'section' && 'fields' in item;
}

// Usage
if (isUiSection(item)) {
    item.fields.forEach(f => ...); // TS knows fields exist
}
```

### No Any

Avoid `any` types. Use `unknown` for truly unknown values:

```tsx
// ✅ Good
catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
}

// ❌ Bad
catch (err: any) {
    console.log(err.message);
}
```

---

## Component Guidelines

### 1. Props Interface at Top

```tsx
interface ButtonProps {
    variant?: 'default' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

export function Button({ variant = 'default', size = 'md', children }: ButtonProps) {
    // ...
}
```

### 2. Memoization for List Items

```tsx
import { memo } from 'react';

export const ListItem = memo(function ListItem({ item }: { item: Item }) {
    return <div>{item.name}</div>;
});
```

### 3. Forward Ref for Form Components

```tsx
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, ...props }, ref) => {
        return <input ref={ref} className={cn(baseStyles, className)} {...props} />;
    }
);
Input.displayName = 'Input';
```

### 4. Conditional Wrapper Pattern

```tsx
const Wrapper = asChild ? Slot : 'button';
return <Wrapper {...props}>{children}</Wrapper>;
```

---

## State Management

### Local State

Use `useState` for component-local state:

```tsx
const [isOpen, setIsOpen] = useState(false);
```

### Server State

Use React Query for server data:

```tsx
const { data, isLoading, error } = useQuery({
    queryKey: ['request', id],
    queryFn: () => RequestService.getById(id),
});
```

### Global State

Use Zustand for global UI state:

```tsx
// features/studio/useStudioStore.ts
export const useStudioStore = create<StudioState>((set) => ({
    activeTab: 'workflow',
    setActiveTab: (tab) => set({ activeTab: tab }),
}));
```

---

## Performance

### 1. Code Splitting

Use React.lazy for route-based splitting:

```tsx
const RequestDetail = lazy(() => 
    import('./features/requests/RequestDetail')
);

<Suspense fallback={<PageLoadingSkeleton />}>
    <RequestDetail />
</Suspense>
```

### 2. Memoization

Use `useMemo` for expensive computations:

```tsx
const sortedItems = useMemo(() => {
    return items.slice().sort((a, b) => a.order - b.order);
}, [items]);
```

### 3. Skeleton Loading

Use skeleton components instead of spinners:

```tsx
{isLoading ? <ListSkeleton count={5} /> : <ItemList items={items} />}
```

---

## Accessibility

### Required Practices

1. **ARIA Labels** on all interactive elements
2. **Focus trap** in modals and drawers
3. **Live regions** for dynamic content
4. **Skip link** in AppShell
5. **Keyboard navigation** support

### Example

```tsx
<button
    onClick={handleClick}
    aria-label="Close dialog"
    aria-pressed={isPressed}
>
    <X aria-hidden="true" />
</button>
```

---

## Testing

### Setup

Tests use Vitest + React Testing Library:

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### Patterns

```tsx
import { render, screen, fireEvent } from '@/test/utils';
import { Button } from '@/components/ui';

describe('Button', () => {
    it('handles click events', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click</Button>);
        
        fireEvent.click(screen.getByRole('button'));
        
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
```

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check |
| `npm test` | Run tests |
| `npm run test:coverage` | Coverage report |

---

## Common Patterns

### Loading State

```tsx
if (isLoading) return <PageLoadingSkeleton />;
if (error) return <ErrorDisplay error={error} />;
return <Content data={data} />;
```

### Error Handling

```tsx
try {
    await RequestService.submit(data);
    globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Request submitted!');
} catch (error) {
    globalEvents.emit(EVENT_TYPES.API_ERROR, 'Submission failed');
}
```

### Form Handling

```tsx
const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
        await RequestService.create(formData);
        navigate('/requests');
    } finally {
        setIsSubmitting(false);
    }
};
```
