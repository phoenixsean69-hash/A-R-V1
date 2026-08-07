
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const packagePath =
  path.join(
    root,
    "package.json",
  );

const cssPath =
  path.join(
    root,
    "src/components/reconstruction/reconstructionBottomDock.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-3d-full-workspace-fill-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "3d-full-workspace-fill-v1-build.log",
  );

const START =
  "/* [RoadSafe:3DFullWorkspaceFillV1:start] */";

const END =
  "/* [RoadSafe:3DFullWorkspaceFillV1:end] */";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

if (
  pkg.name !==
  "roadsafe-ar"
) {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

if (!fs.existsSync(cssPath)) {
  fail(
    "Could not find reconstructionBottomDock.css.",
  );
}

const originalCss =
  fs.readFileSync(
    cssPath,
    "utf8",
  );

let css =
  originalCss;

/* Remove an earlier copy if V1 is re-run. */
const oldStart =
  css.indexOf(
    START,
  );

if (oldStart >= 0) {
  const oldEnd =
    css.indexOf(
      END,
      oldStart,
    );

  if (oldEnd < 0) {
    fail(
      "Found an incomplete previous 3D full-workspace patch.",
    );
  }

  css =
    css.slice(
      0,
      oldStart,
    ) +
    css.slice(
      oldEnd +
        END.length,
    );
}

const patch = `
${START}

/*
 * The original workstation layout predates the AppShell Properties portal.
 * It reserves a second internal grid column for the old inline inspector:
 *
 *   minmax(0, 1fr) minmax(270px, 300px)
 *
 * Properties now lives in .roadsafe-workspace-context-slot, so the 3D centre
 * must never reserve that legacy column.
 *
 * These selectors deliberately DO NOT depend on
 * .has-reconstruction-bottom-dock. The 3D viewport owns the entire available
 * centre whether the bottom editor is open, collapsed, or temporarily absent.
 */

.reconstruction-workspace--3d
  > .reconstruction-workspace__body {
  width: 100% !important;
  height: 100% !important;

  min-width: 0 !important;
  min-height: 0 !important;

  display: block !important;

  margin: 0 !important;
  padding: 0 !important;

  overflow: hidden !important;
}

.reconstruction-workspace--3d
  .reconstruction-workspace__stage-grid--3d {
  width: 100% !important;
  height: 100% !important;

  min-width: 0 !important;
  min-height: 0 !important;

  display: grid !important;

  grid-template-columns:
    minmax(0, 1fr) !important;

  grid-template-rows:
    minmax(0, 1fr) !important;

  gap: 0 !important;

  margin: 0 !important;
  padding: 0 !important;

  overflow: hidden !important;
}

.reconstruction-workspace--3d
  .reconstruction-workspace__stage-grid--3d
  > .reconstruction-workspace__stage-main {
  grid-column:
    1 / -1 !important;

  grid-row:
    1 !important;

  width: 100% !important;
  height: 100% !important;

  min-width: 0 !important;
  min-height: 0 !important;

  max-width: none !important;
  max-height: none !important;

  margin: 0 !important;
  padding: 0 !important;

  overflow: hidden !important;
}

/*
 * Defeat the legacy:
 *   height: min(64vh, 720px);
 *   min-height: 520px;
 *
 * The viewport now fills the editor area between the top workspace header and
 * the current bottom dock height.
 */
.reconstruction-workspace--3d
  .reconstruction-workspace__stage-main
  > .reconstruction-3d--workspace,
.reconstruction-workspace--3d
  .reconstruction-3d.reconstruction-3d--workspace {
  width: 100% !important;
  height: 100% !important;

  min-width: 0 !important;
  min-height: 0 !important;

  max-width: none !important;
  max-height: none !important;

  flex: 1 1 auto !important;

  margin: 0 !important;

  border: 0 !important;
  border-radius: 0 !important;

  overflow: hidden !important;

  box-shadow: none !important;
}

/* Three.js mount and renderer own all remaining stage space. */
.reconstruction-workspace--3d
  .reconstruction-3d--workspace
  > div {
  min-width: 0 !important;
  min-height: 0 !important;
}

.reconstruction-workspace--3d
  .reconstruction-3d--workspace
  canvas {
  display: block !important;

  width: 100% !important;
  height: 100% !important;

  max-width: none !important;
  max-height: none !important;
}

/*
 * If the legacy closed Inspector button is still emitted as a child of the 3D
 * stage grid, keep it as a small overlay instead of allowing it to create a
 * second grid track or row.
 */
.reconstruction-workspace--3d
  .reconstruction-workspace__stage-grid--3d
  > .reconstruction-workspace__inspector-tab {
  position: absolute !important;

  z-index: 95 !important;

  top: 8px !important;
  right: 8px !important;

  width: auto !important;
  height: auto !important;

  margin: 0 !important;
}

/*
 * The stage needs a positioning context for the tool rail, hint and optional
 * closed-inspector button, while the renderer still fills the whole area.
 */
.reconstruction-workspace--3d
  .reconstruction-workspace__stage-main {
  position: relative !important;
}

${END}
`;

css =
  `${css.trimEnd()}\n\n${patch.trim()}\n`;

for (const token of [
  START,
  "grid-template-columns:",
  "minmax(0, 1fr) !important;",
  ".reconstruction-3d.reconstruction-3d--workspace",
  "height: 100% !important;",
]) {
  if (!css.includes(token)) {
    fail(
      `3D full-workspace CSS audit failed: ${token}`,
    );
  }
}

if (
  css.split(
    START,
  ).length !== 2
) {
  fail(
    "Expected exactly one 3D full-workspace patch block.",
  );
}

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      cssPath:
        path.relative(
          root,
          cssPath,
        ),
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  cssPath,
  css,
  "utf8",
);

