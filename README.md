# Flexible Request Management

> A modern, configurable workflow platform for enterprise request and approval processes.

## Overview

Flexible Request Management is a **SAP CAP** application that enables organizations to create and manage custom request workflows without code changes. Whether you need simple PR approvals or complex multi-step governance processes, this platform handles it all with a unified workflow engine.

### Key Features

| Feature | Description |
|---------|-------------|
| **Dynamic Forms** | JSON Schema-based forms that adapt to each request type |
| **Conditional Approvers** | Route approvals based on request data (e.g., amount, region) |
| **Multi-Step Workflows** | Define sequential or parallel approval steps |
| **Authorization & Roles** | Enterprise identity with Users, Groups, Teams, Departments |
| **Step Claim/Release** | Group-based approvals with exclusive claiming mechanism |
| **Real-Time Preview** | See potential approvers before submitting |
| **Audit Trail** | Complete history of all actions and decisions |
| **Attachments** | File uploads via S3/Object Store integration |
| **Studio UI** | Visual designer for administrators |

---

## Workflow Patterns

Our **Unified Workflow Engine** supports two patterns with the same configuration approach:

### Classical Workflow (Approval Chain)
**Example:** Purchase Request, Leave Request, Expense Report

```
Submit Form → Approver 1 → Approver 2 (conditional) → Approved
```

- **1 Step** with a single form
- **Multiple approvers** based on conditions (e.g., amount, region)
- Approver chain determined dynamically from request data

### Governance Workflow (Multi-Step)
**Example:** New Plant Creation, Vendor Onboarding, Master Data Governance

```
Step 1: Define → Step 2: Finance Setup → Step 3: Final Review → Complete
  (Form A)          (Form B)               (Form C)
```

- **Multiple steps**, each with its own form and approver(s)
- Steps can run sequentially or in parallel
- Different Step Owners can be assigned to each step

> **Key Insight:** Classical Workflow = Governance Workflow with 1 Step. Same engine, different configuration.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | SAP CAP (Node.js + TypeScript) |
| **Frontend** | React + shadcn/ui + TanStack Query |
| **Database** | SQLite (local) / SAP HANA (production) |
| **API** | OData V4 |
| **File Storage** | AWS S3 / SAP BTP Object Store |

---

## Quick Start

```bash
# Install dependencies
npm install

# Generate TypeScript types
npx cds-typer "*" --outputDirectory @cds-models

# Start both backend and frontend
npm run dev:all

# Backend: http://localhost:4004
# Frontend: http://localhost:5173
```

### Test Users (Local Development)

| User | Password | Role |
|------|----------|------|
| alice | alice | Administrator |
| bob | bob | User/Approver |

---

## Documentation

| Document | Description |
|----------|-------------|
| [📚 Full Documentation](docs/README.md) | Documentation hub |
| [Getting Started](docs/technical/implementation/getting-started.md) | Installation and setup |
| [Architecture](docs/technical/architecture/overview.md) | System design overview |
| [Workflow Architecture](docs/technical/architecture/workflow.md) | Status flows and handlers |
| [Security Layers](docs/technical/architecture/security-layers.md) | Authorization & defense-in-depth |
| [API Reference](docs/technical/reference/api-reference.md) | OData service documentation |
| [User Guide](docs/product/README.md) | End-user documentation |
| [Business Processes](docs/business/README.md) | Process flows (for BA team) |

---

## Deployment to SAP BTP

### Quick Deployment (3 Commands)

```bash
# 1. Build with all fixes
node scripts/build-unified.js

# 2. Package MTAR
mbt build

# 3. Deploy to Cloud Foundry
cf deploy mta_archives/flexible-request-management_1.0.0.mtar
```

### Comprehensive Documentation

| Resource | Description |
|----------|-------------|
| [🚀 Complete Deployment Workflow](.agent/workflows/deploy-btp-production.md) | Battle-tested deployment guide with all fixes |
| [⚡ Quick Reference](.agent/DEPLOYMENT_QUICK_REFERENCE.md) | Common commands and troubleshooting |
| [📋 Build Script](scripts/build-unified.js) | Automated build with critical fixes |

Use slash command in Antigravity:
```
/deploy-btp-production
```

---

## Project Structure

```
├── app/          # React frontend (shadcn/ui)
├── db/           # CDS domain models
├── srv/          # CAP services and handlers
├── docs/         # Documentation
├── tests/        # API and E2E tests
└── scripts/      # Utility scripts
```

---

## Learn More

- [SAP CAP Documentation](https://cap.cloud.sap/docs/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query)
