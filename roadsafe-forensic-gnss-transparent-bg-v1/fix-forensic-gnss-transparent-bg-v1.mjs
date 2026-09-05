
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TARGET = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicDatumPicker.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this repair from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("ForensicDatumPicker.tsx was not found.");
}

let source = fs.readFileSync(TARGET, "utf8");

const backdropPattern = /\s*<button\s+type="button"\s+aria-label="Close reference point panel"\s+onClick=\{onCancel\}\s+className="fixed inset-0 z-\[9998\][^"]*"\s*\/>\s*/m;

if (!backdropPattern.test(source)) {
  console.log("\n[RoadSafe] No GNSS backdrop layer matched.");
  console.log("[RoadSafe] The right panel may already be using the reconstruction page as its background.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-gnss-transparent-bg-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(
  TARGET,
  path.join(
    backupDir,
    "ForensicDatumPicker.tsx",
  ),
);

// Remove the fullscreen dim/gray click-catcher completely.
// The current /reconstruction screen remains fully visible and unchanged.
source = source.replace(
  backdropPattern,
  "\n",
);

fs.writeFileSync(
  TARGET,
  source,
  "utf8",
);

console.log("\n[RoadSafe] GNSS Reconstruction Background Fix V1 applied.");
console.log("[RoadSafe] Gray/dim fullscreen backdrop -> REMOVED.");
console.log("[RoadSafe] /reconstruction page remains visible at full brightness.");
console.log("[RoadSafe] Only the small right-side GNSS panel overlays the page.");
console.log("[RoadSafe] Close panel using its X or Cancel button.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);

console.log("\nRun:");
console.log("  npm run build");
