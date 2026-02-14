# Flexible Request Management System - Technical Design Specification

**Version:** 1.0

**Status:** Draft

**Date:** 2026-01-02

## 1. Executive Summary

- **Objective:** Build a flexible, metadata-driven system to handle various business requests and complex governance processes with dynamic workflows and data schemas.

- **Core Architectural Pattern:** Metadata-Driven, Hybrid SQL/JSON. The system relies heavily on configuration (Request Types, Steps) stored in the database to drive runtime behavior, rather than hard-coded logic for each request type.

- **Business Impact:** Enables rapid onboarding of new business processes (e.g., "New Plant") without engineering intervention. Reduces maintenance capability for disparate approval workflows.

## 2. Core Principles & Constraints

- **Single Source of Truth:** The Backend (CAP Service) calculates the next steps and determines approvers based on configuration. The Frontend is purely a rendering engine.

- **Scalability Goal:** Support unlimited Request Types and complex nested workflows.

- **Holy Trinity Compliance:**
  - **KISS:** Use generic "Request" and "Step" entities with JSON payloads for variability, avoiding hundreds of specific tables.
  - **DRY:** Reusable `WorkflowEngine` library for all request types.
  - **YAGNI:** Do not build a full custom BPMN engine; focus on linear and parallel step sequences sufficient for defined use cases.

## 3. Data Modeling (`db/schema.cds`)

### 3.1 Entity Definitions

- **Static Entities:**
    - `Requests`: ID, Title, Priority, CreatedBy, CreatedAt, Status, RequestTypeID.
    - `Steps`: ID, RequestID, StepDefinitionID, Status, ApproverInfo, ApprovedBy, ApprovedAt.
    - `RequestTypes`: Configuration for different requests (e.g., "Purchasing", "New Plant").
    - `StepDefinitions`: Configuration for steps within a Request Type (Sequence, Parallel/Serial flag, **SchemaDefinitionID**).
    - `StepApprovalConfig`: Configuration for the internal approval chain of a step (Sequence, Approver Rules).

- **Dynamic Entities:**
    - `RequestData`: Stores the actual business data as a `LargeString` (JSON). **CRITICAL:** Validated against `SchemaDefinitions` before write.
    - `SchemaDefinitions`: Standard JSON Schema (Draft 07) used to validate `RequestData`.
    - `StepApprovals`: Runtime instance of an approval within a step ends when all approvers sign off.
    - `RequestHistory`: Immutable audit log. Fields: RequestID, StepID, Action (Submit, Approve, Delegate), Actor, Timestamp, Comment, Snapshot (JSON).

- **Configuration Entities:**
    - `ApproverRules`: Decision table-like structures to Map (RequestType + Step + Data) -> (Approver / Group).

### 3.2 Virtual Fields

- `currentStep`: Calculated field on `Requests` for easy UI display.
- `isApprover`: Virtual boolean for the current user to determine editability.

## 4. Security Architecture

### 4.1 Access Control (Row-Level)

- **Scopes:**
    - `Request.Create`: Allow raising new requests.
    - `Request.Approve`: Allow acting on assigned steps.
    - `RequestAdmin`: Allow configuring Request Types.

- **@restrict rules:**
    - Users can only see their own Requests (`createdBy = $user`).
    - Approvers can see Requests where they have an active pending Step.

### 4.2 Field Control (The "Brain")

- **Precedence Logic:** Status matches (e.g., "APPROVED" -> Read Only) > User Role (Approver vs Requester) > Field Metadata.

## 5. Service Layer Implementation (`srv/`)

### 5.1 API Definition (`.cds`)

- `RequestService`: Main API for End Users. Actions: `submit`, `withdraw`.
- `ApprovalService`: API for Approvers. Actions: `approve`, `reject`, `sendBack`.
- `AdminService`: API for configuring Request Types.

### 5.2 Custom Logic (`.ts`)

- **Shared Libraries:** Reference logic residing in `srv/lib/`.

- **Background Jobs:**
    - `Reminders`: Scheduled job (e.g., nightly) to query `Steps` where `Status='Pending'`, `DueDate < Now`, and `ReminderSent=False`. Triggers notifications.

