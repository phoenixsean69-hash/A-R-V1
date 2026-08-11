import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const HELPER_REL =
  "src/components/reconstruction/roadSafeViewportPolish.ts";

const HELPER =
  path.join(ROOT, ...HELPER_REL.split("/"));

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

if (!fs.existsSync(HELPER)) {
  fail(
    `Could not find ${HELPER_REL}. Install Main 3D Viewport Polish V3 first.`,
  );
}

const original =
  fs.readFileSync(
    HELPER,
    "utf8",
  );

let source =
  original;

if (
  !source.includes(
    "[RoadSafe:Main3DViewportPolishV3]",
  )
) {
  fail(
    "The local viewport helper does not match Viewport Polish V3. No file was changed.",
  );
}

/*
 * Give every visible positive-axis element an axis identity:
 * shaft, arrow head and label.
 *
 * The negative endpoint remains clickable too, but clicking any X/Y/Z
 * handle now toggles the viewing side for that axis.
 */

const shaftAnchor =
`  shaft.userData.viewportGizmo =
    true;

  root.add(
    shaft,
  );`;

const shaftReplacement =
`  shaft.userData.viewportGizmo =
    true;

  shaft.userData.axisToggle =
    labelText;

  root.add(
    shaft,
  );`;

if (
  !source.includes(
    shaftAnchor,
  )
) {
  fail(
    "Could not locate the gizmo shaft anchor. No file was changed.",
  );
}

source =
  source.replace(
    shaftAnchor,
    shaftReplacement,
  );

const coneAnchor =
`  cone.position.copy(
    direction
      .clone()
      .multiplyScalar(
        positiveLength +
          0.07,
      ),
  );`;

const coneReplacement =
`${coneAnchor}

  cone.userData.axisToggle =
    labelText;`;

if (
  !source.includes(
    coneAnchor,
  )
) {
  fail(
    "Could not locate the gizmo arrow-head anchor. No file was changed.",
  );
}

source =
  source.replace(
    coneAnchor,
    coneReplacement,
  );

const positiveHitAnchor =
`  positiveHit.userData.axisKey =
    positiveKey;`;

const positiveHitReplacement =
`${positiveHitAnchor}

  positiveHit.userData.axisToggle =
    labelText;`;

if (
  !source.includes(
    positiveHitAnchor,
  )
) {
  fail(
    "Could not locate the positive axis hit-target anchor. No file was changed.",
  );
}

source =
  source.replace(
    positiveHitAnchor,
    positiveHitReplacement,
  );

const negativeHitAnchor =
`  negativeHit.userData.axisKey =
    negativeKey;`;

const negativeHitReplacement =
`${negativeHitAnchor}

  negativeHit.userData.axisToggle =
    labelText;`;

if (
  !source.includes(
    negativeHitAnchor,
  )
) {
  fail(
    "Could not locate the negative axis hit-target anchor. No file was changed.",
  );
}

source =
  source.replace(
    negativeHitAnchor,
    negativeHitReplacement,
  );

const labelAnchor =
`  label.position.copy(
    direction
      .clone()
      .multiplyScalar(
        1.72,
      ),
  );

  root.add(
    label,
  );`;

const labelReplacement =
`  label.position.copy(
    direction
      .clone()
      .multiplyScalar(
        1.72,
      ),
  );

  label.userData.axisToggle =
    labelText;

  root.add(
    label,
  );`;

if (
  !source.includes(
    labelAnchor,
  )
) {
  fail(
    "Could not locate the axis-label anchor. No file was changed.",
  );
}

source =
  source.replace(
    labelAnchor,
    labelReplacement,
  );

/*
 * Replace the old hit-target list. V3 only raycasted the invisible spheres.
 * V4 raycasts the visible shaft, arrow head, label and both endpoint targets.
 */
const hitTargetAnchor =
`  const hitTargets =
    gizmoRoot.children.filter(
      (object) =>
        Boolean(
          object.userData.axisKey,
        ),
    );`;

const hitTargetReplacement =
`  const hitTargets =
    gizmoRoot.children.filter(
      (object) =>
        Boolean(
          object.userData.axisToggle ||
          object.userData.axisKey,
        ),
    );`;

if (
  !source.includes(
    hitTargetAnchor,
  )
) {
  fail(
    "Could not locate the V3 gizmo hit-target list. No file was changed.",
  );
}

source =
  source.replace(
    hitTargetAnchor,
    hitTargetReplacement,
  );

/*
 * Store the side currently selected for each axis.
 * First click is positive, second is negative, then positive again.
 */
const raycasterAnchor =
`  const gizmoPointer =
    new THREE.Vector2();`;

