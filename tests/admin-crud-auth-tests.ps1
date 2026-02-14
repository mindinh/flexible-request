# Admin Service CRUD Tests with Authentication
# Using alice/alice credentials

$BASE_URL = "http://localhost:4004"
$ADMIN_SERVICE = "$BASE_URL/admin"
$cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("alice:alice"))
$headers = @{Authorization = "Basic $cred" }

$passCount = 0
$failCount = 0

function Log-Result {
    param($name, $pass, $details)
    if ($pass) {
        Write-Host "[PASS] $name - $details" -ForegroundColor Green
        $global:passCount++
    }
    else {
        Write-Host "[FAIL] $name - $details" -ForegroundColor Red
        $global:failCount++
    }
}

Write-Host "`n=== ADMIN SERVICE CRUD TESTS (with auth) ===`n" -ForegroundColor Yellow

# Test 1: Read RequestTypes
Write-Host "--- Read RequestTypes ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/RequestTypes" -Method Get -Headers $headers -ErrorAction Stop
    $count = $response.value.Count
    Log-Result "Read RequestTypes" $true "Found $count records"
}
catch {
    Log-Result "Read RequestTypes" $false $_.Exception.Message
}

# Test 2: Read StepDefinitions
Write-Host "--- Read StepDefinitions ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/StepDefinitions" -Method Get -Headers $headers -ErrorAction Stop
    $count = $response.value.Count
    Log-Result "Read StepDefinitions" $true "Found $count records"
}
catch {
    Log-Result "Read StepDefinitions" $false $_.Exception.Message
}

# Test 3: Read ApproverRules - verify isFinal field exists
Write-Host "--- Read ApproverRules (verify isFinal) ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/ApproverRules?`$top=1&`$select=ID,priority,approverValue,isFinal" -Method Get -Headers $headers -ErrorAction Stop
    $count = $response.value.Count
    if ($count -gt 0) {
        $hasisFinal = $response.value[0].PSObject.Properties.Name -contains "isFinal"
        if ($hasisFinal) {
            Log-Result "Read ApproverRules (isFinal)" $true "isFinal field present"
        }
        else {
            Log-Result "Read ApproverRules (isFinal)" $false "isFinal field missing"
        }
    }
    else {
        Log-Result "Read ApproverRules" $true "Entity accessible (0 records)"
    }
}
catch {
    Log-Result "Read ApproverRules" $false $_.Exception.Message
}

# Test 4: Read StepDependencies - verify condition field removed
Write-Host "--- Read StepDependencies (verify no condition) ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/StepDependencies?`$top=1" -Method Get -Headers $headers -ErrorAction Stop
    $count = $response.value.Count
    if ($count -gt 0) {
        $hasCondition = $response.value[0].PSObject.Properties.Name -contains "condition"
        if (-not $hasCondition) {
            Log-Result "StepDependencies (no condition)" $true "condition field removed"
        }
        else {
            Log-Result "StepDependencies (no condition)" $false "condition field still exists"
        }
    }
    else {
        Log-Result "Read StepDependencies" $true "Entity accessible (0 records)"
    }
}
catch {
    Log-Result "Read StepDependencies" $false $_.Exception.Message
}

# Test 5: Read StatusNetwork
Write-Host "--- Read StatusNetwork ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/StatusNetwork" -Method Get -Headers $headers -ErrorAction Stop
    $count = $response.value.Count
    Log-Result "Read StatusNetwork" $true "Found $count records"
}
catch {
    Log-Result "Read StatusNetwork" $false $_.Exception.Message
}

