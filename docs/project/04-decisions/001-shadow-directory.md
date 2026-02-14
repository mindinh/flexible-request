# ADR-001: Shadow Directory for Identity Management

## Status
✅ **Accepted** (2026-01-15)

## Context
We need to store user and group information for:
- Referential integrity in audit trails
- Group membership management
- Approval assignments
- RLS visibility filtering

Options considered:
1. Use XSUAA user IDs directly (string references)
2. Sync from IAS/LDAP to database
3. **Shadow Directory** - local copies with JIT provisioning

## Decision
Use a **Shadow Directory** model:
- `ShadowUsers` table stores local copies of users
- `ShadowGroups` table stores local group definitions
- JIT provisioning creates entries on first access
- All foreign keys reference Shadow entities (not XSUAA IDs)

## Consequences

### Positive
- ✅ Referential integrity maintained
- ✅ Works offline from IAS
- ✅ Group management UI possible
- ✅ Audit trails have stable UUIDs

### Negative
- ❌ Requires JIT provisioning logic
- ❌ Potential stale data if user leaves organization
- ❌ Storage overhead for user copies

## Implementation
- `db/schema/identity.cds` - Entity definitions
- `srv/lib/identity-provisioner.ts` - JIT provisioning
- `srv/identity-service.ts` - Identity management service
