import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const PAGE = path.join(ROOT, "src", "pages", "AnalyticsPage.tsx");
const SERVICE = path.join(
  ROOT,
  "src",
  "services",
  "analyticsAnalysisService.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(PAGE)) {
  fail("src/pages/AnalyticsPage.tsx was not found.");
}

const required = [
  path.join(ROOT, "src", "services", "accidentService.ts"),
  path.join(ROOT, "src", "services", "junctionService.ts"),
  path.join(ROOT, "src", "services", "riskAnalysisService.ts"),
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    fail(`Required current RoadSafe service missing: ${path.relative(ROOT, file)}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `analytics-workbench-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(PAGE, path.join(backupDir, "AnalyticsPage.tsx"));

if (fs.existsSync(SERVICE)) {
  fs.copyFileSync(
    SERVICE,
    path.join(backupDir, "analyticsAnalysisService.ts"),
  );
}

const payloadPage = path.join(HERE, "payload", "AnalyticsPage.tsx");
const payloadService = path.join(
  HERE,
  "payload",
  "analyticsAnalysisService.ts",
);

if (!fs.existsSync(payloadPage) || !fs.existsSync(payloadService)) {
  fail("Analytics installer payload is incomplete.");
}

fs.copyFileSync(payloadPage, PAGE);
fs.copyFileSync(payloadService, SERVICE);

console.log("\n[RoadSafe] Analytical Workbench V1 installed.");
console.log("[RoadSafe] /analytics is now analysis-first rather than chart-first.");
console.log("[RoadSafe] Added filtering, severity diagnostics, time patterns, cause/weather cross-analysis, comparable periods and weighted junction risk.");
console.log("[RoadSafe] No exposure-adjusted crash-rate claims were added because the current repo has no traffic-volume denominator.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
