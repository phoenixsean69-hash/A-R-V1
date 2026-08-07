import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const statePath = path.join(root, ".roadsafe-ui-backup", "last-forensic-geospatial-pipeline-phase1-v1.json");
if (!fs.existsSync(statePath)) {
  console.error("No Forensic Geospatial Pipeline Phase 1 V1 backup state found.");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
fs.writeFileSync(path.join(root, state.pagePath), state.originalPage, "utf8");
fs.writeFileSync(path.join(root, state.reconstructionTypesPath), state.originalReconstructionTypes, "utf8");
for (const [destination, original] of Object.entries(state.originalPayload)) {
  const full = path.join(root, destination);
  if (original === null) fs.rmSync(full, { force: true });
  else {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, original, "utf8");
  }
}
fs.rmSync(statePath, { force: true });
console.log("RoadSafe Forensic Geospatial Pipeline Phase 1 V1 rolled back.");
