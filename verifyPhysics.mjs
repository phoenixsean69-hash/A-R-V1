import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDirectory);
const outputDirectory = join(projectRoot, ".physics-check");
const typescriptBin = join(
  projectRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(details || `Command failed: ${command} ${args.join(" ")}`);
  }

  return result.stdout.trim();
}

const runner = String.raw`
const assert = require("node:assert/strict");
const {
  applyPhysicsSimulation,
  DEFAULT_PHYSICS_SETTINGS,
} = require("./services/reconstructionPhysicsService.js");

const scene = {
  roadLayout: "Straight Road",
  laneCount: 2,
  roadRotation: 0,
  sceneWidthMetres: 100,
  sceneHeightMetres: 40,
  drivingSide: "Left",
  trafficControl: "None",
  speedLimitKmh: 80,
  showPavements: true,
  showLaneMarkings: true,
  showPedestrianCrossing: false,
  timeOfDay: "Day",
  weather: "Clear",
  roadSurface: "Dry",
  visibility: "Good",
  trafficVolume: "Light",
};

function point(id, x, y, timeSeconds, speedKmh, rotation, action = "Cruise") {
  return {
    id,
    label: id,
    position: { x, y },
    timeSeconds,
    speedKmh,
    rotation,
    action,
  };
}

function participant(id, name, type, pathPoints, estimatedSpeedKmh = 50) {
  const first = pathPoints[0];
  const impact =
    pathPoints.find((candidate) => candidate.action === "Impact") ??
    pathPoints[Math.floor(pathPoints.length / 2)];
  const last = pathPoints.at(-1);

  return {
    id,
    name,
    type,
    colour: "Blue",
    estimatedSpeedKmh,
    originLocation: "Route start",
    destinationLocation: "Route end",
    pathPoints,
    startPosition: first.position,
    collisionPosition: impact.position,
    finalPosition: last.position,
    startRotation: first.rotation,
    collisionRotation: impact.rotation,
    finalRotation: last.rotation,
    collisionTimeSeconds: impact.timeSeconds,
  };
}

function reconstruction(vehicles, sceneObjects = []) {
  return {
    id: "physics-verification",
    accidentId: "verification-case",
    junctionId: "",
    title: "Physics verification",
    description: "Automated deterministic collision checks.",
    durationSeconds: 3,
    vehicles,
    collisionPoint: { x: 50, y: 50 },
    scene,
    sceneObjects,
    timelineEvents: [],
    measurements: [],
    evidenceRecords: [],
    photos: [],
    fieldPlacements: [],
    fieldWalkingTracks: [],
    collisionSetup: {
      source: "Manual",
      confirmed: true,
      locked: false,
      toleranceMetres: 2.2,
      notes: "",
    },
    physicsSettings: {
      ...DEFAULT_PHYSICS_SETTINGS,
      timeStepSeconds: 0.1,
    },
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    status: "Draft",
  };
}

const left = participant(
  "left",
  "Left car",
  "Car",
  [
    point("left-start", 10, 50, 0, 144, 0, "Start"),
    point("left-authored-impact", 70, 50, 1.5, 144, 0, "Impact"),
    point("left-stop", 90, 50, 3, 0, 0, "Stop"),
  ],
  144,
);
const right = participant(
  "right",
  "Right car",
  "Car",
  [
    point("right-start", 90, 50, 0, 144, 180, "Start"),
    point("right-authored-impact", 30, 50, 1.5, 144, 180, "Impact"),
    point("right-stop", 10, 50, 3, 0, 180, "Stop"),
  ],
  144,
);
const fastResult = applyPhysicsSimulation(reconstruction([left, right]));
assert.ok(
  fastResult.lastPhysicsSimulation.participantCollisions >= 1,
  "Fast crossing participants should collide.",
);
assert.ok(
  fastResult.lastPhysicsSimulation.primaryImpactTimeSeconds < 1.5,
  "Physical participant contact should precede the authored marker.",
);

const wall = {
  id: "verification-wall",
  label: "Verification wall",
  type: "Wall",
  category: "Road Infrastructure",
  position: { x: 55, y: 50 },
  rotation: 90,
  scale: 1,
  lengthMetres: 1,
  severity: "High",
  notes: "",
  locked: false,
  visible: true,
};
const wallCar = participant(
  "wall-car",
  "Wall car",
  "Car",
  [
    point("wall-car-start", 10, 50, 0, 180, 0, "Start"),
    point("wall-car-authored-impact", 80, 50, 1.5, 180, 0, "Impact"),
    point("wall-car-stop", 95, 50, 3, 0, 0, "Stop"),
  ],
  180,
);
const wallResult = applyPhysicsSimulation(reconstruction([wallCar], [wall]));
assert.ok(
  wallResult.lastPhysicsSimulation.solidObjectImpacts >= 1,
  "A solid object crossed between frames should be detected.",
);
assert.ok(
  wallResult.lastPhysicsSimulation.primaryImpactTimeSeconds < 1.5,
  "A solid-object impact before the authored marker should take priority.",
);

const striker = participant(
  "striker",
  "Striker",
  "Car",
  [
    point("striker-start", 10, 50, 0, 100, 0, "Start"),
    point("striker-impact", 45, 50, 1.2, 100, 0, "Impact"),
    point("striker-stop", 70, 50, 3, 0, 0, "Stop"),
  ],
  100,
);
const middle = participant(
  "middle",
  "Middle car",
  "Car",
  [
    point("middle-start", 45, 50, 0, 0, 0, "Start"),
    point("middle-impact", 45, 50, 1.2, 0, 0, "Impact"),
    point("middle-stop", 45, 50, 3, 0, 0, "Stop"),
  ],
  0,
);
const pedestrian = participant(
  "pedestrian",
  "Pedestrian",
  "Pedestrian",
  [
    point("pedestrian-start", 58, 50, 0, 0, 0, "Start"),
    point("pedestrian-wait", 58, 50, 1.2, 0, 0, "Cruise"),
    point("pedestrian-stop", 58, 50, 3, 0, 0, "Stop"),
  ],
  0,
);
const secondaryResult = applyPhysicsSimulation(
  reconstruction([striker, middle, pedestrian]),
);
assert.ok(
  secondaryResult.lastPhysicsSimulation.participantCollisions >= 2,
  "The primary collision should be followed by a swept secondary collision.",
);

const glancingStriker = participant(
  "glancing-striker",
  "Glancing striker",
  "Car",
  [
    point("glancing-start", 10, 58, 0, 90, 0, "Start"),
    point("glancing-impact", 55, 58, 1.8, 90, 0, "Impact"),
    point("glancing-stop", 75, 58, 3, 0, 0, "Stop"),
  ],
  90,
);
const glancingTarget = participant(
  "glancing-target",
  "Glancing target",
  "Car",
  [
    point("target-start", 50, 50, 0, 0, 90, "Start"),
    point("target-impact", 50, 50, 1.8, 0, 90, "Impact"),
    point("target-stop", 50, 50, 3, 0, 90, "Stop"),
  ],
  0,
);
const glancingResult = applyPhysicsSimulation(
  reconstruction([glancingStriker, glancingTarget]),
);
const glancingEvent = glancingResult.lastPhysicsSimulation.collisionEvents.find(
  (event) => event.type === "Participant-Participant",
);
assert.ok(glancingEvent, "An off-centre impact should create a collision ledger event.");
assert.ok(glancingEvent.normalImpulseNs > 0, "The event should record normal impulse.");
assert.ok(
  Object.values(glancingEvent.angularVelocityChangesDegPerSecond).some(
    (value) => Math.abs(value) > 1,
  ),
  "An off-centre impact should generate angular velocity from contact-point torque.",
);
assert.equal(
  glancingResult.lastPhysicsSimulation.solverVersion,
  "RoadSafe Physics V2",
);

const parallelLeft = participant(
  "parallel-left",
  "Parallel left",
  "Car",
  [
    point("parallel-left-start", 10, 47.4, 0, 60, 0, "Start"),
    point("parallel-left-impact", 50, 47.4, 1.5, 60, 0, "Impact"),
    point("parallel-left-stop", 90, 47.4, 3, 0, 0, "Stop"),
  ],
  60,
);
const parallelRight = participant(
  "parallel-right",
  "Parallel right",
  "Car",
  [
    point("parallel-right-start", 10, 52.6, 0, 60, 0, "Start"),
    point("parallel-right-impact", 50, 52.6, 1.5, 60, 0, "Impact"),
    point("parallel-right-stop", 90, 52.6, 3, 0, 0, "Stop"),
  ],
  60,
);
const parallelResult = applyPhysicsSimulation(
  reconstruction([parallelLeft, parallelRight]),
);
assert.equal(
  parallelResult.lastPhysicsSimulation.participantCollisions,
  0,
  "Separated parallel vehicle footprints should not create a false collision.",
);

console.log(
  JSON.stringify(
    {
      fastParticipantImpactTimeSeconds:
        fastResult.lastPhysicsSimulation.primaryImpactTimeSeconds,
      fastParticipantCollisions:
        fastResult.lastPhysicsSimulation.participantCollisions,
      preImpactSolidObjectTimeSeconds:
        wallResult.lastPhysicsSimulation.primaryImpactTimeSeconds,
      solidObjectImpacts: wallResult.lastPhysicsSimulation.solidObjectImpacts,
      secondaryParticipantCollisions:
        secondaryResult.lastPhysicsSimulation.participantCollisions,
      glancingNormalImpulseNs: glancingEvent.normalImpulseNs,
      glancingAngularChanges:
        glancingEvent.angularVelocityChangesDegPerSecond,
      parallelNearMissCollisions:
        parallelResult.lastPhysicsSimulation.participantCollisions,
    },
    null,
    2,
  ),
);
`;

try {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  run(process.execPath, [
    typescriptBin,
    "--ignoreConfig",
    "src/services/reconstructionPhysicsService.ts",
    "src/utils/reconstructionGeometry.ts",
    "src/types/reconstruction.ts",
    "--outDir",
    outputDirectory,
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--moduleResolution",
    "node",
    "--ignoreDeprecations",
    "6.0",
    "--esModuleInterop",
    "--skipLibCheck",
    "--types",
    "node",
  ]);

  writeFileSync(
    join(outputDirectory, "package.json"),
    `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  );
  writeFileSync(join(outputDirectory, "run.cjs"), runner);

  const output = run(process.execPath, [join(outputDirectory, "run.cjs")]);
  const results = JSON.parse(output);

  assert.equal(typeof results.fastParticipantImpactTimeSeconds, "number");
  console.log("RoadSafe physics verification passed.");
  console.log(JSON.stringify(results, null, 2));
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
