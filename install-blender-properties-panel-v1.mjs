import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const cssTargetPath = path.join(
  root,
  "src/styles/blenderPropertiesPanelV1.css",
);
const cssPayloadPath = path.join(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "blenderPropertiesPanelV1.css",
);

const BACKUP_ROOT = path.join(root, ".roadsafe-ui-backup");
const STATE_PATH = path.join(
  BACKUP_ROOT,
  "last-blender-properties-panel-v1.json",
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  fail("Run this installer from the A-R-V1 repository root.");
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  fail(
    `Expected package "roadsafe-ar", found "${packageJson.name ?? "unknown"}".`,
  );
}

if (!fs.existsSync(editorPath)) {
  fail("Could not find AccidentReconstructionEditor.tsx.");
}

if (!fs.existsSync(cssPayloadPath)) {
  fail("blenderPropertiesPanelV1.css is missing beside the installer.");
}

fs.mkdirSync(BACKUP_ROOT, { recursive: true });

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

  console.log("Restored pre-Blender-properties files.");
}

let source = originalEditor;

/*
 * --------------------------------------------------------------------------
 * 1. CSS import
 * --------------------------------------------------------------------------
 */

const cssImport =
  'import "../../styles/blenderPropertiesPanelV1.css";';

if (!source.includes(cssImport)) {
  const localCssAnchor =
    'import "./participantPlacement.css";';

  if (!source.includes(localCssAnchor)) {
    fail(
      "Could not locate reconstruction component CSS import anchor.",
    );
  }

  source = source.replace(
    localCssAnchor,
    `${localCssAnchor}\n${cssImport}`,
  );
}

/*
 * --------------------------------------------------------------------------
 * 2. Active Blender property-tab state
 * --------------------------------------------------------------------------
 */

const tabStateMarker =
  "const [blenderPropertiesTab, setBlenderPropertiesTab]";

if (!source.includes(tabStateMarker)) {
  const cameraStateRegex =
    /const \[workspaceCameraMode, setWorkspaceCameraMode\]\s*=\s*\r?\n?\s*useState<WorkspaceCameraMode>\("Orbit"\);/;

  const match = source.match(cameraStateRegex);

  if (!match) {
    fail("Could not locate workspaceCameraMode state.");
  }

  source = source.replace(
    match[0],
`${match[0]}
  const [blenderPropertiesTab, setBlenderPropertiesTab] = useState<
    "object" | "camera" | "layers" | "physics" | "scene"
  >("object");`,
  );
}

/*
 * --------------------------------------------------------------------------
 * 3. Isolate the 3D context inspector only
 * --------------------------------------------------------------------------
 */

const asideNeedle =
  '<aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel">';

const asideStart = source.indexOf(asideNeedle);

if (asideStart < 0) {
  fail("Could not locate the 3D Context Inspector aside.");
}

const asideEndToken = "</aside>";
const asideEnd =
  source.indexOf(
    asideEndToken,
    asideStart,
  );

if (asideEnd < 0) {
  fail("Could not isolate the 3D Context Inspector.");
}

let inspector =
  source.slice(
    asideStart,
    asideEnd + asideEndToken.length,
  );

inspector = inspector.replace(
  asideNeedle,
  '<aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel reconstruction-workspace__properties--blender">',
);

/*
 * --------------------------------------------------------------------------
 * 4. Add Blender-style vertical properties rail
 * --------------------------------------------------------------------------
 */

