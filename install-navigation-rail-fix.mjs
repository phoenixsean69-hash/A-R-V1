import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const appShellRelative =
  "src/components/layout/AppShell.tsx";
const appShellPath = path.join(
  root,
  appShellRelative,
);
const mainRelative = "src/main.tsx";
const mainPath = path.join(root, mainRelative);
const cssRelative =
  "src/styles/navigationRailFix.css";
const cssPath = path.join(root, cssRelative);

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

for (const requiredPath of [
  appShellPath,
  mainPath,
]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(
      `Required file not found: ${path.relative(root, requiredPath)}`,
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

backup(appShellRelative);
backup(mainRelative);
backup(cssRelative);

let appShell = fs.readFileSync(
  appShellPath,
  "utf8",
);

const oldCollapsedIcon = `{desktopCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}`;

const newCollapsedIcon = `{desktopCollapsed ? (
              <>
                <ShieldCheck
                  className="roadsafe-navigation-collapse-mark"
                  size={16}
                  strokeWidth={1.6}
                />
                <ChevronRight
                  size={12}
                  strokeWidth={1.8}
                />
              </>
            ) : (
              <ChevronLeft size={16} />
            )}`;

if (
  !appShell.includes(
    "roadsafe-navigation-collapse-mark",
  )
) {
  if (!appShell.includes(oldCollapsedIcon)) {
    console.error(
      "Could not locate the navigation collapse icon block in AppShell.tsx.",
    );
    process.exit(1);
  }

  appShell = appShell.replace(
    oldCollapsedIcon,
    newCollapsedIcon,
  );

  fs.writeFileSync(
    appShellPath,
    appShell,
    "utf8",
  );

  console.log(
    "CHANGED src/components/layout/AppShell.tsx",
  );
}

const css = "/*\n * [RoadSafe:NavigationRailFixV1]\n *\n * Keeps the desktop navigation collapse control fully inside the navigation\n * rail. The previous implementation positioned the button beyond the rail\n * boundary, where overflow clipping and the centre workspace covered it.\n */\n\n.roadsafe-navigation {\n  z-index: 70 !important;\n  isolation: isolate;\n}\n\n.roadsafe-center {\n  position: relative;\n  z-index: 1;\n}\n\n.roadsafe-navigation-brand {\n  position: relative;\n  z-index: 72;\n}\n\n.roadsafe-navigation-collapse {\n  position: relative !important;\n  inset: auto !important;\n  z-index: 75 !important;\n  width: 28px;\n  min-width: 28px;\n  height: 28px;\n  min-height: 28px;\n  flex: 0 0 28px;\n  overflow: visible;\n}\n\n.roadsafe-navigation-collapse-mark {\n  flex: 0 0 auto;\n}\n\n@media (min-width: 1024px) {\n  /*\n   * Expanded navigation:\n   * keep the toggle in the brand toolbar instead of allowing an old absolute\n   * positioning rule to push it over the workspace.\n   */\n  .roadsafe-workstation:not(.is-navigation-collapsed)\n    .roadsafe-navigation-collapse {\n    position: relative !important;\n    top: auto !important;\n    right: auto !important;\n    bottom: auto !important;\n    left: auto !important;\n    margin: 0 !important;\n  }\n\n  /*\n   * Collapsed navigation:\n   * the top row becomes a dedicated rail-toggle slot. The normal brand link is\n   * hidden because the combined shield + arrow button now represents both the\n   * application identity and the expand action.\n   */\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-brand {\n    display: grid !important;\n    min-height: var(--js-header-height) !important;\n    height: var(--js-header-height) !important;\n    place-items: center !important;\n    padding: 4px !important;\n    overflow: visible !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-brand-link {\n    display: none !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-collapse {\n    position: relative !important;\n    top: auto !important;\n    right: auto !important;\n    bottom: auto !important;\n    left: auto !important;\n    inset: auto !important;\n    z-index: 80 !important;\n    width: 38px !important;\n    min-width: 38px !important;\n    height: 32px !important;\n    min-height: 32px !important;\n    margin: 0 !important;\n    display: inline-flex !important;\n    align-items: center;\n    justify-content: center;\n    gap: 2px;\n    padding: 0 4px !important;\n    overflow: visible !important;\n    border: 1px solid #555 !important;\n    border-radius: 2px !important;\n    background:\n      linear-gradient(\n        180deg,\n        #414141 0%,\n        #303030 100%\n      ) !important;\n    color: #dedede !important;\n    box-shadow:\n      inset 0 1px 0 rgba(255, 255, 255, 0.08),\n      inset 0 -1px 0 rgba(0, 0, 0, 0.5),\n      0 1px 2px rgba(0, 0, 0, 0.28) !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-collapse:hover,\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-collapse:focus-visible {\n    border-color: var(--blender-orange, #e8872d) !important;\n    background:\n      linear-gradient(\n        180deg,\n        #4a4a4a 0%,\n        #363636 100%\n      ) !important;\n    color: #fff !important;\n    outline: none !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-collapse\n    svg {\n    display: block;\n    flex: 0 0 auto;\n  }\n\n  /*\n   * Keep every rail icon aligned to the same centre line.\n   */\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-station,\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-footer {\n    justify-content: center !important;\n    padding-right: 4px !important;\n    padding-left: 4px !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-groups {\n    padding-right: 4px !important;\n    padding-left: 4px !important;\n    overflow-x: hidden;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-link {\n    width: 100%;\n    min-width: 0;\n    justify-content: center !important;\n    padding-right: 0 !important;\n    padding-left: 0 !important;\n  }\n\n  /*\n   * Preserve the orange active marker without drawing it through the rail\n   * toggle or outside the collapsed navigation boundary.\n   */\n  .roadsafe-workstation.is-navigation-collapsed\n    .roadsafe-navigation-link.is-active {\n    box-shadow:\n      inset 2px 0 0 var(--blender-orange, #e8872d),\n      inset 0 1px 0 rgba(255, 255, 255, 0.07),\n      inset 0 -1px 0 rgba(0, 0, 0, 0.35) !important;\n  }\n}\n\n/*\n * Mobile navigation uses its own close button and does not need the desktop\n * collapse control.\n */\n@media (max-width: 1023px) {\n  .roadsafe-navigation-collapse {\n    display: none !important;\n  }\n}\n";

fs.mkdirSync(
  path.dirname(cssPath),
  { recursive: true },
);

fs.writeFileSync(
  cssPath,
  css,
  "utf8",
);

console.log(
  "WROTE src/styles/navigationRailFix.css",
);

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const importLine =
  'import "./styles/navigationRailFix.css";';

if (!mainSource.includes(importLine)) {
  const dockImport =
    'import "./styles/dockableContextInspector.css";';
  const darkThemeImport =
    'import "./styles/darkerTheme.css";';

  if (mainSource.includes(dockImport)) {
    mainSource = mainSource.replace(
      dockImport,
      `${dockImport}\n${importLine}`,
    );
  } else if (
    mainSource.includes(darkThemeImport)
  ) {
    mainSource = mainSource.replace(
      darkThemeImport,
      `${darkThemeImport}\n${importLine}`,
    );
  } else {
    console.error(
      "Could not find the RoadSafe style imports in src/main.tsx.",
    );
    process.exit(1);
  }

  fs.writeFileSync(
    mainPath,
    mainSource,
    "utf8",
  );

  console.log("CHANGED src/main.tsx");
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
The navigation rail fix was installed, but the build failed.

Restore the previous files from:
  ${path.relative(root, backupRoot)}
`);
  process.exit(1);
}

console.log(`
Done.

The collapsed navigation now:
- keeps its toggle fully inside the rail;
- shows a combined RoadSafe shield and expand arrow;
- remains above the centre workspace;
- keeps all rail icons aligned;
- preserves the orange active marker.

Start RoadSafe:
  npm run dev
`);
