import fs from "node:fs";

const paths = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(paths)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Step 5 file: ${file}`);
  }
}

const types = fs.readFileSync(paths.types, "utf8");
const service = fs.readFileSync(paths.service, "utf8");
const workspace = fs.readFileSync(paths.workspace, "utf8");
const css = fs.readFileSync(paths.css, "utf8");

const checks = [
  ["Witness record type exists", types.includes("export interface ForensicWitnessRecord")],
  ["Investigation stores witnesses", types.includes("witnesses: ForensicWitnessRecord[]")],
  ["Old records normalize missing witnesses", service.includes("witnesses: Array.isArray(record.witnesses)")],
  ["New cases start with empty witnesses", service.includes("witnesses: []")],
  ["Witness add service exists", service.includes("addWitness(") && service.includes("code: `W-${String(investigation.witnesses.length + 1)")],
  ["Witness delete service exists", service.includes("deleteWitness(")],
  ["Deleting a person clears witness person links", service.includes("witness.linkedPersonId === personId")],
  ["Witnesses section is active", workspace.includes('"Witnesses",\n]);') || workspace.includes('"Witnesses",\r\n]);')],
  ["Witnesses sidebar shows Step 5", workspace.includes('item === "Witnesses"') && workspace.includes('"Step 5"')],
  ["Witness intake preserves reported-account warning", workspace.includes("A witness account is evidence, but it is not automatically established fact")],
  ["Witness dropdown/manual helper exists", workspace.includes("const witnessChoiceField = (") && workspace.includes("manualWitnessChoices")],
  ["Witness statement method choices exist", types.includes("WITNESS_STATEMENT_METHOD_OPTIONS")],
  ["Observation coverage choices exist", types.includes("WITNESS_OBSERVATION_COVERAGE_OPTIONS")],
  ["Viewing condition choices exist", types.includes("WITNESS_VIEW_CONDITION_OPTIONS")],
  ["Observation topics are structured", types.includes("WITNESS_OBSERVATION_TOPIC_OPTIONS") && workspace.includes("fv2-witness-topic-grid")],
  ["Witness can link to an involved person", types.includes("linkedPersonId?: string") && workspace.includes("Link to involved person (optional)")],
  ["Witness position can be measured", workspace.includes("Witness position from fixed reference (optional)") && types.includes("spatialPosition?: ForensicSpatialPosition")],
  ["Witness statement summary is required", workspace.includes("Record a concise summary of what the witness reported")],
  ["Physical evidence can be linked", workspace.includes("Link supporting / conflicting physical evidence")],
  ["Evidence-consistency assessment exists", types.includes("WITNESS_ASSESSMENT_STATUS_OPTIONS") && workspace.includes("Initial evidence-consistency assessment")],
  ["Witness provenance remains Witness Reported", types.includes('provenance: "Witness Reported"') && workspace.includes('provenance: "Witness Reported"')],
  ["Witness register exists", workspace.includes("Witness statement register") && workspace.includes("investigation.witnesses.map")],
  ["Witness CSS exists", css.includes(".fv2-witness-note") && css.includes(".fv2-witness-topic-grid")],
  ["CSS contains no literal escaped-newline corruption", !css.includes("\\n.fv2-")],
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
  throw new Error(`Step 5 witness verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Step 5 witness verification passed (${checks.length}/${checks.length}).`);
