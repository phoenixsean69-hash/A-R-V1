/*
 * [RoadSafe:AuthoritativeParticipantSpeedV1]
 *
 * A participant speed edit must change actual route motion, not merely a label
 * or Rapier input. Point Z remains a shared collision instant; participant
 * start times move earlier/later so their entered speeds remain physically
 * meaningful while they still arrive at the accident spot together.
 *
 * This helper is invoked only when participant speed changes.
 */

import type {
  AccidentReconstruction,
  MovementPathPoint,
  ReconstructionVehicle,
} from "../types/reconstruction";

import {
  getParticipantMetricPlaybackSegmentLengthsMetres,
  isPhysicsGeneratedPathPoint,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "./reconstructionGeometry";

import {
  isPointZ,
} from "./participantRouteAuthoring";

import {
  getReconstructionWorldDimensions,
} from "./reconstructionWorldScale";

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

const MINIMUM_SEGMENT_SECONDS =
  0.01;

const IMPACT_TIME_MARGIN_SECONDS =
  0.05;

const MINIMUM_POST_IMPACT_SECONDS =
  2;

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

function isStopPoint(
  point:
    MovementPathPoint,
): boolean {
  return (
    point.action ===
    "Stop"
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

function participantSpeedLimitKmh(
  participant:
    ReconstructionVehicle,
  requested: number,
): number {
  if (
    HUMAN_TYPES.has(
      participant.type,
    )
  ) {
    /*
     * Canonical human playback currently caps normal walking at 6.5 km/h.
     * Keep authoring timing consistent with that same motion rule.
     */
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

function scaleChangedParticipantSpeeds(
  previous:
    ReconstructionVehicle,
  next:
    ReconstructionVehicle,
): ReconstructionVehicle {
  const previousSpeed =
    effectiveParticipantSpeedKmh(
      previous,
    );

  const requestedSpeed =
    participantSpeedLimitKmh(
      next,
      effectiveParticipantSpeedKmh(
        next,
      ),
    );

  const points =
    authoredPathPoints(
      previous,
    );

  if (
    points.length ===
    0
  ) {
    return {
      ...next,
      estimatedSpeedKmh:
        requestedSpeed,
      physics: next.physics
        ? {
            ...next.physics,
            inputSpeedKmh:
              requestedSpeed,
          }
        : next.physics,
    };
  }

  const safePreviousSpeed =
    previousSpeed >
      MINIMUM_SPEED_KMH
      ? previousSpeed
      : Math.max(
          MINIMUM_SPEED_KMH,
          points.find(
            (point) =>
              !isStopPoint(
                point,
              ) &&
              point.speedKmh >
                MINIMUM_SPEED_KMH,
          )?.speedKmh ??
            requestedSpeed,
        );

  const scaled =
    points.map(
      (point) => {
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

        const relative =
          safePreviousSpeed >
            MINIMUM_SPEED_KMH
            ? clamp(
                point.speedKmh /
                  safePreviousSpeed,
                0.05,
                4,
              )
            : 1;

        return {
          ...point,
          speedKmh:
            Math.max(
              MINIMUM_SPEED_KMH,
              requestedSpeed *
                relative,
            ),
        };
      },
    );

  return {
    ...next,
    estimatedSpeedKmh:
      requestedSpeed,
    physics:
      next.physics
        ? {
            ...next.physics,
            inputSpeedKmh:
              requestedSpeed,
          }
        : next.physics,
    pathPoints:
      scaled,
  };
}

interface ParticipantTimingProfile {
  participant:
    ReconstructionVehicle;
  points:
    MovementPathPoint[];
  impactIndex: number;
  segmentDurations:
    number[];
  travelDurationSeconds:
    number;
  previousImpactTimeSeconds:
    number;
}

function segmentDurationSeconds(
  distanceMetres: number,
  startSpeedKmh: number,
  endSpeedKmh: number,
  fallbackSpeedKmh: number,
): number {
  if (
    distanceMetres <=
    0.0001
  ) {
    return 0;
  }

  const startMps =
    Math.max(
      0,
      startSpeedKmh /
        3.6,
    );

  const endMps =
    Math.max(
      0,
      endSpeedKmh /
        3.6,
    );

  const sum =
    startMps +
    endMps;

  if (
    sum >
    0.05
  ) {
    /*
     * Constant-acceleration segment:
     * distance = average(v_i, v_f) * time
     */
    return Math.max(
      MINIMUM_SEGMENT_SECONDS,
      (
        2 *
        distanceMetres
      ) /
        sum,
    );
  }

  const fallbackMps =
    Math.max(
      MINIMUM_SPEED_KMH /
        3.6,
      fallbackSpeedKmh /
        3.6,
    );

  return Math.max(
    MINIMUM_SEGMENT_SECONDS,
    distanceMetres /
      fallbackMps,
  );
}

function buildTimingProfile(
  participant:
    ReconstructionVehicle,
  reconstruction:
    AccidentReconstruction,
): ParticipantTimingProfile {
  const points =
    authoredPathPoints(
      participant,
    );

  const impactIndex =
    pointZIndex(
      points,
    );

  const preImpactPoints =
    points.slice(
      0,
      impactIndex +
        1,
    );

  if (
    preImpactPoints.length <
    2
  ) {
    const impact =
      preImpactPoints[
        Math.max(
          0,
          preImpactPoints.length -
            1,
        )
      ];

    return {
      participant,
      points,
      impactIndex,
      segmentDurations:
        [],
      travelDurationSeconds:
        0,
      previousImpactTimeSeconds:
        impact
          ?.timeSeconds ??
        0,
    };
  }

  const metricLengths =
    getParticipantMetricPlaybackSegmentLengthsMetres(
      {
        ...participant,
        pathPoints:
          preImpactPoints,
      },
      preImpactPoints,
      getReconstructionWorldDimensions(
        reconstruction,
      ),
    );

  const fallbackSpeed =
    participantSpeedLimitKmh(
      participant,
      effectiveParticipantSpeedKmh(
        participant,
      ),
    );

  const segmentDurations =
    preImpactPoints
      .slice(
        0,
        -1,
      )
      .map(
        (
          start,
          index,
        ) => {
          const end =
            preImpactPoints[
              index +
              1
            ];

          return segmentDurationSeconds(
            metricLengths[
              index
            ] ??
              0,
            isStopPoint(
              start,
            )
              ? 0
              : start.speedKmh,
            isStopPoint(
              end,
            )
              ? 0
              : end.speedKmh,
            fallbackSpeed,
          );
        },
      );

  return {
    participant,
    points,
    impactIndex,
    segmentDurations,
    travelDurationSeconds:
      segmentDurations.reduce(
        (
          total,
          duration,
        ) =>
          total +
          duration,
        0,
      ),
    previousImpactTimeSeconds:
      preImpactPoints[
        preImpactPoints.length -
          1
      ].timeSeconds,
  };
}

function retimeProfile(
  profile:
    ParticipantTimingProfile,
  commonImpactTimeSeconds:
    number,
): ReconstructionVehicle {
  const {
    participant,
    points,
    impactIndex,
    segmentDurations,
  } = profile;

  if (
    points.length ===
    0
  ) {
    return participant;
  }

  const times =
    new Map<
      string,
      number
    >();

  let cursor =
    commonImpactTimeSeconds;

  const impactPoint =
    points[
      impactIndex
    ];

  if (
    impactPoint
  ) {
    times.set(
      impactPoint.id,
      commonImpactTimeSeconds,
    );
  }

  for (
    let index =
      impactIndex -
      1;
    index >=
      0;
    index -=
      1
  ) {
    cursor -=
      segmentDurations[
        index
      ] ??
      0;

    times.set(
      points[index].id,
      Math.max(
        0,
        cursor,
      ),
    );
  }

  const impactShift =
    commonImpactTimeSeconds -
    profile
      .previousImpactTimeSeconds;

  for (
    let index =
      impactIndex +
      1;
    index <
      points.length;
    index +=
      1
  ) {
    times.set(
      points[index].id,
      Math.max(
        commonImpactTimeSeconds,
        points[index]
          .timeSeconds +
          impactShift,
      ),
    );
  }

  const retimed =
    points.map(
      (point) => ({
        ...point,
        timeSeconds:
          Number(
            (
              times.get(
                point.id,
              ) ??
              point
                .timeSeconds
            ).toFixed(
              4,
            ),
          ),
      }),
    );

  return syncLegacyParticipantFields({
    ...participant,
    pathPoints:
      retimed,
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

      const oldSpeed =
        effectiveParticipantSpeedKmh(
          previous,
        );

      const newSpeed =
        effectiveParticipantSpeedKmh(
          participant,
        );

      if (
        Math.abs(
          oldSpeed -
          newSpeed,
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

  const speedAppliedVehicles =
    proposed.vehicles.map(
      (participant) => {
        if (
          !changedIds.has(
            participant.id,
          )
        ) {
          /*
           * A speed edit invalidates the old bake for every participant.
           * Remove generated post-impact points so playback cannot accidentally
           * continue to use stale physics while waiting for a new Rapier run.
           */
          return {
            ...participant,
            pathPoints:
              authoredPathPoints(
                participant,
              ),
          };
        }

        const previous =
          previousById.get(
            participant.id,
          );

        if (!previous) {
          return participant;
        }

        return scaleChangedParticipantSpeeds(
          previous,
          participant,
        );
      },
    );

  const speedAppliedReconstruction:
    AccidentReconstruction = {
      ...proposed,
      lastPhysicsSimulation:
        undefined,
      vehicles:
        speedAppliedVehicles,
  };

  const profiles =
    speedAppliedVehicles.map(
      (participant) =>
        buildTimingProfile(
          participant,
          speedAppliedReconstruction,
        ),
    );

  const existingCommonImpactTime =
    Math.max(
      0,
      ...profiles.map(
        (profile) =>
          profile
            .previousImpactTimeSeconds,
      ),
    );

  const minimumRequiredImpactTime =
    Math.max(
      0,
      ...profiles.map(
        (profile) =>
          profile
            .travelDurationSeconds,
      ),
    ) +
    IMPACT_TIME_MARGIN_SECONDS;

  /*
   * Keep the established collision instant whenever the new speed can fit.
   * If a participant is slowed so much that it would need to start before
   * t=0, move the shared collision instant later for ALL participants.
   */
  const commonImpactTime =
    Math.max(
      existingCommonImpactTime,
      minimumRequiredImpactTime,
    );

  const retimedVehicles =
    profiles.map(
      (profile) =>
        retimeProfile(
          profile,
          commonImpactTime,
        ),
    );

  return {
    ...speedAppliedReconstruction,
    durationSeconds:
      Math.max(
        speedAppliedReconstruction
          .durationSeconds,
        commonImpactTime +
          MINIMUM_POST_IMPACT_SECONDS,
      ),
    vehicles:
      retimedVehicles,
  };
}
