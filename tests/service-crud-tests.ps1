# ============================================================================
# Comprehensive Service CRUD Tests
# Lead QA Automation Engineer
# Tests Admin Service and Request Service CRUD operations
# ============================================================================

$BASE_URL = "http://localhost:4004"
$ADMIN_SERVICE = "$BASE_URL/admin"
$BROWSE_SERVICE = "$BASE_URL/browse"

$passCount = 0
$failCount = 0
$testResults = @()

function Log-Test {
    param($name, $status, $details)
    $global:testResults += @{Name = $name; Status = $status; Details = $details }
    if ($status -eq "PASS") {
        Write-Host "[PASS] $name" -ForegroundColor Green
        $global:passCount++
    }
    elseif ($status -eq "FAIL") {
        Write-Host "[FAIL] $name - $details" -ForegroundColor Red
        $global:failCount++
    }
    else {
        Write-Host "[INFO] $name - $details" -ForegroundColor Cyan
    }
}

Write-Host "`n========================================"
Write-Host " ADMIN SERVICE TESTS (Draft Operations)"
Write-Host "========================================`n"

# Store IDs for cleanup
$createdRequestTypeId = $null
$createdStepDefId = $null

# ----------------------------------------------------------------------------
# Test: Create RequestType (Draft)
# ----------------------------------------------------------------------------
Write-Host "=== Test: Create RequestType Draft ===" -ForegroundColor Yellow
try {
    $payload = @{
        title       = "QA Test Request Type"
        description = "Created by automated QA tests"
        isEnabled   = $true
        icon        = "test"
    } | ConvertTo-Json
    
    $uri = "$ADMIN_SERVICE/RequestTypes"
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $payload -ContentType "application/json" -ErrorAction Stop
    $createdRequestTypeId = $response.ID
    Log-Test "Create RequestType Draft" "PASS" "ID: $createdRequestTypeId"
}
catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "403|401|Unauthorized|Forbidden") {
        Log-Test "Create RequestType Draft" "INFO" "Admin auth required (expected in secured mode)"
    }
    else {
        Log-Test "Create RequestType Draft" "FAIL" $errorMsg
    }
}

# ----------------------------------------------------------------------------
# Test: Read RequestTypes
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read RequestTypes ===" -ForegroundColor Yellow
try {
    $uri = "$ADMIN_SERVICE/RequestTypes"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read RequestTypes" "PASS" "Found $count request types"
}
catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "403|401|Unauthorized|Forbidden") {
        Log-Test "Read RequestTypes" "INFO" "Admin auth required (expected)"
    }
    else {
        Log-Test "Read RequestTypes" "FAIL" $errorMsg
    }
}

# ----------------------------------------------------------------------------
# Test: Read StepDefinitions
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read StepDefinitions ===" -ForegroundColor Yellow
try {
    $uri = "$ADMIN_SERVICE/StepDefinitions"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read StepDefinitions" "PASS" "Found $count step definitions"
}
catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "403|401|Unauthorized|Forbidden") {
        Log-Test "Read StepDefinitions" "INFO" "Admin auth required (expected)"
    }
    else {
        Log-Test "Read StepDefinitions" "FAIL" $errorMsg
    }
}

# ----------------------------------------------------------------------------
# Test: Read ApproverRules
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read ApproverRules ===" -ForegroundColor Yellow
try {
    $uri = "$ADMIN_SERVICE/ApproverRules"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read ApproverRules" "PASS" "Found $count approver rules"
}
catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "403|401|Unauthorized|Forbidden") {
        Log-Test "Read ApproverRules" "INFO" "Admin auth required (expected)"
    }
    else {
        Log-Test "Read ApproverRules" "FAIL" $errorMsg
    }
}

# ----------------------------------------------------------------------------
# Test: Read StepDependencies
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read StepDependencies ===" -ForegroundColor Yellow
try {
    $uri = "$ADMIN_SERVICE/StepDependencies"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read StepDependencies" "PASS" "Found $count step dependencies"
}
catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "403|401|Unauthorized|Forbidden") {
        Log-Test "Read StepDependencies" "INFO" "Admin auth required (expected)"
    }
    else {
        Log-Test "Read StepDependencies" "FAIL" $errorMsg
    }
}

Write-Host "`n========================================"
Write-Host " BROWSE SERVICE TESTS (Request Operations)"
Write-Host "========================================`n"

# Store IDs for cleanup
$createdRequestId = $null

