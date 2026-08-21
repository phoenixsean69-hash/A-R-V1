import fs from "node:fs";

const files = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  registry: "src/features/forensicReconstruction/driverRegistryService.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
  docs: "docs/NATIONAL_DRIVER_REGISTRY_INTEGRATION.md",
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) throw new Error(`Missing Step 4.0.2 file: ${file}`);
}

const types = fs.readFileSync(files.types, "utf8");
const service = fs.readFileSync(files.service, "utf8");
const registry = fs.readFileSync(files.registry, "utf8");
const workspace = fs.readFileSync(files.workspace, "utf8");
const css = fs.readFileSync(files.css, "utf8");
const docs = fs.readFileSync(files.docs, "utf8");

const checks = [
  ["Person record can store a driver-registry check", types.includes("driverRegistryCheck?: ForensicDriverRegistryCheck")],
  ["Registry result stores status/source/audit context", types.includes("DriverRegistryCheckStatus") && types.includes("checkedBy: string") && types.includes('purpose: "Road traffic accident investigation"')],
  ["Old person records migrate safely", service.includes("driverRegistryCheck:") && service.includes("licenceCodes: Array.isArray")],
  ["Registry service supports official secure gateway", registry.includes("VITE_DRIVER_REGISTRY_PROXY_URL") && registry.includes('credentials:') && registry.includes('"include"')],
  ["No client-side registry token exists", !registry.includes("VITE_DRIVER_REGISTRY_TOKEN") && !registry.includes("Authorization: Bearer")],
  ["Registry service supports clearly marked demo mode", registry.includes("VITE_DRIVER_REGISTRY_DEMO") && registry.includes("DEMO ONLY")],
  ["Driver-only registry UI exists", workspace.includes('personInvolvement.trim().toLowerCase() === "driver"')],
  ["Driver lookup button exists", workspace.includes("Check National Driver Registry")],
  ["Driver check requires licence or National ID", workspace.includes("Enter the driver's licence number or National ID before checking the registry.")],
  ["Driver cannot be saved without a registry attempt", workspace.includes("Check the National Driver Registry before adding this driver")],
  ["Registry result is stored with person record", workspace.includes("driverRegistryCheck:") && workspace.includes("personDriverRegistryCheck")],
  ["Registry result clears if driver identity fields change", workspace.includes("setPersonDriverRegistryCheck(null)") && workspace.includes("personLicenceNumber")],
  ["Person register shows driver-registry status", workspace.includes("Driver registry") && workspace.includes("fv2-registry-table-status")],
  ["Registry UI shows licence codes and expiry", workspace.includes("Licence codes") && workspace.includes("Expiry")],
  ["Registry UI optionally shows penalty points/restrictions", workspace.includes("Penalty points") && workspace.includes("restrictionSummary")],
  ["Driver registry CSS exists", css.includes(".fv2-driver-registry-card") && css.includes(".fv2-driver-registry-result")],
  ["Integration doc forbids browser secrets", docs.includes("must **not** contain CVR/ZIMTIS credentials")],
  ["Integration doc requires audited authorised gateway", docs.includes("audit every lookup") && docs.includes("authorised police user")],
];

let failed = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`[OK] ${label}`);
  else { failed += 1; console.error(`[FAIL] ${label}`); }
}

if (failed) throw new Error(`Step 4.0.2 driver-registry verification failed: ${failed} check(s) failed.`);

console.log("");
console.log(`[RoadSafe] Step 4.0.2 driver-registry verification passed (${checks.length}/${checks.length}).`);
