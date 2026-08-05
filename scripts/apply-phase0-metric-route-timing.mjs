import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const files = {
  motion:
    "src/utils/reconstructionMotionKinematics.ts",

  authoring:
    "src/utils/participantRouteAuthoring.ts",

  worldScale:
    "src/utils/reconstructionWorldScale.ts",

  editor:
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",

  fieldPlacement:
    "src/services/fieldPlacementService.ts",

  pointZIntegration:
    "src/utils/reconstructionPointZIntegration.ts",

  verifier:
    "scripts/verify-metric-route-timing.mjs",

  package:
    "package.json",
};

function absolute(
  relativePath,
) {
  return path.join(
    root,
    relativePath,
  );
}

function read(
  relativePath,
) {
  return fs
    .readFileSync(
      absolute(relativePath),
      "utf8",
    )
    .replace(
      /\r\n/g,
      "\n",
    );
}

function write(
  relativePath,
  content,
) {
  fs.mkdirSync(
    path.dirname(
      absolute(relativePath),
    ),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    absolute(relativePath),
    content.replace(
      /\r\n/g,
      "\n",
    ),
    "utf8",
  );
}

function replaceOnce(
  content,
  search,
  replacement,
  description,
) {
  if (!content.includes(search)) {
    throw new Error(
      `Could not patch ${description}.`,
    );
  }

  return content.replace(
    search,
    replacement,
  );
}

function functionRange(
  content,
  signature,
) {
  const start =
    content.indexOf(
      signature,
    );

  if (start < 0) {
    throw new Error(
      `Function not found: ${signature}`,
    );
  }

  const parameterStart =
    content.indexOf(
      "(",
      start,
    );

  if (parameterStart < 0) {
    throw new Error(
      `Parameter list not found: ${signature}`,
    );
  }

  let parameterDepth = 0;
  let parameterEnd = -1;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (
    let index = parameterStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "(") {
      parameterDepth += 1;
      continue;
    }

    if (character === ")") {
      parameterDepth -= 1;

      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }

  if (parameterEnd < 0) {
    throw new Error(
      `Parameter list did not close: ${signature}`,
    );
  }

  const bodyStart =
    content.indexOf(
      "{",
      parameterEnd,
    );

  if (bodyStart < 0) {
    throw new Error(
      `Function body not found: ${signature}`,
    );
  }

  let depth = 0;

  quote = null;
  escaped = false;
  lineComment = false;
  blockComment = false;

  for (
    let index = bodyStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end:
            index + 1,
        };
      }
    }
  }

  throw new Error(
    `Function did not close: ${signature}`,
  );
}

function replaceFunction(
  content,
  signature,
  replacement,
) {
  const range =
    functionRange(
      content,
      signature,
    );

  return (
    content.slice(
      0,
      range.start,
    ) +
    replacement.trimEnd() +
    content.slice(
      range.end,
    )
  );
}

function replaceInsideFunction(
  content,
  signature,
  search,
  replacement,
  description,
) {
  const range =
    functionRange(
      content,
      signature,
    );

  const section =
    content.slice(
      range.start,
      range.end,
    );

  if (!section.includes(search)) {
    throw new Error(
      `Could not patch ${description} inside ${signature}.`,
    );
  }

  const updated =
    section.replace(
      search,
      replacement,
    );

  return (
    content.slice(
      0,
      range.start,
    ) +
    updated +
    content.slice(
      range.end,
    )
  );
}

