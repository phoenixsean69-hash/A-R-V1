import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const srcRoot = path.join(root, "src");
const verifyPath = path.join(root, "scripts", "verify-blender-ui.mjs");
const guardPath = path.join(root, "src", "styles", "blenderColorGuard.css");
const mainPath = path.join(root, "src", "main.tsx");

if (!fs.existsSync(packagePath) || !fs.existsSync(srcRoot)) {
  console.error(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (packageJson.name !== "roadsafe-ar") {
  console.error(`Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`);
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".roadsafe-ui-backup", timestamp);
const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-blender-color-purge.json",
);

const supported = new Set([".css", ".tsx", ".jsx"]);
const changedFiles = [];
const existedBefore = {};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(absolute));
    } else if (entry.isFile() && supported.has(path.extname(entry.name).toLowerCase())) {
      out.push(absolute);
    }
  }
  return out;
}

function backup(relativePath) {
  if (relativePath in existedBefore) return;

  const source = path.join(root, relativePath);
  const exists = fs.existsSync(source);
  existedBefore[relativePath] = exists;

  if (!exists) return;

  const destination = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function write(relativePath, content) {
  const target = path.join(root, relativePath);
  backup(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  if (!changedFiles.includes(relativePath)) changedFiles.push(relativePath);
}

function replaceCI(source, from, to) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(new RegExp(escaped, "gi"), to);
}

/*
 * Exact legacy RoadSafe UI colours.
 *
 * Deliberately excludes participant/data colours such as #2563eb and 0x2563eb.
 * These replacements target the pre-Blender chrome palette only.
 */
const replacements = new Map([
  ["#050817", "#1b1b1b"],
  ["#050914", "#202020"],
  ["#060b17", "#242424"],
  ["#050b17", "#202020"],
  ["#090f20", "#292929"],
  ["#0b111c", "#303030"],
  ["#0d1420", "#303030"],
  ["#10141b", "#303030"],
  ["#111722", "#383838"],

  ["#020611", "#1b1b1b"],
  ["#02050c", "#181818"],
  ["#030711", "#181818"],
  ["#030714", "#1b1b1b"],
  ["#040918", "#202020"],
  ["#040a16", "#292929"],
  ["#050a16", "#202020"],
  ["#070b13", "#181818"],
  ["#070d1a", "#202020"],
  ["#07101d", "#202020"],
  ["#071124", "#383838"],
  ["#071326", "#292929"],
  ["#07142a", "#303030"],
  ["#080e1c", "#202020"],
  ["#0a1223", "#292929"],
  ["#0a1830", "#414141"],
  ["#0b1122", "#202020"],
  ["#0b1b38", "#303030"],
  ["#0c1426", "#292929"],
  ["#0c1730", "#292929"],
  ["#0d1529", "#252525"],
  ["#0e1930", "#292929"],
  ["#10182d", "#383838"],
  ["#102a36", "#303030"],
  ["#102a53", "#35312e"],
  ["#111b35", "#383838"],
  ["#112241", "#303030"],
  ["#123d7e", "#39332f"],
  ["#143565", "#39332f"],
  ["#152445", "#414141"],
  ["#163a73", "#39332f"],
  ["#173c78", "#39332f"],
  ["#1b4789", "#46413d"],
  ["#1c4789", "#46413d"],

  ["#162f52", "#494949"],
  ["#172944", "#171717"],
  ["#172a48", "#171717"],
  ["#18243f", "#171717"],
  ["#182849", "#171717"],
  ["#1a2942", "#171717"],
  ["#1a2946", "#3c3c3c"],
  ["#1b3153", "#494949"],
  ["#1d2c4b", "#494949"],
  ["#1d3153", "#494949"],
  ["#203554", "#555555"],
  ["#203f67", "#5c5c5c"],
  ["#223656", "#555555"],
  ["#22385d", "#555555"],
  ["#294261", "#494949"],
  ["#29446f", "#494949"],
  ["#294567", "#494949"],
  ["#29496f", "#5c5c5c"],
  ["#29548d", "#5c5c5c"],
  ["#315b91", "#5c5c5c"],
  ["#315d9d", "#e8872d"],
  ["#315f9e", "#e8872d"],
  ["#345374", "#e8872d"],
  ["#3d6da9", "#e8872d"],
  ["#3f6daa", "#e8872d"],
  ["#365d86", "#e8872d"],

  ["#536178", "#6f6f6f"],
  ["#6b98e0", "#c4c4c4"],
  ["#79b8d0", "#c4c4c4"],
  ["#7e8ba0", "#969696"],
  ["#80acff", "#e8872d"],
  ["#8594aa", "#969696"],
  ["#8bb9fa", "#c4c4c4"],
  ["#8ebcff", "#c4c4c4"],
  ["#aab8cc", "#c4c4c4"],
  ["#b9c7db", "#c4c4c4"],
  ["#bcc8d8", "#c4c4c4"],
  ["#c1ccdc", "#c4c4c4"],
  ["#cbd5e1", "#cfcfcf"],
  ["#d7deeb", "#dedede"],
  ["#d9e7fb", "#dedede"],
  ["#dbe4f0", "#dedede"],
  ["#dce7f7", "#dedede"],
  ["#edf4ff", "#ffffff"],
  ["#eef3fb", "#eeeeee"],
]);

const rgbaReplacements = new Map([
  ["rgba(61,109,169,.18)", "rgba(232,135,45,.18)"],
  ["rgba(61, 109, 169, .18)", "rgba(232, 135, 45, .18)"],
  ["rgba(4,9,24,.97)", "rgba(41,41,41,.97)"],
  ["rgba(4, 9, 24, .97)", "rgba(41, 41, 41, .97)"],
  ["rgba(4,10,23,.93)", "rgba(41,41,41,.93)"],
  ["rgba(4, 10, 23, .93)", "rgba(41, 41, 41, .93)"],
  ["rgba(5,12,26,.95)", "rgba(41,41,41,.95)"],
  ["rgba(5, 12, 26, .95)", "rgba(41, 41, 41, .95)"],
  ["rgba(5,10,22,.88)", "rgba(32,32,32,.88)"],
  ["rgba(5, 10, 22, .88)", "rgba(32, 32, 32, .88)"],
  ["rgba(8,17,34,.98)", "rgba(41,41,41,.98)"],
  ["rgba(8, 17, 34, .98)", "rgba(41, 41, 41, .98)"],
  ["rgba(5,12,25,.98)", "rgba(32,32,32,.98)"],
  ["rgba(5, 12, 25, .98)", "rgba(32, 32, 32, .98)"],
]);

const runtimeReplacements = new Map([
  ["0x07101d", "0x202020"],
  ["0x050a16", "0x202020"],
  ["0x071326", "0x292929"],
  ["0x030711", "0x181818"],
  ["0x020611", "0x1b1b1b"],
]);

const coolUtilityPattern =
  /\b((?:[a-z0-9-]+:)*)((?:bg|text|border|ring|outline|divide|fill|stroke|accent|from|via|to))-(blue|indigo|sky|cyan|purple|violet)-(\d{2,3})(?:\/(\d+))?/gi;

function neutralUtility(_full, prefixes = "", property = "bg") {
  if (property === "bg") {
    return `${prefixes}bg-[#303030]`;
  }
  if (property === "text" || property === "fill" || property === "stroke") {
    return `${prefixes}${property}-[#c4c4c4]`;
  }
  if (property === "border" || property === "divide" || property === "outline") {
    return `${prefixes}${property}-[#494949]`;
  }
  if (property === "ring" || property === "accent") {
    return `${prefixes}${property}-[#e8872d]`;
  }
  if (property === "from") {
    return `${prefixes}from-[#383838]`;
  }
  if (property === "via") {
    return `${prefixes}via-[#303030]`;
  }
  if (property === "to") {
    return `${prefixes}to-[#292929]`;
  }
  return `${prefixes}${property}-[#303030]`;
}

const uiFiles = walk(srcRoot);
let replacementCount = 0;

for (const absolutePath of uiFiles) {
  const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
  let source = fs.readFileSync(absolutePath, "utf8");
  let next = source;

  for (const [from, to] of replacements) {
    const before = next;
    next = replaceCI(next, from, to);
    if (next !== before) {
      replacementCount +=
        (before.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) ?? []).length;
    }
  }

  for (const [from, to] of rgbaReplacements) {
    const before = next;
    next = replaceCI(next, from, to);
    if (next !== before) replacementCount += 1;
  }

  for (const [from, to] of runtimeReplacements) {
    const before = next;
    next = replaceCI(next, from, to);
    if (next !== before) replacementCount += 1;
  }

  if (/\.(tsx|jsx)$/.test(relativePath)) {
    const before = next;
    next = next.replace(coolUtilityPattern, neutralUtility);
    if (next !== before) replacementCount += 1;
  }

  if (next !== source) {
    write(relativePath, next);
  }
}

