import fs from "node:fs";

const files = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Step 2 file: ${file}`);
  }
}

const types = fs.readFileSync(files.types, "utf8");
const service = fs.readFileSync(files.service, "utf8");
const workspace = fs.readFileSync(files.workspace, "utf8");
const css = fs.readFileSync(files.css, "utf8");

const checks = [
  ["Measurements is active", /const ACTIVE[\s\S]*"Measurements"/m.test(workspace)],
  ["Evidence spatial position exists", types.includes("spatialPosition?: ForensicSpatialPosition")],
  ["Spatial X/Y are in metres", types.includes("xMetres: number") && types.includes("yMetres: number")],
  ["Scene datum field exists", types.includes("sceneDatumLabel: string") && workspace.includes("Scene datum / fixed reference")],
  ["Coordinate convention exists", types.includes("coordinateNotes: string") && workspace.includes("Coordinate convention")],
  ["Evidence captures X", workspace.includes("X (m)")],
  ["Evidence captures Y", workspace.includes("Y (m)")],
  ["Evidence captures accuracy", workspace.includes("Accuracy ± m")],
  ["Measurement categories exist", types.includes('"Skid / Scuff"') && types.includes('"Debris Field"') && types.includes('"Damage Height"')],
  ["Measurement method is stored", types.includes("method: string")],
  ["Measurement evidence links exist", types.includes("sourceEvidenceIds: string[]") && workspace.includes("Link supporting evidence")],
  ["Measurement provenance restricted", types.includes('provenance: "Measured" | "Calculated" | "Imported"')],
  ["Service adds measurements", service.includes("addMeasurement(")],
  ["Service deletes measurements", service.includes("deleteMeasurement(")],
  ["Legacy Step 1 data is normalised", service.includes("function normalise(") && service.includes('sceneDatumLabel: record.scene?.sceneDatumLabel ?? ""')],
  ["Spatial plan exists", workspace.includes("Spatial evidence plan") && workspace.includes('aria-label="Local forensic evidence position plan"')],
  ["Datum is plotted", workspace.includes("DATUM 0,0")],
  ["Evidence codes are plotted", workspace.includes("positionedEvidence.map") && workspace.includes("{record.code}")],
  ["Step 2 plan CSS exists", css.includes(".fv2-plan") && css.includes(".fv2-coordinates")],
];

let failures = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`[OK] ${label}`);
  else {
    failures += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failures) {
  throw new Error(`Step 2 verification failed: ${failures} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Forensic Reconstruction V2 Step 2 verification passed (${checks.length}/${checks.length} checks).`);
