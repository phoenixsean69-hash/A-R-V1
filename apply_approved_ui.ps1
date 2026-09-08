param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor DarkGray
Write-Host " SOVEREIGN - APPROVED 3-SCREEN UI INSTALLER" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor DarkGray
Write-Host ""

$projectRoot = (Resolve-Path $ProjectRoot).Path
$sourceMain = Join-Path $PSScriptRoot "src\main.cpp"
$targetMain = Join-Path $projectRoot "src\main.cpp"

if (-not (Test-Path $sourceMain)) {
    throw "Package is missing src\main.cpp"
}

if (-not (Test-Path (Join-Path $projectRoot "src"))) {
    throw "Could not find '$projectRoot\src'. Run this from the project root."
}

if (-not (Test-Path $targetMain)) {
    throw "Could not find '$targetMain'."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $projectRoot "src\main.cpp.before-approved-ui-$timestamp.bak"

Copy-Item $targetMain $backup -Force
Write-Host "[OK] Backup created:" -ForegroundColor Green
Write-Host "     $backup"

Copy-Item $sourceMain $targetMain -Force
Write-Host "[OK] Installed approved Case View / Evidence / Analysis UI." -ForegroundColor Green
Write-Host "[OK] Main branch / GitHub were not touched." -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Rebuild the project."
Write-Host "  2. Run it."
Write-Host "  3. Send screenshots of Case View, Evidence and Analysis."
Write-Host ""
Write-Host "Manual restore command:" -ForegroundColor DarkGray
Write-Host "  Copy-Item `"$backup`" `"$targetMain`" -Force"
Write-Host ""
