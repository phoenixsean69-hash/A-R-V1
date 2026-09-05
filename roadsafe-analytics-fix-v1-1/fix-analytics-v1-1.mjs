import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "src", "pages", "AnalyticsPage.tsx");

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("src/pages/AnalyticsPage.tsx was not found.");
}

let source = fs.readFileSync(TARGET, "utf8");

const unusedLine = 'const neutral = "#8d99a6";';

if (!source.includes(unusedLine)) {
  if (source.includes("const neutral =")) {
    fail("A neutral colour constant exists, but it no longer matches the expected V1 value. No file changed.");
  }

  console.log("\n[RoadSafe] The unused neutral constant is already gone.");
  console.log("[RoadSafe] No file changed.");
  console.log("\nRun:");
  console.log("  npm run build");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `analytics-fix-v1-1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "AnalyticsPage.tsx"),
);

source = source.replace(`${unusedLine}\n`, "");
source = source.replace(unusedLine, "");

fs.writeFileSync(TARGET, source, "utf8");

console.log("\n[RoadSafe] Analytics Workbench Fix V1.1 applied.");
console.log("[RoadSafe] Removed unused 'neutral' colour constant.");
console.log("[RoadSafe] No analytical calculations or UI behaviour changed.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
