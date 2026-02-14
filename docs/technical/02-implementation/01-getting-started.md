# Getting Started

## Prerequisites

- **Node.js** v18.x or later
- **npm** v9.x or later
- **SAP CDS CLI** (`@sap/cds-dk`)
- **Git** for version control

### Optional (for full deployment)
- SAP BTP account with:
  - XSUAA service
  - HANA Cloud
  - Object Store service (S3)

---

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd flexible-request-management

# Install dependencies
npm install

# Generate TypeScript types
npx cds-typer "*" --outputDirectory @cds-models
```

---

## Running Locally

```bash
# Start development server (with hot reload)
cds watch

# The server runs at:
# - http://localhost:4004

# Available services:
# - RequestService: http://localhost:4004/browse
# - AdminService: http://localhost:4004/admin
```

---

## Default Test Users

For local development, the following mock users are available:

| Username | Password | Role |
|----------|----------|------|
| alice | alice | User (end user) |
| bob | bob | Admin |

Use HTTP Basic Auth with these credentials.

---

## Quick Verification

```bash
# Run the verification script
powershell -ExecutionPolicy Bypass -File tests/verify_deployment.ps1

# Or run the full test suite
powershell -ExecutionPolicy Bypass -File tests/backend-api-tests.ps1
```

---

## Next Steps

1. Read [Architecture Overview](02-architecture.md)
2. Explore [Project Structure](03-project-structure.md)
3. Understand [Data Flow](04-data-flow.md)
