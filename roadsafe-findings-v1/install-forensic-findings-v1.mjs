import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FEATURE_DIR = path.join(ROOT, "src", "features", "forensicReconstruction");
const WORKSPACE = path.join(FEATURE_DIR, "ForensicInvestigationWorkspace.tsx");
const CANONICAL_SERVICE = path.join(FEATURE_DIR, "forensicCanonicalReconstructionService.ts");
const SIM_SERVICE = path.join(FEATURE_DIR, "forensicSimulationService.ts");
const TYPES = path.join(FEATURE_DIR, "forensicInvestigationTypes.ts");

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

for (const file of [WORKSPACE, CANONICAL_SERVICE, SIM_SERVICE, TYPES]) {
  if (!fs.existsSync(file)) {
    fail(`Required file missing: ${path.relative(ROOT, file)}`);
  }
}

let workspace = fs.readFileSync(WORKSPACE, "utf8");
const forensicTypes = fs.readFileSync(TYPES, "utf8");

if (!workspace.includes('section === "2D / 3D / AR"')) {
  fail("The 2D / 3D / AR forensic screen is not active. Install and verify it before Findings.");
}

if (!forensicTypes.includes("ForensicCrashHypothesis") || !forensicTypes.includes("hypotheses:")) {
  fail("Hypotheses V1 data model is not installed.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-findings-v1-${stamp}`,
);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(WORKSPACE, path.join(backupDir, "ForensicInvestigationWorkspace.tsx"));

const files = [
  "forensicFindingsTypes.ts",
  "forensicFindingsService.ts",
  "FindingsWorkspace.tsx",
  "FindingsWorkspace.css",
];

for (const name of files) {
  const source = path.join(HERE, "payload", name);
  const destination = path.join(FEATURE_DIR, name);

  if (!fs.existsSync(source)) {
    fail(`Installer payload missing ${name}.`);
  }

  if (fs.existsSync(destination)) {
    fs.copyFileSync(destination, path.join(backupDir, name));
  }

  fs.copyFileSync(source, destination);
}

if (!workspace.includes('import FindingsWorkspace from "./FindingsWorkspace";')) {
  const importAnchor = 'import ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";';
  if (!workspace.includes(importAnchor)) {
    fail("Could not find ForensicReconstructionWorkspace import.");
  }

  workspace = workspace.replace(
    importAnchor,
    `${importAnchor}\nimport FindingsWorkspace from "./FindingsWorkspace";`,
  );
}

const activeStart = workspace.indexOf("const ACTIVE = new Set<Section>([");
if (activeStart < 0) fail("Could not find ACTIVE forensic section list.");
const activeEnd = workspace.indexOf("]);", activeStart);
if (activeEnd < 0) fail("Could not read ACTIVE forensic section list.");

const activeBlock = workspace.slice(activeStart, activeEnd + 3);

if (!activeBlock.includes('"Findings"')) {
  if (!activeBlock.includes('"2D / 3D / AR"')) {
    fail("2D / 3D / AR is not active. Findings cannot be activated out of sequence.");
  }

  const patched = activeBlock.replace(
    '  "2D / 3D / AR",',
    '  "2D / 3D / AR",\n  "Findings",',
  );

  workspace =
    workspace.slice(0, activeStart) +
    patched +
    workspace.slice(activeEnd + 3);
}

if (!workspace.includes('section === "Findings" &&')) {
  const fallbackAnchor = `          {!ACTIVE.has(section) && (`;
  if (!workspace.includes(fallbackAnchor)) {
    fail("Could not locate future-module fallback.");
  }

  const renderBlock = `          {section === "Findings" && (
            <FindingsWorkspace
              investigation={investigation}
              onMessage={setMessage}
            />
          )}

`;

  workspace = workspace.replace(
    fallbackAnchor,
    renderBlock + fallbackAnchor,
  );
}

fs.writeFileSync(WORKSPACE, workspace, "utf8");

console.log("\n[RoadSafe] Forensic Findings V1 installed.");
console.log("[RoadSafe] Findings is now active after 2D / 3D / AR.");
console.log("[RoadSafe] Final conclusions are stored separately from raw evidence and Analysis records.");
console.log("[RoadSafe] Every finding can link evidence, Analysis, measurements, hypotheses, simulations and the canonical reconstruction.");
console.log("[RoadSafe] Legal guilt / liability is never assigned automatically.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
