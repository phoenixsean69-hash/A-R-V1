import type { PhysicsCollisionShape } from "../types/reconstruction";

export interface PhysicsVector2 {
  x: number;
  y: number;
}

export interface PhysicsPose2D {
  position: PhysicsVector2;
  rotationDegrees: number;
}

export interface PhysicsShapeDimensions {
  collisionShape: PhysicsCollisionShape;
  collisionRadiusMetres: number;
  lengthMetres: number;
  widthMetres: number;
}

export type PhysicsCollisionShape2D =
  | {
      kind: "circle";
      center: PhysicsVector2;
      radius: number;
    }
  | {
      kind: "box";
      center: PhysicsVector2;
      rotationRadians: number;
      halfLength: number;
      halfWidth: number;
      forward: PhysicsVector2;
      side: PhysicsVector2;
    };

export interface PhysicsCollisionManifold {
  /** Unit normal pointing from shape A toward shape B. */
  normal: PhysicsVector2;
  penetrationMetres: number;
  contactPoint: PhysicsVector2;
}

export interface SweptPhysicsCollision {
  alpha: number;
  manifold: PhysicsCollisionManifold;
  leftPose: PhysicsPose2D;
  rightPose: PhysicsPose2D;
}

const EPSILON = 1e-7;

export function physicsDot(left: PhysicsVector2, right: PhysicsVector2): number {
  return left.x * right.x + left.y * right.y;
}

export function physicsCross(left: PhysicsVector2, right: PhysicsVector2): number {
  return left.x * right.y - left.y * right.x;
}

export function physicsMagnitude(vector: PhysicsVector2): number {
  return Math.hypot(vector.x, vector.y);
}

