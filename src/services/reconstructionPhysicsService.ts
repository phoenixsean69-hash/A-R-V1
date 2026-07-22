import type {
  AccidentReconstruction,
  MovementPathPoint,
  ParticipantPhysicsProfile,
  PhysicsSimulationSummary,
  ReconstructionPhysicsSettings,
  ReconstructionPosition,
  ReconstructionSceneObject,
  ReconstructionVehicle,
  SceneObjectPhysicsProfile,
} from "../types/reconstruction";

import {
  clamp,
  getParticipantStateAtTime,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "../utils/reconstructionGeometry";

interface Vector2 {
  x: number;
  y: number;
}

interface SimulationBody {
  participant: ReconstructionVehicle;
  profile: ParticipantPhysicsProfile;
  impactPoint: MovementPathPoint;
  position: Vector2;
  velocity: Vector2;
  incomingVelocity: Vector2;
  rotation: number;
  angularVelocityDegreesPerSecond: number;
  timeSeconds: number;
  points: MovementPathPoint[];
  primaryResponseAction?: "Deflect" | "Ricochet";
  primaryResponseLabel?: string;
  stopped: boolean;
  collidedWithParticipants: Set<string>;
  collidedWithObjects: Set<string>;
}

interface ParticipantCollisionResult {
  collided: boolean;
  impactEnergyKj: number;
}

interface DetectedParticipantContact {
  timeSeconds: number;
  leftId: string;
  rightId: string;
  leftPosition: Vector2;
  rightPosition: Vector2;
  contactPosition: Vector2;
}

function closestApproachOnStep(
  leftStart: Vector2,
  leftEnd: Vector2,
  rightStart: Vector2,
  rightEnd: Vector2,
): { alpha: number; distance: number } {
  const relativeStart = {
    x: rightStart.x - leftStart.x,
    y: rightStart.y - leftStart.y,
  };
  const relativeDelta = {
    x: (rightEnd.x - rightStart.x) - (leftEnd.x - leftStart.x),
    y: (rightEnd.y - rightStart.y) - (leftEnd.y - leftStart.y),
  };
  const denominator = dot(relativeDelta, relativeDelta);
  const alpha = denominator < 0.000001
    ? 0
    : clamp(-dot(relativeStart, relativeDelta) / denominator, 0, 1);
  const separation = {
    x: relativeStart.x + relativeDelta.x * alpha,
    y: relativeStart.y + relativeDelta.y * alpha,
  };
  return { alpha, distance: magnitude(separation) };
}

function participantWorldPositionAtTime(
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
): Vector2 {
  return worldPosition(
    getParticipantStateAtTime(participant, timeSeconds).position,
    width,
    height,
  );
}

function participantVelocityAtTime(
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
  sampleSeconds: number,
): Vector2 {
  const beforeTime = Math.max(0, timeSeconds - sampleSeconds);
  const afterTime = Math.min(
    Math.max(timeSeconds + sampleSeconds, beforeTime + 0.001),
    Math.max(timeSeconds + sampleSeconds, participant.pathPoints.at(-1)?.timeSeconds ?? timeSeconds + sampleSeconds),
  );
  const before = participantWorldPositionAtTime(participant, beforeTime, width, height);
  const after = participantWorldPositionAtTime(participant, afterTime, width, height);
  const elapsed = Math.max(0.001, afterTime - beforeTime);
  const sampled = {
    x: (after.x - before.x) / elapsed,
    y: (after.y - before.y) / elapsed,
  };
  if (magnitude(sampled) > 0.05) return sampled;

  const state = getParticipantStateAtTime(participant, timeSeconds);
  const speed = kmhToMps(state.speedKmh || participant.estimatedSpeedKmh);
  return {
    x: Math.cos((state.rotation * Math.PI) / 180) * speed,
    y: Math.sin((state.rotation * Math.PI) / 180) * speed,
  };
}

function detectEarliestParticipantContact(
  participants: ReconstructionVehicle[],
  settings: ReconstructionPhysicsSettings,
  width: number,
  height: number,
  durationSeconds: number,
): DetectedParticipantContact | null {
  if (participants.length < 2) return null;

  const profiles = new Map(
    participants.map((participant) => [
      participant.id,
      { ...getDefaultParticipantPhysics(participant), ...(participant.physics ?? {}) },
    ]),
  );
  const step = clamp(Math.min(settings.timeStepSeconds, 0.08), 0.02, 0.08);
  let earliest: DetectedParticipantContact | null = null;

  for (let time = 0; time < durationSeconds - 0.0001; time += step) {
    const nextTime = Math.min(durationSeconds, time + step);
    for (let leftIndex = 0; leftIndex < participants.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < participants.length; rightIndex += 1) {
        const left = participants[leftIndex];
        const right = participants[rightIndex];
        const leftProfile = profiles.get(left.id)!;
        const rightProfile = profiles.get(right.id)!;
        const collisionDistance =
          leftProfile.collisionRadiusMetres +
          rightProfile.collisionRadiusMetres +
          Math.max(0, settings.collisionToleranceMetres);
        const leftStart = participantWorldPositionAtTime(left, time, width, height);
        const leftEnd = participantWorldPositionAtTime(left, nextTime, width, height);
        const rightStart = participantWorldPositionAtTime(right, time, width, height);
        const rightEnd = participantWorldPositionAtTime(right, nextTime, width, height);
        const approach = closestApproachOnStep(leftStart, leftEnd, rightStart, rightEnd);
        if (approach.distance > collisionDistance) continue;

        const contactTime = time + (nextTime - time) * approach.alpha;
        const leftPosition = {
          x: leftStart.x + (leftEnd.x - leftStart.x) * approach.alpha,
          y: leftStart.y + (leftEnd.y - leftStart.y) * approach.alpha,
        };
        const rightPosition = {
          x: rightStart.x + (rightEnd.x - rightStart.x) * approach.alpha,
          y: rightStart.y + (rightEnd.y - rightStart.y) * approach.alpha,
        };
        const candidate: DetectedParticipantContact = {
          timeSeconds: contactTime,
          leftId: left.id,
          rightId: right.id,
          leftPosition,
          rightPosition,
          contactPosition: {
            x: (leftPosition.x + rightPosition.x) / 2,
            y: (leftPosition.y + rightPosition.y) / 2,
          },
        };
        if (!earliest || candidate.timeSeconds < earliest.timeSeconds) earliest = candidate;
      }
    }
    if (earliest && earliest.timeSeconds <= nextTime + 0.0001) return earliest;
  }

  return earliest;
}

