# UAT Deployment Script - Windows
# Prepares and deploys the application to the UAT space

Write-Host "=========================================="
Write-Host "  Starting UAT Deployment Preparation"
Write-Host "=========================================="

# 1. Clean previous builds
if (Test-Path "gen") {
    Write-Host "Cleaning previous build artifacts..."
    Remove-Item -Path "gen" -Recurse -Force
}
if (Test-Path "mta_archives") {
    Remove-Item -Path "mta_archives" -Recurse -Force
}

# 2. Build for production
Write-Host "Building project for production..."
& npm ci
& npx cds build --production

# 3. Build MTA archive
Write-Host "Building MTA archive..."
& mbt build -t gen --mtar flexible-request-management.mtar

# 4. Deployment Instructions
Write-Host "`n=========================================="
Write-Host "  Build Complete!"
Write-Host "=========================================="
Write-Host "To deploy to UAT, ensure you are logged in to the UAT space:"
Write-Host "  cf login -a <api-endpoint>"
Write-Host "  cf target -o <org> -s <uat-space>"
Write-Host "`nThen run:"
Write-Host "  cf deploy gen/flexible-request-management.mtar"
Write-Host "==========================================`n"
