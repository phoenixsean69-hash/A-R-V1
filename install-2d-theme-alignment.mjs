import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const mainRelativePath = "src/main.tsx";
const mainPath = path.join(root, mainRelativePath);
const cssRelativePath = "src/styles/reconstruction2dTheme.css";
const cssPath = path.join(root, cssRelativePath);

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
  console.error("Could not read package.json:", error);
  process.exit(1);
}

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

if (!fs.existsSync(mainPath)) {
  console.error("src/main.tsx was not found.");
  process.exit(1);
}

const requiredMarkers = [
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/AccidentTimeline.tsx",
];

for (const relativePath of requiredMarkers) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    console.error(`Required file not found: ${relativePath}`);
    process.exit(1);
  }
}

const editorSource = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  ),
  "utf8",
);

for (const marker of [
  "reconstruction-workspace__2d-grid",
  "reconstruction-workspace__properties--2d",
  "2D Context Inspector",
]) {
  if (!editorSource.includes(marker)) {
    console.error(
      `The current editor does not contain the expected marker: ${marker}`,
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

function backup(relativePath) {
  const source = path.join(root, relativePath);

  if (!fs.existsSync(source)) {
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

backup(mainRelativePath);
backup(cssRelativePath);

const css = "/*\n * RoadSafe 2D Reconstruction Theme — controlled visual-only pass\n *\n * Scope:\n *   Applies only while the 2D reconstruction view is active.\n *\n * Safety:\n *   No layout structure, React state, physics, playback, case persistence,\n *   participant logic or inspector behavior is changed by this stylesheet.\n */\n\n:root {\n  --rs2d-bg: #202020;\n  --rs2d-workspace: #292929;\n  --rs2d-panel: #303030;\n  --rs2d-panel-raised: #383838;\n  --rs2d-control-top: #454545;\n  --rs2d-control-bottom: #363636;\n  --rs2d-control-hover-top: #515151;\n  --rs2d-control-hover-bottom: #404040;\n  --rs2d-input: #262626;\n  --rs2d-border: #171717;\n  --rs2d-border-soft: #4a4a4a;\n  --rs2d-border-muted: #3d3d3d;\n  --rs2d-text: #dedede;\n  --rs2d-text-secondary: #b8b8b8;\n  --rs2d-text-muted: #929292;\n  --rs2d-blue: #365d86;\n  --rs2d-blue-hover: #426f9d;\n  --rs2d-blue-text: #9ab5cf;\n  --rs2d-orange: #e8872d;\n  --rs2d-danger: #7a3f4e;\n  --rs2d-danger-bg: #3b252b;\n}\n\n/* -------------------------------------------------------------------------\n   Active 2D editor scope\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  ) {\n  background: var(--rs2d-bg) !important;\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__body {\n  background: var(--rs2d-bg) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__header,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__toolbar {\n  border-color: var(--rs2d-border) !important;\n  background: linear-gradient(\n    180deg,\n    #343434 0%,\n    #292929 100%\n  ) !important;\n  backdrop-filter: none !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.04),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.5) !important;\n}\n\n/* -------------------------------------------------------------------------\n   Shared 2D panels and surfaces\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-workspace__canvas,\n    .reconstruction-workspace__context-panel,\n    .reconstruction-playback,\n    .reconstruction-timeline,\n    .reconstruction-workspace__workspace-panels,\n    .reconstruction-workspace__workspace-card,\n    .premium-investigation-card,\n    .premium-audit-metric\n  ) {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 3px !important;\n  background: var(--rs2d-panel) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.025),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.32) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(h1, h2, h3, h4, strong) {\n  text-shadow: none !important;\n}\n\n/* -------------------------------------------------------------------------\n   Scene card header and basemap controls\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child {\n  border-color: var(--rs2d-border) !important;\n  background: #292929 !important;\n  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.45) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child\n  h2 {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child\n  p {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"border-[#1d2c4b]\"] {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 3px !important;\n  background: #242424 !important;\n  box-shadow:\n    inset 0 1px 2px rgba(0, 0, 0, 0.48),\n    0 1px 0 rgba(255, 255, 255, 0.025) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"border-[#1d2c4b]\"]\n  button {\n  min-height: 28px;\n  border: 1px solid transparent !important;\n  border-radius: 2px !important;\n  background: transparent !important;\n  color: var(--rs2d-text-secondary) !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"border-[#1d2c4b]\"]\n  button[class*=\"bg-[#173c78]\"] {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-grid\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"border-[#1d2c4b]\"]\n  button:hover {\n  border-color: #676767 !important;\n  background: #3c3c3c !important;\n  color: #ffffff !important;\n}\n\n/* Compact semantic route chips: retain meaning without pastel web styling. */\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__canvas\n  > div:first-child\n  :is(\n    [class*=\"bg-green-100\"],\n    [class*=\"bg-amber-100\"],\n    [class*=\"bg-cyan-100\"],\n    [class*=\"bg-red-100\"]\n  ) {\n  border: 1px solid var(--rs2d-border-soft) !important;\n  border-radius: 2px !important;\n  background: #3a3a3a !important;\n  color: var(--rs2d-text-secondary) !important;\n  padding: 4px 7px !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"bg-green-100\"] {\n  border-left-color: #5d8068 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"bg-amber-100\"] {\n  border-left-color: #8d754c !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"bg-cyan-100\"] {\n  border-left-color: #4f7880 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__canvas\n  > div:first-child\n  [class*=\"bg-red-100\"] {\n  border-left-color: #85505a !important;\n}\n\n/* -------------------------------------------------------------------------\n   Scene tool rail, helper and map controls\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tools {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 3px !important;\n  background: rgba(42, 42, 42, 0.98) !important;\n  backdrop-filter: none !important;\n  box-shadow:\n    0 5px 14px rgba(0, 0, 0, 0.32),\n    inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tools\n  button {\n  border-radius: 2px !important;\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tools\n  button:hover {\n  border-color: #5a5a5a !important;\n  background: #3a3a3a !important;\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tools\n  button.is-active {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n  box-shadow:\n    inset 3px 0 0 var(--rs2d-orange),\n    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tools\n  button.is-active::after {\n  background: var(--rs2d-orange) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tool-hint {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 3px !important;\n  background: rgba(47, 47, 47, 0.98) !important;\n  backdrop-filter: none !important;\n  box-shadow:\n    0 5px 14px rgba(0, 0, 0, 0.28),\n    inset 0 1px 0 rgba(255, 255, 255, 0.025) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tool-hint\n  strong {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__tool-hint\n  span {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__map-controls {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 3px !important;\n  background: rgba(42, 42, 42, 0.98) !important;\n  backdrop-filter: none !important;\n  box-shadow:\n    0 5px 14px rgba(0, 0, 0, 0.3),\n    inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__map-controls\n  button {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: linear-gradient(\n    180deg,\n    var(--rs2d-control-top),\n    var(--rs2d-control-bottom)\n  ) !important;\n  color: var(--rs2d-text-secondary) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.05),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.4) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__map-controls\n  button:hover {\n  border-color: var(--rs2d-orange) !important;\n  background: linear-gradient(\n    180deg,\n    var(--rs2d-control-hover-top),\n    var(--rs2d-control-hover-bottom)\n  ) !important;\n  color: #ffffff !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__map-controls\n  span:last-child {\n  color: var(--rs2d-text-secondary) !important;\n}\n\n/* -------------------------------------------------------------------------\n   2D Context Inspector\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__properties--2d {\n  border-color: var(--rs2d-border) !important;\n  background: var(--rs2d-panel) !important;\n  box-shadow:\n    inset 1px 0 0 rgba(255, 255, 255, 0.025) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__context-scroll {\n  background: var(--rs2d-panel) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__2d-inspector-sticky {\n  border-color: var(--rs2d-border) !important;\n  background: #292929 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__panel-header {\n  border-color: var(--rs2d-border) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__panel-header\n  p {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__panel-header\n  span {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__inspector-count {\n  border-color: var(--rs2d-border-soft) !important;\n  border-radius: 2px !important;\n  background: #3a3a3a !important;\n  color: var(--rs2d-text) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.04),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.38) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__context-section {\n  border-color: var(--rs2d-border-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__context-title {\n  color: var(--rs2d-text-secondary) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-add\n  :is(select, button) {\n  min-height: 29px;\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-add\n  select {\n  background: var(--rs2d-input) !important;\n  color: var(--rs2d-text) !important;\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.48) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-add\n  button {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-add\n  button:hover {\n  border-color: var(--rs2d-orange) !important;\n  background: var(--rs2d-blue-hover) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-list\n  > button {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: #2a2a2a !important;\n  color: var(--rs2d-text-secondary) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.025),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.32) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-list\n  > button:hover {\n  border-color: #5d5d5d !important;\n  background: #363636 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-list\n  > button.is-active {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n  box-shadow:\n    inset 3px 0 0 var(--rs2d-orange),\n    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-copy\n  strong {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-copy\n  small {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__participant-points {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: #242424 !important;\n  color: var(--rs2d-text-secondary) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__property-list\n  > :is(div, label) {\n  border-color: var(--rs2d-border-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__property-list\n  span {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__property-list\n  strong {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__properties--2d\n  :is(\n    input:not([type=\"range\"]),\n    select,\n    textarea\n  ) {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: var(--rs2d-input) !important;\n  color: var(--rs2d-text) !important;\n  box-shadow:\n    inset 0 1px 3px rgba(0, 0, 0, 0.48),\n    0 1px 0 rgba(255, 255, 255, 0.02) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__properties--2d\n  :is(input, select, textarea):focus {\n  border-color: var(--rs2d-orange) !important;\n  outline: 1px solid var(--rs2d-orange) !important;\n  outline-offset: 0 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__speed-control,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__telemetry-grid\n  > div,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__layer-list\n  label {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: #2a2a2a !important;\n  color: var(--rs2d-text-secondary) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  input[type=\"range\"],\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  input[type=\"checkbox\"],\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  input[type=\"radio\"] {\n  accent-color: var(--rs2d-blue) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__delete-participant {\n  border-color: var(--rs2d-danger) !important;\n  border-radius: 2px !important;\n  background: var(--rs2d-danger-bg) !important;\n  color: #dcb0bc !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__delete-participant:hover {\n  border-color: var(--rs2d-orange) !important;\n  background: #4a2932 !important;\n  color: #ffffff !important;\n}\n\n/* Embedded participant-path controls still carry old navy utility classes. */\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__properties--2d\n  [class*=\"bg-[#0\"] {\n  background: #2a2a2a !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__properties--2d\n  [class*=\"border-[#1\"] {\n  border-color: var(--rs2d-border) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__properties--2d\n  :is(\n    button[class*=\"bg-blue-\"],\n    button[class*=\"bg-[#1\"]\n  ) {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n}\n\n/* -------------------------------------------------------------------------\n   Playback strip\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback {\n  border-color: var(--rs2d-border) !important;\n  background: var(--rs2d-panel) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__scrubber {\n  background: #242424 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__progress {\n  background: var(--rs2d-blue) !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__controls {\n  border-color: var(--rs2d-border) !important;\n  background: var(--rs2d-panel) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__transport\n  button,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__speed\n  select {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: linear-gradient(\n    180deg,\n    var(--rs2d-control-top),\n    var(--rs2d-control-bottom)\n  ) !important;\n  color: var(--rs2d-text) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.05),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.42) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__transport\n  .reconstruction-playback__play {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__transport\n  button:hover {\n  border-color: var(--rs2d-orange) !important;\n  background: linear-gradient(\n    180deg,\n    var(--rs2d-control-hover-top),\n    var(--rs2d-control-hover-bottom)\n  ) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-playback__clock\n  strong {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-playback__clock span,\n    .reconstruction-playback__summary,\n    .reconstruction-playback__speed\n  ) {\n  color: var(--rs2d-text-muted) !important;\n}\n\n/* -------------------------------------------------------------------------\n   Interactive timeline\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline {\n  border-color: var(--rs2d-border) !important;\n  background: var(--rs2d-panel) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.025),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.32) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-timeline__header,\n    .reconstruction-timeline__scrubber,\n    .reconstruction-timeline__labels,\n    .reconstruction-timeline__ruler,\n    .reconstruction-timeline__inspector\n  ) {\n  border-color: var(--rs2d-border) !important;\n  background: var(--rs2d-panel) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__eyebrow {\n  color: var(--rs2d-blue-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__header\n  h2 {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__header\n  p:not(.reconstruction-timeline__eyebrow) {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__actions\n  button {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: linear-gradient(\n    180deg,\n    var(--rs2d-control-top),\n    var(--rs2d-control-bottom)\n  ) !important;\n  color: var(--rs2d-text-secondary) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.05),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.42) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__actions\n  button:is(:hover, .is-active),\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__actions\n  .reconstruction-timeline__add {\n  border-color: var(--rs2d-blue) !important;\n  background: var(--rs2d-blue) !important;\n  color: #ffffff !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__viewport {\n  border-color: var(--rs2d-border) !important;\n  background: #252525 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__label {\n  border-color: var(--rs2d-border) !important;\n  background: #2a2a2a !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__label\n  strong {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__label\n  small {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-timeline__scroll,\n    .reconstruction-timeline__surface,\n    .reconstruction-timeline__track\n  ) {\n  background: #242424 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__track:hover {\n  background: #2e2e2e !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-timeline__track-line,\n    .reconstruction-timeline__grid-line\n  ) {\n  border-color: #3b3b3b !important;\n  background: #3b3b3b !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__cursor {\n  background: var(--rs2d-orange) !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__marker {\n  border-color: var(--rs2d-border-soft) !important;\n  border-radius: 2px !important;\n  background: #333333 !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__marker:is(\n    :hover,\n    .is-selected\n  ) {\n  border-color: var(--rs2d-orange) !important;\n  background: #3d3d3d !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__empty,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__selected-event,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-timeline__editor {\n  border-color: var(--rs2d-border-muted) !important;\n  background: #2a2a2a !important;\n  color: var(--rs2d-text-secondary) !important;\n}\n\n/* -------------------------------------------------------------------------\n   Workspace setup and lower investigation modules\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__workspace-panels-toggle,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__workspace-card-header,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .premium-investigation-card\n  > summary {\n  border-color: var(--rs2d-border) !important;\n  background: #2c2c2c !important;\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-workspace__workspace-panels-icon,\n    .reconstruction-workspace__workspace-card-icon\n  ) {\n  border-color: var(--rs2d-border-soft) !important;\n  border-radius: 3px !important;\n  background: #3a3a3a !important;\n  color: var(--rs2d-blue-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__workspace-panels-heading\n  strong,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__workspace-card-header\n  h3 {\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  :is(\n    .reconstruction-workspace__workspace-panels-heading small,\n    .reconstruction-workspace__workspace-card-header p,\n    .reconstruction-workspace__workspace-panels-summary\n  ) {\n  color: var(--rs2d-text-muted) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__embedded-panel\n  > div,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__embedded-panel\n  details,\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .premium-audit-metric {\n  border-color: var(--rs2d-border-muted) !important;\n  border-radius: 2px !important;\n  background: #2a2a2a !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__workspace-field\n  :is(input:not([type=\"range\"]), textarea, select),\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__embedded-panel\n  :is(input:not([type=\"range\"]), textarea, select) {\n  border-color: var(--rs2d-border) !important;\n  border-radius: 2px !important;\n  background: var(--rs2d-input) !important;\n  color: var(--rs2d-text) !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__modules\n  :is(\n    [class*=\"bg-[#0\"],\n    [class*=\"bg-[#1\"]\n  ) {\n  background: #2a2a2a !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  .reconstruction-workspace__modules\n  :is(\n    [class*=\"border-[#1\"],\n    [class*=\"border-[#2\"]\n  ) {\n  border-color: var(--rs2d-border-muted) !important;\n}\n\n/* -------------------------------------------------------------------------\n   Scrollbars local to the 2D workstation\n   ------------------------------------------------------------------------- */\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  ::-webkit-scrollbar-track {\n  background: #242424 !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  ::-webkit-scrollbar-thumb {\n  border-color: #242424 !important;\n  border-radius: 2px !important;\n  background: #4b4b4b !important;\n}\n\n.reconstruction-editor:has(\n    .reconstruction-workspace__2d-grid:not(.hidden)\n  )\n  ::-webkit-scrollbar-thumb:hover {\n  background: #5a5a5a !important;\n}\n\n/* Keep smaller screens usable without altering the existing responsive layout. */\n@media (max-width: 860px) {\n  .reconstruction-editor:has(\n      .reconstruction-workspace__2d-grid:not(.hidden)\n    )\n    .reconstruction-workspace__context-panel {\n    border-top-color: var(--rs2d-border) !important;\n  }\n}\n";

fs.mkdirSync(
  path.dirname(cssPath),
  { recursive: true },
);

fs.writeFileSync(
  cssPath,
  css,
  "utf8",
);

console.log(`WROTE ${cssRelativePath}`);

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const importLine =
  'import "./styles/reconstruction2dTheme.css";';

mainSource = mainSource
  .replace(
    /^\s*import\s+["']\.\/styles\/reconstruction2dTheme\.css["'];?\s*$/gm,
    "",
  )
  .replace(/\n{3,}/g, "\n\n");

const cssImports =
  mainSource.match(
    /^import\s+["'][^"']+\.css["'];?$/gm,
  ) ?? [];

if (cssImports.length > 0) {
  const lastCssImport =
    cssImports[cssImports.length - 1];

  mainSource = mainSource.replace(
    lastCssImport,
    `${lastCssImport}\n${importLine}`,
  );
} else {
  mainSource =
    `${importLine}\n${mainSource}`;
}

fs.writeFileSync(
  mainPath,
  mainSource,
  "utf8",
);

console.log(
  "CHANGED src/main.tsx — 2D theme imported last",
);
console.log(
  `Backups saved under ${path.relative(root, backupRoot)}`,
);

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(`
The CSS-only 2D theme was installed, but the build failed.

Revoke only this visual pass with:
  node revoke-2d-theme-alignment.mjs

The installer did not modify reconstruction React components, physics, playback,
participants, case data or inspector behavior.
`);
  process.exit(1);
}

console.log(`
RoadSafe 2D theme alignment completed successfully.

Changed only:
  src/styles/reconstruction2dTheme.css
  src/main.tsx (one stylesheet import)

Not changed:
  AccidentReconstructionEditor.tsx
  AccidentTimeline.tsx
  reconstruction physics
  playback logic
  participant data
  inspector layout or behavior
  3D and AR themes

Start RoadSafe:
  npm run dev
`);