export const DEFAULT_PHYSICS_SETTINGS: ReconstructionPhysicsSettings = {
  enabled: true,
  mode: "Physics After Primary Impact",
  autoRunOnPlay: true,
  liveSimulation: false,
  timeStepSeconds: 0.1,
  collisionToleranceMetres: 2.2,
  globalFrictionMultiplier: 1,
  airDrag: 0.015,
  stopSpeedKmh: 2,
  showVelocityVectors: true,
  showImpactEffects: true,
  replacePostImpactPath: true,
};

const SOLID_OBJECT_TYPES = new Set([
  "Road Barrier",
  "Guardrail",
  "Wall",
  "Fence",
  "Traffic Light",
  "Street Light",
  "Tree",
  "Parked Vehicle",
  "Bus Stop",
  "Stop Sign",
  "Give Way Sign",
  "Speed Limit Sign",
]);

const LOW_GRIP_OBJECT_TYPES = new Set([
  "Oil Spill",
  "Loose Gravel",
  "Puddle",
]);

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function magnitude(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

function normalise(vector: Vector2): Vector2 {
  const length = magnitude(vector);
  if (length < 0.0001) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function dot(left: Vector2, right: Vector2): number {
  return left.x * right.x + left.y * right.y;
}

function cross(left: Vector2, right: Vector2): number {
  return left.x * right.y - left.y * right.x;
}

function angleDifferenceDegrees(from: Vector2, to: Vector2): number {
  if (magnitude(from) < 0.001 || magnitude(to) < 0.001) return 0;
  const start = Math.atan2(from.y, from.x);
  const end = Math.atan2(to.y, to.x);
  return ((((end - start) * 180) / Math.PI + 540) % 360) - 180;
}

function blendRotation(
  current: number,
  target: number,
  amount: number,
): number {
  const difference = ((target - current + 540) % 360) - 180;
  return current + difference * clamp(amount, 0, 1);
}

function rotate(vector: Vector2, degrees: number): Vector2 {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  };
}

function reflect(vector: Vector2, normal: Vector2): Vector2 {
  const factor = 2 * dot(vector, normal);
  return {
    x: vector.x - factor * normal.x,
    y: vector.y - factor * normal.y,
  };
}

function deterministicSign(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash % 2 === 0 ? 1 : -1;
}

function kmhToMps(speedKmh: number): number {
  return Math.max(0, speedKmh) / 3.6;
}

function mpsToKmh(speedMps: number): number {
  return Math.max(0, speedMps) * 3.6;
}

function worldPosition(
  position: ReconstructionPosition,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): Vector2 {
  return {
    x: (position.x / 100) * sceneWidthMetres,
    y: (position.y / 100) * sceneHeightMetres,
  };
}

function scenePosition(
  position: Vector2,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): ReconstructionPosition {
  return {
    x: clamp((position.x / sceneWidthMetres) * 100, 0, 100),
    y: clamp((position.y / sceneHeightMetres) * 100, 0, 100),
  };
}

function rotationFromVelocity(velocity: Vector2, fallback: number): number {
  if (magnitude(velocity) < 0.05) return fallback;
  return (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
}

function getImpactPoint(participant: ReconstructionVehicle): MovementPathPoint {
  const points = sortMovementPathPoints(participant.pathPoints);
  if (points.length === 0) {
    return {
      id: createId("legacy-impact"),
      label: "Primary collision",
      position: participant.collisionPosition,
      timeSeconds: participant.collisionTimeSeconds,
      speedKmh: participant.estimatedSpeedKmh,
      rotation: participant.collisionRotation,
      action: "Impact",
    };
  }
  return (
    points.find((point) => point.action === "Impact") ??
    points.reduce((closest, point) =>
      Math.abs(point.timeSeconds - participant.collisionTimeSeconds) <
      Math.abs(closest.timeSeconds - participant.collisionTimeSeconds)
        ? point
        : closest,
    )
  );
}

function surfaceFriction(reconstruction: AccidentReconstruction): number {
  const surface = reconstruction.scene.roadSurface;
  const weather = reconstruction.scene.weather;

  let coefficient = surface === "Wet" ? 0.52 : surface === "Damaged" ? 0.62 : 0.78;
  if (weather === "Rain") coefficient *= 0.82;
  if (weather === "Dust") coefficient *= 0.9;
  return coefficient;
}

export function getDefaultParticipantPhysics(
  participant: Pick<ReconstructionVehicle, "type">,
): ParticipantPhysicsProfile {
  switch (participant.type) {
    case "Bus":
      return {
        enabled: true,
        massKg: 12000,
        collisionRadiusMetres: 2.4,
        restitution: 0.12,
        rollingFriction: 1,
        lateralGrip: 0.72,
        brakingDecelerationMps2: 5.2,
      };
    case "Truck":
      return {
        enabled: true,
        massKg: 9000,
        collisionRadiusMetres: 2.2,
        restitution: 0.1,
        rollingFriction: 1.05,
        lateralGrip: 0.68,
        brakingDecelerationMps2: 5,
      };
    case "Motorcycle":
      return {
        enabled: true,
        massKg: 240,
        collisionRadiusMetres: 0.85,
        restitution: 0.28,
        rollingFriction: 0.75,
        lateralGrip: 0.9,
        brakingDecelerationMps2: 7,
      };
    case "Bicycle":
      return {
        enabled: true,
        massKg: 95,
        collisionRadiusMetres: 0.65,
        restitution: 0.22,
        rollingFriction: 0.6,
        lateralGrip: 0.82,
        brakingDecelerationMps2: 4.5,
      };
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return {
        enabled: true,
        massKg: 75,
        collisionRadiusMetres: 0.45,
        restitution: 0.08,
        rollingFriction: 1.45,
        lateralGrip: 0.45,
        brakingDecelerationMps2: 3.8,
      };
    case "Car":
    default:
      return {
        enabled: true,
        massKg: 1450,
        collisionRadiusMetres: 1.45,
        restitution: 0.18,
        rollingFriction: 0.92,
        lateralGrip: 0.82,
        brakingDecelerationMps2: 7.2,
      };
  }
}

export function getDefaultSceneObjectPhysics(
  object: Pick<ReconstructionSceneObject, "type" | "severity" | "scale" | "lengthMetres">,
): SceneObjectPhysicsProfile {
  if (object.type === "Pothole") {
    const severityFactor =
      object.severity === "Critical" ? 0.55 :
      object.severity === "High" ? 0.66 :
      object.severity === "Medium" ? 0.76 : 0.86;
    return {
      enabled: true,
      collidable: false,
      collisionRadiusMetres: Math.max(0.6, object.scale * 0.9),
      restitution: 0,
      surfaceFrictionMultiplier: 1.25,
      speedLossFactor: severityFactor,
      deflectionDegrees: object.severity === "Critical" ? 18 : object.severity === "High" ? 12 : 7,
    };
  }

  if (LOW_GRIP_OBJECT_TYPES.has(object.type)) {
    return {
      enabled: true,
      collidable: false,
      collisionRadiusMetres: Math.max(0.8, object.scale * 1.3),
      restitution: 0,
      surfaceFrictionMultiplier: object.type === "Oil Spill" ? 0.28 : 0.58,
      speedLossFactor: 0.96,
      deflectionDegrees: object.type === "Loose Gravel" ? 5 : 2,
    };
  }

  const solid = SOLID_OBJECT_TYPES.has(object.type);
  return {
    enabled: solid,
    collidable: solid,
    collisionRadiusMetres: Math.max(
      0.45,
      object.type === "Wall" || object.type === "Guardrail" || object.type === "Road Barrier"
        ? Math.max(1.2, Number(object.lengthMetres ?? 2) / 2)
        : object.type === "Parked Vehicle"
          ? 1.6
          : object.scale * 0.7,
    ),
    restitution: object.type === "Road Barrier" || object.type === "Guardrail" ? 0.25 : 0.12,
    surfaceFrictionMultiplier: 1,
    speedLossFactor: object.type === "Tree" || object.type === "Street Light" ? 0.28 : 0.5,
    deflectionDegrees: 0,
  };
}

export function derivePrimaryCollisionPoint(
  reconstruction: AccidentReconstruction,
): ReconstructionPosition | null {
  const impactPoints = reconstruction.vehicles
    .flatMap((participant) => participant.pathPoints)
    .filter((point) => point.action === "Impact")
    .map((point) => point.position);

  if (impactPoints.length === 0) return null;

  return {
    x: impactPoints.reduce((sum, point) => sum + point.x, 0) / impactPoints.length,
    y: impactPoints.reduce((sum, point) => sum + point.y, 0) / impactPoints.length,
  };
}

function resolveParticipantCollision(
  left: SimulationBody,
  right: SimulationBody,
): ParticipantCollisionResult {
  const delta = {
    x: right.position.x - left.position.x,
    y: right.position.y - left.position.y,
  };
  let normal = normalise(
    magnitude(delta) > 0.05
      ? delta
      : { x: left.velocity.x - right.velocity.x, y: left.velocity.y - right.velocity.y },
  );
  const relativeVelocity = {
    x: right.velocity.x - left.velocity.x,
    y: right.velocity.y - left.velocity.y,
  };
  let velocityAlongNormal = dot(relativeVelocity, normal);

  if (velocityAlongNormal > 0 && magnitude(delta) <= 0.05) {
    normal = { x: -normal.x, y: -normal.y };
    velocityAlongNormal = dot(relativeVelocity, normal);
  }

  if (velocityAlongNormal >= -0.05) {
    return { collided: false, impactEnergyKj: 0 };
  }

  const restitution = Math.min(left.profile.restitution, right.profile.restitution);
  const reducedMass =
    (left.profile.massKg * right.profile.massKg) /
    (left.profile.massKg + right.profile.massKg);
  const impactEnergyKj =
    (0.5 * reducedMass * velocityAlongNormal * velocityAlongNormal *
      (1 - restitution * restitution)) /
    1000;
  const impulseMagnitude =
    (-(1 + restitution) * velocityAlongNormal) /
    (1 / left.profile.massKg + 1 / right.profile.massKg);
  const impulse = { x: normal.x * impulseMagnitude, y: normal.y * impulseMagnitude };

  left.velocity = {
    x: left.velocity.x - impulse.x / left.profile.massKg,
    y: left.velocity.y - impulse.y / left.profile.massKg,
  };
  right.velocity = {
    x: right.velocity.x + impulse.x / right.profile.massKg,
    y: right.velocity.y + impulse.y / right.profile.massKg,
  };

  const relativeSpeed = magnitude(relativeVelocity);
  const approachCross = cross(
    normalise(left.incomingVelocity),
    normalise(right.incomingVelocity),
  );
  const yawDirection =
    Math.abs(approachCross) > 0.08
      ? Math.sign(approachCross)
      : deterministicSign(`${left.participant.id}:${right.participant.id}`);
  const yawMagnitude = clamp(28 + relativeSpeed * 6.5, 28, 150);
  left.angularVelocityDegreesPerSecond =
    yawDirection * yawMagnitude *
    (right.profile.massKg / (left.profile.massKg + right.profile.massKg));
  right.angularVelocityDegreesPerSecond =
    -yawDirection * yawMagnitude *
    (left.profile.massKg / (left.profile.massKg + right.profile.massKg));

  const leftDeflection = Math.abs(
    angleDifferenceDegrees(left.incomingVelocity, left.velocity),
  );
  const rightDeflection = Math.abs(
    angleDifferenceDegrees(right.incomingVelocity, right.velocity),
  );
  left.primaryResponseAction = leftDeflection >= 24 ? "Ricochet" : "Deflect";
  right.primaryResponseAction = rightDeflection >= 24 ? "Ricochet" : "Deflect";
  left.primaryResponseLabel = `${left.primaryResponseAction} after impact with ${right.participant.name}`;
  right.primaryResponseLabel = `${right.primaryResponseAction} after impact with ${left.participant.name}`;

  return { collided: true, impactEnergyKj };
}

function makePhysicsPoint(
  body: SimulationBody,
  timeSeconds: number,
  position: ReconstructionPosition,
  action: MovementPathPoint["action"],
  label: string,
  linkedSceneObjectId?: string,
): MovementPathPoint {
  return {
    id: createId("physics-point"),
    label,
    position,
    timeSeconds,
    speedKmh: Number(mpsToKmh(magnitude(body.velocity)).toFixed(1)),
    rotation: Number(body.rotation.toFixed(1)),
    action,
    linkedSceneObjectId,
    notes: "Generated by the RoadSafe deterministic 2D physics preview.",
  };
}

export function applyPhysicsSimulation(
  source: AccidentReconstruction,
): AccidentReconstruction {
  const settings = { ...DEFAULT_PHYSICS_SETTINGS, ...(source.physicsSettings ?? {}) };
  if (!settings.enabled || settings.mode === "Guided Paths") {
    return {
      ...source,
      physicsSettings: settings,
      lastPhysicsSimulation: {
        ranAt: new Date().toISOString(),
        participantCollisions: 0,
        primaryImpactTimeSeconds: source.durationSeconds / 2,
        estimatedImpactEnergyKj: 0,
        solidObjectImpacts: 0,
        potholeInteractions: 0,
        surfaceInteractions: 0,
        generatedPathPoints: 0,
        simulatedDurationSeconds: source.durationSeconds,
        warnings: ["Physics was not applied because Guided Paths mode is selected."],
      },
    };
  }

  const width = Math.max(1, source.scene.sceneWidthMetres);
  const height = Math.max(1, source.scene.sceneHeightMetres);
  const participants = source.vehicles.filter((participant) => participant.physics?.enabled ?? true);
  const warnings: string[] = [];

  if (participants.length === 0) {
    warnings.push("No physics-enabled participants were available.");
  }

  const detectedContact = detectEarliestParticipantContact(
    participants,
    settings,
    width,
    height,
    source.durationSeconds,
  );
  const authoredImpactTimes = participants
    .map((participant) => getImpactPoint(participant).timeSeconds)
    .sort((left, right) => left - right);
  const impactTime = detectedContact?.timeSeconds ??
    (authoredImpactTimes.length
      ? authoredImpactTimes[Math.floor(authoredImpactTimes.length / 2)]
      : source.durationSeconds / 2);
  const detectedCollisionPoint = detectedContact
    ? scenePosition(detectedContact.contactPosition, width, height)
    : { ...source.collisionPoint };

  const bodies: SimulationBody[] = participants.map((participant) => {
    const profile = {
      ...getDefaultParticipantPhysics(participant),
      ...(participant.physics ?? {}),
    };
    const authoredImpact = getImpactPoint(participant);
    const state = getParticipantStateAtTime(participant, impactTime);
    const position = participantWorldPositionAtTime(
      participant,
      impactTime,
      width,
      height,
    );
    const incomingVelocity = participantVelocityAtTime(
      participant,
      impactTime,
      width,
      height,
      Math.max(0.03, Math.min(0.12, settings.timeStepSeconds)),
    );
    return {
      participant,
      profile,
      impactPoint: {
        ...authoredImpact,
        position: scenePosition(position, width, height),
        timeSeconds: impactTime,
        speedKmh: state.speedKmh,
        rotation: state.rotation,
      },
      position,
      velocity: { ...incomingVelocity },
      incomingVelocity: { ...incomingVelocity },
      rotation: rotationFromVelocity(incomingVelocity, state.rotation),
      angularVelocityDegreesPerSecond: 0,
      timeSeconds: impactTime,
      points: [],
      stopped: false,
      collidedWithParticipants: new Set<string>(),
      collidedWithObjects: new Set<string>(),
    };
  });

  let participantCollisions = 0;
  let estimatedImpactEnergyKj = 0;
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex += 1) {
      const left = bodies[leftIndex];
      const right = bodies[rightIndex];
      const isDetectedPair = detectedContact &&
        ((left.participant.id === detectedContact.leftId &&
          right.participant.id === detectedContact.rightId) ||
          (left.participant.id === detectedContact.rightId &&
            right.participant.id === detectedContact.leftId));
      const distance = magnitude({
        x: right.position.x - left.position.x,
        y: right.position.y - left.position.y,
      });
      const collisionDistance =
        left.profile.collisionRadiusMetres +
        right.profile.collisionRadiusMetres +
        Math.max(0, settings.collisionToleranceMetres);
      if (!isDetectedPair && distance > collisionDistance) continue;

      const result = resolveParticipantCollision(left, right);
      if (result.collided) {
        participantCollisions += 1;
        estimatedImpactEnergyKj += result.impactEnergyKj;
        left.collidedWithParticipants.add(right.participant.id);
        right.collidedWithParticipants.add(left.participant.id);
      }
    }
  }

  if (detectedContact) {
    warnings.push(
      `Continuous contact detection found the first participant collision at ${impactTime.toFixed(2)}s, before or at the authored primary marker.`,
    );
  } else if (participants.length > 1) {
    warnings.push(
      "No earlier body contact was found along the guided routes; the authored impact timing was used.",
    );
  }

  const step = clamp(settings.timeStepSeconds, 0.04, 0.5);
  const baseFriction = surfaceFriction(source) * settings.globalFrictionMultiplier;
  const maximumSimulationTime = Math.max(source.durationSeconds, impactTime + 30);
  let simulatedDurationSeconds = impactTime;
  const interactedObjects = new Set<string>();
  let solidObjectImpacts = 0;
  let potholeInteractions = 0;
  let surfaceInteractions = 0;
  let generatedPathPoints = 0;

  const objects = source.sceneObjects.map((object) => ({
    object,
    profile: { ...getDefaultSceneObjectPhysics(object), ...(object.physics ?? {}) },
    position: worldPosition(object.position, width, height),
  }));

  for (
    let time = impactTime + step;
    time <= maximumSimulationTime + 0.0001;
    time += step
  ) {
    bodies.forEach((body) => {
      if (time < body.timeSeconds || body.stopped) return;

      let localFriction = baseFriction * body.profile.rollingFriction;
      let action: MovementPathPoint["action"] =
        body.points.length === 0 && body.primaryResponseAction
          ? body.primaryResponseAction
          : "Slide";
      let label =
        body.points.length === 0 && body.primaryResponseLabel
          ? body.primaryResponseLabel
          : "Post-impact slide";
      let linkedSceneObjectId: string | undefined;

      objects.forEach(({ object, profile, position }) => {
        if (!profile.enabled) return;
        const delta = { x: body.position.x - position.x, y: body.position.y - position.y };
        const distance = magnitude(delta);
        const interactionDistance = body.profile.collisionRadiusMetres + profile.collisionRadiusMetres;
        if (distance > interactionDistance) return;

        if (object.type === "Pothole" && !body.collidedWithObjects.has(object.id)) {
          body.velocity = rotate(
            {
              x: body.velocity.x * profile.speedLossFactor,
              y: body.velocity.y * profile.speedLossFactor,
            },
            profile.deflectionDegrees * deterministicSign(`${body.participant.id}:${object.id}`),
          );
          body.collidedWithObjects.add(object.id);
          body.angularVelocityDegreesPerSecond +=
            profile.deflectionDegrees *
            deterministicSign(`${body.participant.id}:${object.id}`) *
            2.5;
          interactedObjects.add(object.id);
          potholeInteractions += 1;
          action = "Deflect";
          label = `Deflected by ${object.label}`;
          linkedSceneObjectId = object.id;
          return;
        }

        if (LOW_GRIP_OBJECT_TYPES.has(object.type)) {
          localFriction *= profile.surfaceFrictionMultiplier;
          if (!body.collidedWithObjects.has(object.id)) {
            body.velocity = rotate(
              body.velocity,
              profile.deflectionDegrees * deterministicSign(`${object.id}:${body.participant.id}`),
            );
            body.collidedWithObjects.add(object.id);
            body.angularVelocityDegreesPerSecond +=
              profile.deflectionDegrees *
              deterministicSign(`${object.id}:${body.participant.id}`) *
              1.8;
            interactedObjects.add(object.id);
            surfaceInteractions += 1;
          }
          action = "Deflect";
          label = `Reduced grip on ${object.label}`;
          linkedSceneObjectId = object.id;
          return;
        }

        if (profile.collidable && !body.collidedWithObjects.has(object.id)) {
          const normal = normalise(delta);
          body.velocity = reflect(body.velocity, normal);
          body.velocity = {
            x: body.velocity.x * profile.restitution * profile.speedLossFactor,
            y: body.velocity.y * profile.restitution * profile.speedLossFactor,
          };
          body.position = {
            x: position.x + normal.x * interactionDistance,
            y: position.y + normal.y * interactionDistance,
          };
          body.collidedWithObjects.add(object.id);
          body.angularVelocityDegreesPerSecond +=
            deterministicSign(`${body.participant.id}:${object.id}:solid`) * 75;
          interactedObjects.add(object.id);
          solidObjectImpacts += 1;
          action = "Ricochet";
          label = `Impact with ${object.label}`;
          linkedSceneObjectId = object.id;
        }
      });

      const speed = magnitude(body.velocity);
      let nextSpeed = speed;
      if (speed > 0) {
        const direction = normalise(body.velocity);
        const frictionLimitedDeceleration = Math.max(
          0.35,
          9.81 * localFriction * 0.72,
        );
        const deceleration = Math.min(
          body.profile.brakingDecelerationMps2,
          frictionLimitedDeceleration,
        );
        const drag = speed * settings.airDrag;
        nextSpeed = Math.max(0, speed - (deceleration + drag) * step);
        const averageTravelSpeed = (speed + nextSpeed) / 2;
        body.position = {
          x: body.position.x + direction.x * averageTravelSpeed * step,
          y: body.position.y + direction.y * averageTravelSpeed * step,
        };
        body.velocity = {
          x: direction.x * nextSpeed,
          y: direction.y * nextSpeed,
        };
      }

      body.rotation += body.angularVelocityDegreesPerSecond * step;
      body.angularVelocityDegreesPerSecond *= Math.exp(
        -(1.15 + body.profile.lateralGrip * 1.9) * step,
      );
      const travelHeading = rotationFromVelocity(body.velocity, body.rotation);
      body.rotation = blendRotation(
        body.rotation,
        travelHeading,
        body.profile.lateralGrip * step * 1.35,
      );

      if (body.position.x < 0 || body.position.x > width) {
        body.position.x = clamp(body.position.x, 0, width);
        body.velocity.x *= -0.22;
        body.angularVelocityDegreesPerSecond +=
          deterministicSign(`${body.participant.id}:edge-x`) * 55;
        action = "Ricochet";
        label = "Scene-edge deflection";
      }
      if (body.position.y < 0 || body.position.y > height) {
        body.position.y = clamp(body.position.y, 0, height);
        body.velocity.y *= -0.22;
        body.angularVelocityDegreesPerSecond +=
          deterministicSign(`${body.participant.id}:edge-y`) * 55;
        action = "Ricochet";
        label = "Scene-edge deflection";
      }

      const reachedStop =
        nextSpeed <= 0.01 ||
        mpsToKmh(magnitude(body.velocity)) <= settings.stopSpeedKmh;
      if (reachedStop) {
        body.velocity = { x: 0, y: 0 };
        body.angularVelocityDegreesPerSecond = 0;
        action = "Stop";
        label = "Natural rest position";
      }

      const shouldRecord =
        body.points.length === 0 ||
        (["Ricochet", "Deflect"] as string[]).includes(action) ||
        reachedStop ||
        Math.round((time - impactTime) / step) % Math.max(1, Math.round(0.4 / step)) === 0;

      if (shouldRecord) {
        body.points.push(
          makePhysicsPoint(
            body,
            time,
            scenePosition(body.position, width, height),
            action,
            label,
            linkedSceneObjectId,
          ),
        );
        generatedPathPoints += 1;
        simulatedDurationSeconds = Math.max(simulatedDurationSeconds, time);
      }

      if (reachedStop) body.stopped = true;
    });

    for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex += 1) {
        const left = bodies[leftIndex];
        const right = bodies[rightIndex];
        if (left.collidedWithParticipants.has(right.participant.id)) continue;

        const delta = {
          x: right.position.x - left.position.x,
          y: right.position.y - left.position.y,
        };
        const collisionDistance =
          left.profile.collisionRadiusMetres +
          right.profile.collisionRadiusMetres +
          Math.max(0, settings.collisionToleranceMetres);
        const distance = magnitude(delta);
        if (distance > collisionDistance) continue;

        left.stopped = false;
        right.stopped = false;
        const result = resolveParticipantCollision(left, right);
        if (!result.collided) continue;

        const normal = normalise(delta);
        const overlap = Math.max(0, collisionDistance - distance);
        const totalMass = left.profile.massKg + right.profile.massKg;
        left.position = {
          x: left.position.x - normal.x * overlap * (right.profile.massKg / totalMass),
          y: left.position.y - normal.y * overlap * (right.profile.massKg / totalMass),
        };
        right.position = {
          x: right.position.x + normal.x * overlap * (left.profile.massKg / totalMass),
          y: right.position.y + normal.y * overlap * (left.profile.massKg / totalMass),
        };
        left.collidedWithParticipants.add(right.participant.id);
        right.collidedWithParticipants.add(left.participant.id);
        participantCollisions += 1;
        estimatedImpactEnergyKj += result.impactEnergyKj;

        left.points.push(
          makePhysicsPoint(
            left,
            time,
            scenePosition(left.position, width, height),
            "Impact",
            `Contact with ${right.participant.name}`,
          ),
        );
        right.points.push(
          makePhysicsPoint(
            right,
            time,
            scenePosition(right.position, width, height),
            "Impact",
            `Contact with ${left.participant.name}`,
          ),
        );
        generatedPathPoints += 2;
        simulatedDurationSeconds = Math.max(simulatedDurationSeconds, time);
      }
    }

    if (bodies.length > 0 && bodies.every((body) => body.stopped)) break;
  }

  const updatedVehicles = source.vehicles.map((participant) => {
    const body = bodies.find((candidate) => candidate.participant.id === participant.id);
    if (!body || body.points.length === 0) {
      return {
        ...participant,
        physics: { ...getDefaultParticipantPhysics(participant), ...(participant.physics ?? {}) },
      };
    }

    const beforeImpact = sortMovementPathPoints(participant.pathPoints).filter(
      (point) => point.timeSeconds < impactTime - 0.001,
    );
    const collidedAtSimulationStart = Boolean(body.primaryResponseAction);
    const transitionPoint: MovementPathPoint = {
      ...body.impactPoint,
      id: createId(collidedAtSimulationStart ? "detected-impact" : "physics-transition"),
      label: collidedAtSimulationStart
        ? "Detected participant contact"
        : "Physics continuation",
      position: { ...body.impactPoint.position },
      timeSeconds: impactTime,
      speedKmh: Number(mpsToKmh(magnitude(body.incomingVelocity)).toFixed(1)),
      rotation: Number(
        rotationFromVelocity(body.incomingVelocity, body.impactPoint.rotation).toFixed(1),
      ),
      action: collidedAtSimulationStart ? "Impact" : "Cruise",
      notes: collidedAtSimulationStart
        ? "Generated at the first swept body contact found along the participant routes."
        : "Physics takes over from the participant's guided route at the first detected scene collision.",
    };
    const generated = [transitionPoint, ...body.points];
    const pathPoints = settings.replacePostImpactPath
      ? [...beforeImpact, ...generated]
      : sortMovementPathPoints([
          ...participant.pathPoints.filter((point) => point.timeSeconds < impactTime - 0.001),
          ...generated,
        ]);

    return syncLegacyParticipantFields({
      ...participant,
      physics: body.profile,
      pathPoints: sortMovementPathPoints(pathPoints),
    });
  });

  if (participantCollisions === 0 && participants.length > 1) {
    warnings.push(
      "No participant-to-participant collision impulse was produced. Check that Impact points and times converge at the primary collision marker.",
    );
  }
  if (!source.collisionSetup?.confirmed) {
    warnings.push("The primary collision point has not been confirmed by the officer.");
  }
  if (bodies.some((body) => !body.stopped)) {
    warnings.push(
      "At least one participant reached the simulation safety limit before settling; review its final path and scene dimensions.",
    );
  }
  warnings.push(
    "This is a deterministic planning simulation, not a certified forensic or crash-dynamics calculation.",
  );

  const summary: PhysicsSimulationSummary = {
    ranAt: new Date().toISOString(),
    participantCollisions,
    primaryImpactTimeSeconds: impactTime,
    estimatedImpactEnergyKj: Number(estimatedImpactEnergyKj.toFixed(1)),
    solidObjectImpacts,
    potholeInteractions,
    surfaceInteractions,
    generatedPathPoints,
    simulatedDurationSeconds: Number(simulatedDurationSeconds.toFixed(2)),
    warnings,
  };

  const generatedTimelineEvents = updatedVehicles.flatMap((participant) =>
    participant.pathPoints
      .filter((point) => ["Impact", "Ricochet", "Deflect", "Stop"].includes(point.action))
      .map((point) => ({
        id: createId("physics-event"),
        timeSeconds: point.timeSeconds,
        title: `${participant.name}: ${point.label}`,
        description: point.notes ?? "Physics-generated event.",
        type: point.action === "Impact" || point.action === "Ricochet" ? ("Collision" as const) : ("Participant Action" as const),
        participantId: participant.id,
        sceneObjectId: point.linkedSceneObjectId,
      })),
  );

  const preservedTimeline = source.timelineEvents.filter(
    (event) => !event.id.startsWith("physics-event"),
  );

  return {
    ...source,
    collisionPoint: detectedCollisionPoint,
    durationSeconds: Number(
      Math.max(source.durationSeconds, simulatedDurationSeconds).toFixed(2),
    ),
    vehicles: updatedVehicles,
    sceneObjects: source.sceneObjects.map((object) => ({
      ...object,
      physics: { ...getDefaultSceneObjectPhysics(object), ...(object.physics ?? {}) },
    })),
    physicsSettings: settings,
    lastPhysicsSimulation: summary,
    timelineEvents: [...preservedTimeline, ...generatedTimelineEvents],
  };
}