# ----------------------------------------------------------------------------
# Test: Read Available Request Types
# ----------------------------------------------------------------------------
Write-Host "=== Test: Read Available Request Types ===" -ForegroundColor Yellow
try {
    $uri = "$BROWSE_SERVICE/AvailableRequestTypes"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read Available Request Types" "PASS" "Found $count available types"
    
    if ($count -gt 0) {
        $global:testRequestTypeId = $response.value[0].ID
        Write-Host "  Using RequestType ID: $($global:testRequestTypeId)" -ForegroundColor Gray
    }
}
catch {
    Log-Test "Read Available Request Types" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Read Requests with expansion
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read Requests ===" -ForegroundColor Yellow
try {
    $uri = "$BROWSE_SERVICE/Requests?`$top=5&`$expand=steps,requestType"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read Requests with Expansion" "PASS" "Found $count requests"
}
catch {
    Log-Test "Read Requests with Expansion" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Create Request (Draft)
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Create Request (Draft) ===" -ForegroundColor Yellow
try {
    if ($global:testRequestTypeId) {
        $payload = @{
            title          = "QA Test Request"
            requestType_ID = $global:testRequestTypeId
            priority       = "MEDIUM"
            masterData     = @{
                payload = '{"testField":"testValue"}'
            }
        } | ConvertTo-Json -Depth 3
        
        $uri = "$BROWSE_SERVICE/Requests"
        $response = Invoke-RestMethod -Uri $uri -Method Post -Body $payload -ContentType "application/json" -ErrorAction Stop
        $createdRequestId = $response.ID
        Log-Test "Create Request Draft" "PASS" "ID: $createdRequestId"
    }
    else {
        Log-Test "Create Request Draft" "INFO" "No RequestType available for test"
    }
}
catch {
    Log-Test "Create Request Draft" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Read Single Request
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read Single Request ===" -ForegroundColor Yellow
try {
    if ($createdRequestId) {
        $uri = "$BROWSE_SERVICE/Requests($createdRequestId)?`$expand=steps,masterData"
        $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
        Log-Test "Read Single Request" "PASS" "Title: $($response.title), Status: $($response.status)"
    }
    else {
        # Read any existing request
        $uri = "$BROWSE_SERVICE/Requests?`$top=1"
        $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
        if ($response.value.Count -gt 0) {
            Log-Test "Read Single Request" "PASS" "Title: $($response.value[0].title)"
        }
        else {
            Log-Test "Read Single Request" "INFO" "No requests available"
        }
    }
}
catch {
    Log-Test "Read Single Request" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Update Request
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Update Request ===" -ForegroundColor Yellow
try {
    if ($createdRequestId) {
        $payload = @{
            title    = "QA Test Request - Updated"
            priority = "HIGH"
        } | ConvertTo-Json
        
        $uri = "$BROWSE_SERVICE/Requests($createdRequestId)"
        $response = Invoke-RestMethod -Uri $uri -Method Patch -Body $payload -ContentType "application/json" -ErrorAction Stop
        Log-Test "Update Request" "PASS" "Updated priority to HIGH"
    }
    else {
        Log-Test "Update Request" "INFO" "No request created to update"
    }
}
catch {
    Log-Test "Update Request" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Read Steps
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read Steps ===" -ForegroundColor Yellow
try {
    $uri = "$BROWSE_SERVICE/Steps?`$top=5"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read Steps" "PASS" "Found $count steps"
}
catch {
    Log-Test "Read Steps" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Read StepApprovals
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read StepApprovals ===" -ForegroundColor Yellow
try {
    $uri = "$BROWSE_SERVICE/StepApprovals?`$top=5"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read StepApprovals" "PASS" "Found $count approvals"
}
catch {
    Log-Test "Read StepApprovals" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Read RequestMasterData
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read RequestMasterData ===" -ForegroundColor Yellow
try {
    $uri = "$BROWSE_SERVICE/RequestMasterData?`$top=5"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read RequestMasterData" "PASS" "Found $count master data records"
}
catch {
    Log-Test "Read RequestMasterData" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Test: Read RequestHistory
# ----------------------------------------------------------------------------
Write-Host "`n=== Test: Read RequestHistory ===" -ForegroundColor Yellow
try {
    $uri = "$BROWSE_SERVICE/RequestHistory?`$top=5"
    $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
    $count = $response.value.Count
    Log-Test "Read RequestHistory" "PASS" "Found $count history records"
}
catch {
    Log-Test "Read RequestHistory" "FAIL" $_.Exception.Message
}

# ----------------------------------------------------------------------------
# Cleanup: Delete Test Request
# ----------------------------------------------------------------------------
Write-Host "`n=== Cleanup: Delete Test Request ===" -ForegroundColor Yellow
try {
    if ($createdRequestId) {
        $uri = "$BROWSE_SERVICE/Requests($createdRequestId)"
        Invoke-RestMethod -Uri $uri -Method Delete -ErrorAction Stop
        Log-Test "Delete Test Request" "PASS" "Cleanup successful"
    }
    else {
        Log-Test "Delete Test Request" "INFO" "No test request to cleanup"
    }
}
catch {
    Log-Test "Delete Test Request" "FAIL" $_.Exception.Message
}

# ============================================================================
# Summary
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host " TEST SUMMARY" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$total = $passCount + $failCount
$infoCount = ($testResults | Where-Object { $_.Status -eq "INFO" }).Count

Write-Host "`nTotal Tests Run: $($testResults.Count)"
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "Info/Skipped: $infoCount" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "`nRESULT: ALL TESTS PASSED" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`nRESULT: SOME TESTS FAILED" -ForegroundColor Red
    Write-Host "Failed Tests:"
    $testResults | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Details)" -ForegroundColor Red
    }
    exit 1
}
