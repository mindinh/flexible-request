$ErrorActionPreference = "Stop"
Start-Sleep -Seconds 5 # Wait for server to boot

$base = "http://localhost:4004/browse"

try {
   # 1. Create Request (Draft)
   Write-Host "Creating Request..."
   $body = @{ title = "Auto Test Plant"; requestType_ID = "RT_NEW_PLANT" } | ConvertTo-Json
   $req = Invoke-RestMethod -Uri "$base/Requests" -Method Post -Body $body -ContentType "application/json"
   Write-Host "Created Request (Draft): $($req.ID)"

   # 1.5 Activate Draft
   Write-Host "Activating Request..."
   $activeReq = Invoke-RestMethod -Uri "$base/Requests(ID=$($req.ID),IsActiveEntity=false)/RequestService.draftActivate" -Method Post -ContentType "application/json" -Body "{}"
   Write-Host "Activated Request: $($activeReq.ID)"

   # 2. Submit (Active)
   Write-Host "Submitting Request..."
   Invoke-RestMethod -Uri "$base/Requests(ID=$($activeReq.ID),IsActiveEntity=true)/RequestService.submit" -Method Post -ContentType "application/json" -Body "{}"
   Write-Host "Submitted Request."

   # 3. Check Steps
   Write-Host "Verifying Steps..."
   $steps = Invoke-RestMethod -Uri "$base/Steps?`$filter=request_ID eq '$($req.ID)'" -Method Get
   Write-Host "Found $($steps.value.Count) steps."
   $steps.value | ForEach-Object { Write-Host " - Step Status: $($_.status)" }

   # 4. Check API Response Structure
   if ($steps.value.Count -eq 0) {
      Write-Error "Verification Failed: No steps created after submit."
   }
   else {
      Write-Host "Verification PASSED!"
   }

}
catch {
   Write-Error "Test Failed: $_"
}
