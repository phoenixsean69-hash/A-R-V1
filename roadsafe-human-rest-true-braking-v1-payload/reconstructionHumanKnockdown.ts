/*
 * [RoadSafe:HumanKnockdownGroundingV1]
 *
 * Deterministic visual-only human knockdown for 3D/AR:
 *
 * upright -> airborne/tumble -> one ground contact -> persistent fallen pose.
 *
 * The canonical Rapier X/Z trajectory remains authoritative. This helper does
 * not alter collision time, impulse, Delta-V, momentum, energy, or evidence.
 */

import type {
  ParticipantImpactResponse,
  PhysicsVector2D,
} from "../types/reconstruction";

export interface HumanKnockdownPose {
  active: boolean;
  verticalMetres: number;
  rotationXDegrees: number;
  rotationYDegrees: number;
  rotationZDegrees: number;
  phase:
    | "Before Impact"
    | "Airborne"
    | "Ground Contact"
    | "Settled";
}

const GRAVITY =
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

function smoothStep(
  progress: number,
): number {
  const t =
    clamp(
      progress,
      0,
      1,
    );

  return (
    t *
    t *
    (
      3 -
      2 * t
    )
  );
}

function magnitude(
  vector: PhysicsVector2D,
): number {
  return Math.hypot(
    vector.x,
    vector.y,
  );
}

