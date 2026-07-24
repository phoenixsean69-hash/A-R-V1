import {
  usesGeneratedRoad,
  type AccidentReconstruction,
  type MovementPathPoint,
  type ParticipantPhysicsProfile,
  type PhysicsCollisionEvent,
  type PhysicsCollisionShape,
  type PhysicsSimulationSummary,
  type ReconstructionPhysicsSettings,
  type ReconstructionPosition,
  type ReconstructionSceneObject,
  type ReconstructionVehicle,
  type SceneObjectPhysicsProfile,
} from "../types/reconstruction";

import {
  clamp,
  getParticipantStateAtTime,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "../utils/reconstructionGeometry";

import {
  calculatePlanarMomentOfInertia,
  createPhysicsCollisionShape,
  findSweptPhysicsCollision,
  getPhysicsCollisionManifold,
  velocityAtContactPoint,
  type PhysicsCollisionManifold,
  type PhysicsPose2D,
  type PhysicsShapeDimensions,
} from "./physicsCollisionGeometry";

interface Vector2 {
  x: number;
  y: number;
}

interface ResolvedParticipantPhysicsProfile extends ParticipantPhysicsProfile {
  collisionShape: PhysicsCollisionShape;
  lengthMetres: number;
  widthMetres: number;
  collisionFriction: number;
  momentOfInertiaScale: number;
}

interface ResolvedSceneObjectPhysicsProfile extends SceneObjectPhysicsProfile {
  collisionShape: PhysicsCollisionShape;
  lengthMetres: number;
  widthMetres: number;
  collisionFriction: number;
}

interface SimulationBody {
  participant: ReconstructionVehicle;
  profile: ResolvedParticipantPhysicsProfile;
  impactPoint: MovementPathPoint;
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  incomingVelocity: Vector2;
  rotation: number;
  previousRotation: number;
  angularVelocityDegreesPerSecond: number;
  timeSeconds: number;
  points: MovementPathPoint[];
  primaryResponseAction?: "Deflect" | "Ricochet";
  primaryResponseLabel?: string;
  stopped: boolean;
  collidedWithParticipants: Set<string>;
  collidedWithObjects: Set<string>;
}

interface CollisionImpulseResult {
  collided: boolean;
  impactEnergyKj: number;
  relativeSpeedKmh: number;
  normalImpulseNs: number;
  frictionImpulseNs: number;
  angularVelocityChangesDegPerSecond: Record<string, number>;
}

interface DetectedParticipantContact {
  timeSeconds: number;
  leftId: string;
  rightId: string;
  leftPosition: Vector2;
  rightPosition: Vector2;
  contactPosition: Vector2;
  normal: Vector2;
}

interface DetectedSceneObjectContact {
  timeSeconds: number;
  participantId: string;
  objectId: string;
  participantPosition: Vector2;
  objectPosition: Vector2;
  contactPosition: Vector2;
  normal: Vector2;
}

function firstContactOnStep(
  leftStart: Vector2,
  leftEnd: Vector2,
  rightStart: Vector2,
  rightEnd: Vector2,
  collisionDistance: number,
): { alpha: number; distance: number } | null {
  const relativeStart = {
    x: rightStart.x - leftStart.x,
    y: rightStart.y - leftStart.y,
  };
  const relativeDelta = {
    x: (rightEnd.x - rightStart.x) - (leftEnd.x - leftStart.x),
    y: (rightEnd.y - rightStart.y) - (leftEnd.y - leftStart.y),
  };
  const radius = Math.max(0, collisionDistance);
  const c = dot(relativeStart, relativeStart) - radius * radius;

  if (c <= 0) {
    return { alpha: 0, distance: magnitude(relativeStart) };
  }

  const a = dot(relativeDelta, relativeDelta);
  if (a < 0.0000001) return null;

  const b = 2 * dot(relativeStart, relativeDelta);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const squareRoot = Math.sqrt(Math.max(0, discriminant));
  const enterAlpha = (-b - squareRoot) / (2 * a);
  const exitAlpha = (-b + squareRoot) / (2 * a);
  const alpha = enterAlpha >= 0 && enterAlpha <= 1
    ? enterAlpha
    : exitAlpha >= 0 && exitAlpha <= 1
      ? exitAlpha
      : null;

  if (alpha === null) return null;

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

function resolveParticipantPhysicsProfile(
  participant: ReconstructionVehicle,
): ResolvedParticipantPhysicsProfile {
  return {
    ...getDefaultParticipantPhysics(participant),
    ...(participant.physics ?? {}),
  } as ResolvedParticipantPhysicsProfile;
}

function resolveSceneObjectPhysicsProfile(
  object: ReconstructionSceneObject,
): ResolvedSceneObjectPhysicsProfile {
  return {
    ...getDefaultSceneObjectPhysics(object),
    ...(object.physics ?? {}),
  } as ResolvedSceneObjectPhysicsProfile;
}

function participantDimensions(
  profile: ResolvedParticipantPhysicsProfile,
): PhysicsShapeDimensions {
  return {
    collisionShape: profile.collisionShape,
    collisionRadiusMetres: profile.collisionRadiusMetres,
    lengthMetres: profile.lengthMetres,
    widthMetres: profile.widthMetres,
  };
}

function objectDimensions(
  profile: ResolvedSceneObjectPhysicsProfile,
): PhysicsShapeDimensions {
  return {
    collisionShape: profile.collisionShape,
    collisionRadiusMetres: profile.collisionRadiusMetres,
    lengthMetres: profile.lengthMetres,
    widthMetres: profile.widthMetres,
  };
}

function participantPoseAtTime(
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
): PhysicsPose2D {
  const state = getParticipantStateAtTime(participant, timeSeconds);
  return {
    position: worldPosition(state.position, width, height),
    rotationDegrees: state.rotation,
  };
}

function bodyPose(body: SimulationBody, previous = false): PhysicsPose2D {
  return {
    position: previous ? body.previousPosition : body.position,
    rotationDegrees: previous ? body.previousRotation : body.rotation,
  };
}

function sceneObjectPose(
  object: ReconstructionSceneObject,
  width: number,
  height: number,
): PhysicsPose2D {
  return {
    position: worldPosition(object.position, width, height),
    rotationDegrees: object.rotation,
  };
}

function physicalCollisionTolerance(
  settings: ReconstructionPhysicsSettings,
): number {
  return clamp(settings.collisionToleranceMetres, 0, 0.35);
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
      resolveParticipantPhysicsProfile(participant),
    ]),
  );
  const step = clamp(Math.min(settings.timeStepSeconds, 0.08), 0.02, 0.08);
  const tolerance = physicalCollisionTolerance(settings);

  for (let time = 0; time < durationSeconds - 0.0001; time += step) {
    const nextTime = Math.min(durationSeconds, time + step);
    let earliestInStep: DetectedParticipantContact | null = null;

    for (let leftIndex = 0; leftIndex < participants.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < participants.length; rightIndex += 1) {
        const left = participants[leftIndex];
        const right = participants[rightIndex];
        const leftProfile = profiles.get(left.id)!;
        const rightProfile = profiles.get(right.id)!;
        const contact = findSweptPhysicsCollision(
          participantPoseAtTime(left, time, width, height),
          participantPoseAtTime(left, nextTime, width, height),
          participantDimensions(leftProfile),
          participantPoseAtTime(right, time, width, height),
          participantPoseAtTime(right, nextTime, width, height),
          participantDimensions(rightProfile),
          tolerance,
        );
        if (!contact) continue;

        const candidate: DetectedParticipantContact = {
          timeSeconds: time + (nextTime - time) * contact.alpha,
          leftId: left.id,
          rightId: right.id,
          leftPosition: contact.leftPose.position,
          rightPosition: contact.rightPose.position,
          contactPosition: contact.manifold.contactPoint,
          normal: contact.manifold.normal,
        };

        if (
          earliestInStep === null ||
          candidate.timeSeconds < earliestInStep.timeSeconds
        ) {
          earliestInStep = candidate;
        }
      }
    }

    if (earliestInStep !== null) return earliestInStep;
  }

  return null;
}

