import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const repoRoot = process.cwd();

const files = {
  geometry:
    "src/utils/reconstructionGeometry.ts",

  physics:
    "src/services/reconstructionPhysicsService.ts",

  package:
    "package.json",
};

function absolute(relativePath) {
  return path.join(
    repoRoot,
    relativePath,
  );
}

function read(relativePath) {
  const target =
    absolute(relativePath);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Required file is missing: ${relativePath}`,
    );
  }

  /*
   * [RoadSafe:Step3B2AWindowsLineEndingNormalisationV1]
   *
   * Git may check files out using CRLF on Windows. Normalise source text
   * before exact structural replacements so the patch remains independent
   * of the workstation's line-ending configuration.
   */
  return fs
    .readFileSync(
      target,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function git(args) {
  return execFileSync(
    "git",
    args,
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  ).trim();
}

function assertCheckpoint() {
  const branch =
    git([
      "branch",
      "--show-current",
    ]);

  const head =
    git([
      "rev-parse",
      "--short",
      "HEAD",
    ]);

  const tree =
    git([
      "rev-parse",
      "HEAD^{tree}",
    ]);

  const trackedStatus =
    git([
      "status",
      "--porcelain",
      "--untracked-files=no",
    ]);

  if (branch !== "main") {
    throw new Error(
      `Expected main, found ${branch}.`,
    );
  }

  if (head !== "64f18cf") {
    throw new Error(
      `Expected HEAD 64f18cf, found ${head}.`,
    );
  }

  if (
    tree !==
    "4984ac674907f7720703048b84884d1718525d3c"
  ) {
    throw new Error(
      "The tracked source tree differs from the verified Step 3B1 checkpoint.",
    );
  }

  if (trackedStatus.length > 0) {
    throw new Error(
      [
        "Tracked files contain changes:",
        trackedStatus,
      ].join("\n"),
    );
  }
}

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const first =
    source.indexOf(before);

  if (first < 0) {
    throw new Error(
      `Could not apply "${label}". The expected source was not found.`,
    );
  }

  const second =
    source.indexOf(
      before,
      first + before.length,
    );

  if (second >= 0) {
    throw new Error(
      `Refusing ambiguous replacement for "${label}".`,
    );
  }

  return (
    source.slice(0, first) +
    after +
    source.slice(first + before.length)
  );
}

function findNamedFunction(
  source,
  relativePath,
  functionName,
) {
  const sourceFile =
    ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );

  const matches = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === functionName
    ) {
      matches.push(node);
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${functionName} declaration in ${relativePath}, found ${matches.length}.`,
    );
  }

  return {
    start:
      matches[0].getStart(sourceFile),

    end:
      matches[0].getEnd(),
  };
}

function replaceNamedFunction(
  source,
  relativePath,
  functionName,
  replacement,
) {
  const range =
    findNamedFunction(
      source,
      relativePath,
      functionName,
    );

  return (
    source.slice(0, range.start) +
    replacement +
    source.slice(range.end)
  );
}

