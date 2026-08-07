import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const replacementRoot = path.join(
  root,
  "roadsafe-2d-workstation-replacements",
);

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const replacements = [
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/main.tsx",
  "src/styles/reconstruction2DWorkstation.css",
];

for (const relativePath of replacements) {
  const replacement = path.join(
    replacementRoot,
    relativePath,
  );

  if (!fs.existsSync(replacement)) {
    console.error(
      `Replacement file is missing: ${path.relative(root, replacement)}`,
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
  "last-2d-workstation-restart.json",
);

const trackedPaths = [
  ...replacements,
  "src/styles/reconstruction2dTheme.css",
];

const existedBefore = {};

function backup(relativePath) {
  const source = path.join(root, relativePath);
  const existed = fs.existsSync(source);

  existedBefore[relativePath] = existed;

  if (!existed) {
    return;
  }

  const destination = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(source, destination);
}

function restore() {
  console.log("\nRestoring the pre-installation files...");

  for (const relativePath of trackedPaths) {
    const destination = path.join(root, relativePath);
    const backupPath = path.join(
      backupRoot,
      relativePath,
    );

    if (existedBefore[relativePath]) {
      fs.mkdirSync(
        path.dirname(destination),
        { recursive: true },
      );

      fs.copyFileSync(
        backupPath,
        destination,
      );

      console.log(`RESTORED ${relativePath}`);
      continue;
    }

    if (fs.existsSync(destination)) {
      fs.rmSync(destination, {
        force: true,
      });

      console.log(`REMOVED ${relativePath}`);
    }
  }
}

for (const relativePath of trackedPaths) {
  backup(relativePath);
}

for (const relativePath of replacements) {
  const source = path.join(
    replacementRoot,
    relativePath,
  );

  const destination = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(source, destination);
  console.log(`WROTE ${relativePath}`);
}

/*
 * Remove the previous visual-only pass. The full main.tsx replacement no
 * longer imports it, but deleting it avoids stale files and confusion.
 */
const oldThemePath = path.join(
  root,
  "src/styles/reconstruction2dTheme.css",
);

if (fs.existsSync(oldThemePath)) {
  fs.rmSync(oldThemePath, {
    force: true,
  });

  console.log(
    "REMOVED src/styles/reconstruction2dTheme.css",
  );
}

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  restore();

  console.error(`
The new 2D workstation did not pass the production build.

Everything changed by this installer has been restored automatically.
Your repository is back at the state from before this installation.
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
RoadSafe 2D workstation restart installed successfully.

Structural result:
- the 2D Context Inspector is no longer inside the scene grid;
- it is now the reconstruction editor's true right-side panel;
- the scene, playback, timeline and workspace panels remain in the centre;
- the generic shell inspector is hidden while the 2D editor is active;
- 3D and AR component structures were not changed.

Full files replaced:
- src/components/reconstruction/AccidentReconstructionEditor.tsx
- src/main.tsx
- src/styles/reconstruction2DWorkstation.css

Start RoadSafe:
  npm run dev

Manual rollback:
  node revoke-2d-workstation-restart.mjs
`);
