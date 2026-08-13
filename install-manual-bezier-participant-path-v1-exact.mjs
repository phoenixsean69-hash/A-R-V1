import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const INSTALLER_DIR =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const PAYLOAD =
  path.join(
    INSTALLER_DIR,
    "roadsafe-manual-bezier-path-v1-payload",
  );

const EXPECTED_SHA256 = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "2f46d4135e92ee52b8fa2b36decf8d5816e3de7b09385d72d6c6f84ba374644a",
  "src/types/reconstruction.ts": "84a599d84416cbe8b59bf2a563f181313d7c38938cfd7d6ae3e4631d4b70e175",
  "src/services/rapierDynamicsService.ts": "3193d02d69183e0450bdc1d58aeff2b1ad59ee71fd0ba97c14cdcd7b8f736274"
};

const GEOMETRY_REL =
  "src/utils/reconstructionGeometry.ts";

const ROUTE_AUTHORING_REL =
  "src/utils/participantRouteAuthoring.ts";

const EXPECTED_GEOMETRY_BLOB_SHA1 =
  "6dd5f3cb7c592b25dcf8f9762129defab505f7bf";

const EXPECTED_ROUTE_AUTHORING_BLOB_SHA1 =
  "c858dddbeddc42402820ca80e1abc63e6eaa45dd";

const FILES = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx":
    "AccidentReconstructionEditor.tsx",

  "src/types/reconstruction.ts":
    "reconstruction.ts",

  "src/services/rapierDynamicsService.ts":
    "rapierDynamicsService.ts",

  "src/utils/reconstructionBezierAuthoring.ts":
    "reconstructionBezierAuthoring.ts"
};

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

function normalisedLfBuffer(
  file,
) {
  const text =
    fs.readFileSync(
      file,
      "utf8",
    )
      .replace(
        /\r\n/g,
        "\n",
      );

  return Buffer.from(
    text,
    "utf8",
  );
}

function gitBlobSha1(
  file,
) {
  const content =
    normalisedLfBuffer(
      file,
    );

  const header =
    Buffer.from(
      `blob ${content.length}\0`,
      "utf8",
    );

  return crypto
    .createHash("sha1")
    .update(header)
    .update(content)
    .digest("hex");
}

function fail(
  message,
  code = 1,
) {
  console.error("");
  console.error(
    `[RoadSafe] ${message}`,
  );
  process.exit(code);
}

function runBuild() {
  if (
    process.platform ===
    "win32"
  ) {
    return spawnSync(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "npm run build",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        windowsHide: true,
      },
    );
  }

  return spawnSync(
    "npm",
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
}

function replaceOnce(
  source,
  label,
  before,
  after,
) {
  const count =
    source
      .split(before)
      .length -
    1;

  if (
    count !==
    1
  ) {
    throw new Error(
      `${label}: expected exactly one source anchor, found ${count}.`,
    );
  }

  return source.replace(
    before,
    after,
  );
}

