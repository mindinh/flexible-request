# Workflow Storage Design

## 1. Overview
This document outlines the architectural design for how a **Request Type** stores its **Workflow** in the Flexible Request Management system. The workflow defines the lifecycle, sequence of steps, data collection forms, and approval routing for a specific category of requests.

## 2. Core Principles
1. **Graph-based Step Definition**: Rather than a linear sequence, workflows are modeled as a directed acyclic graph (DAG) where nodes are `StepDefinitions` and edges are `StepDependencies`.
2. **Dynamic Data Structures**: To support highly flexible forms and data requirements, structured JSON is heavily utilized (`LargeString` in CDS) for schemas, form definitions, and rule configurations, avoiding rigid relational tables for every new field.
3. **Decoupled Execution**: The blueprint (Request Type & Steps) is strictly separated from the runtime execution (Requests & Runtime Steps).

## 3. Architectural Entities (Blueprints)

### 3.1. RequestTypes
The root configuration entity representing a business process (e.g., "Leave Request").
- **`dataSchemaContent`**: JSON representing the comprehensive data dictionary (fields, types, validations) for the request type.
- **`formSchemasContent`**: JSON array of form layouts, allowing different steps to present different views of the data.
- **`steps`**: Composition of all `StepDefinitions` that make up the workflow.
- **`statusNetwork`**: Defines valid overall state machine transitions for the request.

### 3.2. StepDefinitions
Represents a single node on the workflow canvas.
- **Canvas Metadata**: `positionX`, `positionY` store the visual coordinates for the Workflow Studio.
- **Behavior Configuration**: `stepType` (start, end, action, condition) and `actionSubType` (form, email, approval) determine what happens when the step is activated.
- **Step-specific Schemas**: `schemaContent` holds the JSON form schema specifically applicable to this step.
- **I/O Mapping**: `inputsContent`, `outputsContent`, and `inputMapping` specify how data flows into and out of the step.
- **Routing & Automation**: `syncTrigger` (when to sync with external systems), API call definitions (`apiUrl`, etc.), and Email templates.
- **Identities**: Default owner (`ownerId`), fixed approver (`approverId`).

### 3.3. StepDependencies (Edges)
Models the sequence and dependencies.
- A step does not run immediately; it waits until all its `dependsOn` (predecessor) steps have reached a `COMPLETED` status.
- Optional `action` filtering allows branching (e.g., only activate if a predecessor finished with a specific action like "reject").

### 3.4. ApproverRules
Dynamic routing configuration.
- Evaluates `conditionExpr` (JSON logic) against the Request's payload at runtime.
- Routes to a specific `principalId` (User, Group, Team) based on matched conditions.
- Uses `priority` for evaluation order to handle complex multi-level approval matrices.

## 4. Runtime Execution (Transactional)

When a user submits a new request, runtime entities are instantiated based on the blueprint:
- **`Requests`**: The overarching instance linked to the `RequestTypes`.
- **`Steps`**: Runtime instances of `StepDefinitions`. Non-start steps begin in `UPCOMING` status.
- **`StepApprovals`**: Actively tracks who needs to approve and stores their decisions (`APPROVED`, `REJECTED`, etc.).
- **`RequestData`**: The actual JSON payload captured during execution, which conforms to the schemas defined in the blueprints.

## 5. Sequence and Execution Flow

1. **Initialization**: The `Start` step activates immediately upon request submission. 
2. **Progression**: The Workflow Engine evaluates `StepDependencies`. When a step completes, the engine checks if any dependent steps now have all their predecessors satisfied.
3. **Resolution**: If a step is an approval node, the Engine evaluates `ApproverRules` against the current `RequestData` to instantiate pending `StepApprovals`.
4. **Completion**: The workflow is marked completed or rejected based on the traversal of steps and the final node outcomes (end nodes).