function findVariableStatement(
  source,
  relativePath,
  variableName,
) {
  const sourceFile =
    ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

  const matches = [];

  function visit(node) {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text ===
            variableName,
      )
    ) {
      matches.push(node);
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${variableName} variable statement in ${relativePath}, found ${matches.length}.`,
    );
  }

  return {
    start:
      matches[0].getStart(sourceFile),

    end:
      matches[0].getEnd(),
  };
}

function replaceVariableStatement(
  source,
  relativePath,
  variableName,
  replacement,
) {
  const range =
    findVariableStatement(
      source,
      relativePath,
      variableName,
    );

  return (
    source.slice(0, range.start) +
    replacement +
    source.slice(range.end)
  );
}

assertCheckpoint();

let geometry =
  read(files.geometry);

let physics =
  read(files.physics);

const packageJson =
  JSON.parse(
    read(files.package),
  );

geometry =
  replaceOnce(
    geometry,
`import {
  getIntegratedKinematicDistanceProgress,
  getSmoothKinematicSpeedKmh,
} from "./reconstructionMotionKinematics";`,
`import {
  getIntegratedKinematicDistanceProgress,
  getSmoothKinematicSpeedKmh,
  type MetricSceneDimensions,
} from "./reconstructionMotionKinematics";`,
    "import metric scene dimensions",
  );

geometry =
  replaceVariableStatement(
    geometry,
    files.geometry,
    "participantMotionSplineCache",
`const participantMotionSplineCache = new WeakMap<
  MovementPathPoint[],
  Map<string, SegmentMotionSpline[]>
>();

/*
 * [RoadSafe:CanonicalMetricPlaybackGeometryV1]
 *
 * Reconstruction positions remain stored as 0–100 scene coordinates, but
 * travelled distance and trajectory heading are calculated in physical
 * metres. This prevents non-square scenes from stretching curves, headings
 * and physics input velocities.
 */
const DEFAULT_PLAYBACK_WORLD_DIMENSIONS:
  MetricSceneDimensions = {
    widthMetres: 100,
    heightMetres: 100,
  };

function normalisePlaybackWorldDimensions(
  worldDimensions?: MetricSceneDimensions,
): MetricSceneDimensions {
  const width =
    worldDimensions?.widthMetres;

  const height =
    worldDimensions?.heightMetres;

  return {
    widthMetres:
      Number.isFinite(width) &&
      Number(width) > 0
        ? Math.max(
            0.001,
            Number(width),
          )
        : DEFAULT_PLAYBACK_WORLD_DIMENSIONS.widthMetres,

    heightMetres:
      Number.isFinite(height) &&
      Number(height) > 0
        ? Math.max(
            0.001,
            Number(height),
          )
        : DEFAULT_PLAYBACK_WORLD_DIMENSIONS.heightMetres,
  };
}

function sceneVectorToMetres(
  vector: Vector2,
  worldDimensions: MetricSceneDimensions,
): Vector2 {
  return {
    x:
      (vector.x / 100) *
      worldDimensions.widthMetres,

    y:
      (vector.y / 100) *
      worldDimensions.heightMetres,
  };
}

function metricVectorBetween(
  end: ReconstructionPosition,
  start: ReconstructionPosition,
  worldDimensions: MetricSceneDimensions,
): Vector2 {
  return sceneVectorToMetres(
    subtractPositions(
      end,
      start,
    ),
    worldDimensions,
  );
}

function metricDistanceBetween(
  first: ReconstructionPosition,
  second: ReconstructionPosition,
  worldDimensions: MetricSceneDimensions,
): number {
  return vectorLength(
    metricVectorBetween(
      second,
      first,
      worldDimensions,
    ),
  );
}

function metricDirectionBetween(
  end: ReconstructionPosition,
  start: ReconstructionPosition,
  worldDimensions: MetricSceneDimensions,
  fallback: Vector2 = {
    x: 1,
    y: 0,
  },
): Vector2 {
  return normaliseVector(
    metricVectorBetween(
      end,
      start,
      worldDimensions,
    ),
    fallback,
  );
}

function metricSplineCacheKey(
  participant: ReconstructionVehicle,
  worldDimensions: MetricSceneDimensions,
): string {
  return [
    participant.type,
    worldDimensions.widthMetres.toPrecision(12),
    worldDimensions.heightMetres.toPrecision(12),
  ].join("|");
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "getKinematicPositionProgress",
`function getKinematicPositionProgress(
  participant: ReconstructionVehicle,
  start: MovementPathPoint,
  end: MovementPathPoint,
  timeProgress: number,
): number {
  const startSpeed =
    start.action === "Stop"
      ? 0
      : getCanonicalPlaybackSpeedKmh(
          participant,
          start.speedKmh,
          start.action,
        );

  const endSpeed =
    end.action === "Stop"
      ? 0
      : getCanonicalPlaybackSpeedKmh(
          participant,
          end.speedKmh,
          end.action,
        );

  return getIntegratedKinematicDistanceProgress(
    startSpeed,
    endSpeed,
    timeProgress,
  );
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "createBezierArcLengthSamples",
`function createBezierArcLengthSamples(
  start: ReconstructionPosition,
  controlOne: ReconstructionPosition,
  controlTwo: ReconstructionPosition,
  end: ReconstructionPosition,
  turnSeverityDegrees: number,
  worldDimensions: MetricSceneDimensions,
): BezierArcLengthSample[] {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  const subdivisionCount = Math.round(
    interpolate(
      20,
      38,
      clamp(
        turnSeverityDegrees / 120,
        0,
        1,
      ),
    ),
  );

  const samples: BezierArcLengthSample[] = [
    {
      progress: 0,
      distance: 0,
    },
  ];

  let previous = start;
  let cumulativeDistance = 0;

  for (
    let index = 1;
    index <= subdivisionCount;
    index += 1
  ) {
    const progress =
      index / subdivisionCount;

    const position =
      cubicBezierPoint(
        start,
        controlOne,
        controlTwo,
        end,
        progress,
      );

    cumulativeDistance +=
      metricDistanceBetween(
        previous,
        position,
        dimensions,
      );

    samples.push({
      progress,
      distance: cumulativeDistance,
    });

    previous = position;
  }

  return samples;
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "getSmoothedBezierTangent",
`function getSmoothedBezierTangent(
  spline: SegmentMotionSpline,
  progress: number,
  worldDimensions: MetricSceneDimensions,
): Vector2 {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  const sampleWindow =
    spline.roadGraphControlled
      ? 0.025
      : 0.018;

  const before = normaliseVector(
    sceneVectorToMetres(
      cubicBezierTangent(
        spline.startPoint.position,
        spline.controlOne,
        spline.controlTwo,
        spline.endPoint.position,
        clamp(
          progress - sampleWindow,
          0,
          1,
        ),
      ),
      dimensions,
    ),
    spline.segmentDirection,
  );

  const current = normaliseVector(
    sceneVectorToMetres(
      cubicBezierTangent(
        spline.startPoint.position,
        spline.controlOne,
        spline.controlTwo,
        spline.endPoint.position,
        progress,
      ),
      dimensions,
    ),
    spline.segmentDirection,
  );

  const after = normaliseVector(
    sceneVectorToMetres(
      cubicBezierTangent(
        spline.startPoint.position,
        spline.controlOne,
        spline.controlTwo,
        spline.endPoint.position,
        clamp(
          progress + sampleWindow,
          0,
          1,
        ),
      ),
      dimensions,
    ),
    spline.segmentDirection,
  );

  return normaliseVector(
    {
      x:
        before.x * 0.2 +
        current.x * 0.6 +
        after.x * 0.2,

      y:
        before.y * 0.2 +
        current.y * 0.6 +
        after.y * 0.2,
    },
    current,
  );
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "createSegmentMotionSpline",
`function createSegmentMotionSpline(
  participant: ReconstructionVehicle,
  points: MovementPathPoint[],
  segmentIndex: number,
  worldDimensions: MetricSceneDimensions,
): SegmentMotionSpline {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  const profile =
    getMotionProfile(participant);

  const startPoint =
    points[segmentIndex];

  const endPoint =
    points[segmentIndex + 1];

  const previousPoint =
    points[
      Math.max(
        0,
        segmentIndex - 1,
      )
    ];

  const nextPoint =
    points[
      Math.min(
        points.length - 1,
        segmentIndex + 2,
      )
    ];

  const segmentVector =
    metricVectorBetween(
      endPoint.position,
      startPoint.position,
      dimensions,
    );

  const segmentLength =
    vectorLength(segmentVector);

  const segmentDirection =
    normaliseVector(
      segmentVector,
      {
        x: Math.cos(
          degreesToRadians(
            startPoint.rotation,
          ),
        ),

        y: Math.sin(
          degreesToRadians(
            startPoint.rotation,
          ),
        ),
      },
    );

  const incomingDirection =
    normaliseVector(
      metricVectorBetween(
        startPoint.position,
        previousPoint.position,
        dimensions,
      ),
      segmentDirection,
    );

  const outgoingDirection =
    normaliseVector(
      metricVectorBetween(
        nextPoint.position,
        endPoint.position,
        dimensions,
      ),
      segmentDirection,
    );

  let startTurnSeverityDegrees =
    angleDifferenceDegrees(
      incomingDirection,
      segmentDirection,
    );

  let endTurnSeverityDegrees =
    angleDifferenceDegrees(
      segmentDirection,
      outgoingDirection,
    );

  if (
    startPoint.action === "Turn Left" ||
    startPoint.action === "Turn Right"
  ) {
    startTurnSeverityDegrees =
      Math.max(
        startTurnSeverityDegrees,
        35,
      );
  }

  if (
    endPoint.action === "Turn Left" ||
    endPoint.action === "Turn Right"
  ) {
    endTurnSeverityDegrees =
      Math.max(
        endTurnSeverityDegrees,
        35,
      );
  }

  const physicsControlled =
    isPhysicsGeneratedPathPoint(startPoint) ||
    isPhysicsGeneratedPathPoint(endPoint) ||
    POST_IMPACT_ACTIONS.has(
      startPoint.action,
    );

  const roadGraphControlled =
    startPoint.notes?.includes(
      AUTO_ROAD_CURVE_NOTE_MARKER,
    ) === true ||
    endPoint.notes?.includes(
      AUTO_ROAD_CURVE_NOTE_MARKER,
    ) === true;

  const maximumTurnSeverity =
    Math.max(
      startTurnSeverityDegrees,
      endTurnSeverityDegrees,
    );

  const effectivelyStraight =
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
    segmentLength < 0.001;

  if (linear) {
    return {
      linear: true,
      physicsControlled,
      roadGraphControlled,
      startPoint,
      endPoint,
      segmentDirection,
      controlOne:
        startPoint.position,

      controlTwo:
        endPoint.position,

      arcLengthSamples: [
        {
          progress: 0,
          distance: 0,
        },
        {
          progress: 1,
          distance: segmentLength,
        },
      ],

      startTurnSeverityDegrees,
      endTurnSeverityDegrees,
    };
  }

  const controls =
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

  return {
    linear: false,
    physicsControlled,
    roadGraphControlled,
    startPoint,
    endPoint,
    segmentDirection,

    controlOne:
      controls.controlOne,

    controlTwo:
      controls.controlTwo,

    arcLengthSamples:
      createBezierArcLengthSamples(
        startPoint.position,
        controls.controlOne,
        controls.controlTwo,
        endPoint.position,
        maximumTurnSeverity,
        dimensions,
      ),

    startTurnSeverityDegrees,
    endTurnSeverityDegrees,
  };
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "getParticipantMotionSplines",
`function getParticipantMotionSplines(
  participant: ReconstructionVehicle,
  points: MovementPathPoint[],
  worldDimensions?: MetricSceneDimensions,
): SegmentMotionSpline[] {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  let dimensionCache =
    participantMotionSplineCache.get(
      points,
    );

  if (!dimensionCache) {
    dimensionCache =
      new Map();

    participantMotionSplineCache.set(
      points,
      dimensionCache,
    );
  }

  const cacheKey =
    metricSplineCacheKey(
      participant,
      dimensions,
    );

  const cached =
    dimensionCache.get(
      cacheKey,
    );

  if (cached) {
    return cached;
  }

  const splines =
    Array.from(
      {
        length:
          Math.max(
            0,
            points.length - 1,
          ),
      },
      (_, index) =>
        createSegmentMotionSpline(
          participant,
          points,
          index,
          dimensions,
        ),
    );

  dimensionCache.set(
    cacheKey,
    splines,
  );

  return splines;
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "getSegmentMotionGeometry",
`function getSegmentMotionGeometry(
  participant: ReconstructionVehicle,
  points: MovementPathPoint[],
  segmentIndex: number,
  distanceProgress: number,
  worldDimensions?: MetricSceneDimensions,
): SegmentMotionGeometry {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  const splines =
    getParticipantMotionSplines(
      participant,
      points,
      dimensions,
    );

  const spline =
    splines[segmentIndex];

  if (!spline) {
    const startPoint =
      points[segmentIndex];

    const endPoint =
      points[segmentIndex + 1] ??
      startPoint;

    const direction =
      metricDirectionBetween(
        endPoint.position,
        startPoint.position,
        dimensions,
      );

    return {
      position:
        startPoint.position,

      tangent:
        direction,

      turnSeverityDegrees:
        0,
    };
  }

  const localTurnSeverity =
    interpolate(
      spline.startTurnSeverityDegrees,
      spline.endTurnSeverityDegrees,
      smoothStep(
        distanceProgress,
      ),
    );

  if (spline.linear) {
    return {
      position: {
        x:
          interpolate(
            spline.startPoint.position.x,
            spline.endPoint.position.x,
            distanceProgress,
          ),

        y:
          interpolate(
            spline.startPoint.position.y,
            spline.endPoint.position.y,
            distanceProgress,
          ),
      },

      tangent:
        spline.segmentDirection,

      turnSeverityDegrees:
        localTurnSeverity,
    };
  }

  const curveProgress =
    getBezierProgressAtDistanceFraction(
      spline.arcLengthSamples,
      distanceProgress,
    );

  return {
    position:
      cubicBezierPoint(
        spline.startPoint.position,
        spline.controlOne,
        spline.controlTwo,
        spline.endPoint.position,
        curveProgress,
      ),

    tangent:
      getSmoothedBezierTangent(
        spline,
        curveProgress,
        dimensions,
      ),

    turnSeverityDegrees:
      localTurnSeverity,
  };
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "getCornerAdjustedSpeed",
`function getCanonicalPlaybackSpeedKmh(
  participant: ReconstructionVehicle,
  requestedSpeedKmh: number,
  action: MovementAction,
): number {
  const profile =
    getMotionProfile(participant);

  let speed =
    Math.max(
      0,
      requestedSpeedKmh,
    );

  /*
   * A participant's returned speed must describe the same progress used to
   * calculate its position. Corner losses are therefore not applied as a
   * second display-only multiplier. Investigators express actual braking or
   * corner speed changes through the authored point speeds and timestamps.
   */
  if (
    profile.maximumWalkingSpeedKmh !== null &&
    action !== "Accelerate"
  ) {
    speed =
      Math.min(
        speed,
        profile.maximumWalkingSpeedKmh,
      );
  }

  return speed;
}`,
  );

geometry =
  replaceNamedFunction(
    geometry,
    files.geometry,
    "getParticipantStateAtTime",
`export function getParticipantStateAtTime(
  participant: ReconstructionVehicle,
  currentTime: number,
  worldDimensions?: MetricSceneDimensions,
): {
  position: ReconstructionPosition;
  rotation: number;
  speedKmh: number;
  activePointId: string;
} {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  const points =
    getParticipantPlaybackPathPoints(
      participant,
    );

  if (points.length === 0) {
    return {
      position:
        participant.startPosition,

      rotation:
        participant.startRotation,

      speedKmh:
        participant.estimatedSpeedKmh,

      activePointId:
        "",
    };
  }

  if (
    currentTime <=
    points[0].timeSeconds
  ) {
    const first =
      points[0];

    const next =
      points[1] ??
      first;

    const fallbackTangent =
      metricDirectionBetween(
        next.position,
        first.position,
        dimensions,
        {
          x:
            Math.cos(
              degreesToRadians(
                first.rotation,
              ),
            ),

          y:
            Math.sin(
              degreesToRadians(
                first.rotation,
              ),
            ),
        },
      );

    const tangent =
      points.length >= 2
        ? getSegmentMotionGeometry(
            participant,
            points,
            0,
            0,
            dimensions,
          ).tangent
        : fallbackTangent;

    const heading =
      angleFromVector(
        tangent,
      );

    const speedKmh =
      first.action === "Stop"
        ? 0
        : getCanonicalPlaybackSpeedKmh(
            participant,
            first.speedKmh,
            first.action,
          );

    const walkingMotion =
      applyHumanWalkingMotion(
        participant,
        first.position,
        heading,
        speedKmh,
        currentTime,
        first.action,
        isPhysicsGeneratedPathPoint(
          first,
        ),
      );

    return {
      position:
        walkingMotion.position,

      rotation:
        walkingMotion.rotation,

      speedKmh,

      activePointId:
        first.id,
    };
  }

  const finalPoint =
    points[
      points.length - 1
    ];

  if (
    currentTime >=
    finalPoint.timeSeconds
  ) {
    const previous =
      points[
        Math.max(
          0,
          points.length - 2,
        )
      ];

    const fallbackTangent =
      metricDirectionBetween(
        finalPoint.position,
        previous.position,
        dimensions,
        {
          x:
            Math.cos(
              degreesToRadians(
                finalPoint.rotation,
              ),
            ),

          y:
            Math.sin(
              degreesToRadians(
                finalPoint.rotation,
              ),
            ),
        },
      );

    const tangent =
      points.length >= 2
        ? getSegmentMotionGeometry(
            participant,
            points,
            points.length - 2,
            1,
            dimensions,
          ).tangent
        : fallbackTangent;

    const physicsControlled =
      isPhysicsGeneratedPathPoint(
        finalPoint,
      ) ||
      POST_IMPACT_ACTIONS.has(
        finalPoint.action,
      );

    const heading =
      physicsControlled
        ? finalPoint.rotation
        : angleFromVector(
            tangent,
          );

    const speedKmh =
      finalPoint.action === "Stop"
        ? 0
        : getCanonicalPlaybackSpeedKmh(
            participant,
            finalPoint.speedKmh,
            finalPoint.action,
          );

    const walkingMotion =
      applyHumanWalkingMotion(
        participant,
        finalPoint.position,
        heading,
        speedKmh,
        currentTime,
        finalPoint.action,
        physicsControlled,
      );

    return {
      position:
        walkingMotion.position,

      rotation:
        walkingMotion.rotation,

      speedKmh,

      activePointId:
        finalPoint.id,
    };
  }

  const segmentIndex =
    points.findIndex(
      (point, index) =>
        index <
          points.length - 1 &&
        currentTime >=
          point.timeSeconds &&
        currentTime <=
          points[index + 1]
            .timeSeconds,
    );

  const safeIndex =
    Math.max(
      0,
      segmentIndex,
    );

  const start =
    points[safeIndex];

  const end =
    points[safeIndex + 1];

  const duration =
    Math.max(
      end.timeSeconds -
        start.timeSeconds,
      0.001,
    );

  const timeProgress =
    clamp(
      (
        currentTime -
        start.timeSeconds
      ) /
        duration,
      0,
      1,
    );

  const positionProgress =
    getKinematicPositionProgress(
      participant,
      start,
      end,
      timeProgress,
    );

  const geometry =
    getSegmentMotionGeometry(
      participant,
      points,
      safeIndex,
      positionProgress,
      dimensions,
    );

  const physicsControlled =
    isPhysicsGeneratedPathPoint(
      start,
    ) ||
    isPhysicsGeneratedPathPoint(
      end,
    ) ||
    POST_IMPACT_ACTIONS.has(
      start.action,
    );

  const pathHeading =
    angleFromVector(
      geometry.tangent,
    );

  const physicsRotation =
    interpolateAngle(
      start.rotation,
      end.rotation,
      smootherStep(
        positionProgress,
      ),
    );

  let rotation =
    physicsControlled
      ? physicsRotation
      : pathHeading;

  if (
    physicsControlled &&
    safeIndex > 0 &&
    POST_IMPACT_ACTIONS.has(
      start.action,
    ) &&
    positionProgress < 0.16
  ) {
    const previousGeometry =
      getSegmentMotionGeometry(
        participant,
        points,
        safeIndex - 1,
        1,
        dimensions,
      );

    const previousHeading =
      angleFromVector(
        previousGeometry.tangent,
      );

    rotation =
      interpolateAngle(
        previousHeading,
        physicsRotation,
        smootherStep(
          positionProgress /
            0.16,
        ),
      );
  }

  const canonicalStartSpeed =
    start.action === "Stop"
      ? 0
      : getCanonicalPlaybackSpeedKmh(
          participant,
          start.speedKmh,
          start.action,
        );

  const canonicalEndSpeed =
    end.action === "Stop"
      ? 0
      : getCanonicalPlaybackSpeedKmh(
          participant,
          end.speedKmh,
          end.action,
        );

  const speedKmh =
    getSmoothKinematicSpeedKmh(
      canonicalStartSpeed,
      canonicalEndSpeed,
      timeProgress,
    );

  const activeAction =
    timeProgress < 0.5
      ? start.action
      : end.action;

  const walkingMotion =
    applyHumanWalkingMotion(
      participant,
      geometry.position,
      rotation,
      speedKmh,
      currentTime,
      activeAction,
      physicsControlled,
    );

  return {
    position:
      walkingMotion.position,

    rotation:
      walkingMotion.rotation,

    speedKmh,

    activePointId:
      timeProgress < 0.5
        ? start.id
        : end.id,
  };
}`,
  );

physics =
  replaceNamedFunction(
    physics,
    files.physics,
    "participantWorldPositionAtTime",
`function participantWorldPositionAtTime(
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
): Vector2 {
  return worldPosition(
    getParticipantStateAtTime(
      participant,
      timeSeconds,
      {
        widthMetres: width,
        heightMetres: height,
      },
    ).position,
    width,
    height,
  );
}`,
  );

physics =
  replaceNamedFunction(
    physics,
    files.physics,
    "participantPoseAtTime",
`function participantPoseAtTime(
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
): PhysicsPose2D {
  const state =
    getParticipantStateAtTime(
      participant,
      timeSeconds,
      {
        widthMetres: width,
        heightMetres: height,
      },
    );

  return {
    position:
      worldPosition(
        state.position,
        width,
        height,
      ),

    rotationDegrees:
      state.rotation,
  };
}`,
  );

physics =
  replaceOnce(
    physics,
`  const state =
    getParticipantStateAtTime(
      participant,
      timeSeconds,
    );`,
`  const state =
    getParticipantStateAtTime(
      participant,
      timeSeconds,
      {
        widthMetres: width,
        heightMetres: height,
      },
    );`,
    "supply metric dimensions to fallback velocity state",
  );

physics =
  replaceOnce(
    physics,
`    const state = getParticipantStateAtTime(participant, impactTime);`,
`    const state =
      getParticipantStateAtTime(
        participant,
        impactTime,
        {
          widthMetres: width,
          heightMetres: height,
        },
      );`,
    "supply metric dimensions to impact state",
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "playback-core:verify"
] =
  "node scripts/verify-phase0-canonical-metric-playback-core.mjs && tsc -p tsconfig.phase0.json";

const pendingWrites =
  new Map([
    [
      files.geometry,
      geometry,
    ],
    [
      files.physics,
      physics,
    ],
    [
      files.package,
      `${JSON.stringify(
        packageJson,
        null,
        2,
      )}\n`,
    ],
  ]);

for (
  const [
    relativePath,
    content,
  ]
  of pendingWrites
) {
  fs.writeFileSync(
    absolute(relativePath),
    content,
    "utf8",
  );

  console.log(
    `updated ${relativePath}`,
  );
}

console.log(
  "Phase 0 Step 3B2A canonical metric playback core applied.",
);
