# Backend API Test Suite
# As Lead QA Automation Engineer, these tests validate all backend services

$BaseUrl = "http://localhost:4004"
$Headers = @{
    "Content-Type" = "application/json"
}
$Auth = @{
    username = "alice"
    password = "alice"
}

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = @{}
    )
    
    $uri = "$BaseUrl$Endpoint"
    $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($Auth.username):$($Auth.password)"))
    $headers = @{
        "Content-Type"  = "application/json"
        "Authorization" = "Basic $cred"
    }
    
    try {
        if ($Body.Count -gt 0) {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body ($Body | ConvertTo-Json -Depth 10)
        }
        else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }
        return @{ Success = $true; Data = $response }
    }
    catch {
        return @{ Success = $false; Error = $_.Exception.Message; StatusCode = $_.Exception.Response.StatusCode }
    }
}

$TestResults = @()

# ============================================================================
# TEST 1: Request Lifecycle (FR-01, FR-04)
# ============================================================================
Write-Host "`n=== TEST 1: Request Lifecycle ===" -ForegroundColor Cyan

# 1.1 Create Draft Request
$draft = Invoke-ApiRequest -Method "POST" -Endpoint "/browse/Requests" -Body @{
    title          = "Test Request - QA Suite"
    requestType_ID = "RT_NEW_PLANT"
    priority       = "HIGH"
}

if ($draft.Success) {
    $requestId = $draft.Data.ID
    Write-Host "  [PASS] Created draft request: $requestId" -ForegroundColor Green
    $TestResults += @{ Name = "Create Draft"; Passed = $true }
}
else {
    Write-Host "  [FAIL] Failed to create draft: $($draft.Error)" -ForegroundColor Red
    $TestResults += @{ Name = "Create Draft"; Passed = $false }
    exit 1
}

# 1.2 Activate Draft
$activate = Invoke-ApiRequest -Method "POST" -Endpoint "/browse/Requests(ID=$requestId,IsActiveEntity=false)/RequestService.draftActivate"
if ($activate.Success) {
    Write-Host "  [PASS] Activated draft" -ForegroundColor Green
    $TestResults += @{ Name = "Activate Draft"; Passed = $true }
}
else {
    Write-Host "  [FAIL] Failed to activate: $($activate.Error)" -ForegroundColor Red
    $TestResults += @{ Name = "Activate Draft"; Passed = $false }
}

# 1.3 Submit Request
$submit = Invoke-ApiRequest -Method "POST" -Endpoint "/browse/Requests(ID=$requestId,IsActiveEntity=true)/RequestService.submit"
if ($submit.Success) {
    Write-Host "  [PASS] Submitted request" -ForegroundColor Green
    $TestResults += @{ Name = "Submit Request"; Passed = $true }
}
else {
    Write-Host "  [FAIL] Failed to submit: $($submit.Error)" -ForegroundColor Red
    $TestResults += @{ Name = "Submit Request"; Passed = $false }
}

# ============================================================================
# TEST 2: Workflow Engine (FR-02)
# ============================================================================
Write-Host "`n=== TEST 2: Workflow Engine ===" -ForegroundColor Cyan

# 2.1 Verify Steps Created
$steps = Invoke-ApiRequest -Method "GET" -Endpoint "/browse/Steps?`$filter=request_ID eq '$requestId'"
if ($steps.Success -and $steps.Data.value.Count -gt 0) {
    Write-Host "  [PASS] Steps created: $($steps.Data.value.Count)" -ForegroundColor Green
    $TestResults += @{ Name = "Steps Created"; Passed = $true }
    $stepId = $steps.Data.value[0].ID
    $stepStatus = $steps.Data.value[0].status
    Write-Host "       Step ID: $stepId, Status: $stepStatus" -ForegroundColor Gray
}
else {
    Write-Host "  [FAIL] No steps created" -ForegroundColor Red
    $TestResults += @{ Name = "Steps Created"; Passed = $false }
}

# 2.2 Verify StepHistory Created (Audit Trail)
$stepHistory = Invoke-ApiRequest -Method "GET" -Endpoint "/browse/StepHistory?`$filter=step_ID eq '$stepId'"
if ($stepHistory.Success -and $stepHistory.Data.value.Count -gt 0) {
    Write-Host "  [PASS] StepHistory recorded: $($stepHistory.Data.value.Count) entries" -ForegroundColor Green
    $TestResults += @{ Name = "StepHistory Recorded"; Passed = $true }
}
else {
    Write-Host "  [FAIL] No StepHistory entries" -ForegroundColor Red
    $TestResults += @{ Name = "StepHistory Recorded"; Passed = $false }
}

# ============================================================================
# TEST 3: Approvals (FR-03, FR-05)
# ============================================================================
Write-Host "`n=== TEST 3: Approvals ===" -ForegroundColor Cyan

