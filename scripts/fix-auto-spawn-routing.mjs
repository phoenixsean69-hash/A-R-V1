import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const relativePath =
  "src/utils/reconstructionRoadRouting.ts";

const absolutePath =
  path.join(
    projectRoot,
    relativePath,
  );

if (!fs.existsSync(absolutePath)) {
  throw new Error(
    `Missing required file: ${relativePath}`,
  );
}

const original =
  fs.readFileSync(
    absolutePath,
    "utf8",
  );

let updated = original;

const patchMarker =
  "[RoadSafe:SpawnRouteDirectionGuardV1]";

if (updated.includes(patchMarker)) {
  console.log(
    "Spawn-route direction guard is already installed.",
  );

  process.exit(0);
}

function insertBefore(
  content,
  marker,
  insertion,
  label,
) {
  const index =
    content.indexOf(marker);

  if (index < 0) {
    throw new Error(
      `Could not find ${label}: ${marker}`,
    );
  }

  return (
    content.slice(0, index) +
    insertion +
    content.slice(index)
  );
}

const directionHelpers = `
/*
 * ${patchMarker}
 *
 * Prevent generated participant routes from beginning in the opposite
 * direction from Point Z.
 */
function routePointAtDistance(
  points: Point2[],
  targetDistanceMetres: number,
): Point2 {
  if (points.length === 0) {
    return {
      x: 0,
      y: 0,
    };
  }

  if (points.length === 1) {
    return {
      ...points[0],
    };
  }

  let travelled = 0;

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const previous =
      points[index - 1];

    const current =
      points[index];

    const segmentLength =
      distance(
        previous,
        current,
      );

    if (
      travelled +
        segmentLength >=
      targetDistanceMetres
    ) {
      const progress =
        segmentLength <
        0.000001
          ? 0
          : clamp(
              (
                targetDistanceMetres -
                travelled
              ) /
                segmentLength,
              0,
              1,
            );

      return {
        x:
          previous.x +
          (
            current.x -
            previous.x
          ) *
            progress,
        y:
          previous.y +
          (
            current.y -
            previous.y
          ) *
            progress,
      };
    }

    travelled +=
      segmentLength;
  }

  return {
    ...points[
      points.length - 1
    ],
  };
}

function routeStartsByMovingAwayFromImpact(
  points: Point2[],
  impactPoint: Point2,
): boolean {
  if (points.length < 2) {
    return false;
  }

  const start =
    points[0];

  const initialDistance =
    distance(
      start,
      impactPoint,
    );

  const lookAheadDistance =
    clamp(
      polylineLength(points) *
        0.12,
      4,
      8,
    );

  const lookAhead =
    routePointAtDistance(
      points,
      lookAheadDistance,
    );

  const lookAheadImpactDistance =
    distance(
      lookAhead,
      impactPoint,
    );

  /*
   * A tiny lateral movement is acceptable. Moving more than 0.75 metres
   * farther from Point Z during the initial route is not.
   */
  return (
    lookAheadImpactDistance >
    initialDistance + 0.75
  );
}

function removeInitialSpawnBacktracking(
  points: Point2[],
  impactPoint: Point2,
): Point2[] {
  if (points.length <= 2) {
    return points;
  }

  const start =
    points[0];

  const stableLookAheadIndex =
    points.findIndex(
      (
        point,
        index,
      ) =>
        index > 0 &&
        distance(
          start,
          point,
        ) >= 5,
    );

  const anchorIndex =
    stableLookAheadIndex >= 1
      ? stableLookAheadIndex
      : Math.min(
          points.length - 1,
          2,
        );

  const anchor =
    points[anchorIndex];

  const forwardDirection =
    normalise(
      subtract(
        anchor,
        start,
      ),
      subtract(
        impactPoint,
        start,
      ),
    );

  const cleaned: Point2[] = [
    {
      ...start,
    },
  ];

  let greatestForwardProgress = 0;

  for (
    let index = 1;
    index <= anchorIndex;
    index += 1
  ) {
    const point =
      points[index];

    const offset =
      subtract(
        point,
        start,
      );

    const forwardProgress =
      dot(
        offset,
        forwardDirection,
      );

    const currentImpactDistance =
      distance(
        point,
        impactPoint,
      );

    const previousImpactDistance =
      distance(
        cleaned[
          cleaned.length - 1
        ],
        impactPoint,
      );

    const travellingBackward =
      forwardProgress <
        greatestForwardProgress -
          0.3 ||
      currentImpactDistance >
        previousImpactDistance +
          0.75;

    if (travellingBackward) {
      continue;
    }

    if (
      distance(
        cleaned[
          cleaned.length - 1
        ],
        point,
      ) < 0.3
    ) {
      continue;
    }

    greatestForwardProgress =
      Math.max(
        greatestForwardProgress,
        forwardProgress,
      );

    cleaned.push({
      ...point,
    });
  }

  for (
    let index =
      anchorIndex + 1;
    index < points.length;
    index += 1
  ) {
    const point =
      points[index];

    if (
      distance(
        cleaned[
          cleaned.length - 1
        ],
        point,
      ) >= 0.3
    ) {
      cleaned.push({
        ...point,
      });
    }
  }

  if (cleaned.length < 2) {
    return [
      {
        ...start,
      },
      {
        ...impactPoint,
      },
    ];
  }

  return cleaned;
}

`;

