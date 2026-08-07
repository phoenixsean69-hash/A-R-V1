import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const replacementRoot = path.join(
  root,
  "roadsafe-2d-shell-right-panel-replacements",
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
    fs.readFileSync(packagePath, "utf8"),
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
  "src/components/layout/AppShell.tsx",
  "src/components/layout/WorkspaceRightPanelContext.tsx",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/styles/reconstruction2DWorkstation.css",
  "src/main.tsx",
];

const removedPaths = [
  "src/styles/reconstruction2dTheme.css",
];

const trackedPaths = [
  ...replacementPaths,
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

for (const requiredPath of [
  appShellPath,
  editorPath,
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

const editorSource = fs.readFileSync(
  editorPath,
  "utf8",
);

for (const marker of [
  "<Outlet />",
  "WorkspaceInspector",
  "roadsafe-workstation",
]) {
  if (!appShellSource.includes(marker)) {
    console.error(
      `The current AppShell does not contain the expected marker: ${marker}`,
    );
    process.exit(1);
  }
}

for (const marker of [
  "2D Context Inspector",
  "reconstruction-workspace__2d-grid",
  "reconstruction-workspace__properties--2d",
]) {
  if (!editorSource.includes(marker)) {
    console.error(
      `The current reconstruction editor does not contain the expected marker: ${marker}`,
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
  "last-2d-shell-right-panel.json",
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
    { recursive: true },
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
        { recursive: true },
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
        { force: true },
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
    { recursive: true },
  );

  fs.copyFileSync(
    sourcePath,
    destinationPath,
  );

  console.log(
    `WROTE ${relativePath}`,
  );
}

for (const relativePath of removedPaths) {
  const targetPath = path.join(
    root,
    relativePath,
  );

  if (fs.existsSync(targetPath)) {
    fs.rmSync(
      targetPath,
      { force: true },
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
The replacement files did not pass the project build.

Every file changed by this installer has been restored automatically.
The repository is back at the state from before this installation.
`);
  process.exit(1);
}

fs.mkdirSync(
  path.dirname(statePath),
  { recursive: true },
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
RoadSafe 2D shell-right-panel restart installed successfully.

Correct structure:
  Navigation | Reconstruction workspace | 2D Context Inspector

The inspector is now rendered through the real AppShell right-panel slot.
It is no longer nested inside the reconstruction middle panel.

Full files replaced:
  src/components/layout/AppShell.tsx
  src/components/layout/WorkspaceRightPanelContext.tsx
  src/components/reconstruction/AccidentReconstructionEditor.tsx
  src/styles/reconstruction2DWorkstation.css
  src/main.tsx

Start RoadSafe:
  npm run dev

Rollback:
  node revoke-2d-shell-right-panel.mjs
`);