const raycasterReplacement =
`${raycasterAnchor}

  const axisToggleSide: Record<
    "X" | "Y" | "Z",
    1 | -1
  > = {
    X: -1,
    Y: -1,
    Z: -1,
  };

  const toggledAxisKey =
    (
      axis: "X" | "Y" | "Z",
    ): AxisKey => {
      axisToggleSide[axis] =
        axisToggleSide[axis] === 1
          ? -1
          : 1;

      if (axis === "X") {
        return axisToggleSide.X === 1
          ? "PX"
          : "NX";
      }

      if (axis === "Y") {
        return axisToggleSide.Y === 1
          ? "PY"
          : "NY";
      }

      return axisToggleSide.Z === 1
        ? "PZ"
        : "NZ";
    };`;

if (
  !source.includes(
    raycasterAnchor,
  )
) {
  fail(
    "Could not locate the gizmo pointer anchor. No file was changed.",
  );
}

source =
  source.replace(
    raycasterAnchor,
    raycasterReplacement,
  );

/*
 * Replace pointer resolution:
 * - visible X/Y/Z handle => toggle that axis
 * - fallback axisKey remains supported
 */
const pointerAnchor =
`      const axisKey =
        hit?.object.userData
          .axisKey as
          | AxisKey
          | undefined;

      if (
        axisKey
      ) {
        snapToAxis(
          axisKey,
        );
      }`;

const pointerReplacement =
`      const axisToggle =
        hit?.object.userData
          .axisToggle as
          | "X"
          | "Y"
          | "Z"
          | undefined;

      if (
        axisToggle
      ) {
        snapToAxis(
          toggledAxisKey(
            axisToggle,
          ),
        );

        return;
      }

      const axisKey =
        hit?.object.userData
          .axisKey as
          | AxisKey
          | undefined;

      if (
        axisKey
      ) {
        snapToAxis(
          axisKey,
        );
      }`;

if (
  !source.includes(
    pointerAnchor,
  )
) {
  fail(
    "Could not locate the V3 gizmo click handler. No file was changed.",
  );
}

source =
  source.replace(
    pointerAnchor,
    pointerReplacement,
  );

/*
 * Update marker/version only after all anchors are confirmed.
 */
source =
  source.replace(
    "[RoadSafe:Main3DViewportPolishV3]",
    "[RoadSafe:Main3DViewportPolishV4AxisToggle]",
  );

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `main-3d-view-gizmo-axis-toggle-v4-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  path.join(
    backupDir,
    "roadSafeViewportPolish.ts",
  ),
  original,
  "utf8",
);

fs.writeFileSync(
  HELPER,
  source,
  "utf8",
);

function resolveTypeScriptCli() {
  const candidates = [
    path.join(
      ROOT,
      "node_modules",
      "typescript",
      "bin",
      "tsc",
    ),
    path.join(
      ROOT,
      "node_modules",
      "typescript",
      "bin",
      "tsc.js",
    ),
  ];

  return candidates.find(
    (candidate) =>
      fs.existsSync(
        candidate,
      ),
  );
}

console.log("");
console.log(
  "RoadSafe 3D View Gizmo Axis Toggle V4",
);
console.log(
  "=====================================",
);
console.log(
  "[OK] Kept the compact 92 × 92 px orientation gizmo.",
);
console.log(
  "[OK] X arrow / shaft / label are clickable.",
);
console.log(
  "[OK] Y arrow / shaft / label are clickable.",
);
console.log(
  "[OK] Z arrow / shaft / label are clickable.",
);
console.log(
  "[OK] Repeated X clicks toggle +X / -X.",
);
console.log(
  "[OK] Repeated Y clicks toggle +Y / -Y.",
);
console.log(
  "[OK] Repeated Z clicks toggle +Z / -Z.",
);
console.log(
  "[OK] No physics, extraction, grid, participant or object-transform logic changed.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

const tscCli =
  resolveTypeScriptCli();

if (!tscCli) {
  console.log("");
  console.log(
    "[WARN] Local TypeScript CLI was not found; automatic verification skipped.",
  );
  console.log(
    "Run: npm run build",
  );
  process.exit(0);
}

console.log("");
console.log(
  "Verifying TypeScript...",
);

const result =
  spawnSync(
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

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  result.error
) {
  console.error("");
  console.error(
    `[RoadSafe] Could not launch TypeScript: ${result.error.message}`,
  );
  process.exit(2);
}

if (
  result.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] TypeScript verification failed:",
  );
  console.error("");
  console.error(
    output ||
      `(TypeScript exited with status ${String(result.status)}.)`,
  );
  console.error("");
  console.error(
    `[RoadSafe] Backup: ${backupDir}`,
  );
  process.exit(3);
}

console.log(
  "[OK] TypeScript verification passed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run build",
);
console.log(
  "  npm run dev",
);
