
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
  fail("ForensicDatumPicker.tsx was not found. Install GNSS Datum V2 first.");
}

if (!fs.existsSync(PAYLOAD)) {
  fail("Small-modal payload is missing.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-gnss-small-modal-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "ForensicDatumPicker.tsx"),
);
fs.copyFileSync(PAYLOAD, TARGET);

console.log("\n[RoadSafe] Forensic GNSS Small Modal V1 installed.");
console.log("[RoadSafe] Fullscreen GNSS modal -> replaced with compact centered modal.");
console.log("[RoadSafe] Capture logic -> preserved.");
console.log("[RoadSafe] Smaller max width / scrollable body -> applied.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