- **Workflow Engine (`srv/lib/workflow.ts`):**
    - `determineNextStep(requestId)`: Evaluates current step completion and activates the next sequence.
    - `resolveApprover(stepDef, requestData)`: Executes rules to find the Target Approver (User or SAP BTP Group).

- **WRITE Handlers:**
    - `before('UPDATE')`:
        1. Fetch `SchemaDefinition` for the current Request Type / Step.
        2. Use `AJV` (or similar) to validate the `RequestData` JSON blob. Throw `400` if invalid.
    - `after('UPDATE')`:
        1. Check if Step is Complete.
        2. If Complete, call `WorkflowEngine.advance()`.
    - Validate that the JSON configuration for Request Types is valid.
    - Ensure `RequestData` matches the schema defined for the Request Type.

## 6. Frontend Architecture (React)

### 6.1 Component Strategy

- **Design System:** Use `@ui5/webcomponents-react` to ensure strict SAP Fiori / Horizon theming.
- **Runtime Components:**
    - `DynamicForm`: Renders inputs based on the `SchemaDefinition` (JSON Schema) using `react-hook-form` + `ajv` resolver.
    - `WorkflowVisualizer`: Status flow using a custom step-progress component matching Fiori guidelines.
 
- **Admin Components:**
    - `ProcessBuilder`: A Drag-and-Drop canvas using `reactflow` to link Steps together.
    - `SchemaEditor`: A JSON Schema builder for non-technical admins (WYSIWYG).

### 6.2 State & Security Management

- **Server State:** Use `TanStack Query` for caching `RequestTypes` and `SchemaDefinitions`. High `staleTime` (e.g., 5 mins) for configurations.
- **Optimistic Updates:** Immediate UI reflection for "Approve" actions before server confirmation.
- **Metadata Consumer:** Frontend fetches the `RequestType` definition once and caches it to render generic forms dynamically.

## 7. Performance & Optimization

- **Caching Strategy:** Cache `RequestType` and `StepDefinition` configurations heavily as they rarely change.
- **Payload Optimization:** Fetch only summary data for Worklists; fetch full JSON blobs only on Detail View.

## 8. Implementation Checklist (Definition of Done)

- [ ] **Database:** Schema for Requests, Steps, and Dynamic Data created.
- [ ] **Backend:** Workflow Engine logic implemented to transition steps.
- [ ] **API:** OData services exposed for Request creation and Approval actions.
- [ ] **Frontend:** "My Requests" and "Approval" apps reading from metadata.
- [ ] **Validation:** Write Guard rejects invalid JSON payloads.
- [ ] **Audit:** History service records every state transition.
- [ ] **Reminders:** Background job configured for SLA checks.
- [ ] **Admin:** Basic configuration UI (or JSON upload) for Request Types.

## 9. Lifecycle Management (DevOps Strategy)

- **Challenge:** "Request Types" are technically *data*, but effectively *configuration*. How do we promote them from Dev -> Test -> Prod?
- **Strategy:** "Config-as-Code" + Seeding.
    - Configurations (RequestTypes, StepDefinitions, Schemas) are stored as JSON files in `db/data/config`.
    - Deployment Pipeline runs a `cds deploy --to hana` which upserts these files.
    - **Rule:** Admin UI in Production is technically "Emergency Only" or "Read Only". Primary changes happen in Dev (Config files) -> Git -> Pipeline -> Prod.

## 10. Testing Strategy (QA Strategy)

- **Unit Testing:**
    - `SchemaValidator`: Pass valid/invalid JSONs to ensure AJV throws 400.
    - `WorkflowEngine`: Mock `RequestData` and verify `determineNextStep` returns the correct StepDefinitionID.

- **Integration Testing:**
    - `ApprovalFlow`: Create a Request -> Approve as Manager -> Verify status updates in DB.

- **E2E Testing (Destructive):**
    - **Schema Evolution:** What happens if I update a Request Type schema while active requests exist? (Test backward compatibility).
    - **Orphaned Steps:** Reject a mid-stream step and verify cleanup.