/*
 * Final defensive layer. This is deliberately imported after blenderTotalUI.css.
 */
const guardCss = `/*
 * RoadSafe Blender Color Guard
 * Final defensive layer against legacy deep-blue UI chrome.
 */

:root {
  --roadsafe-ui-accent: #e8872d;
  --roadsafe-ui-bg: #1b1b1b;
  --roadsafe-ui-workspace: #202020;
  --roadsafe-ui-panel: #292929;
  --roadsafe-ui-section: #303030;
  --roadsafe-ui-raised: #383838;
  --roadsafe-ui-hover: #414141;
  --roadsafe-ui-input: #202020;
  --roadsafe-ui-border: #171717;
  --roadsafe-ui-border-mid: #494949;
  --roadsafe-ui-border-strong: #5c5c5c;
  --roadsafe-ui-text: #dedede;
  --roadsafe-ui-muted: #969696;
}

html,
body,
#root,
.roadsafe-workstation,
.roadsafe-center,
.roadsafe-center-content,
.reconstruction-shell-main,
.reconstruction-workspace {
  background-color: var(--roadsafe-ui-workspace) !important;
  color: var(--roadsafe-ui-text) !important;
}

.ui-panel,
.workstation-panel,
.roadsafe-inspector,
.roadsafe-bottom-panel,
.reconstruction-workspace__properties,
.reconstruction-workspace__settings,
.reconstruction-workspace__timeline,
.reconstruction-workspace__workspace-card,
.reconstruction-node-editor,
.blender-object-category,
.blender-placed-objects,
.scene-settings__section {
  border-color: var(--roadsafe-ui-border) !important;
  background-color: var(--roadsafe-ui-panel) !important;
  background-image: none !important;
}

.ui-button,
.ui-button-primary,
.ui-icon-button,
.reconstruction-workspace__button,
.reconstruction-workspace__icon-button,
.reconstruction-workspace__view-switch button,
button:not(.maplibregl-ctrl button) {
  border-color: var(--roadsafe-ui-border-mid) !important;
  background:
    linear-gradient(180deg, #444 0%, #343434 100%) !important;
  color: #d0d0d0 !important;
}

button.is-active,
[aria-pressed="true"],
.reconstruction-workspace__view-switch button.is-active,
.reconstruction-workspace__tools button.is-active {
  border-color: var(--roadsafe-ui-accent) !important;
  background:
    linear-gradient(180deg, #46413d 0%, #39332f 100%) !important;
  color: #fff !important;
  box-shadow:
    inset 3px 0 0 var(--roadsafe-ui-accent) !important;
}

input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
select,
textarea,
.ui-input {
  border-color: var(--roadsafe-ui-border-mid) !important;
  background: var(--roadsafe-ui-input) !important;
  color: var(--roadsafe-ui-text) !important;
}

input:focus,
select:focus,
textarea:focus,
button:focus-visible,
summary:focus-visible {
  border-color: var(--roadsafe-ui-accent) !important;
  outline: none !important;
  box-shadow: 0 0 0 1px var(--roadsafe-ui-accent) !important;
}

input[type="checkbox"],
input[type="radio"],
input[type="range"],
.roadsafe-range {
  accent-color: var(--roadsafe-ui-accent) !important;
}

[class*="bg-blue-"],
[class*="bg-indigo-"],
[class*="bg-sky-"],
[class*="bg-cyan-"],
[class*="bg-purple-"],
[class*="bg-violet-"] {
  background-color: var(--roadsafe-ui-section) !important;
  background-image: none !important;
}

[class*="border-blue-"],
[class*="border-indigo-"],
[class*="border-sky-"],
[class*="border-cyan-"],
[class*="border-purple-"],
[class*="border-violet-"] {
  border-color: var(--roadsafe-ui-border-mid) !important;
}

[class*="text-blue-"],
[class*="text-indigo-"],
[class*="text-sky-"],
[class*="text-cyan-"],
[class*="text-purple-"],
[class*="text-violet-"] {
  color: #c4c4c4 !important;
}

.maplibregl-ctrl-group,
.maplibregl-popup-content {
  border-color: var(--roadsafe-ui-border-mid) !important;
  background: var(--roadsafe-ui-panel) !important;
  color: var(--roadsafe-ui-text) !important;
}

.reconstruction-3d,
.reconstruction-3d > div,
.roadsafe-ar-workstation {
  color-scheme: dark;
}
`;