function patchGeometry(
  source,
) {
  let text =
    source.replace(
      /\r\n/g,
      "\n",
    );

  text = replaceOnce(
    text,
    "preserve Bezier anchors",
`        VEHICLE_ROUTE_ANCHOR_ACTIONS.has(
          point.action,
        ) ||
        Boolean(point.linkedSceneObjectId),`,
`        VEHICLE_ROUTE_ANCHOR_ACTIONS.has(
          point.action,
        ) ||
        point.pathInterpolation ===
          "Bezier" ||
        Boolean(
          point.bezierIn,
        ) ||
        Boolean(
          point.bezierOut,
        ) ||
        Boolean(point.linkedSceneObjectId),`,
  );

  text = replaceOnce(
    text,
    "manual Bezier segment flag",
`  const roadGraphControlled =
    startPoint.notes?.includes(
      AUTO_ROAD_CURVE_NOTE_MARKER,
    ) === true ||
    endPoint.notes?.includes(
      AUTO_ROAD_CURVE_NOTE_MARKER,
    ) === true;

  const maximumTurnSeverity =`,
`  const roadGraphControlled =
    startPoint.notes?.includes(
      AUTO_ROAD_CURVE_NOTE_MARKER,
    ) === true ||
    endPoint.notes?.includes(
      AUTO_ROAD_CURVE_NOTE_MARKER,
    ) === true;

  /*
   * [RoadSafe:ManualBezierSplineV1]
   *
   * The segment mode lives on the start anchor. Physics-generated segments
   * remain authoritative/linear; otherwise an investigator-controlled Bezier
   * overrides automatic straight/wobble suppression.
   */
  const manualBezierControlled =
    startPoint
      .pathInterpolation ===
    "Bezier";

  const maximumTurnSeverity =`,
  );

  text = replaceOnce(
    text,
    "manual Bezier linear override",
`  const linear =
    physicsControlled ||
    effectivelyStraight ||
    looksLikeMinorRouteNoise ||
    segmentLength < 0.001;`,
`  const linear =
    physicsControlled ||
    (
      !manualBezierControlled &&
      (
        effectivelyStraight ||
        looksLikeMinorRouteNoise
      )
    ) ||
    segmentLength < 0.001;`,
  );

  text = replaceOnce(
    text,
    "manual Bezier controls",
`  const controls =
    getSmoothSegmentControls(
      points.map(
        (point) =>
          point.position,
      ),
      segmentIndex,
      profile.curveTension,
      roadGraphControlled,
      maximumTurnSeverity,
    );`,
`  const automaticControls =
    getSmoothSegmentControls(
      points.map(
        (point) =>
          point.position,
      ),
      segmentIndex,
      profile.curveTension,
      roadGraphControlled,
      maximumTurnSeverity,
    );

  const controls =
    manualBezierControlled
      ? {
          controlOne:
            startPoint.bezierOut
              ? {
                  x:
                    clamp(
                      startPoint
                        .bezierOut
                        .x,
                      0,
                      100,
                    ),
                  y:
                    clamp(
                      startPoint
                        .bezierOut
                        .y,
                      0,
                      100,
                    ),
                }
              : automaticControls
                  .controlOne,

          controlTwo:
            endPoint.bezierIn
              ? {
                  x:
                    clamp(
                      endPoint
                        .bezierIn
                        .x,
                      0,
                      100,
                    ),
                  y:
                    clamp(
                      endPoint
                        .bezierIn
                        .y,
                      0,
                      100,
                    ),
                }
              : automaticControls
                  .controlTwo,
        }
      : automaticControls;`,
  );

  return text;
}

function patchRouteAuthoring(
  source,
) {
  let text =
    source.replace(
      /\r\n/g,
      "\n",
    );

  text = replaceOnce(
    text,
    "manual Bezier suppresses automatic route regeneration",
`  if (authored.length < 2) {
    return authored;
  }

  const pointOne = authored[0];`,
`  if (authored.length < 2) {
    return authored;
  }

  /*
   * [RoadSafe:ManualBezierRouteOwnershipV1]
   *
   * Once an investigator explicitly shapes any segment, automatic road-curve
   * generation must not replace those anchors/handles.
   */
  const hasManualBezier =
    authored.some(
      (point) =>
        point.pathInterpolation ===
          "Bezier" ||
        Boolean(
          point.bezierIn,
        ) ||
        Boolean(
          point.bezierOut,
        ),
    );

  if (
    hasManualBezier
  ) {
    learnFromInvestigatorRoadRoute(
      authored,
      participantType,
    );

    return authored;
  }

  const pointOne = authored[0];`,
  );

  text = replaceOnce(
    text,
    "Point Z Bezier handle follows collision marker",
`  const pointZPosition =
    collisionPosition ??
    pointZSource.position;

  const pointZ:
    MovementPathPoint = {
      ...pointZSource,`,
`  const pointZPosition =
    collisionPosition ??
    pointZSource.position;

  const pointZHandleDelta = {
    x:
      pointZPosition.x -
      pointZSource
        .position.x,

    y:
      pointZPosition.y -
      pointZSource
        .position.y,
  };

  const pointZ:
    MovementPathPoint = {
      ...pointZSource,`,
  );

  text = replaceOnce(
    text,
    "Point Z incoming Bezier handle translation",
`      position: {
        ...pointZPosition,
      },
      action: "Impact",`,
`      position: {
        ...pointZPosition,
      },

      bezierIn:
        pointZSource
          .bezierIn
          ? {
              x:
                clamp(
                  pointZSource
                    .bezierIn
                    .x +
                  pointZHandleDelta.x,
                  0,
                  100,
                ),

              y:
                clamp(
                  pointZSource
                    .bezierIn
                    .y +
                  pointZHandleDelta.y,
                  0,
                  100,
                ),
            }
          : undefined,

      action: "Impact",`,
  );

  return text;
}

