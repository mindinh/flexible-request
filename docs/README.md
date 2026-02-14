# Flexible Request Management - Documentation

> **Last Updated:** 2026-01-17 | **Owner:** Project Team

Welcome to the Flexible Request Management documentation. This guide is organized by audience and purpose.

---

## 📚 Documentation Categories

| Category | Audience | Purpose |
|----------|----------|---------|
| [**Product**](./product/README.md) | End Users, Admins | How to use the product |
| [**Business**](./business/README.md) | BA Team | Process flows, data dictionary |
| [**Technical**](./technical/README.md) | Developers | Architecture, API, implementation |
| [**Project**](./project/README.md) | Internal Team | Roadmap, backlog, sprints |
| [**Releases**](./releases/README.md) | All | Changelog, release notes |

---

## 🚀 Quick Links

### For New Users
→ [Getting Started](./product/getting-started.md)

### For Administrators
→ [Role Management](./product/admin-guide/role-management.md)

### For Developers
→ [Technical Overview](./technical/README.md)  
→ [API Reference](./technical/reference/api-reference.md)

### For BA Team
→ [Process Flows](./business/process-flows/README.md)  
→ [Data Dictionary](./business/data-dictionary.md)

---

## 📂 Full Structure

```
docs/
├── product/           # End-user documentation
│   ├── getting-started.md
│   ├── user-manual/
│   └── admin-guide/
│
├── business/          # BA team (NO code)
│   ├── process-flows/
│   ├── data-dictionary.md
│   └── requirements/
│
├── technical/         # Developer documentation
│   ├── architecture/
│   ├── implementation/
│   └── reference/
│
├── project/           # Internal project management
│   ├── roadmap.md
│   ├── backlog.md
│   ├── sprints/
│   └── decisions/
│
├── releases/          # Change tracking
│   ├── CHANGELOG.md
│   └── versions/
│
└── archive/           # Historical reference
```

---

## 🔄 Documentation Maintenance

- **Docs-as-Code**: All docs in Git, updated with code changes
- **PR Checklist**: Every PR must update relevant docs
- **Quarterly Review**: All docs reviewed for accuracy

See [PR Requirements](../.agent/rules/pr-requirements.md) for details.
