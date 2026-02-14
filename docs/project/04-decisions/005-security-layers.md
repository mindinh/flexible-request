# ADR-005: Defense-in-Depth Security Layers

## Status
✅ **Accepted** (2026-01-16)

## Context
Penetration testing revealed that direct OData PATCH operations could forge sensitive fields, bypassing workflow authorization. We need multiple security layers.

## Decision
Implement **3-layer defense model**:

### Layer 1: XSUAA Roles
Global access control - "Do you have permission to use this feature?"
```typescript
if (!req.user.is('Approver')) {
    return req.error(403, 'Approver role required');
}
```

### Layer 2: Handler Authorization
Dynamic assignment check - "Are you assigned to THIS resource?"
```typescript
if (!await this.isAuthorizedApprover(req.user.id, approval)) {
    return req.error(403, 'Not authorized to approve this step');
}
```

### Layer 3: Field Protection
Attack surface reduction - "Prevent manipulation of system fields"
```typescript
// SecurityHandler.ts
this.srv.before(['CREATE', 'UPDATE'], 'Steps', (req) => {
    delete req.data.claimedBy_ID;
    delete req.data.ownerId;  // on UPDATE only
});
```

## Consequences

### Positive
- ✅ Defense in depth - no single point of failure
- ✅ Clear separation of concerns
- ✅ ISO 27001 compliant

### Negative
- ❌ Multiple checks per request (minor performance cost)
- ❌ More code to maintain

## Implementation
- `srv/handlers/SecurityHandler.ts` - Field sanitization
- `srv/handlers/ApprovalHandler.ts` - Approver checks
- `srv/handlers/StepHandler.ts` - Owner checks