if (!inspector.includes("blender-properties-rail")) {
  const scrollAnchor =
    '<div className="reconstruction-workspace__context-scroll">';

  if (!inspector.includes(scrollAnchor)) {
    fail("Could not locate 3D inspector scroll body.");
  }

  const rail = `
                <nav
                  className="blender-properties-rail"
                  aria-label="3D inspector property categories"
                >
                  <button
                    type="button"
                    className={\`blender-properties-rail__button \${blenderPropertiesTab === "object" ? "is-active" : ""}\`}
                    aria-pressed={blenderPropertiesTab === "object"}
                    title="Participant properties"
                    onClick={() => {
                      setBlenderPropertiesTab("object");
                      document
                        .getElementById("roadsafe-props-object")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                  >
                    <Crosshair size={15} />
                  </button>
                  <button
                    type="button"
                    className={\`blender-properties-rail__button \${blenderPropertiesTab === "camera" ? "is-active" : ""}\`}
                    aria-pressed={blenderPropertiesTab === "camera"}
                    title="Camera"
                    onClick={() => {
                      setBlenderPropertiesTab("camera");
                      document
                        .getElementById("roadsafe-props-camera")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                  >
                    <Camera size={15} />
                  </button>
                  <button
                    type="button"
                    className={\`blender-properties-rail__button \${blenderPropertiesTab === "layers" ? "is-active" : ""}\`}
                    aria-pressed={blenderPropertiesTab === "layers"}
                    title="Layers and overlays"
                    onClick={() => {
                      setBlenderPropertiesTab("layers");
                      document
                        .getElementById("roadsafe-props-layers")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                  >
                    <Layers3 size={15} />
                  </button>
                  <button
                    type="button"
                    className={\`blender-properties-rail__button \${blenderPropertiesTab === "physics" ? "is-active" : ""}\`}
                    aria-pressed={blenderPropertiesTab === "physics"}
                    title="Physics telemetry"
                    onClick={() => {
                      setBlenderPropertiesTab("physics");
                      document
                        .getElementById("roadsafe-props-physics")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                  >
                    <Activity size={15} />
                  </button>
                  <button
                    type="button"
                    className={\`blender-properties-rail__button \${blenderPropertiesTab === "scene" ? "is-active" : ""}\`}
                    aria-pressed={blenderPropertiesTab === "scene"}
                    title="Scene environment"
                    onClick={() => {
                      setBlenderPropertiesTab("scene");
                      document
                        .getElementById("roadsafe-props-scene")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                  >
                    <ClipboardList size={15} />
                  </button>
                </nav>

                ${scrollAnchor}`;

  inspector = inspector.replace(
    scrollAnchor,
    rail,
  );
}

/*
 * --------------------------------------------------------------------------
 * 5. Give the participant area a Blender-like section header
 * --------------------------------------------------------------------------
 */

if (!inspector.includes('id="roadsafe-props-object"')) {
  const selectedAnchor =
    "{selectedParticipant && selectedParticipantState ? (";

  if (!inspector.includes(selectedAnchor)) {
    fail("Could not locate selected participant properties in 3D inspector.");
  }

  inspector = inspector.replace(
    selectedAnchor,
`<div
                  id="roadsafe-props-object"
                  className="blender-properties-object-section"
                >
                  <div className="blender-properties-section-heading">
                    <Crosshair size={12} />
                    Participant
                  </div>
                ${selectedAnchor}`,
  );

  const selectedCloseAnchor = `
                ) : (
                  <div className="reconstruction-workspace__empty-properties">
                    Select a participant in the 3D scene to inspect its motion,
                    mass, heading and collision response.
                  </div>
                )}`;

  if (!inspector.includes(selectedCloseAnchor)) {
    fail("Could not close the Blender participant section safely.");
  }

  inspector = inspector.replace(
    selectedCloseAnchor,
`${selectedCloseAnchor}
                </div>`,
  );
}

/*
 * --------------------------------------------------------------------------
 * 6. Section IDs for rail navigation
 * --------------------------------------------------------------------------
 */