function findMatchingBrace(
  content,
  openingBrace,
) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (
    let index = openingBrace;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function inferReconstructionIdentifier(
  callText,
) {
  const durationMatch =
    callText.match(
      /durationSeconds\s*:\s*([A-Za-z_$][\w$]*)\s*\.\s*durationSeconds/,
    );

  if (durationMatch) {
    return durationMatch[1];
  }

  const collisionMatch =
    callText.match(
      /collisionPosition\s*:\s*([A-Za-z_$][\w$]*)\s*\.\s*collisionPoint/,
    );

  if (collisionMatch) {
    return collisionMatch[1];
  }

  return null;
}

function injectWorldDimensionsIntoCalls(
  content,
  functionNames,
) {
  const insertions = [];

  for (
    const functionName
    of functionNames
  ) {
    const search =
      `${functionName}({`;

    let searchIndex = 0;

    while (
      searchIndex <
      content.length
    ) {
      const callStart =
        content.indexOf(
          search,
          searchIndex,
        );

      if (callStart < 0) {
        break;
      }

      const prefix =
        content.slice(
          Math.max(
            0,
            callStart - 40,
          ),
          callStart,
        );

      if (
        /\bfunction\s*$/.test(
          prefix,
        )
      ) {
        searchIndex =
          callStart +
          search.length;

        continue;
      }

      const openingBrace =
        content.indexOf(
          "{",
          callStart,
        );

      const closingBrace =
        findMatchingBrace(
          content,
          openingBrace,
        );

      if (closingBrace < 0) {
        throw new Error(
          `Could not parse ${functionName} call.`,
        );
      }

      const callText =
        content.slice(
          callStart,
          closingBrace + 1,
        );

      if (
        !callText.includes(
          "worldDimensions",
        )
      ) {
        const identifier =
          inferReconstructionIdentifier(
            callText,
          );

        if (identifier) {
          const closingLineStart =
            content.lastIndexOf(
              "\n",
              closingBrace,
            ) + 1;

          const closingIndent =
            content
              .slice(
                closingLineStart,
                closingBrace,
              )
              .match(/^\s*/)?.[0] ??
            "";

          const propertyIndent =
            `${closingIndent}  `;

          insertions.push({
            index:
              closingLineStart,

            text:
              `${propertyIndent}worldDimensions:\n` +
              `${propertyIndent}  getReconstructionWorldDimensions(\n` +
              `${propertyIndent}    ${identifier},\n` +
              `${propertyIndent}  ),\n`,
          });
        }
      }

      searchIndex =
        closingBrace + 1;
    }
  }

  insertions
    .sort(
      (left, right) =>
        right.index -
        left.index,
    )
    .forEach(
      (insertion) => {
        content =
          content.slice(
            0,
            insertion.index,
          ) +
          insertion.text +
          content.slice(
            insertion.index,
          );
      },
    );

  return {
    content,

    insertionCount:
      insertions.length,
  };
}

function ensureWorldScaleImport(
  content,
  importPath,
) {
  if (
    content.includes(
      `from "${importPath}"`,
    )
  ) {
    return content;
  }

  return (
    `import { getReconstructionWorldDimensions } from "${importPath}";\n` +
    content
  );
}

const timestamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupRoot =
  path.join(
    root,
    ".roadsafe-patch-backups",
    `phase0-metric-route-timing-${timestamp}`,
  );

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  },
);

for (
  const relativePath
  of [
    files.motion,
    files.authoring,
    files.worldScale,
    files.editor,
    files.fieldPlacement,
    files.pointZIntegration,
    files.package,
  ]
) {
  fs.copyFileSync(
    absolute(relativePath),
    path.join(
      backupRoot,
      relativePath.replace(
        /[\\/]/g,
        "__",
      ),
    ),
  );
}

/*
 * --------------------------------------------------------------------------
 * Canonical metric timing solver
 * --------------------------------------------------------------------------
 */

let motion =
  read(
    files.motion,
  );

