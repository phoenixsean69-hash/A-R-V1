import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return {
    absolutePath,
    relativePath,
    content: fs.readFileSync(absolutePath, "utf8"),
  };
}

function write(file) {
  fs.writeFileSync(file.absolutePath, file.content, "utf8");
  console.log(`Updated ${file.relativePath}`);
}

function replaceOnce(content, search, replacement, label) {
  const next = content.replace(search, replacement);

  if (next === content) {
    throw new Error(
      `Could not apply "${label}". The repository file may have changed.`,
    );
  }

  return next;
}

function insertBeforeOnce(content, marker, insertion, label) {
  if (content.includes(insertion.trim())) {
    return content;
  }

  const index = content.indexOf(marker);

  if (index < 0) {
    throw new Error(
      `Could not apply "${label}". Marker not found: ${marker}`,
    );
  }

  return `${content.slice(0, index)}${insertion}${content.slice(index)}`;
}

function patchReconstructionGeometry() {
  const file = read("src/utils/reconstructionGeometry.ts");

  const stabilisationHelpers = `
const VEHICLE_ROUTE_ANCHOR_ACTIONS = new Set<MovementAction>([
  "Start",
  "Enter Scene",
  "Brake",
  "Turn Left",
  "Turn Right",
  "Swerve",
  "Impact",
  "Ricochet",
  "Deflect",
  "Slide",
  "Fall",
  "Stop",
  "Exit Scene",
]);

function distanceFromPositionToSegment(
  position: ReconstructionPosition,
  start: ReconstructionPosition,
  end: ReconstructionPosition,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared =
    segmentX * segmentX +
    segmentY * segmentY;

  if (segmentLengthSquared < 0.000001) {
    return distanceBetween(position, start);
  }

  const projection = clamp(
    (
      (position.x - start.x) * segmentX +
      (position.y - start.y) * segmentY
    ) / segmentLengthSquared,
    0,
    1,
  );

  return Math.hypot(
    position.x -
      (start.x + segmentX * projection),
    position.y -
      (start.y + segmentY * projection),
  );
}

function simplifyMovementPathSection(
  points: MovementPathPoint[],
  tolerance: number,
): MovementPathPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];

  let furthestIndex = -1;
  let furthestDistance = 0;

  for (
    let index = 1;
    index < points.length - 1;
    index += 1
  ) {
    const distance =
      distanceFromPositionToSegment(
        points[index].position,
        first.position,
        last.position,
      );

    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }

  if (
    furthestIndex < 0 ||
    furthestDistance <= tolerance
  ) {
    return [first, last];
  }

  const left = simplifyMovementPathSection(
    points.slice(0, furthestIndex + 1),
    tolerance,
  );

  const right = simplifyMovementPathSection(
    points.slice(furthestIndex),
    tolerance,
  );

  return [
    ...left.slice(0, -1),
    ...right,
  ];
}

function vehicleRouteStabilisationTolerance(
  participant: ReconstructionVehicle,
): number {
  switch (participant.type) {
    case "Bus":
    case "Truck":
      return 0.75;

    case "Motorcycle":
    case "Bicycle":
      return 0.45;

    case "Car":
    default:
      return 0.6;
  }
}

function stabiliseAuthoredVehiclePlaybackPath(
  participant: ReconstructionVehicle,
  points: MovementPathPoint[],
): MovementPathPoint[] {
  if (
    HUMAN_TYPES.has(participant.type) ||
    points.length < 3 ||
    points.some(
      (point) =>
        point.notes?.includes(
          AUTO_ROAD_CURVE_NOTE_MARKER,
        ) === true,
    )
  ) {
    return points;
  }

  const anchorIndices = points
    .map((point, index) => ({
      point,
      index,
    }))
    .filter(
      ({ point, index }) =>
        index === 0 ||
        index === points.length - 1 ||
        VEHICLE_ROUTE_ANCHOR_ACTIONS.has(
          point.action,
        ) ||
        Boolean(point.linkedSceneObjectId),
    )
    .map(({ index }) => index);

  const uniqueAnchorIndices = [
    ...new Set(anchorIndices),
  ].sort((left, right) => left - right);

  const tolerance =
    vehicleRouteStabilisationTolerance(
      participant,
    );

  const stabilised: MovementPathPoint[] = [];

  for (
    let anchorIndex = 0;
    anchorIndex <
    uniqueAnchorIndices.length - 1;
    anchorIndex += 1
  ) {
    const startIndex =
      uniqueAnchorIndices[anchorIndex];

    const endIndex =
      uniqueAnchorIndices[anchorIndex + 1];

    const section =
      simplifyMovementPathSection(
        points.slice(
          startIndex,
          endIndex + 1,
        ),
        tolerance,
      );

    stabilised.push(
      ...(anchorIndex === 0
        ? section
        : section.slice(1)),
    );
  }

  return stabilised.length >= 2
    ? stabilised
    : points;
}

`;

  file.content = insertBeforeOnce(
    file.content,
    "export function getParticipantPlaybackPathPoints(",
    stabilisationHelpers,
    "vehicle path stabilisation helpers",
  );

  const playbackFunction = `export function getParticipantPlaybackPathPoints(
  participant: ReconstructionVehicle,
): MovementPathPoint[] {
  const cached = participantPlaybackPathCache.get(
    participant.pathPoints,
  );
  if (cached) return cached;

  const points = sanitiseParticipantPathPoints(
    participant.pathPoints,
  );

  const firstPhysicsPoint = points.find(
    isPhysicsGeneratedPathPoint,
  );

  const stabilisedAuthoredPoints =
    stabiliseAuthoredVehiclePlaybackPath(
      participant,
      points.filter(
        (point) =>
          !isPhysicsGeneratedPathPoint(point),
      ),
    );

  if (!firstPhysicsPoint) {
    const result =
      stabilisedAuthoredPoints.length >= 2
        ? stabilisedAuthoredPoints
        : points;

    participantPlaybackPathCache.set(
      participant.pathPoints,
      result,
    );

    return result;
  }

  const authoredBeforePhysics =
    stabilisedAuthoredPoints.filter(
      (point) =>
        point.timeSeconds <
        firstPhysicsPoint.timeSeconds -
          0.0001,
    );

  const physicsPath = points.filter(
    (point) =>
      isPhysicsGeneratedPathPoint(point) &&
      point.timeSeconds >=
        firstPhysicsPoint.timeSeconds -
          0.0001,
  );

  const playback = sortMovementPathPoints([
    ...authoredBeforePhysics,
    ...physicsPath,
  ]);

  const result =
    playback.length >= 2
      ? playback
      : points;

  participantPlaybackPathCache.set(
    participant.pathPoints,
    result,
  );

  return result;
}

`;

  if (!file.content.includes("stabilisedAuthoredPoints")) {
    file.content = replaceOnce(
      file.content,
      /export function getParticipantPlaybackPathPoints\([\s\S]*?\n}\n\nexport function getParticipantRestPoint\(/,
      `${playbackFunction}export function getParticipantRestPoint(`,
      "stabilised playback path",
    );
  }

  const oldLinearDecision = /  const effectivelyStraight =\s*\n    maximumTurnSeverity <=\s*\n    profile\.straightAngleTolerance;\s*\n\s*  const linear =\s*\n    physicsControlled \|\|\s*\n    effectivelyStraight \|\|\s*\n    segmentLength < 0\.001;/;

  const newLinearDecision = `  const effectivelyStraight =
    maximumTurnSeverity <=
    profile.straightAngleTolerance;

  const deliberateCurveAction = [
    startPoint.action,
    endPoint.action,
  ].some(
    (action) =>
      action === "Turn Left" ||
      action === "Turn Right" ||
      action === "Swerve",
  );

  /*
   * Pointer-drawn routes contain tiny direction changes even when the
   * investigator intended a straight approach. Treat those small changes as
   * route noise instead of turning every segment into a Bézier curve.
   */
  const routeWobbleTolerance =
    HUMAN_TYPES.has(participant.type)
      ? 9
      : 12;

  const looksLikeMinorRouteNoise =
    !roadGraphControlled &&
    !deliberateCurveAction &&
    maximumTurnSeverity <=
      routeWobbleTolerance;

  const linear =
    physicsControlled ||
    effectivelyStraight ||
    looksLikeMinorRouteNoise ||
    segmentLength < 0.001;`;

  if (!file.content.includes("looksLikeMinorRouteNoise")) {
    file.content = replaceOnce(
      file.content,
      oldLinearDecision,
      newLinearDecision,
      "minor route-wobble suppression",
    );
  }

  write(file);
}

function patchRouteDrawing() {
  const file = read(
    "src/utils/reconstructionPointZIntegration.ts",
  );

  const replacement = `function removeNearDuplicateDrawnPoints(
  routePoints: ReconstructionPosition[],
  minimumDistance = 0.18,
): ReconstructionPosition[] {
  const result: ReconstructionPosition[] = [];

  for (const point of routePoints) {
    const previous = result[result.length - 1];

    if (
      !previous ||
      routePointDistance(previous, point) >=
        minimumDistance
    ) {
      result.push(point);
    }
  }

  const final =
    routePoints[routePoints.length - 1];

  if (
    final &&
    result[result.length - 1] !== final
  ) {
    result.push(final);
  }

  return result;
}

function smoothDrawnRoute(
  routePoints: ReconstructionPosition[],
  passes = 2,
): ReconstructionPosition[] {
  let current = routePoints.map(
    (point) => ({ ...point }),
  );

  for (
    let pass = 0;
    pass < passes;
    pass += 1
  ) {
    current = current.map(
      (point, index, points) => {
        if (
          index === 0 ||
          index === points.length - 1
        ) {
          return point;
        }

        const previous = points[index - 1];
        const next = points[index + 1];

        return {
          x:
            previous.x * 0.25 +
            point.x * 0.5 +
            next.x * 0.25,
          y:
            previous.y * 0.25 +
            point.y * 0.5 +
            next.y * 0.25,
        };
      },
    );
  }

  return current;
}

function drawnPointDistanceToSegment(
  point: ReconstructionPosition,
  start: ReconstructionPosition,
  end: ReconstructionPosition,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared =
    segmentX * segmentX +
    segmentY * segmentY;

  if (lengthSquared < 0.000001) {
    return routePointDistance(point, start);
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      (
        (point.x - start.x) * segmentX +
        (point.y - start.y) * segmentY
      ) / lengthSquared,
    ),
  );

  return Math.hypot(
    point.x -
      (start.x + segmentX * projection),
    point.y -
      (start.y + segmentY * projection),
  );
}

function simplifyDrawnRoute(
  routePoints: ReconstructionPosition[],
  tolerance: number,
): ReconstructionPosition[] {
  if (routePoints.length <= 2) {
    return routePoints;
  }

  const first = routePoints[0];
  const last =
    routePoints[routePoints.length - 1];

  let furthestIndex = -1;
  let furthestDistance = 0;

  for (
    let index = 1;
    index < routePoints.length - 1;
    index += 1
  ) {
    const distance =
      drawnPointDistanceToSegment(
        routePoints[index],
        first,
        last,
      );

    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }

  if (
    furthestIndex < 0 ||
    furthestDistance <= tolerance
  ) {
    return [first, last];
  }

  const left = simplifyDrawnRoute(
    routePoints.slice(
      0,
      furthestIndex + 1,
    ),
    tolerance,
  );

  const right = simplifyDrawnRoute(
    routePoints.slice(furthestIndex),
    tolerance,
  );

  return [
    ...left.slice(0, -1),
    ...right,
  ];
}

function resampleDrawnRouteByDistance(
  routePoints: ReconstructionPosition[],
  maximumPoints: number,
): ReconstructionPosition[] {
  if (
    routePoints.length <= maximumPoints ||
    maximumPoints <= 2
  ) {
    return routePoints;
  }

  const cumulativeDistances = [0];

  for (
    let index = 1;
    index < routePoints.length;
    index += 1
  ) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] +
        routePointDistance(
          routePoints[index - 1],
          routePoints[index],
        ),
    );
  }

  const totalDistance =
    cumulativeDistances[
      cumulativeDistances.length - 1
    ];

  if (totalDistance < 0.000001) {
    return [
      routePoints[0],
      routePoints[routePoints.length - 1],
    ];
  }

  return Array.from(
    { length: maximumPoints },
    (_, sampleIndex) => {
      if (sampleIndex === 0) {
        return routePoints[0];
      }

      if (
        sampleIndex ===
        maximumPoints - 1
      ) {
        return routePoints[
          routePoints.length - 1
        ];
      }

      const targetDistance =
        totalDistance *
        (
          sampleIndex /
          (maximumPoints - 1)
        );

      let segmentIndex = 1;

      while (
        segmentIndex <
          cumulativeDistances.length - 1 &&
        cumulativeDistances[segmentIndex] <
          targetDistance
      ) {
        segmentIndex += 1;
      }

      const previousDistance =
        cumulativeDistances[
          segmentIndex - 1
        ];

      const nextDistance =
        cumulativeDistances[segmentIndex];

      const segmentProgress =
        nextDistance -
          previousDistance <
        0.000001
          ? 0
          : (
              targetDistance -
              previousDistance
            ) /
            (
              nextDistance -
              previousDistance
            );

      const previous =
        routePoints[segmentIndex - 1];

      const next =
        routePoints[segmentIndex];

      return {
        x:
          previous.x +
          (next.x - previous.x) *
            segmentProgress,
        y:
          previous.y +
          (next.y - previous.y) *
            segmentProgress,
      };
    },
  );
}

function sampleDrawnRoute(
  routePoints: ReconstructionPosition[],
  maximumIntermediatePoints = 16,
): ReconstructionPosition[] {
  if (routePoints.length <= 2) {
    return routePoints;
  }

  const cleaned =
    removeNearDuplicateDrawnPoints(
      routePoints,
    );

  if (cleaned.length <= 2) {
    return cleaned;
  }

  const smoothed =
    smoothDrawnRoute(cleaned);

  const simplified =
    simplifyDrawnRoute(
      smoothed,
      0.45,
    );

  const sampled =
    resampleDrawnRouteByDistance(
      simplified,
      Math.max(
        3,
        maximumIntermediatePoints,
      ),
    );

  /*
   * Keep the exact pointer-down and pointer-up locations. Only the noisy
   * interior trace is smoothed and simplified.
   */
  sampled[0] = routePoints[0];

  sampled[sampled.length - 1] =
    routePoints[
      routePoints.length - 1
    ];

  return sampled;
}

`;

  if (!file.content.includes("smoothDrawnRoute(")) {
    file.content = replaceOnce(
      file.content,
      /function sampleDrawnRoute\([\s\S]*?\n}\n\nfunction routePointDistance\(/,
      `${replacement}function routePointDistance(`,
      "drawn-route cleanup",
    );
  }

  write(file);
}

function addGeometryImport(content) {
  if (
    content.includes(
      "getParticipantPlaybackPathPoints,",
    )
  ) {
    return content;
  }

  return replaceOnce(
    content,
    /(\s+getParticipantStateAtTime,\s*\n)/,
    `  getParticipantPlaybackPathPoints,\n$1`,
    "playback path import",
  );
}

function removeUnusedSortImport(content) {
  const occurrences =
    content.match(
      /\bsortMovementPathPoints\b/g,
    )?.length ?? 0;

  if (occurrences === 1) {
    return content.replace(
      /\s+sortMovementPathPoints,\s*\n/,
      "",
    );
  }

  return content;
}

function patchEditorPathRendering() {
  const file = read(
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  );

  file.content = addGeometryImport(file.content);

  const replacement = `function getParticipantPathGeometry(
  participant: ReconstructionVehicle,
) {
  const cacheKey = participant.pathPoints;
  const cached =
    participantPathGeometryCache.get(
      cacheKey,
    );

  if (cached) return cached;

  const authoredPathPoints =
    getParticipantPlaybackPathPoints(
      participant,
    ).filter(
      (point) =>
        !isPhysicsGeneratedPathPoint(point),
    );

  const path = buildSmoothSvgPath(
    authoredPathPoints.map(
      (point) => point.position,
    ),
    isHumanParticipant(participant.type)
      ? 0.82
      : 0.58,
  );

  const skidPoints =
    authoredPathPoints.filter(
      (point, index) =>
        point.action === "Brake" ||
        (
          index > 0 &&
          authoredPathPoints[index - 1]
            .action === "Brake"
        ),
    );

  const geometry = {
    path,
    skidPath:
      skidPoints.length > 1
        ? buildSmoothSvgPath(
            skidPoints.map(
              (point) => point.position,
            ),
            0.55,
          )
        : "",
  };

  participantPathGeometryCache.set(
    cacheKey,
    geometry,
  );

  return geometry;
}

`;

  if (
    !file.content.includes(
      "function getParticipantPathGeometry(\n  participant:",
    )
  ) {
    file.content = replaceOnce(
      file.content,
      /function getParticipantPathGeometry\([\s\S]*?\n}\n\nfunction getVisibleParticipantControlPoints\(/,
      `${replacement}function getVisibleParticipantControlPoints(`,
      "2D stabilised path rendering",
    );
  }

  file.content = file.content.replace(
    /getParticipantPathGeometry\(participant\.pathPoints\)/g,
    "getParticipantPathGeometry(participant)",
  );

  write(file);
}

function patchThreeDimensionalPath(
  relativePath,
) {
  const file = read(relativePath);

  file.content = addGeometryImport(file.content);

  file.content = file.content.replace(
    /const authoredPoints = sortMovementPathPoints\(participant\.pathPoints\)\.filter\(\s*\n\s*\(point\) => !isPhysicsGeneratedPathPoint\(point\),\s*\n\s*\);/,
    `const authoredPoints =
          getParticipantPlaybackPathPoints(
            participant,
          ).filter(
            (point) =>
              !isPhysicsGeneratedPathPoint(
                point,
              ),
          );`,
  );

  file.content = file.content.replace(
    /const authoredPoints =\s*\n\s*sortMovementPathPoints\(\s*\n\s*participant\.pathPoints,\s*\n\s*\)\.filter\(\s*\n\s*\(point\) =>\s*\n\s*!isPhysicsGeneratedPathPoint\(\s*\n\s*point,\s*\n\s*\),\s*\n\s*\);/,
    `const authoredPoints =
      getParticipantPlaybackPathPoints(
        participant,
      ).filter(
        (point) =>
          !isPhysicsGeneratedPathPoint(
            point,
          ),
      );`,
  );

  if (
    !file.content.includes(
      "getParticipantPlaybackPathPoints(\n",
    )
  ) {
    throw new Error(
      `Could not patch path rendering in ${relativePath}.`,
    );
  }

  file.content =
    removeUnusedSortImport(file.content);

  write(file);
}

try {
  patchReconstructionGeometry();
  patchRouteDrawing();
  patchEditorPathRendering();
  patchThreeDimensionalPath(
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );
  patchThreeDimensionalPath(
    "src/components/reconstruction/ar/ARSceneFactory.ts",
  );

  console.log("");
  console.log(
    "Crooked vehicle movement fix applied.",
  );
  console.log(
    "Next run: npm run build",
  );
} catch (error) {
  console.error("");
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );
  process.exitCode = 1;
}