/* -------------------------------------------------------------------------- */
/* Exact current-state preflight                                               */
/* -------------------------------------------------------------------------- */

for (
  const [
    rel,
    expectedHash,
  ]
  of Object.entries(
    EXPECTED_SHA256,
  )
) {
  const target =
    abs(rel);

  if (
    !fs.existsSync(
      target,
    )
  ) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }

  const actual =
    sha256(target);

  if (
    actual !==
    expectedHash
  ) {
    fail(
      [
        `${rel} differs from the exact Human-Vehicle Contact Sync state used for Manual Bezier Path V1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this installer. Send the fresh local file and I will rebase the Bezier pass.",
      ].join("\n"),
    );
  }
}

for (
  const [
    rel,
    expectedBlob,
  ]
  of [
    [
      GEOMETRY_REL,
      EXPECTED_GEOMETRY_BLOB_SHA1,
    ],
    [
      ROUTE_AUTHORING_REL,
      EXPECTED_ROUTE_AUTHORING_BLOB_SHA1,
    ],
  ]
) {
  const target =
    abs(rel);

  if (
    !fs.existsSync(
      target,
    )
  ) {
    fail(
      `Could not find ${rel}.`,
    );
  }

  const actualBlob =
    gitBlobSha1(
      target,
    );

  if (
    actualBlob !==
    expectedBlob
  ) {
    fail(
      [
        `${rel} differs from the exact route-engine source audited for this Bezier pass.`,
        "No files were changed.",
        "",
        `Expected Git blob SHA-1: ${expectedBlob}`,
        `Current Git blob SHA-1:  ${actualBlob}`,
        "",
        "Do not force this installer. Send the fresh local route utility if it has been edited.",
      ].join("\n"),
    );
  }
}

for (
  const payloadName
  of Object.values(
    FILES,
  )
) {
  if (
    !fs.existsSync(
      path.join(
        PAYLOAD,
        payloadName,
      ),
    )
  ) {
    fail(
      `Installer payload is missing ${payloadName}. Extract the entire ZIP first.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Prepare patched route-engine files before touching repo                     */
/* -------------------------------------------------------------------------- */

let patchedGeometry;
let patchedRouteAuthoring;

try {
  patchedGeometry =
    patchGeometry(
      fs.readFileSync(
        abs(
          GEOMETRY_REL,
        ),
        "utf8",
      ),
    );

  patchedRouteAuthoring =
    patchRouteAuthoring(
      fs.readFileSync(
        abs(
          ROUTE_AUTHORING_REL,
        ),
        "utf8",
      ),
    );
} catch (error) {
  fail(
    `Bezier route-engine patch preflight failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Backup                                                                      */
/* -------------------------------------------------------------------------- */

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `manual-bezier-participant-path-v1-${stamp}`,
  );

const allTargetRels = [
  ...Object.keys(
    FILES,
  ),
  GEOMETRY_REL,
  ROUTE_AUTHORING_REL,
];

const originals =
  new Map();

for (
  const rel
  of allTargetRels
) {
  const target =
    abs(rel);

  if (
    fs.existsSync(
      target,
    )
  ) {
    const content =
      fs.readFileSync(
        target,
      );

    originals.set(
      rel,
      content,
    );

    const backup =
      path.join(
        backupDir,
        ...rel.split("/"),
      );

    fs.mkdirSync(
      path.dirname(
        backup,
      ),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      backup,
      content,
    );
  }
}

function rollback() {
  for (
    const rel
    of allTargetRels
  ) {
    const previous =
      originals.get(
        rel,
      );

    if (
      previous
    ) {
      fs.mkdirSync(
        path.dirname(
          abs(rel),
        ),
        {
          recursive: true,
        },
      );

      fs.writeFileSync(
        abs(rel),
        previous,
      );
    } else if (
      fs.existsSync(
        abs(rel),
      )
    ) {
      fs.unlinkSync(
        abs(rel),
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Install                                                                      */
/* -------------------------------------------------------------------------- */

for (
  const [
    rel,
    payloadName,
  ]
  of Object.entries(
    FILES,
  )
) {
  fs.mkdirSync(
    path.dirname(
      abs(rel),
    ),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    path.join(
      PAYLOAD,
      payloadName,
    ),
    abs(rel),
  );
}

fs.writeFileSync(
  abs(
    GEOMETRY_REL,
  ),
  patchedGeometry,
  "utf8",
);

fs.writeFileSync(
  abs(
    ROUTE_AUTHORING_REL,
  ),
  patchedRouteAuthoring,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Manual Bezier Participant Path V1 — EXACT LOCAL",
);
console.log(
  "=========================================================",
);

console.log(
  "[OK] Exact current reconstruction/editor/physics source guards matched.",
);

console.log(
  "[OK] Existing RoadSafe automatic spline engine remains the default.",
);

console.log(
  "[OK] Manual Bezier mode added for investigator-authored participant path segments.",
);

console.log(
  "[OK] Select a route anchor and press Bezier Curve to convert that segment to a cubic investigator-controlled curve.",
);

console.log(
  "[OK] Two orange tangent handles appear directly in the 2D reconstruction scene.",
);

console.log(
  "[OK] Outgoing handle controls departure from the segment start anchor.",
);

console.log(
  "[OK] Incoming handle controls arrival at the segment end anchor, including Point Z.",
);

console.log(
  "[OK] Dragging an anchor carries its own existing Bezier handles with it.",
);

console.log(
  "[OK] Moving Point Z carries its incoming Bezier handle with the collision marker.",
);

console.log(
  "[OK] Manual Bezier anchors are protected from automatic road-route regeneration/simplification.",
);

console.log(
  "[OK] Reset Curve returns only the selected segment to RoadSafe automatic smoothing.",
);

console.log(
  "[OK] Manual handle edits invalidate the old physics bake but do not move evidence/GPS anchors.",
);

console.log(
  "[OK] Live GPS tracing/field capture remains separate and unchanged.",
);

console.log(
  "[OK] Main 2D path preview follows the explicit Bezier curve.",
);

console.log(
  "[OK] 3D and AR playback use the same Bezier controls through the canonical reconstruction geometry engine.",
);

console.log(
  "[OK] Metric arc-length handling in the existing spline engine remains active on non-square scenes.",
);

console.log(
  "[OK] Rapier samples an investigator-controlled Bezier segment using metric tangent direction at physics initialization.",
);

console.log(
  "[OK] Physics-generated post-impact trajectory still takes authority after real contact.",
);

console.log(
  "[OK] No participant visual-scale value is used for route geometry.",
);

console.log(
  `[OK] Backup: ${backupDir}`,
);

console.log("");
console.log(
  "Verifying production build...",
);

const build =
  runBuild();

const output =
  [
    build.stdout ?? "",
    build.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  build.error ||
  build.status !==
    0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed.",
  );

  if (
    output
  ) {
    console.error("");
    console.error(
      output,
    );
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Manual Bezier Participant Path V1 back automatically...",
  );

  rollback();

  console.error(
    "[RoadSafe] Rollback complete.",
  );

  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);

console.log("");
console.log(
  "Manual Bezier Participant Path V1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "Manual test: select a participant route point -> Bezier Curve -> drag both orange handles -> scrub/play 2D and 3D -> rerun physics and confirm the same curved approach is respected.",
);
