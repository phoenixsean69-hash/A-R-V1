import fs from "node:fs";

const required = [
  "src/pages/CaseReconstructionPage.tsx",
  "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  "src/features/forensicReconstruction/forensicInvestigationService.ts",
  "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing: ${file}`);
}

const page = fs.readFileSync(required[0], "utf8");
const types = fs.readFileSync(required[1], "utf8");
const service = fs.readFileSync(required[2], "utf8");
const workspace = fs.readFileSync(required[3], "utf8");

const checks = [
  ["V1 editor is no longer mounted", !page.includes("AccidentReconstructionEditor")],
  ["V2 workspace is mounted", page.includes("ForensicInvestigationWorkspace")],
  ["Forensic root model exists", types.includes("ForensicAccidentInvestigation")],
  ["Observed/measured provenance exists", types.includes('"Observed"') && types.includes('"Measured"')],
  ["AI/assumption/simulation provenance is separated", types.includes('"AI Derived"') && types.includes('"Investigator Assumption"') && types.includes('"Simulated"')],
  ["Scene intake is active", workspace.includes('"Scene Intake"')],
  ["Evidence registry is active", workspace.includes('"Evidence Registry"')],
  ["Later 2D/3D/AR is deferred", workspace.includes('"2D / 3D / AR"')],
  ["V2 storage is isolated", service.includes("roadsafe-forensic-investigations-v2")],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAILED: ${label}`);
  console.log(`[OK] ${label}`);
}

console.log("\n[RoadSafe] Forensic Reconstruction V2 Step 1 verification passed.");
