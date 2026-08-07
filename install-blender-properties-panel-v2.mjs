import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const packagePath = path.join(root, "package.json");
const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const cssTargetPath = path.join(
  root,
  "src/styles/blenderPropertiesPanelV2.css",
);
const cssPayloadPath = path.join(
  scriptDir,
  "blenderPropertiesPanelV2.css",
);

const backupRoot = path.join(root, ".roadsafe-ui-backup");
const statePath = path.join(
  backupRoot,
  "last-blender-properties-panel-v2.json",
);
const buildLogPath = path.join(
  backupRoot,
  "blender-properties-v2-build.log",
);

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  stop("Run this installer from the A-R-V1 repository root.");
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  stop(
    `Expected package "roadsafe-ar", found "${packageJson.name ?? "unknown"}".`,
  );
}

if (!fs.existsSync(editorPath)) {
  stop("Could not find AccidentReconstructionEditor.tsx.");
}

if (!fs.existsSync(cssPayloadPath)) {
  stop("blenderPropertiesPanelV2.css is missing beside the installer.");
}

fs.mkdirSync(backupRoot, { recursive: true });

const originalEditor = fs.readFileSync(editorPath, "utf8");
const originalCss = fs.existsSync(cssTargetPath)
  ? fs.readFileSync(cssTargetPath, "utf8")
  : null;

function restore() {
  fs.writeFileSync(editorPath, originalEditor, "utf8");

  if (originalCss === null) {
    fs.rmSync(cssTargetPath, { force: true });
  } else {
    fs.writeFileSync(cssTargetPath, originalCss, "utf8");
  }

  console.log("Restored pre-Blender-properties V2 files.");
}

let source = originalEditor;

/* CSS import */
const cssImport =
  'import "../../styles/blenderPropertiesPanelV2.css";';

if (!source.includes(cssImport)) {
  const anchor =
    'import "./participantPlacement.css";';

  if (!source.includes(anchor)) {
    stop("Could not locate the reconstruction CSS import anchor.");
  }

  source = source.replace(
    anchor,
    `${anchor}\n${cssImport}`,
  );
}

/* 3D inspector class only */
const originalAside =
  '<aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel">';

const blenderAside =
  '<aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel reconstruction-workspace__properties--blender-v2">';

if (!source.includes(blenderAside)) {
  if (!source.includes(originalAside)) {
    stop("Could not locate the 3D Context Inspector.");
  }

  source = source.replace(
    originalAside,
    blenderAside,
  );
}

/* Passive icon rail only — no new state, handlers, ids, or conditional wrapping. */
const scrollAnchor =
  '<div className="reconstruction-workspace__context-scroll">';

if (!source.includes("blender-properties-rail-v2")) {
  const asideIndex = source.indexOf(blenderAside);
  const scrollIndex = source.indexOf(
    scrollAnchor,
    asideIndex,
  );

  if (scrollIndex < 0) {
    stop("Could not locate the 3D inspector scroll body.");
  }

  const rail = `<div
                  className="blender-properties-rail-v2"
                  aria-hidden="true"
                >
                  <span className="blender-properties-rail-v2__item is-active" title="Participant">
                    <Crosshair size={15} />
                  </span>
                  <span className="blender-properties-rail-v2__item" title="Camera">
                    <Camera size={15} />
                  </span>
                  <span className="blender-properties-rail-v2__item" title="Layers">
                    <Layers3 size={15} />
                  </span>
                  <span className="blender-properties-rail-v2__item" title="Physics">
                    <Activity size={15} />
                  </span>
                  <span className="blender-properties-rail-v2__item" title="Scene">
                    <ClipboardList size={15} />
                  </span>
                </div>

                ${scrollAnchor}`;

  source =
    source.slice(0, scrollIndex) +
    rail +
    source.slice(scrollIndex + scrollAnchor.length);
}

/* Pre-write guards */
const guards = [
  [
    source.includes(
      "reconstruction-workspace__properties--blender-v2",
    ),
    "Blender V2 inspector class",
  ],
  [
    source.includes(
      "blender-properties-rail-v2",
    ),
    "Blender V2 passive property rail",
  ],
  [
    source.includes(
      "reconstruction-workspace__segmented-grid",
    ),
    "Camera controls remain present",
  ],
  [
    source.includes(
      "reconstruction-workspace__layer-list",
    ),
    "Layers controls remain present",
  ],
  [
    source.includes(
      "reconstruction-workspace__telemetry-grid",
    ),
    "Physics telemetry remains present",
  ],
];

for (const [passed, label] of guards) {
  if (!passed) {
    stop(`Structural verification failed: ${label}`);
  }
}

fs.writeFileSync(editorPath, source, "utf8");
fs.writeFileSync(
  cssTargetPath,
  fs.readFileSync(cssPayloadPath, "utf8"),
  "utf8",
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      editorPath: path.relative(root, editorPath),
      cssPath: path.relative(root, cssTargetPath),
      originalEditor,
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

console.log("Blender properties panel V2 structural audit: PASS");
console.log("");
console.log("Running TypeScript/project build...");

const build = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  {
    cwd: root,
    encoding: "utf8",
    shell: false,
  },
);

const buildOutput =
  `${build.stdout ?? ""}${build.stderr ?? ""}`;

fs.writeFileSync(
  buildLogPath,
  buildOutput,
  "utf8",
);

if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);

if (build.status !== 0) {
  console.error("");
  console.error("Build failed.");
  console.error(
    `Full build output saved to: ${path.relative(root, buildLogPath)}`,
  );
  console.error(
    "Restoring pre-Blender-properties V2 files...",
  );

  restore();
  fs.rmSync(statePath, { force: true });

  console.error("");
  console.error(
    "The build log was intentionally kept for diagnosis.",
  );

  process.exit(build.status ?? 1);
}

console.log("");
console.log(
  "RoadSafe Blender-style Properties Panel V2 installed successfully.",
);
console.log("");
console.log("V2 is CSS-first:");
console.log("- passive Blender-style left property rail;");
console.log("- compact participant rows;");
console.log("- compact camera controls;");
console.log("- compact layer rows;");
console.log("- compact physics telemetry;");
console.log("- compact scene rows;");
console.log("- no new React state;");
console.log("- no conditional JSX wrapping;");
console.log("- no physics/model/timeline changes.");
console.log("");
console.log("Start:");
console.log("npm run dev");
console.log("");
console.log("Rollback:");
console.log("node revoke-blender-properties-panel-v2.mjs");
