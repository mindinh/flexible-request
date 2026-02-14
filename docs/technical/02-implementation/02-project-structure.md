# Project Structure

```
flexible-request-management/
├── db/                          # Database Layer
│   ├── schema.cds              # Entity definitions (14 entities)
│   └── data/                   # Seed data (JSON files)
│       ├── sap.cre.RequestTypes.json
│       ├── sap.cre.StepDefinitions.json
│       ├── sap.cre.StepDependencies.json
│       ├── sap.cre.SchemaDefinitions.json
│       ├── sap.cre.StatusNetwork.json
│       └── sap.cre.ApproverRules.json
│
├── srv/                         # Service Layer
│   ├── request-service.cds     # RequestService definition
│   ├── request-service.ts      # RequestService entry point
│   ├── admin-service.cds       # AdminService definition
│   ├── admin-service.ts        # AdminService entry point
│   ├── server.ts               # Custom server bootstrap
│   │
│   ├── handlers/               # Handler classes
│   │   ├── RequestHandler.ts   # submit, withdraw
│   │   ├── ApprovalHandler.ts  # approve, reject, sendBack
│   │   ├── ValidationHandler.ts # Schema validation
│   │   ├── AttachmentHandler.ts # S3 upload/download
│   │   └── admin/
│   │       ├── SchemaHandler.ts
│   │       ├── RequestTypeHandler.ts
│   │       └── StepHandler.ts
│   │
│   └── lib/                    # Core business logic
│       ├── workflow.ts         # WorkflowEngine
│       ├── approver-resolver.ts # ApproverResolver
│       ├── validation.ts       # SchemaValidator
│       ├── object-store.ts     # ObjectStoreProvider
│       └── sla-job.ts          # SLA background job
│
├── @cds-models/                # Generated TypeScript types
│
├── tests/                      # Test scripts
│   ├── verify_deployment.ps1   # Quick verification
│   └── backend-api-tests.ps1   # Full test suite
│
├── docs/                       # Documentation
│   ├── 01-12 series            # Developer guides
│   ├── user-manual/            # End-user documentation
│   ├── concepts/               # Reusable technical patterns
│   ├── archive/                # Historical documents
│   └── workflow-architecture.md
│
├── .agent/                     # Agent configuration (submodule)
│   ├── agents/                 # Persona definitions
│   ├── guidelines/             # Coding standards
│   └── workflows/              # Automation workflows
│
├── mta.yaml                    # Multi-Target Application config
├── xs-security.json            # XSUAA security config
├── package.json                # NPM dependencies
└── tsconfig.json               # TypeScript config
```

---

## Key Directories Explained

### `db/` - Database Layer

Contains the CDS data model and seed data.

| File | Purpose |
|------|---------|
| `schema.cds` | All 14 entity definitions with relationships |
| `data/*.json` | Initial seed data for configuration entities |

### `srv/` - Service Layer

Contains OData service definitions and TypeScript handlers.

| File/Folder | Purpose |
|-------------|---------|
| `*-service.cds` | CDS service definitions |
| `*-service.ts` | Service entry points (thin, delegates to handlers) |
| `handlers/` | Handler classes organized by service |
| `lib/` | Reusable business logic classes |
| `server.ts` | Custom server bootstrap for background jobs |

### `@cds-models/` - Generated Types

Auto-generated TypeScript types from CDS model. Regenerate with:

```bash
npx cds-typer "*" --outputDirectory @cds-models
```

### `.agent/` - Agent Configuration

Git submodule containing AI agent configuration:
- Persona definitions for different roles
- Coding guidelines and standards
- Automation workflows
