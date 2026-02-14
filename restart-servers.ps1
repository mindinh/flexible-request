# restart-servers.ps1
# Script to kill all zombie servers and restart backend + frontend

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Server Restart Script              " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Show and kill processes on dev ports
$ports = @(4004, 5173, 5174, 3000)

Write-Host "Step 1: Checking ports for zombie processes..." -ForegroundColor Yellow
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $processId = $connection.OwningProcess
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        Write-Host "  Port $port : $($process.ProcessName) (PID: $processId)" -ForegroundColor Red
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Write-Host "    -> Killed!" -ForegroundColor Green
    }
    else {
        Write-Host "  Port $port : Free" -ForegroundColor Gray
    }
}

# Step 2: Kill any node processes that might be holding db.sqlite
Write-Host ""
Write-Host "Step 2: Checking for zombie Node.js processes..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  Found $($nodeProcesses.Count) Node.js process(es):" -ForegroundColor Red
    foreach ($proc in $nodeProcesses) {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
        # Show truncated command line
        $shortCmd = if ($cmdLine.Length -gt 80) { $cmdLine.Substring(0, 80) + "..." } else { $cmdLine }
        Write-Host "    PID $($proc.Id): $shortCmd" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "  Killing all Node.js processes..." -ForegroundColor Yellow
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "  -> All Node.js processes killed!" -ForegroundColor Green
}
else {
    Write-Host "  No zombie Node.js processes found." -ForegroundColor Gray
}

# Step 3: Wait a moment for file handles to release
Write-Host ""
Write-Host "Step 3: Waiting for db.sqlite lock to release..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Write-Host "  -> Done!" -ForegroundColor Green

# Step 4: Start servers
Write-Host ""
Write-Host "Step 4: Starting servers..." -ForegroundColor Yellow

$backendPath = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev:all" -WindowStyle Normal

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Servers Starting!                  " -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:4004" -ForegroundColor White
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
