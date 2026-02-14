# ADR-002: XSUAA for Global Access Control

## Status
✅ **Accepted** (2026-01-15)

## Context
We need enterprise-grade role management for ISO 27001 compliance. Roles must be:
- IT-controlled (not self-service)
- Auditable
- Integrated with SAP BTP

## Decision
Use **XSUAA scopes and role-templates** for global access control:

```json
{
  "scopes": [
    { "name": "$XSAPPNAME.admin" },
    { "name": "$XSAPPNAME.Requester" },
    { "name": "$XSAPPNAME.Approver" },
    { "name": "$XSAPPNAME.Viewer" }
  ]
}
```

## Consequences

### Positive
- ✅ IT controls role assignment via BTP Role Collections
- ✅ Audit trail in BTP
- ✅ Standard SAP security model
- ✅ SSO integration

### Negative
- ❌ Requires BTP configuration for each environment
- ❌ Role changes require IT involvement

## Implementation
- `xs-security.json` - Role definitions
- Handler checks: `req.user.is('Approver')`
