import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const srcRoot = path.join(root, "src");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this file from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but package.json contains "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

if (!fs.existsSync(srcRoot)) {
  console.error("The src directory was not found.");
  process.exit(1);
}

const CANONICAL_BLUE = "#80ACFF";

const colourReplacements = new Map([
  // Bright RoadSafe blues.
  ["#8bb8ff", CANONICAL_BLUE],
  ["#8db8fb", CANONICAL_BLUE],
  ["#79adfa", CANONICAL_BLUE],
  ["#70a8ff", CANONICAL_BLUE],
  ["#7fb0ff", CANONICAL_BLUE],
  ["#6e9fe8", CANONICAL_BLUE],
  ["#4d8cf5", CANONICAL_BLUE],
  ["#5681bc", CANONICAL_BLUE],
  ["#6490cd", CANONICAL_BLUE],
  ["#4774ad", CANONICAL_BLUE],
  ["#4772b3", CANONICAL_BLUE],
  ["#3d669c", CANONICAL_BLUE],
  ["#365f91", CANONICAL_BLUE],
  ["#36598f", CANONICAL_BLUE],
  ["#668fca", CANONICAL_BLUE],

  // Blue borders and outlines.
  ["#2b456f", CANONICAL_BLUE],
  ["#2a3e64", CANONICAL_BLUE],
  ["#294b72", CANONICAL_BLUE],
  ["#24476f", CANONICAL_BLUE],
  ["#24395f", CANONICAL_BLUE],

  // Remove the old navy card surfaces and replace them with Blender charcoal.
  ["#0c1730", "#303030"],
  ["#0a1223", "#303030"],
  ["#0c1426", "#383838"],
  ["#080e1c", "#292929"],
  ["#070b13", "#202020"],

  // Replace old navy separators with neutral Blender separators.
  ["#182743", "#171717"],
  ["#17243d", "#202020"],
  ["#15233d", "#171717"],
  ["#233453", "#4A4A4A"],
  ["#1a2c49", "#4A4A4A"],
]);

const supportedExtensions = new Set([
  ".css",
  ".scss",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".html",
]);

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

function walk(directory) {
  const discovered = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      discovered.push(...walk(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      supportedExtensions.has(
        path.extname(entry.name).toLowerCase(),
      )
    ) {
      discovered.push(absolutePath);
    }
  }

  return discovered;
}

function backupFile(absolutePath) {
  const relativePath = path.relative(root, absolutePath);
  const destination = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(absolutePath, destination);
}

function replaceCaseInsensitive(
  source,
  oldValue,
  newValue,
) {
  const escaped = oldValue.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  return source.replace(
    new RegExp(escaped, "gi"),
    newValue,
  );
}

const changedFiles = [];

for (const absolutePath of walk(srcRoot)) {
  const original = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  let updated = original;

  for (const [oldColour, newColour] of colourReplacements) {
    updated = replaceCaseInsensitive(
      updated,
      oldColour,
      newColour,
    );
  }

  /*
   * The supplied screenshot specifically includes the dashboard card heading.
   * Change that heading from Tailwind's blue-gray slate colour to the exact
   * canonical Blender blue.
   */
  if (
    path.relative(root, absolutePath)
      .replaceAll("\\", "/") ===
    "src/pages/Dashboard.tsx"
  ) {
    updated = updated.replace(
      'className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500"',
      `className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#80ACFF]"`,
    );
  }

  if (updated === original) {
    continue;
  }

  backupFile(absolutePath);
  fs.writeFileSync(
    absolutePath,
    updated,
    "utf8",
  );

  changedFiles.push(
    path.relative(root, absolutePath),
  );
}

const themePath = path.join(
  srcRoot,
  "styles",
  "darkerTheme.css",
);

if (fs.existsSync(themePath)) {
  const markerStart =
    "/* [RoadSafe:CanonicalBlenderBlueV1] */";
  const markerEnd =
    "/* [/RoadSafe:CanonicalBlenderBlueV1] */";

  const override = `${markerStart}
:root {
  --js-blue-muted: ${CANONICAL_BLUE};
  --js-blue-active: ${CANONICAL_BLUE};
  --js-blue-selected: ${CANONICAL_BLUE};
  --js-blue-soft-bg: color-mix(
    in srgb,
    ${CANONICAL_BLUE} 18%,
    #303030
  );

  --blender-blue: ${CANONICAL_BLUE};
  --blender-blue-dark: ${CANONICAL_BLUE};
}

/* The requested single muted blue for navigation, buttons, icons and labels. */
.roadsafe-navigation-link.is-active,
.ui-button-primary,
.roadsafe-workstation button[class*="bg-blue-"],
.roadsafe-workstation a[class*="bg-blue-"],
.reconstruction-editor button[class*="bg-blue-"],
.reconstruction-editor a[class*="bg-blue-"],
.reconstruction-workspace__view-switch button.is-active {
  border-color: ${CANONICAL_BLUE} !important;
  background: ${CANONICAL_BLUE} !important;
}

.roadsafe-workstation [class*="text-blue-"],
.roadsafe-workstation [class*="text-indigo-"],
.reconstruction-editor [class*="text-blue-"],
.reconstruction-editor [class*="text-indigo-"] {
  color: ${CANONICAL_BLUE} !important;
}

.dashboard-stat-icon {
  border-color: ${CANONICAL_BLUE} !important;
  background: #303030 !important;
  color: ${CANONICAL_BLUE} !important;
}

.ui-button-primary:hover,
.roadsafe-navigation-link.is-active:hover {
  border-color: ${CANONICAL_BLUE} !important;
  background: ${CANONICAL_BLUE} !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: ${CANONICAL_BLUE} !important;
}

.reconstruction-editor input[type="checkbox"],
.reconstruction-editor input[type="radio"],
.roadsafe-range {
  accent-color: ${CANONICAL_BLUE} !important;
}
${markerEnd}`;

  const current = fs.readFileSync(
    themePath,
    "utf8",
  );

  const markerPattern = new RegExp(
    `${markerStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "g",
  );

  const withoutOldOverride = current
    .replace(markerPattern, "")
    .trimEnd();

  const nextTheme = `${withoutOldOverride}

${override}
`;

  if (nextTheme !== current) {
    if (!changedFiles.includes(
      path.relative(root, themePath),
    )) {
      backupFile(themePath);
      changedFiles.push(
        path.relative(root, themePath),
      );
    }

    fs.writeFileSync(
      themePath,
      nextTheme,
      "utf8",
    );
  }
}

if (changedFiles.length === 0) {
  console.log(
    `No old blue accents were found. The interface may already be using ${CANONICAL_BLUE}.`,
  );
} else {
  console.log(
    `Applied canonical RoadSafe blue ${CANONICAL_BLUE}.`,
  );

  for (const relativePath of changedFiles) {
    console.log(`CHANGED ${relativePath}`);
  }

  console.log(
    `Backups saved under ${path.relative(root, backupRoot)}`,
  );
}

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(`
The colour changes were installed, but the build failed.

Restore files from:
  ${path.relative(root, backupRoot)}
`);
  process.exit(1);
}

console.log(`
Done.

All matching bright/navy RoadSafe accents now use:
  ${CANONICAL_BLUE}

Start the app with:
  npm run dev
`);
