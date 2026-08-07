import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  console.error(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const MAP_MAX_ZOOM = 17;

const mapFiles = [
  "src/components/map/AccidentMap.tsx",
  "src/components/cases/RoadLocationMap.tsx",
  "src/components/fieldPlacement/FieldPlacementMap.tsx",
  "src/components/cases/GoogleRoadLocationMap.tsx",
  "src/components/fieldPlacement/GoogleFieldPlacementMap.tsx",
  "src/components/reconstruction/ReconstructionBasemap.tsx",
  "src/components/reconstruction/GoogleReconstructionBasemap.tsx",
];

const cssRelativePath =
  "src/styles/mapWorkstation.css";

const mainRelativePath =
  "src/main.tsx";

const verifierRelativePath =
  "scripts/verify-map-display-policy.mjs";

const trackedPaths = [
  ...mapFiles,
  cssRelativePath,
  mainRelativePath,
  verifierRelativePath,
  "package.json",
];

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  `map-policy-${timestamp}`,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-global-dark-map-policy.json",
);

const existedBefore = {};
const changedFiles = [];

function backup(relativePath) {
  if (relativePath in existedBefore) {
    return;
  }

  const sourcePath = path.join(
    root,
    relativePath,
  );

  const exists = fs.existsSync(sourcePath);

  existedBefore[relativePath] = exists;

  if (!exists) {
    return;
  }

  const backupPath = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(backupPath),
    { recursive: true },
  );

  fs.copyFileSync(
    sourcePath,
    backupPath,
  );
}

function write(relativePath, content) {
  backup(relativePath);

  const targetPath = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(targetPath),
    { recursive: true },
  );

  fs.writeFileSync(
    targetPath,
    content,
    "utf8",
  );

  if (!changedFiles.includes(relativePath)) {
    changedFiles.push(relativePath);
  }
}

function transformNumericProperty(
  source,
  property,
) {
  const pattern = new RegExp(
    `\\b${property}:\\s*(\\d+(?:\\.\\d+)?)`,
    "g",
  );

  return source.replace(
    pattern,
    (full, valueText) => {
      const value = Number(valueText);

      if (
        Number.isFinite(value) &&
        value > MAP_MAX_ZOOM
      ) {
        return `${property}: ${MAP_MAX_ZOOM}`;
      }

      return full;
    },
  );
}