export function physicsNormalise(vector: PhysicsVector2): PhysicsVector2 {
  const length = physicsMagnitude(vector);
  if (length < EPSILON) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function shortestAngleDifferenceDegrees(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function interpolatePhysicsPose(
  start: PhysicsPose2D,
  end: PhysicsPose2D,
  alpha: number,
): PhysicsPose2D {
  const amount = clampNumber(alpha, 0, 1);
  return {
    position: {
      x: start.position.x + (end.position.x - start.position.x) * amount,
      y: start.position.y + (end.position.y - start.position.y) * amount,
    },
    rotationDegrees:
      start.rotationDegrees +
      shortestAngleDifferenceDegrees(start.rotationDegrees, end.rotationDegrees) * amount,
  };
}

export function createPhysicsCollisionShape(
  pose: PhysicsPose2D,
  dimensions: PhysicsShapeDimensions,
  expansionMetres = 0,
): PhysicsCollisionShape2D {
  const expansion = Math.max(0, expansionMetres);
  if (dimensions.collisionShape === "Circle") {
    return {
      kind: "circle",
      center: { ...pose.position },
      radius: Math.max(0.05, dimensions.collisionRadiusMetres + expansion),
    };
  }

  const rotationRadians = (pose.rotationDegrees * Math.PI) / 180;
  const forward = {
    x: Math.cos(rotationRadians),
    y: Math.sin(rotationRadians),
  };
  const side = { x: -forward.y, y: forward.x };
  return {
    kind: "box",
    center: { ...pose.position },
    rotationRadians,
    halfLength: Math.max(0.05, dimensions.lengthMetres / 2 + expansion),
    halfWidth: Math.max(0.05, dimensions.widthMetres / 2 + expansion),
    forward,
    side,
  };
}

function supportPoint(
  shape: PhysicsCollisionShape2D,
  direction: PhysicsVector2,
): PhysicsVector2 {
  const normal = physicsNormalise(direction);
  if (shape.kind === "circle") {
    return {
      x: shape.center.x + normal.x * shape.radius,
      y: shape.center.y + normal.y * shape.radius,
    };
  }

  const forwardSign = physicsDot(normal, shape.forward) >= 0 ? 1 : -1;
  const sideSign = physicsDot(normal, shape.side) >= 0 ? 1 : -1;
  return {
    x:
      shape.center.x +
      shape.forward.x * shape.halfLength * forwardSign +
      shape.side.x * shape.halfWidth * sideSign,
    y:
      shape.center.y +
      shape.forward.y * shape.halfLength * forwardSign +
      shape.side.y * shape.halfWidth * sideSign,
  };
}

function circleCircleManifold(
  left: Extract<PhysicsCollisionShape2D, { kind: "circle" }>,
  right: Extract<PhysicsCollisionShape2D, { kind: "circle" }>,
): PhysicsCollisionManifold | null {
  const delta = {
    x: right.center.x - left.center.x,
    y: right.center.y - left.center.y,
  };
  const distance = physicsMagnitude(delta);
  const combinedRadius = left.radius + right.radius;
  if (distance > combinedRadius) return null;

  const normal = distance > EPSILON ? physicsNormalise(delta) : { x: 1, y: 0 };
  const leftSurface = {
    x: left.center.x + normal.x * left.radius,
    y: left.center.y + normal.y * left.radius,
  };
  const rightSurface = {
    x: right.center.x - normal.x * right.radius,
    y: right.center.y - normal.y * right.radius,
  };
  return {
    normal,
    penetrationMetres: Math.max(0, combinedRadius - distance),
    contactPoint: {
      x: (leftSurface.x + rightSurface.x) / 2,
      y: (leftSurface.y + rightSurface.y) / 2,
    },
  };
}

function circleBoxManifold(
  circle: Extract<PhysicsCollisionShape2D, { kind: "circle" }>,
  box: Extract<PhysicsCollisionShape2D, { kind: "box" }>,
): PhysicsCollisionManifold | null {
  const relative = {
    x: circle.center.x - box.center.x,
    y: circle.center.y - box.center.y,
  };
  const localForward = physicsDot(relative, box.forward);
  const localSide = physicsDot(relative, box.side);
  const closestForward = clampNumber(localForward, -box.halfLength, box.halfLength);
  const closestSide = clampNumber(localSide, -box.halfWidth, box.halfWidth);
  const closestPoint = {
    x:
      box.center.x +
      box.forward.x * closestForward +
      box.side.x * closestSide,
    y:
      box.center.y +
      box.forward.y * closestForward +
      box.side.y * closestSide,
  };
  const fromCircleToBox = {
    x: closestPoint.x - circle.center.x,
    y: closestPoint.y - circle.center.y,
  };
  const distance = physicsMagnitude(fromCircleToBox);

  if (distance > circle.radius) return null;

  if (distance > EPSILON) {
    return {
      normal: physicsNormalise(fromCircleToBox),
      penetrationMetres: Math.max(0, circle.radius - distance),
      contactPoint: closestPoint,
    };
  }

  const forwardClearance = box.halfLength - Math.abs(localForward);
  const sideClearance = box.halfWidth - Math.abs(localSide);
  let normal: PhysicsVector2;
  let facePoint: PhysicsVector2;
  let penetration: number;

  if (forwardClearance < sideClearance) {
    const sign = localForward >= 0 ? 1 : -1;
    normal = { x: box.forward.x * sign, y: box.forward.y * sign };
    facePoint = {
      x: box.center.x + box.forward.x * box.halfLength * sign + box.side.x * localSide,
      y: box.center.y + box.forward.y * box.halfLength * sign + box.side.y * localSide,
    };
    penetration = circle.radius + forwardClearance;
  } else {
    const sign = localSide >= 0 ? 1 : -1;
    normal = { x: box.side.x * sign, y: box.side.y * sign };
    facePoint = {
      x: box.center.x + box.forward.x * localForward + box.side.x * box.halfWidth * sign,
      y: box.center.y + box.forward.y * localForward + box.side.y * box.halfWidth * sign,
    };
    penetration = circle.radius + sideClearance;
  }

  return {
    normal,
    penetrationMetres: Math.max(0, penetration),
    contactPoint: facePoint,
  };
}

function boxProjectionRadius(
  box: Extract<PhysicsCollisionShape2D, { kind: "box" }>,
  axis: PhysicsVector2,
): number {
  return (
    box.halfLength * Math.abs(physicsDot(axis, box.forward)) +
    box.halfWidth * Math.abs(physicsDot(axis, box.side))
  );
}

function boxBoxManifold(
  left: Extract<PhysicsCollisionShape2D, { kind: "box" }>,
  right: Extract<PhysicsCollisionShape2D, { kind: "box" }>,
): PhysicsCollisionManifold | null {
  const centerDelta = {
    x: right.center.x - left.center.x,
    y: right.center.y - left.center.y,
  };
  const axes = [left.forward, left.side, right.forward, right.side];
  let minimumOverlap = Number.POSITIVE_INFINITY;
  let collisionNormal: PhysicsVector2 = { x: 1, y: 0 };

  for (const rawAxis of axes) {
    const axis = physicsNormalise(rawAxis);
    const separation = physicsDot(centerDelta, axis);
    const overlap =
      boxProjectionRadius(left, axis) +
      boxProjectionRadius(right, axis) -
      Math.abs(separation);
    if (overlap < -EPSILON) return null;
    if (overlap < minimumOverlap) {
      minimumOverlap = Math.max(0, overlap);
      collisionNormal = separation >= 0 ? axis : { x: -axis.x, y: -axis.y };
    }
  }

  const leftSupport = supportPoint(left, collisionNormal);
  const rightSupport = supportPoint(right, {
    x: -collisionNormal.x,
    y: -collisionNormal.y,
  });
  return {
    normal: collisionNormal,
    penetrationMetres: minimumOverlap,
    contactPoint: {
      x: (leftSupport.x + rightSupport.x) / 2,
      y: (leftSupport.y + rightSupport.y) / 2,
    },
  };
}

export function getPhysicsCollisionManifold(
  left: PhysicsCollisionShape2D,
  right: PhysicsCollisionShape2D,
): PhysicsCollisionManifold | null {
  if (left.kind === "circle" && right.kind === "circle") {
    return circleCircleManifold(left, right);
  }
  if (left.kind === "circle" && right.kind === "box") {
    return circleBoxManifold(left, right);
  }
  if (left.kind === "box" && right.kind === "circle") {
    const manifold = circleBoxManifold(right, left);
    if (!manifold) return null;
    return {
      ...manifold,
      normal: { x: -manifold.normal.x, y: -manifold.normal.y },
    };
  }
  if (left.kind === "box" && right.kind === "box") {
    return boxBoxManifold(left, right);
  }
  return null;
}

function minimumShapeExtent(dimensions: PhysicsShapeDimensions): number {
  if (dimensions.collisionShape === "Circle") {
    return Math.max(0.1, dimensions.collisionRadiusMetres * 2);
  }
  return Math.max(0.1, Math.min(dimensions.lengthMetres, dimensions.widthMetres));
}

export function findSweptPhysicsCollision(
  leftStart: PhysicsPose2D,
  leftEnd: PhysicsPose2D,
  leftDimensions: PhysicsShapeDimensions,
  rightStart: PhysicsPose2D,
  rightEnd: PhysicsPose2D,
  rightDimensions: PhysicsShapeDimensions,
  toleranceMetres = 0,
): SweptPhysicsCollision | null {
  const expansion = Math.max(0, toleranceMetres) / 2;
  const manifoldAt = (alpha: number) => {
    const leftPose = interpolatePhysicsPose(leftStart, leftEnd, alpha);
    const rightPose = interpolatePhysicsPose(rightStart, rightEnd, alpha);
    const manifold = getPhysicsCollisionManifold(
      createPhysicsCollisionShape(leftPose, leftDimensions, expansion),
      createPhysicsCollisionShape(rightPose, rightDimensions, expansion),
    );
    return { leftPose, rightPose, manifold };
  };

  const atStart = manifoldAt(0);
  if (atStart.manifold) {
    return {
      alpha: 0,
      manifold: atStart.manifold,
      leftPose: atStart.leftPose,
      rightPose: atStart.rightPose,
    };
  }

  const leftTravel = physicsMagnitude({
    x: leftEnd.position.x - leftStart.position.x,
    y: leftEnd.position.y - leftStart.position.y,
  });
  const rightTravel = physicsMagnitude({
    x: rightEnd.position.x - rightStart.position.x,
    y: rightEnd.position.y - rightStart.position.y,
  });
  const relativeTravel = leftTravel + rightTravel;
  const rotationTravel =
    Math.abs(shortestAngleDifferenceDegrees(leftStart.rotationDegrees, leftEnd.rotationDegrees)) +
    Math.abs(shortestAngleDifferenceDegrees(rightStart.rotationDegrees, rightEnd.rotationDegrees));
  const minimumExtent = Math.min(
    minimumShapeExtent(leftDimensions),
    minimumShapeExtent(rightDimensions),
  );
  const subdivisions = clampNumber(
    Math.ceil(relativeTravel / Math.max(0.12, minimumExtent * 0.3)) +
      Math.ceil(rotationTravel / 8),
    4,
    32,
  );

  let previousAlpha = 0;
  for (let index = 1; index <= subdivisions; index += 1) {
    const alpha = index / subdivisions;
    const sample = manifoldAt(alpha);
    if (!sample.manifold) {
      previousAlpha = alpha;
      continue;
    }

    let low = previousAlpha;
    let high = alpha;
    let best = sample;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const middle = (low + high) / 2;
      const middleSample = manifoldAt(middle);
      if (middleSample.manifold) {
        high = middle;
        best = middleSample;
      } else {
        low = middle;
      }
    }

    if (!best.manifold) return null;
    return {
      alpha: high,
      manifold: best.manifold,
      leftPose: best.leftPose,
      rightPose: best.rightPose,
    };
  }

  return null;
}

export function calculatePlanarMomentOfInertia(
  massKg: number,
  dimensions: PhysicsShapeDimensions,
  scale = 1,
): number {
  const mass = Math.max(0.001, massKg);
  const inertiaScale = Math.max(0.05, scale);
  if (dimensions.collisionShape === "Circle") {
    return (
      0.5 * mass * dimensions.collisionRadiusMetres * dimensions.collisionRadiusMetres * inertiaScale
    );
  }
  return (
    (mass *
      (dimensions.lengthMetres * dimensions.lengthMetres +
        dimensions.widthMetres * dimensions.widthMetres)) /
      12 *
    inertiaScale
  );
}

export function velocityAtContactPoint(
  linearVelocity: PhysicsVector2,
  angularVelocityRadiansPerSecond: number,
  offsetFromCentre: PhysicsVector2,
): PhysicsVector2 {
  return {
    x: linearVelocity.x - angularVelocityRadiansPerSecond * offsetFromCentre.y,
    y: linearVelocity.y + angularVelocityRadiansPerSecond * offsetFromCentre.x,
  };
}