updated =
  insertBefore(
    updated,
    "function evaluateRoute(",
    directionHelpers,
    "evaluateRoute()",
  );

/*
 * Reject bad road candidates during route evaluation.
 */
const evaluationStart =
  updated.indexOf(
    "function evaluateRoute(",
  );

if (evaluationStart < 0) {
  throw new Error(
    "Could not locate evaluateRoute().",
  );
}

const evaluationEnd =
  updated.indexOf(
    "function buildRankedCandidates(",
    evaluationStart,
  );

if (evaluationEnd < 0) {
  throw new Error(
    "Could not locate the end of evaluateRoute().",
  );
}

let evaluationFunction =
  updated.slice(
    evaluationStart,
    evaluationEnd,
  );

const evaluationMarker = `  sampled[
    sampled.length - 1
  ] = {
    ...impactLocal,
  };
`;

const compactEvaluationMarker =
  "  sampled[sampled.length - 1] = { ...impactLocal };";

let insertionPosition = -1;
let insertionMarker = "";

if (
  evaluationFunction.includes(
    evaluationMarker,
  )
) {
  insertionMarker =
    evaluationMarker;
} else if (
  evaluationFunction.includes(
    compactEvaluationMarker,
  )
) {
  insertionMarker =
    compactEvaluationMarker;
} else {
  throw new Error(
    "Could not find the evaluated route endpoint assignment.",
  );
}

const candidateGuard = `${insertionMarker}

  if (
    routeStartsByMovingAwayFromImpact(
      sampled,
      impactLocal,
    )
  ) {
    return null;
  }
`;

evaluationFunction =
  evaluationFunction.replace(
    insertionMarker,
    candidateGuard,
  );

updated =
  updated.slice(
    0,
    evaluationStart,
  ) +
  evaluationFunction +
  updated.slice(
    evaluationEnd,
  );

/*
 * Clean any remaining backwards spawn samples after the lane-preserving route
 * is produced.
 */
const routeFunctionMarker =
  "export function createRoadAlignedParticipantRoute({";

const routeFunctionStart =
  updated.indexOf(
    routeFunctionMarker,
  );

if (routeFunctionStart < 0) {
  throw new Error(
    "Could not locate createRoadAlignedParticipantRoute().",
  );
}

const routeFunctionEnd =
  updated.indexOf(
    "export function createRoadAlignedIntermediatePoints",
    routeFunctionStart,
  );

if (routeFunctionEnd < 0) {
  throw new Error(
    "Could not locate the end of createRoadAlignedParticipantRoute().",
  );
}

let routeFunction =
  updated.slice(
    routeFunctionStart,
    routeFunctionEnd,
  );

if (
  routeFunction.includes(
    "const routePoints =",
  )
) {
  routeFunction =
    routeFunction.replace(
      "const routePoints =",
      "let routePoints =",
    );
}

if (
  !routeFunction.includes(
    "let routePoints =",
  )
) {
  throw new Error(
    "routePoints is not mutable.",
  );
}

const cumulativeMarker =
  "  const cumulative: number[] = [0];";

const cumulativeIndex =
  routeFunction.indexOf(
    cumulativeMarker,
  );

if (cumulativeIndex < 0) {
  throw new Error(
    "Could not locate route cumulative-distance calculation.",
  );
}

const spawnCleanup = `  routePoints =
    removeInitialSpawnBacktracking(
      routePoints,
      sceneToLocalMetres(
        impactPoint.position,
        geometry,
      ),
    );

`;

routeFunction =
  routeFunction.slice(
    0,
    cumulativeIndex,
  ) +
  spawnCleanup +
  routeFunction.slice(
    cumulativeIndex,
  );

updated =
  updated.slice(
    0,
    routeFunctionStart,
  ) +
  routeFunction +
  updated.slice(
    routeFunctionEnd,
  );

/*
 * Back up and write.
 */
const timestamp =
  new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

const backupPath =
  path.join(
    projectRoot,
    ".roadsafe-patch-backups",
    `spawn-route-${timestamp}`,
    relativePath,
  );

fs.mkdirSync(
  path.dirname(backupPath),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  backupPath,
  original,
  "utf8",
);

fs.writeFileSync(
  absolutePath,
  updated,
  "utf8",
);

/*
 * Verification.
 */
const verification =
  fs.readFileSync(
    absolutePath,
    "utf8",
  );

const requiredMarkers = [
  patchMarker,
  "routeStartsByMovingAwayFromImpact(",
  "removeInitialSpawnBacktracking(",
  "routePoints =\n    removeInitialSpawnBacktracking(",
];

for (
  const marker
  of requiredMarkers
) {
  if (
    !verification.includes(marker)
  ) {
    throw new Error(
      `Verification failed: ${marker}`,
    );
  }
}

console.log("");
console.log(
  "Auto-spawn route direction fix applied.",
);

console.log(
  `Backup: ${path.relative(
    projectRoot,
    backupPath,
  )}`,
);