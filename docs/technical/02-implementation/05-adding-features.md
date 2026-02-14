# Adding New Features

Step-by-step guides for common extension tasks.

---

## 1. Adding a New Entity

### Step 1: Define in Schema

Edit `db/schema.cds`:

```cds
/**
 * Your new entity description
 */
entity YourEntity : cuid, managed {
    name        : String @mandatory;
    description : String;
    parent      : Association to ParentEntity;
}
```

### Step 2: Add Composition (if child entity)

```cds
entity ParentEntity : cuid, managed {
    // ... existing fields
    children : Composition of many YourEntity
                   on children.parent = $self;
}
```

### Step 3: Regenerate Types

```bash
npx cds-typer "*" --outputDirectory @cds-models
```

### Step 4: Expose in Service

Edit `srv/request-service.cds` or `srv/admin-service.cds`:

```cds
entity YourEntity as projection on db.YourEntity;
```

### Step 5: Add Seed Data (optional)

Create `db/data/sap.cre.YourEntity.json`:

```json
[
  { "ID": "uuid-here", "name": "Example" }
]
```

---

## 2. Adding a New Action

### Step 1: Define in CDS

Edit `srv/request-service.cds`:

```cds
entity YourEntity as projection on db.YourEntity actions {
    action yourAction(param1: String, param2: Integer);
};
```

### Step 2: Create or Update Handler

Create `srv/handlers/YourHandler.ts`:

```typescript
import cds from '@sap/cds';

export class YourHandler {
    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.srv.on('yourAction', 'YourEntity', this.onYourAction.bind(this));
    }

    private async onYourAction(req: cds.Request) {
        const { param1, param2 } = req.data;
        const entityId = (req.params[0] as { ID: string }).ID;
        
        // Your business logic here
        
        return { success: true };
    }
}
```

### Step 3: Register in Service

Edit `srv/request-service.ts`:

```typescript
import { YourHandler } from './handlers/YourHandler';

export default class RequestService extends cds.ApplicationService {
    async init() {
        // ... existing handlers
        new YourHandler(this).register();
        await super.init();
    }
}
```

---

## 3. Adding an Approver Rule Condition

### Step 1: Add Seed Data

Edit `db/data/sap.cre.ApproverRules.json`:

```json
{
  "ID": "AR_YOUR_RULE",
  "requestType_ID": "RT_NEW_PLANT",
  "stepDefinition_ID": "STEP_FINANCE_SETUP",
  "priority": 15,
  "conditionExpr": "{\"field\":\"budget\",\"operator\":\"gt\",\"value\":100000}",
  "approverType": "ROLE",
  "approverValue": "CFO",
  "description": "High budget needs CFO approval"
}
```

### Step 2: Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{"field":"country","operator":"eq","value":"DE"}` |
| `ne` | Not equals | `{"field":"status","operator":"ne","value":"draft"}` |
| `gt` | Greater than | `{"field":"amount","operator":"gt","value":1000}` |
| `lt` | Less than | `{"field":"priority","operator":"lt","value":3}` |
| `contains` | String contains | `{"field":"name","operator":"contains","value":"urgent"}` |
| `in` | Value in array | `{"field":"type","operator":"in","value":["A","B"]}` |
| `exists` | Field exists | `{"field":"urgentFlag","operator":"exists","value":true}` |

### Step 3: Multiple Conditions (AND)

```json
[
  {"field":"country","operator":"eq","value":"DE"},
  {"field":"budget","operator":"gt","value":50000}
]
```

---

## 4. Adding a Status Network Transition

### Step 1: Add to Seed Data

Edit `db/data/sap.cre.StatusNetwork.json`:

```json
{
  "ID": "SN_NEW_TRANSITION",
  "requestType_ID": "RT_NEW_PLANT",
  "fromStatus": "PENDING_REVIEW",
  "toStatus": "REVIEWED",
  "action": "completeReview",
  "description": "Mark as reviewed"
}
```

### Step 2: RequestHandler validates automatically

Status transitions are validated in `RequestHandler.validateStatusTransition()`. No code changes needed.

---

## 5. Adding a Background Job

### Step 1: Create Job Class

Create `srv/lib/your-job.ts`:

```typescript
import cds from '@sap/cds';

export class YourJob {
    static async run(): Promise<void> {
        const db = await cds.connect.to('db');
        const { YourEntity } = db.entities;
        
        // Your batch processing logic
        const items = await SELECT.from(YourEntity).where({ needsProcessing: true });
        
        for (const item of items) {
            // Process each item
            await UPDATE(YourEntity, item.ID).with({ processed: true });
        }
    }

    static schedule(intervalMs: number) {
        setInterval(YourJob.run, intervalMs);
        console.log(`[YourJob] Scheduled every ${intervalMs / 60000} minutes`);
    }
}
```

### Step 2: Register in Server

Edit `srv/server.ts`:

```typescript
import { YourJob } from './lib/your-job';

cds.on('served', () => {
    // ... existing jobs
    YourJob.schedule(30 * 60 * 1000); // Every 30 minutes
});
```

---

## 6. Adding Object Store Support for New Entity

### Step 1: Add contentId Field

```cds
entity YourEntity : cuid, managed {
    fileName  : String;
    mimeType  : String;
    contentId : String;  // S3 key
}
```

### Step 2: Add Actions in CDS

```cds
entity YourEntity as projection on db.YourEntity actions {
    function getUploadUrl(fileName: String, mimeType: String) returns { contentId: String; url: String };
    function getDownloadUrl() returns String;
};
```

### Step 3: Implement Handler

Follow the pattern in `AttachmentHandler.ts`.

---

## Checklist Before Completing Feature

- [ ] Entity has `cuid`, `managed`
- [ ] Types regenerated (`npx cds-typer`)
- [ ] Handler follows singleton pattern
- [ ] Seed data created (if configuration entity)
- [ ] `mta.yaml` updated (if new BTP service)
- [ ] Documentation updated
