import fs from "node:fs";
const files={
 types:"src/features/forensicReconstruction/forensicInvestigationTypes.ts",
 service:"src/features/forensicReconstruction/forensicInvestigationService.ts",
 workspace:"src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
 css:"src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};
for(const file of Object.values(files)){if(!fs.existsSync(file))throw new Error(`Missing Step 3 file: ${file}`)}
const types=fs.readFileSync(files.types,"utf8");
const service=fs.readFileSync(files.service,"utf8");
const workspace=fs.readFileSync(files.workspace,"utf8");
const css=fs.readFileSync(files.css,"utf8");
const checks=[
 ["CSS contains no literal escaped newline tokens",!css.includes("\\n")],
 ["Vehicles is active",/const ACTIVE[\s\S]*"Vehicles"/m.test(workspace)],
 ["Vehicle examination model exists",types.includes("interface ForensicVehicleExamination")],
 ["Investigation stores vehicles",types.includes("vehicles: ForensicVehicleExamination[]")],
 ["Service normalises old cases with vehicles",service.includes("vehicles: Array.isArray(record.vehicles)")],
 ["Service creates empty vehicles list",service.includes("vehicles: []")],
 ["Service adds vehicles",service.includes("addVehicle(")],
 ["Service deletes vehicles",service.includes("deleteVehicle(")],
 ["Vehicle type dropdown/manual exists",/vehicleChoiceField\(\s*"Vehicle type"[\s\S]*?VEHICLE_TYPE_OPTIONS,/m.test(workspace)&&workspace.includes("Other / specify manually")],
 ["Scene position dropdown/manual exists",/vehicleChoiceField\(\s*"Where the vehicle was found \/ resting"[\s\S]*?VEHICLE_SCENE_POSITION_OPTIONS,/m.test(workspace)],
 ["Mechanical finding dropdown/manual exists",/vehicleChoiceField\(\s*"Main mechanical finding"[\s\S]*?VEHICLE_MECHANICAL_FINDING_OPTIONS,/m.test(workspace)],
 ["Damage areas are selectable",workspace.includes("VEHICLE_DAMAGE_AREA_OPTIONS.map")],
 ["Damage severity dropdown exists",workspace.includes("VEHICLE_DAMAGE_SEVERITY_OPTIONS.map")],
 ["Trace types are selectable",workspace.includes("VEHICLE_TRACE_TYPE_OPTIONS.map")],
 ["Vehicle can link supporting evidence",workspace.includes("toggleVehicleEvidence")&&workspace.includes("vehicleEvidenceIds")],
 ["Vehicle register exists",workspace.includes("Vehicle examination register")],
 ["Vehicle data remains forensic, not reconstruction participant",workspace.includes("does not yet create a 2D/3D participant")],
 ["Step 3 CSS exists",css.includes(".fv2-check-grid")],
];
let failures=0;for(const [label,passed] of checks){if(passed)console.log(`[OK] ${label}`);else{failures++;console.error(`[FAIL] ${label}`)}}
if(failures)throw new Error(`Step 3 verification failed: ${failures} check(s) failed.`);
console.log("");console.log(`[RoadSafe] Forensic Reconstruction V2 Step 3.0.1 verification passed (${checks.length}/${checks.length}).`);
