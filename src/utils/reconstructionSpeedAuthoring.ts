/*
 * [RoadSafe:AuthoritativeParticipantSpeedV1.1]
 * [RoadSafe:ParticipantStartContinuityV1]
 *
 * Speed edits must be immediately visible without delaying a participant's
 * authored route start.
 *
 * V1 introduced participant-specific delayed starts to keep every speed and the
 * shared Point Z mathematically exact at once. That made some participants
 * appear frozen after a speed edit.
 *
 * V1.1 changes the interpretation:
 * - the investigator-entered participant speed is the authoritative
 *   APPROACH / ENTRY speed;
 * - authored route timestamps, including Point 1 and Point Z, stay unchanged;
 * - the pre-impact speed profile is smoothly shifted toward the new approach
 *   speed, strongest at Point 1 and weaker toward Point Z;
 * - the emergency-braking layer can then perform the final split-second speed
 *   loss before actual Rapier contact;
 * - stale generated post-impact physics points are removed immediately.
 *
 * This preserves synchronized accident timing and removes the "wait several
 * seconds before moving" behavior.
 */

import type {
  AccidentReconstruction,
  MovementPathPoint,
  ReconstructionVehicle,
} from "../types/reconstruction";

import {
  isPhysicsGeneratedPathPoint,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "./reconstructionGeometry";

import {
  getDefaultParticipantPhysics,
} from "../services/reconstructionPhysicsService";

import {
  isPointZ,
} from "./participantRouteAuthoring";

const HUMAN_TYPES =
  new Set<
    ReconstructionVehicle["type"]
  >([
    "Pedestrian",
    "Officer",
    "Witness",
  ]);

const MINIMUM_SPEED_KMH =
  0.1;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function effectiveParticipantSpeedKmh(
  participant:
    ReconstructionVehicle,
): number {
  return Math.max(
    0,
    participant.physics
      ?.inputSpeedKmh ??
      participant
        .estimatedSpeedKmh,
  );
}

function participantSpeedLimitKmh(
  participant:
    ReconstructionVehicle,
  requested:
    number,
): number {
  if (
    HUMAN_TYPES.has(
      participant.type,
    )
  ) {
    return Math.min(
      6.5,
      Math.max(
        0,
        requested,
      ),
    );
  }

  return Math.max(
    0,
    requested,
  );
}

function isStopPoint(
  point:
    MovementPathPoint,
): boolean {
  return (
    point.action ===
    "Stop"
  );
}

function authoredPathPoints(
  participant:
    ReconstructionVehicle,
): MovementPathPoint[] {
  return sortMovementPathPoints(
    participant.pathPoints,
  ).filter(
    (point) =>
      !isPhysicsGeneratedPathPoint(
        point,
      ),
  );
}

function pointZIndex(
  points:
    MovementPathPoint[],
): number {
  const explicit =
    points.findIndex(
      isPointZ,
    );

  if (
    explicit >=
    0
  ) {
    return explicit;
  }

  const impact =
    points.findIndex(
      (point) =>
        point.action ===
        "Impact",
    );

  return impact >=
    0
    ? impact
    : Math.max(
        0,
        points.length -
          1,
      );
}

function matchingPoint(
  participant:
    ReconstructionVehicle,
  pointId:
    string,
): MovementPathPoint | undefined {
  return participant
    .pathPoints
    .find(
      (point) =>
        point.id ===
        pointId,
    );
}

function applyApproachSpeedToParticipant(
  previous:
    ReconstructionVehicle,
  proposed:
    ReconstructionVehicle,
): ReconstructionVehicle {
  const previousSpeed =
    effectiveParticipantSpeedKmh(
      previous,
    );

  const requestedSpeed =
    participantSpeedLimitKmh(
      proposed,
      effectiveParticipantSpeedKmh(
        proposed,
      ),
    );

  const points =
    authoredPathPoints(
      proposed,
    );

  if (
    points.length ===
    0
  ) {
    return {
      ...proposed,
      estimatedSpeedKmh:
        requestedSpeed,

      physics: {
        ...getDefaultParticipantPhysics(
          proposed,
        ),
        ...(proposed.physics ??
          {}),
        inputSpeedKmh:
          requestedSpeed,
      },
    };
  }

  const impactIndex =
    pointZIndex(
      points,
    );

  const speedDelta =
    requestedSpeed -
    previousSpeed;

  const preImpactDivisor =
    Math.max(
      1,
      impactIndex,
    );

  const adjustedPoints =
    points.map(
      (
        point,
        index,
      ) => {
        if (
          isStopPoint(
            point,
          )
        ) {
          return {
            ...point,
            speedKmh: 0,
          };
        }

        /*
         * Do not rewrite authored post-impact evidence points. Rapier will
         * regenerate dynamic post-impact samples on the next bake.
         */
        if (
          index >
          impactIndex
        ) {
          return point;
        }

        const previousPoint =
          matchingPoint(
            previous,
            point.id,
          );

        const baseSpeed =
          Math.max(
            MINIMUM_SPEED_KMH,
            previousPoint
              ?.speedKmh ??
              point.speedKmh ??
              previousSpeed,
          );

        const progressToImpact =
          clamp(
            index /
              preImpactDivisor,
            0,
            1,
          );

        /*
         * Point 1 receives 100% of the speed edit.
         * Point Z receives 35%.
         *
         * This makes the edited speed visibly authoritative at entry while the
         * route remains synchronized to the existing accident timestamp. The
         * final split-second emergency-braking layer then owns the sharp speed
         * reduction immediately before contact.
         */
        const authorityWeight =
          1 -
          0.65 *
          progressToImpact;

        const adjustedSpeed =
          Math.max(
            MINIMUM_SPEED_KMH,
            baseSpeed +
              speedDelta *
              authorityWeight,
          );

        return {
          ...point,

          /*
           * CRITICAL: keep timeSeconds exactly as authored.
           * Speed edits must never introduce a delayed route start again.
           */
          timeSeconds:
            point.timeSeconds,

          speedKmh:
            Number(
              adjustedSpeed.toFixed(
                4,
              ),
            ),
        };
      },
    );

  return syncLegacyParticipantFields({
    ...proposed,

    estimatedSpeedKmh:
      requestedSpeed,

    physics: {
        ...getDefaultParticipantPhysics(
          proposed,
        ),
        ...(proposed.physics ??
          {}),
        inputSpeedKmh:
          requestedSpeed,
      },

    pathPoints:
      adjustedPoints,
  });
}

export function applyAuthoritativeParticipantSpeedChanges(
  current:
    AccidentReconstruction,
  proposed:
    AccidentReconstruction,
): AccidentReconstruction {
  const previousById =
    new Map(
      current.vehicles.map(
        (participant) => [
          participant.id,
          participant,
        ],
      ),
    );

  const changedIds =
    new Set<string>();

  proposed.vehicles.forEach(
    (participant) => {
      const previous =
        previousById.get(
          participant.id,
        );

      if (!previous) {
        return;
      }

      if (
        Math.abs(
          effectiveParticipantSpeedKmh(
            previous,
          ) -
          effectiveParticipantSpeedKmh(
            participant,
          ),
        ) >
        0.0001
      ) {
        changedIds.add(
          participant.id,
        );
      }
    },
  );

  if (
    changedIds.size ===
    0
  ) {
    return proposed;
  }

  const vehicles =
    proposed.vehicles.map(
      (participant) => {
        const authoredOnly = {
          ...participant,

          /*
           * Any speed edit invalidates the old Rapier bake. Remove generated
           * playback samples immediately so a stale trajectory cannot continue
           * after the investigator changes approach speed.
           */
          pathPoints:
            authoredPathPoints(
              participant,
            ),
        };

        if (
          !changedIds.has(
            participant.id,
          )
        ) {
          return syncLegacyParticipantFields(
            authoredOnly,
          );
        }

        const previous =
          previousById.get(
            participant.id,
          );

        if (!previous) {
          return syncLegacyParticipantFields(
            authoredOnly,
          );
        }

        return applyApproachSpeedToParticipant(
          previous,
          authoredOnly,
        );
      },
    );

  return {
    ...proposed,

    lastPhysicsSimulation:
      undefined,

    /*
     * No duration or participant start-time changes are made here.
     * Point 1 and Point Z timing remain exactly where the investigator had
     * them before editing speed.
     */
    durationSeconds:
      proposed
        .durationSeconds,

    vehicles,
  };
}
