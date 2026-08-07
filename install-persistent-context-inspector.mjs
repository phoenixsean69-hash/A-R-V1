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

const appShellPath = path.join(
  root,
  "src",
  "components",
  "layout",
  "AppShell.tsx",
);

const inspectorPath = path.join(
  root,
  "src",
  "components",
  "layout",
  "WorkspaceInspector.tsx",
);

const themePath = path.join(
  root,
  "src",
  "styles",
  "darkerTheme.css",
);

for (const requiredPath of [
  appShellPath,
  inspectorPath,
  themePath,
]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(
      `Required file was not found: ${path.relative(root, requiredPath)}`,
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

function backup(absolutePath) {
  const relativePath = path.relative(
    root,
    absolutePath,
  );

  const destination = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(
    absolutePath,
    destination,
  );
}

function replaceRequired(
  source,
  searchValue,
  replacement,
  label,
) {
  if (!source.includes(searchValue)) {
    console.error(
      `Could not apply "${label}". The local AppShell structure differs from the expected UI shell.`,
    );
    process.exit(1);
  }

  return source.replace(
    searchValue,
    replacement,
  );
}

backup(appShellPath);
backup(inspectorPath);
backup(themePath);

let appShell = fs.readFileSync(
  appShellPath,
  "utf8",
);

/*
 * The previous shell explicitly disabled the inspector on every reconstruction
 * route. RoadSafe now treats it as a permanent desktop workspace column.
 */
appShell = appShell.replace(
  /const inspectorAvailable\s*=\s*!isReconstructionWorkspace;/,
  "const inspectorAvailable = true;",
);

if (!appShell.includes(
  "const inspectorAvailable = true;",
)) {
  console.error(
    "Could not enable the inspector globally in AppShell.tsx.",
  );
  process.exit(1);
}

/*
 * The desktop grid must not depend on the stored open/closed preference.
 * Mobile still uses its drawer-open state.
 */
appShell = appShell.replace(
  /inspectorOpen && inspectorAvailable\s*\?\s*"is-inspector-open"/,
  'inspectorAvailable\n      ? "is-inspector-open"',
);

if (!appShell.includes(
  'inspectorAvailable\n      ? "is-inspector-open"',
)) {
  console.error(
    "Could not make the desktop inspector permanently open.",
  );
  process.exit(1);
}

/*
 * Always mount the inspector. On desktop it occupies the third column; below
 * 1280px CSS keeps it off-canvas until the drawer is opened.
 */
appShell = appShell.replace(
  /\{inspectorAvailable &&\s*\(inspectorOpen \|\|\s*mobileInspectorOpen\) && \(\s*<WorkspaceInspector/,
  "{inspectorAvailable && (\n          <WorkspaceInspector",
);

if (!appShell.includes(
  "{inspectorAvailable && (\n          <WorkspaceInspector",
)) {
  console.error(
    "Could not make WorkspaceInspector permanently mounted.",
  );
  process.exit(1);
}

/*
 * Reconstruction pages intentionally hide the normal shell header. Add a
 * compact inspector button for tablet/mobile reconstruction routes.
 */
const persistentInspectorAnchor = `      {inspectorAvailable && (
          <WorkspaceInspector`;

const editorToggle = `      {isReconstructionWorkspace && (
        <button
          type="button"
          className="ui-button roadsafe-editor-inspector-toggle"
          onClick={toggleInspector}
          aria-label="Open active investigation inspector"
          aria-expanded={mobileInspectorOpen}
        >
          <ClipboardList size={15} />
          <span>Active investigation</span>
        </button>
      )}

`;

if (
  !appShell.includes(
    "roadsafe-editor-inspector-toggle",
  )
) {
  appShell = replaceRequired(
    appShell,
    persistentInspectorAnchor,
    `${editorToggle}${persistentInspectorAnchor}`,
    "mobile reconstruction inspector access",
  );
}

fs.writeFileSync(
  appShellPath,
  appShell,
  "utf8",
);

/*
 * Add a clear semantic marker to the inspector itself. This does not change its
 * data behavior; it makes the persistent role explicit and easier to target.
 */
let inspector = fs.readFileSync(
  inspectorPath,
  "utf8",
);

if (
  !inspector.includes(
    'data-persistent-inspector="true"',
  )
) {
  inspector = replaceRequired(
    inspector,
    'className="roadsafe-inspector"\n      aria-label="Case context inspector"',
    'className="roadsafe-inspector"\n      data-persistent-inspector="true"\n      aria-label="Case context inspector"',
    "persistent inspector marker",
  );
}

fs.writeFileSync(
  inspectorPath,
  inspector,
  "utf8",
);

let theme = fs.readFileSync(
  themePath,
  "utf8",
);

const markerStart =
  "/* [RoadSafe:PersistentContextInspectorV1] */";
const markerEnd =
  "/* [/RoadSafe:PersistentContextInspectorV1] */";

const markerPattern = new RegExp(
  `${markerStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  "g",
);

theme = theme
  .replace(markerPattern, "")
  .trimEnd();

const persistentCss = `${markerStart}
/*
 * The context inspector is a permanent third workstation column on desktop,
 * including the full reconstruction editor route.
 */
@media (min-width: 1280px) {
  .roadsafe-workstation,
  .roadsafe-workstation.is-inspector-open,
  .roadsafe-workstation.is-editor-route {
    grid-template-columns:
      var(--js-navigation-width)
      minmax(0, 1fr)
      var(--js-inspector-width) !important;
  }

  .roadsafe-workstation.is-navigation-collapsed,
  .roadsafe-workstation.is-navigation-collapsed.is-inspector-open,
  .roadsafe-workstation.is-navigation-collapsed.is-editor-route {
    grid-template-columns:
      var(--js-navigation-collapsed-width)
      minmax(0, 1fr)
      var(--js-inspector-width) !important;
  }

  .roadsafe-inspector {
    display: flex !important;
    transform: none !important;
  }

  /*
   * A permanent desktop inspector cannot be dismissed. The close and header
   * toggle controls remain available only for the responsive drawer.
   */
  .roadsafe-inspector-close,
  .roadsafe-inspector-toggle,
  .roadsafe-editor-inspector-toggle {
    display: none !important;
  }
}

/*
 * Reconstruction routes have no global header. Give tablet/mobile users a
 * compact drawer trigger without taking permanent canvas width.
 */
.roadsafe-editor-inspector-toggle {
  display: none;
}

@media (max-width: 1279px) {
  .roadsafe-editor-inspector-toggle {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 82;
    display: inline-flex;
    min-height: 30px;
    padding: 5px 9px;
    border-color: var(--js-border-strong);
    background: var(--js-panel-raised);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 4px 14px rgba(0, 0, 0, 0.26);
  }
}
${markerEnd}
`;

theme = `${theme}

${persistentCss}`;

fs.writeFileSync(
  themePath,
  theme,
  "utf8",
);

console.log(
  "CHANGED src/components/layout/AppShell.tsx",
);
console.log(
  "CHANGED src/components/layout/WorkspaceInspector.tsx",
);
console.log(
  "CHANGED src/styles/darkerTheme.css",
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
The persistent inspector changes were installed, but the build failed.

Restore the original files from:
  ${path.relative(root, backupRoot)}
`);
  process.exit(1);
}

console.log(`
Done.

"Context inspector / Active investigation" is now:
- permanently visible on desktop;
- visible on reconstruction routes;
- non-dismissible on desktop;
- available as a drawer on tablet/mobile reconstruction routes.

Start RoadSafe with:
  npm run dev
`);