const sectionPatches = [
  [
    `<div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Camera size={13} />
                    Camera`,
    `<div
                  id="roadsafe-props-camera"
                  className="reconstruction-workspace__context-section"
                >
                  <div className="reconstruction-workspace__context-title">
                    <Camera size={13} />
                    Camera`,
  ],
  [
    `<div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Layers3 size={13} />
                    Layers and overlays`,
    `<div
                  id="roadsafe-props-layers"
                  className="reconstruction-workspace__context-section"
                >
                  <div className="reconstruction-workspace__context-title">
                    <Layers3 size={13} />
                    Layers and overlays`,
  ],
  [
    `<div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Activity size={13} />
                    Physics telemetry`,
    `<div
                  id="roadsafe-props-physics"
                  className="reconstruction-workspace__context-section"
                >
                  <div className="reconstruction-workspace__context-title">
                    <Activity size={13} />
                    Physics telemetry`,
  ],
  [
    `<div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">Scene environment</div>`,
    `<div
                  id="roadsafe-props-scene"
                  className="reconstruction-workspace__context-section"
                >
                  <div className="reconstruction-workspace__context-title">Scene environment</div>`,
  ],
];

for (const [before, after] of sectionPatches) {
  if (!inspector.includes(after)) {
    if (!inspector.includes(before)) {
      fail(
        "Could not locate one of the 3D inspector sections for Blender rail navigation.",
      );
    }

    inspector = inspector.replace(
      before,
      after,
    );
  }
}

source =
  source.slice(0, asideStart) +
  inspector +
  source.slice(asideEnd + asideEndToken.length);

/*
 * --------------------------------------------------------------------------
 * 7. Write + verify
 * --------------------------------------------------------------------------
 */

fs.writeFileSync(
  editorPath,
  source,
  "utf8",
);

fs.writeFileSync(
  cssTargetPath,
  fs.readFileSync(cssPayloadPath, "utf8"),
  "utf8",
);

const verificationChecks = [
  [
    source.includes(
      "reconstruction-workspace__properties--blender",
    ),
    "Blender inspector class",
  ],
  [
    source.includes(
      "blender-properties-rail",
    ),
    "property icon rail",
  ],
  [
    source.includes(
      'id="roadsafe-props-object"',
    ),
    "participant section anchor",
  ],
  [
    source.includes(
      'id="roadsafe-props-camera"',
    ),
    "camera section anchor",
  ],
  [
    source.includes(
      'id="roadsafe-props-layers"',
    ),
    "layers section anchor",
  ],
  [
    source.includes(
      'id="roadsafe-props-physics"',
    ),
    "physics section anchor",
  ],
  [
    source.includes(
      'id="roadsafe-props-scene"',
    ),
    "scene section anchor",
  ],
  [
    fs.existsSync(cssTargetPath),
    "Blender panel stylesheet",
  ],
];

for (const [passed, label] of verificationChecks) {
  if (!passed) {
    restore();
    fail(`Verification failed: ${label}`);
  }
}

const state = {
  installedAt: new Date().toISOString(),
  editorPath: path.relative(root, editorPath),
  cssPath: path.relative(root, cssTargetPath),
  originalEditor,
  originalCss,
};

fs.writeFileSync(
  STATE_PATH,
  JSON.stringify(state),
  "utf8",
);

console.log("Blender properties panel structural audit: PASS");
console.log("");
console.log("Running full project build...");

const build =
  spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    {
      cwd: root,
      stdio: "inherit",
      shell: false,
    },
  );

if (build.status !== 0) {
  console.error("");
  console.error(
    "Build failed. Restoring pre-Blender-properties files...",
  );
  restore();
  fs.rmSync(STATE_PATH, { force: true });
  process.exit(build.status ?? 1);
}

console.log("");
console.log(
  "RoadSafe Blender-style Properties Panel V1 installed successfully.",
);
console.log("");
console.log("What changed:");
console.log("- vertical Blender-style property category rail;");
console.log("- compact participant/property rows;");
console.log("- compact Camera selector;");
console.log("- compact Layers/overlays rows;");
console.log("- compact Physics telemetry;");
console.log("- compact Scene environment;");
console.log("- RoadSafe gray + #E8872D selection accent;");
console.log("- no reconstruction/physics/model behavior changed.");
console.log("");
console.log("Start:");
console.log("npm run dev");
console.log("");
console.log("Rollback:");
console.log("node revoke-blender-properties-panel-v1.mjs");
