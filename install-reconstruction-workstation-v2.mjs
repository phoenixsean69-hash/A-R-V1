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

const paths = {
  caseReconstruction:
    "src/pages/CaseReconstructionPage.tsx",
  caseAR:
    "src/pages/CaseARReconstructionPage.tsx",
  editor:
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  arViewer:
    "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
  main:
    "src/main.tsx",
  css:
    "src/styles/reconstructionWorkstationV2.css",
};

for (const key of [
  "caseReconstruction",
  "caseAR",
  "editor",
  "arViewer",
  "main",
]) {
  const absolutePath = path.join(
    root,
    paths[key],
  );

  if (!fs.existsSync(absolutePath)) {
    console.error(
      `Required file not found: ${paths[key]}`,
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

  fs.copyFileSync(
    source,
    destination,
  );
}

function write(relativePath, content) {
  backup(relativePath);

  const destination = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.writeFileSync(
    destination,
    content,
    "utf8",
  );

  console.log(`CHANGED ${relativePath}`);
}

function replaceOnce(
  source,
  search,
  replacement,
  description,
) {
  if (!source.includes(search)) {
    return {
      source,
      changed: false,
      description,
    };
  }

  return {
    source: source.replace(
      search,
      replacement,
    ),
    changed: true,
    description,
  };
}

/*
 * --------------------------------------------------------------------------
 * Case reconstruction route wrapper
 * --------------------------------------------------------------------------
 */
{
  const relativePath =
    paths.caseReconstruction;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  if (
    !source.includes(
      'className="roadsafe-case-reconstruction-route"',
    )
  ) {
    const opening =
      "  return (\n    <ReconstructionErrorBoundary";

    const closing =
      "    </ReconstructionErrorBoundary>\n  );";

    if (
      !source.includes(opening) ||
      !source.includes(closing)
    ) {
      console.error(
        "Could not locate the successful CaseReconstructionPage return block.",
      );
      process.exit(1);
    }

    source = source.replace(
      opening,
      `  return (
    <div className="roadsafe-case-reconstruction-route">
      <ReconstructionErrorBoundary`,
    );

    source = source.replace(
      closing,
      `      </ReconstructionErrorBoundary>
    </div>
  );`,
    );

    write(relativePath, source);
  }
}

/*
 * --------------------------------------------------------------------------
 * AR route wrapper
 * --------------------------------------------------------------------------
 */
{
  const relativePath = paths.caseAR;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  if (
    !source.includes(
      'className="roadsafe-case-ar-route"',
    )
  ) {
    const opening =
      "  return (\n    <ARReconstructionViewer";

    const closing =
      "    />\n  );\n}";

    if (
      !source.includes(opening) ||
      !source.includes(closing)
    ) {
      console.error(
        "Could not locate the successful CaseARReconstructionPage return block.",
      );
      process.exit(1);
    }

    source = source.replace(
      opening,
      `  return (
    <div className="roadsafe-case-ar-route">
      <ARReconstructionViewer`,
    );

    source = source.replace(
      closing,
      `      />
    </div>
  );
}`,
    );

    write(relativePath, source);
  }
}

/*
 * --------------------------------------------------------------------------
 * Reconstruction editor semantic hooks
 * --------------------------------------------------------------------------
 */
{
  const relativePath = paths.editor;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  source = source.replace(
    '<div className="reconstruction-editor reconstruction-workspace">',
    `<div
      className={\`reconstruction-editor reconstruction-workspace reconstruction-workspace--\${activeReconstructionView.toLowerCase()}\`}
      data-reconstruction-view={activeReconstructionView.toLowerCase()}
    >`,
  );

  source = source.replace(
    'className="reconstruction-workspace__properties reconstruction-workspace__context-panel"',
    'className="reconstruction-workspace__properties reconstruction-workspace__context-panel reconstruction-workspace__dock-inspector reconstruction-workspace__dock-inspector--3d"',
  );

  source = source.replace(
    'className="ui-panel reconstruction-workspace__properties reconstruction-workspace__properties--2d reconstruction-workspace__context-panel is-open"',
    'className="ui-panel reconstruction-workspace__properties reconstruction-workspace__properties--2d reconstruction-workspace__context-panel reconstruction-workspace__dock-inspector reconstruction-workspace__dock-inspector--2d is-open"',
  );

  if (
    !source.includes(
      "reconstruction-workspace__dock-inspector--2d",
    ) ||
    !source.includes(
      "reconstruction-workspace__dock-inspector--3d",
    )
  ) {
    console.error(
      "Could not attach both 2D and 3D inspector hooks.",
    );
    process.exit(1);
  }

  write(relativePath, source);
}

/*
 * --------------------------------------------------------------------------
 * AR semantic hooks
 * --------------------------------------------------------------------------
 */
{
  const relativePath = paths.arViewer;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  source = source.replace(
    'className="relative h-[100dvh] min-h-[620px] w-full overflow-hidden bg-[#02050c]"',
    'className="roadsafe-ar-workstation relative h-[100dvh] min-h-[620px] w-full overflow-hidden"',
  );

  source = source.replace(
    'className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3"',
    'className="roadsafe-ar-workstation__header pointer-events-none absolute inset-x-0 top-0 z-30 p-3"',
  );

  source = source.replace(
    'className="pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4"',
    'className="roadsafe-ar-workstation__inspector roadsafe-ar-workstation__inspector--scan pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4"',
  );

  const headingClass =
    'className="pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3"';

  source = source.replace(
    headingClass,
    'className="roadsafe-ar-workstation__inspector roadsafe-ar-workstation__inspector--heading pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3"',
  );

  source = source.replace(
    headingClass,
    'className="roadsafe-ar-workstation__inspector roadsafe-ar-workstation__inspector--playback pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3"',
  );

  if (
    !source.includes(
      "roadsafe-ar-workstation__inspector--scan",
    ) ||
    !source.includes(
      "roadsafe-ar-workstation__inspector--heading",
    ) ||
    !source.includes(
      "roadsafe-ar-workstation__inspector--playback",
    )
  ) {
    console.error(
      "Could not attach the AR inspector hooks.",
    );
    process.exit(1);
  }

  write(relativePath, source);
}

/*
 * --------------------------------------------------------------------------
 * Final reconstruction workstation stylesheet
 * --------------------------------------------------------------------------
 */
const stylesheet = String.raw`/*
 * RoadSafe Reconstruction Workstation V2
 *
 * Flattens the legacy nested blue editor into the same charcoal workstation
 * language used by the application shell.
 */

:root {
  --rs-recon-bg: #1b1b1b;
  --rs-recon-panel: #2b2b2b;
  --rs-recon-panel-raised: #333333;
  --rs-recon-panel-hover: #3a3a3a;
  --rs-recon-input: #202020;
  --rs-recon-border: #151515;
  --rs-recon-border-soft: #484848;
  --rs-recon-text: #dedede;
  --rs-recon-muted: #9a9a9a;
  --rs-recon-blue: #365d86;
  --rs-recon-blue-hover: #436f9e;
  --rs-recon-orange: #e8872d;
  --rs-recon-inspector-width: clamp(
    330px,
    24vw,
    390px
  );
}

/*
 * Reconstruction routes use the editor's own 2D/3D/AR context inspector.
 * The generic case inspector must not occupy a second right column.
 */
@supports selector(.roadsafe-workstation:has(*)) {
  .roadsafe-workstation:has(
      .roadsafe-case-reconstruction-route
    ),
  .roadsafe-workstation:has(
      .roadsafe-case-ar-route
    ) {
    grid-template-columns:
      var(--js-navigation-width, 214px)
      minmax(0, 1fr) !important;
  }

  .roadsafe-workstation.is-navigation-collapsed:has(
      .roadsafe-case-reconstruction-route
    ),
  .roadsafe-workstation.is-navigation-collapsed:has(
      .roadsafe-case-ar-route
    ) {
    grid-template-columns:
      var(
        --js-navigation-collapsed-width,
        58px
      )
      minmax(0, 1fr) !important;
  }

  .roadsafe-workstation:has(
      .roadsafe-case-reconstruction-route
    )
    > .roadsafe-inspector,
  .roadsafe-workstation:has(
      .roadsafe-case-ar-route
    )
    > .roadsafe-inspector,
  .roadsafe-workstation:has(
      .roadsafe-case-reconstruction-route
    )
    .roadsafe-inspector-toggle,
  .roadsafe-workstation:has(
      .roadsafe-case-ar-route
    )
    .roadsafe-inspector-toggle,
  .roadsafe-workstation:has(
      .roadsafe-case-reconstruction-route
    )
    .roadsafe-editor-inspector-toggle,
  .roadsafe-workstation:has(
      .roadsafe-case-ar-route
    )
    .roadsafe-editor-inspector-toggle {
    display: none !important;
  }
}

.roadsafe-case-reconstruction-route,
.roadsafe-case-ar-route {
  min-width: 0;
  min-height: 100%;
  background: var(--rs-recon-bg);
  color: var(--rs-recon-text);
}

/*
 * Main editor shell
 */
.roadsafe-case-reconstruction-route
  .reconstruction-editor,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace {
  min-width: 0;
  min-height: 100dvh;
  background: var(--rs-recon-bg) !important;
  color: var(--rs-recon-text);
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__header,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__toolbar {
  background:
    linear-gradient(
      180deg,
      #343434 0%,
      #292929 100%
    ) !important;
  border-color: var(--rs-recon-border) !important;
  box-shadow:
    inset 0 1px 0
      rgba(255, 255, 255, 0.05),
    inset 0 -1px 0
      rgba(0, 0, 0, 0.5) !important;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__header {
  position: sticky;
  top: 0;
  z-index: 70;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__body {
  display: grid !important;
  grid-template-columns:
    minmax(0, 1fr)
    var(--rs-recon-inspector-width);
  align-items: start;
  min-width: 0;
  background: var(--rs-recon-bg);
}

/*
 * The existing 2D and 3D wrappers become transparent grid groupings. Their
 * stage remains in the centre column and their context panel occupies one
 * continuous right workstation column.
 */
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__2d-grid:not(
    .hidden
  ),
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__stage-grid--3d {
  display: contents !important;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__2d-grid.hidden {
  display: none !important;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__stage-main,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__canvas,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__body
  > *:not(
    .reconstruction-workspace__2d-grid
  ):not(
    .reconstruction-workspace__stage-grid--3d
  ) {
  grid-column: 1;
  min-width: 0;
}

/*
 * One real dock for both views.
 */
.roadsafe-case-reconstruction-route
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

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__context-scroll {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    var(--rs-recon-panel) !important;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__panel-header,
.roadsafe-case-reconstruction-route
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

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__panel-header {
  position: sticky;
  top: 0;
  z-index: 8;
  min-height: 58px;
  padding: 10px 12px;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__panel-header
  p {
  color: var(--rs-recon-text) !important;
  font-size: 11px !important;
  letter-spacing: 0.08em;
}

.roadsafe-case-reconstruction-route
  .reconstruction-workspace__panel-header
  span {
  color: var(--rs-recon-muted) !important;
}

/*
 * Legacy navy panels become neutral Blender-style charcoal.
 */
.roadsafe-case-reconstruction-route
  .ui-panel,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__canvas,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__timeline,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__properties,
.roadsafe-case-reconstruction-route
  [class*="bg-[#0"],
.roadsafe-case-ar-route
  [class*="bg-[#0"] {
  background:
    var(--rs-recon-panel) !important;
  border-color:
    var(--rs-recon-border) !important;
  box-shadow: none !important;
}

.roadsafe-case-reconstruction-route
  [class*="border-[#1"],
.roadsafe-case-reconstruction-route
  [class*="border-[#2"],
.roadsafe-case-reconstruction-route
  [class*="border-[#3"],
.roadsafe-case-ar-route
  [class*="border-[#1"],
.roadsafe-case-ar-route
  [class*="border-[#2"],
.roadsafe-case-ar-route
  [class*="border-[#3"] {
  border-color:
    var(--rs-recon-border-soft) !important;
}

.roadsafe-case-reconstruction-route
  input:not([type="range"]),
.roadsafe-case-reconstruction-route
  select,
.roadsafe-case-reconstruction-route
  textarea,
.roadsafe-case-ar-route
  input:not([type="range"]),
.roadsafe-case-ar-route
  select,
.roadsafe-case-ar-route
  textarea {
  border:
    1px solid
    var(--rs-recon-border-soft) !important;
  border-radius: 2px !important;
  background:
    var(--rs-recon-input) !important;
  color: var(--rs-recon-text) !important;
  box-shadow:
    inset 0 1px 2px
      rgba(0, 0, 0, 0.38) !important;
}

.roadsafe-case-reconstruction-route
  input:focus,
.roadsafe-case-reconstruction-route
  select:focus,
.roadsafe-case-reconstruction-route
  textarea:focus,
.roadsafe-case-ar-route
  input:focus,
.roadsafe-case-ar-route
  select:focus,
.roadsafe-case-ar-route
  textarea:focus {
  border-color:
    var(--rs-recon-orange) !important;
  outline: none !important;
  box-shadow:
    0 0 0 1px
      var(--rs-recon-orange) !important;
}

.roadsafe-case-reconstruction-route
  button,
.roadsafe-case-reconstruction-route
  .ui-button,
.roadsafe-case-reconstruction-route
  .ui-icon-button,
.roadsafe-case-ar-route
  button,
.roadsafe-case-ar-route
  .ui-button,
.roadsafe-case-ar-route
  .ui-icon-button {
  border-radius: 2px !important;
}

.roadsafe-case-reconstruction-route
  .ui-button,
.roadsafe-case-reconstruction-route
  .ui-icon-button,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__button,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__icon-button,
.roadsafe-case-ar-route
  .ui-button,
.roadsafe-case-ar-route
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
  color: var(--rs-recon-text) !important;
  box-shadow:
    inset 0 1px 0
      rgba(255, 255, 255, 0.06),
    inset 0 -1px 0
      rgba(0, 0, 0, 0.45) !important;
}

.roadsafe-case-reconstruction-route
  .ui-button-primary,
.roadsafe-case-reconstruction-route
  button.is-active,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__view-switch
  button.is-active,
.roadsafe-case-ar-route
  .ui-button-primary {
  border-color:
    var(--rs-recon-blue) !important;
  background:
    var(--rs-recon-blue) !important;
  color: #fff !important;
}

.roadsafe-case-reconstruction-route
  .ui-button:hover,
.roadsafe-case-reconstruction-route
  .ui-icon-button:hover,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__button:hover,
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__icon-button:hover,
.roadsafe-case-ar-route
  .ui-button:hover,
.roadsafe-case-ar-route
  .ui-icon-button:hover {
  border-color:
    var(--rs-recon-orange) !important;
  color: #fff !important;
}

.roadsafe-case-reconstruction-route
  .ui-button-primary:hover,
.roadsafe-case-ar-route
  .ui-button-primary:hover {
  border-color:
    var(--rs-recon-orange) !important;
  background:
    var(--rs-recon-blue-hover) !important;
}

/*
 * Timeline and workspace panels.
 */
.roadsafe-case-reconstruction-route
  .reconstruction-workspace__timeline,
.roadsafe-case-reconstruction-route
  .premium-investigation-workspace,
.roadsafe-case-reconstruction-route
  .premium-investigation-card,
.roadsafe-case-reconstruction-route
  .premium-audit-metric {
  border-radius: 2px !important;
  background:
    var(--rs-recon-panel) !important;
  border-color:
    var(--rs-recon-border-soft) !important;
}

.roadsafe-case-reconstruction-route
  .accident-timeline,
.roadsafe-case-reconstruction-route
  .accident-timeline__tracks,
.roadsafe-case-reconstruction-route
  .accident-timeline__track,
.roadsafe-case-reconstruction-route
  .accident-timeline__header {
  background:
    var(--rs-recon-panel) !important;
  border-color:
    var(--rs-recon-border) !important;
}

.roadsafe-case-reconstruction-route
  h1,
.roadsafe-case-reconstruction-route
  h2,
.roadsafe-case-reconstruction-route
  h3,
.roadsafe-case-reconstruction-route
  h4 {
  color: var(--rs-recon-text) !important;
}

.roadsafe-case-reconstruction-route
  p,
.roadsafe-case-reconstruction-route
  label,
.roadsafe-case-reconstruction-route
  dt,
.roadsafe-case-reconstruction-route
  dd {
  text-shadow: none !important;
}

.roadsafe-case-reconstruction-route
  [class*="text-[#7"],
.roadsafe-case-reconstruction-route
  [class*="text-[#8"] {
  color: #8eacc9 !important;
}

.roadsafe-case-reconstruction-route
  [class*="bg-[#1"]
  {
  background:
    var(--rs-recon-panel-raised) !important;
}

/*
 * Keep semantic danger/success colours while suppressing neon styling.
 */
.roadsafe-case-reconstruction-route
  [class*="shadow-["] {
  box-shadow: none !important;
}

/*
 * AR workstation
 */
.roadsafe-case-ar-route
  .roadsafe-ar-workstation {
  background:
    var(--rs-recon-bg) !important;
}

.roadsafe-case-ar-route
  .roadsafe-ar-workstation__header {
  right:
    var(--rs-recon-inspector-width) !important;
}

.roadsafe-case-ar-route
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

.roadsafe-case-ar-route
  .roadsafe-ar-workstation__inspector {
  inset:
    0 0 0 auto !important;
  width:
    var(--rs-recon-inspector-width) !important;
  height: 100dvh !important;
  padding: 0 !important;
}

.roadsafe-case-ar-route
  .roadsafe-ar-workstation__inspector
  > section {
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

.roadsafe-case-ar-route
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
  color: var(--rs-recon-text);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.roadsafe-case-ar-route
  .roadsafe-ar-workstation__inspector
  > section {
  position: relative;
}

.roadsafe-case-ar-route
  [class*="backdrop-blur"] {
  backdrop-filter: none !important;
}

.roadsafe-case-ar-route
  [class*="bg-[#03"],
.roadsafe-case-ar-route
  [class*="bg-[#06"],
.roadsafe-case-ar-route
  [class*="bg-[#07"],
.roadsafe-case-ar-route
  [class*="bg-[#0b"] {
  background:
    var(--rs-recon-panel) !important;
}

.roadsafe-case-ar-route
  [class*="text-[#79"],
.roadsafe-case-ar-route
  [class*="text-[#8e"] {
  color: #8eacc9 !important;
}

@media (max-width: 1050px) {
  .roadsafe-case-reconstruction-route
    .reconstruction-workspace__body {
    display: block !important;
  }

  .roadsafe-case-reconstruction-route
    .reconstruction-workspace__2d-grid:not(
      .hidden
    ),
  .roadsafe-case-reconstruction-route
    .reconstruction-workspace__stage-grid--3d {
    display: block !important;
  }

  .roadsafe-case-reconstruction-route
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

  .roadsafe-case-ar-route
    .roadsafe-ar-workstation__header {
    right: 0 !important;
  }

  .roadsafe-case-ar-route
    .roadsafe-ar-workstation__inspector {
    inset:
      auto 0 0 0 !important;
    width: 100% !important;
    height: min(
      52dvh,
      520px
    ) !important;
  }

  .roadsafe-case-ar-route
    .roadsafe-ar-workstation__inspector
    > section {
    border-top:
      1px solid
      var(--rs-recon-border) !important;
    border-left: 0 !important;
  }
}
`;

write(paths.css, stylesheet);

/*
 * Import the V2 stylesheet last so it wins over legacy reconstruction styles.
 */
{
  const relativePath = paths.main;

  let source = fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );

  const importLine =
    'import "./styles/reconstructionWorkstationV2.css";';

  if (!source.includes(importLine)) {
    const imports = [
      'import "./styles/navigationRailFix.css";',
      'import "./styles/dockableContextInspector.css";',
      'import "./styles/materialIcons.css";',
      'import "./styles/darkerTheme.css";',
      'import "./index.css";',
    ];

    const anchor = imports.find(
      (candidate) =>
        source.includes(candidate),
    );

    if (!anchor) {
      console.error(
        "Could not find a stylesheet import anchor in src/main.tsx.",
      );
      process.exit(1);
    }

    source = source.replace(
      anchor,
      `${anchor}\n${importLine}`,
    );

    write(relativePath, source);
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
The reconstruction workstation files were installed, but the build failed.

Restore the previous files from:
  ${path.relative(root, backupRoot)}
`);
  process.exit(1);
}

console.log(`
RoadSafe Reconstruction Workstation V2 installed.

Result:
- legacy generic case inspector hidden on reconstruction and AR routes;
- 2D Context Inspector attached as the right workstation column;
- 3D Context Inspector uses the same right column;
- AR calibration/playback controls use a matching AR Context Inspector;
- centre editor, timeline, setup, object, physics and evidence panels use the charcoal theme;
- muted blue #365D86 is used for selected and primary controls;
- orange remains the focus/active edge;
- no reconstruction physics or persistence logic was replaced.

Start RoadSafe:
  npm run dev
`);