function detectEarliestSceneObjectContact(
  participants: ReconstructionVehicle[],
  sceneObjects: ReconstructionSceneObject[],
  settings: ReconstructionPhysicsSettings,
  width: number,
  height: number,
  durationSeconds: number,
): DetectedSceneObjectContact | null {
  if (participants.length === 0 || sceneObjects.length === 0) return null;

  const participantProfiles = new Map(
    participants.map((participant) => [
      participant.id,
      resolveParticipantPhysicsProfile(participant),
    ]),
  );
  const collidableObjects = sceneObjects
    .map((object) => ({
      object,
      profile: resolveSceneObjectPhysicsProfile(object),
      pose: sceneObjectPose(object, width, height),
    }))
    .filter(({ profile }) => profile.enabled && profile.collidable);

  if (collidableObjects.length === 0) return null;

  const step = clamp(Math.min(settings.timeStepSeconds, 0.08), 0.02, 0.08);
  const tolerance = physicalCollisionTolerance(settings);

  for (let time = 0; time < durationSeconds - 0.0001; time += step) {
    const nextTime = Math.min(durationSeconds, time + step);
    let earliestInStep: DetectedSceneObjectContact | null = null;

    for (const participant of participants) {
      const participantProfile = participantProfiles.get(participant.id)!;
      const participantStart = participantPoseAtTime(participant, time, width, height);
      const participantEnd = participantPoseAtTime(participant, nextTime, width, height);

      for (const { object, profile, pose } of collidableObjects) {
        const contact = findSweptPhysicsCollision(
          participantStart,
          participantEnd,
          participantDimensions(participantProfile),
          pose,
          pose,
          objectDimensions(profile),
          tolerance,
        );
        if (!contact) continue;

        const candidate: DetectedSceneObjectContact = {
          timeSeconds: time + (nextTime - time) * contact.alpha,
          participantId: participant.id,
          objectId: object.id,
          participantPosition: contact.leftPose.position,
          objectPosition: contact.rightPose.position,
          contactPosition: contact.manifold.contactPoint,
          normal: contact.manifold.normal,
        };

        if (
          earliestInStep === null ||
          candidate.timeSeconds < earliestInStep.timeSeconds
        ) {
          earliestInStep = candidate;
        }
      }
    }

    if (earliestInStep !== null) return earliestInStep;
  }

  return null;
}

