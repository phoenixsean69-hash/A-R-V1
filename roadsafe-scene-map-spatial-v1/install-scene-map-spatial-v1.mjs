import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const SCENE_PAGE = path.join(ROOT, "src", "pages", "SceneMapPage.tsx");
const ACCIDENT_MAP = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "AccidentMap.tsx",
);
const AREA_RESULTS = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "AreaAnalysisResults.tsx",
);
const AREA_SERVICE = path.join(
  ROOT,
  "src",
  "services",
  "areaAnalysisService.ts",
);
const SPATIAL_SERVICE = path.join(
  ROOT,
  "src",
  "services",
  "sceneMapSpatialAnalysisService.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

for (const file of [SCENE_PAGE, ACCIDENT_MAP, AREA_RESULTS, AREA_SERVICE]) {
  if (!fs.existsSync(file)) {
    fail(`Required current file missing: ${path.relative(ROOT, file)}`);
  }
}

let page = fs.readFileSync(SCENE_PAGE, "utf8");
let accidentMap = fs.readFileSync(ACCIDENT_MAP, "utf8");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `scene-map-spatial-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [SCENE_PAGE, ACCIDENT_MAP, AREA_RESULTS, AREA_SERVICE]) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}

if (fs.existsSync(SPATIAL_SERVICE)) {
  fs.copyFileSync(
    SPATIAL_SERVICE,
    path.join(backupDir, path.basename(SPATIAL_SERVICE)),
  );
}

for (const [payloadName, destination] of [
  ["sceneMapSpatialAnalysisService.ts", SPATIAL_SERVICE],
  ["areaAnalysisService.ts", AREA_SERVICE],
  ["AreaAnalysisResults.tsx", AREA_RESULTS],
]) {
  const source = path.join(HERE, "payload", payloadName);
  if (!fs.existsSync(source)) {
    fail(`Installer payload missing ${payloadName}.`);
  }
  fs.copyFileSync(source, destination);
}

// -----------------------------------------------------------------------------
// SceneMapPage: import + filtered spatial model
// -----------------------------------------------------------------------------
const junctionImport =
  'import { JunctionService } from "../services/junctionService";';

const spatialImport =
  'import { SceneMapSpatialAnalysisService } from "../services/sceneMapSpatialAnalysisService";';

if (!page.includes(spatialImport)) {
  if (!page.includes(junctionImport)) {
    fail("Could not find JunctionService import in SceneMapPage.tsx.");
  }

  page = page.replace(
    junctionImport,
    `${junctionImport}\n${spatialImport}`,
  );
}

const filteredAnchor = `  const filteredAccidents = useMemo(
    () => AccidentFilterService.filter(allAccidents, filters),
    [allAccidents, filters],
  );
`;

if (!page.includes("const spatialAnalysis = useMemo(")) {
  if (!page.includes(filteredAnchor)) {
    fail("Could not find filteredAccidents block in SceneMapPage.tsx.");
  }

  page = page.replace(
    filteredAnchor,
    `${filteredAnchor}
  const spatialAnalysis = useMemo(
    () => SceneMapSpatialAnalysisService.analyse(filteredAccidents),
    [filteredAccidents],
  );
`,
  );
}

// -----------------------------------------------------------------------------
// SceneMapPage: add deterministic spatial analysis below map/right rail
// -----------------------------------------------------------------------------
const pageTail = `        </aside>
      </div>
    </div>
  );
}
`;

if (!page.includes("Spatial pattern diagnostics")) {
  if (!page.includes(pageTail)) {
    fail("Could not locate SceneMapPage closing layout.");
  }

  const spatialPanels = `        </aside>
      </div>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[.8fr_1.2fr]">
        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">
                Spatial pattern diagnostics
              </h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Deterministic geographic findings from the current map filters
              </p>
            </div>
          </div>

          <div className="grid gap-2 border-b border-[#202020] p-3 sm:grid-cols-2">
            {[
              [
                "Top junction crash share",
                \`\${spatialAnalysis.topJunctionCrashSharePct}%\`,
                \`Top two: \${spatialAnalysis.topTwoJunctionCrashSharePct}%\`,
              ],
              [
                "Top filtered risk share",
                \`\${spatialAnalysis.topRiskContributionPct}%\`,
                "Share of weighted risk from rank #1",
              ],
              [
                "Spatial concentration",
                spatialAnalysis.concentrationLabel,
                \`Index \${spatialAnalysis.concentrationIndex.toFixed(3)}\`,
              ],
              [
                "Approx. network span",
                \`\${spatialAnalysis.approximateNetworkSpanKm.toFixed(2)} km\`,
                spatialAnalysis.approximateWeightedCentroid
                  ? \`Centroid ≈ \${spatialAnalysis.approximateWeightedCentroid.latitude.toFixed(5)}, \${spatialAnalysis.approximateWeightedCentroid.longitude.toFixed(5)}\`
                  : "No mapped crash centroid",
              ],
            ].map(([label, value, detail]) => (
              <div
                key={label}
                className="rounded-md border border-[#494949] bg-[#292929] p-3"
              >
                <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-600">
                  {label}
                </p>
                <p className="mt-2 text-[11px] font-bold text-slate-200">
                  {value}
                </p>
                <p className="mt-1 text-[7px] leading-4 text-slate-600">
                  {detail}
                </p>
              </div>
            ))}
          </div>

          <div className="divide-y divide-[#202020]">
            {spatialAnalysis.findings.map((finding) => (
              <article
                key={finding.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[78px_1fr]"
              >
                <span
                  className={\`h-fit w-fit rounded border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.06em] \${
                    finding.level === "Critical"
                      ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
                      : finding.level === "High"
                        ? "border-[#6d5523] bg-[#241d10] text-[#d9bd78]"
                        : "border-[#494949] bg-[#303030] text-slate-400"
                  }\`}
                >
                  {finding.level}
                </span>

                <div>
                  <p className="text-[9px] font-bold text-slate-300">
                    {finding.title}
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-400">
                    {finding.statement}
                  </p>
                  <p className="mt-1 text-[7px] leading-4 text-slate-600">
                    Evidence: {finding.evidence}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">
                Filtered junction contribution
              </h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Frequency, severity and weighted risk contribution in the visible analytical sample
              </p>
            </div>
          </div>

          {spatialAnalysis.junctions.length === 0 ? (
            <div className="p-4 text-[9px] text-slate-600">
              No mapped junctions contain accidents matching the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[8px]">
                <thead className="bg-[#292929] uppercase tracking-[0.07em] text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Junction</th>
                    <th className="px-3 py-2">Crash share</th>
                    <th className="px-3 py-2">Severe</th>
                    <th className="px-3 py-2">Casualties/crash</th>
                    <th className="px-3 py-2">Filtered risk</th>
                    <th className="px-3 py-2">Risk share</th>
                    <th className="px-3 py-2">Recurring cause</th>
                    <th className="px-3 py-2">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202020]">
                  {spatialAnalysis.junctions.map((row, index) => (
                    <tr key={row.junctionId}>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-300">
                          #{index + 1} · {row.name}
                        </p>
                        <p className="mt-1 text-[7px] text-slate-600">
                          {row.roadType} · {row.city}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.accidents} · {row.crashSharePct}%
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.severeRatePct}%
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.casualtiesPerAccident.toFixed(2)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={\`font-bold \${
                            row.riskLevel === "High"
                              ? "text-[#d9bd78]"
                              : "text-slate-300"
                          }\`}
                        >
                          {row.riskScore}
                        </span>
                        <p className="mt-1 text-[7px] text-slate-600">
                          {row.riskLevel}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.riskContributionPct}%
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-300">{row.topCause}</p>
                        <p className="mt-1 text-[7px] text-slate-600">
                          {row.topCauseSharePct}% · peak {row.peakTimeBand}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={\`rounded border px-1.5 py-0.5 text-[7px] font-bold \${
                            row.priority === "Immediate review"
                              ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
                              : row.priority === "Priority review"
                                ? "border-[#6d5523] bg-[#241d10] text-[#d9bd78]"
                                : "border-[#494949] bg-[#303030] text-slate-400"
                          }\`}
                        >
                          {row.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[#202020] p-3 text-[7px] leading-4 text-slate-600">
            Geographic diagnostics use mapped junction coordinates because the current accident schema stores a junction ID rather than an exact crash GPS point. Concentration and density therefore describe the monitored junction register, not road exposure.
          </div>
        </section>
      </section>
    </div>
  );
}
`;

  page = page.replace(pageTail, spatialPanels);
}

// Update the old explanatory note so its behaviour is explicit.
page = page.replace(
  `Accident filters affect the heatmap, statistics, export and
                incident list. Junction markers continue to represent the
                complete junction-risk register.`,
  `Accident filters affect the heatmap, statistics, export, incident list,
                spatial diagnostics and selected-area analysis. Junction markers
                continue to represent the complete historical junction-risk register.`,
);

// -----------------------------------------------------------------------------
// AccidentMap: selected-area analysis must use the SAME filters as the map.
// -----------------------------------------------------------------------------
const oldAnalysisCall = `          AreaAnalysisService.analyse(
            selectedBounds,
          );`;

const newAnalysisCall = `          AreaAnalysisService.analyse(
            selectedBounds,
            heatmapFiltersRef.current,
          );`;

if (!accidentMap.includes(newAnalysisCall)) {
  if (!accidentMap.includes(oldAnalysisCall)) {
    fail("Could not find selected-area analysis call in AccidentMap.tsx.");
  }

  accidentMap = accidentMap.replace(oldAnalysisCall, newAnalysisCall);
}

// Keep an already-open area analysis synchronized when filters change.
const heatmapEffectAnchor = `    setAccidentHeatmapVisibility(
      map,

      visualizationModeRef.current ===
        "heatmap",
    );
  }, [heatmapFilters]);`;

if (!accidentMap.includes("Selected-area analysis also follows the active heatmap filters.")) {
  if (!accidentMap.includes(heatmapEffectAnchor)) {
    fail("Could not find heatmap filter effect in AccidentMap.tsx.");
  }

  accidentMap = accidentMap.replace(
    heatmapEffectAnchor,
    `    setAccidentHeatmapVisibility(
      map,

      visualizationModeRef.current ===
        "heatmap",
    );

    // Selected-area analysis also follows the active heatmap filters.
    if (selectedBoundsRef.current) {
      try {
        const refreshed =
          AreaAnalysisService.analyse(
            selectedBoundsRef.current,
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
    }
  }, [heatmapFilters]);`,
  );
}

// Compact selected-area panel: use the new analytical component.
const compactStart =
  `            {showAnalysis && analysis ? (
              <>`;
const compactEnd =
  `              </>
            ) : analysisError ? (`;

if (!accidentMap.includes("<AreaAnalysisResults\n                analysis={analysis}\n                filters={heatmapFilters}\n                compact")) {
  const startIndex = accidentMap.indexOf(compactStart);
  const endIndex = startIndex >= 0
    ? accidentMap.indexOf(compactEnd, startIndex)
    : -1;

  if (startIndex < 0 || endIndex < 0) {
    fail("Could not locate compact selected-area result block.");
  }

  const compactReplacement = `            {showAnalysis && analysis ? (
              <AreaAnalysisResults
                analysis={analysis}
                filters={heatmapFilters}
                compact
              />
            ) : analysisError ? (`;

  accidentMap =
    accidentMap.slice(0, startIndex) +
    compactReplacement +
    accidentMap.slice(endIndex + compactEnd.length);
}

// Non-compact result also receives filters.
accidentMap = accidentMap.replace(
  `<AreaAnalysisResults analysis={analysis} />`,
  `<AreaAnalysisResults
                    analysis={analysis}
                    filters={heatmapFilters}
                  />`,
);

// Selection overlay colour -> RoadSafe analytical orange.
accidentMap = accidentMap
  .replace(`"fill-color":
          "#2563eb",`, `"fill-color":
          "#e8872d",`)
  .replace(`"line-color":
          "#1d4ed8",`, `"line-color":
          "#e8872d",`);

// Modernise the old non-compact modal shell if it is ever used elsewhere.
accidentMap = accidentMap
  .replace(
    `className="flex max-h-[95%] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"`,
    `className="flex max-h-[95%] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-[#494949] bg-[#202020] shadow-2xl"`,
  )
  .replace(
    `className="flex items-center justify-between gap-4 border-b border-gray-200 p-5"`,
    `className="flex items-center justify-between gap-4 border-b border-[#494949] bg-[#303030] p-5"`,
  )
  .replace(
    `className="text-xl font-semibold text-gray-900"`,
    `className="text-sm font-bold text-slate-100"`,
  )
  .replace(
    `className="text-sm text-gray-500"`,
    `className="text-[9px] text-slate-500"`,
  )
  .replace(
    `className="mt-5 rounded-xl border border-gray-200 bg-white p-5"`,
    `className="mt-4 rounded-md border border-[#494949] bg-[#202020] p-4"`,
  );

// Selected preview border follows dark UI.
accidentMap = accidentMap.replace(
  `className="h-[340px] overflow-hidden rounded-xl border border-gray-200"`,
  `className="h-[340px] overflow-hidden rounded-md border border-[#494949]"`,
);

fs.writeFileSync(SCENE_PAGE, page, "utf8");
fs.writeFileSync(ACCIDENT_MAP, accidentMap, "utf8");

console.log("\n[RoadSafe] Scene Map Spatial Intelligence V1 installed.");
console.log("[RoadSafe] Selected-area analysis now uses the SAME active map filters.");
console.log("[RoadSafe] Added filtered spatial concentration and junction contribution diagnostics.");
console.log("[RoadSafe] Added selected-area severity, casualty, cause, time and density analysis.");
console.log("[RoadSafe] Added explicit spatial-data limitations for junction-level accident locations.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
