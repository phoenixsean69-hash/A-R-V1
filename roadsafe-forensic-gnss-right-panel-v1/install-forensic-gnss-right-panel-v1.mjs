
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(
  fileURLToPath(import.meta.url),
);

const TARGET = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicDatumPicker.tsx",
);

const PAYLOAD = path.join(
  HERE,
  "payload",
  "ForensicDatumPicker.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("ForensicDatumPicker.tsx was not found.");
}

if (!fs.existsSync(PAYLOAD)) {
  fail("Right-panel payload is missing.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-gnss-right-panel-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "ForensicDatumPicker.tsx"),
);

fs.copyFileSync(PAYLOAD, TARGET);

console.log("\n[RoadSafe] Forensic GNSS Right Panel V1 installed.");
console.log("[RoadSafe] Center modal -> removed.");
console.log("[RoadSafe] Compact 360px field panel -> docked right.");
console.log("[RoadSafe] Slide-in from right -> enabled.");
console.log("[RoadSafe] Scene Intake remains visible behind the panel.");
console.log("[RoadSafe] GNSS capture logic -> unchanged.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
