$ErrorActionPreference = "Stop"

Write-Host "Applying RoadSafe smooth playback and 3D inspector update..." -ForegroundColor Cyan
node "$PSScriptRoot/apply-update.mjs"

if ($LASTEXITCODE -ne 0) {
  throw "The RoadSafe update did not complete. Read the error above."
}

Write-Host "Done. Keep npm run dev running and refresh the page." -ForegroundColor Green
