import type {
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
