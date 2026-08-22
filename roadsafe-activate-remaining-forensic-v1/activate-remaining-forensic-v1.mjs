import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

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

const requiredModules = [
  "ForensicReconstructionWorkspace.tsx",
  "FindingsWorkspace.tsx",
  "ReportWorkspace.tsx",
];

for (const fileName of requiredModules) {
  const fullPath = path.join(FEATURE_DIR, fileName);

  if (!fs.existsSync(fullPath)) {
    fail(
      `${fileName} is missing. Install its module before running this activation repair.`,
    );
  }
}

let source = fs.readFileSync(WORKSPACE, "utf8");

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `activate-remaining-forensic-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(
  WORKSPACE,
  path.join(
    backupDir,
    "ForensicInvestigationWorkspace.tsx",
  ),
);

// -----------------------------------------------------------------------------
// 1. Ensure imports exist
// -----------------------------------------------------------------------------

if (
  !source.includes(
    'import ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";',
  )
) {
  const anchor =
    'import SimulationWorkspace from "./SimulationWorkspace";';

  if (!source.includes(anchor)) {
    fail(
      "Could not find SimulationWorkspace import. The workspace no longer matches the expected forensic V2 structure.",
    );
  }

  source = source.replace(
    anchor,
    `${anchor}\nimport ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";`,
  );
}

if (
  !source.includes(
    'import FindingsWorkspace from "./FindingsWorkspace";',
  )
) {
  const anchor =
    'import ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";';

  if (!source.includes(anchor)) {
    fail("Could not find ForensicReconstructionWorkspace import.");
  }

  source = source.replace(
    anchor,
    `${anchor}\nimport FindingsWorkspace from "./FindingsWorkspace";`,
  );
}

if (
  !source.includes(
    'import ReportWorkspace from "./ReportWorkspace";',
  )
) {
  const anchor =
    'import FindingsWorkspace from "./FindingsWorkspace";';

  if (!source.includes(anchor)) {
    fail("Could not find FindingsWorkspace import.");
  }

  source = source.replace(
    anchor,
    `${anchor}\nimport ReportWorkspace from "./ReportWorkspace";`,
  );
}

// -----------------------------------------------------------------------------
// 2. Activate the three remaining sidebar sections
// -----------------------------------------------------------------------------

const activeStart = source.indexOf(
  "const ACTIVE = new Set<Section>([",
);

if (activeStart < 0) {
  fail("Could not find ACTIVE forensic section list.");
}

const activeEnd = source.indexOf(
  "]);",
  activeStart,
);

if (activeEnd < 0) {
  fail("Could not read ACTIVE forensic section list.");
}

let activeBlock = source.slice(
  activeStart,
  activeEnd + 3,
);

const requiredActiveEntries = [
  '"2D / 3D / AR"',
  '"Findings"',
  '"Report"',
];

for (const entry of requiredActiveEntries) {
  if (!activeBlock.includes(entry)) {
    const closing = "\n]);";

    if (!activeBlock.includes(closing)) {
      fail("ACTIVE section list has an unexpected layout.");
    }

    activeBlock = activeBlock.replace(
      closing,
      `  ${entry},${closing}`,
    );
  }
}

source =
  source.slice(0, activeStart) +
  activeBlock +
  source.slice(activeEnd + 3);

// -----------------------------------------------------------------------------
// 3. Ensure rendering blocks exist
// -----------------------------------------------------------------------------

const fallbackAnchor =
  `          {!ACTIVE.has(section) && (`;

if (!source.includes(fallbackAnchor)) {
  fail("Could not locate the future-module fallback render block.");
}

if (
  !source.includes(
    'section === "2D / 3D / AR" &&',
  )
) {
  const block = `          {section === "2D / 3D / AR" && (
            <ForensicReconstructionWorkspace
              investigation={investigation}
              onMessage={setMessage}
            />
          )}

`;

  source = source.replace(
    fallbackAnchor,
    block + fallbackAnchor,
  );
}

if (
  !source.includes(
    'section === "Findings" &&',
  )
) {
  const block = `          {section === "Findings" && (
            <FindingsWorkspace
              investigation={investigation}
              onMessage={setMessage}
            />
          )}

`;

  source = source.replace(
    fallbackAnchor,
    block + fallbackAnchor,
  );
}

if (
  !source.includes(
    'section === "Report" &&',
  )
) {
  const block = `          {section === "Report" && (
            <ReportWorkspace
              investigation={investigation}
              onMessage={setMessage}
            />
          )}

`;

  source = source.replace(
    fallbackAnchor,
    block + fallbackAnchor,
  );
}

fs.writeFileSync(
  WORKSPACE,
  source,
  "utf8",
);

console.log("\n[RoadSafe] Remaining forensic screens activated.");
console.log("[RoadSafe] 2D / 3D / AR  -> ACTIVE");
console.log("[RoadSafe] Findings       -> ACTIVE");
console.log("[RoadSafe] Report         -> ACTIVE");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
