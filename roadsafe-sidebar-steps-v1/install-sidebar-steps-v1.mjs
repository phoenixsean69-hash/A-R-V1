import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicInvestigationWorkspace.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("ForensicInvestigationWorkspace.tsx was not found.");
}

let source = fs.readFileSync(TARGET, "utf8");

const sidebarStart = source.indexOf('<aside className="fv2-sidebar">');
const sidebarEnd = source.indexOf('</aside>', sidebarStart);

if (sidebarStart < 0 || sidebarEnd < 0) {
  fail("Could not locate the forensic sidebar.");
}

let sidebar = source.slice(sidebarStart, sidebarEnd + '</aside>'.length);

if (!sidebar.includes('SECTIONS.map((item) => (') && !sidebar.includes('SECTIONS.map((item, index) => (')) {
  fail("Could not find the sidebar SECTIONS map.");
}

sidebar = sidebar.replace(
  'SECTIONS.map((item) => (',
  'SECTIONS.map((item, index) => (',
);

const oldStatusPattern = /<small>\s*\{ACTIVE\.has\(item\)[\s\S]*?:\s*"Later"\}\s*<\/small>/;

if (oldStatusPattern.test(sidebar)) {
  sidebar = sidebar.replace(
    oldStatusPattern,
    '<small>Step {index + 1}</small>',
  );
} else if (!sidebar.includes('<small>Step {index + 1}</small>')) {
  fail("Could not find the old Ready / Step / Later sidebar status block.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `sidebar-steps-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "ForensicInvestigationWorkspace.tsx"),
);

source =
  source.slice(0, sidebarStart) +
  sidebar +
  source.slice(sidebarEnd + '</aside>'.length);

fs.writeFileSync(TARGET, source, "utf8");

console.log("\n[RoadSafe] Forensic sidebar step labels updated.");
console.log("[RoadSafe] Overview            -> Step 1");
console.log("[RoadSafe] Scene Intake        -> Step 2");
console.log("[RoadSafe] Evidence Registry   -> Step 3");
console.log("[RoadSafe] Measurements        -> Step 4");
console.log("[RoadSafe] Vehicles            -> Step 5");
console.log("[RoadSafe] Persons             -> Step 6");
console.log("[RoadSafe] Witnesses           -> Step 7");
console.log("[RoadSafe] Analysis            -> Step 8");
console.log("[RoadSafe] Hypotheses          -> Step 9");
console.log("[RoadSafe] Simulation          -> Step 10");
console.log("[RoadSafe] 2D / 3D / AR        -> Step 11");
console.log("[RoadSafe] Findings            -> Step 12");
console.log("[RoadSafe] Report              -> Step 13");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
