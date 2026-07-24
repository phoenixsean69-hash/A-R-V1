import type {
  CollisionKinematicOutcome,
  PhysicsForceRange,
  PhysicsVector2D,
} from "../types/reconstruction";

export function vectorMagnitude(vector: PhysicsVector2D): number {
  return Math.hypot(vector.x, vector.y);
}

export function subtractVector(
  end: PhysicsVector2D,
  start: PhysicsVector2D,
): PhysicsVector2D {
  return {
    x: end.x - start.x,
    y: end.y - start.y,
  };
}

export function scaleVector(
  vector: PhysicsVector2D,
  scalar: number,
): PhysicsVector2D {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
  };
}

export function momentumVectorNs(
  massKg: number,
  velocityMps: PhysicsVector2D,
): PhysicsVector2D {
  return scaleVector(velocityMps, massKg);
}

export function translationalKineticEnergyKj(
  massKg: number,
  velocityMps: PhysicsVector2D,
): number {
  const speed = vectorMagnitude(velocityMps);
  return (0.5 * massKg * speed * speed) / 1000;
}

export function rotationalKineticEnergyKj(
  momentOfInertiaKgM2: number,
  angularVelocityDegreesPerSecond: number,
): number {
  const angularVelocityRadiansPerSecond =
    (angularVelocityDegreesPerSecond * Math.PI) / 180;

  return (
    0.5 *
    momentOfInertiaKgM2 *
    angularVelocityRadiansPerSecond *
    angularVelocityRadiansPerSecond
  ) / 1000;
}

export function normaliseContactDurationRangeMs(
  minimumMs: number,
  maximumMs: number,
): PhysicsForceRange {
  const safeMinimum = Math.min(
    1000,
    Math.max(10, Number.isFinite(minimumMs) ? minimumMs : 80),
  );
  const safeMaximum = Math.min(
    1500,
    Math.max(
      safeMinimum,
      Number.isFinite(maximumMs) ? maximumMs : 150,
    ),
  );

  return {
    minimum: safeMinimum,
    maximum: safeMaximum,
  };
}

export function estimateAverageForceRangeKn(
  impulseNs: number,
  durationRangeMs: PhysicsForceRange,
): PhysicsForceRange {
  const impulse = Math.max(0, impulseNs);
  const minimumDurationSeconds =
    Math.max(0.001, durationRangeMs.minimum / 1000);
  const maximumDurationSeconds =
    Math.max(minimumDurationSeconds, durationRangeMs.maximum / 1000);

  return {
    minimum: impulse / maximumDurationSeconds / 1000,
    maximum: impulse / minimumDurationSeconds / 1000,
  };
}

export function angleBetweenDegrees(
  first: PhysicsVector2D,
  second: PhysicsVector2D,
): number {
  const firstMagnitude = vectorMagnitude(first);
  const secondMagnitude = vectorMagnitude(second);

  if (firstMagnitude < 0.000001 || secondMagnitude < 0.000001) {
    return 0;
  }

  const dot =
    (first.x * second.x + first.y * second.y) /
    (firstMagnitude * secondMagnitude);

  return (
    Math.acos(Math.min(1, Math.max(-1, dot))) *
    180 /
    Math.PI
  );
}

export function classifyParticipantOutcome(input: {
  incomingVelocityMps: PhysicsVector2D;
  outgoingVelocityMps: PhysicsVector2D;
  sharesMotionWithOtherBody?: boolean;
  sharedMotionStops?: boolean;
}): CollisionKinematicOutcome {
  const outgoingSpeed = vectorMagnitude(input.outgoingVelocityMps);

  if (input.sharesMotionWithOtherBody) {
    return input.sharedMotionStops ? "Stick" : "SlideTogether";
  }

  if (outgoingSpeed < 0.2) {
    return "Stop";
  }

  const directionChange = angleBetweenDegrees(
    input.incomingVelocityMps,
    input.outgoingVelocityMps,
  );

  return directionChange >= 35 ? "Ricochet" : "Deflect";
}

export function distanceAlongPoints(
  points: PhysicsVector2D[],
): number {
  let distance = 0;

  for (let index = 1; index < points.length; index += 1) {
    distance += vectorMagnitude(
      subtractVector(points[index], points[index - 1]),
    );
  }

  return distance;
}

export function roundPhysicsValue(
  value: number,
  digits = 3,
): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}
