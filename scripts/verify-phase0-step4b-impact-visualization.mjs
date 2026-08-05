import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root =
  process.cwd();

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(message);
  }
}

const viewer =
  read(
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

const ar =
  read(
    "src/components/reconstruction/ar/ARSceneFactory.ts",
  );

const utilitySource =
  read(
    "src/utils/reconstructionImpactVisualization.ts",
  );

const packageJson =
  JSON.parse(
    read("package.json"),
  );

assert(
  utilitySource.includes(
    "[RoadSafe:CanonicalImpactVisualizationV1]",
  ),
  "Canonical impact visualization marker is missing.",
);

assert(
  (
    viewer.match(
      /\[RoadSafe:ImpulseDrivenImpactVisualizationV1\]/g,
    ) ??
    []
  ).length === 1,
  "3D impulse-driven marker is missing or duplicated.",
);

assert(
  (
    ar.match(
      /\[RoadSafe:ImpulseDrivenImpactVisualizationV1\]/g,
    ) ??
    []
  ).length === 1,
  "AR impulse-driven marker is missing or duplicated.",
);

assert(
  viewer.includes(
    "indexEarliestParticipantImpactResponses",
  ),
  "3D does not index canonical participant responses.",
);

assert(
  ar.includes(
    "indexEarliestParticipantImpactResponses",
  ),
  "AR does not index canonical participant responses.",
);

assert(
  viewer.includes(
    "participantHeadingDegrees:\n        currentTime",
  ) === false,
  "3D impact pose arguments are malformed.",
);

assert(
  viewer.includes(
    "impact,\n          state.rotation,\n          effectiveShowPhysics",
  ),
  "3D does not pass canonical response and trajectory heading.",
);

assert(
  ar.includes(
    "impact,\n          state.rotation,\n          physicsEffects",
  ),
  "AR does not pass canonical response and trajectory heading.",
);

assert(
  !viewer.includes(
    "const severity = clamp(speedKmh / 70",
  ),
  "Old canned 3D speed-only collision animation remains.",
);

assert(
  !ar.includes(
    "const severity = clamp(speedKmh / 70",
  ),
  "Old canned AR speed-only collision animation remains.",
);

assert(
  packageJson.scripts?.[
    "impact-visuals:verify"
  ],
  "impact-visuals:verify package script is missing.",
);

const transpiled =
  ts.transpileModule(
    utilitySource,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2022,

        module:
          ts.ModuleKind.ES2022,

        strict: true,
      },

      fileName:
        "reconstructionImpactVisualization.ts",

      reportDiagnostics:
        true,
    },
  );

const transpileErrors =
  (
    transpiled.diagnostics ??
    []
  ).filter(
    (diagnostic) =>
      diagnostic.category ===
      ts.DiagnosticCategory.Error,
  );

assert(
  transpileErrors.length === 0,
  `Visualization utility transpilation produced ${transpileErrors.length} error(s).`,
);

const encodedModule =
  Buffer.from(
    transpiled.outputText,
    "utf8",
  ).toString("base64");

const {
  getParticipantImpactVisualPose,
  indexEarliestParticipantImpactResponses,
} =
  await import(
    `data:text/javascript;base64,${encodedModule}`
  );

function makeResponse(overrides = {}) {
  return {
    schemaVersion:
      "RoadSafe Impact Response V1",

    collisionEventId:
      "collision-1",

    participantId:
      "participant-1",

    participantType:
      "Car",

    timeSeconds: 2,

    responseClass:
      "Rigid Vehicle",

    contactPoint: {
      x: 50,
      y: 50,
    },

    impactPosition: {
      x: 48,
      y: 50,
    },

    contactZone:
      "Front",

    participantNormal: {
      x: -1,
      y: 0,
    },

    impulseDirection: {
      x: -1,
      y: 0,
    },

    impulseNs: {
      x: -4200,
      y: 0,
    },

    impulseMagnitudeNs:
      4200,

    incomingVelocityMps: {
      x: 12,
      y: 0,
    },

    outgoingVelocityMps: {
      x: 8,
      y: 1,
    },

    deltaVelocityMps: {
      x: -4,
      y: 1,
    },

    deltaVMetresPerSecond:
      Math.hypot(4, 1),

    angularVelocityChangeDegreesPerSecond:
      -18,

    outcome:
      "Deflect",

    relativeImpactSpeedKmh:
      48,

    estimatedEnergyKj:
      14,

    ...overrides,
  };
}

const rigidBefore =
  getParticipantImpactVisualPose({
    response:
      makeResponse(),

    currentTimeSeconds:
      1.9,

    participantHeadingDegrees:
      0,

    participantHeightMetres:
      1.55,
  });

assert(
  rigidBefore.phase ===
    "Before Impact",
  "Rigid vehicle reacted before contact.",
);

const rigidContact =
  getParticipantImpactVisualPose({
    response:
      makeResponse(),

    currentTimeSeconds:
      2.12,

    participantHeadingDegrees:
      0,

    participantHeightMetres:
      1.55,
  });

assert(
  rigidContact.phase ===
    "Contact",
  `Rigid contact phase is ${rigidContact.phase}.`,
);

assert(
  Math.abs(
    rigidContact
      .rotationZDegrees,
  ) > 0.01,
  "Front impact did not produce a pitch response.",
);