console.log(
  "3D full-workspace CSS installed.",
);

console.log(
  "Running build...",
);

const command =
  process.platform ===
  "win32"
    ? {
        executable:
          process.env.ComSpec ||
          "C:\\Windows\\System32\\cmd.exe",
        args: [
          "/d",
          "/s",
          "/c",
          "npm run build",
        ],
      }
    : {
        executable:
          "npm",
        args: [
          "run",
          "build",
        ],
      };

const build =
  spawnSync(
    command.executable,
    command.args,
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      env: process.env,
    },
  );

const output =
  [
    "RoadSafe 3D Full Workspace Fill V1",
    "==================================",
    `status: ${String(
      build.status,
    )}`,
    `error: ${
      build.error
        ? `${build.error.name}: ${build.error.message}`
        : "none"
    }`,
    "",
    "STDOUT",
    "------",
    build.stdout ?? "",
    "",
    "STDERR",
    "------",
    build.stderr ?? "",
  ].join(
    "\n",
  );

fs.writeFileSync(
  buildLogPath,
  output,
  "utf8",
);

if (build.stdout) {
  process.stdout.write(
    build.stdout,
  );
}

if (build.stderr) {
  process.stderr.write(
    build.stderr,
  );
}

if (
  build.status === null ||
  build.status !== 0
) {
  fs.writeFileSync(
    cssPath,
    originalCss,
    "utf8",
  );

  fs.rmSync(
    statePath,
    {
      force: true,
    },
  );

  console.error("");
  console.error(
    "Build failed; CSS was restored automatically.",
  );

  console.error(
    `Build log: ${path.relative(
      root,
      buildLogPath,
    )}`,
  );

  process.exit(
    build.status ??
      1,
  );
}

console.log("");
console.log(
  "RoadSafe 3D Full Workspace Fill V1 installed successfully.",
);

console.log(
  "3D now uses one centre column and 100% of the available editor height.",
);

console.log("");
console.log(
  "Start / refresh:",
);

console.log(
  "  npm run dev",
);

console.log("");
console.log(
  "Rollback:",
);

console.log(
  "  node revoke-3d-full-workspace-fill-v1.mjs",
);
