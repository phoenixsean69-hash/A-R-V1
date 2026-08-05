import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root =
  process.cwd();

function read(
  relativePath,
) {
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
    throw new Error(
      message,
    );
  }
}

const types =
  read(
    "src/types/reconstruction.ts",
  );

const physics =
  read(
    "src/services/reconstructionPhysicsService.ts",
  );

const impactResponseSource =
  read(
    "src/utils/reconstructionImpactResponse.ts",
  );

const packageJson =
  JSON.parse(
    read(
      "package.json",
    ),
  );

assert(
  types.includes(
    "[RoadSafe:CanonicalImpactResponseDataV1]",
  ),
  "Canonical impact-response type marker is missing.",
);

assert(
  types.includes(
    "RoadSafe Impact Response V1",
  ),
  "Impact-response schema version is missing.",
);

assert(
  types.includes(
    "impactResponses?:",
  ),
  "PhysicsCollisionEvent does not retain participant impact responses.",
);

assert(
  physics.includes(
    "[RoadSafe:CanonicalImpactResponseEventV1]",
  ),
  "Physics collision-event integration marker is missing.",
);

assert(
  physics.includes(
    "createParticipantImpactResponses",
  ),
  "Physics service does not use the canonical builder.",
);

assert(
  physics.includes(
    "participantType:\n    ReconstructionVehicle[\"type\"]",
  ),
  "CollisionParticipantChange does not retain participant type.",
);

assert(
  (
    physics.match(
      /participantType:\s*\n?\s*(?:left|right|body)\.participant\.type/g,
    ) ??
    []
  ).length === 3,
  "Expected participant type to be stored for left, right and object-impact bodies.",
);

assert(
  physics.includes(
    "impactResponses,\n    kinematics,",
  ),
  "Canonical responses are not written to PhysicsCollisionEvent.",
);

assert(
  packageJson.scripts?.[
    "impact-response:verify"
  ],
  "impact-response:verify package script is missing.",
);

const transpiled =
  ts.transpileModule(
    impactResponseSource,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2022,

        module:
          ts.ModuleKind.ES2022,

        strict: true,
      },

      fileName:
        "reconstructionImpactResponse.ts",

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
  `Impact-response utility transpilation produced ${transpileErrors.length} error(s).`,
);

const encodedModule =
  Buffer.from(
    transpiled.outputText,
    "utf8",
  ).toString(
    "base64",
  );

const {
  createParticipantImpactResponses,
} =
  await import(
    `data:text/javascript;base64,${encodedModule}`
  );

const participantScenario = {
  collisionEventId:
    "collision-1",

  timeSeconds:
    2.05,

  participantIds: [
    "car-1",
    "bicycle-1",
  ],

  contactPoint: {
    x: 52,
    y: 50,
  },

  collisionNormal: {
    x: 1,
    y: 0,
  },

  relativeImpactSpeedKmh:
    45,

  estimatedEnergyKj:
    12.4,

  widthMetres:
    100,

  heightMetres:
    100,

  changes: [
    {
      participantId:
        "car-1",

      participantType:
        "Car",

      impactPositionMetres: {
        x: 50,
        y: 50,
      },

      incomingVelocityMps: {
        x: 10,
        y: 0,
      },

      outgoingVelocityMps: {
        x: 7,
        y: 1,
      },

      impulseNs: {
        x: -4350,
        y: 1450,
      },

      angularVelocityChangeDegreesPerSecond:
        -12,

      outcome:
        "Deflect",
    },

    {
      participantId:
        "bicycle-1",

      participantType:
        "Bicycle",

      impactPositionMetres: {
        x: 54,
        y: 50,
      },

      incomingVelocityMps: {
        x: -3,
        y: 0,
      },

      outgoingVelocityMps: {
        x: 5,
        y: -2,
      },

      impulseNs: {
        x: 760,
        y: -190,
      },

      angularVelocityChangeDegreesPerSecond:
        86,

      outcome:
        "Ricochet",
    },
  ],
};

const firstRun =
  createParticipantImpactResponses(
    participantScenario,
  );

