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

const hasAttributionTrue =
  /attributionControl\s*:\s*true\s*,?/m.test(source);

const hasGeometryIdDependency =
  /\[\s*selection\?\.id\s*,\s*geometry\?\.id\s*\]/m.test(source);

if (!hasAttributionTrue && !hasGeometryIdDependency) {
  console.log(
    "\n[RoadSafe] Datum Picker V1.1 repair rules found nothing to change.",
  );
  console.log(
    "[RoadSafe] The file may already be repaired or may differ from the V1 installer output.",
  );
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-datum-picker-v1-1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "ForensicDatumPicker.tsx"),
);

// MapLibre v8 typings do not accept boolean true here.
// Omit the option and keep the library default attribution control.
source = source.replace(
  /^\s*attributionControl\s*:\s*true\s*,?\s*$/m,
  "",
);

// RealSceneGeometry has no `id` property.
// The frozen selection ID is the stable dependency we need.
source = source.replace(
  /\[\s*selection\?\.id\s*,\s*geometry\?\.id\s*\]/m,
  "[selection?.id]",
);

fs.writeFileSync(TARGET, source, "utf8");

console.log("\n[RoadSafe] Forensic Datum Picker V1.1 repair applied.");
console.log("[RoadSafe] Removed invalid attributionControl: true.");
console.log("[RoadSafe] Removed invalid geometry?.id dependency.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
