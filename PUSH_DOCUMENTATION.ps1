param(
    [string]$CommitMessage = "Add RoadSafe AR documentation"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    Write-Error "Run this script from the root of the A-R-V1 repository."
}

if (-not (Test-Path "README.md")) {
    Write-Error "README.md was not found. Extract this update into the repository root first."
}

git add README.md docs/PROGRESS_REPORT.md
git commit -m $CommitMessage
git push origin main

Write-Host "RoadSafe AR documentation pushed successfully." -ForegroundColor Green