if (
  !motion.includes(
    "[RoadSafe:MetricRouteTimingSolverV1]",
  )
) {
  motion += `

/*
 * [RoadSafe:MetricRouteTimingSolverV1]
 *
 * Converts editor coordinates to physical metres and reconciles the complete
 * point-speed profile with the authoritative Point Z timestamp.
 *
 * A single global scale is applied to the entered point speeds. This preserves
 * their relative acceleration/deceleration profile while ensuring that:
 *
 *   metric distance = integrated displayed speed × segment time
 */
export interface MetricSceneDimensions {
  widthMetres: number;
  heightMetres: number;
}

export interface MetricRouteTimingPoint {
  position: {
    x: number;
    y: number;
  };
  speedKmh: number;
  stopped?: boolean;
}

export interface MetricRouteTimingResult {
  timesSeconds: number[];
  speedsKmh: number[];
  segmentLengthsMetres: number[];
  naturalDurationSeconds: number;
  targetDurationSeconds: number;
  speedScale: number;
  usedMetricDimensions: boolean;
}

function metricTimingRound(
  value: number,
): number {
  return Number(
    value.toFixed(4),
  );
}

function normaliseMetricSceneDimensions(
  dimensions:
    MetricSceneDimensions |
    undefined,
): {
  widthMetres: number;
  heightMetres: number;
  supplied: boolean;
} {
  const supplied =
    Boolean(
      dimensions &&
      Number.isFinite(
        dimensions.widthMetres,
      ) &&
      Number.isFinite(
        dimensions.heightMetres,
      ) &&
      dimensions.widthMetres > 0 &&
      dimensions.heightMetres > 0,
    );

  return {
    widthMetres:
      supplied
        ? Math.max(
            1,
            dimensions
              ?.widthMetres ??
              100,
          )
        : 100,

    heightMetres:
      supplied
        ? Math.max(
            1,
            dimensions
              ?.heightMetres ??
              100,
          )
        : 100,

    supplied,
  };
}

function sceneSegmentLengthMetres(
  start:
    MetricRouteTimingPoint,
  end:
    MetricRouteTimingPoint,
  dimensions: {
    widthMetres: number;
    heightMetres: number;
  },
): number {
  const horizontal =
    (
      end.position.x -
      start.position.x
    ) /
    100 *
    dimensions.widthMetres;

  const vertical =
    (
      end.position.y -
      start.position.y
    ) /
    100 *
    dimensions.heightMetres;

  return Math.hypot(
    horizontal,
    vertical,
  );
}

function timingPointSpeedKmh(
  point:
    MetricRouteTimingPoint,
  fallbackSpeedKmh: number,
): number {
  if (point.stopped) {
    return 0;
  }

  const entered =
    Number.isFinite(
      point.speedKmh,
    )
      ? Math.max(
          0,
          point.speedKmh,
        )
      : 0;

  if (entered >= 0.1) {
    return entered;
  }

  return Math.max(
    0.1,
    Number.isFinite(
      fallbackSpeedKmh,
    )
      ? fallbackSpeedKmh
      : 1,
  );
}

export function solveMetricRouteTiming(
  points:
    MetricRouteTimingPoint[],
  targetDurationSeconds: number,
  fallbackSpeedKmh: number,
  dimensions?:
    MetricSceneDimensions,
): MetricRouteTimingResult {
  const world =
    normaliseMetricSceneDimensions(
      dimensions,
    );

  const safeTarget =
    Math.max(
      0.1,
      Number.isFinite(
        targetDurationSeconds,
      )
        ? targetDurationSeconds
        : 0.1,
    );

  if (points.length === 0) {
    return {
      timesSeconds: [],
      speedsKmh: [],
      segmentLengthsMetres: [],
      naturalDurationSeconds: 0,
      targetDurationSeconds:
        metricTimingRound(
          safeTarget,
        ),
      speedScale: 1,
      usedMetricDimensions:
        world.supplied,
    };
  }

  if (points.length === 1) {
    return {
      timesSeconds: [0],
      speedsKmh: [
        metricTimingRound(
          timingPointSpeedKmh(
            points[0],
            fallbackSpeedKmh,
          ),
        ),
      ],
      segmentLengthsMetres: [],
      naturalDurationSeconds: 0,
      targetDurationSeconds:
        metricTimingRound(
          safeTarget,
        ),
      speedScale: 1,
      usedMetricDimensions:
        world.supplied,
    };
  }

  const baseSpeedsKmh =
    points.map(
      (point) =>
        timingPointSpeedKmh(
          point,
          fallbackSpeedKmh,
        ),
    );

  const segmentLengthsMetres =
    points
      .slice(
        0,
        -1,
      )
      .map(
        (point, index) =>
          sceneSegmentLengthMetres(
            point,
            points[index + 1],
            world,
          ),
      );

  const minimumMovingSpeedMps =
    0.1 / 3.6;

  const naturalSegmentDurations =
    segmentLengthsMetres.map(
      (
        lengthMetres,
        index,
      ) => {
        const averageSpeedMps =
          Math.max(
            minimumMovingSpeedMps,
            (
              baseSpeedsKmh[index] +
              baseSpeedsKmh[index + 1]
            ) /
              2 /
              3.6,
          );

        return (
          lengthMetres /
          averageSpeedMps
        );
      },
    );

  const naturalDurationSeconds =
    naturalSegmentDurations.reduce(
      (
        sum,
        duration,
      ) =>
        sum + duration,
      0,
    );

  const speedScale =
    naturalDurationSeconds >
      0.000001
      ? naturalDurationSeconds /
        safeTarget
      : 1;

  const speedsKmh =
    baseSpeedsKmh.map(
      (speedKmh) =>
        metricTimingRound(
          speedKmh *
          speedScale,
        ),
    );

  const scaledSegmentDurations =
    segmentLengthsMetres.map(
      (
        lengthMetres,
        index,
      ) => {
        const averageSpeedMps =
          Math.max(
            minimumMovingSpeedMps,
            (
              speedsKmh[index] +
              speedsKmh[index + 1]
            ) /
              2 /
              3.6,
          );

        return (
          lengthMetres /
          averageSpeedMps
        );
      },
    );

  const scaledDurationTotal =
    scaledSegmentDurations.reduce(
      (
        sum,
        duration,
      ) =>
        sum + duration,
      0,
    );

  const timesSeconds:
    number[] = [0];

  let accumulated = 0;

  for (
    let index = 0;
    index <
    scaledSegmentDurations.length;
    index += 1
  ) {
    accumulated +=
      scaledSegmentDurations[index];

    const finalPoint =
      index ===
      scaledSegmentDurations.length -
        1;

    if (finalPoint) {
      timesSeconds.push(
        metricTimingRound(
          safeTarget,
        ),
      );

      continue;
    }

    const proportionalTime =
      scaledDurationTotal >
        0.000001
        ? (
            accumulated /
            scaledDurationTotal
          ) *
          safeTarget
        : (
            (index + 1) /
            (
              points.length -
              1
            )
          ) *
          safeTarget;

    const previousTime =
      timesSeconds[
        timesSeconds.length -
        1
      ];

    const remainingPoints =
      points.length -
      (
        index + 2
      );

    const maximumTime =
      safeTarget -
      remainingPoints *
        0.0001;

    timesSeconds.push(
      metricTimingRound(
        Math.min(
          maximumTime,
          Math.max(
            previousTime +
              0.0001,
            proportionalTime,
          ),
        ),
      ),
    );
  }

  return {
    timesSeconds,

    speedsKmh,

    segmentLengthsMetres:
      segmentLengthsMetres.map(
        metricTimingRound,
      ),

    naturalDurationSeconds:
      metricTimingRound(
        naturalDurationSeconds,
      ),

    targetDurationSeconds:
      metricTimingRound(
        safeTarget,
      ),

    speedScale:
      metricTimingRound(
        speedScale,
      ),

    usedMetricDimensions:
      world.supplied,
  };
}
`;
}

