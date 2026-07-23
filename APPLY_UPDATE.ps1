$ErrorActionPreference = "Stop"
Write-Host "Applying RoadSafe total-smooth playback and 3D camera preservation..." -ForegroundColor Cyan
node "$PSScriptRoot\apply-update.mjs"
if ($LASTEXITCODE -ne 0) {
  throw "The RoadSafe update did not complete."
}
Write-Host "Update applied. Keep npm run dev running; Vite should refresh automatically." -ForegroundColor Green
