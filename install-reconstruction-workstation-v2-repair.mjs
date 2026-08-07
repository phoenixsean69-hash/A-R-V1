import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

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

const files = {
  editor:
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  arViewer:
    "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
  main:
    "src/main.tsx",
  css:
    "src/styles/reconstructionWorkstationV2.css",
};

for (const key of ["editor", "arViewer", "main"]) {
  const absolutePath = path.join(root, files[key]);

  if (!fs.existsSync(absolutePath)) {
    console.error(
      `Required file was not found: ${files[key]}`,
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

function write(relativePath, content) {
  backup(relativePath);

  const absolutePath = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(absolutePath),
    { recursive: true },
  );

  fs.writeFileSync(
    absolutePath,
    content,
    "utf8",
  );

  console.log(`CHANGED ${relativePath}`);
}

function ensureClass(
  classValue,
  requiredClass,
) {
  const classes = classValue
    .split(/\s+/)
    .filter(Boolean);

  if (!classes.includes(requiredClass)) {
    classes.push(requiredClass);
  }

  return classes.join(" ");
}

/*
 * --------------------------------------------------------------------------
 * AccidentReconstructionEditor semantic hooks
 * --------------------------------------------------------------------------
 */
{
  const relativePath = files.editor;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  const original = source;

  /*
   * Root hook. Supports both the original literal class and an already-dynamic
   * class produced by a previous attempt.
   */
  if (
    !source.includes(
      "data-reconstruction-view=",
    )
  ) {
    const literalRoot =
      '<div className="reconstruction-editor reconstruction-workspace">';

    if (source.includes(literalRoot)) {
      source = source.replace(
        literalRoot,
        `<div
      className={\`reconstruction-editor reconstruction-workspace reconstruction-workspace--\${activeReconstructionView.toLowerCase()}\`}
      data-reconstruction-view={activeReconstructionView.toLowerCase()}
    >`,
      );
    } else {
      source = source.replace(
        /<div\s+className=\{`reconstruction-editor reconstruction-workspace([^`]*)`\}\s*>/,
        `<div
      className={\`reconstruction-editor reconstruction-workspace$1\`}
      data-reconstruction-view={activeReconstructionView.toLowerCase()}
    >`,
      );
    }
  }

  /*
   * 3D inspector hook.
   */
  source = source.replace(
    /className="([^"]*\breconstruction-workspace__properties\b(?![^"]*\breconstruction-workspace__properties--2d\b)[^"]*\breconstruction-workspace__context-panel\b[^"]*)"/,
    (_, classValue) =>
      `className="${ensureClass(
        ensureClass(
          classValue,
          "reconstruction-workspace__dock-inspector",
        ),
        "reconstruction-workspace__dock-inspector--3d",
      )}"`,
  );

  /*
   * 2D inspector hook.
   */
  source = source.replace(
    /className="([^"]*\breconstruction-workspace__properties--2d\b[^"]*)"/,
    (_, classValue) =>
      `className="${ensureClass(
        ensureClass(
          classValue,
          "reconstruction-workspace__dock-inspector",
        ),
        "reconstruction-workspace__dock-inspector--2d",
      )}"`,
  );

  if (
    !source.includes(
      "reconstruction-workspace__dock-inspector--2d",
    )
  ) {
    console.error(
      "Could not find the existing 2D Context Inspector in AccidentReconstructionEditor.tsx.",
    );
    process.exit(1);
  }

  if (
    !source.includes(
      "reconstruction-workspace__dock-inspector--3d",
    )
  ) {
    console.error(
      "Could not find the existing 3D Context Inspector in AccidentReconstructionEditor.tsx.",
    );
    process.exit(1);
  }

  if (source !== original) {
    write(relativePath, source);
  } else {
    console.log(
      `UNCHANGED ${relativePath} (hooks already present)`,
    );
  }
}

/*
 * --------------------------------------------------------------------------
 * AR semantic hooks
 * --------------------------------------------------------------------------
 */
{
  const relativePath = files.arViewer;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  const original = source;

  source = source.replace(
    /className="relative h-\[100dvh\] min-h-\[620px\] w-full overflow-hidden(?: bg-\[[^\]]+\])?"/,
    'className="roadsafe-ar-workstation relative h-[100dvh] min-h-[620px] w-full overflow-hidden"',
  );

  source = source.replace(
    /className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3"/,
    'className="roadsafe-ar-workstation__header pointer-events-none absolute inset-x-0 top-0 z-30 p-3"',
  );

  source = source.replace(
    /className="pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4"/,
    'className="roadsafe-ar-workstation__inspector roadsafe-ar-workstation__inspector--scan pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4"',
  );

  let bottomPanelIndex = 0;

  source = source.replace(
    /className="pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3"/g,
    () => {
      bottomPanelIndex += 1;

      return bottomPanelIndex === 1
        ? 'className="roadsafe-ar-workstation__inspector roadsafe-ar-workstation__inspector--heading pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3"'
        : 'className="roadsafe-ar-workstation__inspector roadsafe-ar-workstation__inspector--playback pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3"';
    },
  );

  if (
    !source.includes(
      "roadsafe-ar-workstation",
    )
  ) {
    console.error(
      "Could not find the AR viewer root container.",
    );
    process.exit(1);
  }

  if (
    !source.includes(
      "roadsafe-ar-workstation__inspector--scan",
    )
  ) {
    console.error(
      "Could not find the AR scan panel.",
    );
    process.exit(1);
  }

  if (
    !source.includes(
      "roadsafe-ar-workstation__inspector--heading",
    )
  ) {
    console.error(
      "Could not find the AR heading panel.",
    );
    process.exit(1);
  }

  if (
    !source.includes(
      "roadsafe-ar-workstation__inspector--playback",
    )
  ) {
    console.error(
      "Could not find the AR playback panel.",
    );
    process.exit(1);
  }

  if (source !== original) {
    write(relativePath, source);
  } else {
    console.log(
      `UNCHANGED ${relativePath} (hooks already present)`,
    );
  }
}

/*
 * --------------------------------------------------------------------------
 * Reconstruction workstation CSS
 * --------------------------------------------------------------------------
 */
const stylesheet = String.raw`/*
 * RoadSafe Reconstruction Workstation V2
 *
 * Uses the editor's own 2D, 3D and AR inspectors as the actual right-side
 * workstation column.
 */

:root {
  --rs-recon-bg: #1b1b1b;
  --rs-recon-panel: #2b2b2b;
  --rs-recon-panel-raised: #333333;
  --rs-recon-panel-hover: #3a3a3a;
  --rs-recon-input: #202020;
  --rs-recon-border: #151515;
  --rs-recon-border-soft: #494949;
  --rs-recon-text: #dedede;
  --rs-recon-muted: #999999;
  --rs-recon-blue: #365d86;
  --rs-recon-blue-hover: #436f9e;
  --rs-recon-orange: #e8872d;
  --rs-recon-inspector-width:
    clamp(330px, 24vw, 390px);
}

/*
 * Detect the live editor instead of depending on a page wrapper. This works
 * regardless of how CaseReconstructionPage.tsx has been formatted or migrated.
 */
@supports selector(.roadsafe-workstation:has(*)) {
  .roadsafe-workstation:has(
      .reconstruction-editor
    ),
  .roadsafe-workstation:has(
      .roadsafe-ar-workstation
    ) {
    grid-template-columns:
      var(--js-navigation-width, 214px)
      minmax(0, 1fr) !important;
  }

  .roadsafe-workstation.is-navigation-collapsed:has(
      .reconstruction-editor
    ),
  .roadsafe-workstation.is-navigation-collapsed:has(
      .roadsafe-ar-workstation
    ) {
    grid-template-columns:
      var(
        --js-navigation-collapsed-width,
        58px
      )
      minmax(0, 1fr) !important;
  }

  .roadsafe-workstation:has(
      .reconstruction-editor
    )
    > .roadsafe-inspector,
  .roadsafe-workstation:has(
      .roadsafe-ar-workstation
    )
    > .roadsafe-inspector,
  .roadsafe-workstation:has(
      .reconstruction-editor
    )
    .roadsafe-inspector-toggle,
  .roadsafe-workstation:has(
      .roadsafe-ar-workstation
    )
    .roadsafe-inspector-toggle,
  .roadsafe-workstation:has(
      .reconstruction-editor
    )
    .roadsafe-editor-inspector-toggle,
  .roadsafe-workstation:has(
      .roadsafe-ar-workstation
    )
    .roadsafe-editor-inspector-toggle {
    display: none !important;
  }
}

.reconstruction-editor,
.reconstruction-workspace {
  min-width: 0;
  min-height: 100dvh;
  background:
    var(--rs-recon-bg) !important;
  color:
    var(--rs-recon-text) !important;
}

.reconstruction-workspace__header,
.reconstruction-workspace__toolbar {
  background:
    linear-gradient(
      180deg,
      #343434 0%,
      #292929 100%
    ) !important;
  border-color:
    var(--rs-recon-border) !important;
  box-shadow:
    inset 0 1px 0
      rgba(255, 255, 255, 0.05),
    inset 0 -1px 0
      rgba(0, 0, 0, 0.5) !important;
}

.reconstruction-workspace__header {
  position: sticky;
  top: 0;
  z-index: 70;
}

.reconstruction-workspace__body {
  display: grid !important;
  grid-template-columns:
    minmax(0, 1fr)
    var(--rs-recon-inspector-width);
  align-items: start;
  min-width: 0;
  background:
    var(--rs-recon-bg) !important;
}

/*
 * Flatten the old internal view grids into the workstation grid.
 */
.reconstruction-workspace__2d-grid:not(
    .hidden
  ),
.reconstruction-workspace__stage-grid--3d {
  display: contents !important;
}

.reconstruction-workspace__2d-grid.hidden {
  display: none !important;
}

.reconstruction-workspace__stage-main,
.reconstruction-workspace__canvas,
.reconstruction-workspace__body
  > *:not(
    .reconstruction-workspace__2d-grid
  ):not(
    .reconstruction-workspace__stage-grid--3d
  ) {
  grid-column: 1;
  min-width: 0;
}

.reconstruction-workspace__dock-inspector {
  grid-column: 2 !important;
  grid-row: 1 / span 999;
  position: sticky !important;
  top: 0;
  align-self: start;
  width: 100% !important;
  min-width: 0 !important;
  height: 100dvh !important;
  max-height: 100dvh !important;
  overflow: hidden !important;
  margin: 0 !important;
  border: 0 !important;
  border-left:
    1px solid
    var(--rs-recon-border) !important;
  border-radius: 0 !important;
  background:
    var(--rs-recon-panel) !important;
  box-shadow:
    -1px 0 0
      rgba(255, 255, 255, 0.025) !important;
}

.reconstruction-workspace__context-scroll {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    var(--rs-recon-panel) !important;
}

.reconstruction-workspace__panel-header,
.reconstruction-workspace__2d-inspector-sticky {
  background:
    linear-gradient(
      180deg,
      #343434,
      #2b2b2b
    ) !important;
  border-color:
    var(--rs-recon-border) !important;
}

.reconstruction-workspace__panel-header {
  position: sticky;
  top: 0;
  z-index: 8;
  min-height: 58px;
  padding: 10px 12px;
}

.reconstruction-workspace__panel-header p {
  color:
    var(--rs-recon-text) !important;
  font-size: 11px !important;
  letter-spacing: 0.08em;
}

.reconstruction-workspace__panel-header span {
  color:
    var(--rs-recon-muted) !important;
}

/*
 * Neutralize the legacy navy surface system.
 */
.reconstruction-editor .ui-panel,
.reconstruction-editor
  .reconstruction-workspace__canvas,
.reconstruction-editor
  .reconstruction-workspace__timeline,
.reconstruction-editor
  .reconstruction-workspace__properties,
.reconstruction-editor
  [class*="bg-[#0"] {
  background:
    var(--rs-recon-panel) !important;
  border-color:
    var(--rs-recon-border) !important;
  box-shadow: none !important;
}

.reconstruction-editor
  [class*="border-[#1"],
.reconstruction-editor
  [class*="border-[#2"],
.reconstruction-editor
  [class*="border-[#3"],
.roadsafe-ar-workstation
  [class*="border-[#1"],
.roadsafe-ar-workstation
  [class*="border-[#2"],
.roadsafe-ar-workstation
  [class*="border-[#3"] {
  border-color:
    var(--rs-recon-border-soft) !important;
}

.reconstruction-editor
  input:not([type="range"]),
.reconstruction-editor select,
.reconstruction-editor textarea,
.roadsafe-ar-workstation
  input:not([type="range"]),
.roadsafe-ar-workstation select,
.roadsafe-ar-workstation textarea {
  border:
    1px solid
    var(--rs-recon-border-soft) !important;
  border-radius: 2px !important;
  background:
    var(--rs-recon-input) !important;
  color:
    var(--rs-recon-text) !important;
  box-shadow:
    inset 0 1px 2px
      rgba(0, 0, 0, 0.38) !important;
}

.reconstruction-editor input:focus,
.reconstruction-editor select:focus,
.reconstruction-editor textarea:focus,
.roadsafe-ar-workstation input:focus,
.roadsafe-ar-workstation select:focus,
.roadsafe-ar-workstation textarea:focus {
  border-color:
    var(--rs-recon-orange) !important;
  outline: none !important;
  box-shadow:
    0 0 0 1px
      var(--rs-recon-orange) !important;
}

.reconstruction-editor button,
.reconstruction-editor .ui-button,
.reconstruction-editor .ui-icon-button,
.roadsafe-ar-workstation button,
.roadsafe-ar-workstation .ui-button,
.roadsafe-ar-workstation
  .ui-icon-button {
  border-radius: 2px !important;
}

.reconstruction-editor .ui-button,
.reconstruction-editor
  .ui-icon-button,
.reconstruction-editor
  .reconstruction-workspace__button,
.reconstruction-editor
  .reconstruction-workspace__icon-button,
.roadsafe-ar-workstation .ui-button,
.roadsafe-ar-workstation
  .ui-icon-button {
  border:
    1px solid
    var(--rs-recon-border-soft) !important;
  background:
    linear-gradient(
      180deg,
      #414141,
      #303030
    ) !important;
  color:
    var(--rs-recon-text) !important;
  box-shadow:
    inset 0 1px 0
      rgba(255, 255, 255, 0.06),
    inset 0 -1px 0
      rgba(0, 0, 0, 0.45) !important;
}

.reconstruction-editor
  .ui-button-primary,
.reconstruction-editor
  button.is-active,
.reconstruction-editor
  .reconstruction-workspace__view-switch
  button.is-active,
.roadsafe-ar-workstation
  .ui-button-primary {
  border-color:
    var(--rs-recon-blue) !important;
  background:
    var(--rs-recon-blue) !important;
  color: #fff !important;
}

.reconstruction-editor
  .ui-button:hover,
.reconstruction-editor
  .ui-icon-button:hover,
.reconstruction-editor
  .reconstruction-workspace__button:hover,
.reconstruction-editor
  .reconstruction-workspace__icon-button:hover,
.roadsafe-ar-workstation
  .ui-button:hover,
.roadsafe-ar-workstation
  .ui-icon-button:hover {
  border-color:
    var(--rs-recon-orange) !important;
  color: #fff !important;
}

.reconstruction-editor
  .ui-button-primary:hover,
.roadsafe-ar-workstation
  .ui-button-primary:hover {
  border-color:
    var(--rs-recon-orange) !important;
  background:
    var(--rs-recon-blue-hover) !important;
}

.reconstruction-editor
  .reconstruction-workspace__timeline,
.reconstruction-editor
  .premium-investigation-workspace,
.reconstruction-editor
  .premium-investigation-card,
.reconstruction-editor
  .premium-audit-metric {
  border-radius: 2px !important;
  background:
    var(--rs-recon-panel) !important;
  border-color:
    var(--rs-recon-border-soft) !important;
}

.reconstruction-editor
  .accident-timeline,
.reconstruction-editor
  .accident-timeline__tracks,
.reconstruction-editor
  .accident-timeline__track,
.reconstruction-editor
  .accident-timeline__header {
  background:
    var(--rs-recon-panel) !important;
  border-color:
    var(--rs-recon-border) !important;
}

.reconstruction-editor h1,
.reconstruction-editor h2,
.reconstruction-editor h3,
.reconstruction-editor h4 {
  color:
    var(--rs-recon-text) !important;
}

.reconstruction-editor
  [class*="text-[#7"],
.reconstruction-editor
  [class*="text-[#8"] {
  color: #8eacc9 !important;
}

.reconstruction-editor
  [class*="shadow-["] {
  box-shadow: none !important;
}

/*
 * AR uses the exact same right-column workstation model.
 */
.roadsafe-ar-workstation {
  background:
    var(--rs-recon-bg) !important;
}

.roadsafe-ar-workstation__header {
  right:
    var(--rs-recon-inspector-width) !important;
}

.roadsafe-ar-workstation__header
  > div {
  max-width: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  border-color:
    var(--rs-recon-border-soft) !important;
  background:
    rgba(43, 43, 43, 0.96) !important;
  backdrop-filter: none !important;
}

.roadsafe-ar-workstation__inspector {
  inset:
    0 0 0 auto !important;
  width:
    var(--rs-recon-inspector-width) !important;
  height: 100dvh !important;
  padding: 0 !important;
}

.roadsafe-ar-workstation__inspector
  > section {
  position: relative;
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  margin: 0 !important;
  overflow-x: hidden;
  overflow-y: auto;
  border: 0 !important;
  border-left:
    1px solid
    var(--rs-recon-border) !important;
  border-radius: 0 !important;
  background:
    var(--rs-recon-panel) !important;
  padding:
    58px 14px 18px !important;
  backdrop-filter: none !important;
  box-shadow:
    -1px 0 0
      rgba(255, 255, 255, 0.025) !important;
}

.roadsafe-ar-workstation__inspector
  > section::before {
  content: "AR CONTEXT INSPECTOR";
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  min-height: 46px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-bottom:
    1px solid
    var(--rs-recon-border);
  background:
    linear-gradient(
      180deg,
      #343434,
      #2b2b2b
    );
  color:
    var(--rs-recon-text);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.roadsafe-ar-workstation
  [class*="backdrop-blur"] {
  backdrop-filter: none !important;
}

.roadsafe-ar-workstation
  [class*="bg-[#03"],
.roadsafe-ar-workstation
  [class*="bg-[#06"],
.roadsafe-ar-workstation
  [class*="bg-[#07"],
.roadsafe-ar-workstation
  [class*="bg-[#0b"] {
  background:
    var(--rs-recon-panel) !important;
}

.roadsafe-ar-workstation
  [class*="text-[#79"],
.roadsafe-ar-workstation
  [class*="text-[#8e"] {
  color: #8eacc9 !important;
}

@media (max-width: 1050px) {
  .reconstruction-workspace__body {
    display: block !important;
  }

  .reconstruction-workspace__2d-grid:not(
      .hidden
    ),
  .reconstruction-workspace__stage-grid--3d {
    display: block !important;
  }

  .reconstruction-workspace__dock-inspector {
    position: relative !important;
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
    border-top:
      1px solid
      var(--rs-recon-border) !important;
    border-left: 0 !important;
  }

  .roadsafe-ar-workstation__header {
    right: 0 !important;
  }

  .roadsafe-ar-workstation__inspector {
    inset:
      auto 0 0 0 !important;
    width: 100% !important;
    height:
      min(52dvh, 520px) !important;
  }

  .roadsafe-ar-workstation__inspector
    > section {
    border-top:
      1px solid
      var(--rs-recon-border) !important;
    border-left: 0 !important;
  }
}
`;

write(files.css, stylesheet);

/*
 * Import the stylesheet last.
 */
{
  const relativePath = files.main;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  const importLine =
    'import "./styles/reconstructionWorkstationV2.css";';

  if (!source.includes(importLine)) {
    const importMatches =
      source.match(
        /^import\s+["'][^"']+\.css["'];?$/gm,
      ) ?? [];

    if (importMatches.length > 0) {
      const lastImport =
        importMatches[
          importMatches.length - 1
        ];

      source = source.replace(
        lastImport,
        `${lastImport}\n${importLine}`,
      );
    } else {
      source =
        `${importLine}\n${source}`;
    }

    write(relativePath, source);
  } else {
    console.log(
      `UNCHANGED ${relativePath} (stylesheet already imported)`,
    );
  }
}

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
The reconstruction workstation was installed, but the build failed.

Your previous files are backed up under:
  ${path.relative(root, backupRoot)}
`);
  process.exit(1);
}

console.log(`
RoadSafe Reconstruction Workstation V2 repair completed.

This version did not modify:
- src/pages/CaseReconstructionPage.tsx
- src/pages/CaseARReconstructionPage.tsx

It detects the live reconstruction editor directly, so prior formatting and UI
migrations cannot break the installer.

Start RoadSafe:
  npm run dev
`);