export const DEFAULT_PHYSICS_SETTINGS: ReconstructionPhysicsSettings = {
  enabled: true,
  mode: "Physics After Primary Impact",
  autoRunOnPlay: true,
  liveSimulation: false,
  timeStepSeconds: 0.1,
  collisionToleranceMetres: 0.18,
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

function groundSurfaceFriction(
  surface: AccidentReconstruction["scene"]["groundSurface"],
): number {
  switch (surface) {
    case "Firm Soil": return 0.62;
    case "Loose Soil": return 0.42;
    case "Grass": return 0.45;
    case "Gravel": return 0.5;
    case "Sand": return 0.35;
    case "Mud": return 0.28;
    case "Concrete": return 0.82;
    case "Paved Yard": return 0.75;
    case "Mixed Surface": return 0.5;
    case "Unclassified Ground":
    default:
      return 0.5;
  }
}

function surfaceFriction(reconstruction: AccidentReconstruction): number {
  const scene = reconstruction.scene;
  const weather = scene.weather;
  const roadCoefficient =
    scene.roadSurface === "Wet" ? 0.52 : scene.roadSurface === "Damaged" ? 0.62 : 0.78;
  const groundCoefficient = groundSurfaceFriction(scene.groundSurface);

  let coefficient = usesGeneratedRoad(scene)
    ? scene.sceneEnvironment === "Mixed Site"
      ? (roadCoefficient + groundCoefficient) / 2
      : roadCoefficient
    : groundCoefficient;

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
        collisionRadiusMetres: 1.25,
        restitution: 0.1,
        rollingFriction: 1,
        lateralGrip: 0.72,
        brakingDecelerationMps2: 5.2,
        collisionShape: "Oriented Box",
        lengthMetres: 11.8,
        widthMetres: 2.55,
        collisionFriction: 0.72,
        momentOfInertiaScale: 1,
      };
    case "Truck":
      return {
        enabled: true,
        massKg: 9000,
        collisionRadiusMetres: 1.25,
        restitution: 0.08,
        rollingFriction: 1.05,
        lateralGrip: 0.68,
        brakingDecelerationMps2: 5,
        collisionShape: "Oriented Box",
        lengthMetres: 8.4,
        widthMetres: 2.5,
        collisionFriction: 0.76,
        momentOfInertiaScale: 1.05,
      };
    case "Motorcycle":
      return {
        enabled: true,
        massKg: 240,
        collisionRadiusMetres: 0.42,
        restitution: 0.22,
        rollingFriction: 0.75,
        lateralGrip: 0.9,
        brakingDecelerationMps2: 7,
        collisionShape: "Oriented Box",
        lengthMetres: 2.2,
        widthMetres: 0.82,
        collisionFriction: 0.52,
        momentOfInertiaScale: 0.72,
      };
    case "Bicycle":
      return {
        enabled: true,
        massKg: 95,
        collisionRadiusMetres: 0.34,
        restitution: 0.18,
        rollingFriction: 0.6,
        lateralGrip: 0.82,
        brakingDecelerationMps2: 4.5,
        collisionShape: "Oriented Box",
        lengthMetres: 1.85,
        widthMetres: 0.64,
        collisionFriction: 0.46,
        momentOfInertiaScale: 0.62,
      };
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return {
        enabled: true,
        massKg: 75,
        collisionRadiusMetres: 0.38,
        restitution: 0.06,
        rollingFriction: 1.45,
        lateralGrip: 0.45,
        brakingDecelerationMps2: 3.8,
        collisionShape: "Circle",
        lengthMetres: 0.76,
        widthMetres: 0.76,
        collisionFriction: 0.5,
        momentOfInertiaScale: 0.65,
      };
    case "Car":
    default:
      return {
        enabled: true,
        massKg: 1450,
        collisionRadiusMetres: 0.92,
        restitution: 0.14,
        rollingFriction: 0.92,
        lateralGrip: 0.82,
        brakingDecelerationMps2: 7.2,
        collisionShape: "Oriented Box",
        lengthMetres: 4.5,
        widthMetres: 1.82,
        collisionFriction: 0.66,
        momentOfInertiaScale: 1,
      };
  }
}

