
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
  fail("GNSS UI refresh payload is missing.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-gnss-ui-refresh-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "ForensicDatumPicker.tsx"),
);
fs.copyFileSync(PAYLOAD, TARGET);

console.log("\n[RoadSafe] Forensic GNSS UI Refresh V1 installed.");
console.log("[RoadSafe] GNSS workflow logic preserved.");
console.log("[RoadSafe] Heavy stretched layout -> replaced.");
console.log("[RoadSafe] Contrast, hierarchy and spacing -> improved.");
console.log("[RoadSafe] Primary capture action -> clearer.");
console.log("[RoadSafe] Right-side summary / confirmation area -> refined.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
