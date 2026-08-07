import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(
  root,
  "package.json",
);

const replacementRoot = path.join(
  root,
  "roadsafe-station-panel-replacements",
);

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

let packageJson;

try {
  packageJson = JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );
} catch (error) {
  console.error(
    "Could not read package.json:",
    error,
  );
  process.exit(1);
}

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const replacementPaths = [
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/styles/reconstruction2DWorkstation.css",
  "src/styles/workstationPanelSystem.css",
  "src/main.tsx",
];

const transformedPaths = [
  "src/components/reconstruction/ParticipantPathPanel.tsx",
];

const removedPaths = [
  "src/styles/reconstruction2dTheme.css",
];

const trackedPaths = [
  ...replacementPaths,
  ...transformedPaths,
  ...removedPaths,
];

for (const relativePath of replacementPaths) {
  const replacementPath = path.join(
    replacementRoot,
    relativePath,
  );

  if (!fs.existsSync(replacementPath)) {
    console.error(
      `Replacement file is missing: ${path.relative(root, replacementPath)}`,
    );
    process.exit(1);
  }
}

const appShellPath = path.join(
  root,
  "src/components/layout/AppShell.tsx",
);

const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);

const participantPathPanelPath = path.join(
  root,
  "src/components/reconstruction/ParticipantPathPanel.tsx",
);

for (const requiredPath of [
  appShellPath,
  editorPath,
  participantPathPanelPath,
  path.join(root, "src/main.tsx"),
]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(
      `Required project file is missing: ${path.relative(root, requiredPath)}`,
    );
    process.exit(1);
  }
}

const appShellSource = fs.readFileSync(
  appShellPath,
  "utf8",
);

for (const marker of [
  "roadsafe-workspace-context-slot",
  "WorkspaceRightPanelProvider",
]) {
  if (!appShellSource.includes(marker)) {
    console.error(
      `The current AppShell does not contain the expected marker: ${marker}`,
    );
    process.exit(1);
  }
}

const participantSourceBefore = fs.readFileSync(
  participantPathPanelPath,
  "utf8",
);

for (const marker of [
  "roadsafe-route-inspector",
  "roadsafe-route-point-card",
  "<style>{`",
  "`}</style>",
]) {
  if (!participantSourceBefore.includes(marker)) {
    console.error(
      `ParticipantPathPanel.tsx does not contain the expected marker: ${marker}`,
    );
    process.exit(1);
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-station-panel-reconstruction.json",
);

const existedBefore = {};

function backup(relativePath) {
  const sourcePath = path.join(
    root,
    relativePath,
  );

  const existed =
    fs.existsSync(sourcePath);

  existedBefore[relativePath] =
    existed;

  if (!existed) {
    return;
  }

  const destinationPath = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destinationPath),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    sourcePath,
    destinationPath,
  );
}

function restoreAll() {
  console.log(
    "\nRestoring the pre-installation files...",
  );

  for (const relativePath of trackedPaths) {
    const destinationPath = path.join(
      root,
      relativePath,
    );

    const backupPath = path.join(
      backupRoot,
      relativePath,
    );

    if (existedBefore[relativePath]) {
      if (!fs.existsSync(backupPath)) {
        console.error(
          `Backup file is missing: ${backupPath}`,
        );
        continue;
      }

      fs.mkdirSync(
        path.dirname(destinationPath),
        {
          recursive: true,
        },
      );

      fs.copyFileSync(
        backupPath,
        destinationPath,
      );

      console.log(
        `RESTORED ${relativePath}`,
      );

      continue;
    }

    if (fs.existsSync(destinationPath)) {
      fs.rmSync(
        destinationPath,
        {
          force: true,
        },
      );

      console.log(
        `REMOVED ${relativePath}`,
      );
    }
  }
}

for (const relativePath of trackedPaths) {
  backup(relativePath);
}

for (const relativePath of replacementPaths) {
  const sourcePath = path.join(
    replacementRoot,
    relativePath,
  );

  const destinationPath = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destinationPath),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    sourcePath,
    destinationPath,
  );

  console.log(
    `WROTE ${relativePath}`,
  );
}

/*
 * ParticipantPathPanel previously contained a very large embedded navy/blue
 * stylesheet. Because it was rendered inside the component, it overrode the
 * application-level panel design. Preserve all route logic and JSX, but remove
 * only that embedded style block so the shared workstation panel system owns
 * its design.
 */
let participantSource = fs.readFileSync(
  participantPathPanelPath,
  "utf8",
);

const embeddedStyleStart = participantSource.indexOf(
  "      <style>{`",
);

const embeddedStyleEndMarker =
  "      `}</style>";

const embeddedStyleEnd = participantSource.indexOf(
  embeddedStyleEndMarker,
  embeddedStyleStart,
);

if (
  embeddedStyleStart < 0 ||
  embeddedStyleEnd < 0
) {
  restoreAll();

  console.error(
    "Could not locate the embedded ParticipantPathPanel stylesheet. No changes were kept.",
  );
  process.exit(1);
}

participantSource =
  participantSource.slice(
    0,
    embeddedStyleStart,
  ) +
  `      {/* Visual styling is centralized in reconstruction2DWorkstation.css. */}\n\n` +
  participantSource.slice(
    embeddedStyleEnd +
      embeddedStyleEndMarker.length,
  );

fs.writeFileSync(
  participantPathPanelPath,
  participantSource,
  "utf8",
);

console.log(
  "CHANGED src/components/reconstruction/ParticipantPathPanel.tsx",
);
console.log(
  "REMOVED embedded legacy navy/blue stylesheet from ParticipantPathPanel.tsx",
);

for (const relativePath of removedPaths) {
  const targetPath = path.join(
    root,
    relativePath,
  );

  if (fs.existsSync(targetPath)) {
    fs.rmSync(
      targetPath,
      {
        force: true,
      },
    );

    console.log(
      `REMOVED ${relativePath}`,
    );
  }
}

try {
  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  restoreAll();

  console.error(`
The Station Overview panel redesign did not pass the project build.

Every changed file has been restored automatically.
The repository is back at the state from before this installation.
`);
  process.exit(1);
}

fs.mkdirSync(
  path.dirname(statePath),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      version: 1,
      installedAt:
        new Date().toISOString(),
      backupRoot,
      trackedPaths,
      existedBefore,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
RoadSafe Station Overview panel standard installed successfully.

Reconstruction right panel:
- uses the same shell, header, sections, rows and footer as Active investigation;
- uses gray controls and gray selected surfaces;
- uses orange only for focus and selection edges;
- uses dark red only for destructive actions;
- contains no large blue panel or button backgrounds;
- keeps actual participant colour swatches as case data.

Route point editor:
- no longer injects its own navy/blue stylesheet;
- uses compact gray inspector sections;
- uses one-column field rows suited to the real right panel width;
- uses orange selected edges;
- keeps route and physics logic unchanged.

Bottom panels:
- playback, timeline and lower investigation panels use the same shared tokens.

Full replacement files:
- src/components/reconstruction/AccidentReconstructionEditor.tsx
- src/styles/reconstruction2DWorkstation.css
- src/styles/workstationPanelSystem.css
- src/main.tsx

Start RoadSafe:
  npm run dev

Rollback:
  node revoke-station-panel-reconstruction.mjs
`);
