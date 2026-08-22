import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const TARGET = path.join(
  ROOT,
  "src",
  "pages",
  "CaseCanonicalReconstructionPage.tsx",
);

const SOURCE = path.join(
  HERE,
  "payload",
  "CaseCanonicalReconstructionPage.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("CaseCanonicalReconstructionPage.tsx was not found. Install the 2D / 3D / AR screen first.");
}

if (!fs.existsSync(SOURCE)) {
  fail("Corrected page payload is missing.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `canonical-page-fix-v1-1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(
  TARGET,
  path.join(
    backupDir,
    "CaseCanonicalReconstructionPage.tsx",
  ),
);

fs.copyFileSync(
  SOURCE,
  TARGET,
);

console.log("\n[RoadSafe] Canonical Reconstruction Page Fix V1.1 applied.");
console.log("[RoadSafe] Removed unused navigate declaration.");
console.log("[RoadSafe] registerReconstructionSave now receives caseId + saved reconstruction.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
