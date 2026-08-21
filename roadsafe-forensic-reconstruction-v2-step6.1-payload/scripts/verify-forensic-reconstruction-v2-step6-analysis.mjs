import fs from "node:fs";

const paths = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  rules: "src/features/forensicReconstruction/forensicAnalysisRules.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(paths)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Step 6.1 file: ${file}`);
  }
}

const types = fs.readFileSync(paths.types, "utf8");
const service = fs.readFileSync(paths.service, "utf8");
const rules = fs.readFileSync(paths.rules, "utf8");
const workspace = fs.readFileSync(paths.workspace, "utf8");
const css = fs.readFileSync(paths.css, "utf8");

const activeBlock =
  workspace.match(/const ACTIVE = new Set<Section>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";

const checks = [
  ["Analysis finding type exists", types.includes("interface ForensicAnalysisFinding")],
  ["Analysis service add exists", service.includes("addAnalysisFinding(")],
  ["Consistency scanner exists", rules.includes("buildForensicAnalysisSignals")],
  ["Analysis is active", activeBlock.includes('"Analysis"')],
  ["Analysis workstation section renders", workspace.includes("Forensic analysis workstation")],
  ["Evidence relationship map renders", workspace.includes("Evidence relationship map")],
  ["Consistency matrix renders", workspace.includes("Consistency matrix")],
  ["Timeline renders", workspace.includes("Event & evidence timeline")],
  ["Finding composer renders", workspace.includes("Finding composer")],
  ["Support sets render", workspace.includes("Support sets")],
  ["Analysis register renders", workspace.includes("Analysis register")],
  ["Legal-guilt disclaimer exists", workspace.includes("does not declare legal guilt")],
  ["Analysis source linkage count exists", workspace.includes("linked source(s)")],
  ["Analysis still requires a source basis", workspace.includes("Link at least one source or include the scene intake")],
  ["CSS includes workstation layout", css.includes(".fv2-analysis-layout") && css.includes(".fv2-analysis-linkmap") && css.includes(".fv2-analysis-source-group")],
  ["CSS has no literal escaped-newline corruption", !css.includes("\\n.fv2-")],
];

let failed = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`[OK] ${label}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failed) {
  throw new Error(`Step 6.1 Analysis Workstation verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Step 6.1 Analysis Workstation verification passed (${checks.length}/${checks.length}).`);
