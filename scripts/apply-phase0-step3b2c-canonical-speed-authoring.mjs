import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const paths = {
  panel:
    "src/components/reconstruction/ParticipantPathPanel.tsx",

  editor:
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",

  geometry:
    "src/utils/reconstructionGeometry.ts",

  motion:
    "src/utils/reconstructionMotionKinematics.ts",

  package:
    "package.json",
};

function absolute(relativePath) {
  return path.join(
    root,
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

  return fs
    .readFileSync(
      target,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function write(
  relativePath,
  content,
) {
  fs.writeFileSync(
    absolute(relativePath),
    content,
    "utf8",
  );
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
      `Could not apply "${label}". Expected source was not found.`,
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

function parse(
  relativePath,
  source,
) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
}

function findFunctionRange(
  relativePath,
  source,
  functionName,
) {
  const sourceFile =
    parse(
      relativePath,
      source,
    );

  const matches = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text ===
        functionName
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
      `Expected one ${functionName} function in ${relativePath}, found ${matches.length}.`,
    );
  }

  return {
    start:
      matches[0].getStart(
        sourceFile,
      ),

    end:
      matches[0].getEnd(),
  };
}

function insertAfterFunction(
  relativePath,
  source,
  functionName,
  insertion,
) {
  const range =
    findFunctionRange(
      relativePath,
      source,
      functionName,
    );

  return (
    source.slice(
      0,
      range.end,
    ) +
    "\n\n" +
    insertion +
    source.slice(
      range.end,
    )
  );
}

function findVariableStatementRange(
  relativePath,
  source,
  variableName,
) {
  const sourceFile =
    parse(
      relativePath,
      source,
    );

  const matches = [];

  function visit(node) {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList
        .declarations
        .some(
          (declaration) =>
            ts.isIdentifier(
              declaration.name,
            ) &&
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
      matches[0].getStart(
        sourceFile,
      ),

    end:
      matches[0].getEnd(),
  };
}

function replaceVariableStatement(
  relativePath,
  source,
  variableName,
  replacement,
) {
  const range =
    findVariableStatementRange(
      relativePath,
      source,
      variableName,
    );

  return (
    source.slice(
      0,
      range.start,
    ) +
    replacement +
    source.slice(
      range.end,
    )
  );
}

let motion =
  read(paths.motion);

let geometry =
  read(paths.geometry);

let panel =
  read(paths.panel);

let editor =
  read(paths.editor);

if (
  panel.includes(
    "[RoadSafe:CanonicalMetricSpeedAuthoringV1]",
  )
) {
  throw new Error(
    "Step 3B2C is already installed.",
  );
}

/*
 * Allow the canonical timing solver to consume the exact spline lengths
 * calculated by the playback geometry.
 */
motion =
  replaceOnce(
    motion,
`  dimensions?:
    MetricSceneDimensions,
): MetricRouteTimingResult {`,
`  dimensions?:
    MetricSceneDimensions,
  segmentLengthsMetresOverride?:
    readonly number[],
): MetricRouteTimingResult {`,
    "extend metric timing solver signature",
  );

motion =
  replaceOnce(
    motion,
`  const segmentLengthsMetres =
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
      );`,
`  /*
   * [RoadSafe:CanonicalSplineLengthTimingOverrideV1]
   *
   * Step 3B2 playback may supply the exact metric lengths of its smoothed
   * Bézier segments. Existing callers continue using straight metric segment
   * lengths when no valid override is supplied.
   */
  const validLengthOverride =
    segmentLengthsMetresOverride?.length ===
      points.length - 1 &&
    segmentLengthsMetresOverride.every(
      (length) =>
        Number.isFinite(length) &&
        length >= 0,
    );

  const segmentLengthsMetres =
    validLengthOverride
      ? segmentLengthsMetresOverride.map(
          (length) =>
            Math.max(
              0,
              Number(length),
            ),
        )
      : points
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
          );`,
    "use canonical spline length override",
  );

/*
 * Export the exact segment lengths already used by playback.
 */
geometry =
  insertAfterFunction(
    paths.geometry,
    geometry,
    "getParticipantMotionSplines",
`/*
 * [RoadSafe:CanonicalMetricPlaybackSegmentLengthsV1]
 *
 * Provides authoring controls with the exact same metric spline lengths used
 * by 2D, 3D, AR, exported frames and physics state sampling.
 */
export function getParticipantMetricPlaybackSegmentLengthsMetres(
  participant: ReconstructionVehicle,
  points: MovementPathPoint[],
  worldDimensions?: MetricSceneDimensions,
): number[] {
  const dimensions =
    normalisePlaybackWorldDimensions(
      worldDimensions,
    );

  return getParticipantMotionSplines(
    participant,
    points,
    dimensions,
  ).map(
    (spline) =>
      Math.max(
        0,
        spline.arcLengthSamples[
          spline.arcLengthSamples.length -
            1
        ]?.distance ?? 0,
      ),
  );
}`,
  );

/*
 * ParticipantPathPanel imports and props.
 */
panel =
  replaceOnce(
    panel,
`  MovementPathPoint,
  ReconstructionSceneObject,
  ReconstructionVehicle,`,
`  MovementPathPoint,
  ReconstructionSceneObject,
  ReconstructionVehicle,`,
    "confirm participant panel type block",
  );

panel =
  replaceOnce(
    panel,
`  getInvestigatorPathPoints,
  getPhysicsPathPoints,`,
`  getInvestigatorPathPoints,
  getParticipantMetricPlaybackSegmentLengthsMetres,
  getPhysicsPathPoints,`,
    "import canonical playback segment lengths",
  );

panel =
  replaceOnce(
    panel,
`} from "../../utils/reconstructionGeometry";

import {
  canDeleteRoutePoint,`,
`} from "../../utils/reconstructionGeometry";

import {
  solveMetricRouteTiming,
  type MetricSceneDimensions,
} from "../../utils/reconstructionMotionKinematics";

import {
  canDeleteRoutePoint,`,
    "import canonical metric timing solver",
  );

panel =
  replaceOnce(
    panel,
`interface ParticipantPathPanelProps {
  participant: ReconstructionVehicle;
  durationSeconds: number;
  sceneObjects: ReconstructionSceneObject[];`,
`interface ParticipantSpeedPlan {
  estimatedSpeedKmh: number;
  pathPoints: MovementPathPoint[];
  requiredDurationSeconds: number;
}

interface ParticipantPathPanelProps {
  participant: ReconstructionVehicle;
  durationSeconds: number;
  worldDimensions: MetricSceneDimensions;
  sceneObjects: ReconstructionSceneObject[];`,
    "add metric dimensions and speed plan type",
  );

panel =
  replaceOnce(
    panel,
`  onParticipantChange: (
    updates: Partial<ReconstructionVehicle>,
  ) => void;

  onPointChange:`,
`  onParticipantChange: (
    updates: Partial<ReconstructionVehicle>,
  ) => void;

  onApplySpeedPlan: (
    plan: ParticipantSpeedPlan,
  ) => void;

  onPointChange:`,
    "add atomic speed-plan callback",
  );

panel =
  replaceOnce(
    panel,
`    participant,
    durationSeconds,
    sceneObjects,`,
`    participant,
    durationSeconds,
    worldDimensions,
    sceneObjects,`,
    "destructure metric dimensions",
  );

panel =
  replaceOnce(
    panel,
`    onParticipantChange,
    onPointChange,`,
`    onParticipantChange,
    onApplySpeedPlan,
    onPointChange,`,
    "destructure speed-plan callback",
  );

panel =
  replaceVariableStatement(
    paths.panel,
    panel,
    "applyParticipantSpeed",
`  /*
   * [RoadSafe:CanonicalMetricSpeedAuthoringV1]
   *
   * Exact participant speed is now solved against the same metric Bézier
   * lengths used by every playback view. The reconstruction duration expands
   * atomically when a slower route needs more time, so Point Z never becomes
   * unsaveable by falling outside the timeline.
   */
  const applyParticipantSpeed =
    useCallback(
      (requestedSpeed: number) => {
        if (
          !Number.isFinite(
            requestedSpeed,
          )
        ) {
          setSpeedDraft(
            formatSpeedValue(
              participant.estimatedSpeedKmh,
            ),
          );
          return;
        }

        const nextSpeed =
          clampNumber(
            requestedSpeed,
            0.1,
            speedLimit,
          );

        if (
          investigatorPoints.length <
          2
        ) {
          setRouteMessage(
            "Point 1 and Point Z are required before route speed can be recalculated.",
          );

          setSpeedDraft(
            formatSpeedValue(
              participant.estimatedSpeedKmh,
            ),
          );

          return;
        }

        const speedAdjustedPoints =
          investigatorPoints.map(
            (point) => ({
              ...point,

              speedKmh:
                point.action === "Stop"
                  ? 0
                  : nextSpeed,
            }),
          );

        const segmentLengthsMetres =
          getParticipantMetricPlaybackSegmentLengthsMetres(
            {
              ...participant,
              pathPoints:
                speedAdjustedPoints,
            },
            speedAdjustedPoints,
            worldDimensions,
          );

        const timingInput =
          speedAdjustedPoints.map(
            (point) => ({
              position:
                point.position,

              speedKmh:
                point.speedKmh,

              stopped:
                point.action ===
                "Stop",
            }),
          );

        /*
         * First obtain the route's natural duration at the requested speed.
         * Then solve again using that duration so speedScale remains one and
         * the entered speed is not silently changed.
         */
        const naturalTiming =
          solveMetricRouteTiming(
            timingInput,
            1,
            nextSpeed,
            worldDimensions,
            segmentLengthsMetres,
          );

        const targetTravelDuration =
          Math.max(
            0.1,
            naturalTiming
              .naturalDurationSeconds,
          );

        const timing =
          solveMetricRouteTiming(
            timingInput,
            targetTravelDuration,
            nextSpeed,
            worldDimensions,
            segmentLengthsMetres,
          );

        const firstTime =
          investigatorPoints[0]
            ?.timeSeconds ?? 0;

        const updatedPathPoints =
          speedAdjustedPoints.map(
            (point, index) => ({
              ...point,

              timeSeconds:
                Number(
                  (
                    firstTime +
                    (
                      timing
                        .timesSeconds[
                          index
                        ] ?? 0
                    )
                  ).toFixed(4),
                ),

              /*
               * The solver determines timing. Preserve the investigator's
               * exact requested speed rather than exposing tiny scale changes
               * caused only by four-decimal timing precision.
               */
              speedKmh:
                point.action === "Stop"
                  ? 0
                  : nextSpeed,
            }),
          );

        const previousImpactTime =
          investigatorPoints[
            investigatorPoints.length -
              1
          ]?.timeSeconds ??
          firstTime;

        const existingPostImpactWindow =
          Math.max(
            0.05,
            durationSeconds -
              previousImpactTime,
          );

        const finalTime =
          updatedPathPoints[
            updatedPathPoints.length -
              1
          ]?.timeSeconds ??
          firstTime;

        const requiredDurationSeconds =
          Number(
            Math.max(
              durationSeconds,
              finalTime +
                existingPostImpactWindow,
            ).toFixed(4),
          );

        onApplySpeedPlan({
          estimatedSpeedKmh:
            nextSpeed,

          pathPoints:
            updatedPathPoints,

          requiredDurationSeconds,
        });

        setSpeedDraft(
          formatSpeedValue(
            nextSpeed,
          ),
        );

        const timelineExpanded =
          requiredDurationSeconds >
          durationSeconds + 0.0001;

        setRouteMessage(
          timelineExpanded
            ? \`\${participant.name} now travels at \${formatSpeedValue(nextSpeed)} km/h using calibrated metric curve timing. Point Z is reached at \${finalTime.toFixed(2)}s and the timeline expanded to \${requiredDurationSeconds.toFixed(2)}s to preserve post-impact playback.\`
            : \`\${participant.name} now travels at \${formatSpeedValue(nextSpeed)} km/h using the same calibrated metric curve timing as 2D, 3D, AR and physics.\`,
        );
      },
      [
        durationSeconds,
        investigatorPoints,
        onApplySpeedPlan,
        participant,
        speedLimit,
        worldDimensions,
      ],
    );`,
  );

panel =
  replaceOnce(
    panel,
`This updates the participant&apos;s authored route speed and recalculates route timing. Entering 1 km/h makes this participant move at 1 km/h during playback.`,
`This applies the exact entered speed using calibrated metric curve length. The timeline expands automatically when required so Point Z and post-impact playback remain valid.`,
    "update exact speed explanation",
  );

/*
 * Wire dimensions and the atomic reconstruction update into the editor.
 */
const panelStart =
  editor.indexOf(
    "<ParticipantPathPanel",
  );

if (panelStart < 0) {
  throw new Error(
    "ParticipantPathPanel usage was not found in the editor.",
  );
}

const durationAttribute =
  "durationSeconds={reconstruction.durationSeconds}";

const durationIndex =
  editor.indexOf(
    durationAttribute,
    panelStart,
  );

if (durationIndex < 0) {
  throw new Error(
    "ParticipantPathPanel duration prop was not found.",
  );
}

editor =
  editor.slice(
    0,
    durationIndex +
      durationAttribute.length,
  ) +
  `
                      worldDimensions={getReconstructionWorldDimensions(reconstruction)}` +
  editor.slice(
    durationIndex +
      durationAttribute.length,
  );

const updatedPanelStart =
  editor.indexOf(
    "<ParticipantPathPanel",
  );

const participantChangeIndex =
  editor.indexOf(
    "onParticipantChange={",
    updatedPanelStart,
  );

if (participantChangeIndex < 0) {
  throw new Error(
    "ParticipantPathPanel onParticipantChange prop was not found.",
  );
}

editor =
  editor.slice(
    0,
    participantChangeIndex,
  ) +
`onApplySpeedPlan={({
                        estimatedSpeedKmh,
                        pathPoints,
                        requiredDurationSeconds,
                      }) => {
                        setReconstruction(
                          (current) => ({
                            ...current,

                            durationSeconds:
                              Math.max(
                                current.durationSeconds,
                                requiredDurationSeconds,
                              ),

                            lastPhysicsSimulation:
                              undefined,

                            vehicles:
                              current.vehicles.map(
                                (candidate) =>
                                  candidate.id ===
                                  selectedParticipant.id
                                    ? syncLegacyParticipantFields({
                                        ...candidate,
                                        estimatedSpeedKmh,
                                        pathPoints,
                                      })
                                    : candidate,
                              ),
                          }),
                        );
                      }}
                      ` +
  editor.slice(
    participantChangeIndex,
  );

const packageJson =
  JSON.parse(
    read(paths.package),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "playback-authoring:verify"
] =
  "node scripts/verify-phase0-step3b2c-canonical-speed-authoring.mjs && tsc -p tsconfig.phase0.json";

write(
  paths.motion,
  motion,
);

write(
  paths.geometry,
  geometry,
);

write(
  paths.panel,
  panel,
);

write(
  paths.editor,
  editor,
);

write(
  paths.package,
  `${JSON.stringify(
    packageJson,
    null,
    2,
  )}\n`,
);

console.log(
  "updated src/utils/reconstructionMotionKinematics.ts",
);

console.log(
  "updated src/utils/reconstructionGeometry.ts",
);

console.log(
  "updated src/components/reconstruction/ParticipantPathPanel.tsx",
);

console.log(
  "updated src/components/reconstruction/AccidentReconstructionEditor.tsx",
);

console.log(
  "updated package.json",
);

console.log(
  "Phase 0 Step 3B2C canonical speed authoring applied.",
);
