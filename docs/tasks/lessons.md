# Lessons Learned

## 1. CAP Event Emission and Transaction Race Conditions
**Symptom**: Emitting custom events `(cds as any).emit('my.Event', payload)` directly inside a transaction may orchestrate asynchronous handlers that attempt to read database records that have been created but not yet committed by that same transaction. This results in the handler silently failing (or logging errors) when `SELECT.one.from(Entity, id)` returns `undefined`.
**Pattern**: Asynchronous listeners using a new `DB` connection cannot view uncommitted data of a pending transaction.
**Fix**: Delay event emission until the transaction commits successfully using the `req.on('succeeded', handler)` API on the current CAP request context.
```typescript
const req = (cds as any).context;
if (req) {
    req.on('succeeded', () => {
        (cds as any).emit('my.Event', payload);
    });
} else {
    // Fallback if not running in a request context
    (cds as any).emit('my.Event', payload);
}
```
**Rule**: NEVER emit business events synchronously if handlers expect to read data generated in the same uncommitted transaction.
