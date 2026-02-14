# Troubleshooting Guide

Common issues and solutions for the Flexible Request Management System.

---

## 1. Startup Issues

### `EADDRINUSE: address already in use :::4004`
**Cause:** Another instance or zombie process is using port 4004.

**Fix:**
```powershell
# Check what's on port 4004
netstat -ano | findstr ":4004"

# Kill all Node processes
Stop-Process -Name "node" -Force

# Or start on a different port
$env:PORT=4005; cds watch
```

### `Model not found` or `Entity not found`
**Cause:** `cds-typer` hasn't run after schema changes.

**Fix:**
```bash
npx cds-typer "*" --outputDirectory @cds-models
```

---

## 2. Backend Requests Hanging

### Symptoms
- Frontend loads but API requests show "pending" indefinitely
- Server logs show "listening" but no incoming request logs

### Cause A: Zombie Node.js Processes
Previous instances holding database locks or stale TCP connections.

```powershell
# Diagnosis
Get-Process -Name "node" | Format-Table Id, ProcessName, StartTime

# Solution
Stop-Process -Name "node" -Force
Start-Sleep -Seconds 5
npm run dev:all
```

### Cause B: `cds watch` Live-Reload Bug (Windows)
The live-reload feature can block HTTP responses on some Windows configurations.

**Solution:** Use `cds serve` instead of `cds watch` in your dev script.

> **Trade-off:** You lose auto-reload. Restart manually after backend changes.

### Cause C: SQLite Database Lock
SQLite allows only one write connection.

```powershell
# Check for lock files
Get-Item "db.sqlite-wal" -ErrorAction SilentlyContinue

# Solution: Kill processes and remove lock files
Stop-Process -Name "node" -Force
Remove-Item "db.sqlite-wal", "db.sqlite-shm" -Force -ErrorAction SilentlyContinue
npm run dev:all
```

---

## 3. Authentication (Local)

### "401 Unauthorized" or "403 Forbidden"
**Cause:** Missing or incorrect Basic Auth credentials.

**Fix:**
- Use **alice** / **alice** for end-user endpoints
- Use **bob** / **bob** for admin endpoints
- Ensure `auth: "mocked"` is set in `.cdsrc.json` for local profiles

---

## 4. Database (SQLite)

### `SQLITE_CONSTRAINT: UNIQUE constraint failed`
**Cause:** Creating a record with duplicate ID.

**Fix:** Ensure IDs in `db/data/*.csv` are unique.

### `no such table: ...`
**Cause:** Database schema out of sync.

**Fix:**
```bash
# Delete old DB and restart
rm db.sqlite
cds watch
```

---

## 5. Object Store (S3)

### `Access Denied` or `SignatureDoesNotMatch`
**Fix:** Check `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` in `.env`.

### `ECONNREFUSED`
**Fix:** Ensure MinIO is running (`docker ps`) and check `S3_ENDPOINT`.

---

## 6. Workflow Logic

### Request stuck in `SUBMITTED`
**Cause:** No start step defined.

**Fix:** Ensure at least one `StepDefinition` has `isStartStep: true`.

### Approver not assigned
**Cause:** `ApproverResolver` matched no rules.

**Fix:** Check `ApproverRules` conditions or add `StepApprovalConfig` fallback.

---

## 7. Quick Reference

### Clean Restart Script
```powershell
.\restart-servers.ps1
```

Or manually:
```powershell
Stop-Process -Name "node", "esbuild" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5
npm run dev:all
```

### Development Commands
| Command | Description |
|---------|-------------|
| `npm run dev:all` | Start backend + frontend |
| `npx cds serve` | Backend only (no live-reload) |
| `npx cds watch` | Backend with live-reload |
| `npx cds-typer "*" --outputDirectory @cds-models` | Regenerate types |
| `npx tsc --noEmit` | Check TypeScript errors |
