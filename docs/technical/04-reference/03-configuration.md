# Configuration and Security

This document outlines the environment variables, security roles, and deployment configurations for the Flexible Request Management System.

---

## 1. Environment Variables

The application relies on the following environment variables. In local development, these are read from `.env` or the default CAP configuration.

| Variable | Description | Default (Local) | Required? |
|----------|-------------|-----------------|-----------|
| `PORT` | HTTP Port for the application | `4004` | No |
| `SLA_CHECK_INTERVAL_MS` | Interval for background SLA checker | `3600000` (1 hour) | No |
| `S3_BUCKET` | Bucket name for Object Store | `attachments` | Local Dev Only |
| `S3_ENDPOINT` | Endpoint for MinIO/S3 compatible service | `http://localhost:9000` | Local Dev Only |
| `S3_ACCESS_KEY_ID` | Access Key ID | `minioadmin` | Local Dev Only |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key | `minioadmin` | Local Dev Only |
| `S3_REGION` | S3 Region | `us-east-1` | Local Dev Only |

> **Note:** On SAP BTP, `S3_*` variables are irrelevant if the Object Store service is bound. The app uses `VCAP_SERVICES` automatically.

---

## 2. Security Roles & Scopes

The application uses XSUAA for authentication and authorization.

### Defined Roles

| Role | Scope | Description |
|------|-------|-------------|
| **User** | `User` | Can create requests, view own requests, and approve if assigned. |
| **Admin** | `Admin` | Can configure RequestTypes, Steps, and system rules. Access to `/admin`. |

### CAP Service Protection

**RequestService (`/browse`)**
- Protected by default (mocked in local).
- Draft actions (`submit`, `withdraw`) handle ownership checks internally.

**AdminService (`/admin`)**
- Explicitly requires `admin` role in `srv/admin-service.cds` (recommended to confirm/add restriction if missing).

---

## 3. SAP BTP Configuration (`mta.yaml`)

The `mta.yaml` file defines the deployment structure on SAP BTP (Cloud Foundry).

### Modules
- **srv**: The Node.js CAP backend.
- **db-deployer**: Deploys HANA artifacts.

### Resources
- **xsuaa**: Authentication service (`application` plan).
- **hana**: Database (`hdi-shared` plan).
- **objectstore**: S3 storage (`s3-standard` plan). **Added in Phase 2**.

---

## 4. TypeScript Configuration (`tsconfig.json`)

The project uses `ts-node` for local execution and `tsc` for build verification.

- **Base URL**: `.`
- **Paths**: Maps `@cds-models/*` to generated types.
- **Target**: `ES2020` or higher recommended for modern Node.js features.

---

## 5. Seed Data

Configuration data is loaded from `db/data/` on initialization (or deployment).

- **Files:** `sap.cre.*.json`
- **Behavior:**
    - **SQLite (Local):** Reloaded on restart if database acts as in-memory or reset.
    - **HANA (Prod):** Loaded via `deploy` command if content changes (handled by `csv` files usually, JSON support depends on CAP version setup for seeding).

> **Important:** Changing seed data IDs (UUIDs) can break existing references in a persistent database.
