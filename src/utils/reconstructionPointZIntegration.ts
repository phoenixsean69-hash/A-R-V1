import { getReconstructionWorldDimensions } from "./reconstructionWorldScale";
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
  FREEHAND_ROUTE_NOTE_MARKER,
  getAuthoredImpactPoint,
  insertProgressiveRoutePoint,
  isPhysicsGeneratedRoutePoint,
  isPointZ,
  MANUAL_ROUTE_ANCHOR_NOTE_MARKER,
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
  startPosition:
    ReconstructionPosition;
  collisionPosition:
    ReconstructionPosition;
  durationSeconds: number;
  worldDimensions?: {
    widthMetres: number;
    heightMetres: number;
  };
  createId:
    (prefix: string) => string;
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
  reconstruction:
    AccidentReconstruction;
  collisionPosition:
    ReconstructionPosition;
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

  return index % 2 === 0
    ? "Red"
    : "Blue";
}

function clearGeneratedPhysicsPoints(
  pathPoints: MovementPathPoint[],
): MovementPathPoint[] {
  return pathPoints.filter(
    (point) =>
      !isPhysicsGeneratedRoutePoint(
        point,
      ),
  );
}

function normaliseParticipant(
  participant:
    ReconstructionVehicle,
  reconstruction: Pick<
    AccidentReconstruction,
    | "collisionPoint"
    | "durationSeconds"
    | "scene"
  >,
  createId?:
    (prefix: string) => string,
): ReconstructionVehicle {
  const pathPoints =
    normalisePointZRoute({
      pathPoints:
        clearGeneratedPhysicsPoints(
          participant.pathPoints,
        ),
      collisionPosition:
        reconstruction
          .collisionPoint,
      durationSeconds:
        reconstruction
          .durationSeconds,
      speedKmh:
        participant
          .estimatedSpeedKmh,
      participantType:
        participant.type,
      createId,
      worldDimensions:
        getReconstructionWorldDimensions(
          reconstruction,
        ),
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
  worldDimensions,
  createId,
  getDefaultSpeed,
  getDefaultRole,
  isHumanParticipant,
}: ParticipantFactoryOptions): ReconstructionVehicle {
  const estimatedSpeedKmh =
    getDefaultSpeed(type);

  const pathPoints =
    createLockedParticipantRoute({
      startPosition,
      collisionPosition,
      durationSeconds,
      speedKmh:
        estimatedSpeedKmh,
      participantType: type,
      worldDimensions,
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
    startPosition:
      pathPoints[0].position,
    collisionPosition:
      pathPoints[
        pathPoints.length - 1
      ].position,
    finalPosition:
      pathPoints[
        pathPoints.length - 1
      ].position,
    startRotation:
      pathPoints[0].rotation,
    collisionRotation:
      pathPoints[
        pathPoints.length - 1
      ].rotation,
    finalRotation:
      pathPoints[
        pathPoints.length - 1
      ].rotation,
    collisionTimeSeconds:
      pathPoints[
        pathPoints.length - 1
      ].timeSeconds,
    role: getDefaultRole(type),
    injured: false,
  });
}

export function normaliseAllPointZRoutes(
  reconstruction:
    AccidentReconstruction,
  createId?:
    (prefix: string) => string,
): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation:
      undefined,
    vehicles:
      reconstruction.vehicles.map(
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
  const now =
    new Date().toISOString();

  const vehicles =
    reconstruction.vehicles.map(
      (participant) =>
        syncLegacyParticipantFields({
          ...participant,
          pathPoints:
            updatePointZPosition({
              pathPoints:
                clearGeneratedPhysicsPoints(
                  participant
                    .pathPoints,
                ),
              collisionPosition,
              durationSeconds:
                reconstruction
                  .durationSeconds,
              speedKmh:
                participant
                  .estimatedSpeedKmh,
              participantType:
                participant.type,
              worldDimensions:
                getReconstructionWorldDimensions(
                  reconstruction,
                ),
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
        reconstruction
          .collisionSetup
          ?.confirmed ??
        false,
      locked:
        locked ??
        reconstruction
          .collisionSetup
          ?.locked ??
        false,
      toleranceMetres:
        reconstruction
          .collisionSetup
          ?.toleranceMetres ??
        2,
      notes:
        reconstruction
          .collisionSetup
          ?.notes ??
        "",
      confidence:
        reconstruction
          .collisionSetup
          ?.confidence,
      lastCalculatedAt: now,
    },
    lastPhysicsSimulation:
      undefined,
    vehicles,
  };
}

export function updateParticipantAuthoredPoint({
  reconstruction,
  participantId,
  pointId,
  updates,
}: {
  reconstruction:
    AccidentReconstruction;
  participantId: string;
  pointId: string;
  updates:
    Partial<MovementPathPoint>;
}): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation:
      undefined,
    vehicles:
      reconstruction.vehicles.map(
        (participant) => {
          if (
            participant.id !==
            participantId
          ) {
            return participant;
          }

          const pathPoints =
            applySafeAuthoredPointUpdate({
              pathPoints:
                clearGeneratedPhysicsPoints(
                  participant
                    .pathPoints,
                ),
              pointId,
              updates,
              collisionPosition:
                reconstruction
                  .collisionPoint,
              durationSeconds:
                reconstruction
                  .durationSeconds,
              speedKmh:
                participant
                  .estimatedSpeedKmh,
              participantType:
                participant.type,
              worldDimensions:
                getReconstructionWorldDimensions(
                  reconstruction,
                ),
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
  reconstruction:
    AccidentReconstruction;
  participantId: string;
  selectedPointId:
    string | null;
  createId:
    (prefix: string) => string;
}): {
  reconstruction:
    AccidentReconstruction;
  insertedPointId:
    string | null;
} {
  let insertedPointId:
    string | null = null;

  const vehicles =
    reconstruction.vehicles.map(
      (participant) => {
        if (
          participant.id !==
          participantId
        ) {
          return participant;
        }

        const normalised =
          normalisePointZRoute({
            pathPoints:
              clearGeneratedPhysicsPoints(
                participant
                  .pathPoints,
              ),
            collisionPosition:
              reconstruction
                .collisionPoint,
            durationSeconds:
              reconstruction
                .durationSeconds,
            speedKmh:
              participant
                .estimatedSpeedKmh,
            participantType:
              participant.type,
            createId,
            worldDimensions:
              getReconstructionWorldDimensions(
                reconstruction,
              ),
          });

        const inserted =
          insertProgressiveRoutePoint({
            pathPoints: normalised,
            selectedPointId,
            durationSeconds:
              reconstruction
                .durationSeconds,
            createId,
            worldDimensions:
              getReconstructionWorldDimensions(
                reconstruction,
              ),
          });

        insertedPointId =
          inserted.insertedPointId;

        const pathPoints =
          inserted.pathPoints.map(
            (point) =>
              point.id ===
              inserted.insertedPointId
                ? {
                    ...point,
                    notes:
                      MANUAL_ROUTE_ANCHOR_NOTE_MARKER,
                  }
                : point,
          );

        return syncLegacyParticipantFields({
          ...participant,
          pathPoints,
        });
      },
    );

  return {
    insertedPointId,
    reconstruction: {
      ...reconstruction,
      lastPhysicsSimulation:
        undefined,
      vehicles,
    },
  };
}

export function deleteParticipantIntermediatePoint({
  reconstruction,
  participantId,
  pointId,
}: {
  reconstruction:
    AccidentReconstruction;
  participantId: string;
  pointId: string;
}): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation:
      undefined,
    vehicles:
      reconstruction.vehicles.map(
        (participant) => {
          if (
            participant.id !==
            participantId
          ) {
            return participant;
          }

          const pathPoints =
            removeIntermediateRoutePoint({
              pathPoints:
                clearGeneratedPhysicsPoints(
                  participant
                    .pathPoints,
                ),
              pointId,
            });

          return syncLegacyParticipantFields({
            ...participant,
            pathPoints:
              normalisePointZRoute({
                pathPoints,
                collisionPosition:
                  reconstruction
                    .collisionPoint,
                durationSeconds:
                  reconstruction
                    .durationSeconds,
                speedKmh:
                  participant
                    .estimatedSpeedKmh,
                participantType:
                  participant.type,
                worldDimensions:
                  getReconstructionWorldDimensions(
                    reconstruction,
                  ),
              }),
          });
        },
      ),
  };
}

function routePointDistance(
  first: ReconstructionPosition,
  second:
    ReconstructionPosition,
): number {
  return Math.hypot(
    second.x - first.x,
    second.y - first.y,
  );
}

function removeNearDuplicateDrawnPoints(
  routePoints:
    ReconstructionPosition[],
  minimumDistance = 0.16,
): ReconstructionPosition[] {
  const result:
    ReconstructionPosition[] = [];

  for (
    const point of routePoints
  ) {
    const previous =
      result[
        result.length - 1
      ];

    if (
      !previous ||
      routePointDistance(
        previous,
        point,
      ) >= minimumDistance
    ) {
      result.push({
        ...point,
      });
    }
  }

  const final =
    routePoints[
      routePoints.length - 1
    ];

  if (
    final &&
    result[
      result.length - 1
    ] !== final
  ) {
    result.push({
      ...final,
    });
  }

  return result;
}

function smoothDrawnRoute(
  routePoints:
    ReconstructionPosition[],
  passes = 3,
): ReconstructionPosition[] {
  let current =
    routePoints.map(
      (point) => ({
        ...point,
      }),
    );

  for (
    let pass = 0;
    pass < passes;
    pass += 1
  ) {
    current = current.map(
      (
        point,
        index,
        points,
      ) => {
        if (
          index === 0 ||
          index ===
            points.length - 1
        ) {
          return point;
        }

        const previous =
          points[index - 1];

        const next =
          points[index + 1];

        return {
          x:
            previous.x * 0.2 +
            point.x * 0.6 +
            next.x * 0.2,
          y:
            previous.y * 0.2 +
            point.y * 0.6 +
            next.y * 0.2,
        };
      },
    );
  }

  return current;
}

function distanceFromDrawnPointToSegment(
  point: ReconstructionPosition,
  start: ReconstructionPosition,
  end: ReconstructionPosition,
): number {
  const segmentX =
    end.x - start.x;

  const segmentY =
    end.y - start.y;

  const segmentLengthSquared =
    segmentX * segmentX +
    segmentY * segmentY;

  if (
    segmentLengthSquared <
    0.000001
  ) {
    return routePointDistance(
      point,
      start,
    );
  }

  const projection = clamp(
    (
      (
        point.x -
        start.x
      ) *
        segmentX +
      (
        point.y -
        start.y
      ) *
        segmentY
    ) /
      segmentLengthSquared,
    0,
    1,
  );

  return Math.hypot(
    point.x -
      (
        start.x +
        segmentX * projection
      ),
    point.y -
      (
        start.y +
        segmentY * projection
      ),
  );
}

function simplifyDrawnRoute(
  routePoints:
    ReconstructionPosition[],
  tolerance: number,
): ReconstructionPosition[] {
  if (routePoints.length <= 2) {
    return routePoints;
  }

  const first = routePoints[0];

  const last =
    routePoints[
      routePoints.length - 1
    ];

  let furthestIndex = -1;
  let furthestDistance = 0;

  for (
    let index = 1;
    index <
    routePoints.length - 1;
    index += 1
  ) {
    const pointDistance =
      distanceFromDrawnPointToSegment(
        routePoints[index],
        first,
        last,
      );

    if (
      pointDistance >
      furthestDistance
    ) {
      furthestDistance =
        pointDistance;

      furthestIndex = index;
    }
  }

  if (
    furthestIndex < 0 ||
    furthestDistance <= tolerance
  ) {
    return [first, last];
  }

  const left =
    simplifyDrawnRoute(
      routePoints.slice(
        0,
        furthestIndex + 1,
      ),
      tolerance,
    );

  const right =
    simplifyDrawnRoute(
      routePoints.slice(
        furthestIndex,
      ),
      tolerance,
    );

  return [
    ...left.slice(0, -1),
    ...right,
  ];
}

function reduceDrawnRoutePointCount(
  routePoints:
    ReconstructionPosition[],
  maximumPoints: number,
): ReconstructionPosition[] {
  let result =
    routePoints.map(
      (point) => ({
        ...point,
      }),
    );

  while (
    result.length >
    maximumPoints
  ) {
    let removeIndex = -1;

    let smallestDeviation =
      Number.POSITIVE_INFINITY;

    for (
      let index = 1;
      index <
      result.length - 1;
      index += 1
    ) {
      const deviation =
        distanceFromDrawnPointToSegment(
          result[index],
          result[index - 1],
          result[index + 1],
        );

      if (
        deviation <
        smallestDeviation
      ) {
        smallestDeviation =
          deviation;

        removeIndex = index;
      }
    }

    if (removeIndex < 0) {
      break;
    }

    result = result.filter(
      (_, index) =>
        index !== removeIndex,
    );
  }

  return result;
}

function sampleDrawnRoute(
  routePoints:
    ReconstructionPosition[],
  maximumPoints = 8,
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
      0.5,
    );

  const sampled =
    reduceDrawnRoutePointCount(
      simplified,
      Math.max(
        3,
        maximumPoints,
      ),
    );

  /*
   * Preserve the exact start and final pointer locations. Only the noisy
   * interior trace is smoothed and reduced.
   */
  sampled[0] = {
    ...routePoints[0],
  };

  sampled[
    sampled.length - 1
  ] = {
    ...routePoints[
      routePoints.length - 1
    ],
  };

  return sampled;
}

function nearestDrawnIndex(
  points:
    ReconstructionPosition[],
  target:
    ReconstructionPosition,
): number {
  return points.reduce(
    (
      bestIndex,
      point,
      index,
    ) =>
      routePointDistance(
        point,
        target,
      ) <
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
  reconstruction:
    AccidentReconstruction;
  participantId: string;
  routePoints:
    ReconstructionPosition[];
  createId:
    (prefix: string) => string;
}): AccidentReconstruction {
  if (routePoints.length < 2) {
    return reconstruction;
  }

  const sampled =
    sampleDrawnRoute(
      routePoints,
    );

  return {
    ...reconstruction,
    lastPhysicsSimulation:
      undefined,
    vehicles:
      reconstruction.vehicles.map(
        (participant) => {
          if (
            participant.id !==
            participantId
          ) {
            return participant;
          }

          const oldPointZ =
            getAuthoredImpactPoint(
              participant.pathPoints,
            );

          const pointZTime =
            oldPointZ?.timeSeconds ??
            reconstruction
              .durationSeconds *
              0.55;

          const impactIndex =
            nearestDrawnIndex(
              sampled,
              reconstruction
                .collisionPoint,
            );

          const beforeImpact =
            sampled.slice(
              0,
              impactIndex + 1,
            );

          const startPosition =
            beforeImpact[0] ??
            participant
              .startPosition;

          const base =
            createLockedParticipantRoute({
              startPosition,
              collisionPosition:
                reconstruction
                  .collisionPoint,
              durationSeconds:
                reconstruction
                  .durationSeconds,
              speedKmh:
                participant
                  .estimatedSpeedKmh,
              participantType:
                participant.type,
              createId,
              impactTimeSeconds:
                pointZTime,
              worldDimensions:
                getReconstructionWorldDimensions(
                  reconstruction,
                ),
            });

          let pathPoints = base;

          const interior =
            beforeImpact.slice(
              1,
              -1,
            );

          interior.forEach(
            (position) => {
              const inserted =
                insertProgressiveRoutePoint({
                  pathPoints,
                  selectedPointId:
                    pathPoints[
                      pathPoints
                        .length - 2
                    ]?.id ?? null,
                  durationSeconds:
                    reconstruction
                      .durationSeconds,
                  createId,
                  worldDimensions:
                    getReconstructionWorldDimensions(
                      reconstruction,
                    ),
                });

              pathPoints =
                inserted.pathPoints.map(
                  (point) =>
                    point.id ===
                    inserted
                      .insertedPointId
                      ? {
                          ...point,
                          position: {
                            ...position,
                          },
                          notes:
                            FREEHAND_ROUTE_NOTE_MARKER,
                        }
                      : point,
                );
            },
          );

          return syncLegacyParticipantFields({
            ...participant,
            pathPoints:
              normalisePointZRoute({
                pathPoints,
                collisionPosition:
                  reconstruction
                    .collisionPoint,
                durationSeconds:
                  reconstruction
                    .durationSeconds,
                speedKmh:
                  participant
                    .estimatedSpeedKmh,
                participantType:
                  participant.type,
                createId,
                worldDimensions:
                  getReconstructionWorldDimensions(
                    reconstruction,
                  ),
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
  reconstruction:
    AccidentReconstruction;
  participantId: string;
  headingLabel: string;
  degrees: number;
}): AccidentReconstruction {
  return {
    ...reconstruction,
    lastPhysicsSimulation:
      undefined,
    vehicles:
      reconstruction.vehicles.map(
        (participant) => {
          if (
            participant.id !==
            participantId
          ) {
            return participant;
          }

          const pathPoints =
            normalisePointZRoute({
              pathPoints:
                clearGeneratedPhysicsPoints(
                  participant
                    .pathPoints,
                ),
              collisionPosition:
                reconstruction
                  .collisionPoint,
              durationSeconds:
                reconstruction
                  .durationSeconds,
              speedKmh:
                participant
                  .estimatedSpeedKmh,
              participantType:
                participant.type,
              worldDimensions:
                getReconstructionWorldDimensions(
                  reconstruction,
                ),
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

          if (
            !pointOne ||
            !pointZ
          ) {
            return participant;
          }

          const radians =
            (
              degrees *
              Math.PI
            ) / 180;

          const approachDistance =
            clamp(
              Math.hypot(
                pointZ.position.x -
                  pointOne
                    .position.x,
                pointZ.position.y -
                  pointOne
                    .position.y,
              ),
              8,
              45,
            );

          const startPosition = {
            x: clamp(
              pointZ.position.x -
                Math.cos(
                  radians,
                ) *
                  approachDistance,
              3,
              97,
            ),
            y: clamp(
              pointZ.position.y -
                Math.sin(
                  radians,
                ) *
                  approachDistance,
              3,
              97,
            ),
          };

          const updated =
            pathPoints.map(
              (point) =>
                point.id ===
                pointOne.id
                  ? {
                      ...point,
                      position:
                        startPosition,
                    }
                  : point,
            );

          return syncLegacyParticipantFields({
            ...participant,
            destinationLocation:
              `${headingLabel}bound`,
            pathPoints:
              normalisePointZRoute({
                pathPoints:
                  updated,
                collisionPosition:
                  reconstruction
                    .collisionPoint,
                durationSeconds:
                  reconstruction
                    .durationSeconds,
                speedKmh:
                  participant
                    .estimatedSpeedKmh,
                participantType:
                  participant.type,
                worldDimensions:
                  getReconstructionWorldDimensions(
                    reconstruction,
                  ),
              }),
          });
        },
      ),
  };
}

export function canBeginRoutePointDrag(
  point: MovementPathPoint,
): boolean {
  return canMoveAuthoredRoutePoint(
    point,
  );
}

export function isLockedCollisionAnchor(
  point: MovementPathPoint,
): boolean {
  return isPointZ(point);
}