function clampMapFile(relativePath) {
  const absolutePath = path.join(
    root,
    relativePath,
  );

  if (!fs.existsSync(absolutePath)) {
    console.log(
      `SKIPPED ${relativePath} — not present`,
    );
    return;
  }

  const original = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  let next = original;

  /*
   * MapLibre / Google constructor and raster-source ceilings.
   */
  next = transformNumericProperty(
    next,
    "maxZoom",
  );

  next = transformNumericProperty(
    next,
    "maxzoom",
  );

  /*
   * Constants such as AccidentMap's MAX_ALLOWED_ZOOM.
   */
  next = next.replace(
    /const\s+MAX_ALLOWED_ZOOM\s*=\s*\d+(?:\.\d+)?\s*;/g,
    `const MAX_ALLOWED_ZOOM = ${MAP_MAX_ZOOM};`,
  );

  /*
   * setMaxZoom(number)
   */
  next = next.replace(
    /setMaxZoom\(\s*(\d+(?:\.\d+)?)\s*\)/g,
    (full, valueText) => {
      const value = Number(valueText);

      return value > MAP_MAX_ZOOM
        ? `setMaxZoom(${MAP_MAX_ZOOM})`
        : full;
    },
  );

  /*
   * Direct Google setZoom(number)
   */
  next = next.replace(
    /setZoom\(\s*(\d+(?:\.\d+)?)\s*\)/g,
    (full, valueText) => {
      const value = Number(valueText);

      return value > MAP_MAX_ZOOM
        ? `setZoom(${MAP_MAX_ZOOM})`
        : full;
    },
  );

  /*
   * MaxZoomService clamps.
   */
  next = next.replace(
    /Math\.min\(\s*result\.zoom\s*,\s*(\d+(?:\.\d+)?)\s*\)/g,
    `Math.min(result.zoom, ${MAP_MAX_ZOOM})`,
  );

  next = next.replace(
    /map\.setZoom\(\s*result\.zoom\s*\)/g,
    `map.setZoom(Math.min(result.zoom, ${MAP_MAX_ZOOM}))`,
  );

  /*
   * Common high initial zooms in map constructors.
   * Only touches map-related files from the explicit list above.
   */
  next = next.replace(
    /\bzoom:\s*(18|19|20|21|22)\b/g,
    `zoom: ${MAP_MAX_ZOOM}`,
  );

  next = next.replace(
    /\bzoom:\s*([A-Za-z_$][\w$?.]*)\s*\?\s*(18|19|20|21|22)\s*:\s*(\d+(?:\.\d+)?)/g,
    (_full, condition, _high, fallback) =>
      `zoom: ${condition} ? ${MAP_MAX_ZOOM} : ${fallback}`,
  );

  /*
   * Default zoom parameters.
   */
  next = next.replace(
    /\bzoom\s*=\s*(18|19|20|21|22)\b/g,
    `zoom = ${MAP_MAX_ZOOM}`,
  );

  /*
   * MapLibre fitBounds max zoom values.
   */
  next = next.replace(
    /\bmaxZoom:\s*(18|19|19\.5|20|21|22)\b/g,
    `maxZoom: ${MAP_MAX_ZOOM}`,
  );

  /*
   * Known field-map single-coordinate focusing.
   */
  next = next.replace(
    /Math\.max\(\s*18\s*,\s*map\.getZoom\(\)\s*\)/g,
    `Math.min(${MAP_MAX_ZOOM}, Math.max(16, map.getZoom()))`,
  );

  next = next.replace(
    /Math\.max\(\s*18\s*,\s*map\.getZoom\(\)\s*\?\?\s*18\s*\)/g,
    `${MAP_MAX_ZOOM}`,
  );

  /*
   * Google road-location coordinate focusing.
   */
  next = next.replace(
    /map\.setZoom\(\s*Math\.max\(\s*map\.getZoom\(\)\s*\?\?\s*17\s*,\s*17\.5\s*\)\s*\)/g,
    `map.setZoom(${MAP_MAX_ZOOM})`,
  );

  /*
   * Make explicit satellite/field conditional starting zooms safe.
   */
  next = next.replace(
    /\bzoom:\s*calibration\s*\?\s*(18|19|20|21|22)\s*:\s*(\d+(?:\.\d+)?)/g,
    (_full, _high, fallback) =>
      `zoom: calibration ? ${MAP_MAX_ZOOM} : ${fallback}`,
  );

  next = next.replace(
    /\bzoom:\s*initial\s*\?\s*(18|19|20|21|22)\s*:\s*(\d+(?:\.\d+)?)/g,
    (_full, _high, fallback) =>
      `zoom: initial ? ${MAP_MAX_ZOOM} : ${fallback}`,
  );

  /*
   * Reconstruction MapLibre basemap currently has no explicit maxZoom.
   */
  if (
    relativePath.endsWith(
      "ReconstructionBasemap.tsx",
    ) &&
    !relativePath.endsWith(
      "GoogleReconstructionBasemap.tsx",
    ) &&
    !/\bmaxZoom\s*:/.test(next)
  ) {
    next = next.replace(
      /(\bpitch:\s*0,\s*\n)/,
      `$1      maxZoom: ${MAP_MAX_ZOOM},\n`,
    );
  }

  /*
   * Raster sources should overzoom their last valid tile instead of requesting
   * provider zooms above our UI ceiling.
   */
  if (
    next.includes('type: "raster"') &&
    !/\bmaxzoom\s*:/.test(next)
  ) {
    next = next.replace(
      /(tileSize:\s*256,\s*\n)/g,
      `$1      maxzoom: ${MAP_MAX_ZOOM},\n`,
    );
  }

  if (next !== original) {
    write(
      relativePath,
      next,
    );

    console.log(
      `CHANGED ${relativePath}`,
    );
  } else {
    console.log(
      `UNCHANGED ${relativePath}`,
    );
  }
}

for (const relativePath of mapFiles) {
  clampMapFile(relativePath);
}

/*
 * Shared dark-map workstation styling.
 *
 * We darken actual map canvases / imagery, not their surrounding application
 * panels. HTML markers and RoadSafe controls remain crisp.
 */
