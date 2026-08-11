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

const HELPER_NAME = "setRoadSafeMaterialProperty";

function die(message) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(TARGET)) {
  die(
    "src/components/reconstruction/Reconstruction3DViewer.tsx was not found. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
}

const original = fs.readFileSync(TARGET, "utf8");
let source = original;

/*
  Fix the exact TypeScript shape behind:

    Property 'transparent' does not exist on type
    'Material | Material[]'

  and the same error for `opacity`.

  This intentionally does NOT depend on THREE.GridHelper declarations.
  It repairs direct assignments such as:

    fineGrid.material.transparent = true;
    fineGrid.material.opacity = 0.18;
    majorGrid.material.transparent = true;
    majorGrid.material.opacity = 0.36;

  The receiver can also be a member path such as:
    helpers.minorGrid.material.opacity = ...
*/
const assignmentPattern =
  /^([ \t]*)([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.material\.(transparent|opacity)\s*=\s*([^;\r\n]+);[ \t]*$/gm;

let repaired = 0;

source = source.replace(
  assignmentPattern,
  (_whole, indent, receiver, property, rawValue) => {
    repaired += 1;
    return `${indent}${HELPER_NAME}(${receiver}.material, "${property}", ${rawValue.trim()});`;
  },
);

const helperAlreadyPresent =
  source.includes(`function ${HELPER_NAME}(`);

if (repaired === 0 && helperAlreadyPresent) {
  console.log("");
  console.log(
    "[RoadSafe] The material compatibility repair is already present.",
  );
  console.log("[RoadSafe] Run: npm run build");
  process.exit(0);
}

if (repaired === 0) {
  /*
    Give useful diagnostics instead of falsely claiming the local file
    does not match a particular GridHelper declaration style.
  */
  const suspiciousLines = source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(
      ({ line }) =>
        line.includes(".material") &&
        (
          line.includes("transparent") ||
          line.includes("opacity")
        ),
    );

  console.error("");
  console.error(
    "[RoadSafe] No direct material assignments matched the repair rule.",
  );

  if (suspiciousLines.length > 0) {
    console.error(
      "[RoadSafe] Material-related lines found in the viewer:",
    );

    for (const item of suspiciousLines.slice(0, 20)) {
      console.error(
        `  ${item.number}: ${item.line.trim()}`,
      );
    }
  } else {
    console.error(
      "[RoadSafe] No .material transparent/opacity lines were found.",
    );
  }

  console.error("");
  console.error(
    "[RoadSafe] No file was changed.",
  );
  process.exit(2);
}

if (!helperAlreadyPresent) {
  const componentMarker =
    "function Reconstruction3DViewer(";

  const componentIndex =
    source.indexOf(componentMarker);

  if (componentIndex < 0) {
    die(
      "The assignments were found, but the Reconstruction3DViewer declaration could not be located. No file was changed.",
    );
  }

  const helper = `function ${HELPER_NAME}(
  material: THREE.Material | THREE.Material[],
  property: "transparent" | "opacity",
  value: boolean | number,
): void {
  const materials =
    Array.isArray(material)
      ? material
      : [material];

  for (const entry of materials) {
    if (property === "transparent") {
      entry.transparent = Boolean(value);
    } else {
      entry.opacity = Number(value);
    }

    entry.needsUpdate = true;
  }
}

`;

  source =
    source.slice(0, componentIndex) +
    helper +
    source.slice(componentIndex);
}

if (source === original) {
  console.log("");
  console.log(
    "[RoadSafe] Nothing needed changing.",
  );
  process.exit(0);
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  ".roadsafe-backups",
  `main-3d-view-polish-material-fix-v2-${stamp}`,
);

fs.mkdirSync(
  backupDir,
  { recursive: true },
);

fs.writeFileSync(
  path.join(
    backupDir,
    "Reconstruction3DViewer.tsx",
  ),
  original,
  "utf8",
);

fs.writeFileSync(
  TARGET,
  source,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Main 3D View Polish V1 — material repair V2",
);
console.log(
  "=====================================================",
);
console.log(
  `[OK] Repaired ${repaired} material assignment(s).`,
);
console.log(
  "[OK] Handles THREE.Material and THREE.Material[] correctly.",
);
console.log(
  "[OK] No GridHelper declaration assumptions.",
);
console.log(
  "[OK] No physics changes.",
);
console.log(
  "[OK] No transform-gizmo behavior changes.",
);
console.log(
  "[OK] No theme changes.",
);
console.log(
  "[OK] No forensic/extraction changes.",
);
console.log(
  `[OK] Backup created at: ${backupDir}`,
);
console.log("");
console.log("Now run:");
console.log("  npm run build");
