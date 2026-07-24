import type {
  AccidentReconstruction,
  MovementPathPoint,
  ReconstructionPosition,
  ReconstructionVehicle,
  ReconstructionVehicleColour,
  ReconstructionVehicleType,
} from "../types/reconstruction";

import {
  applySafeAuthoredPointUpdate,
  canMoveAuthoredRoutePoint,
  createLockedParticipantRoute,
  getAuthoredImpactPoint,
  insertProgressiveRoutePoint,
  isPhysicsGeneratedRoutePoint,
  isPointZ,
  normalisePointZRoute,
  removeIntermediateRoutePoint,
  updatePointZPosition,
} from "./participantRouteAuthoring";

import {
  clamp,
  syncLegacyParticipantFields,
} from "./reconstructionGeometry";

export interface PendingParticipantPlacement {
  type: ReconstructionVehicleType;
  index: number;
}

interface ParticipantFactoryOptions {
  type: ReconstructionVehicleType;
  index: number;
  startPosition: ReconstructionPosition;
  collisionPosition: ReconstructionPosition;
  durationSeconds: number;
  createId: (prefix: string) => string;
  getDefaultSpeed: (
    type: ReconstructionVehicleType,
  ) => number;
  getDefaultRole: (
    type: ReconstructionVehicleType,
  ) => ReconstructionVehicle["role"];
  isHumanParticipant: (
    type: ReconstructionVehicleType,
  ) => boolean;
}

interface UpdateCollisionPointOptions {
  reconstruction: AccidentReconstruction;
  collisionPosition: ReconstructionPosition;
  source: "Manual" | "Derived";
  confirmed?: boolean;
  locked?: boolean;
}

function participantColour(
  human: boolean,
  index: number,
): ReconstructionVehicleColour {
  if (human) {
    return "Yellow";
  }

  return index % 2 === 0 ? "Red" : "Blue";
}

function clearGeneratedPhysicsPoints(
  pathPoints: MovementPathPoint[],
): MovementPathPoint[] {
  return pathPoints.filter(
    (point) => !isPhysicsGeneratedRoutePoint(point),
  );
}

function normaliseParticipant(
  participant: ReconstructionVehicle,
  reconstruction: Pick<
    AccidentReconstruction,
    "collisionPoint" | "durationSeconds"
  >,
  createId?: (prefix: string) => string,
): ReconstructionVehicle {
  const pathPoints = normalisePointZRoute({
    pathPoints: clearGeneratedPhysicsPoints(
      participant.pathPoints,
    ),
    collisionPosition:
      reconstruction.collisionPoint,
    durationSeconds:
      reconstruction.durationSeconds,
    speedKmh:
      participant.estimatedSpeedKmh,
    participantType: participant.type,
    createId,
  });

  return syncLegacyParticipantFields({
    ...participant,
    pathPoints,
  });
}

export function createParticipantAtConfirmedPosition({
  type,
  index,
  startPosition,
  collisionPosition,
  durationSeconds,
  createId,
  getDefaultSpeed,
  getDefaultRole,
  isHumanParticipant,
}: ParticipantFactoryOptions): ReconstructionVehicle {
  const estimatedSpeedKmh =
    getDefaultSpeed(type);

  const pathPoints = createLockedParticipantRoute({
    startPosition,
    collisionPosition,
    durationSeconds,
    speedKmh: estimatedSpeedKmh,
    participantType: type,
    createId,
  });

  return syncLegacyParticipantFields({
    id: createId("participant"),
    name: `${type} ${index}`,
    type,
    colour: participantColour(
      isHumanParticipant(type),
      index,
    ),
    estimatedSpeedKmh,
    originLocation: "",
    destinationLocation: "",
    pathPoints,
    startPosition: pathPoints[0].position,
    collisionPosition:
      pathPoints[pathPoints.length - 1].position,
    finalPosition:
      pathPoints[pathPoints.length - 1].position,
    startRotation: pathPoints[0].rotation,
    collisionRotation:
      pathPoints[pathPoints.length - 1].rotation,
    finalRotation:
      pathPoints[pathPoints.length - 1].rotation,
    collisionTimeSeconds:
      pathPoints[pathPoints.length - 1]
        .timeSeconds,
    role: getDefaultRole(type),
    injured: false,
  });
}

export function normaliseAllPointZRoutes(
  reconstruction: AccidentReconstruction,
  createId?: (prefix: string) => string,
): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation: undefined,
    vehicles: reconstruction.vehicles.map(
      (participant) =>
        normaliseParticipant(
          participant,
          reconstruction,
          createId,
        ),
    ),
  };
}

