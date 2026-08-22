import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FEATURE_DIR = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
);
const WORKSPACE = path.join(
  FEATURE_DIR,
  "ForensicInvestigationWorkspace.tsx",
);
const TYPES = path.join(
  FEATURE_DIR,
  "forensicInvestigationTypes.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail(
    "package.json not found. Run this installer from the A-R-V1 project root.",
  );
}
if (!fs.existsSync(WORKSPACE) || !fs.existsSync(TYPES)) {
  fail("Forensic V2 workspace files were not found.");
}

const typesSource = fs.readFileSync(TYPES, "utf8");
if (
  !typesSource.includes("ForensicCrashHypothesis") ||
  !typesSource.includes("hypotheses:")
) {
  fail(
    "Forensic Hypotheses V1 is not installed. Install and verify Hypotheses before Simulation.",
  );
}

let workspace = fs.readFileSync(WORKSPACE, "utf8");

if (!workspace.includes('section === "Hypotheses"')) {
  fail(
    "Hypotheses UI is not active in the current workspace. Simulation installation was stopped.",
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-simulation-v1-${stamp}`,
);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  WORKSPACE,
  path.join(backupDir, "ForensicInvestigationWorkspace.tsx"),
);

const filesToInstall = [
  "forensicSimulationTypes.ts",
  "forensicSimulationService.ts",
  "SimulationWorkspace.tsx",
  "SimulationWorkspace.css",
];

for (const name of filesToInstall) {
  const source = path.join(HERE, "payload", name);
  if (!fs.existsSync(source)) {
    fail(`Installer payload is missing ${name}.`);
  }

  const destination = path.join(FEATURE_DIR, name);
  if (fs.existsSync(destination)) {
    fs.copyFileSync(destination, path.join(backupDir, name));
  }
  fs.copyFileSync(source, destination);
}

if (
  !workspace.includes(
    'import SimulationWorkspace from "./SimulationWorkspace";',
  )
) {
  const importAnchor =
    'import HypothesesWorkspace from "./HypothesesWorkspace";';

  if (!workspace.includes(importAnchor)) {
    fail(
      "Could not find the HypothesesWorkspace import. No workspace change was applied.",
    );
  }

  workspace = workspace.replace(
    importAnchor,
    `${importAnchor}\nimport SimulationWorkspace from "./SimulationWorkspace";`,
  );
}

const activeStart = workspace.indexOf("const ACTIVE = new Set<Section>([");
if (activeStart < 0) {
  fail("Could not find ACTIVE forensic section list.");
}
const activeEnd = workspace.indexOf("]);", activeStart);
if (activeEnd < 0) {
  fail("Could not read ACTIVE forensic section list.");
}

const activeBlock = workspace.slice(activeStart, activeEnd + 3);

if (!activeBlock.includes('"Simulation"')) {
  if (!activeBlock.includes('"Hypotheses"')) {
    fail(
      "Hypotheses is not active. Simulation cannot be activated out of order.",
    );
  }

  const patchedActive = activeBlock.replace(
    '  "Hypotheses",',
    '  "Hypotheses",\n  "Simulation",',
  );

  workspace =
    workspace.slice(0, activeStart) +
    patchedActive +
    workspace.slice(activeEnd + 3);
}

if (!workspace.includes('section === "Simulation" &&')) {
  const fallbackAnchor = `          {!ACTIVE.has(section) && (`;

  if (!workspace.includes(fallbackAnchor)) {
    fail("Could not locate future-module fallback.");
  }

  const renderBlock = `          {section === "Simulation" && (
            <SimulationWorkspace
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

console.log("\n[RoadSafe] Forensic Simulation V1 installed.");
console.log("[RoadSafe] Simulation is now active after Hypotheses.");
console.log("[RoadSafe] Simulation runs use a separate persistence store.");
console.log("[RoadSafe] Original evidence / measurements / witness / analysis records are not mutated.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
