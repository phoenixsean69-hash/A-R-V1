# ==============================================================
# A-R-V1 — ALL FIXES AND EDITS
# ==============================================================
#
# MASTER PATCH SCRIPT
#
# Repository:
#   phoenixsean69-hash/A-R-V1
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\all_fixes_and_edits.ps1
#
# Add/change future fixes inside the numbered sections below.
# Each fix should:
#   1. Locate its target safely.
#   2. Create a timestamped backup before changing anything.
#   3. Refuse to make changes if the expected source is not found.
#   4. Avoid duplicate edits.
#
# ==============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " A-R-V1 - ALL FIXES AND EDITS" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------------------
# REPOSITORY CHECK
# --------------------------------------------------------------

$repoRoot = (Get-Location).Path
$gitDir = Join-Path $repoRoot ".git"

if (-not (Test-Path $gitDir)) {
    Write-Host "[ERROR] .git was not found." -ForegroundColor Red
    Write-Host "        Run this script from the A-R-V1 repository root." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Repository root:" -ForegroundColor Green
Write-Host "     $repoRoot"
Write-Host ""

# --------------------------------------------------------------
# SHARED HELPERS
# --------------------------------------------------------------

function New-TimestampedBackup {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath
    )

    $directory = Split-Path -Parent $FilePath
    $name = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $extension = [System.IO.Path]::GetExtension($FilePath)
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

    $backupPath = Join-Path `
        $directory `
        "$name.before_all_fixes-$timestamp$extension"

    Copy-Item -LiteralPath $FilePath -Destination $backupPath -Force

    Write-Host "[BACKUP] $backupPath" -ForegroundColor DarkGray

    return $backupPath
}