write(
  files.motion,
  motion,
);

/*
 * --------------------------------------------------------------------------
 * Participant route authoring
 * --------------------------------------------------------------------------
 */

let authoring =
  read(
    files.authoring,
  );

if (
  !authoring.includes(
    'from "./reconstructionMotionKinematics"',
  )
) {
  authoring =
`import {
  solveMetricRouteTiming,
  type MetricSceneDimensions,
} from "./reconstructionMotionKinematics";
` +
    authoring;
}

authoring =
  replaceOnce(
    authoring,
`  participantType: ReconstructionVehicleType;
  createId?: (prefix: string) => string;
}`,
`  participantType: ReconstructionVehicleType;
  worldDimensions?: MetricSceneDimensions;
  createId?: (prefix: string) => string;
}`,
    "NormalisePointZRouteOptions world dimensions",
  );

authoring =
  replaceOnce(
    authoring,
`  participantType: ReconstructionVehicleType;
  createId: (prefix: string) => string;
  impactTimeSeconds?: number;
}`,
`  participantType: ReconstructionVehicleType;
  worldDimensions?: MetricSceneDimensions;
  createId: (prefix: string) => string;
  impactTimeSeconds?: number;
}`,
    "CreateLockedParticipantRouteOptions world dimensions",
  );

authoring =
  replaceOnce(
    authoring,
`export interface InsertProgressiveRoutePointOptions {
  pathPoints: MovementPathPoint[];
  selectedPointId: string | null;
  durationSeconds: number;
  createId: (prefix: string) => string;
}`,
`export interface InsertProgressiveRoutePointOptions {
  pathPoints: MovementPathPoint[];
  selectedPointId: string | null;
  durationSeconds: number;
  worldDimensions?: MetricSceneDimensions;
  createId: (prefix: string) => string;
}`,
    "InsertProgressiveRoutePointOptions world dimensions",
  );

