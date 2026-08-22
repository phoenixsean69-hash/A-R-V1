import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FEATURE_DIR = path.join(ROOT, "src", "features", "forensicReconstruction");
const WORKSPACE = path.join(FEATURE_DIR, "ForensicInvestigationWorkspace.tsx");

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(WORKSPACE)) {
  fail("ForensicInvestigationWorkspace.tsx was not found.");
}

const prerequisiteFiles = [
  "forensicSimulationService.ts",
  "ForensicReconstructionWorkspace.tsx",
  "forensicCanonicalReconstructionService.ts",
];

for (const name of prerequisiteFiles) {
  if (!fs.existsSync(path.join(FEATURE_DIR, name))) {
    fail(`${name} is missing. The Simulation / 2D-3D-AR stage must exist before finishing the forensic workflow.`);
  }
}

let workspace = fs.readFileSync(WORKSPACE, "utf8");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, ".roadsafe-ui-backup", `finish-forensic-v2-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(WORKSPACE, path.join(backupDir, "ForensicInvestigationWorkspace.tsx"));

const files = [
  "forensicFindingsTypes.ts",
  "forensicFindingsService.ts",
  "FindingsWorkspace.tsx",
  "FindingsWorkspace.css",
  "forensicReportTypes.ts",
  "forensicReportService.ts",
  "ReportWorkspace.tsx",
  "ReportWorkspace.css",
];

for (const name of files) {
  const source = path.join(HERE, "payload", name);
  const destination = path.join(FEATURE_DIR, name);

  if (!fs.existsSync(source)) fail(`Installer payload missing ${name}.`);
  if (fs.existsSync(destination)) {
    fs.copyFileSync(destination, path.join(backupDir, name));
  }
  fs.copyFileSync(source, destination);
}

function ensureImport(importLine, afterCandidates) {
  if (workspace.includes(importLine)) return;

  for (const anchor of afterCandidates) {
    if (workspace.includes(anchor)) {
      workspace = workspace.replace(anchor, `${anchor}\n${importLine}`);
      return;
    }
  }

  fail(`Could not insert import: ${importLine}`);
}

ensureImport(
  'import ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";',
  ['import SimulationWorkspace from "./SimulationWorkspace";'],
);
ensureImport(
  'import FindingsWorkspace from "./FindingsWorkspace";',
  [
    'import ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";',
    'import SimulationWorkspace from "./SimulationWorkspace";',
  ],
);
ensureImport(
  'import ReportWorkspace from "./ReportWorkspace";',
  ['import FindingsWorkspace from "./FindingsWorkspace";'],
);

const activeStart = workspace.indexOf("const ACTIVE = new Set<Section>([");
if (activeStart < 0) fail("Could not find ACTIVE forensic section list.");
const activeEnd = workspace.indexOf("]);", activeStart);
if (activeEnd < 0) fail("Could not read ACTIVE forensic section list.");

let activeBlock = workspace.slice(activeStart, activeEnd + 3);
const requiredActive = ["2D / 3D / AR", "Findings", "Report"];

for (const sectionName of requiredActive) {
  const quoted = `"${sectionName}"`;
  if (!activeBlock.includes(quoted)) {
    activeBlock = activeBlock.replace(/\n\]\);$/, `\n  ${quoted},\n]);`);
  }
}

workspace = workspace.slice(0, activeStart) + activeBlock + workspace.slice(activeEnd + 3);

const fallbackAnchor = `          {!ACTIVE.has(section) && (`;
if (!workspace.includes(fallbackAnchor)) {
  fail("Could not locate the future-module fallback block.");
}

const renderBlocks = [
  {
    marker: 'section === "2D / 3D / AR" &&',
    block: `          {section === "2D / 3D / AR" && (\n            <ForensicReconstructionWorkspace\n              investigation={investigation}\n              onMessage={setMessage}\n            />\n          )}\n\n`,
  },
  {
    marker: 'section === "Findings" &&',
    block: `          {section === "Findings" && (\n            <FindingsWorkspace\n              investigation={investigation}\n              onMessage={setMessage}\n            />\n          )}\n\n`,
  },
  {
    marker: 'section === "Report" &&',
    block: `          {section === "Report" && (\n            <ReportWorkspace\n              investigation={investigation}\n              onMessage={setMessage}\n            />\n          )}\n\n`,
  },
];

for (const item of renderBlocks) {
  if (!workspace.includes(item.marker)) {
    workspace = workspace.replace(fallbackAnchor, item.block + fallbackAnchor);
  }
}

fs.writeFileSync(WORKSPACE, workspace, "utf8");

console.log("\n[RoadSafe] Forensic workflow completion repair installed.");
console.log("[RoadSafe] Findings module          -> INSTALLED + ACTIVE");
console.log("[RoadSafe] Report module            -> INSTALLED + ACTIVE");
console.log("[RoadSafe] 2D / 3D / AR             -> ACTIVE");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