function Find-CssFileContaining {
    param(
        [Parameter(Mandatory=$true)]
        [string[]]$RequiredStrings
    )

    $cssFiles = Get-ChildItem `
        -Path $repoRoot `
        -Recurse `
        -File `
        -Filter "*.css" `
        -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\dist\\" -and
            $_.FullName -notmatch "\\build\\"
        }

    foreach ($file in $cssFiles) {
        try {
            $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        }
        catch {
            continue
        }

        $matchesAll = $true

        foreach ($required in $RequiredStrings) {
            if (-not $content.Contains($required)) {
                $matchesAll = $false
                break
            }
        }

        if ($matchesAll) {
            return $file
        }
    }

    return $null
}

function Write-Section {
    param(
        [string]$Number,
        [string]$Title
    )

    Write-Host ""
    Write-Host "--------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "[$Number] $Title" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------" -ForegroundColor Cyan
}

# ==============================================================
# FIX 01 — TOP BAR SIZING / NOTIFICATION CLIPPING
# ==============================================================

Write-Section "01" "TOP BAR SIZING / NOTIFICATION CLIPPING"

Write-Host "[SEARCH] Locating top-bar stylesheet..." -ForegroundColor Yellow

$topbarFile = Find-CssFileContaining @(
    ".roadsafe-workspace-header-right",
    ".roadsafe-notification-button"
)

if ($null -eq $topbarFile) {
    Write-Host "[ERROR] Top-bar stylesheet could not be located." -ForegroundColor Red
    Write-Host "        FIX 01 was NOT applied." -ForegroundColor Yellow
}
else {

    Write-Host "[OK] Found:" -ForegroundColor Green
    Write-Host "     $($topbarFile.FullName)"

    $content = Get-Content `
        -LiteralPath $topbarFile.FullName `
        -Raw `
        -Encoding UTF8

    $marker = "/* A-R-V1 TOPBAR FIX - 2026 */"

    if ($content.Contains($marker)) {

        Write-Host "[SKIP] Top-bar fix already exists." -ForegroundColor Yellow

    }
    else {

        $backup = New-TimestampedBackup -FilePath $topbarFile.FullName

        $topbarFix = @'

/* ==============================================================
 * A-R-V1 TOPBAR FIX - 2026
 *
 * Fixes:
 * - inconsistent right-side header sizing
 * - notification icon/badge clipping
 * - excessive flex pressure
 * - clock squeezing
 * - Inspector chip squeezing
 * - Administrator profile squeezing
 * ============================================================== */

.roadsafe-workspace-header-right {
  flex: 0 1 auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  gap: 6px !important;
  overflow: visible !important;
  align-items: center !important;
}

/* Keep icon controls physically consistent. */
.roadsafe-workspace-header-right .roadsafe-icon-button,
.roadsafe-workspace-header-right .roadsafe-notification-button,
.roadsafe-workspace-header-right > button {
  flex: 0 0 36px !important;
  width: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  box-sizing: border-box !important;
}

/* Notification badge must be allowed to extend outside the button. */
.roadsafe-notification-button {
  position: relative !important;
  overflow: visible !important;
}

/* Prevent notification badge clipping. */
.roadsafe-notification-button > span {
  top: -2px !important;
  right: -2px !important;
  z-index: 20 !important;
  transform: none !important;
}

/* Clock gets a stable compact width. */
.roadsafe-header-clock {
  flex: 0 1 76px !important;
  width: 76px !important;
  min-width: 76px !important;
  max-width: 76px !important;
  padding-left: 8px !important;
  padding-right: 8px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}

/* Inspector/current-case content can shrink cleanly. */
.roadsafe-active-case-chip {
  flex: 0 1 auto !important;
  min-width: 0 !important;
  max-width: 190px !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.roadsafe-active-case-chip strong,
.roadsafe-active-case-chip small,
.roadsafe-active-case-chip span {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

/* Administrator profile stays intact but can shrink its text. */
.roadsafe-profile-menu {
  flex: 0 1 auto !important;
  min-width: 0 !important;
  max-width: 190px !important;
}

.roadsafe-profile-trigger {
  min-width: 0 !important;
  max-width: 190px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}

.roadsafe-profile-copy {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
}

.roadsafe-profile-copy strong,
.roadsafe-profile-copy small {
  display: block !important;
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

/* Medium widths. */
@media (max-width: 900px) {

  .roadsafe-workspace-header-right {
    gap: 5px !important;
  }

  .roadsafe-header-clock {
    width: 72px !important;
    min-width: 72px !important;
    max-width: 72px !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
  }

  .roadsafe-active-case-chip {
    max-width: 165px !important;
  }

  .roadsafe-profile-menu,
  .roadsafe-profile-trigger {
    max-width: 175px !important;
  }
}

/* Narrow widths. */
@media (max-width: 760px) {

  .roadsafe-workspace-header-right {
    gap: 4px !important;
  }

  .roadsafe-header-clock {
    width: 68px !important;
    min-width: 68px !important;
    max-width: 68px !important;
  }

  .roadsafe-active-case-chip {
    max-width: 145px !important;
  }

  .roadsafe-profile-menu,
  .roadsafe-profile-trigger {
    max-width: 160px !important;
  }
}

/* Very narrow widths. */
@media (max-width: 620px) {

  .roadsafe-workspace-header-right {
    gap: 3px !important;
  }

  .roadsafe-header-clock {
    width: 62px !important;
    min-width: 62px !important;
    max-width: 62px !important;
  }

  .roadsafe-active-case-chip {
    max-width: 120px !important;
  }

  .roadsafe-profile-menu,
  .roadsafe-profile-trigger {
    max-width: 145px !important;
  }
}

'@

        $newContent = $content.TrimEnd() + "`r`n`r`n" + $topbarFix.TrimStart()

        Set-Content `
            -LiteralPath $topbarFile.FullName `
            -Value $newContent `
            -Encoding UTF8

        Write-Host "[OK] FIX 01 applied." -ForegroundColor Green
    }
}

# ==============================================================
# FUTURE FIXES GO BELOW THIS LINE
# ==============================================================
#
# IMPORTANT:
#
# When we discover another bug, DO NOT create another .ps1 file.
#
# Instead we will add:
#
#   FIX 02 — <description>
#   FIX 03 — <description>
#   FIX 04 — <description>
#
# to THIS file.
#
# Each fix gets:
#   - its own section
#   - its own marker
#   - source detection
#   - backup
#   - duplicate protection
#   - verification
#
# ==============================================================

# ==============================================================
# FINAL SUMMARY
# ==============================================================

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host " ALL FIXES AND EDITS FINISHED" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Master script:" -ForegroundColor White
Write-Host "  all_fixes_and_edits.ps1"
Write-Host ""
Write-Host "Future fixes will be added to this same file." -ForegroundColor Cyan
Write-Host ""
Write-Host "Refresh the application after running the script." -ForegroundColor Yellow
Write-Host ""
