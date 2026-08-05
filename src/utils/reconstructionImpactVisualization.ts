import type {
  ParticipantImpactResponse,
  PhysicsCollisionEvent,
  PhysicsVector2D,
} from "../types/reconstruction";

/*
 * [RoadSafe:CanonicalImpactVisualizationV1]
 *
 * The planar trajectory remains authoritative for position and heading.
 * This module adds only body-local vertical motion, roll and pitch driven by
 * each participant's exact collision response.
 */

export type ImpactVisualPhase =
  | "Before Impact"
  | "Contact"
  | "Airborne"
  | "Landing"
  | "Settled";

export interface ParticipantImpactVisualPose {
  verticalMetres: number;
  rotationXDegrees: number;
  rotationYDegrees: number;
  rotationZDegrees: number;
  phase: ImpactVisualPhase;
}

export interface ParticipantImpactVisualPoseInput {
  response:
    ParticipantImpactResponse | undefined;

  currentTimeSeconds: number;
  participantHeadingDegrees: number;
  participantHeightMetres: number;
}

const GRAVITY_METRES_PER_SECOND_SQUARED =
  9.81;

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

function finite(
  value: number,
  fallback = 0,
): number {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function magnitude(
  vector: PhysicsVector2D,
): number {
  return Math.hypot(
    finite(vector.x),
    finite(vector.y),
  );
}

function normalise(
  vector: PhysicsVector2D,
): PhysicsVector2D {
  const length =
    magnitude(vector);

  if (length < 0.000001) {
    return {
      x: 1,
      y: 0,
    };
  }

  return {
    x:
      vector.x /
      length,

    y:
      vector.y /
      length,
  };
}

function dot(
  left: PhysicsVector2D,
  right: PhysicsVector2D,
): number {
  return (
    left.x *
      right.x +
    left.y *
      right.y
  );
}

function smoothstep(
  start: number,
  end: number,
  value: number,
): number {
  if (end <= start) {
    return value >= end
      ? 1
      : 0;
  }

  const progress =
    clamp(
      (
        value -
        start
      ) /
        (
          end -
          start
        ),
      0,
      1,
    );

  return (
    progress *
    progress *
    (
      3 -
      2 *
        progress
    )
  );
}

function signWithFallback(
  value: number,
  fallback: number,
): number {
  if (
    Math.abs(value) >
    0.0001
  ) {
    return Math.sign(value);
  }

  if (
    Math.abs(fallback) >
    0.0001
  ) {
    return Math.sign(fallback);
  }

  return 1;
}

function localImpulseComponents(
  direction:
    PhysicsVector2D,

  participantHeadingDegrees:
    number,
): {
  forward: number;
  right: number;
} {
  const headingRadians =
    (
      participantHeadingDegrees *
      Math.PI
    ) /
    180;

  const forward = {
    x:
      Math.cos(
        headingRadians,
      ),

    y:
      Math.sin(
        headingRadians,
      ),
  };

  /*
   * Reconstruction world Y increases down-screen, so this is the physical
   * clockwise/right vector used throughout the route and collision system.
   */
  const right = {
    x:
      -forward.y,

    y:
      forward.x,
  };

  const normalisedDirection =
    normalise(direction);

  return {
    forward:
      dot(
        normalisedDirection,
        forward,
      ),

    right:
      dot(
        normalisedDirection,
        right,
      ),
  };
}

function zeroPose(
  phase:
    ImpactVisualPhase =
      "Before Impact",
): ParticipantImpactVisualPose {
  return {
    verticalMetres: 0,
    rotationXDegrees: 0,
    rotationYDegrees: 0,
    rotationZDegrees: 0,
    phase,
  };
}

function impactSeverity(
  response:
    ParticipantImpactResponse,
): number {
  const deltaVSeverity =
    response
      .deltaVMetresPerSecond /
    12;

  const relativeSpeedSeverity =
    response
      .relativeImpactSpeedKmh /
    80;

  const energySeverity =
    Math.sqrt(
      Math.max(
        0,
        response
          .estimatedEnergyKj,
      ),
    ) /
    12;

  return clamp(
    Math.max(
      deltaVSeverity,
      relativeSpeedSeverity,
      energySeverity,
      0.12,
    ),
    0.12,
    1,
  );
}

function rigidVehiclePose(
  response:
    ParticipantImpactResponse,

  elapsed:
    number,

  participantHeadingDegrees:
    number,
): ParticipantImpactVisualPose {
  const severity =
    impactSeverity(
      response,
    );

  const localImpulse =
    localImpulseComponents(
      response
        .impulseDirection,
      participantHeadingDegrees,
    );

  const contactWindow =
    1.15;

  if (
    elapsed >=
    contactWindow
  ) {
    return zeroPose(
      "Settled",
    );
  }

  const decay =
    Math.exp(
      -4.2 *
        elapsed,
    );

  const compressionPulse =
    Math.sin(
      Math.PI *
        clamp(
          elapsed /
            0.34,
          0,
          1,
        ),
    );

  const rebound =
    Math.sin(
      elapsed *
        Math.PI *
        5.2,
    ) *
    decay;

  const frontRearFactor =
    response.contactZone ===
      "Front" ||
    response.contactZone ===
      "Rear"
      ? 1
      : 0.42;

  const sideFactor =
    response.contactZone ===
      "Left Side" ||
    response.contactZone ===
      "Right Side"
      ? 1
      : 0.42;

  const pitchDirection =
    response.contactZone ===
      "Front"
      ? -1
      : response.contactZone ===
          "Rear"
        ? 1
        : -signWithFallback(
            localImpulse.forward,
            response
              .participantNormal
              .x,
          );

  const rollDirection =
    response.contactZone ===
      "Left Side"
      ? 1
      : response.contactZone ===
          "Right Side"
        ? -1
        : -signWithFallback(
            localImpulse.right,
            response
              .angularVelocityChangeDegreesPerSecond,
          );

  return {
    verticalMetres:
      Math.max(
        0,
        compressionPulse *
          severity *
          0.075,
      ),

    rotationXDegrees:
      rollDirection *
      sideFactor *
      severity *
      rebound *
      7.5,

    rotationYDegrees: 0,

    rotationZDegrees:
      pitchDirection *
      frontRearFactor *
      severity *
      rebound *
      5.5,

    phase:
      elapsed <=
      0.16
        ? "Contact"
        : "Landing",
  };
}

function twoWheelerPose(
  response:
    ParticipantImpactResponse,

  elapsed:
    number,

  participantHeadingDegrees:
    number,

  participantHeightMetres:
    number,
): ParticipantImpactVisualPose {
  const severity =
    impactSeverity(
      response,
    );

  const localImpulse =
    localImpulseComponents(
      response
        .impulseDirection,
      participantHeadingDegrees,
    );

  const angularDirection =
    signWithFallback(
      response
        .angularVelocityChangeDegreesPerSecond,
      localImpulse.right,
    );

  const fallDirection =
    signWithFallback(
      localImpulse.right,
      angularDirection,
    );

  const forwardDirection =
    signWithFallback(
      localImpulse.forward,
      response
        .deltaVelocityMps
        .x,
    );

  const launchVelocity =
    clamp(
      0.55 +
        response
          .deltaVMetresPerSecond *
          0.16 +
        response
          .relativeImpactSpeedKmh *
          0.006,
      0.65,
      2.4,
    );

  const flightDuration =
    (
      2 *
      launchVelocity
    ) /
    GRAVITY_METRES_PER_SECOND_SQUARED;

  const tipDuration =
    clamp(
      0.95 -
        severity *
          0.28,
      0.58,
      0.95,
    );

  const tipProgress =
    smoothstep(
      0,
      tipDuration,
      elapsed,
    );

  const landingElapsed =
    Math.max(
      0,
      elapsed -
        flightDuration,
    );

  const groundClearance =
    Math.max(
      0.08,
      participantHeightMetres *
        0.1,
    );

  const verticalMetres =
    elapsed <=
    flightDuration
      ? Math.max(
          0,
          launchVelocity *
            elapsed -
            0.5 *
              GRAVITY_METRES_PER_SECOND_SQUARED *
              elapsed *
              elapsed,
        )
      : groundClearance *
        smoothstep(
          0,
          0.24,
          landingElapsed,
        );

  const impactWobble =
    Math.sin(
      elapsed *
        15,
    ) *
    Math.exp(
      -4.5 *
        elapsed,
    );

  return {
    verticalMetres,

    rotationXDegrees:
      fallDirection *
        (
          78 +
          severity *
            12
        ) *
        tipProgress +
      impactWobble *
        severity *
        10,

    rotationYDegrees: 0,

    rotationZDegrees:
      -forwardDirection *
      (
        8 +
        severity *
          12
      ) *
      tipProgress,

    phase:
      elapsed <
      flightDuration
        ? "Airborne"
        : tipProgress <
            0.98
          ? "Landing"
          : "Settled",
  };
}

function humanPose(
  response:
    ParticipantImpactResponse,

  elapsed:
    number,

  participantHeadingDegrees:
    number,

  participantHeightMetres:
    number,
): ParticipantImpactVisualPose {
  const severity =
    impactSeverity(
      response,
    );

  const localImpulse =
    localImpulseComponents(
      response
        .impulseDirection,
      participantHeadingDegrees,
    );

  const launchVelocity =
    clamp(
      1.1 +
        response
          .deltaVMetresPerSecond *
          0.24 +
        response
          .relativeImpactSpeedKmh *
          0.015,
      1.2,
      5.5,
    );

  const flightDuration =
    (
      2 *
      launchVelocity
    ) /
    GRAVITY_METRES_PER_SECOND_SQUARED;

  const airborneProgress =
    clamp(
      elapsed /
        Math.max(
          0.001,
          flightDuration,
        ),
      0,
      1,
    );

  const angularSeverity =
    Math.abs(
      response
        .angularVelocityChangeDegreesPerSecond,
    ) /
    260;

  const tumbleTurns =
    clamp(
      0.25 +
        angularSeverity +
        response
          .deltaVMetresPerSecond /
          18,
      0.25,
      1.8,
    );

  const rightWeight =
    Math.max(
      0.18,
      Math.abs(
        localImpulse.right,
      ),
    );

  const forwardWeight =
    Math.max(
      0.18,
      Math.abs(
        localImpulse.forward,
      ),
    );

  const totalWeight =
    rightWeight +
    forwardWeight;

  const xWeight =
    rightWeight /
    totalWeight;

  const zWeight =
    forwardWeight /
    totalWeight;

  const rightDirection =
    signWithFallback(
      localImpulse.right,
      response
        .angularVelocityChangeDegreesPerSecond,
    );

  const forwardDirection =
    signWithFallback(
      localImpulse.forward,
      response
        .deltaVelocityMps
        .x,
    );

  const fullTumbleDegrees =
    tumbleTurns *
      360 +
    90;

  const rotationProgress =
    smoothstep(
      0,
      1,
      airborneProgress,
    );

  const targetRotationX =
    rightDirection *
    fullTumbleDegrees *
    xWeight;

  const targetRotationZ =
    -forwardDirection *
    fullTumbleDegrees *
    zWeight;

  const landingElapsed =
    Math.max(
      0,
      elapsed -
        flightDuration,
    );

  const groundClearance =
    Math.max(
      0.16,
      participantHeightMetres *
        0.19,
    );

  const landingBounce =
    landingElapsed > 0 &&
    landingElapsed < 0.5
      ? Math.abs(
          Math.sin(
            landingElapsed *
              17,
          ),
        ) *
        Math.exp(
          -6.2 *
            landingElapsed,
        ) *
        severity *
        0.16
      : 0;

  const verticalMetres =
    elapsed <=
    flightDuration
      ? Math.max(
          0,
          launchVelocity *
            elapsed -
            0.5 *
              GRAVITY_METRES_PER_SECOND_SQUARED *
              elapsed *
              elapsed,
        )
      : groundClearance *
          smoothstep(
            0,
            0.28,
            landingElapsed,
          ) +
        landingBounce;

  return {
    verticalMetres,

    rotationXDegrees:
      targetRotationX *
      rotationProgress,

    rotationYDegrees: 0,

    rotationZDegrees:
      targetRotationZ *
      rotationProgress,

    phase:
      elapsed <
      flightDuration
        ? "Airborne"
        : landingElapsed <
            0.45
          ? "Landing"
          : "Settled",
  };
}

export function getParticipantImpactVisualPose(
  input:
    ParticipantImpactVisualPoseInput,
): ParticipantImpactVisualPose {
  const response =
    input.response;

  if (
    !response ||
    input.currentTimeSeconds <
      response.timeSeconds
  ) {
    return zeroPose();
  }

  const elapsed =
    Math.max(
      0,
      input.currentTimeSeconds -
        response.timeSeconds,
    );

  switch (
    response.responseClass
  ) {
    case "Human Body":
      return humanPose(
        response,
        elapsed,
        input
          .participantHeadingDegrees,
        input
          .participantHeightMetres,
      );

    case "Two Wheeler":
      return twoWheelerPose(
        response,
        elapsed,
        input
          .participantHeadingDegrees,
        input
          .participantHeightMetres,
      );

    case "Rigid Vehicle":
    default:
      return rigidVehiclePose(
        response,
        elapsed,
        input
          .participantHeadingDegrees,
      );
  }
}

export function indexEarliestParticipantImpactResponses(
  collisionEvents:
    readonly PhysicsCollisionEvent[],
): Map<
  string,
  ParticipantImpactResponse
> {
  const result =
    new Map<
      string,
      ParticipantImpactResponse
    >();

  for (
    const event
    of collisionEvents
  ) {
    for (
      const response
      of event.impactResponses ??
        []
    ) {
      const existing =
        result.get(
          response.participantId,
        );

      if (
        !existing ||
        response.timeSeconds <
          existing.timeSeconds
      ) {
        result.set(
          response.participantId,
          response,
        );
      }
    }
  }

  return result;
}
