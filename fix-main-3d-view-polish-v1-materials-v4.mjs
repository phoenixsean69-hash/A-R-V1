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

function resolveTypeScriptCli() {
  const candidates = [
    path.join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    path.join(ROOT, "node_modules", "typescript", "bin", "tsc.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  stop(
    "Could not find the local TypeScript CLI under node_modules/typescript/bin. Run npm install first.",
  );
}

function runTypeScript() {
  const tscCli = resolveTypeScriptCli();

  const result = spawnSync(
    process.execPath,
    [
      tscCli,
      "-b",
      "--pretty",
      "false",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.error) {
    stop(
      `Could not launch TypeScript: ${result.error.message}`,
    );
  }

  return result;
}

function combinedOutput(result) {
  return [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

console.log("");
console.log(
  "RoadSafe Main 3D View Polish V1 — material repair V4",
);
console.log(
  "=====================================================",
);
console.log(
  "[1/4] Running the real local TypeScript compiler through Node...",
);

const firstCheck = runTypeScript();
const compilerText = combinedOutput(firstCheck);

if (firstCheck.status === 0) {
  console.log(
    "[OK] TypeScript already passes. The four Material-union errors are gone.",
  );
  console.log("");
  console.log("Now run:");
  console.log("  npm run build");
  process.exit(0);
}

if (!compilerText) {
  stop(
    `TypeScript exited with status ${String(firstCheck.status)} but produced no output. This is now a genuine compiler-launch anomaly, not a parsed TypeScript error.`,
    2,
  );
}

const errorPattern =
  /Reconstruction3DViewer\.tsx\((\d+),(\d+)\): error TS2339: Property '(transparent|opacity)' does not exist on type 'Material/g;

const matches =
  Array.from(
    compilerText.matchAll(errorPattern),
  );

if (matches.length === 0) {
  console.error("");
  console.error(
    "[RoadSafe] TypeScript is running correctly, but the current failure is not the original Material-union problem.",
  );
  console.error(
    "[RoadSafe] No file was changed. Current TypeScript output:",
  );
  console.error("");
  console.error(compilerText);
  process.exit(3);
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
    process.exit(4);
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
    `main-3d-view-polish-material-fix-v4-${stamp}`,
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
  "[2/4] Repaired the exact compiler-reported lines:",
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
  combinedOutput(secondCheck);

if (secondCheck.status !== 0) {
  console.error("");
  console.error(
    "[RoadSafe] The material repair was applied, but TypeScript still reports errors:",
  );
  console.error("");
  console.error(
    secondText ||
      `(TypeScript exited with status ${String(secondCheck.status)} and no text output.)`,
  );
  console.error("");
  console.error(
    `[RoadSafe] Pre-repair backup: ${backupDir}`,
  );
  process.exit(5);
}

console.log(
  "[OK] TypeScript verification passed.",
);
console.log(
  "[OK] Only compiler-reported transparent/opacity assignments were changed.",
);
console.log(
  "[OK] No physics, theme, extraction, camera, or TransformControls behavior was changed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run build",
);
