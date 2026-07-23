$ErrorActionPreference = "Stop"

$paths = @(
  "src/hooks/useMapProviderPreference.ts",
  "src/components/fieldPlacement/OpenFieldPlacementMap.tsx",
  "src/components/cases/OpenRoadLocationMap.tsx",
  "src/components/reconstruction/OpenReconstructionBasemap.tsx",
  "node_modules/maplibre-gl",
  "node_modules/@maplibre"
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
    Write-Host "Removed $path"
  }
}

Write-Host "Legacy map files removed. Run npm install, then npm run dev."