const mapCss = `/*
 * RoadSafe global map workstation policy
 * Blender-style dark maps + restrained controls.
 */

:root {
  --roadsafe-map-bg: #202020;
  --roadsafe-map-panel: #292929;
  --roadsafe-map-control: #383838;
  --roadsafe-map-control-hover: #414141;
  --roadsafe-map-border: #171717;
  --roadsafe-map-border-mid: #494949;
  --roadsafe-map-text: #dedede;
  --roadsafe-map-muted: #969696;
  --roadsafe-map-accent: #e8872d;
}

/* MapLibre map surfaces */
.maplibregl-map {
  background: var(--roadsafe-map-bg) !important;
}

.maplibregl-map .maplibregl-canvas {
  filter:
    brightness(0.58)
    saturate(0.62)
    contrast(1.14) !important;
}

/* Google map / Street View surfaces */
.roadsafe-google-map {
  background: var(--roadsafe-map-bg) !important;
}

.roadsafe-google-map .gm-style > div:first-child {
  filter:
    brightness(0.6)
    saturate(0.65)
    contrast(1.12);
}

/*
 * Google sometimes renders vector tiles into canvas elements nested below the
 * primary pane. This keeps those dark as well without altering surrounding
 * RoadSafe UI.
 */
.roadsafe-google-map .gm-style canvas {
  filter:
    brightness(0.6)
    saturate(0.65)
    contrast(1.12);
}

/* MapLibre controls */
.maplibregl-ctrl-group {
  overflow: hidden !important;
  border: 1px solid var(--roadsafe-map-border) !important;
  border-radius: 2px !important;
  background: var(--roadsafe-map-panel) !important;
  box-shadow:
    0 4px 14px rgb(0 0 0 / 0.34) !important;
}

.maplibregl-ctrl-group button {
  border: 0 !important;
  border-bottom:
    1px solid var(--roadsafe-map-border) !important;
  border-radius: 0 !important;
  background:
    linear-gradient(
      180deg,
      #414141 0%,
      #343434 100%
    ) !important;
}

.maplibregl-ctrl-group button:last-child {
  border-bottom: 0 !important;
}

.maplibregl-ctrl-group button:hover {
  background:
    var(--roadsafe-map-control-hover) !important;
}

.maplibregl-ctrl-group button:disabled {
  opacity: 0.38 !important;
  cursor: not-allowed !important;
}

.maplibregl-ctrl-group
  .maplibregl-ctrl-icon {
  filter:
    invert(0.86)
    grayscale(1)
    brightness(1.35);
}

.maplibregl-ctrl-attrib,
.maplibregl-ctrl-scale {
  border-color:
    var(--roadsafe-map-border-mid) !important;
  background:
    rgb(41 41 41 / 0.9) !important;
  color:
    var(--roadsafe-map-text) !important;
}

.maplibregl-ctrl-attrib a {
  color: #c6c6c6 !important;
}

.maplibregl-popup-content {
  border: 1px solid var(--roadsafe-map-border-mid) !important;
  border-radius: 2px !important;
  background:
    var(--roadsafe-map-panel) !important;
  color:
    var(--roadsafe-map-text) !important;
  box-shadow:
    0 8px 24px rgb(0 0 0 / 0.42) !important;
}

.maplibregl-popup-tip {
  border-top-color:
    var(--roadsafe-map-panel) !important;
  border-bottom-color:
    var(--roadsafe-map-panel) !important;
}

.maplibregl-popup-close-button {
  color:
    var(--roadsafe-map-text) !important;
}

/*
 * Selection overlays keep the RoadSafe orange selection language.
 * This does not alter heatmap/data colours.
 */
.maplibregl-map:focus-within {
  outline:
    1px solid rgb(232 135 45 / 0.26);
  outline-offset: -1px;
}
`;

write(
  cssRelativePath,
  mapCss,
);

/*
 * Import mapWorkstation.css last so provider CSS cannot repaint controls.
 */
const mainPath = path.join(
  root,
  mainRelativePath,
);

if (!fs.existsSync(mainPath)) {
  console.error(
    "src/main.tsx was not found.",
  );
  process.exit(1);
}

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const mapImport =
  'import "./styles/mapWorkstation.css";';

