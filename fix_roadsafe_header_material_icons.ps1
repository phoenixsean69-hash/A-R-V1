param(
    [string]$Repo = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor DarkGray
Write-Host " ROADSAFE - FIX BROKEN HEADER MATERIAL ICONS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor DarkGray
Write-Host ""

$src = Join-Path $Repo "src"

if (-not (Test-Path $src)) {
    throw "Could not find '$src'. Run this script from the A-R-V1 repo root, or pass -Repo <path>."
}

$cssFiles = Get-ChildItem -Path $src -Recurse -File -Filter "*.css"

if (-not $cssFiles) {
    throw "No CSS files found under '$src'."
}

$changedFiles = @()
$totalReplacements = 0

foreach ($file in $cssFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    $original = $content
    $countForFile = 0

    # Material icons are <span class="material-symbols-outlined roadsafe-material-icon">.
    # Legacy selectors assumed the icon was an SVG, so "> span" accidentally matches
    # BOTH the icon and the real text/badge span.

    $patterns = @(
        @{
            Old = ".roadsafe-notification-button > span {"
            New = ".roadsafe-notification-button > span:not(.roadsafe-material-icon) {"
        },
        @{
            Old = ".roadsafe-inspector-toggle > span,"
            New = ".roadsafe-inspector-toggle > span:not(.roadsafe-material-icon),"
        },
        @{
            Old = ".roadsafe-inspector-toggle > span {"
            New = ".roadsafe-inspector-toggle > span:not(.roadsafe-material-icon) {"
        },
        @{
            Old = ".roadsafe-inspector-toggle svg:last-child {"
            New = ".roadsafe-inspector-toggle > .roadsafe-material-icon:last-child {"
        }
    )

    foreach ($pair in $patterns) {
        $occurrences = ([regex]::Matches(
            $content,
            [regex]::Escape($pair.Old)
        )).Count

        if ($occurrences -gt 0) {
            $content = $content.Replace($pair.Old, $pair.New)
            $countForFile += $occurrences
            $totalReplacements += $occurrences
        }
    }

    if ($content -ne $original) {
        $backup = "$($file.FullName).before-header-material-icon-fix"
        if (-not (Test-Path $backup)) {
            Copy-Item -LiteralPath $file.FullName -Destination $backup
        }

        # UTF-8 without BOM keeps Vite/TS tooling happy.
        [System.IO.File]::WriteAllText(
            $file.FullName,
            $content,
            [System.Text.UTF8Encoding]::new($false)
        )

        $changedFiles += [pscustomobject]@{
            File = $file.FullName.Substring($Repo.Length).TrimStart("\")
            Replacements = $countForFile
            Backup = $backup
        }
    }
}

Write-Host ""
if ($changedFiles.Count -eq 0) {
    Write-Host "[INFO] No unsafe legacy selectors were found." -ForegroundColor Yellow
    Write-Host "       Your local checkout may already contain the fix." -ForegroundColor Yellow
} else {
    foreach ($entry in $changedFiles) {
        Write-Host "[OK] $($entry.File)  ($($entry.Replacements) replacement(s))" -ForegroundColor Green
        Write-Host "     backup: $($entry.Backup)" -ForegroundColor DarkGray
    }
}

# Verify the exact broken selectors are gone from active CSS.
$remaining = @()

foreach ($file in (Get-ChildItem -Path $src -Recurse -File -Filter "*.css")) {
    $text = Get-Content -LiteralPath $file.FullName -Raw

    if ($text.Contains(".roadsafe-notification-button > span {")) {
        $remaining += "$($file.FullName): notification selector still matches the Material icon"
    }

    if ($text.Contains(".roadsafe-inspector-toggle > span,") -or
        $text.Contains(".roadsafe-inspector-toggle > span {")) {
        $remaining += "$($file.FullName): inspector selector still matches Material icon spans"
    }

    if ($text.Contains(".roadsafe-inspector-toggle svg:last-child {")) {
        $remaining += "$($file.FullName): inspector still targets the old SVG icon"
    }
}

Write-Host ""
if ($remaining.Count -gt 0) {
    Write-Host "[WARNING] Unsafe selectors remain:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    exit 2
}

Write-Host "[OK] Header selector audit passed." -ForegroundColor Green
Write-Host "[OK] Total replacements: $totalReplacements" -ForegroundColor Green
Write-Host ""
Write-Host "The actual bug was:" -ForegroundColor Cyan
Write-Host "  Material icons are SPANs now, but old CSS treated every direct SPAN" -ForegroundColor Gray
Write-Host "  as the notification badge / Inspector label. That turned the Bell" -ForegroundColor Gray
Write-Host "  itself into the orange bubble and broke the Inspector icon layout." -ForegroundColor Gray
Write-Host ""
Write-Host "Now restart Vite:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Then hard refresh the browser: Ctrl + Shift + R" -ForegroundColor White
