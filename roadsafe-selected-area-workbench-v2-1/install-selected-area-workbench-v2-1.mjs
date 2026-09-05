import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const MAP_FILE = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "AccidentMap.tsx",
);

const WORKBENCH_FILE = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "SelectedAreaWorkbench.tsx",
);

const AREA_SERVICE_FILE = path.join(
  ROOT,
  "src",
  "services",
  "areaAnalysisService.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(MAP_FILE)) {
  fail("src/components/map/AccidentMap.tsx was not found.");
}

if (!fs.existsSync(AREA_SERVICE_FILE)) {
  fail("src/services/areaAnalysisService.ts was not found.");
}

const workbenchPayload = path.join(
  HERE,
  "payload",
  "SelectedAreaWorkbench.tsx",
);

const areaServicePayload = path.join(
  HERE,
  "payload",
  "areaAnalysisService.ts",
);

if (
  !fs.existsSync(workbenchPayload) ||
  !fs.existsSync(areaServicePayload)
) {
  fail("Installer payload is incomplete.");
}

let source = fs.readFileSync(MAP_FILE, "utf8");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `selected-area-workbench-v2-1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [
  MAP_FILE,
  AREA_SERVICE_FILE,
  WORKBENCH_FILE,
]) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(
      file,
      path.join(
        backupDir,
        path.basename(file),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Validate all patch anchors BEFORE writing any project file.
// -----------------------------------------------------------------------------

const compactStart =
  `{selectedBounds && compactSelectionPanel && (`;

const compactEnd =
  `{selectedBounds && !compactSelectionPanel && (`;

const compactStartIndex = source.indexOf(compactStart);
const compactEndIndex =
  compactStartIndex >= 0
    ? source.indexOf(
        compactEnd,
        compactStartIndex,
      )
    : -1;

if (
  compactStartIndex < 0 ||
  compactEndIndex < 0
) {
  fail(
    "Could not locate the compact selected-area panel boundaries. No project file changed.",
  );
}

const junctionModalAnchor =
  `{selectedJunctionId && (`;

if (
  !source.includes(junctionModalAnchor)
) {
  fail(
    "Could not locate the junction-analysis modal anchor. No project file changed.",
  );
}

const areaAnalysisPattern =
  /AreaAnalysisService\.analyse\(\s*selectedBounds(?:\s*,\s*heatmapFiltersRef\.current)?\s*,?\s*\)/m;

if (
  !areaAnalysisPattern.test(source)
) {
  fail(
    "Could not locate the selected-area AreaAnalysisService call. No project file changed.",
  );
}

const analysisStatePattern =
  /const\s*\[\s*analysisError\s*,\s*setAnalysisError\s*,?\s*\]\s*=\s*useState\s*<\s*string\s*\|\s*null\s*>\s*\(\s*null\s*,?\s*\)\s*;/m;

if (
  !source.includes("selectedAreaWorkbenchOpen") &&
  !analysisStatePattern.test(source)
) {
  fail(
    "Could not identify the existing analysisError state using the format-tolerant matcher. No project file changed.",
  );
}

// -----------------------------------------------------------------------------
// Build patched source in memory.
// -----------------------------------------------------------------------------

const importLine =
  'import SelectedAreaWorkbench from "./SelectedAreaWorkbench";';

if (!source.includes(importLine)) {
  const importPattern =
    /import\s+AreaAnalysisResults\s+from\s+["']\.\/AreaAnalysisResults["'];?/;

  if (!importPattern.test(source)) {
    fail(
      "Could not locate AreaAnalysisResults import. No project file changed.",
    );
  }

  source = source.replace(
    importPattern,
    (match) =>
      `${match}\n${importLine}`,
  );
}

if (!source.includes("selectedAreaWorkbenchOpen")) {
  source = source.replace(
    analysisStatePattern,
    (match) =>
      `${match}

  const [
    selectedAreaWorkbenchOpen,
    setSelectedAreaWorkbenchOpen,
  ] = useState(false);

  useEffect(() => {
    if (!selectedBounds) {
      setSelectedAreaWorkbenchOpen(false);
    }
  }, [selectedBounds]);

  useEffect(() => {
    if (
      !selectedBounds ||
      !showAnalysis
    ) {
      return;
    }

    try {
      const refreshed =
        AreaAnalysisService.analyse(
          selectedBounds,
          heatmapFilters,
        );

      setAnalysis(refreshed);
      setAnalysisError(null);
    } catch (error) {
      console.error(
        "Selected area filter refresh failed:",
        error,
      );
    }
  }, [
    heatmapFilters,
    selectedBounds,
    showAnalysis,
  ]);`,
  );
}

// Always make manual Analyse Area use current filters.
source = source.replace(
  areaAnalysisPattern,
  `AreaAnalysisService.analyse(
            selectedBounds,
            heatmapFiltersRef.current,
          )`,
);

// Avoid accidentally duplicating the overlay on re-run.
const fullOverlayMarker =
  "Selected Area Workbench";

if (!source.includes(fullOverlayMarker)) {
  const overlay = `      {selectedAreaWorkbenchOpen &&
        selectedBounds &&
        analysis && (
          <div className="absolute inset-0 z-[70] flex min-w-0 flex-col bg-black/80 p-2 sm:p-4">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-[#494949] bg-[#202020] shadow-[0_26px_80px_rgba(0,0,0,.65)]">
              <header className="flex min-w-0 items-start justify-between gap-3 border-b border-[#494949] bg-[#303030] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
                    Spatial analysis
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-slate-100">
                    Selected Area Workbench
                  </h3>
                  <p className="mt-1 text-[8px] text-slate-500">
                    {analysis.areaSquareKilometres.toFixed(3)} km² · {analysis.totalJunctions} junction(s) · active map filters applied
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedAreaWorkbenchOpen(false)
                  }
                  className="ui-button shrink-0"
                >
                  Return to map
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 [scrollbar-color:#555555_#202020] [scrollbar-width:thin]">
                <SelectedAreaWorkbench
                  analysis={analysis}
                  bounds={selectedBounds}
                  filters={heatmapFilters}
                  onSelectAgain={() => {
                    setSelectedAreaWorkbenchOpen(false);
                    handleSelectArea();
                  }}
                />
              </div>
            </div>
          </div>
        )}

`;

  source = source.replace(
    junctionModalAnchor,
    overlay + junctionModalAnchor,
  );
}

// Replace compact panel using stable section boundaries, regardless of its internals.
const newCompact = `      {selectedBounds && compactSelectionPanel && (
        <div className="absolute bottom-3 right-3 z-20 w-[min(390px,calc(100%-24px))] overflow-hidden rounded-md border border-[#494949] bg-[#202020]/[0.97] shadow-[0_18px_42px_rgba(0,0,0,.55)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3 border-b border-[#494949] bg-[#303030] px-3 py-2.5">
            <div className="min-w-0">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-100">
                Selected area
              </h3>
              <p className="mt-0.5 truncate text-[8px] text-slate-500">
                Filter-aware spatial analysis zone
              </p>
            </div>

            <button
              type="button"
              onClick={handleCloseSelectedArea}
              className="rounded border border-[#494949] bg-[#292929] px-2 py-1 text-[8px] font-semibold text-slate-300"
            >
              Close
            </button>
          </div>

          <div className="p-3">
            {showAnalysis && analysis ? (
              <SelectedAreaWorkbench
                analysis={analysis}
                bounds={selectedBounds}
                filters={heatmapFilters}
                compact
                onExpand={() =>
                  setSelectedAreaWorkbenchOpen(true)
                }
                onClose={handleCloseSelectedArea}
                onSelectAgain={handleSelectArea}
              />
            ) : analysisError ? (
              <div className="space-y-2">
                <p className="rounded border border-[#713646] bg-[#321722] px-2.5 py-2 text-[8px] text-[#e28b9d]">
                  {analysisError}
                </p>

                <button
                  type="button"
                  onClick={handleAnalyseArea}
                  className="ui-button w-full"
                >
                  Retry analysis
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded border border-[#494949] bg-[#292929] p-2.5">
                  <p className="text-[8px] leading-4 text-slate-400">
                    Analyse this rectangle using the current date, severity,
                    weather and cause filters. RoadSafe will calculate severity,
                    casualty intensity, density, recurring causes, peak times,
                    junction risk contribution and network comparison.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSelectArea}
                    className="ui-button"
                  >
                    Select again
                  </button>

                  <button
                    type="button"
                    onClick={handleAnalyseArea}
                    className="ui-button-primary"
                  >
                    Analyse area
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

`;

const currentCompactStart = source.indexOf(compactStart);
const currentCompactEnd = source.indexOf(
  compactEnd,
  currentCompactStart,
);

source =
  source.slice(0, currentCompactStart) +
  newCompact +
  source.slice(currentCompactEnd);

// RoadSafe orange selection rectangle.
source = source
  .replace(
    /"fill-color"\s*:\s*"#2563eb"/g,
    '"fill-color": "#e8872d"',
  )
  .replace(
    /"line-color"\s*:\s*"#1d4ed8"/g,
    '"line-color": "#e8872d"',
  );

// -----------------------------------------------------------------------------
// Only now write project files.
// -----------------------------------------------------------------------------

fs.copyFileSync(
  workbenchPayload,
  WORKBENCH_FILE,
);

fs.copyFileSync(
  areaServicePayload,
  AREA_SERVICE_FILE,
);

fs.writeFileSync(
  MAP_FILE,
  source,
  "utf8",
);

console.log("\n[RoadSafe] Selected Area Workbench V2.1 installed.");
console.log("[RoadSafe] Format-tolerant state detection -> PASS");
console.log("[RoadSafe] Compact selected-area card -> upgraded");
console.log("[RoadSafe] Full Selected Area Workbench -> added");
console.log("[RoadSafe] Date/severity/weather/cause filters -> applied to area analysis");
console.log("[RoadSafe] Open analysis -> refreshes when map filters change");
console.log("[RoadSafe] CSV / coordinate / bounds / analytical brief tools -> added");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
