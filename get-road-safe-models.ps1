$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "RoadSafe AR - model intake V2" -ForegroundColor Cyan
Write-Host "This downloads source model packs only; it does not change app code." -ForegroundColor DarkGray
Write-Host ""

node .\get-road-safe-models.mjs @args
