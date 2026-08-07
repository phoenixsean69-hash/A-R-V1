import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const packagePath = path.join(root, "package.json");
const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const arPath = path.join(
  root,
  "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
);
const colourGuardPath = path.join(
  root,
  "src/styles/blenderColorGuard.css",
);

const twoDMarkupPath = path.join(
  scriptDir,
  "two-d-panel-markup.txt",
);
const arMarkupPath = path.join(
  scriptDir,
  "ar-panel-markup.txt",
);
const cssPayloadPath = path.join(
  scriptDir,
  "blender-properties-2d-ar-v5.css",
);

const backupRoot = path.join(root, ".roadsafe-ui-backup");
const statePath = path.join(
  backupRoot,
  "last-blender-properties-2d-ar-v5.json",
);

const CSS_START =
  "/* [RoadSafe:BlenderProperties2DARV5:start] */";
const CSS_END =
  "/* [RoadSafe:BlenderProperties2DARV5:end] */";

const V3_START =
  "/* [RoadSafe:BlenderRightPropertiesV3:start] */";
const V3_END =
  "/* [RoadSafe:BlenderRightPropertiesV3:end] */";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (pkg.name !== "roadsafe-ar") {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

for (const requiredPath of [
  editorPath,
  arPath,
  colourGuardPath,
  twoDMarkupPath,
  arMarkupPath,
  cssPayloadPath,
]) {
  if (!fs.existsSync(requiredPath)) {
    fail(`Required file missing: ${requiredPath}`);
  }
}

fs.mkdirSync(backupRoot, { recursive: true });

const originalEditor = fs.readFileSync(editorPath, "utf8");
const originalAR = fs.readFileSync(arPath, "utf8");
const originalColourGuard =
  fs.readFileSync(colourGuardPath, "utf8");

function restore() {
  fs.writeFileSync(editorPath, originalEditor, "utf8");
  fs.writeFileSync(arPath, originalAR, "utf8");
  fs.writeFileSync(
    colourGuardPath,
    originalColourGuard,
    "utf8",
  );
  console.log("Restored pre-V5 files.");
}

let editor = originalEditor;
let ar = originalAR;
let colourGuard = originalColourGuard;

/* ------------------------------------------------------------------ */
/* Remove the obsolete V3 fake-panel CSS if it is still present.      */
/* ------------------------------------------------------------------ */
{
  const start = colourGuard.indexOf(V3_START);
  if (start >= 0) {
    const end = colourGuard.indexOf(V3_END, start);
    if (end < 0) {
      fail(
        "Found an incomplete old V3 CSS block. Roll back V3 first.",
      );
    }
    colourGuard =
      colourGuard.slice(0, start) +
      colourGuard.slice(end + V3_END.length);
    console.log("REMOVED obsolete V3 pseudo-panel CSS.");
  }
}

/* Remove previous V5 CSS block for idempotence. */
{
  const start = colourGuard.indexOf(CSS_START);
  if (start >= 0) {
    const end = colourGuard.indexOf(CSS_END, start);
    if (end < 0) {
      fail("Found an incomplete previous V5 CSS block.");
    }
    colourGuard =
      colourGuard.slice(0, start) +
      colourGuard.slice(end + CSS_END.length);
  }
}

/* ------------------------------------------------------------------ */
/* 2D: type + state.                                                   */
/* ------------------------------------------------------------------ */

const cameraType =
  'type WorkspaceCameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";';

const twoDType =
`type Workspace2DPropertiesTab =
  | "participants"
  | "selection"
  | "motion"
  | "scene";`;

if (!editor.includes("type Workspace2DPropertiesTab =")) {
  if (!editor.includes(cameraType)) {
    fail("Could not locate WorkspaceCameraMode type.");
  }

  editor = editor.replace(
    cameraType,
    `${cameraType}\n\n${twoDType}`,
  );
}

const cameraStateRegex =
  /  const \[workspaceCameraMode, setWorkspaceCameraMode\]\s*=\s*\r?\n\s*useState<WorkspaceCameraMode>\("Orbit"\);/;

if (
  !editor.includes(
    "const [workspace2DPropertiesTab, setWorkspace2DPropertiesTab]",
  )
) {
  const match = editor.match(cameraStateRegex);
  if (!match) {
    fail("Could not locate workspaceCameraMode state.");
  }

  editor = editor.replace(
    match[0],
`${match[0]}
  const [workspace2DPropertiesTab, setWorkspace2DPropertiesTab] =
    useState<Workspace2DPropertiesTab>("participants");`,
  );
}

/* ------------------------------------------------------------------ */
/* 2D: replace the REAL portaled right inspector.                      */
/* ------------------------------------------------------------------ */

const old2DStart =
  '<aside\n                className="roadsafe-inspector workstation-panel workstation-panel--right roadsafe-reconstruction-inspector reconstruction-workspace__properties reconstruction-workspace__properties--2d reconstruction-workspace__context-panel reconstruction-workspace__shell-inspector is-docked is-open"';

const new2DStart =
  '<aside\n                className="roadsafe-inspector workstation-panel workstation-panel--right roadsafe-reconstruction-inspector reconstruction-workspace__properties reconstruction-workspace__properties--2d reconstruction-workspace__context-panel reconstruction-workspace__shell-inspector reconstruction-workspace__blender-properties reconstruction-workspace__blender-properties--2d-v5 is-docked is-open"';

const portalMarker =
  "\n            ),\n            workspaceRightPanelHost,";

let twoDStart = editor.indexOf(new2DStart);
if (twoDStart < 0) {
  twoDStart = editor.indexOf(old2DStart);
}

if (twoDStart < 0) {
  fail(
    "Could not locate the real portaled 2D reconstruction inspector.",
  );
}

const portalIndex = editor.indexOf(
  portalMarker,
  twoDStart,
);

if (portalIndex < 0) {
  fail(
    "Could not locate the end of the 2D inspector portal.",
  );
}

const twoDEnd =
  editor.lastIndexOf(
    "</aside>",
    portalIndex,
  );

if (
  twoDEnd < twoDStart
) {
  fail(
    "Could not isolate the real 2D inspector <aside>.",
  );
}

const twoDMarkup =
  fs.readFileSync(
    twoDMarkupPath,
    "utf8",
  ).trim();

editor =
  editor.slice(0, twoDStart) +
  twoDMarkup +
  editor.slice(twoDEnd + "</aside>".length);

/* ------------------------------------------------------------------ */
/* AR: add real property-panel state.                                  */
/* ------------------------------------------------------------------ */

const arType =
`type ARPropertiesTab =
  | "alignment"
  | "layers"
  | "playback"
  | "session";`;

if (!ar.includes("type ARPropertiesTab =")) {
  const defaultLayersAnchor =
    "const DEFAULT_LAYERS: ARLayerVisibility = {";

  if (!ar.includes(defaultLayersAnchor)) {
    fail("Could not locate AR DEFAULT_LAYERS anchor.");
  }

  ar = ar.replace(
    defaultLayersAnchor,
    `${arType}\n\n${defaultLayersAnchor}`,
  );
}

const arSessionStateRegex =
  /  const \[\s*sessionActive,\s*setSessionActive,\s*\]\s*=\s*\r?\n\s*useState\(false\);/;

if (!ar.includes("const [arPropertiesOpen, setARPropertiesOpen]")) {
  const match = ar.match(arSessionStateRegex);

  if (!match) {
    fail("Could not locate AR sessionActive state.");
  }

  ar = ar.replace(
    match[0],
`${match[0]}

  const [arPropertiesOpen, setARPropertiesOpen] =
    useState(true);

  const [arPropertiesTab, setARPropertiesTab] =
    useState<ARPropertiesTab>("alignment");`,
  );
}

/* ------------------------------------------------------------------ */
/* AR: remove old bottom heading/playback control panels.              */
/* Their functionality moves into the real right Properties editor.    */
/* ------------------------------------------------------------------ */

const headingMarker =
`          {calibrationStage ===
            "heading" && (`;

const playbackMarker =
`          {playbackReady && (`;

const locationMarker =
`          {location && (`;

{
  const headingStart = ar.indexOf(headingMarker);
  const playbackStart = ar.indexOf(playbackMarker);

  if (
    headingStart >= 0 &&
    playbackStart > headingStart
  ) {
    ar =
      ar.slice(0, headingStart) +
      ar.slice(playbackStart);
    console.log(
      "MOVED AR heading controls from bottom overlay into Properties.",
    );
  }
}

{
  const playbackStart = ar.indexOf(playbackMarker);
  const locationStart = ar.indexOf(
    locationMarker,
    playbackStart >= 0 ? playbackStart : 0,
  );

  if (
    playbackStart >= 0 &&
    locationStart > playbackStart
  ) {
    ar =
      ar.slice(0, playbackStart) +
      ar.slice(locationStart);
    console.log(
      "MOVED AR playback/layer controls from bottom overlay into Properties.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* AR: insert the real right panel into the active-session branch.     */
/* ------------------------------------------------------------------ */

const arPanelMarkup =
  fs.readFileSync(
    arMarkupPath,
    "utf8",
  ).trim();

if (!ar.includes("roadsafe-ar-blender-properties")) {
  const scanMarker =
`          {calibrationStage ===
            "scan" && (`;

  const scanIndex = ar.indexOf(scanMarker);

  if (scanIndex < 0) {
    fail(
      "Could not locate AR scan-stage insertion point.",
    );
  }

  ar =
    ar.slice(0, scanIndex) +
    `${arPanelMarkup}\n\n` +
    ar.slice(scanIndex);
}

/* ------------------------------------------------------------------ */
/* CSS payload.                                                        */
/* ------------------------------------------------------------------ */

const cssPayload =
  fs.readFileSync(
    cssPayloadPath,
    "utf8",
  ).trim();

if (
  !cssPayload.startsWith(CSS_START) ||
  !cssPayload.endsWith(CSS_END)
) {
  fail("V5 CSS payload markers are invalid.");
}

const openBraces =
  (cssPayload.match(/\{/g) ?? []).length;
const closeBraces =
  (cssPayload.match(/\}/g) ?? []).length;

if (openBraces !== closeBraces) {
  fail(
    `CSS brace audit failed: ${openBraces} opening / ${closeBraces} closing.`,
  );
}

colourGuard =
  `${colourGuard.trimEnd()}\n\n${cssPayload}\n`;

/* ------------------------------------------------------------------ */
/* Structural guards.                                                  */
/* ------------------------------------------------------------------ */

const editorTokens = [
  "type Workspace2DPropertiesTab =",
  "workspace2DPropertiesTab",
  "setWorkspace2DPropertiesTab",
  "reconstruction-workspace__blender-properties--2d-v5",
  'workspace2DPropertiesTab === "participants"',
  'workspace2DPropertiesTab === "selection"',
  'workspace2DPropertiesTab === "motion"',
  'workspace2DPropertiesTab === "scene"',
  "SceneObjectSettingsPanel",
  "ParticipantPathPanel",
  "getParticipantAssetsForType",
];

for (const token of editorTokens) {
  if (!editor.includes(token)) {
    fail(`2D structural guard failed: ${token}`);
  }
}

const arTokens = [
  "type ARPropertiesTab =",
  "arPropertiesOpen",
  "arPropertiesTab",
  "roadsafe-ar-blender-properties",
  'arPropertiesTab === "alignment"',
  'arPropertiesTab === "layers"',
  'arPropertiesTab === "playback"',
  'arPropertiesTab === "session"',
  "placeAtLatestHit",
  "lockAlignment",
  "toggleLayer",
  "restartPlayback",
];

for (const token of arTokens) {
  if (!ar.includes(token)) {
    fail(`AR structural guard failed: ${token}`);
  }
}

/* ------------------------------------------------------------------ */
/* Parse BOTH complete transformed TSX files before writing.           */
/* ------------------------------------------------------------------ */

try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");

  const parse = (name, content) => {
    const sf = ts.createSourceFile(
      name,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const diagnostics = sf.parseDiagnostics ?? [];

    if (diagnostics.length > 0) {
      const details = diagnostics
        .slice(0, 10)
        .map((diagnostic) => {
          const message =
            ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n",
            );

          if (typeof diagnostic.start !== "number") {
            return message;
          }

          const location =
            sf.getLineAndCharacterOfPosition(
              diagnostic.start,
            );

          return (
            `${name}:${location.line + 1}:` +
            `${location.character + 1} ${message}`
          );
        })
        .join("\n");

      fail(
        `TSX parse audit failed:\n${details}`,
      );
    }
  };

  parse(
    "AccidentReconstructionEditor.tsx",
    editor,
  );
  parse(
    "ARReconstructionViewer.tsx",
    ar,
  );

  console.log("2D + AR TSX parse audit: PASS");
} catch (error) {
  if (
    String(error).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; structural guards passed.",
    );
  } else {
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Backup + write.                                                     */
/* ------------------------------------------------------------------ */

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      editorPath: path.relative(root, editorPath),
      arPath: path.relative(root, arPath),
      colourGuardPath:
        path.relative(root, colourGuardPath),
      originalEditor,
      originalAR,
      originalColourGuard,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(editorPath, editor, "utf8");
fs.writeFileSync(arPath, ar, "utf8");
fs.writeFileSync(
  colourGuardPath,
  colourGuard,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Blender Properties 2D + AR V5 installed.",
);
console.log("");
console.log("2D:");
console.log("- Participants tab");
console.log("- Selection tab");
console.log("- Motion/route tab");
console.log("- Scene/basemap tab");
console.log("");
console.log("AR:");
console.log("- Alignment tab");
console.log("- Layers tab");
console.log("- Playback tab");
console.log("- Session tab");
console.log("");
console.log("Start:");
console.log("  npm run dev");
console.log("");
console.log("Recommended verification:");
console.log("  npm run build");
console.log("");
console.log("Rollback:");
console.log(
  "  node revoke-blender-properties-2d-ar-v5.mjs",
);