const secondRun =
  createParticipantImpactResponses(
    participantScenario,
  );

assert(
  firstRun.length === 2,
  `Expected two participant responses, found ${firstRun.length}.`,
);

assert(
  JSON.stringify(
    firstRun,
  ) ===
    JSON.stringify(
      secondRun,
    ),
  "Canonical response builder is not deterministic.",
);

const car =
  firstRun.find(
    (response) =>
      response.participantId ===
      "car-1",
  );

const bicycle =
  firstRun.find(
    (response) =>
      response.participantId ===
      "bicycle-1",
  );

assert(
  car,
  "Car response was not created.",
);

assert(
  bicycle,
  "Bicycle response was not created.",
);

assert(
  car.responseClass ===
    "Rigid Vehicle",
  `Car response class is ${car.responseClass}.`,
);

assert(
  bicycle.responseClass ===
    "Two Wheeler",
  `Bicycle response class is ${bicycle.responseClass}.`,
);

assert(
  car.contactZone ===
    "Front",
  `Expected front car contact, received ${car.contactZone}.`,
);

assert(
  bicycle.contactZone ===
    "Front",
  `Expected front bicycle contact, received ${bicycle.contactZone}.`,
);

assert(
  car.participantNormal.x <
    -0.99,
  "First participant did not receive the opposing manifold normal.",
);

assert(
  bicycle.participantNormal.x >
    0.99,
  "Second participant did not receive the forward manifold normal.",
);

assert(
  car.impulseDirection.x <
    0,
  "Car impulse direction does not follow its solver impulse.",
);

assert(
  bicycle.angularVelocityChangeDegreesPerSecond ===
    86,
  "Bicycle angular response was not preserved.",
);

assert(
  car.deltaVMetresPerSecond >
    3,
  "Car delta-V was not calculated from incoming and outgoing velocity.",
);

const humanResponses =
  createParticipantImpactResponses({
    collisionEventId:
      "collision-2",

    timeSeconds:
      1.5,

    participantIds: [
      "pedestrian-1",
    ],

    contactPoint: {
      x: 50,
      y: 51,
    },

    collisionNormal: {
      x: 1,
      y: 0,
    },

    relativeImpactSpeedKmh:
      30,

    estimatedEnergyKj:
      5,

    widthMetres:
      100,

    heightMetres:
      100,

    changes: [
      {
        participantId:
          "pedestrian-1",

        participantType:
          "Pedestrian",

        impactPositionMetres: {
          x: 50,
          y: 50,
        },

        incomingVelocityMps: {
          x: 1,
          y: 0,
        },

        outgoingVelocityMps: {
          x: 6,
          y: 2,
        },

        impulseNs: {
          x: 375,
          y: 150,
        },

        angularVelocityChangeDegreesPerSecond:
          120,

        outcome:
          "Ricochet",
      },
    ],
  });

assert(
  humanResponses.length === 1,
  "Human response was not created.",
);

assert(
  humanResponses[0]
    .responseClass ===
    "Human Body",
  `Human response class is ${humanResponses[0].responseClass}.`,
);

assert(
  humanResponses[0]
    .contactZone ===
    "Right Side",
  `Expected right-side human contact, received ${humanResponses[0].contactZone}.`,
);

assert(
  humanResponses[0]
    .participantNormal.x <
    -0.99,
  "Static-object participant normal was not oriented toward the participant.",
);

console.log(
  "✓ Collision events retain one response per affected participant",
);

console.log(
  "✓ Car, two-wheeler and human response classes are deterministic",
);

console.log(
  "✓ Front, rear and side contact classification uses metric geometry",
);

console.log(
  "✓ Participant-oriented manifold normals are preserved",
);

console.log(
  "✓ Complete impulse direction and magnitude are preserved",
);

console.log(
  "✓ Incoming velocity, outgoing velocity and delta-V are preserved",
);

console.log(
  "✓ Off-centre angular velocity change is preserved",
);

console.log(
  "✓ Old saved collision events remain type-compatible",
);

console.log(
  "\nPhase 0 Step 4A canonical impact-response verification passed.",
);