write("src/styles/blenderColorGuard.css", guardCss);

/*
 * Ensure the guard is the final CSS import.
 */
let mainSource = fs.readFileSync(mainPath, "utf8");
const guardImport = 'import "./styles/blenderColorGuard.css";';

mainSource = mainSource
  .replace(
    /^\s*import\s+["']\.\/styles\/blenderColorGuard\.css["'];?\s*$/gm,
    "",
  )
  .replace(/\n{3,}/g, "\n\n");

const cssImports = mainSource.match(
  /^import\s+["'][^"']+\.css["'];?$/gm,
) ?? [];

if (cssImports.length > 0) {
  const last = cssImports[cssImports.length - 1];
  mainSource = mainSource.replace(last, `${last}\n${guardImport}`);
} else {
  mainSource = `${guardImport}\n${mainSource}`;
}

write("src/main.tsx", mainSource);

/*
 * Strict verifier: fail on the exact legacy palette, old cool Tailwind tokens,
 * or known navy Three.js/canvas UI backgrounds.
 */
const forbiddenHexes = [...replacements.keys()];
const forbiddenRuntime = [...runtimeReplacements.keys()];

const verifier = `import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const failures = [];
const warnings = [];
const matches = [];

function walk(directory) {
  const out = [];
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else if (entry.isFile() && /\\\\.(?:ts|tsx|js|jsx|css)$/.test(entry.name)) out.push(absolute);
  }
  return out;
}

const forbiddenHexes = ${JSON.stringify(forbiddenHexes, null, 2)};
const forbiddenRuntime = ${JSON.stringify(forbiddenRuntime, null, 2)};
const coolUtilityPattern =
  /\\\\b(?:[a-z0-9-]+:)*(?:bg|text|border|ring|outline|divide|fill|stroke|accent|from|via|to)-(?:blue|indigo|sky|cyan|purple|violet)-\\\\d{2,3}(?:\\\\/\\\\d+)?/gi;

const sourceFiles = walk(srcRoot);
let linesScanned = 0;

for (const absolutePath of sourceFiles) {
  const relative = path.relative(root, absolutePath).replaceAll("\\\\\\\\", "/");
  const source = fs.readFileSync(absolutePath, "utf8");
  const lines = source.split(/\\\\r?\\\\n/);
  linesScanned += lines.length;

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();

    for (const hex of forbiddenHexes) {
      if (lower.includes(hex.toLowerCase())) {
        matches.push({
          file: relative,
          line: index + 1,
          value: hex,
          kind: "legacy-ui-hex",
          text: line.trim().slice(0, 180),
        });
      }
    }

    for (const runtime of forbiddenRuntime) {
      if (lower.includes(runtime.toLowerCase())) {
        matches.push({
          file: relative,
          line: index + 1,
          value: runtime,
          kind: "legacy-runtime-navy",
          text: line.trim().slice(0, 180),
        });
      }
    }

    const utilityMatches = line.match(coolUtilityPattern) ?? [];
    for (const value of utilityMatches) {
      matches.push({
        file: relative,
        line: index + 1,
        value,
        kind: "legacy-cool-utility",
        text: line.trim().slice(0, 180),
      });
    }
  });
}

const mainPath = path.join(root, "src", "main.tsx");
const mainSource = fs.readFileSync(mainPath, "utf8");
const cssImports = Array.from(
  mainSource.matchAll(/^import\\\\s+["']([^"']+\\\\.css)["'];?$/gm),
  (match) => match[1],
);

if (cssImports.at(-1) !== "./styles/blenderColorGuard.css") {
  failures.push("blenderColorGuard.css must be the final CSS import.");
}

if (matches.length > 0) {
  failures.push(\`\${matches.length} legacy blue/navy UI trace(s) remain.\`);
}

const reportDir = path.join(root, ".roadsafe-ui-audit");
fs.mkdirSync(reportDir, { recursive: true });

const report = {
  filesScanned: sourceFiles.length,
  linesScanned,
  legacyTraceCount: matches.length,
  matches,
  warnings,
  failures,
};

fs.writeFileSync(
  path.join(reportDir, "blender-color-audit.json"),
  \`\${JSON.stringify(report, null, 2)}\\\\n\`,
  "utf8",
);

console.log(
  \`Blender color audit: \${sourceFiles.length} files, \${linesScanned} lines, \${matches.length} legacy trace(s).\`,
);

if (matches.length > 0) {
  for (const item of matches.slice(0, 60)) {
    console.error(
      \`FAIL: \${item.file}:\${item.line} \${item.value} [\${item.kind}]\`,
    );
  }
  if (matches.length > 60) {
    console.error(\`...and \${matches.length - 60} more. See .roadsafe-ui-audit/blender-color-audit.json\`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(\`FAIL: \${failure}\`);
  process.exit(1);
}

console.log("PASS: No legacy deep-blue RoadSafe UI chrome remains.");
`;

write("scripts/verify-blender-ui.mjs", verifier);

/*
 * Ensure package script exists.
 */
backup("package.json");
const nextPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
nextPackage.scripts = nextPackage.scripts ?? {};
nextPackage.scripts["ui:verify"] = "node scripts/verify-blender-ui.mjs";
fs.writeFileSync(packagePath, `${JSON.stringify(nextPackage, null, 2)}\n`, "utf8");
if (!changedFiles.includes("package.json")) changedFiles.push("package.json");

/*
 * Save state before verification/build.
 */
const tracked = [...changedFiles];

function restore() {
  console.log("\nRestoring pre-purge files...");
  for (const relativePath of tracked) {
    const target = path.join(root, relativePath);
    const backupFile = path.join(backupRoot, relativePath);

    if (existedBefore[relativePath]) {
      if (!fs.existsSync(backupFile)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backupFile, target);
      console.log(`RESTORED ${relativePath}`);
    } else if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      console.log(`REMOVED ${relativePath}`);
    }
  }
}

try {
  execSync("npm run ui:verify", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  restore();
  console.error(
    "\nBlender color purge failed verification/build. All changes were restored.",
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      backupRoot,
      changedFiles: tracked,
      existedBefore,
      replacementCount,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Blender color purge complete.

Source replacements: ${replacementCount}
Changed files: ${tracked.length}

Rules now enforced:
- no legacy deep navy RoadSafe UI palette;
- no blue/indigo/sky/cyan/purple/violet Tailwind UI utilities;
- no known navy Three.js/AR workspace backgrounds;
- Blender color guard is imported last;
- ui:verify fails if those colours reappear.

Audit:
  Get-Content .\\.roadsafe-ui-audit\\blender-color-audit.json

Start:
  npm run dev

Rollback:
  node revoke-blender-color-purge.mjs
`);