# Test 6: CRUD - Create RequestType Draft
Write-Host "--- Create RequestType (Draft) ---" -ForegroundColor Cyan
$newRequestTypeId = $null
try {
    $payload = @{
        title       = "QA Test Type"
        description = "Test for unified workflow"
        isEnabled   = $true
        icon        = "test"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/RequestTypes" -Method Post -Body $payload -ContentType "application/json" -Headers $headers -ErrorAction Stop
    $newRequestTypeId = $response.ID
    Log-Result "Create RequestType" $true "ID: $newRequestTypeId"
}
catch {
    Log-Result "Create RequestType" $false $_.Exception.Message
}

# Test 7: Update RequestType
Write-Host "--- Update RequestType ---" -ForegroundColor Cyan
if ($newRequestTypeId) {
    try {
        $payload = @{ title = "QA Test Type - Updated" } | ConvertTo-Json
        $uri = "$ADMIN_SERVICE/RequestTypes(ID=$newRequestTypeId,IsActiveEntity=false)"
        Invoke-RestMethod -Uri $uri -Method Patch -Body $payload -ContentType "application/json" -Headers $headers -ErrorAction Stop
        Log-Result "Update RequestType" $true "Title updated"
    }
    catch {
        Log-Result "Update RequestType" $false $_.Exception.Message
    }
}
else {
    Write-Host "[SKIP] Update RequestType - No ID to update" -ForegroundColor Gray
}

# Test 8: Create StepDefinition
Write-Host "--- Create StepDefinition ---" -ForegroundColor Cyan
$newStepDefId = $null
if ($newRequestTypeId) {
    try {
        $payload = @{
            requestType_ID = $newRequestTypeId
            stepName       = "QA Test Step"
            isStartStep    = $true
            slaDays        = 3
            schemaContent  = '{"type":"object","properties":{"testField":{"type":"string"}}}'
            syncTrigger    = "NONE"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/StepDefinitions" -Method Post -Body $payload -ContentType "application/json" -Headers $headers -ErrorAction Stop
        $newStepDefId = $response.ID
        Log-Result "Create StepDefinition" $true "ID: $newStepDefId"
    }
    catch {
        Log-Result "Create StepDefinition" $false $_.Exception.Message
    }
}
else {
    Write-Host "[SKIP] Create StepDefinition - No RequestType ID" -ForegroundColor Gray
}

# Test 9: Create ApproverRule with isFinal
Write-Host "--- Create ApproverRule (with isFinal) ---" -ForegroundColor Cyan
$newRuleId = $null
if ($newStepDefId -and $newRequestTypeId) {
    try {
        $payload = @{
            requestType_ID    = $newRequestTypeId
            stepDefinition_ID = $newStepDefId
            priority          = 100
            conditionExpr     = '{}'
            approverType      = "ROLE"
            approverValue     = "manager"
            isFinal           = $true
            description       = "QA Test Rule with isFinal"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ADMIN_SERVICE/ApproverRules" -Method Post -Body $payload -ContentType "application/json" -Headers $headers -ErrorAction Stop
        $newRuleId = $response.ID
        Log-Result "Create ApproverRule (isFinal=true)" $true "ID: $newRuleId"
    }
    catch {
        Log-Result "Create ApproverRule (isFinal)" $false $_.Exception.Message
    }
}
else {
    Write-Host "[SKIP] Create ApproverRule - No Step/RequestType IDs" -ForegroundColor Gray
}

# Test 10: Delete ApproverRule
Write-Host "--- Delete ApproverRule ---" -ForegroundColor Cyan
if ($newRuleId) {
    try {
        Invoke-RestMethod -Uri "$ADMIN_SERVICE/ApproverRules($newRuleId)" -Method Delete -Headers $headers -ErrorAction Stop
        Log-Result "Delete ApproverRule" $true "Deleted"
    }
    catch {
        Log-Result "Delete ApproverRule" $false $_.Exception.Message
    }
}

# Test 11: Delete StepDefinition
Write-Host "--- Delete StepDefinition ---" -ForegroundColor Cyan
if ($newStepDefId) {
    try {
        Invoke-RestMethod -Uri "$ADMIN_SERVICE/StepDefinitions($newStepDefId)" -Method Delete -Headers $headers -ErrorAction Stop
        Log-Result "Delete StepDefinition" $true "Deleted"
    }
    catch {
        Log-Result "Delete StepDefinition" $false $_.Exception.Message
    }
}

# Test 12: Delete RequestType Draft
Write-Host "--- Delete RequestType (Draft) ---" -ForegroundColor Cyan
if ($newRequestTypeId) {
    try {
        $uri = "$ADMIN_SERVICE/RequestTypes(ID=$newRequestTypeId,IsActiveEntity=false)"
        Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers -ErrorAction Stop
        Log-Result "Delete RequestType" $true "Deleted"
    }
    catch {
        Log-Result "Delete RequestType" $false $_.Exception.Message
    }
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
$total = $passCount + $failCount
Write-Host "Total: $total | Passed: $passCount | Failed: $failCount"
if ($failCount -eq 0) {
    Write-Host "`nALL TESTS PASSED" -ForegroundColor Green
}
else {
    Write-Host "`nSOME TESTS FAILED" -ForegroundColor Red
}
