import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const failures = [];
const warnings = [];

function requireFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(absolutePath));
    } else if (entry.isFile()) {
      output.push(absolutePath);
    }
  }
  return output;
}

const mainSource = requireFile("src/main.tsx");
const totalThemeSource = requireFile("src/styles/blenderTotalUI.css");
const panelSource = requireFile("src/styles/workstationPanelSystem.css");
const nodeSource = requireFile(
  "src/components/reconstruction/ReconstructionNodeEditor.tsx",
);
const nodeCssSource = requireFile(
  "src/styles/reconstructionNodeEditor.css",
);
const paletteSource = requireFile(
  "src/components/reconstruction/SceneObjectPalette.tsx",
);
const editorSource = requireFile(
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const arSource = requireFile(
  "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
);

const cssImports = Array.from(
  mainSource.matchAll(/^import\s+["']([^"']+\.css)["'];?$/gm),
  (match) => match[1],
);

if (cssImports.at(-1) !== "./styles/blenderTotalUI.css") {
  failures.push(
    "src/styles/blenderTotalUI.css must be the final CSS import in src/main.tsx.",
  );
}

for (const token of [
  "--blender-orange: #e8872d",
  "--js-blue-active: var(--blender-orange)",
  "input[type=\"range\"]::-webkit-slider-thumb",
  ".roadsafe-navigation-link.is-active",
  ".roadsafe-ar-workstation",
  ".blender-object-option",
  ".roadsafe-route-inspector",
]) {
  if (!totalThemeSource.includes(token)) {
    failures.push(`blenderTotalUI.css is missing required rule: ${token}`);
  }
}

if (!panelSource.includes("Station Overview")) {
  failures.push(
    "workstationPanelSystem.css must document Station Overview as the canonical panel source.",
  );
}

for (const token of [
  "ReconstructionNodeEditor",
  "nodeEditorOpen",
  "<ReconstructionNodeEditor",
]) {
  if (!editorSource.includes(token)) {
    failures.push(
      `AccidentReconstructionEditor.tsx is missing node integration token: ${token}`,
    );
  }
}

for (const token of [
  "reconstruction-node-editor",
  "onPointerMove",
  "NodeConnection",
]) {
  if (!nodeSource.includes(token)) {
    failures.push(`ReconstructionNodeEditor.tsx is missing: ${token}`);
  }
}

if (!nodeCssSource.includes("--blender-orange")) {
  failures.push("The reconstruction node editor is not using Blender tokens.");
}

for (const token of [
  'type="checkbox"',
  "material-symbols-outlined",
  "blender-object-option",
  "MATERIAL_SYMBOL_BY_TYPE",
]) {
  if (!paletteSource.includes(token)) {
    failures.push(`SceneObjectPalette.tsx is missing: ${token}`);
  }
}

if (!arSource.includes("roadsafe-ar-workstation")) {
  failures.push(
    "ARReconstructionViewer.tsx is missing the Blender workstation root hook.",
  );
}

const sourceFiles = walk(srcRoot).filter(
  (absolutePath) =>
    /\.(?:ts|tsx|js|jsx|css)$/.test(absolutePath) &&
    path.basename(absolutePath) !== "blenderTotalUI.css",
);

let legacyCoolUtilityCount = 0;
let legacyNavyUtilityCount = 0;
let lucideImportCount = 0;
let scannedLineCount = 0;

const uiMarkupFiles = sourceFiles.filter((absolutePath) =>
  /\.(?:ts|tsx|js|jsx)$/.test(absolutePath),
);

const coolUtilityPattern =
  /\b(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|via|to|outline|divide|fill|stroke|accent)-(?:blue|indigo|sky|cyan|purple|violet)-\d{2,3}(?:\/\d+)?/gi;
const navyUtilityPattern =
  /bg-\[#(?:0[0-9a-f]{5}|1[0-9a-f]{5})\](?:\/\d+)?/gi;

for (const absolutePath of sourceFiles) {
  const source = fs.readFileSync(absolutePath, "utf8");
  scannedLineCount += source.split(/\r?\n/).length;
  if (uiMarkupFiles.includes(absolutePath)) {
    legacyCoolUtilityCount += (source.match(coolUtilityPattern) ?? []).length;
    legacyNavyUtilityCount += (source.match(navyUtilityPattern) ?? []).length;
  }
  lucideImportCount += (source.match(/from\s+["']lucide-react["']/g) ?? []).length;
}

if (lucideImportCount > 0) {
  failures.push(
    `${lucideImportCount} lucide-react import(s) remain. Google Material Symbols are required.`,
  );
}

if (legacyCoolUtilityCount > 0) {
  failures.push(
    `${legacyCoolUtilityCount} old cool-colour Tailwind UI token(s) remain after migration.`,
  );
}

if (legacyNavyUtilityCount > 0) {
  failures.push(
    `${legacyNavyUtilityCount} old navy arbitrary-background token(s) remain after migration.`,
  );
}

const widgetsFallbacks = (
  requireFile("src/components/icons/materialIcons.tsx")
    .match(/createMaterialIcon\("widgets"/g) ?? []
).length;

if (widgetsFallbacks > 0) {
  warnings.push(
    `${widgetsFallbacks} generic Material Symbol fallback(s) remain; they are not old icon-library assets, but should be mapped when new icon names are added.`,
  );
}

const summary = {
  uiFilesScanned: sourceFiles.length,
  linesScanned: scannedLineCount,
  legacyCoolUtilityCount,
  legacyNavyUtilityCount,
  lucideImportCount,
  widgetsFallbacks,
  warnings,
  failures,
};

const reportDirectory = path.join(root, ".roadsafe-ui-audit");
fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(
  path.join(reportDirectory, "blender-ui-verification.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(
  `Blender UI audit: ${sourceFiles.length} UI source files, ${scannedLineCount} lines.`,
);

for (const warning of warnings) {
  console.warn(`WARNING: ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("PASS: RoadSafe UI conforms to the Blender workstation guardrails.");