function normalise(
  vector: PhysicsVector2D,
): PhysicsVector2D {
  const length =
    magnitude(
      vector,
    );

  if (
    length <
    0.000001
  ) {
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

function signWithFallback(
  value: number,
  fallback: number,
): number {
  if (
    Math.abs(
      value,
    ) >
    0.0001
  ) {
    return Math.sign(
      value,
    );
  }

  if (
    Math.abs(
      fallback,
    ) >
    0.0001
  ) {
    return Math.sign(
      fallback,
    );
  }

  return 1;
}

function localImpulse(
  direction: PhysicsVector2D,
  headingDegrees: number,
): {
  forward: number;
  right: number;
} {
  const heading =
    headingDegrees *
    Math.PI /
    180;

  const forward = {
    x:
      Math.cos(
        heading,
      ),
    y:
      Math.sin(
        heading,
      ),
  };

  const right = {
    x:
      -forward.y,
    y:
      forward.x,
  };

  const unit =
    normalise(
      direction,
    );

  return {
    forward:
      unit.x *
        forward.x +
      unit.y *
        forward.y,

    right:
      unit.x *
        right.x +
      unit.y *
        right.y,
  };
}

function severity(
  response:
    ParticipantImpactResponse,
): number {
  const deltaV =
    response
      .deltaVMetresPerSecond /
    11;

  const speed =
    response
      .relativeImpactSpeedKmh /
    75;

  const energy =
    Math.sqrt(
      Math.max(
        0,
        response
          .estimatedEnergyKj,
      ),
    ) /
    11;

  return clamp(
    Math.max(
      deltaV,
      speed,
      energy,
      0.12,
    ),
    0.12,
    1,
  );
}

export function getGroundedHumanKnockdownPose({
  response,
  currentTimeSeconds,
  participantHeadingDegrees,
  participantHeightMetres,
}: {
  response:
    ParticipantImpactResponse | undefined;
  currentTimeSeconds: number;
  participantHeadingDegrees: number;
  participantHeightMetres: number;
}): HumanKnockdownPose {
  if (
    !response ||
    currentTimeSeconds <
      response.timeSeconds
  ) {
    return {
      active: false,
      verticalMetres: 0,
      rotationXDegrees: 0,
      rotationYDegrees: 0,
      rotationZDegrees: 0,
      phase:
        "Before Impact",
    };
  }

  const elapsed =
    Math.max(
      0,
      currentTimeSeconds -
      response.timeSeconds,
    );

  const impactSeverity =
    severity(
      response,
    );

  const local =
    localImpulse(
      response
        .impulseDirection,
      participantHeadingDegrees,
    );

  const launchVelocity =
    clamp(
      0.65 +
        response
          .deltaVMetresPerSecond *
          0.16 +
        response
          .relativeImpactSpeedKmh *
          0.006,
      0.7,
      3.6,
    );

  const flightDuration =
    Math.max(
      0.12,
      (
        2 *
        launchVelocity
      ) /
        GRAVITY,
    );

  const airborne =
    elapsed <
    flightDuration;

  const airborneProgress =
    clamp(
      elapsed /
        flightDuration,
      0,
      1,
    );

  const sideWeight =
    Math.abs(
      local.right,
    );

  const forwardWeight =
    Math.abs(
      local.forward,
    );

  const total =
    Math.max(
      0.001,
      sideWeight +
        forwardWeight,
    );

  /*
   * Use Euclidean weighting for final body tilt.
   *
   * The previous sideWeight / (side + forward) split could produce something
   * like 40deg roll + 40deg pitch, which leaves the torso visibly reclining
   * above the road even though the participant is already at final rest.
   *
   * Normalising by hypot guarantees the combined fallen tilt is approximately
   * one full 90-degree knockdown regardless of impulse direction.
   */
  const tiltMagnitude =
    Math.max(
      0.000001,
      Math.hypot(
        sideWeight,
        forwardWeight,
      ),
    );

  const sideBlend =
    sideWeight /
    tiltMagnitude;

  const forwardBlend =
    forwardWeight /
    tiltMagnitude;

  const sideDirection =
    signWithFallback(
      local.right,
      response
        .angularVelocityChangeDegreesPerSecond,
    );

  const forwardDirection =
    signWithFallback(
      local.forward,
      response
        .deltaVelocityMps
        .x,
    );

  /*
   * Final orientation is intentionally a stable fallen body rather than a
   * multi-turn "rest target".
   */
  const finalTiltDegrees =
    88 +
    impactSeverity *
      2;

  const finalRotationX =
    sideDirection *
    finalTiltDegrees *
    sideBlend;

  const finalRotationZ =
    -forwardDirection *
    finalTiltDegrees *
    forwardBlend;

  const finalYaw =
    clamp(
      response
        .angularVelocityChangeDegreesPerSecond /
      18,
      -16,
      16,
    );

  const tumbleEase =
    smoothStep(
      airborneProgress,
    );

  /*
   * One transient overshoot while airborne. It reaches zero again at landing,
   * so it cannot produce repeated rocking after ground contact.
   */
  const overshoot =
    Math.sin(
      Math.PI *
      airborneProgress,
    ) *
    impactSeverity;

  const rotationX =
    finalRotationX *
      tumbleEase +
    sideDirection *
      overshoot *
      24 *
      sideBlend;

  const rotationZ =
    finalRotationZ *
      tumbleEase -
    forwardDirection *
      overshoot *
      24 *
      forwardBlend;

  const rotationY =
    finalYaw *
    tumbleEase;

  if (
    airborne
  ) {
    return {
      active: true,

      verticalMetres:
        Math.max(
          0,
          launchVelocity *
            elapsed -
          0.5 *
            GRAVITY *
            elapsed *
            elapsed,
        ),

      rotationXDegrees:
        rotationX,

      rotationYDegrees:
        rotationY,

      rotationZDegrees:
        rotationZ,

      phase:
        "Airborne",
    };
  }

  const landingElapsed =
    elapsed -
    flightDuration;

  const landingDuration =
    0.16;

  const landingProgress =
    clamp(
      landingElapsed /
        landingDuration,
      0,
      1,
    );

  /*
   * Fallen bodies stay on the road. The tiny 18-45 mm clearance only prevents
   * mesh/ground z-fighting. There is no return to the old elevated rest pose.
   */
  const settledClearance =
    clamp(
      participantHeightMetres *
        0.024,
      0.024,
      0.055,
    );

  /*
   * A single tiny ground-contact compression cue. It vanishes completely in
   * 160 ms and never repeats.
   */
  const landingBump =
    landingProgress <
    1
      ? Math.sin(
          Math.PI *
          landingProgress,
        ) *
        0.028 *
        impactSeverity
      : 0;

  const settleEase =
    smoothStep(
      landingProgress,
    );

  return {
    active: true,

    verticalMetres:
      settledClearance +
      landingBump,

    rotationXDegrees:
      rotationX +
      (
        finalRotationX -
        rotationX
      ) *
        settleEase,

    rotationYDegrees:
      rotationY +
      (
        finalYaw -
        rotationY
      ) *
        settleEase,

    rotationZDegrees:
      rotationZ +
      (
        finalRotationZ -
        rotationZ
      ) *
        settleEase,

    phase:
      landingProgress <
      1
        ? "Ground Contact"
        : "Settled",
  };
}
