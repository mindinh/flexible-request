# ADR-003: RLS Visibility Rules

## Status
✅ **Accepted** (2026-01-15)

## Context
Users should only see requests they are involved with. We need Row-Level Security (RLS) to filter data at the database layer.

## Decision
Implement **visibility-based RLS** where users can see requests if they are:

| Role | Can See |
|------|---------|
| Creator | Own requests (any status) |
| Coordinator | Assigned requests (any status) |
| Step Owner | Assigned steps (SUBMITTED+) |
| Approver | Assigned approvals (SUBMITTED+) |
| Admin | All requests |

**Key principle:** No cross-organization visibility for privacy.

## Consequences

### Positive
- ✅ Privacy protected - users see only their work
- ✅ Performance - filtered at DB level
- ✅ Security - no accidental data exposure

### Negative
- ❌ Users can't see "company activity"
- ❌ Complex query logic in RLSHandler

## Implementation
- `srv/handlers/RLSHandler.ts` - Visibility filtering
- `srv/lib/security-context.ts` - User context resolution