export function updateReconstructionCollisionPoint({
  reconstruction,
  collisionPosition,
  source,
  confirmed,
  locked,
}: UpdateCollisionPointOptions): AccidentReconstruction {
  const now = new Date().toISOString();

  const vehicles =
    reconstruction.vehicles.map(
      (participant) =>
        syncLegacyParticipantFields({
          ...participant,
          pathPoints: updatePointZPosition({
            pathPoints:
              clearGeneratedPhysicsPoints(
                participant.pathPoints,
              ),
            collisionPosition,
            durationSeconds:
              reconstruction.durationSeconds,
            speedKmh:
              participant.estimatedSpeedKmh,
            participantType:
              participant.type,
          }),
        }),
    );

  return {
    ...reconstruction,
    collisionPoint: {
      ...collisionPosition,
    },
    collisionSetup: {
      source,
      confirmed:
        confirmed ??
        reconstruction.collisionSetup
          ?.confirmed ??
        false,
      locked:
        locked ??
        reconstruction.collisionSetup
          ?.locked ??
        false,
      toleranceMetres:
        reconstruction.collisionSetup
          ?.toleranceMetres ?? 2,
      notes:
        reconstruction.collisionSetup
          ?.notes ?? "",
      confidence:
        reconstruction.collisionSetup
          ?.confidence,
      lastCalculatedAt: now,
    },
    lastPhysicsSimulation: undefined,
    vehicles,
  };
}

export function updateParticipantAuthoredPoint({
  reconstruction,
  participantId,
  pointId,
  updates,
}: {
  reconstruction: AccidentReconstruction;
  participantId: string;
  pointId: string;
  updates: Partial<MovementPathPoint>;
}): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation: undefined,
    vehicles: reconstruction.vehicles.map(
      (participant) => {
        if (participant.id !== participantId) {
          return participant;
        }

        const pathPoints =
          applySafeAuthoredPointUpdate({
            pathPoints:
              clearGeneratedPhysicsPoints(
                participant.pathPoints,
              ),
            pointId,
            updates,
            collisionPosition:
              reconstruction.collisionPoint,
            durationSeconds:
              reconstruction.durationSeconds,
            speedKmh:
              participant.estimatedSpeedKmh,
            participantType:
              participant.type,
          });

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints,
        });
      },
    ),
  };
}

export function insertParticipantIntermediatePoint({
  reconstruction,
  participantId,
  selectedPointId,
  createId,
}: {
  reconstruction: AccidentReconstruction;
  participantId: string;
  selectedPointId: string | null;
  createId: (prefix: string) => string;
}): {
  reconstruction: AccidentReconstruction;
  insertedPointId: string | null;
} {
  let insertedPointId: string | null = null;

  const vehicles =
    reconstruction.vehicles.map(
      (participant) => {
        if (participant.id !== participantId) {
          return participant;
        }

        const normalised =
          normalisePointZRoute({
            pathPoints:
              clearGeneratedPhysicsPoints(
                participant.pathPoints,
              ),
            collisionPosition:
              reconstruction.collisionPoint,
            durationSeconds:
              reconstruction.durationSeconds,
            speedKmh:
              participant.estimatedSpeedKmh,
            participantType:
              participant.type,
            createId,
          });

        const inserted =
          insertProgressiveRoutePoint({
            pathPoints: normalised,
            selectedPointId,
            durationSeconds:
              reconstruction.durationSeconds,
            createId,
          });

        insertedPointId =
          inserted.insertedPointId;

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints: inserted.pathPoints,
        });
      },
    );

  return {
    insertedPointId,
    reconstruction: {
      ...reconstruction,
      lastPhysicsSimulation: undefined,
      vehicles,
    },
  };
}

export function deleteParticipantIntermediatePoint({
  reconstruction,
  participantId,
  pointId,
}: {
  reconstruction: AccidentReconstruction;
  participantId: string;
  pointId: string;
}): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation: undefined,
    vehicles: reconstruction.vehicles.map(
      (participant) => {
        if (participant.id !== participantId) {
          return participant;
        }

        const pathPoints =
          removeIntermediateRoutePoint({
            pathPoints:
              clearGeneratedPhysicsPoints(
                participant.pathPoints,
              ),
            pointId,
          });

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints:
            normalisePointZRoute({
              pathPoints,
              collisionPosition:
                reconstruction.collisionPoint,
              durationSeconds:
                reconstruction.durationSeconds,
              speedKmh:
                participant.estimatedSpeedKmh,
              participantType:
                participant.type,
            }),
        });
      },
    ),
  };
}

function sampleDrawnRoute(
  routePoints: ReconstructionPosition[],
  maximumIntermediatePoints = 16,
): ReconstructionPosition[] {
  if (routePoints.length <= 2) {
    return routePoints;
  }

  const sampleStep = Math.max(
    1,
    Math.ceil(
      routePoints.length /
        Math.max(
          2,
          maximumIntermediatePoints,
        ),
    ),
  );

  const sampled = routePoints.filter(
    (_, index) => index % sampleStep === 0,
  );

  const final =
    routePoints[routePoints.length - 1];

  if (
    sampled[sampled.length - 1] !== final
  ) {
    sampled.push(final);
  }

  return sampled;
}

function routePointDistance(
  first: ReconstructionPosition,
  second: ReconstructionPosition,
): number {
  return Math.hypot(
    second.x - first.x,
    second.y - first.y,
  );
}