const rigidSettled =
  getParticipantImpactVisualPose({
    response:
      makeResponse(),

    currentTimeSeconds:
      3.4,

    participantHeadingDegrees:
      0,

    participantHeightMetres:
      1.55,
  });

assert(
  rigidSettled.phase ===
    "Settled",
  "Rigid vehicle did not settle.",
);

assert(
  rigidSettled.rotationXDegrees ===
    0 &&
  rigidSettled.rotationZDegrees ===
    0,
  "Rigid vehicle retained artificial suspension rotation.",
);

const bicycleResponse =
  makeResponse({
    participantId:
      "bicycle-1",

    participantType:
      "Bicycle",

    responseClass:
      "Two Wheeler",

    contactZone:
      "Right Side",

    impulseDirection: {
      x: 0,
      y: 1,
    },

    deltaVMetresPerSecond:
      8,

    angularVelocityChangeDegreesPerSecond:
      95,

    relativeImpactSpeedKmh:
      42,
  });

const bicycleSettled =
  getParticipantImpactVisualPose({
    response:
      bicycleResponse,

    currentTimeSeconds:
      3.4,

    participantHeadingDegrees:
      0,

    participantHeightMetres:
      1.2,
  });

assert(
  bicycleSettled.phase ===
    "Settled",
  "Bicycle did not enter its settled phase.",
);

assert(
  Math.abs(
    bicycleSettled
      .rotationXDegrees,
  ) >= 75,
  "Bicycle did not remain tipped on the struck side.",
);

const humanResponse =
  makeResponse({
    participantId:
      "pedestrian-1",

    participantType:
      "Pedestrian",

    responseClass:
      "Human Body",

    contactZone:
      "Left Side",

    impulseDirection: {
      x: 0.65,
      y: -0.76,
    },

    deltaVMetresPerSecond:
      10,

    angularVelocityChangeDegreesPerSecond:
      -130,

    relativeImpactSpeedKmh:
      50,

    estimatedEnergyKj:
      18,
  });

const humanAirborne =
  getParticipantImpactVisualPose({
    response:
      humanResponse,

    currentTimeSeconds:
      2.35,

    participantHeadingDegrees:
      0,

    participantHeightMetres:
      1.75,
  });

assert(
  humanAirborne.phase ===
    "Airborne",
  `Human phase is ${humanAirborne.phase}.`,
);

assert(
  humanAirborne.verticalMetres >
    0,
  "Human response did not follow a gravity-driven flight arc.",
);

const humanSettled =
  getParticipantImpactVisualPose({
    response:
      humanResponse,

    currentTimeSeconds:
      5,

    participantHeadingDegrees:
      0,

    participantHeightMetres:
      1.75,
  });

assert(
  humanSettled.phase ===
    "Settled",
  "Human did not reach a settled ground pose.",
);

assert(
  Math.abs(
    humanSettled
      .rotationXDegrees,
  ) +
    Math.abs(
      humanSettled
        .rotationZDegrees,
    ) >
    80,
  "Human did not retain a fallen orientation.",
);

const eventIndex =
  indexEarliestParticipantImpactResponses([
    {
      id: "late",
      timeSeconds: 4,
      type:
        "Participant-Participant",
      participantIds: [
        "participant-1",
      ],
      contactPoint: {
        x: 0,
        y: 0,
      },
      normal: {
        x: 1,
        y: 0,
      },
      relativeSpeedKmh: 1,
      impactAngleDegrees: 0,
      normalImpulseNs: 1,
      frictionImpulseNs: 0,
      totalImpulseNs: 1,
      estimatedEnergyKj: 0,
      estimatedAverageForceRangeKn: {
        minimum: 0,
        maximum: 0,
      },
      angularVelocityChangesDegPerSecond: {},
      impactResponses: [
        makeResponse({
          collisionEventId:
            "late",

          timeSeconds: 4,
        }),
      ],
    },
    {
      id: "early",
      timeSeconds: 2,
      type:
        "Participant-Participant",
      participantIds: [
        "participant-1",
      ],
      contactPoint: {
        x: 0,
        y: 0,
      },
      normal: {
        x: 1,
        y: 0,
      },
      relativeSpeedKmh: 1,
      impactAngleDegrees: 0,
      normalImpulseNs: 1,
      frictionImpulseNs: 0,
      totalImpulseNs: 1,
      estimatedEnergyKj: 0,
      estimatedAverageForceRangeKn: {
        minimum: 0,
        maximum: 0,
      },
      angularVelocityChangesDegPerSecond: {},
      impactResponses: [
        makeResponse({
          collisionEventId:
            "early",

          timeSeconds: 2,
        }),
      ],
    },
  ]);

assert(
  eventIndex.get(
    "participant-1",
  )?.collisionEventId ===
    "early",
  "Earliest collision response was not selected.",
);

console.log(
  "✓ 3D and AR share one canonical impact-pose solver",
);

console.log(
  "✓ Vehicles compress according to impact side and impulse direction",
);

console.log(
  "✓ Two-wheelers tip and remain fallen after landing",
);

console.log(
  "✓ Human bodies follow gravity-driven flight and retain a ground pose",
);

console.log(
  "✓ Trajectory position and heading remain authoritative",
);

console.log(
  "✓ Earliest participant response is selected deterministically",
);

console.log(
  "\nPhase 0 Step 4B impact visualization verification passed.",
);
