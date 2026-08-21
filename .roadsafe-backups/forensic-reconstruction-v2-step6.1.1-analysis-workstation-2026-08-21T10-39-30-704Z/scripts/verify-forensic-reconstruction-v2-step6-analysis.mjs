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
    throw new Error(`Missing Step 6 file: ${file}`);
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
  ["Investigation stores analysis findings", types.includes("analysisFindings: ForensicAnalysisFinding[]")],
  ["Analysis categories exist", types.includes("ANALYSIS_CATEGORY_OPTIONS")],
  ["Analysis methods exist", types.includes("ANALYSIS_METHOD_OPTIONS")],
  ["Analysis statuses exist", types.includes("ANALYSIS_STATUS_OPTIONS")],
  ["Analysis limitations exist", types.includes("ANALYSIS_LIMITATION_OPTIONS")],
  ["Analysis follow-up options exist", types.includes("ANALYSIS_FOLLOW_UP_OPTIONS")],
  ["Old records migrate analysis findings", service.includes("analysisFindings: Array.isArray(record.analysisFindings)")],
  ["New cases initialise analysis findings", service.includes("analysisFindings: []")],
  ["Analysis add service exists", service.includes("addAnalysisFinding(")],
  ["Analysis delete service exists", service.includes("deleteAnalysisFinding(")],
  ["Evidence deletion cleans analysis links", service.includes("sourceEvidenceIds: finding.sourceEvidenceIds.filter")],
  ["Measurement deletion cleans analysis links", service.includes("sourceMeasurementIds: finding.sourceMeasurementIds.filter")],
  ["Vehicle deletion cleans analysis links", service.includes("sourceVehicleIds: finding.sourceVehicleIds.filter")],
  ["Person deletion cleans analysis links", service.includes("sourcePersonIds: finding.sourcePersonIds.filter")],
  ["Witness deletion cleans analysis links", service.includes("sourceWitnessIds: finding.sourceWitnessIds.filter")],
  ["Consistency scanner exists", rules.includes("buildForensicAnalysisSignals")],
  ["Owner is not treated as confirmed driver", rules.includes("Registered ownership alone is not treated as driver confirmation")],
  ["Witness conflicts are surfaced", rules.includes('assessmentStatus.startsWith("Conflicts")')],
  ["Analysis is active", activeBlock.includes('"Analysis"')],
  ["Analysis section is rendered", workspace.includes('section === "Analysis"')],
  ["Automatic consistency scan is visible", workspace.includes("Automatic consistency scan")],
  ["Scene intake can be analysis basis", workspace.includes("Include recorded scene conditions / layout")],
  ["Evidence can be linked", workspace.includes("Supporting physical evidence")],
  ["Measurements can be linked", workspace.includes("Supporting measurements / calculations")],
  ["Vehicles can be linked", workspace.includes("Vehicle examination sources")],
  ["Persons can be linked", workspace.includes("Person / driver sources")],
  ["Witnesses can be linked", workspace.includes("Witness statement sources")],
  ["Analysis requires a source basis", workspace.includes("Link at least one source or include the scene intake")],
  ["Analysis register exists", workspace.includes("Analysis register")],
  ["Legal-guilt disclaimer exists", workspace.includes("does not declare legal guilt")],
  ["Analysis CSS exists", css.includes(".fv2-analysis-signal-grid") && css.includes(".fv2-analysis-limitations")],
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
  throw new Error(`Step 6 Analysis verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Step 6 Analysis verification passed (${checks.length}/${checks.length}).`);