mainSource = mainSource
  .replace(
    /^\s*import\s+["']\.\/styles\/mapWorkstation\.css["'];?\s*$/gm,
    "",
  )
  .replace(/\n{3,}/g, "\n\n");

const cssImports = mainSource.match(
  /^import\s+["'][^"']+\.css["'];?$/gm,
) ?? [];

if (cssImports.length > 0) {
  const lastImport =
    cssImports[cssImports.length - 1];

  mainSource = mainSource.replace(
    lastImport,
    `${lastImport}\n${mapImport}`,
  );
} else {
  mainSource =
    `${mapImport}\n${mainSource}`;
}

write(
  mainRelativePath,
  mainSource,
);

/*
 * Verify the map policy structurally.
 */
const verifier = `import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const maxAllowedZoom = ${MAP_MAX_ZOOM};

const files = ${JSON.stringify(mapFiles, null, 2)};

const failures = [];
const inspected = [];

for (const relativePath of files) {
  const absolutePath = path.join(
    root,
    relativePath,
  );

  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const source = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  inspected.push(relativePath);

  const propertyPattern =
    /\\\\b(?:maxZoom|maxzoom)\\\\s*:\\\\s*(\\\\d+(?:\\\\.\\\\d+)?)/g;

  for (const match of source.matchAll(propertyPattern)) {
    const value = Number(match[1]);

    if (value > maxAllowedZoom) {
      failures.push(
        \`\${relativePath}: map max zoom \${value} exceeds \${maxAllowedZoom}\`,
      );
    }
  }

  const setMaxPattern =
    /setMaxZoom\\\\(\\\\s*(\\\\d+(?:\\\\.\\\\d+)?)\\\\s*\\\\)/g;

  for (const match of source.matchAll(setMaxPattern)) {
    const value = Number(match[1]);

    if (value > maxAllowedZoom) {
      failures.push(
        \`\${relativePath}: setMaxZoom(\${value}) exceeds \${maxAllowedZoom}\`,
      );
    }
  }

  const directZoomPattern =
    /setZoom\\\\(\\\\s*(18|19|20|21|22)\\\\s*\\\\)/g;

  for (const match of source.matchAll(directZoomPattern)) {
    failures.push(
      \`\${relativePath}: setZoom(\${match[1]}) exceeds safe map policy\`,
    );
  }
}

const cssPath = path.join(
  root,
  "src/styles/mapWorkstation.css",
);

if (!fs.existsSync(cssPath)) {
  failures.push(
    "src/styles/mapWorkstation.css is missing.",
  );
}

const mainPath = path.join(
  root,
  "src/main.tsx",
);

if (fs.existsSync(mainPath)) {
  const source = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cssImports = Array.from(
    source.matchAll(
      /^import\\\\s+["']([^"']+\\\\.css)["'];?$/gm,
    ),
    (match) => match[1],
  );

  if (
    cssImports.at(-1) !==
    "./styles/mapWorkstation.css"
  ) {
    failures.push(
      "mapWorkstation.css must be the final CSS import.",
    );
  }
}

console.log(
  \`Map display audit: \${inspected.length} map component(s), max zoom \${maxAllowedZoom}.\`,
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(\`FAIL: \${failure}\`);
  }

  process.exit(1);
}

console.log(
  "PASS: Map zoom ceilings and dark-map stylesheet are installed.",
);
`;

write(
  verifierRelativePath,
  verifier,
);

/*
 * package.json verification command
 */
backup("package.json");

const updatedPackage = JSON.parse(
  fs.readFileSync(
    packagePath,
    "utf8",
  ),
);

updatedPackage.scripts =
  updatedPackage.scripts ?? {};

updatedPackage.scripts["map:verify"] =
  "node scripts/verify-map-display-policy.mjs";

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(updatedPackage, null, 2)}\n`,
  "utf8",
);

if (!changedFiles.includes("package.json")) {
  changedFiles.push("package.json");
}

function restoreAll() {
  console.log(
    "\nRestoring pre-map-policy files...",
  );

  for (const relativePath of changedFiles) {
    const targetPath = path.join(
      root,
      relativePath,
    );

    const backupPath = path.join(
      backupRoot,
      relativePath,
    );

    if (existedBefore[relativePath]) {
      if (!fs.existsSync(backupPath)) {
        continue;
      }

      fs.mkdirSync(
        path.dirname(targetPath),
        { recursive: true },
      );

      fs.copyFileSync(
        backupPath,
        targetPath,
      );

      console.log(
        `RESTORED ${relativePath}`,
      );
    } else if (fs.existsSync(targetPath)) {
      fs.rmSync(
        targetPath,
        { force: true },
      );

      console.log(
        `REMOVED ${relativePath}`,
      );
    }
  }
}

try {
  execSync(
    "node --check scripts/verify-map-display-policy.mjs",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );

  execSync(
    "npm run map:verify",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );

  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  restoreAll();

  console.error(
    "\nGlobal map policy failed verification/build. All changes were restored.",
  );

  process.exit(1);
}

fs.mkdirSync(
  path.dirname(statePath),
  { recursive: true },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      maxZoom:
        MAP_MAX_ZOOM,
      backupRoot,
      changedFiles,
      existedBefore,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Global RoadSafe map policy installed successfully.

Zoom:
- maximum interactive/programmatic tile-map zoom: ${MAP_MAX_ZOOM}
- fitBounds max zooms are clamped
- Google search-result zooms are clamped
- Google MaxZoomService results are clamped
- reconstruction Street/Satellite basemaps are clamped
- raster sources will not request tiles above the safe ceiling

Appearance:
- MapLibre canvases are darkened
- Google map/Street View surfaces are darkened
- map backgrounds use Blender #202020
- MapLibre controls/popups use Blender grays
- RoadSafe HTML markers and outer panels remain crisp

Verify:
  npm run map:verify

Start:
  npm run dev

Rollback:
  node revoke-global-dark-map-policy.mjs
`);