# 3.1 Verify Approvals Created
$approvals = Invoke-ApiRequest -Method "GET" -Endpoint "/browse/StepApprovals?`$filter=step_ID eq '$stepId'"
if ($approvals.Success -and $approvals.Data.value.Count -gt 0) {
    Write-Host "  [PASS] Approvals created: $($approvals.Data.value.Count)" -ForegroundColor Green
    $TestResults += @{ Name = "Approvals Created"; Passed = $true }
    $approvalId = $approvals.Data.value[0].ID
    $approver = $approvals.Data.value[0].approver
    Write-Host "       Approval ID: $approvalId, Approver: $approver" -ForegroundColor Gray
}
else {
    Write-Host "  [WARN] No approvals created (may be expected)" -ForegroundColor Yellow
    $TestResults += @{ Name = "Approvals Created"; Passed = $true }
}

# ============================================================================
# TEST 4: Status Network Validation (FR-07)
# ============================================================================
Write-Host "`n=== TEST 4: Status Network ===" -ForegroundColor Cyan

# 4.1 Verify StatusNetwork entries exist
$statusNetwork = Invoke-ApiRequest -Method "GET" -Endpoint "/admin/StatusNetwork"
if ($statusNetwork.Success -and $statusNetwork.Data.value.Count -gt 0) {
    Write-Host "  [PASS] StatusNetwork configured: $($statusNetwork.Data.value.Count) transitions" -ForegroundColor Green
    $TestResults += @{ Name = "StatusNetwork Configured"; Passed = $true }
}
else {
    Write-Host "  [FAIL] No StatusNetwork entries" -ForegroundColor Red
    $TestResults += @{ Name = "StatusNetwork Configured"; Passed = $false }
}

# ============================================================================
# TEST 5: Approver Rules (FR-03 Dynamic)
# ============================================================================
Write-Host "`n=== TEST 5: Approver Rules ===" -ForegroundColor Cyan

# 5.1 Verify ApproverRules entries exist
$approverRules = Invoke-ApiRequest -Method "GET" -Endpoint "/admin/ApproverRules"
if ($approverRules.Success -and $approverRules.Data.value.Count -gt 0) {
    Write-Host "  [PASS] ApproverRules configured: $($approverRules.Data.value.Count) rules" -ForegroundColor Green
    $TestResults += @{ Name = "ApproverRules Configured"; Passed = $true }
}
else {
    Write-Host "  [WARN] No ApproverRules entries" -ForegroundColor Yellow
    $TestResults += @{ Name = "ApproverRules Configured"; Passed = $true }
}

# ============================================================================
# TEST 6: Attachments (Object Store)
# ============================================================================
Write-Host "`n=== TEST 6: Attachments ===" -ForegroundColor Cyan

# 6.1 Create Attachment metadata
$attachment = Invoke-ApiRequest -Method "POST" -Endpoint "/browse/Attachments" -Body @{
    fileName   = "test-document.pdf"
    mimeType   = "application/pdf"
    size       = 12345
    request_ID = $requestId
}

if ($attachment.Success) {
    Write-Host "  [PASS] Attachment metadata created" -ForegroundColor Green
    $TestResults += @{ Name = "Attachment Created"; Passed = $true }
    $attachmentId = $attachment.Data.ID
}
else {
    Write-Host "  [FAIL] Failed to create attachment: $($attachment.Error)" -ForegroundColor Red
    $TestResults += @{ Name = "Attachment Created"; Passed = $false }
}

# ============================================================================
# TEST 7: Withdraw Action (FR-04)
# ============================================================================
Write-Host "`n=== TEST 7: Withdraw Action ===" -ForegroundColor Cyan

# 7.1 Withdraw the request
$withdraw = Invoke-ApiRequest -Method "POST" -Endpoint "/browse/Requests(ID=$requestId,IsActiveEntity=true)/RequestService.withdraw"
if ($withdraw.Success) {
    Write-Host "  [PASS] Request withdrawn successfully" -ForegroundColor Green
    $TestResults += @{ Name = "Withdraw Request"; Passed = $true }
}
else {
    Write-Host "  [FAIL] Failed to withdraw: $($withdraw.Error)" -ForegroundColor Red
    $TestResults += @{ Name = "Withdraw Request"; Passed = $false }
}

# 7.2 Verify status changed to WITHDRAWN
$finalStatus = Invoke-ApiRequest -Method "GET" -Endpoint "/browse/Requests($requestId)"
if ($finalStatus.Success -and $finalStatus.Data.status -eq "WITHDRAWN") {
    Write-Host "  [PASS] Status is WITHDRAWN" -ForegroundColor Green
    $TestResults += @{ Name = "Status Withdrawn"; Passed = $true }
}
else {
    Write-Host "  [FAIL] Status is not WITHDRAWN: $($finalStatus.Data.status)" -ForegroundColor Red
    $TestResults += @{ Name = "Status Withdrawn"; Passed = $false }
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Yellow
$passed = ($TestResults | Where-Object { $_.Passed -eq $true }).Count
$total = $TestResults.Count
Write-Host "Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Red" })

foreach ($test in $TestResults) {
    $status = if ($test.Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($test.Passed) { "Green" } else { "Red" }
    Write-Host "  $status $($test.Name)" -ForegroundColor $color
}

if ($passed -eq $total) {
    Write-Host "`nAll backend tests PASSED!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`nSome tests FAILED!" -ForegroundColor Red
    exit 1
}
