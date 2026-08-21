import fs from "node:fs";

const paths = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  driver: "src/features/forensicReconstruction/driverRegistryService.ts",
  vehicle: "src/features/forensicReconstruction/vehicleRegistryService.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(paths)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Step 4.0.3 file: ${file}`);
  }
}

const types = fs.readFileSync(paths.types, "utf8");
const service = fs.readFileSync(paths.service, "utf8");
const driver = fs.readFileSync(paths.driver, "utf8");
const vehicle = fs.readFileSync(paths.vehicle, "utf8");
const workspace = fs.readFileSync(paths.workspace, "utf8");
const css = fs.readFileSync(paths.css, "utf8");

const checks = [
  ["Persons remains active", /const ACTIVE = new Set<Section>\([\s\S]*?"Persons"/.test(workspace)],
  ["Vehicle registry check type exists", types.includes("ForensicVehicleRegistryCheck")],
  ["Vehicle registry records queried registration", types.includes("queriedRegistration: string")],
  ["Vehicle registry records owner identity", types.includes("registeredOwnerIdentityNumber?: string")],
  ["Person can retain vehicle-registry evidence", types.includes("vehicleRegistryCheck?: ForensicVehicleRegistryCheck")],
  ["Person candidate status is explicitly unconfirmed", types.includes('"Possible driver — not confirmed"')],
  ["Person service normalises vehicle-registry check", service.includes("vehicleRegistryCheck:")],
  ["Vehicle registry service requires registration", vehicle.includes("Enter the vehicle registration number before searching the vehicle registry")],
  ["Vehicle registry has authorised proxy mode", vehicle.includes("VITE_VEHICLE_REGISTRY_PROXY_URL")],
  ["Vehicle registry has explicit demo mode", vehicle.includes("VITE_VEHICLE_REGISTRY_DEMO") && vehicle.includes("DEMO ONLY")],
  ["Vehicle registry sends investigation purpose", vehicle.includes("Road traffic accident investigation")],
  ["Driver registry remains available", driver.includes("VITE_DRIVER_REGISTRY_PROXY_URL")],
  ["Workspace starts unknown-driver flow from vehicle registration", workspace.includes("Start with the vehicle registration")],
  ["Workspace searches vehicle registry", workspace.includes("Search Vehicle Registry") && workspace.includes("searchPersonVehicleRegistry")],
  ["Workspace queries owner in Driver Registry", workspace.includes("Check owner in Driver Registry") && workspace.includes("checkVehicleOwnerDriverRegistry")],
  ["Workspace can adopt owner only as possible driver", workspace.includes("Use owner as possible driver") && workspace.includes("personDriverCandidateAdopted")],
  ["Owner-is-not-driver warning is present", workspace.includes("Registered owner / keeper ≠ confirmed driver")],
  ["Direct known-driver lookup remains available", workspace.includes("Check entered person in Driver Registry")],
  ["Driver may be recorded after failed vehicle search", workspace.includes("!personVehicleRegistryCheck &&") && workspace.includes("!personDriverRegistryCheck")],
  ["Individual owner is queried before driver record is added", workspace.includes("The vehicle registry returned an individual owner")],
  ["Person record stores both registry checks", workspace.includes("vehicleRegistryCheck:") && workspace.includes("driverRegistryCheck:")],
  ["Candidate status is shown in person register", workspace.includes("fv2-driver-candidate-table")],
  ["Vehicle lead appears in person register", workspace.includes("<th>Vehicle lead</th>")],
  ["Registration-to-driver CSS exists", css.includes(".fv2-driver-identification-card") && css.includes(".fv2-driver-candidate-warning")],
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
  throw new Error(
    `Step 4.0.3 registration-to-driver verification failed: ${failed} check(s) failed.`,
  );
}

console.log("");
console.log(
  `[RoadSafe] Step 4.0.3 registration-to-driver verification passed (${checks.length}/${checks.length}).`,
);