function nearestDrawnIndex(
  points: ReconstructionPosition[],
  target: ReconstructionPosition,
): number {
  return points.reduce(
    (bestIndex, point, index) =>
      routePointDistance(point, target) <
      routePointDistance(
        points[bestIndex],
        target,
      )
        ? index
        : bestIndex,
    0,
  );
}

export function replaceParticipantRouteFromDrawing({
  reconstruction,
  participantId,
  routePoints,
  createId,
}: {
  reconstruction: AccidentReconstruction;
  participantId: string;
  routePoints: ReconstructionPosition[];
  createId: (prefix: string) => string;
}): AccidentReconstruction {
  if (routePoints.length < 2) {
    return reconstruction;
  }

  const sampled =
    sampleDrawnRoute(routePoints);

  return {
    ...reconstruction,
    lastPhysicsSimulation: undefined,
    vehicles: reconstruction.vehicles.map(
      (participant) => {
        if (participant.id !== participantId) {
          return participant;
        }

        const oldPointZ =
          getAuthoredImpactPoint(
            participant.pathPoints,
          );

        const pointZTime =
          oldPointZ?.timeSeconds ??
          reconstruction.durationSeconds *
            0.55;

        const impactIndex =
          nearestDrawnIndex(
            sampled,
            reconstruction.collisionPoint,
          );

        const beforeImpact =
          sampled.slice(0, impactIndex + 1);

        const startPosition =
          beforeImpact[0] ??
          participant.startPosition;

        const base =
          createLockedParticipantRoute({
            startPosition,
            collisionPosition:
              reconstruction.collisionPoint,
            durationSeconds:
              reconstruction.durationSeconds,
            speedKmh:
              participant.estimatedSpeedKmh,
            participantType:
              participant.type,
            createId,
            impactTimeSeconds: pointZTime,
          });

        let pathPoints = base;

        const interior =
          beforeImpact.slice(1, -1);

        interior.forEach((position) => {
          const inserted =
            insertProgressiveRoutePoint({
              pathPoints,
              selectedPointId:
                pathPoints[
                  pathPoints.length - 2
                ]?.id ?? null,
              durationSeconds:
                reconstruction.durationSeconds,
              createId,
            });

          pathPoints =
            inserted.pathPoints.map(
              (point) =>
                point.id ===
                inserted.insertedPointId
                  ? {
                      ...point,
                      position,
                    }
                  : point,
            );
        });

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints:
            normalisePointZRoute({
              pathPoints,
              collisionPosition:
                reconstruction.collisionPoint,
              durationSeconds:
                reconstruction.durationSeconds,
              speedKmh:
                participant.estimatedSpeedKmh,
              participantType:
                participant.type,
              createId,
            }),
        });
      },
    ),
  };
}

export function changeParticipantApproachHeading({
  reconstruction,
  participantId,
  headingLabel,
  degrees,
}: {
  reconstruction: AccidentReconstruction;
  participantId: string;
  headingLabel: string;
  degrees: number;
}): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation: undefined,
    vehicles: reconstruction.vehicles.map(
      (participant) => {
        if (participant.id !== participantId) {
          return participant;
        }

        const pathPoints =
          normalisePointZRoute({
            pathPoints:
              clearGeneratedPhysicsPoints(
                participant.pathPoints,
              ),
            collisionPosition:
              reconstruction.collisionPoint,
            durationSeconds:
              reconstruction.durationSeconds,
            speedKmh:
              participant.estimatedSpeedKmh,
            participantType:
              participant.type,
          });

        const authored =
          pathPoints.filter(
            (point) =>
              !isPhysicsGeneratedRoutePoint(
                point,
              ),
          );

        const pointOne =
          authored[0];

        const pointZ =
          authored[
            authored.length - 1
          ];

        if (!pointOne || !pointZ) {
          return participant;
        }

        const radians =
          (degrees * Math.PI) / 180;

        const approachDistance = clamp(
          Math.hypot(
            pointZ.position.x -
              pointOne.position.x,
            pointZ.position.y -
              pointOne.position.y,
          ),
          8,
          45,
        );

        const startPosition = {
          x: clamp(
            pointZ.position.x -
              Math.cos(radians) *
                approachDistance,
            3,
            97,
          ),
          y: clamp(
            pointZ.position.y -
              Math.sin(radians) *
                approachDistance,
            3,
            97,
          ),
        };

        const updated = pathPoints.map(
          (point) =>
            point.id === pointOne.id
              ? {
                  ...point,
                  position: startPosition,
                }
              : point,
        );

        return syncLegacyParticipantFields({
          ...participant,
          destinationLocation:
            `${headingLabel}bound`,
          pathPoints:
            normalisePointZRoute({
              pathPoints: updated,
              collisionPosition:
                reconstruction.collisionPoint,
              durationSeconds:
                reconstruction.durationSeconds,
              speedKmh:
                participant.estimatedSpeedKmh,
              participantType:
                participant.type,
            }),
        });
      },
    ),
  };
}

export function canBeginRoutePointDrag(
  point: MovementPathPoint,
): boolean {
  return canMoveAuthoredRoutePoint(point);
}

export function isLockedCollisionAnchor(
  point: MovementPathPoint,
): boolean {
  return isPointZ(point);
}