authoring =
  replaceFunction(
    authoring,
    "function redistributeAuthoredTimes(",
`/*
 * [RoadSafe:MetricAuthoredRouteTimingV1]
 *
 * Point Z time remains authoritative so all participants can share one
 * collision instant. Point speeds are scaled together so the entered relative
 * speed profile, physical distance and authored timestamps agree.
 */
function redistributeAuthoredTimes(
  authored: MovementPathPoint[],
  durationSeconds: number,
  fallbackSpeedKmh: number,
  worldDimensions?:
    MetricSceneDimensions,
): MovementPathPoint[] {
  if (authored.length <= 1) {
    return authored;
  }

  const finalIndex =
    authored.length - 1;

  const existingImpactTime =
    authored[finalIndex]
      .timeSeconds;

  const impactTimeSeconds =
    clamp(
      Number.isFinite(
        existingImpactTime,
      )
        ? existingImpactTime
        : durationSeconds * 0.55,
      0.1,
      Math.max(
        0.1,
        durationSeconds - 0.05,
      ),
    );

  const timing =
    solveMetricRouteTiming(
      authored.map(
        (point) => ({
          position:
            point.position,

          speedKmh:
            point.speedKmh,

          stopped:
            point.action ===
            "Stop",
        }),
      ),
      impactTimeSeconds,
      fallbackSpeedKmh,
      worldDimensions,
    );

  return authored.map(
    (point, index) => ({
      ...point,

      timeSeconds:
        timing.timesSeconds[index] ??
        (
          index === finalIndex
            ? impactTimeSeconds
            : point.timeSeconds
        ),

      speedKmh:
        point.action === "Stop"
          ? 0
          : (
              timing.speedsKmh[index] ??
              point.speedKmh
            ),
    }),
  );
}`,
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function createLockedParticipantRoute(",
`  participantType,
  createId,
  impactTimeSeconds,`,
`  participantType,
  worldDimensions,
  createId,
  impactTimeSeconds,`,
    "createLockedParticipantRoute destructuring",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function createLockedParticipantRoute(",
`      durationSeconds,
    ),`,
`      durationSeconds,
      speedKmh,
      worldDimensions,
    ),`,
    "createLockedParticipantRoute metric redistribution",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function normalisePointZRoute(",
`  participantType,
  createId = defaultCreateId,`,
`  participantType,
  worldDimensions,
  createId = defaultCreateId,`,
    "normalisePointZRoute destructuring",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function normalisePointZRoute(",
`        participantType,
        createId,
      }),`,
`        participantType,
        worldDimensions,
        createId,
      }),`,
    "normalise fallback locked route dimensions",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function normalisePointZRoute(",
`        durationSeconds,
      ),`,
`        durationSeconds,
        speedKmh,
        worldDimensions,
      ),`,
    "normalisePointZRoute metric redistribution",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function createProgressiveParticipantRoute(",
`  participantType,
  createId,`,
`  participantType,
  worldDimensions,
  createId,`,
    "createProgressiveParticipantRoute destructuring",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function createProgressiveParticipantRoute(",
`  participantType: ReconstructionVehicleType;
  createId: (prefix: string) => string;`,
`  participantType: ReconstructionVehicleType;
  worldDimensions?: MetricSceneDimensions;
  createId: (prefix: string) => string;`,
    "createProgressiveParticipantRoute dimensions type",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function createProgressiveParticipantRoute(",
`    participantType,
    createId,
  });`,
`    participantType,
    worldDimensions,
    createId,
  });`,
    "createProgressiveParticipantRoute dimensions forwarding",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function insertProgressiveRoutePoint(",
`  durationSeconds,
  createId,`,
`  durationSeconds,
  worldDimensions,
  createId,`,
    "insertProgressiveRoutePoint destructuring",
  );

/*
 * [RoadSafe:MetricInsertProgressiveTimingPatchV2]
 *
 * insertProgressiveRoutePoint returns an inline object type. The generic
 * functionRange helper mistakes that return-type brace for the function body,
 * so this patch bounds the function using the following exported declaration.
 */
{
  const functionStart =
    authoring.indexOf(
      "export function insertProgressiveRoutePoint(",
    );

  if (functionStart < 0) {
    throw new Error(
      "Could not locate insertProgressiveRoutePoint.",
    );
  }

  const nextFunctionStart =
    authoring.indexOf(
      "export function removeIntermediateRoutePoint(",
      functionStart,
    );

  if (nextFunctionStart < 0) {
    throw new Error(
      "Could not locate removeIntermediateRoutePoint after insertProgressiveRoutePoint.",
    );
  }

  const section =
    authoring.slice(
      functionStart,
      nextFunctionStart,
    );

  const legacyTimingCall =
    /redistributeAuthoredTimes\(\s*relabelPointZRoute\(\s*nextAuthored\s*,\s*\)\s*,\s*durationSeconds\s*,\s*\)/m;

  const match =
    section.match(
      legacyTimingCall,
    );

  if (!match) {
    const diagnosticStart =
      section.indexOf(
        "redistributeAuthoredTimes",
      );

    const diagnostic =
      diagnosticStart >= 0
        ? section.slice(
            diagnosticStart,
            diagnosticStart + 500,
          )
        : "No redistributeAuthoredTimes text was found in the function.";

    throw new Error(
      "Could not locate insertProgressiveRoutePoint timing call.\n\n" +
      diagnostic,
    );
  }

  const metricTimingCall = [
    "redistributeAuthoredTimes(",
    "        relabelPointZRoute(",
    "          nextAuthored,",
    "        ),",
    "        durationSeconds,",
    "        authored[0]",
    "          ?.speedKmh ??",
    "          1,",
    "        worldDimensions,",
    "      )",
  ].join("\n");

  const updatedSection =
    section.replace(
      legacyTimingCall,
      metricTimingCall,
    );

  authoring =
    authoring.slice(
      0,
      functionStart,
    ) +
    updatedSection +
    authoring.slice(
      nextFunctionStart,
    );
}

authoring =
  replaceInsideFunction(
    authoring,
    "export function applySafeAuthoredPointUpdate(",
`  participantType,
  createId = defaultCreateId,`,
`  participantType,
  worldDimensions,
  createId = defaultCreateId,`,
    "applySafeAuthoredPointUpdate destructuring",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function applySafeAuthoredPointUpdate(",
`  participantType:
    ReconstructionVehicleType;
  createId?:`,
`  participantType:
    ReconstructionVehicleType;
  worldDimensions?:
    MetricSceneDimensions;
  createId?:`,
    "applySafeAuthoredPointUpdate dimensions type",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function applySafeAuthoredPointUpdate(",
`    participantType,
    createId,
  });`,
`    participantType,
    worldDimensions,
    createId,
  });`,
    "applySafeAuthoredPointUpdate dimensions forwarding",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function updatePointZPosition(",
`  participantType,
  createId = defaultCreateId,`,
`  participantType,
  worldDimensions,
  createId = defaultCreateId,`,
    "updatePointZPosition destructuring",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function updatePointZPosition(",
`    participantType,
    createId,
  });`,
`    participantType,
    worldDimensions,
    createId,
  });`,
    "updatePointZPosition dimensions forwarding",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function setParticipantImpactPoint(",
`  durationSeconds,
}: {`,
`  durationSeconds,
  worldDimensions,
}: {`,
    "setParticipantImpactPoint destructuring",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function setParticipantImpactPoint(",
`  durationSeconds: number;
}): MovementPathPoint[] {`,
`  durationSeconds: number;
  worldDimensions?:
    MetricSceneDimensions;
}): MovementPathPoint[] {`,
    "setParticipantImpactPoint dimensions type",
  );

authoring =
  replaceInsideFunction(
    authoring,
    "export function setParticipantImpactPoint(",
`        durationSeconds,
      ),`,
`        durationSeconds,
        protectedAuthored[0]
          ?.speedKmh ??
          1,
        worldDimensions,
      ),`,
    "setParticipantImpactPoint metric redistribution",
  );

const redistributionOccurrences =
  (
    authoring.match(
      /redistributeAuthoredTimes\(/g,
    ) ??
    []
  ).length;

if (
  redistributionOccurrences !==
  5
) {
  throw new Error(
    `Expected one definition and four metric calls, found ${redistributionOccurrences} occurrences.`,
  );
}

write(
  files.authoring,
  authoring,
);

/*
 * --------------------------------------------------------------------------
 * World scale input
 * --------------------------------------------------------------------------
 */

let worldScale =
  read(
    files.worldScale,
  );

worldScale =
  replaceOnce(
    worldScale,
`export function getReconstructionWorldDimensions(
  reconstruction: AccidentReconstruction,
): ReconstructionWorldDimensions {`,
`export function getReconstructionWorldDimensions(
  reconstruction: Pick<
    AccidentReconstruction,
    "scene"
  >,
): ReconstructionWorldDimensions {`,
    "world-dimension input type",
  );

write(
  files.worldScale,
  worldScale,
);

/*
 * --------------------------------------------------------------------------
 * Supply real dimensions at reconstruction-aware call sites
 * --------------------------------------------------------------------------
 */

const integratedFunctionNames = [
  "normalisePointZRoute",
  "createLockedParticipantRoute",
  "createProgressiveParticipantRoute",
  "insertProgressiveRoutePoint",
  "applySafeAuthoredPointUpdate",
  "updatePointZPosition",
  "setParticipantImpactPoint",
  "createParticipantAtConfirmedPosition",
];

let editor =
  read(
    files.editor,
  );

const editorInjection =
  injectWorldDimensionsIntoCalls(
    editor,
    integratedFunctionNames,
  );

editor =
  editorInjection.content;

if (
  editorInjection.insertionCount ===
  0
) {
  throw new Error(
    "No editor timing call sites received world dimensions.",
  );
}

editor =
  ensureWorldScaleImport(
    editor,
    "../../utils/reconstructionWorldScale",
  );

write(
  files.editor,
  editor,
);

let fieldPlacement =
  read(
    files.fieldPlacement,
  );

const fieldInjection =
  injectWorldDimensionsIntoCalls(
    fieldPlacement,
    integratedFunctionNames,
  );

fieldPlacement =
  fieldInjection.content;

if (
  fieldInjection.insertionCount ===
  0
) {
  throw new Error(
    "No field-placement timing call sites received world dimensions.",
  );
}

fieldPlacement =
  ensureWorldScaleImport(
    fieldPlacement,
    "../utils/reconstructionWorldScale",
  );

write(
  files.fieldPlacement,
  fieldPlacement,
);

let pointZIntegration =
  read(
    files.pointZIntegration,
  );

pointZIntegration =
  replaceOnce(
    pointZIntegration,
`    | "durationSeconds"
  >,`,
`    | "durationSeconds"
    | "scene"
  >,`,
    "normaliseParticipant reconstruction scene type",
  );

pointZIntegration =
  replaceOnce(
    pointZIntegration,
`  durationSeconds: number;
  createId:`,
`  durationSeconds: number;
  worldDimensions?: {
    widthMetres: number;
    heightMetres: number;
  };
  createId:`,
    "ParticipantFactoryOptions world dimensions",
  );

pointZIntegration =
  replaceInsideFunction(
    pointZIntegration,
    "export function createParticipantAtConfirmedPosition(",
`  durationSeconds,
  createId,`,
`  durationSeconds,
  worldDimensions,
  createId,`,
    "participant factory dimensions destructuring",
  );

pointZIntegration =
  replaceInsideFunction(
    pointZIntegration,
    "export function createParticipantAtConfirmedPosition(",
`      participantType: type,
      createId,
    });`,
`      participantType: type,
      worldDimensions,
      createId,
    });`,
    "participant factory dimensions forwarding",
  );

const pointZInjection =
  injectWorldDimensionsIntoCalls(
    pointZIntegration,
    integratedFunctionNames,
  );

pointZIntegration =
  pointZInjection.content;

if (
  pointZInjection.insertionCount ===
  0
) {
  throw new Error(
    "No Point Z integration call sites received world dimensions.",
  );
}

pointZIntegration =
  ensureWorldScaleImport(
    pointZIntegration,
    "./reconstructionWorldScale",
  );

write(
  files.pointZIntegration,
  pointZIntegration,
);

/*
 * --------------------------------------------------------------------------
 * Verification script
 * --------------------------------------------------------------------------
 */

const verifierSource = `import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath =
  "src/utils/reconstructionMotionKinematics.ts";

const source =
  fs.readFileSync(
    sourcePath,
    "utf8",
  );

const transpiled =
  ts.transpileModule(
    source,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2022,

        module:
          ts.ModuleKind.ES2022,

        moduleResolution:
          ts.ModuleResolutionKind.Bundler,
      },

      fileName:
        sourcePath,

      reportDiagnostics:
        true,
    },
  );

const errors =
  (
    transpiled.diagnostics ??
    []
  ).filter(
    (diagnostic) =>
      diagnostic.category ===
      ts.DiagnosticCategory.Error,
  );

if (
  errors.length > 0
) {
  throw new Error(
    errors
      .map(
        (error) =>
          ts.flattenDiagnosticMessageText(
            error.messageText,
            "\\n",
          ),
      )
      .join("\\n"),
  );
}

const temporaryPath =
  path.join(
    os.tmpdir(),
    \`roadsafe-metric-route-timing-\${process.pid}-\${Date.now()}.mjs\`,
  );

fs.writeFileSync(
  temporaryPath,
  transpiled.outputText,
  "utf8",
);

const motion =
  await import(
    pathToFileURL(
      temporaryPath,
    ).href +
      \`?v=\${Date.now()}\`
  );

try {
  const horizontal =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 0,
            y: 50,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      5,
      36,
      {
        widthMetres: 100,
        heightMetres: 40,
      },
    );

  assert.equal(
    horizontal.segmentLengthsMetres[0],
    50,
    "Horizontal editor distance was not converted to metres.",
  );

  assert.equal(
    horizontal.speedScale,
    1,
    "A physically consistent 50 m / 5 s / 36 km/h route was rescaled.",
  );

  assert.deepEqual(
    horizontal.timesSeconds,
    [
      0,
      5,
    ],
    "Simple metric route timestamps are incorrect.",
  );

  const vertical =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 50,
            y: 0,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      10,
      36,
      {
        widthMetres: 40,
        heightMetres: 200,
      },
    );

  assert.equal(
    vertical.segmentLengthsMetres[0],
    100,
    "Vertical distance did not use scene height.",
  );

  assert.equal(
    vertical.speedScale,
    1,
    "A physically consistent vertical route was rescaled.",
  );

  const shorterVertical =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 50,
            y: 0,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      10,
      36,
      {
        widthMetres: 40,
        heightMetres: 100,
      },
    );

  assert.equal(
    shorterVertical.segmentLengthsMetres[0],
    50,
    "The second scene height was ignored.",
  );

  assert.equal(
    shorterVertical.speedScale,
    0.5,
    "Speeds were not reconciled with the authoritative impact time.",
  );

  assert.deepEqual(
    shorterVertical.speedsKmh,
    [
      18,
      18,
    ],
    "The complete speed profile was not scaled consistently.",
  );

  const multiSegment =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 0,
            y: 50,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 100,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      10,
      36,
      {
        widthMetres: 100,
        heightMetres: 100,
      },
    );

  assert.deepEqual(
    multiSegment.timesSeconds,
    [
      0,
      5,
      10,
    ],
    "Cumulative metric timestamps are incorrect.",
  );

  assert.equal(
    multiSegment.usedMetricDimensions,
    true,
    "Explicit real-world dimensions were not recorded.",
  );

  const authoring =
    fs.readFileSync(
      "src/utils/participantRouteAuthoring.ts",
      "utf8",
    );

  assert.equal(
    authoring.includes(
      "MetricAuthoredRouteTimingV1",
    ),
    true,
    "Metric timing is not connected to route authoring.",
  );

  assert.equal(
    authoring.includes(
      "solveMetricRouteTiming(",
    ),
    true,
    "Route authoring does not invoke the canonical timing solver.",
  );

  assert.equal(
    authoring.includes(
      "worldDimensions?: MetricSceneDimensions",
    ),
    true,
    "Route-authoring options do not accept metric dimensions.",
  );

  const integrationFiles = [
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    "src/services/fieldPlacementService.ts",
    "src/utils/reconstructionPointZIntegration.ts",
  ];

  for (
    const filePath
    of integrationFiles
  ) {
    const content =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    assert.equal(
      content.includes(
        "getReconstructionWorldDimensions(",
      ),
      true,
      \`\${filePath} does not supply real scene dimensions.\`,
    );
  }

  console.log(
    "✓ Horizontal scene distance converted to metres",
  );

  console.log(
    "✓ Vertical scene distance uses physical scene height",
  );

  console.log(
    "✓ Point Z timestamp remains authoritative",
  );

  console.log(
    "✓ Complete speed profile scales consistently",
  );

  console.log(
    "✓ Multi-segment timestamps accumulate in metres",
  );

  console.log(
    "✓ Editor, field placement and Point Z integration supply dimensions",
  );

  console.log(
    "\\nPhase 0 metric route-timing verification passed.",
  );
}
finally {
  fs.rmSync(
    temporaryPath,
    {
      force: true,
    },
  );
}
`;

write(
  files.verifier,
  verifierSource,
);

const packageJson =
  JSON.parse(
    read(
      files.package,
    ),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "timing:verify"
] =
  "node scripts/verify-metric-route-timing.mjs && tsc -p tsconfig.phase0.json";

write(
  files.package,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) + "\n",
);

console.log(
  "\nPhase 0 Step 3B1 metric route timing applied.",
);

console.log(
  "Backup:",
  backupRoot,
);

console.log(
  "\nIntegration insertions:",
);

console.log(
  `Editor: ${editorInjection.insertionCount}`,
);

console.log(
  `Field placement: ${fieldInjection.insertionCount}`,
);

console.log(
  `Point Z integration: ${pointZInjection.insertionCount}`,
);