export function getDefaultSceneObjectPhysics(
  object: Pick<
    ReconstructionSceneObject,
    "type" | "severity" | "scale" | "lengthMetres" | "widthMetres"
  >,
): SceneObjectPhysicsProfile {
  if (object.type === "Pothole") {
    const severityFactor =
      object.severity === "Critical" ? 0.55 :
      object.severity === "High" ? 0.66 :
      object.severity === "Medium" ? 0.76 : 0.86;
    const diameter = Math.max(1.2, object.scale * 1.8);
    return {
      enabled: true,
      collidable: false,
      collisionRadiusMetres: diameter / 2,
      restitution: 0,
      surfaceFrictionMultiplier: 1.25,
      speedLossFactor: severityFactor,
      deflectionDegrees: object.severity === "Critical" ? 18 : object.severity === "High" ? 12 : 7,
      collisionShape: "Circle",
      lengthMetres: diameter,
      widthMetres: diameter,
      collisionFriction: 0.9,
    };
  }

  if (LOW_GRIP_OBJECT_TYPES.has(object.type)) {
    const diameter = Math.max(1.6, object.scale * 2.6);
    return {
      enabled: true,
      collidable: false,
      collisionRadiusMetres: diameter / 2,
      restitution: 0,
      surfaceFrictionMultiplier: object.type === "Oil Spill" ? 0.28 : 0.58,
      speedLossFactor: 0.96,
      deflectionDegrees: object.type === "Loose Gravel" ? 5 : 2,
      collisionShape: "Circle",
      lengthMetres: diameter,
      widthMetres: diameter,
      collisionFriction: 0.2,
    };
  }

  const solid = SOLID_OBJECT_TYPES.has(object.type);
  const longBarrier =
    object.type === "Wall" ||
    object.type === "Guardrail" ||
    object.type === "Road Barrier" ||
    object.type === "Fence";
  const parkedVehicle = object.type === "Parked Vehicle";
  const busStop = object.type === "Bus Stop";
  const circular =
    object.type === "Tree" ||
    object.type === "Street Light" ||
    object.type === "Traffic Light" ||
    object.type === "Stop Sign" ||
    object.type === "Give Way Sign" ||
    object.type === "Speed Limit Sign";
  const length = longBarrier
    ? Math.max(1, Number(object.lengthMetres ?? 4))
    : parkedVehicle
      ? Math.max(3.8, Number(object.lengthMetres ?? 4.5))
      : busStop
        ? Math.max(2.5, Number(object.lengthMetres ?? 4))
        : Math.max(0.5, object.scale * 1.2);
  const width = longBarrier
    ? Math.max(0.18, Number(object.widthMetres ?? 0.32))
    : parkedVehicle
      ? Math.max(1.6, Number(object.widthMetres ?? 1.9))
      : busStop
        ? Math.max(1, Number(object.widthMetres ?? 1.4))
        : Math.max(0.3, object.scale * 0.7);
  const radius = circular
    ? Math.max(0.18, object.scale * (object.type === "Tree" ? 0.55 : 0.22))
    : Math.max(0.25, Math.min(length, width) / 2);

  return {
    enabled: solid,
    collidable: solid,
    collisionRadiusMetres: radius,
    restitution:
      object.type === "Road Barrier" || object.type === "Guardrail" ? 0.2 : 0.08,
    surfaceFrictionMultiplier: 1,
    speedLossFactor:
      object.type === "Tree" || object.type === "Street Light" ? 0.28 : 0.55,
    deflectionDegrees: 0,
    collisionShape: circular ? "Circle" : "Oriented Box",
    lengthMetres: circular ? radius * 2 : length,
    widthMetres: circular ? radius * 2 : width,
    collisionFriction: longBarrier ? 0.82 : parkedVehicle ? 0.68 : 0.72,
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

function bodyMomentOfInertia(body: SimulationBody): number {
  return calculatePlanarMomentOfInertia(
    body.profile.massKg,
    participantDimensions(body.profile),
    body.profile.momentOfInertiaScale,
  );
}

function applyImpulseToBody(
  body: SimulationBody,
  impulse: Vector2,
  contactPoint: Vector2,
): void {
  body.velocity = {
    x: body.velocity.x + impulse.x / body.profile.massKg,
    y: body.velocity.y + impulse.y / body.profile.massKg,
  };
  const offset = {
    x: contactPoint.x - body.position.x,
    y: contactPoint.y - body.position.y,
  };
  const angularDeltaRadiansPerSecond =
    cross(offset, impulse) / Math.max(0.001, bodyMomentOfInertia(body));
  body.angularVelocityDegreesPerSecond +=
    (angularDeltaRadiansPerSecond * 180) / Math.PI;
}

function contactVelocity(body: SimulationBody, contactPoint: Vector2): Vector2 {
  return velocityAtContactPoint(
    body.velocity,
    (body.angularVelocityDegreesPerSecond * Math.PI) / 180,
    {
      x: contactPoint.x - body.position.x,
      y: contactPoint.y - body.position.y,
    },
  );
}

function resolveParticipantCollision(
  left: SimulationBody,
  right: SimulationBody,
  manifold: PhysicsCollisionManifold,
): CollisionImpulseResult {
  const normal = normalise(manifold.normal);
  const contactPoint = manifold.contactPoint;
  const leftBeforeAngular = left.angularVelocityDegreesPerSecond;
  const rightBeforeAngular = right.angularVelocityDegreesPerSecond;
  const leftContactVelocity = contactVelocity(left, contactPoint);
  const rightContactVelocity = contactVelocity(right, contactPoint);
  const relativeVelocity = {
    x: rightContactVelocity.x - leftContactVelocity.x,
    y: rightContactVelocity.y - leftContactVelocity.y,
  };
  const velocityAlongNormal = dot(relativeVelocity, normal);

  if (velocityAlongNormal >= -0.03) {
    return {
      collided: false,
      impactEnergyKj: 0,
      relativeSpeedKmh: mpsToKmh(magnitude(relativeVelocity)),
      normalImpulseNs: 0,
      frictionImpulseNs: 0,
      angularVelocityChangesDegPerSecond: {},
    };
  }

  const leftOffset = {
    x: contactPoint.x - left.position.x,
    y: contactPoint.y - left.position.y,
  };
  const rightOffset = {
    x: contactPoint.x - right.position.x,
    y: contactPoint.y - right.position.y,
  };
  const inverseLeftMass = 1 / left.profile.massKg;
  const inverseRightMass = 1 / right.profile.massKg;
  const inverseLeftInertia = 1 / Math.max(0.001, bodyMomentOfInertia(left));
  const inverseRightInertia = 1 / Math.max(0.001, bodyMomentOfInertia(right));
  const leftNormalLever = cross(leftOffset, normal);
  const rightNormalLever = cross(rightOffset, normal);
  const normalDenominator =
    inverseLeftMass +
    inverseRightMass +
    leftNormalLever * leftNormalLever * inverseLeftInertia +
    rightNormalLever * rightNormalLever * inverseRightInertia;
  const restitution = Math.min(left.profile.restitution, right.profile.restitution);
  const normalImpulseMagnitude =
    (-(1 + restitution) * velocityAlongNormal) /
    Math.max(0.000001, normalDenominator);
  const normalImpulse = {
    x: normal.x * normalImpulseMagnitude,
    y: normal.y * normalImpulseMagnitude,
  };

  applyImpulseToBody(left, { x: -normalImpulse.x, y: -normalImpulse.y }, contactPoint);
  applyImpulseToBody(right, normalImpulse, contactPoint);

  const relativeAfterNormal = {
    x: contactVelocity(right, contactPoint).x - contactVelocity(left, contactPoint).x,
    y: contactVelocity(right, contactPoint).y - contactVelocity(left, contactPoint).y,
  };
  const tangentRaw = {
    x: relativeAfterNormal.x - normal.x * dot(relativeAfterNormal, normal),
    y: relativeAfterNormal.y - normal.y * dot(relativeAfterNormal, normal),
  };
  let frictionImpulseMagnitude = 0;
  if (magnitude(tangentRaw) > 0.0001) {
    const tangent = normalise(tangentRaw);
    const leftTangentLever = cross(leftOffset, tangent);
    const rightTangentLever = cross(rightOffset, tangent);
    const tangentDenominator =
      inverseLeftMass +
      inverseRightMass +
      leftTangentLever * leftTangentLever * inverseLeftInertia +
      rightTangentLever * rightTangentLever * inverseRightInertia;
    const unconstrainedFrictionImpulse =
      -dot(relativeAfterNormal, tangent) /
      Math.max(0.000001, tangentDenominator);
    const frictionCoefficient = Math.sqrt(
      left.profile.collisionFriction * right.profile.collisionFriction,
    );
    const maximumFrictionImpulse = frictionCoefficient * normalImpulseMagnitude;
    frictionImpulseMagnitude = clamp(
      unconstrainedFrictionImpulse,
      -maximumFrictionImpulse,
      maximumFrictionImpulse,
    );
    const frictionImpulse = {
      x: tangent.x * frictionImpulseMagnitude,
      y: tangent.y * frictionImpulseMagnitude,
    };
    applyImpulseToBody(left, { x: -frictionImpulse.x, y: -frictionImpulse.y }, contactPoint);
    applyImpulseToBody(right, frictionImpulse, contactPoint);
  }

  const effectiveMass = 1 / Math.max(0.000001, normalDenominator);
  const impactEnergyKj =
    (0.5 * effectiveMass * velocityAlongNormal * velocityAlongNormal *
      (1 - restitution * restitution)) /
    1000;
  const leftDeflection = Math.abs(
    angleDifferenceDegrees(left.incomingVelocity, left.velocity),
  );
  const rightDeflection = Math.abs(
    angleDifferenceDegrees(right.incomingVelocity, right.velocity),
  );
  const leftSpinChange =
    left.angularVelocityDegreesPerSecond - leftBeforeAngular;
  const rightSpinChange =
    right.angularVelocityDegreesPerSecond - rightBeforeAngular;
  left.primaryResponseAction =
    leftDeflection >= 24 || Math.abs(leftSpinChange) >= 35 ? "Ricochet" : "Deflect";
  right.primaryResponseAction =
    rightDeflection >= 24 || Math.abs(rightSpinChange) >= 35 ? "Ricochet" : "Deflect";
  left.primaryResponseLabel =
    `${left.primaryResponseAction} after impact with ${right.participant.name}`;
  right.primaryResponseLabel =
    `${right.primaryResponseAction} after impact with ${left.participant.name}`;

  return {
    collided: true,
    impactEnergyKj,
    relativeSpeedKmh: mpsToKmh(magnitude(relativeVelocity)),
    normalImpulseNs: Math.abs(normalImpulseMagnitude),
    frictionImpulseNs: Math.abs(frictionImpulseMagnitude),
    angularVelocityChangesDegPerSecond: {
      [left.participant.id]: Number(leftSpinChange.toFixed(3)),
      [right.participant.id]: Number(rightSpinChange.toFixed(3)),
    },
  };
}

function resolveStaticObjectCollision(
  body: SimulationBody,
  objectProfile: ResolvedSceneObjectPhysicsProfile,
  manifold: PhysicsCollisionManifold,
): CollisionImpulseResult {
  const normal = normalise(manifold.normal);
  const contactPoint = manifold.contactPoint;
  const beforeAngular = body.angularVelocityDegreesPerSecond;
  const bodyContactVelocity = contactVelocity(body, contactPoint);
  const relativeVelocity = {
    x: -bodyContactVelocity.x,
    y: -bodyContactVelocity.y,
  };
  const velocityAlongNormal = dot(relativeVelocity, normal);

  if (velocityAlongNormal >= -0.03) {
    return {
      collided: false,
      impactEnergyKj: 0,
      relativeSpeedKmh: mpsToKmh(magnitude(relativeVelocity)),
      normalImpulseNs: 0,
      frictionImpulseNs: 0,
      angularVelocityChangesDegPerSecond: {},
    };
  }

  const offset = {
    x: contactPoint.x - body.position.x,
    y: contactPoint.y - body.position.y,
  };
  const inverseMass = 1 / body.profile.massKg;
  const inverseInertia = 1 / Math.max(0.001, bodyMomentOfInertia(body));
  const normalLever = cross(offset, normal);
  const normalDenominator =
    inverseMass + normalLever * normalLever * inverseInertia;
  const restitution = Math.min(body.profile.restitution, objectProfile.restitution);
  const normalImpulseMagnitude =
    (-(1 + restitution) * velocityAlongNormal) /
    Math.max(0.000001, normalDenominator);
  const normalImpulse = {
    x: normal.x * normalImpulseMagnitude,
    y: normal.y * normalImpulseMagnitude,
  };
  applyImpulseToBody(body, { x: -normalImpulse.x, y: -normalImpulse.y }, contactPoint);

  const relativeAfterNormal = {
    x: -contactVelocity(body, contactPoint).x,
    y: -contactVelocity(body, contactPoint).y,
  };
  const tangentRaw = {
    x: relativeAfterNormal.x - normal.x * dot(relativeAfterNormal, normal),
    y: relativeAfterNormal.y - normal.y * dot(relativeAfterNormal, normal),
  };
  let frictionImpulseMagnitude = 0;
  if (magnitude(tangentRaw) > 0.0001) {
    const tangent = normalise(tangentRaw);
    const tangentLever = cross(offset, tangent);
    const tangentDenominator =
      inverseMass + tangentLever * tangentLever * inverseInertia;
    const unconstrainedFrictionImpulse =
      -dot(relativeAfterNormal, tangent) /
      Math.max(0.000001, tangentDenominator);
    const frictionCoefficient = Math.sqrt(
      body.profile.collisionFriction * objectProfile.collisionFriction,
    );
    const maximumFrictionImpulse = frictionCoefficient * normalImpulseMagnitude;
    frictionImpulseMagnitude = clamp(
      unconstrainedFrictionImpulse,
      -maximumFrictionImpulse,
      maximumFrictionImpulse,
    );
    const frictionImpulse = {
      x: tangent.x * frictionImpulseMagnitude,
      y: tangent.y * frictionImpulseMagnitude,
    };
    applyImpulseToBody(body, { x: -frictionImpulse.x, y: -frictionImpulse.y }, contactPoint);
  }

  body.velocity = {
    x: body.velocity.x * objectProfile.speedLossFactor,
    y: body.velocity.y * objectProfile.speedLossFactor,
  };
  body.angularVelocityDegreesPerSecond *=
    0.65 + objectProfile.speedLossFactor * 0.35;
  const effectiveMass = 1 / Math.max(0.000001, normalDenominator);
  const impactEnergyKj =
    (0.5 * effectiveMass * velocityAlongNormal * velocityAlongNormal *
      (1 - restitution * restitution)) /
    1000;
  const angularChange = body.angularVelocityDegreesPerSecond - beforeAngular;

  return {
    collided: true,
    impactEnergyKj,
    relativeSpeedKmh: mpsToKmh(magnitude(relativeVelocity)),
    normalImpulseNs: Math.abs(normalImpulseMagnitude),
    frictionImpulseNs: Math.abs(frictionImpulseMagnitude),
    angularVelocityChangesDegPerSecond: {
      [body.participant.id]: Number(angularChange.toFixed(3)),
    },
  };
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

export function preparePhysicsForPlayback(
  source: AccidentReconstruction,
): AccidentReconstruction {
  const settings = { ...DEFAULT_PHYSICS_SETTINGS, ...(source.physicsSettings ?? {}) };
  const shouldRun =
    settings.enabled &&
    settings.mode === "Physics After Primary Impact" &&
    settings.autoRunOnPlay &&
    source.vehicles.length > 0;

  if (!shouldRun) {
    return source.physicsSettings ? source : { ...source, physicsSettings: settings };
  }

  return applyPhysicsSimulation(source);
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
        solverVersion: "RoadSafe Physics V2",
        ranAt: new Date().toISOString(),
        participantCollisions: 0,
        primaryImpactTimeSeconds: source.durationSeconds / 2,
        estimatedImpactEnergyKj: 0,
        solidObjectImpacts: 0,
        potholeInteractions: 0,
        surfaceInteractions: 0,
        generatedPathPoints: 0,
        simulatedDurationSeconds: source.durationSeconds,
        collisionEvents: [],
        warnings: ["Physics was not applied because Guided Paths mode is selected."],
      },
    };
  }

  const width = Math.max(1, source.scene.sceneWidthMetres);
  const height = Math.max(1, source.scene.sceneHeightMetres);
  const participants = source.vehicles.filter((participant) => participant.physics?.enabled ?? true);
  const warnings: string[] = [];
  const collisionEvents: PhysicsCollisionEvent[] = [];

  if (!usesGeneratedRoad(source.scene) && source.scene.groundSurface === "Unclassified Ground") {
    warnings.push(
      "Ground surface is unclassified. Physics uses a generic 0.50 friction estimate until the officer classifies the site.",
    );
  }
  if (source.scene.sceneEnvironment === "Mixed Site") {
    warnings.push(
      "Mixed Site currently uses a blended road/ground friction estimate. Surface-region physics is not yet enabled.",
    );
  }

  if (settings.collisionToleranceMetres > 0.35) {
    warnings.push(
      `Collision tolerance was limited to 0.35 m for physical contact; the stored value is ${settings.collisionToleranceMetres.toFixed(2)} m.`,
    );
  }

  if (participants.length === 0) {
    warnings.push("No physics-enabled participants were available.");
  }

  const step = clamp(settings.timeStepSeconds, 0.04, 0.5);
  const detectedParticipantContact = detectEarliestParticipantContact(
    participants,
    settings,
    width,
    height,
    source.durationSeconds,
  );
  const detectedObjectContact = detectEarliestSceneObjectContact(
    participants,
    source.sceneObjects,
    settings,
    width,
    height,
    source.durationSeconds,
  );
  const authoredImpactTimes = participants
    .map((participant) => getImpactPoint(participant).timeSeconds)
    .sort((left, right) => left - right);
  const authoredImpactTime = authoredImpactTimes.length
    ? authoredImpactTimes[Math.floor(authoredImpactTimes.length / 2)]
    : source.durationSeconds / 2;
  const primaryEvent = [
    { kind: "authored" as const, timeSeconds: authoredImpactTime },
    ...(detectedParticipantContact
      ? [{
          kind: "participant" as const,
          timeSeconds: detectedParticipantContact.timeSeconds,
        }]
      : []),
    ...(detectedObjectContact
      ? [{
          kind: "object" as const,
          timeSeconds: detectedObjectContact.timeSeconds,
        }]
      : []),
  ].reduce((earliest, candidate) =>
    candidate.timeSeconds < earliest.timeSeconds ? candidate : earliest,
  );
  const primaryImpactTime = primaryEvent.timeSeconds;
  const impactTime = primaryEvent.kind === "object"
    ? Math.max(0, primaryImpactTime - step)
    : primaryImpactTime;
  const activeParticipantContact =
    primaryEvent.kind === "participant" ? detectedParticipantContact : null;
  const activeObjectContact =
    primaryEvent.kind === "object" ? detectedObjectContact : null;
  const bodies: SimulationBody[] = participants.map((participant) => {
    const profile = resolveParticipantPhysicsProfile(participant);
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
      previousPosition: { ...position },
      velocity: { ...incomingVelocity },
      incomingVelocity: { ...incomingVelocity },
      rotation: rotationFromVelocity(incomingVelocity, state.rotation),
      previousRotation: rotationFromVelocity(incomingVelocity, state.rotation),
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
  const collisionTolerance = physicalCollisionTolerance(settings);
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex += 1) {
      const left = bodies[leftIndex];
      const right = bodies[rightIndex];
      const isDetectedPair = activeParticipantContact &&
        ((left.participant.id === activeParticipantContact.leftId &&
          right.participant.id === activeParticipantContact.rightId) ||
          (left.participant.id === activeParticipantContact.rightId &&
            right.participant.id === activeParticipantContact.leftId));
      const manifold: PhysicsCollisionManifold | null =
        isDetectedPair && activeParticipantContact
          ? (() => {
              const sameOrder = left.participant.id === activeParticipantContact.leftId;
              return {
                normal: sameOrder
                  ? activeParticipantContact.normal
                  : {
                      x: -activeParticipantContact.normal.x,
                      y: -activeParticipantContact.normal.y,
                    },
                penetrationMetres: 0,
                contactPoint: activeParticipantContact.contactPosition,
              };
            })()
          : getPhysicsCollisionManifold(
              createPhysicsCollisionShape(
                bodyPose(left),
                participantDimensions(left.profile),
                collisionTolerance / 2,
              ),
              createPhysicsCollisionShape(
                bodyPose(right),
                participantDimensions(right.profile),
                collisionTolerance / 2,
              ),
            );
      if (!manifold) continue;

      const result = resolveParticipantCollision(left, right, manifold);
      if (!result.collided) continue;

      participantCollisions += 1;
      estimatedImpactEnergyKj += result.impactEnergyKj;
      left.collidedWithParticipants.add(right.participant.id);
      right.collidedWithParticipants.add(left.participant.id);
      collisionEvents.push({
        id: `collision-${collisionEvents.length + 1}`,
        timeSeconds: primaryImpactTime,
        type: "Participant-Participant",
        participantIds: [left.participant.id, right.participant.id],
        contactPoint: scenePosition(manifold.contactPoint, width, height),
        normal: { ...manifold.normal },
        relativeSpeedKmh: Number(result.relativeSpeedKmh.toFixed(2)),
        normalImpulseNs: Number(result.normalImpulseNs.toFixed(2)),
        frictionImpulseNs: Number(result.frictionImpulseNs.toFixed(2)),
        estimatedEnergyKj: Number(result.impactEnergyKj.toFixed(2)),
        angularVelocityChangesDegPerSecond:
          result.angularVelocityChangesDegPerSecond,
      });
    }
  }

  if (activeParticipantContact) {
    warnings.push(
      `Continuous contact detection found the first participant collision at ${primaryImpactTime.toFixed(2)}s, before or at the authored primary marker.`,
    );
  } else if (activeObjectContact) {
    const objectLabel = source.sceneObjects.find(
      (object) => object.id === activeObjectContact.objectId,
    )?.label ?? "a solid scene object";
    const participantName = participants.find(
      (participant) => participant.id === activeObjectContact.participantId,
    )?.name ?? "A participant";
    warnings.push(
      `Continuous contact detection found ${participantName}'s first solid-object impact with ${objectLabel} at ${primaryImpactTime.toFixed(2)}s, before the authored primary marker.`,
    );
  } else if (participants.length > 1) {
    warnings.push(
      "No earlier participant or solid-object contact was found along the guided routes; the authored impact timing was used.",
    );
  }

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
    profile: resolveSceneObjectPhysicsProfile(object),
    position: worldPosition(object.position, width, height),
    pose: sceneObjectPose(object, width, height),
  }));

  for (
    let time = impactTime + step;
    time <= maximumSimulationTime + 0.0001;
    time += step
  ) {
    bodies.forEach((body) => {
      body.previousPosition = { ...body.position };
      body.previousRotation = body.rotation;
    });

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

      const speed = magnitude(body.velocity);
      let nextSpeed = speed;
      if (speed > 0) {
        const direction = normalise(body.velocity);
        const estimateTravel = (friction: number) => {
          const frictionLimitedDeceleration = Math.max(
            0.35,
            9.81 * friction * 0.72,
          );
          const deceleration = Math.min(
            body.profile.brakingDecelerationMps2,
            frictionLimitedDeceleration,
          );
          const drag = speed * settings.airDrag;
          const estimatedNextSpeed = Math.max(
            0,
            speed - (deceleration + drag) * step,
          );
          const averageTravelSpeed = (speed + estimatedNextSpeed) / 2;
          return {
            nextSpeed: estimatedNextSpeed,
            end: {
              x: body.previousPosition.x + direction.x * averageTravelSpeed * step,
              y: body.previousPosition.y + direction.y * averageTravelSpeed * step,
            },
          };
        };

        const preliminaryTravel = estimateTravel(localFriction);
        objects.forEach(({ object, profile, position }) => {
          if (!profile.enabled || !LOW_GRIP_OBJECT_TYPES.has(object.type)) return;
          const interactionDistance =
            body.profile.collisionRadiusMetres + profile.collisionRadiusMetres;
          if (
            firstContactOnStep(
              body.previousPosition,
              preliminaryTravel.end,
              position,
              position,
              interactionDistance,
            )
          ) {
            localFriction *= profile.surfaceFrictionMultiplier;
          }
        });

        const travel = estimateTravel(localFriction);
        nextSpeed = travel.nextSpeed;
        body.position = travel.end;
        body.velocity = {
          x: direction.x * nextSpeed,
          y: direction.y * nextSpeed,
        };
      }

      const objectContacts = objects
        .flatMap(({ object, profile, pose }) => {
          if (!profile.enabled) return [];
          const contact = findSweptPhysicsCollision(
            bodyPose(body, true),
            bodyPose(body, false),
            participantDimensions(body.profile),
            pose,
            pose,
            objectDimensions(profile),
            profile.collidable ? collisionTolerance : 0,
          );
          return contact ? [{ object, profile, contact }] : [];
        })
        .sort((left, right) => left.contact.alpha - right.contact.alpha);

      for (const { object, profile, contact } of objectContacts) {
        body.position = { ...contact.leftPose.position };
        body.rotation = contact.leftPose.rotationDegrees;

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
          continue;
        }

        if (LOW_GRIP_OBJECT_TYPES.has(object.type)) {
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
          continue;
        }

        if (profile.collidable && !body.collidedWithObjects.has(object.id)) {
          const result = resolveStaticObjectCollision(body, profile, contact.manifold);
          if (!result.collided) continue;
          body.position = {
            x: body.position.x - contact.manifold.normal.x * contact.manifold.penetrationMetres,
            y: body.position.y - contact.manifold.normal.y * contact.manifold.penetrationMetres,
          };
          body.collidedWithObjects.add(object.id);
          interactedObjects.add(object.id);
          solidObjectImpacts += 1;
          estimatedImpactEnergyKj += result.impactEnergyKj;
          collisionEvents.push({
            id: `collision-${collisionEvents.length + 1}`,
            timeSeconds: time - step + step * contact.alpha,
            type: "Participant-Object",
            participantIds: [body.participant.id],
            sceneObjectId: object.id,
            contactPoint: scenePosition(contact.manifold.contactPoint, width, height),
            normal: { ...contact.manifold.normal },
            relativeSpeedKmh: Number(result.relativeSpeedKmh.toFixed(2)),
            normalImpulseNs: Number(result.normalImpulseNs.toFixed(2)),
            frictionImpulseNs: Number(result.frictionImpulseNs.toFixed(2)),
            estimatedEnergyKj: Number(result.impactEnergyKj.toFixed(2)),
            angularVelocityChangesDegPerSecond:
              result.angularVelocityChangesDegPerSecond,
          });
          action = "Ricochet";
          label = `Impact with ${object.label}`;
          linkedSceneObjectId = object.id;
          break;
        }
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

        const contact = findSweptPhysicsCollision(
          bodyPose(left, true),
          bodyPose(left, false),
          participantDimensions(left.profile),
          bodyPose(right, true),
          bodyPose(right, false),
          participantDimensions(right.profile),
          collisionTolerance,
        );
        if (!contact) continue;

        left.position = { ...contact.leftPose.position };
        left.rotation = contact.leftPose.rotationDegrees;
        right.position = { ...contact.rightPose.position };
        right.rotation = contact.rightPose.rotationDegrees;
        left.stopped = false;
        right.stopped = false;
        const result = resolveParticipantCollision(left, right, contact.manifold);
        if (!result.collided) continue;

        const totalMass = left.profile.massKg + right.profile.massKg;
        left.position = {
          x:
            left.position.x -
            contact.manifold.normal.x *
              contact.manifold.penetrationMetres *
              (right.profile.massKg / totalMass),
          y:
            left.position.y -
            contact.manifold.normal.y *
              contact.manifold.penetrationMetres *
              (right.profile.massKg / totalMass),
        };
        right.position = {
          x:
            right.position.x +
            contact.manifold.normal.x *
              contact.manifold.penetrationMetres *
              (left.profile.massKg / totalMass),
          y:
            right.position.y +
            contact.manifold.normal.y *
              contact.manifold.penetrationMetres *
              (left.profile.massKg / totalMass),
        };
        left.collidedWithParticipants.add(right.participant.id);
        right.collidedWithParticipants.add(left.participant.id);
        participantCollisions += 1;
        estimatedImpactEnergyKj += result.impactEnergyKj;
        const contactTime = time - step + step * contact.alpha;
        collisionEvents.push({
          id: `collision-${collisionEvents.length + 1}`,
          timeSeconds: contactTime,
          type: "Participant-Participant",
          participantIds: [left.participant.id, right.participant.id],
          contactPoint: scenePosition(contact.manifold.contactPoint, width, height),
          normal: { ...contact.manifold.normal },
          relativeSpeedKmh: Number(result.relativeSpeedKmh.toFixed(2)),
          normalImpulseNs: Number(result.normalImpulseNs.toFixed(2)),
          frictionImpulseNs: Number(result.frictionImpulseNs.toFixed(2)),
          estimatedEnergyKj: Number(result.impactEnergyKj.toFixed(2)),
          angularVelocityChangesDegPerSecond:
            result.angularVelocityChangesDegPerSecond,
        });

        left.points.push(
          makePhysicsPoint(
            left,
            contactTime,
            scenePosition(left.position, width, height),
            "Impact",
            `Contact with ${right.participant.name}`,
          ),
        );
        right.points.push(
          makePhysicsPoint(
            right,
            contactTime,
            scenePosition(right.position, width, height),
            "Impact",
            `Contact with ${left.participant.name}`,
          ),
        );
        generatedPathPoints += 2;
        simulatedDurationSeconds = Math.max(simulatedDurationSeconds, contactTime);
      }
    }

    if (bodies.length > 0 && bodies.every((body) => body.stopped)) break;
  }

  const updatedVehicles = source.vehicles.map((participant) => {
    const body = bodies.find((candidate) => candidate.participant.id === participant.id);
    if (!body || body.points.length === 0) {
      return {
        ...participant,
        physics: resolveParticipantPhysicsProfile(participant),
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

  const firstCollisionEvent = [...collisionEvents].sort(
    (left, right) =>
      left.timeSeconds - right.timeSeconds,
  )[0];
  const firstParticipantCollisionEvent = collisionEvents
    .filter(
      (event) =>
        event.type === "Participant-Participant",
    )
    .sort(
      (left, right) =>
        left.timeSeconds - right.timeSeconds,
    )[0];

  if (firstParticipantCollisionEvent) {
    const horizontalOffsetMetres =
      ((firstParticipantCollisionEvent.contactPoint.x -
        source.collisionPoint.x) /
        100) *
      width;
    const verticalOffsetMetres =
      ((firstParticipantCollisionEvent.contactPoint.y -
        source.collisionPoint.y) /
        100) *
      height;
    const markerOffsetMetres = Math.hypot(
      horizontalOffsetMetres,
      verticalOffsetMetres,
    );

    if (markerOffsetMetres > Math.max(0.35, collisionTolerance * 2)) {
      warnings.push(
        `The first participant contact occurred ${markerOffsetMetres.toFixed(2)} m from the centre of the primary collision marker. The marker is visual only; adjust the routes or marker if the intended contact should occur at its centre.`,
      );
    }
  }

  const summary: PhysicsSimulationSummary = {
    solverVersion: "RoadSafe Physics V2",
    ranAt: new Date().toISOString(),
    participantCollisions,
    primaryImpactTimeSeconds:
      firstCollisionEvent?.timeSeconds ??
      primaryImpactTime,
    estimatedImpactEnergyKj: Number(estimatedImpactEnergyKj.toFixed(1)),
    solidObjectImpacts,
    potholeInteractions,
    surfaceInteractions,
    generatedPathPoints,
    simulatedDurationSeconds: Number(simulatedDurationSeconds.toFixed(2)),
    collisionEvents,
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
    collisionPoint: { ...source.collisionPoint },
    durationSeconds: Number(
      Math.max(source.durationSeconds, simulatedDurationSeconds).toFixed(2),
    ),
    vehicles: updatedVehicles,
    sceneObjects: source.sceneObjects.map((object) => ({
      ...object,
      physics: resolveSceneObjectPhysicsProfile(object),
    })),
    physicsSettings: settings,
    lastPhysicsSimulation: summary,
    timelineEvents: [...preservedTimeline, ...generatedTimelineEvents],
  };
}