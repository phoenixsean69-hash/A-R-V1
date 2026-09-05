import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const TARGET = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "JunctionAnalysisModal.tsx",
);

const PAYLOAD = path.join(
  HERE,
  "payload",
  "JunctionAnalysisModal.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("src/components/map/JunctionAnalysisModal.tsx was not found.");
}

if (!fs.existsSync(PAYLOAD)) {
  fail("Installer payload JunctionAnalysisModal.tsx is missing.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `junction-modal-refresh-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "JunctionAnalysisModal.tsx"),
);

fs.copyFileSync(PAYLOAD, TARGET);

console.log("\n[RoadSafe] Junction Modal Refresh V1 installed.");
console.log("[RoadSafe] Replaced the old compact junction card UI.");
console.log("[RoadSafe] Replaced the old full-analysis UI.");
console.log("[RoadSafe] Added a modern RoadSafe dark analytical layout.");
console.log("[RoadSafe] Preserved the same props: junctionId + onClose.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
