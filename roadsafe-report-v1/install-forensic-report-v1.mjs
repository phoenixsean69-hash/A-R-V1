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

const FINDINGS_SERVICE = path.join(
  FEATURE_DIR,
  "forensicFindingsService.ts",
);

const FINDINGS_TYPES = path.join(
  FEATURE_DIR,
  "forensicFindingsTypes.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

for (const file of [WORKSPACE, FINDINGS_SERVICE, FINDINGS_TYPES]) {
  if (!fs.existsSync(file)) {
    fail(`Required file missing: ${path.relative(ROOT, file)}`);
  }
}

let workspace = fs.readFileSync(WORKSPACE, "utf8");

if (!workspace.includes('section === "Findings"')) {
  fail(
    "Findings V1 is not active. Install and verify Findings before Report.",
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-report-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  WORKSPACE,
  path.join(backupDir, "ForensicInvestigationWorkspace.tsx"),
);

const payloadFiles = [
  "forensicReportTypes.ts",
  "forensicReportService.ts",
  "ReportWorkspace.tsx",
  "ReportWorkspace.css",
];

for (const fileName of payloadFiles) {
  const source = path.join(HERE, "payload", fileName);
  const destination = path.join(FEATURE_DIR, fileName);

  if (!fs.existsSync(source)) {
    fail(`Installer payload missing ${fileName}.`);
  }

  if (fs.existsSync(destination)) {
    fs.copyFileSync(
      destination,
      path.join(backupDir, fileName),
    );
  }

  fs.copyFileSync(source, destination);
}

if (!workspace.includes('import ReportWorkspace from "./ReportWorkspace";')) {
  const importAnchor =
    'import FindingsWorkspace from "./FindingsWorkspace";';

  if (!workspace.includes(importAnchor)) {
    fail("Could not find FindingsWorkspace import.");
  }

  workspace = workspace.replace(
    importAnchor,
    `${importAnchor}\nimport ReportWorkspace from "./ReportWorkspace";`,
  );
}

const activeStart = workspace.indexOf("const ACTIVE = new Set<Section>([");
if (activeStart < 0) fail("Could not find ACTIVE forensic section list.");

const activeEnd = workspace.indexOf("]);", activeStart);
if (activeEnd < 0) fail("Could not read ACTIVE forensic section list.");

const activeBlock = workspace.slice(activeStart, activeEnd + 3);

if (!activeBlock.includes('"Report"')) {
  if (!activeBlock.includes('"Findings"')) {
    fail("Findings is not active. Report cannot be activated out of order.");
  }

  const patchedActive = activeBlock.replace(
    '  "Findings",',
    '  "Findings",\n  "Report",',
  );

  workspace =
    workspace.slice(0, activeStart) +
    patchedActive +
    workspace.slice(activeEnd + 3);
}

if (!workspace.includes('section === "Report" &&')) {
  const fallbackAnchor = `          {!ACTIVE.has(section) && (`;

  if (!workspace.includes(fallbackAnchor)) {
    fail("Could not locate future-module fallback.");
  }

  const renderBlock = `          {section === "Report" && (
            <ReportWorkspace
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

console.log("\n[RoadSafe] Forensic Report V1 installed.");
console.log("[RoadSafe] Report is now active after Findings.");
console.log("[RoadSafe] Only findings marked Ready for report become formal report findings.");
console.log("[RoadSafe] Report keeps provenance, confidence, limitations and source lineage.");
console.log("[RoadSafe] Print/PDF, Word and JSON audit exports are available.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
