import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  physics:
    "src/services/reconstructionPhysicsService.ts",
  editor:
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  foundation:
    "src/utils/reconstructionPhysicsFoundation.ts",
  verifier:
    "scripts/verify-phase0-foundation.mjs",
  package:
    "package.json",
};

const absolute = (relativePath) =>
  path.join(root, relativePath);

function read(relativePath) {
  return fs
    .readFileSync(
      absolute(relativePath),
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function write(relativePath, content) {
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
    content.replace(/\r\n/g, "\n"),
    "utf8",
  );
}

function requireText(
  content,
  marker,
  description,
) {
  if (!content.includes(marker)) {
    throw new Error(
      `Could not find ${description}: ${marker}`,
    );
  }
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

function replaceSection(
  content,
  startMarker,
  endMarker,
  replacement,
  description,
) {
  const start =
    content.indexOf(startMarker);

  if (start < 0) {
    throw new Error(
      `Could not find start of ${description}.`,
    );
  }

  const end =
    content.indexOf(
      endMarker,
      start,
    );

  if (end < 0) {
    throw new Error(
      `Could not find end of ${description}.`,
    );
  }

  return (
    content.slice(0, start) +
    replacement.trimEnd() +
    "\n\n" +
    content.slice(end)
  );
}

const timestamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot =
  path.join(
    root,
    ".roadsafe-patch-backups",
    `phase0-foundation-${timestamp}`,
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
    files.physics,
    files.editor,
    files.package,
  ]
) {
  fs.copyFileSync(
    absolute(relativePath),
    path.join(
      backupRoot,
      path.basename(relativePath),
    ),
  );
}

const foundationSource = `import type {
  ParticipantPhysicsProfile,
  ReconstructionPhysicsSettings,
  SceneObjectPhysicsProfile,
} from "../types/reconstruction";

/*
 * [RoadSafe:PhysicsFoundationV1]
 *
 * One shared precision and profile-normalisation layer for every deterministic
 * RoadSafe physics run.
 */

export const SIMULATION_TIME_TICKS_PER_SECOND =
  10_000;

export const SIMULATION_TIME_EPSILON_SECONDS =
  1 /
  SIMULATION_TIME_TICKS_PER_SECOND;

function finiteNumber(
  value: unknown,
  fallback: number,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : fallback;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      finiteNumber(
        value,
        fallback,
      ),
    ),
  );
}

export function quantiseSimulationTime(
  value: number,
): number {
  const safe =
    Math.max(
      0,
      finiteNumber(value, 0),
    );

  return (
    Math.round(
      safe *
      SIMULATION_TIME_TICKS_PER_SECOND,
    ) /
    SIMULATION_TIME_TICKS_PER_SECOND
  );
}

export function ceilSimulationTime(
  value: number,
): number {
  const safe =
    Math.max(
      0,
      finiteNumber(value, 0),
    );

  return (
    Math.ceil(
      (
        safe -
        Number.EPSILON
      ) *
      SIMULATION_TIME_TICKS_PER_SECOND,
    ) /
    SIMULATION_TIME_TICKS_PER_SECOND
  );
}

export function normaliseParticipantPhysicsProfile(
  input: ParticipantPhysicsProfile,
): ParticipantPhysicsProfile {
  const lengthMetres =
    boundedNumber(
      input.lengthMetres,
      4.5,
      0.2,
      30,
    );

  const widthMetres =
    boundedNumber(
      input.widthMetres,
      1.8,
      0.15,
      5,
    );

  const collisionShape =
    input.collisionShape === "Circle"
      ? "Circle"
      : "Oriented Box";

  const radiusFallback =
    collisionShape === "Circle"
      ? Math.max(
          lengthMetres,
          widthMetres,
        ) / 2
      : Math.max(
          0.1,
          widthMetres / 2,
        );

  return {
    enabled:
      input.enabled !== false,

    massKg:
      boundedNumber(
        input.massKg,
        1_450,
        1,
        100_000,
      ),

    collisionRadiusMetres:
      boundedNumber(
        input.collisionRadiusMetres,
        radiusFallback,
        0.05,
        15,
      ),

    restitution:
      boundedNumber(
        input.restitution,
        0.1,
        0,
        1,
      ),

    rollingFriction:
      boundedNumber(
        input.rollingFriction,
        1,
        0.05,
        3,
      ),

    lateralGrip:
      boundedNumber(
        input.lateralGrip,
        0.8,
        0,
        2,
      ),

    brakingDecelerationMps2:
      boundedNumber(
        input.brakingDecelerationMps2,
        7,
        0.1,
        18,
      ),

    collisionShape,
    lengthMetres,
    widthMetres,

    collisionFriction:
      boundedNumber(
        input.collisionFriction,
        0.65,
        0,
        2,
      ),

    momentOfInertiaScale:
      boundedNumber(
        input.momentOfInertiaScale,
        1,
        0.05,
        5,
      ),
  };
}

export function normaliseSceneObjectPhysicsProfile(
  input: SceneObjectPhysicsProfile,
): SceneObjectPhysicsProfile {
  const lengthMetres =
    boundedNumber(
      input.lengthMetres,
      1,
      0.05,
      200,
    );

  const widthMetres =
    boundedNumber(
      input.widthMetres,
      1,
      0.05,
      100,
    );

  const collisionShape =
    input.collisionShape ===
    "Oriented Box"
      ? "Oriented Box"
      : "Circle";

  return {
    enabled:
      input.enabled !== false,

    collidable:
      Boolean(input.collidable),

    collisionRadiusMetres:
      boundedNumber(
        input.collisionRadiusMetres,
        Math.max(
          0.05,
          Math.min(
            lengthMetres,
            widthMetres,
          ) / 2,
        ),
        0.05,
        50,
      ),

    restitution:
      boundedNumber(
        input.restitution,
        0.05,
        0,
        1,
      ),

    surfaceFrictionMultiplier:
      boundedNumber(
        input.surfaceFrictionMultiplier,
        1,
        0.05,
        3,
      ),

    speedLossFactor:
      boundedNumber(
        input.speedLossFactor,
        0.8,
        0,
        1,
      ),

    deflectionDegrees:
      boundedNumber(
        input.deflectionDegrees,
        0,
        -45,
        45,
      ),

    collisionShape,
    lengthMetres,
    widthMetres,

    collisionFriction:
      boundedNumber(
        input.collisionFriction,
        0.65,
        0,
        2,
      ),
  };
}

export function normaliseReconstructionPhysicsSettings(
  input: ReconstructionPhysicsSettings,
): ReconstructionPhysicsSettings {
  const contactDurationMinimumMs =
    boundedNumber(
      input.contactDurationMinimumMs,
      80,
      10,
      1_000,
    );

  const contactDurationMaximumMs =
    Math.max(
      contactDurationMinimumMs,
      boundedNumber(
        input.contactDurationMaximumMs,
        150,
        10,
        2_000,
      ),
    );

  return {
    enabled:
      input.enabled !== false,

    mode:
      input.mode === "Guided Paths"
        ? "Guided Paths"
        : "Physics After Primary Impact",

    autoRunOnPlay:
      input.autoRunOnPlay !== false,

    liveSimulation:
      Boolean(input.liveSimulation),

    timeStepSeconds:
      boundedNumber(
        input.timeStepSeconds,
        0.05,
        1 / 240,
        0.1,
      ),

    collisionToleranceMetres:
      boundedNumber(
        input.collisionToleranceMetres,
        0.18,
        0,
        0.35,
      ),

    globalFrictionMultiplier:
      boundedNumber(
        input.globalFrictionMultiplier,
        1,
        0.05,
        3,
      ),

    airDrag:
      boundedNumber(
        input.airDrag,
        0.015,
        0,
        0.5,
      ),

    stopSpeedKmh:
      boundedNumber(
        input.stopSpeedKmh,
        2,
        0.05,
        8,
      ),

    showVelocityVectors:
      input.showVelocityVectors !== false,

    showImpactEffects:
      input.showImpactEffects !== false,

    replacePostImpactPath:
      input.replacePostImpactPath !== false,

    contactDurationMinimumMs,
    contactDurationMaximumMs,
  };
}
`;

write(
  files.foundation,
  foundationSource,
);

let physics =
  read(files.physics);

if (
  !physics.includes(
    "[RoadSafe:PhysicsFoundationImportV1]",
  )
) {
  physics =
`/*
 * [RoadSafe:PhysicsFoundationImportV1]
 */
import {
  ceilSimulationTime,
  normaliseParticipantPhysicsProfile,
  normaliseReconstructionPhysicsSettings,
  normaliseSceneObjectPhysicsProfile,
  quantiseSimulationTime,
} from "../utils/reconstructionPhysicsFoundation";

${physics}`;
}

physics =
  replaceSection(
    physics,
    "function resolveParticipantPhysicsProfile(",
    "function resolveSceneObjectPhysicsProfile(",
`function resolveParticipantPhysicsProfile(
  participant: ReconstructionVehicle,
): ResolvedParticipantPhysicsProfile {
  return normaliseParticipantPhysicsProfile({
    ...getDefaultParticipantPhysics(
      participant,
    ),
    ...(participant.physics ?? {}),
  }) as ResolvedParticipantPhysicsProfile;
}`,
    "participant physics profile resolver",
  );

physics =
  replaceSection(
    physics,
    "function resolveSceneObjectPhysicsProfile(",
    "function participantDimensions(",
`function resolveSceneObjectPhysicsProfile(
  object: ReconstructionSceneObject,
): ResolvedSceneObjectPhysicsProfile {
  return normaliseSceneObjectPhysicsProfile({
    ...getDefaultSceneObjectPhysics(
      object,
    ),
    ...(object.physics ?? {}),
  }) as ResolvedSceneObjectPhysicsProfile;
}`,
    "scene-object physics profile resolver",
  );

if (
  !physics.includes(
    "[RoadSafe:CleanPhysicsInputV1]",
  )
) {
  const preparationMarker =
    "export function preparePhysicsForPlayback(";

  requireText(
    physics,
    preparationMarker,
    "preparePhysicsForPlayback",
  );

  const cleanSourceFunction = `
/*
 * [RoadSafe:CleanPhysicsInputV1]
 *
 * Every new simulation starts from investigator-authored movement only.
 * Generated samples from a previous simulation may never become inputs to a
 * later simulation.
 */
function createCleanPhysicsInput(
  source: AccidentReconstruction,
): AccidentReconstruction {
  const vehicles =
    source.vehicles.map(
      (participant) => {
        const authoredPathPoints =
          sortMovementPathPoints(
            participant.pathPoints,
          ).filter(
            (point) =>
              !isPhysicsGeneratedPathPoint(
                point,
              ),
          );

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints:
            authoredPathPoints,
        });
      },
    );

  return {
    ...source,
    vehicles,
    lastPhysicsSimulation:
      undefined,
    timelineEvents:
      source.timelineEvents.filter(
        (event) =>
          !event.id.startsWith(
            "physics-event",
          ),
      ),
  };
}

`;

  physics =
    physics.replace(
      preparationMarker,
      cleanSourceFunction +
      preparationMarker,
    );
}

const applySignature =
  /export function applyPhysicsSimulation\(\s*source: AccidentReconstruction,\s*\): AccidentReconstruction \{/;

if (
  applySignature.test(physics)
) {
  physics =
    physics.replace(
      applySignature,
`export function applyPhysicsSimulation(
  inputSource: AccidentReconstruction,
): AccidentReconstruction {
  const source =
    createCleanPhysicsInput(
      inputSource,
    );`,
    );
}
else if (
  !physics.includes(
    "inputSource: AccidentReconstruction",
  )
) {
  throw new Error(
    "Could not patch applyPhysicsSimulation input.",
  );
}

physics =
  physics.replace(
    /const settings = \{ \.\.\.DEFAULT_PHYSICS_SETTINGS, \.\.\.\(source\.physicsSettings \?\? \{\}\) \};/g,
`const settings =
    normaliseReconstructionPhysicsSettings({
      ...DEFAULT_PHYSICS_SETTINGS,
      ...(source.physicsSettings ?? {}),
    });`,
  );

const makePhysicsPointStart =
  physics.indexOf(
    "function makePhysicsPoint(",
  );

const angularVelocityStart =
  physics.indexOf(
    "function maximumAngularVelocityDegreesPerSecond(",
    makePhysicsPointStart,
  );

if (
  makePhysicsPointStart < 0 ||
  angularVelocityStart < 0
) {
  throw new Error(
    "Could not locate makePhysicsPoint.",
  );
}

let makePhysicsPointSection =
  physics.slice(
    makePhysicsPointStart,
    angularVelocityStart,
  );

if (
  !makePhysicsPointSection.includes(
    "timeSeconds: quantiseSimulationTime(timeSeconds)",
  )
) {
  makePhysicsPointSection =
    replaceOnce(
      makePhysicsPointSection,
      "    timeSeconds,\n",
      "    timeSeconds: quantiseSimulationTime(timeSeconds),\n",
      "physics point time precision",
    );

  physics =
    physics.slice(
      0,
      makePhysicsPointStart,
    ) +
    makePhysicsPointSection +
    physics.slice(
      angularVelocityStart,
    );
}

physics =
  physics.replace(
    /timeSeconds:\s*Number\(\s*timeSeconds\.toFixed\(4\),\s*\),/g,
    "timeSeconds: quantiseSimulationTime(timeSeconds),",
  );

const collisionEventStart =
  physics.indexOf(
    "function createPhysicsCollisionEvent(",
  );

const physicsPointStart =
  physics.indexOf(
    "function makePhysicsPoint(",
    collisionEventStart,
  );

if (
  collisionEventStart >= 0 &&
  physicsPointStart > collisionEventStart
) {
  let collisionEventSection =
    physics.slice(
      collisionEventStart,
      physicsPointStart,
    );

  collisionEventSection =
    collisionEventSection.replace(
      "    timeSeconds: input.timeSeconds,\n",
      "    timeSeconds: quantiseSimulationTime(input.timeSeconds),\n",
    );

  physics =
    physics.slice(
      0,
      collisionEventStart,
    ) +
    collisionEventSection +
    physics.slice(
      physicsPointStart,
    );
}

physics =
  physics.replace(
    /simulatedDurationSeconds:\s*Number\(simulatedDurationSeconds\.toFixed\(2\)\),/g,
    "simulatedDurationSeconds: ceilSimulationTime(simulatedDurationSeconds),",
  );

physics =
  physics.replace(
    /durationSeconds:\s*Number\(\s*Math\.max\(source\.durationSeconds,\s*simulatedDurationSeconds\)\.toFixed\(2\),\s*\),/g,
`durationSeconds:
      ceilSimulationTime(
        Math.max(
          source.durationSeconds,
          simulatedDurationSeconds,
        ),
      ),`,
  );

if (
  !physics.includes(
    "createCleanPhysicsInput",
  )
) {
  throw new Error(
    "Clean simulation input was not installed.",
  );
}

if (
  !physics.includes(
    "ceilSimulationTime(",
  )
) {
  throw new Error(
    "Upward duration rounding was not installed.",
  );
}

write(
  files.physics,
  physics,
);

let editor =
  read(files.editor);

const strictDurationPattern =
  /point\.timeSeconds\s*>\s*reconstruction\.durationSeconds(?!\s*\+\s*0\.0001)/g;

const durationMatches =
  editor.match(
    strictDurationPattern,
  ) ?? [];

if (
  durationMatches.length > 0
) {
  editor =
    editor.replace(
      strictDurationPattern,
`point.timeSeconds >
          reconstruction.durationSeconds +
            0.0001`,
    );
}

if (
  !editor.includes(
    "reconstruction.durationSeconds +\n            0.0001",
  ) &&
  !editor.includes(
    "reconstruction.durationSeconds + 0.0001",
  )
) {
  throw new Error(
    "Could not install Save time tolerance.",
  );
}

write(
  files.editor,
  editor,
);

const verifierSource = `import fs from "node:fs";

const checks = [
  {
    file:
      "src/utils/reconstructionPhysicsFoundation.ts",
    marker:
      "[RoadSafe:PhysicsFoundationV1]",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "[RoadSafe:CleanPhysicsInputV1]",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "normaliseParticipantPhysicsProfile",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "ceilSimulationTime(",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "quantiseSimulationTime(timeSeconds)",
  },
  {
    file:
      "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    marker:
      "reconstruction.durationSeconds +",
  },
];

let failed = false;

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(
      "MISSING FILE:",
      check.file,
    );

    failed = true;
    continue;
  }

  const content =
    fs.readFileSync(
      check.file,
      "utf8",
    );

  if (!content.includes(check.marker)) {
    console.error(
      "MISSING MARKER:",
      check.file,
      check.marker,
    );

    failed = true;
  }
  else {
    console.log(
      "OK:",
      check.file,
      "→",
      check.marker,
    );
  }
}

const editor =
  fs.readFileSync(
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    "utf8",
  );

if (
  /point\\.timeSeconds\\s*>\\s*reconstruction\\.durationSeconds(?!\\s*\\+)/.test(
    editor,
  )
) {
  console.error(
    "STRICT DURATION CHECK STILL EXISTS.",
  );

  failed = true;
}

const physics =
  fs.readFileSync(
    "src/services/reconstructionPhysicsService.ts",
    "utf8",
  );

if (
  /Math\\.max\\(source\\.durationSeconds,\\s*simulatedDurationSeconds\\)\\.toFixed\\(2\\)/.test(
    physics,
  )
) {
  console.error(
    "OLD DOWNWARD DURATION ROUNDING STILL EXISTS.",
  );

  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  "\\nPhase 0 foundation verification passed.",
);
`;

write(
  files.verifier,
  verifierSource,
);

const packageJson =
  JSON.parse(
    fs.readFileSync(
      absolute(files.package),
      "utf8",
    ),
  );

packageJson.scripts = {
  ...packageJson.scripts,
  "physics:verify":
    "node scripts/verify-phase0-foundation.mjs && npm run build",
};

write(
  files.package,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) + "\n",
);

console.log(
  "\nPhase 0 foundation patch applied.",
);

console.log(
  "Backup:",
  backupRoot,
);

console.log(
  "\nChanged files:",
);

console.log(
  [
    files.foundation,
    files.physics,
    files.editor,
    files.verifier,
    files.package,
  ].join("\n"),
);
