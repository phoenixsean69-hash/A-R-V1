$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Applying RoadSafe selected-area real scene engine..." -ForegroundColor Cyan
node ".\apply-update.mjs"

if ($LASTEXITCODE -ne 0) {
  throw "The RoadSafe real-scene update did not complete."
}

Write-Host ""
Write-Host "Done. Keep npm run dev running and refresh the page." -ForegroundColor Green
