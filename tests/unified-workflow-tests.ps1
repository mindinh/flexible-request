# Unified Workflow - Service Layer Tests
# Lead QA Automation Engineer

$BASE_URL = "http://localhost:4004"
$ADMIN_SERVICE = "$BASE_URL/admin"
$BROWSE_SERVICE = "$BASE_URL/browse"

$passCount = 0
$failCount = 0

Write-Host "`n=== Test 1: ApproverRules Entity Accessible ===" -ForegroundColor Yellow
try {
    $uri = $ADMIN_SERVICE + "/ApproverRules?`$top=1"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    Write-Host "[PASS] ApproverRules entity accessible" -ForegroundColor Green
    $passCount++
}
catch {
    Write-Host "[FAIL] ApproverRules entity not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 2: StepApprovals Entity Accessible ===" -ForegroundColor Yellow
try {
    $uri = $ADMIN_SERVICE + "/StepApprovals?`$top=1"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    Write-Host "[PASS] StepApprovals entity accessible" -ForegroundColor Green
    $passCount++
}
catch {
    Write-Host "[FAIL] StepApprovals entity not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 3: RequestTypes without masterSchema ===" -ForegroundColor Yellow
try {
    $uri = $ADMIN_SERVICE + "/RequestTypes?`$top=1"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    
    if ($response.value.Count -gt 0) {
        $entity = $response.value[0]
        $props = $entity.PSObject.Properties.Name
        if ($props -contains "masterSchema") {
            Write-Host "[FAIL] masterSchema still exists" -ForegroundColor Red
            $failCount++
        }
        else {
            Write-Host "[PASS] masterSchema removed from RequestTypes" -ForegroundColor Green
            $passCount++
        }
    }
    else {
        Write-Host "[INFO] No RequestTypes to verify" -ForegroundColor Cyan
        $passCount++
    }
}
catch {
    Write-Host "[FAIL] RequestTypes not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 4: StepDefinitions without schemaMode ===" -ForegroundColor Yellow
try {
    $uri = $ADMIN_SERVICE + "/StepDefinitions?`$top=1"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    
    if ($response.value.Count -gt 0) {
        $entity = $response.value[0]
        $props = $entity.PSObject.Properties.Name
        if ($props -contains "schemaMode") {
            Write-Host "[FAIL] schemaMode still exists" -ForegroundColor Red
            $failCount++
        }
        else {
            Write-Host "[PASS] schemaMode removed from StepDefinitions" -ForegroundColor Green
            $passCount++
        }
    }
    else {
        Write-Host "[INFO] No StepDefinitions to verify" -ForegroundColor Cyan
        $passCount++
    }
}
catch {
    Write-Host "[FAIL] StepDefinitions not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 5: StepDependencies without condition ===" -ForegroundColor Yellow
try {
    $uri = $ADMIN_SERVICE + "/StepDependencies?`$top=1"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    
    if ($response.value.Count -gt 0) {
        $entity = $response.value[0]
        $props = $entity.PSObject.Properties.Name
        if ($props -contains "condition") {
            Write-Host "[FAIL] condition still exists" -ForegroundColor Red
            $failCount++
        }
        else {
            Write-Host "[PASS] condition removed from StepDependencies" -ForegroundColor Green
            $passCount++
        }
    }
    else {
        Write-Host "[INFO] No StepDependencies to verify" -ForegroundColor Cyan
        $passCount++
    }
}
catch {
    Write-Host "[FAIL] StepDependencies not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 6: ApproverRules has isFinal field ===" -ForegroundColor Yellow
try {
    $uri = $ADMIN_SERVICE + "/ApproverRules?`$top=1&`$select=ID,isFinal"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    Write-Host "[PASS] isFinal field accessible in ApproverRules" -ForegroundColor Green
    $passCount++
}
catch {
    Write-Host "[FAIL] isFinal field not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 7: Requests workflow check ===" -ForegroundColor Yellow
try {
    $uri = $BROWSE_SERVICE + "/Requests?`$top=5&`$expand=steps"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Write-Host "[PASS] Requests accessible, found $count requests" -ForegroundColor Green
    $passCount++
}
catch {
    Write-Host "[FAIL] Requests not accessible" -ForegroundColor Red
    $failCount++
}

Write-Host "`n=== Test 8: CDS Schema Compilation ===" -ForegroundColor Yellow
$cdsOutput = cds compile db/schema.cds 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] CDS schema compiles successfully" -ForegroundColor Green
    $passCount++
}
else {
    Write-Host "[FAIL] CDS schema compilation failed" -ForegroundColor Red
    $failCount++
}

# Summary
Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Yellow
$total = $passCount + $failCount
Write-Host "Total: $total, Passed: $passCount, Failed: $failCount"

if ($failCount -eq 0) {
    Write-Host "`nALL TESTS PASSED" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`nSOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
