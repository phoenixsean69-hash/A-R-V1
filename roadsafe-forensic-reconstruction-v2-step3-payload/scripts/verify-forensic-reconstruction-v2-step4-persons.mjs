import fs from "node:fs";

const files = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Step 4 file: ${file}`);
  }
}

const types = fs.readFileSync(files.types, "utf8");
const service = fs.readFileSync(files.service, "utf8");
const workspace = fs.readFileSync(files.workspace, "utf8");
const css = fs.readFileSync(files.css, "utf8");

const activeStart = workspace.indexOf("const ACTIVE = new Set<Section>([");
const activeEnd = workspace.indexOf("]);", activeStart);
const activeBlock =
  activeStart >= 0 && activeEnd >= 0
    ? workspace.slice(activeStart, activeEnd + 3)
    : "";

const checks = [
  ["Persons is active in the workspace", activeBlock.includes('"Persons"')],
  ["Forensic person record type exists", types.includes("export interface ForensicPersonRecord")],
  ["Investigation root stores persons", types.includes("persons: ForensicPersonRecord[]")],
  ["Existing investigations migrate persons safely", service.includes("persons: Array.isArray(record.persons)")],
  ["New investigations start with empty persons", service.includes("persons: []")],
  ["Service can add persons", service.includes("addPerson(")],
  ["Service can delete persons", service.includes("deletePerson(")],
  ["Deleting a vehicle unlinks persons instead of deleting them", service.includes("person.linkedVehicleId === vehicleId")],
  ["Person form separates physically involved people from witnesses", workspace.includes("A person who only witnessed the crash belongs in Witnesses instead")],
  ["Person role is dropdown plus manual", workspace.includes("How this person was involved") && workspace.includes("PERSON_INVOLVEMENT_OPTIONS") && workspace.includes("Other / specify manually")],
  ["Person found location is dropdown plus manual", workspace.includes("Where the person was found after the crash") && workspace.includes("PERSON_FOUND_LOCATION_OPTIONS")],
  ["Body position is dropdown plus manual", workspace.includes("Body position when recorded") && workspace.includes("PERSON_BODY_POSITION_OPTIONS")],
  ["Observed condition is dropdown plus manual", workspace.includes("Condition when first recorded") && workspace.includes("PERSON_OBSERVED_CONDITION_OPTIONS")],
  ["Protection is dropdown plus manual", workspace.includes("Protection / restraint observed") && workspace.includes("PERSON_PROTECTION_OPTIONS")],
  ["Next action is dropdown plus manual", workspace.includes("What happened next") && workspace.includes("PERSON_NEXT_ACTION_OPTIONS")],
  ["Person can link to examined vehicle", workspace.includes("Linked vehicle") && workspace.includes("personLinkedVehicleId")],
  ["Person can store scene coordinates", types.includes("spatialPosition?: ForensicSpatialPosition") && workspace.includes("Final / recorded position from fixed reference")],
  ["Person injury areas are structured", types.includes("export type PersonInjuryArea") && workspace.includes("Visible / reported injury areas")],
  ["Person can link supporting evidence", types.includes("sourceEvidenceIds: string[]") && workspace.includes("togglePersonEvidence")],
  ["Person register renders saved persons", workspace.includes("Person register") && workspace.includes("investigation.persons.map")],
  ["Step 4 person CSS exists", css.includes(".fv2-person-note") && css.includes(".fv2-person-injury-grid")],
  ["Fresh-local damage-photo button wording is preserved", workspace.includes('"Choose photos"') && !workspace.includes('"Choose overview damage photos"')],
  ["CSS has no literal escaped newline corruption", !css.includes("\\\\n.fv2-")],
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
  throw new Error(`Step 4 persons verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Forensic Reconstruction V2 Step 4.0.1 persons verification passed (${checks.length}/${checks.length}).`);
