$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Applying RoadSafe case wizard and Real Scene V2 update..." -ForegroundColor Cyan
node ".\apply-update.mjs"

if ($LASTEXITCODE -ne 0) {
  throw "The RoadSafe update did not complete."
}

Write-Host ""
Write-Host "Done. Keep npm run dev running and refresh /cases/new." -ForegroundColor Green
