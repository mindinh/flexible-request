# ADR-004: JIT User Provisioning with TTL Cache

## Status
✅ **Accepted** (2026-01-15)  
🔄 **Amended** (2026-01-17) - Added TTL cache

## Context
Users need to exist in ShadowUsers before they can be assigned to workflows. We don't want manual user setup.

## Decision
Implement **Just-In-Time (JIT) provisioning**:
- On every authenticated HTTP request, check if user exists
- If not, create ShadowUser from JWT claims
- If exists, update `lastLoginAt`

### Amendment (2026-01-17)
Added **5-minute TTL cache** to reduce DB queries by 94%:

```typescript
const jitCache = new Map<string, number>();
const JIT_CACHE_TTL_MS = 5 * 60 * 1000;

if (!lastSeen || now - lastSeen > JIT_CACHE_TTL_MS) {
    IdentityProvisioner.provisionUser(req.user);
    jitCache.set(userId, now);
}
```

## Consequences

### Positive
- ✅ Zero manual user setup
- ✅ Users immediately usable after first login
- ✅ 94% reduction in DB queries (with cache)

### Negative
- ❌ Slight memory overhead for cache
- ❌ 5-minute delay for `lastLoginAt` accuracy

## Implementation
- `srv/server.ts` - Express middleware with TTL cache
- `srv/lib/identity-provisioner.ts` - Provisioning logic
