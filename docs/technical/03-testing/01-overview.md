# Testing Documentation

> **Owner:** QA Lead | **Last Updated:** 2026-01-17 | **Audience:** Developers, QA

Testing documentation including test reports and UAT scenarios.

---

## Test Reports

| Report | Focus | Tests | Status |
|--------|-------|-------|--------|
| [Backend Test Report](./backend-test-report.md) | CAP handlers, services | 89 | ✅ Pass |
| [Frontend Test Report](./frontend-test-report.md) | React components | - | ✅ Pass |
| [Penetration Test Report](./penetration-test-report.md) | Security vulnerabilities | 8 issues | ✅ Remediated |

---

## UAT Scenarios

| Document | Description |
|----------|-------------|
| [UAT Scenarios](./uat-scenarios.md) | User Acceptance Testing scenarios |

---

## Running Tests

### Backend Tests
```bash
npm test
```

### Frontend Tests
```bash
cd app
npm test
```

### E2E Tests
```bash
npm run test:e2e
```

---

## Related

- [Troubleshooting](../troubleshooting.md)
- [API Reference](../reference/api-reference.md)
