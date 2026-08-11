import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const RELATIVE_TARGET =
  "src/components/reconstruction/Reconstruction3DViewer.tsx";
const TARGET = path.join(ROOT, ...RELATIVE_TARGET.split("/"));
const HELPER_NAME = "setRoadSafeMaterialUnionProperty";

function stop(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

if (!fs.existsSync(TARGET)) {
  stop(
    `Could not find ${RELATIVE_TARGET}. Run this installer from the A-R-V1 repository root.`,
  );
}

function runTypeScript() {
  const executable =
    process.platform === "win32"
      ? path.join(ROOT, "node_modules", ".bin", "tsc.cmd")
      : path.join(ROOT, "node_modules", ".bin", "tsc");

  if (!fs.existsSync(executable)) {
    stop(
      "Local TypeScript compiler was not found. Run npm install first.",
    );
  }

  return spawnSync(
    executable,
    ["-b", "--pretty", "false"],
    {
      cwd: ROOT,
      encoding: "utf8",
      shell: false,
    },
  );
}

console.log("");
console.log(
  "RoadSafe Main 3D View Polish V1 — material repair V3",
);
console.log(
  "=====================================================",
);
console.log(
  "[1/4] Reading the current TypeScript compiler errors...",
);

const firstCheck = runTypeScript();
const compilerText =
  `${firstCheck.stdout ?? ""}\n${firstCheck.stderr ?? ""}`;

if (firstCheck.status === 0) {
  console.log(
    "[OK] TypeScript already passes. No repair is required.",
  );
  console.log(
    "Run: npm run build",
  );
  process.exit(0);
}

const normalizedTarget =
  RELATIVE_TARGET.replaceAll("/", "[\\\\/]");

const errorPattern = new RegExp(
  `${normalizedTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\[\\\\\\\\/\\]", "[\\\\/]")}\\((\\d+),(\\d+)\\): error TS2339: Property '(transparent|opacity)' does not exist on type 'Material`,
  "g",
);

let matches =
  Array.from(
    compilerText.matchAll(errorPattern),
  );

/*
  Windows/tsc path formatting can vary, so use a simpler fallback that
  keys on the filename plus the exact TS2339 Material-union message.
*/
if (matches.length === 0) {
  const fallbackPattern =
    /Reconstruction3DViewer\.tsx\((\d+),(\d+)\): error TS2339: Property '(transparent|opacity)' does not exist on type 'Material/g;

  matches =
    Array.from(
      compilerText.matchAll(fallbackPattern),
    );
}

if (matches.length === 0) {
  console.error("");
  console.error(
    "[RoadSafe] The current compiler failure is no longer the four Material-union errors.",
  );
  console.error(
    "[RoadSafe] No file was changed. Current TypeScript output:",
  );
  console.error("");
  console.error(compilerText.trim());
  process.exit(2);
}

const errors =
  matches.map((match) => ({
    line: Number(match[1]),
    column: Number(match[2]),
    property: match[3],
  }));

console.log(
  `[OK] Found ${errors.length} Material-union error(s):`,
);

for (const error of errors) {
  console.log(
    `     line ${error.line}: ${error.property}`,
  );
}

const original =
  fs.readFileSync(TARGET, "utf8");

const eol =
  original.includes("\r\n")
    ? "\r\n"
    : "\n";

const lines =
  original.split(/\r?\n/);

const changedLines = [];

for (const error of errors) {
  const index = error.line - 1;

  if (
    index < 0 ||
    index >= lines.length
  ) {
    stop(
      `Compiler reported line ${error.line}, but that line does not exist in the current viewer. No file was changed.`,
    );
  }

  const current =
    lines[index];

  /*
    Match the exact failing assignment at the compiler-reported line.
    Examples this intentionally supports:

      gridMaterial.transparent = true;
      majorMaterial.opacity = 0.35;
      helper.materialRef.transparent = true;

    It does not care how that receiver was created.
  */
  const assignment =
    current.match(
      /^(\s*)([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.(transparent|opacity)\s*=\s*(.+);\s*$/,
    );

  if (
    !assignment ||
    assignment[3] !== error.property
  ) {
    console.error("");
    console.error(
      `[RoadSafe] Could not safely rewrite compiler line ${error.line}.`,
    );
    console.error(
      `[RoadSafe] Actual line: ${current.trim()}`,
    );
    console.error(
      "[RoadSafe] No file was changed.",
    );
    process.exit(3);
  }

  const [, indent, receiver, property, rawValue] =
    assignment;

  lines[index] =
    `${indent}${HELPER_NAME}(${receiver}, "${property}", ${rawValue.trim()});`;

  changedLines.push({
    line: error.line,
    before: current.trim(),
    after: lines[index].trim(),
  });
}

let source =
  lines.join(eol);

if (
  !source.includes(
    `function ${HELPER_NAME}(`,
  )
) {
  const componentMarker =
    "function Reconstruction3DViewer(";

  const componentIndex =
    source.indexOf(componentMarker);

  if (componentIndex < 0) {
    stop(
      "Could not find the Reconstruction3DViewer function declaration. No file was changed.",
    );
  }

  const helper =
`function ${HELPER_NAME}(
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
    helper.replaceAll("\n", eol) +
    source.slice(componentIndex);
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `main-3d-view-polish-material-fix-v3-${stamp}`,
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
  "[2/4] Applied repairs to the exact compiler-reported lines:",
);

for (const item of changedLines) {
  console.log(
    `     ${item.line}: ${item.before}`,
  );
  console.log(
    `          -> ${item.after}`,
  );
}

console.log("");
console.log(
  `[3/4] Backup created: ${backupDir}`,
);

console.log("");
console.log(
  "[4/4] Re-running TypeScript verification...",
);

const secondCheck =
  runTypeScript();

const secondText =
  `${secondCheck.stdout ?? ""}\n${secondCheck.stderr ?? ""}`.trim();

if (secondCheck.status !== 0) {
  console.error("");
  console.error(
    "[RoadSafe] Repair was applied, but TypeScript still has errors:",
  );
  console.error("");
  console.error(secondText);
  console.error("");
  console.error(
    `[RoadSafe] Your pre-repair viewer is backed up at: ${backupDir}`,
  );
  process.exit(4);
}

console.log(
  "[OK] TypeScript verification passed.",
);
console.log(
  "[OK] Only the compiler-reported transparent/opacity assignments were changed.",
);
console.log(
  "[OK] No physics, theme, extraction, camera, or transform-control behavior was changed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run build",
);
