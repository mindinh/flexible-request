# Real-Time Rule Simulation - Quick Start

> **Owner:** Tech Lead | **Last Updated:** 2026-01-17

**TL;DR**: Add instant rule preview to any form in 3 steps

---

## Installation (3 Steps)

### 1. Create Rule Resolver Utility

```typescript
// utils/[yourDomain]Resolver.ts
export interface Rule {
    id: string;
    priority: number;
    conditions: Array<{
        field: string;
        operator: 'eq' | 'gt' | 'lt' | 'contains';
        value: string;
    }>;
    outcome: any;
    isFinal?: boolean;
}

export function resolveRules(rules: Rule[], data: Record<string, any>) {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const matched = [];
    
    for (const rule of sorted) {
        const allMatch = rule.conditions.every(c => {
            const val = data[c.field];
            switch (c.operator) {
                case 'eq': return String(val) === String(c.value);
                case 'gt': return parseFloat(val) > parseFloat(c.value);
                case 'lt': return parseFloat(val) < parseFloat(c.value);
                case 'contains': return String(val).includes(String(c.value));
                default: return false;
            }
        });
        
        if (allMatch) {
            matched.push(rule.outcome);
            if (rule.isFinal) break;
        }
    }
    
    return matched;
}
```

### 2. Create Custom Hook

```typescript
// hooks/use[YourDomain]Simulator.ts
import { useMemo } from 'react';
import { resolveRules } from '@/utils/yourDomainResolver';

export function useYourSimulator(rules: any[], formData: Record<string, any>) {
    // Normalize rules from backend format
    const normalizedRules = useMemo(() => 
        transformBackendRules(rules),
        [rules]
    );
    
    // Add system/computed fields
    const enrichedData = useMemo(() => ({
        ...formData,
        __timestamp: Date.now()
    }), [formData]);
    
    // Resolve on every data change
    return useMemo(() => 
        resolveRules(normalizedRules, enrichedData),
        [normalizedRules, enrichedData]
    );
}
```

### 3. Integrate into Form

```typescript
// MyForm.tsx
import { useYourSimulator } from '@/hooks/useYourSimulator';

export function MyForm() {
    const [formData, setFormData] = useState({});
    const { data: config } = useQuery(['rules']);
    
    // 🎯 One line integration
    const results = useYourSimulator(config?.rules, formData);
    
    return (
        <>
            <FormFields data={formData} onChange={setFormData} />
            <PreviewPanel results={results} />
        </>
    );
}
```

---

## Common Patterns

### Pattern 1: Approval Routing

```typescript
const approvers = useApproverSimulator(rules, formData);

<div>Assigned to: {approvers[0]?.name || 'No approver'}</div>
```

### Pattern 2: Dynamic Pricing

```typescript
const discounts = usePricingSimulator(rules, formData);
const finalPrice = basePrice * (1 - discounts[0]?.amount || 0);

<div>
    Price: ${finalPrice.toFixed(2)}
    {discounts[0] && <Badge>{discounts[0].label}</Badge>}
</div>
```

### Pattern 3: Field Visibility

```typescript
const { visibleFields } = useVisibilitySimulator(rules, formData);

{visibleFields.includes('advancedOptions') && <AdvancedOptionsPanel />}
```

---

## System Field Naming

Use `__` prefix for system-generated fields:

```typescript
const enrichedData = {
    ...formData,
    __current_user: getUserId(),
    __timestamp: Date.now(),
    __request_priority: formData.priority || 'MEDIUM'
};
```

---

## Testing

```typescript
import { resolveRules } from './yourResolver';

test('resolves high priority rule', () => {
    const rules = [{
        id: '1',
        priority: 10,
        conditions: [{ field: 'priority', operator: 'eq', value: 'HIGH' }],
        outcome: { approver: 'CEO' }
    }];
    
    const result = resolveRules(rules, { priority: 'HIGH' });
    expect(result[0].approver).toBe('CEO');
});
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Cannot access before initialization" | Move hook call AFTER data dependencies |
| Rules not updating | Check useMemo dependencies |
| Performance lag | Add debouncing (300ms) |

---

## Full Documentation

See [Real-Time Simulation Pattern](./real-time-simulation.md) for:
- Architecture diagrams
- Complete implementation guide
- Design decisions
- Performance benchmarks
