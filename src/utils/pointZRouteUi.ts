import type {
  MovementAction,
  MovementPathPoint,
} from "../types/reconstruction";

import {
  canDeleteAuthoredRoutePoint,
  isPhysicsGeneratedRoutePoint,
  isPointOne,
  isPointZ,
} from "./participantRouteAuthoring";

const INTERMEDIATE_ACTIONS: MovementAction[] = [
  "Accelerate",
  "Cruise",
  "Brake",
  "Turn Left",
  "Turn Right",
  "Swerve",
  "Stop",
  "Exit Scene",
];

const START_ACTIONS: MovementAction[] = [
  "Start",
  "Enter Scene",
];

export function getRouteDiamondText({
  point,
  investigatorOrder,
}: {
  point: MovementPathPoint;
  investigatorOrder: number;
}): string {
  if (isPhysicsGeneratedRoutePoint(point)) {
    return "P";
  }

  if (isPointZ(point)) {
    return "Z";
  }

  return String(Math.max(1, investigatorOrder + 1));
}

export function getRoutePointSubtitle({
  point,
  investigatorOrder,
}: {
  point: MovementPathPoint;
  investigatorOrder: number;
}): string {
  if (isPhysicsGeneratedRoutePoint(point)) {
    return "Physics result";
  }

  if (isPointZ(point)) {
    return "Primary collision · locked";
  }

  if (isPointOne(point) || investigatorOrder === 0) {
    return "Starting position";
  }

  return `Intermediate route point ${investigatorOrder + 1}`;
}

export function getRoutePointStatus(
  point: MovementPathPoint,
): string {
  if (isPhysicsGeneratedRoutePoint(point)) {
    return "Physics · read only";
  }

  if (isPointZ(point)) {
    return "Point Z · locked";
  }

  if (isPointOne(point)) {
    return "Point 1 · start";
  }

  return "Editable route point";
}

export function getEditablePointActions(
  point: MovementPathPoint,
): MovementAction[] {
  if (isPointZ(point)) {
    return ["Impact"];
  }

  if (isPointOne(point)) {
    return Array.from(
      new Set<MovementAction>([
        point.action,
        ...START_ACTIONS,
      ]),
    );
  }

  return Array.from(
    new Set<MovementAction>([
      point.action === "Impact"
        ? "Cruise"
        : point.action,
      ...INTERMEDIATE_ACTIONS,
    ]),
  );
}

export function isPointZLocked(
  point: MovementPathPoint,
): boolean {
  return isPointZ(point);
}

export function canDeleteRoutePoint(
  point: MovementPathPoint,
  authoredPoints: MovementPathPoint[],
): boolean {
  return canDeleteAuthoredRoutePoint(
    point,
    authoredPoints,
  );
}

export function canPlaceRoutePointWithGps(
  point: MovementPathPoint,
): boolean {
  return (
    !isPointZ(point) &&
    !isPhysicsGeneratedRoutePoint(point)
  );
}

export function canEditRoutePointPosition(
  point: MovementPathPoint,
): boolean {
  return (
    !isPointZ(point) &&
    !isPhysicsGeneratedRoutePoint(point)
  );
}

export function canEditRoutePointIdentity(
  point: MovementPathPoint,
): boolean {
  return (
    !isPointOne(point) &&
    !isPointZ(point) &&
    !isPhysicsGeneratedRoutePoint(point)
  );
}
