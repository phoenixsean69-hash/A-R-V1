import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(
  ROOT,
  "src",
  "components",
  "reconstruction",
  "Reconstruction3DViewer.tsx",
);

const HELPER_MARKER = "function setRoadSafeGridMaterialProperty(";

function fail(message) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (!fs.existsSync(TARGET)) {
  fail(
    "Reconstruction3DViewer.tsx was not found. Run this installer from the A-R-V1 repository root.",
  );
}

let source = fs.readFileSync(TARGET, "utf8");
const original = source;

// Discover only actual THREE.GridHelper variables. We deliberately avoid
// changing ordinary meshes/materials elsewhere in the reconstruction viewer.
const gridVariables = Array.from(
  source.matchAll(
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+THREE\.GridHelper\s*\(/g,
  ),
  (match) => match[1],
);

if (gridVariables.length === 0) {
  fail(
    "No THREE.GridHelper instances were found. The local viewer no longer matches the Main 3D View Polish V1 layout.",
  );
}

let replacementCount = 0;

for (const variable of gridVariables) {
  const safeName = escapeRegExp(variable);

  const transparentPattern = new RegExp(
    `\\b${safeName}\\.material\\.transparent\\s*=\\s*([^;\\n]+);`,
    "g",
  );

  source = source.replace(
    transparentPattern,
    (_match, value) => {
      replacementCount += 1;
      return `setRoadSafeGridMaterialProperty(${variable}.material, "transparent", ${value.trim()});`;
    },
  );

  const opacityPattern = new RegExp(
    `\\b${safeName}\\.material\\.opacity\\s*=\\s*([^;\\n]+);`,
    "g",
  );

  source = source.replace(
    opacityPattern,
    (_match, value) => {
      replacementCount += 1;
      return `setRoadSafeGridMaterialProperty(${variable}.material, "opacity", ${value.trim()});`;
    },
  );
}

if (!source.includes(HELPER_MARKER)) {
  const componentMarker = "function Reconstruction3DViewer(";
  const componentIndex = source.indexOf(componentMarker);

  if (componentIndex < 0) {
    fail(
      "Could not find the Reconstruction3DViewer component declaration. No file was changed.",
    );
  }

  const helper = `function setRoadSafeGridMaterialProperty(
  material: THREE.Material | THREE.Material[],
  property: "transparent" | "opacity",
  value: boolean | number,
): void {
  const materials =
    Array.isArray(material)
      ? material
      : [material];

  materials.forEach((entry) => {
    if (property === "transparent") {
      entry.transparent = Boolean(value);
    } else {
      entry.opacity = Number(value);
    }

    entry.needsUpdate = true;
  });
}

`;

  source =
    source.slice(0, componentIndex) +
    helper +
    source.slice(componentIndex);
}

if (source === original) {
  if (source.includes(HELPER_MARKER)) {
    console.log("");
    console.log(
      "[RoadSafe] Grid material type-safety repair is already applied.",
    );
    console.log("[RoadSafe] Next run: npm run build");
    process.exit(0);
  }

  fail(
    "The expected GridHelper material assignments were not found. No file was changed.",
  );
}

// Main 3D View Polish V1 produced four compiler errors: transparent/opacity
// on the fine and major GridHelpers. We accept partial prior repairs, but
// report exactly what this run changed.
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  ".roadsafe-backups",
  `main-3d-view-polish-material-fix-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(
  path.join(backupDir, "Reconstruction3DViewer.tsx"),
  original,
  "utf8",
);

fs.writeFileSync(TARGET, source, "utf8");

console.log("");
console.log("RoadSafe Main 3D View Polish V1 — material repair");
console.log("==================================================");
console.log(
  `[OK] GridHelper variables found: ${gridVariables.join(", ")}`,
);
console.log(
  `[OK] Direct material assignments repaired: ${replacementCount}`,
);
console.log(
  "[OK] Supports both THREE.Material and THREE.Material[] safely.",
);
console.log(
  "[OK] No physics, forensic extraction, theme, or transform-gizmo logic was changed.",
);
console.log(`[OK] Backup: ${backupDir}`);
console.log("");
console.log("Next run:");
console.log("  npm run build");
