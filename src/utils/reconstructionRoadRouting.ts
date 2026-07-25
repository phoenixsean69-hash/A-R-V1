import type {
  RealSceneGeometry,
  RealSceneLocalPoint,
  RealSceneRoadGeometry,
} from "../types/realSceneGeometry";
import type {
  MovementPathPoint,
  ReconstructionPosition,
  ReconstructionVehicleType,
} from "../types/reconstruction";

export const AUTO_ROAD_CURVE_NOTE_MARKER = "[RoadSafe:AutoRoadCurve]";
export const AUTO_ROAD_CURVE_ID_PREFIX = "path-auto-road-";

let activeGeometry: RealSceneGeometry | null = null;

interface Point2 {
  x: number;
  y: number;
}

interface NearestRoadTangent {
  road: RealSceneRoadGeometry;
  point: Point2;
  tangent: Point2;
  distanceMetres: number;
}

interface CreateRoadAlignedIntermediatePointsOptions {
  startPoint: MovementPathPoint;
  impactPoint: MovementPathPoint;
  participantType: ReconstructionVehicleType;
  durationSeconds: number;
  createId: (prefix: string) => string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function length(vector: Point2): number {
  return Math.hypot(vector.x, vector.y);
}

function normalise(vector: Point2, fallback: Point2 = { x: 1, y: 0 }): Point2 {
  const magnitude = length(vector);
  if (magnitude < 0.000001) {
    const fallbackMagnitude = length(fallback) || 1;
    return {
      x: fallback.x / fallbackMagnitude,
      y: fallback.y / fallbackMagnitude,
    };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function dot(left: Point2, right: Point2): number {
  return left.x * right.x + left.y * right.y;
}

function subtract(end: Point2, start: Point2): Point2 {
  return {
    x: end.x - start.x,
    y: end.y - start.y,
  };
}

function addScaled(point: Point2, direction: Point2, distance: number): Point2 {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  };
}

function sceneToLocalMetres(
  position: ReconstructionPosition,
  geometry: RealSceneGeometry,
): Point2 {
  return {
    x: (clamp(position.x, 0, 100) / 100) * geometry.sceneWidthMetres,
    y:
      (1 - clamp(position.y, 0, 100) / 100) *
      geometry.sceneHeightMetres,
  };
}

function localMetresToScene(
  point: Point2,
  geometry: RealSceneGeometry,
): ReconstructionPosition {
  return {
    x: clamp((point.x / Math.max(1, geometry.sceneWidthMetres)) * 100, 0, 100),
    y: clamp(
      100 - (point.y / Math.max(1, geometry.sceneHeightMetres)) * 100,
      0,
      100,
    ),
  };
}

function localPoint(point: RealSceneLocalPoint): Point2 {
  return {
    x: point.xMetres,
    y: point.yMetres,
  };
}

function nearestPointOnSegment(
  point: Point2,
  start: Point2,
  end: Point2,
): { point: Point2; progress: number; distanceMetres: number } {
  const segment = subtract(end, start);
  const segmentLengthSquared = dot(segment, segment);
  const progress =
    segmentLengthSquared <= 0.000001
      ? 0
      : clamp(dot(subtract(point, start), segment) / segmentLengthSquared, 0, 1);
  const projected = addScaled(start, segment, progress);

  return {
    point: projected,
    progress,
    distanceMetres: length(subtract(point, projected)),
  };
}

function nearestRoadTangent(
  position: ReconstructionPosition,
  geometry: RealSceneGeometry,
  preferredRoadId?: string,
): NearestRoadTangent | null {
  const target = sceneToLocalMetres(position, geometry);
  const preferred = preferredRoadId
    ? geometry.roads.filter((road) => road.id === preferredRoadId)
    : [];
  const candidates = preferred.length > 0 ? preferred : geometry.roads;
  let nearest: NearestRoadTangent | null = null;

  candidates.forEach((road) => {
    for (let index = 1; index < road.localPoints.length; index += 1) {
      const start = localPoint(road.localPoints[index - 1]);
      const end = localPoint(road.localPoints[index]);
      const projected = nearestPointOnSegment(target, start, end);
      const tangent = normalise(subtract(end, start));

      if (!nearest || projected.distanceMetres < nearest.distanceMetres) {
        nearest = {
          road,
          point: projected.point,
          tangent,
          distanceMetres: projected.distanceMetres,
        };
      }
    }
  });

  return nearest;
}

function cubicBezierPoint(
  start: Point2,
  controlOne: Point2,
  controlTwo: Point2,
  end: Point2,
  progress: number,
): Point2 {
  const inverse = 1 - progress;
  const inverseSquared = inverse * inverse;
  const progressSquared = progress * progress;

  return {
    x:
      inverseSquared * inverse * start.x +
      3 * inverseSquared * progress * controlOne.x +
      3 * inverse * progressSquared * controlTwo.x +
      progressSquared * progress * end.x,
    y:
      inverseSquared * inverse * start.y +
      3 * inverseSquared * progress * controlOne.y +
      3 * inverse * progressSquared * controlTwo.y +
      progressSquared * progress * end.y,
  };
}

function isRoadFollowingParticipant(type: ReconstructionVehicleType): boolean {
  return !["Pedestrian", "Officer", "Witness"].includes(type);
}

function pointHeadingDegrees(from: Point2, to: Point2, fallback = 0): number {
  const vector = subtract(to, from);
  if (length(vector) < 0.000001) return fallback;

  // Local geometry uses north-positive Y, while reconstruction rotation uses
  // screen coordinates where Y grows downwards.
  return (
    ((Math.atan2(-vector.y, vector.x) * 180) / Math.PI + 360) %
    360
  );
}

function safeCurvePoint(
  point: Point2,
  geometry: RealSceneGeometry,
): Point2 {
  return {
    x: clamp(point.x, 0, geometry.sceneWidthMetres),
    y: clamp(point.y, 0, geometry.sceneHeightMetres),
  };
}

export function setActiveReconstructionRoadGeometry(
  geometry: RealSceneGeometry | null,
): void {
  activeGeometry = geometry;
}

export function clearActiveReconstructionRoadGeometry(
  geometry?: RealSceneGeometry,
): void {
  if (!geometry || activeGeometry === geometry) {
    activeGeometry = null;
  }
}

export function getActiveReconstructionRoadGeometry(): RealSceneGeometry | null {
  return activeGeometry;
}

export function isAutoRoadCurvePoint(point: MovementPathPoint): boolean {
  // The note is the regeneration flag. The stable ID is deliberately retained
  // after an investigator edits a point, so removing this note is enough to
  // convert it into a normal authored control point.
  return point.notes?.includes(AUTO_ROAD_CURVE_NOTE_MARKER) === true;
}

export function createRoadAlignedIntermediatePoints({
  startPoint,
  impactPoint,
  participantType,
  durationSeconds,
  createId,
}: CreateRoadAlignedIntermediatePointsOptions): MovementPathPoint[] {
  const geometry = activeGeometry;
  if (!geometry || geometry.roads.length === 0) return [];
  if (!isRoadFollowingParticipant(participantType)) return [];

  const startRoad = nearestRoadTangent(startPoint.position, geometry);
  if (!startRoad) return [];

  const startLocal = sceneToLocalMetres(startPoint.position, geometry);
  const impactLocal = sceneToLocalMetres(impactPoint.position, geometry);
  const direct = subtract(impactLocal, startLocal);
  const directDistance = length(direct);

  if (directDistance < 3) return [];

  const vehicleClearance = Math.max(2.5, startRoad.road.widthMetres * 0.8);
  const maximumRoadSnapDistance = Math.max(8, vehicleClearance * 2.2);
  if (startRoad.distanceMetres > maximumRoadSnapDistance) return [];

  let startTangent = startRoad.tangent;
  if (dot(startTangent, direct) < 0) {
    startTangent = { x: -startTangent.x, y: -startTangent.y };
  }

  const preferredImpactRoad = nearestRoadTangent(
    impactPoint.position,
    geometry,
    startRoad.road.id,
  );
  const nearestImpactRoad = nearestRoadTangent(impactPoint.position, geometry);
  const impactRoad =
    preferredImpactRoad &&
    preferredImpactRoad.distanceMetres <=
      Math.max(7, startRoad.road.widthMetres * 1.8)
      ? preferredImpactRoad
      : nearestImpactRoad &&
          nearestImpactRoad.distanceMetres <=
            Math.max(7, nearestImpactRoad.road.widthMetres * 1.8)
        ? nearestImpactRoad
        : null;

  let arrivalTangent = impactRoad?.tangent ?? normalise(direct);
  if (dot(arrivalTangent, direct) < 0) {
    arrivalTangent = {
      x: -arrivalTangent.x,
      y: -arrivalTangent.y,
    };
  }

  const directUnit = normalise(direct);
  // Keep Point 1 exactly aligned with the road. The cubic control handle uses
  // this tangent, so the participant starts by following its lane instead of
  // aiming directly at Point Z.
  arrivalTangent = normalise({
    x: arrivalTangent.x * 0.76 + directUnit.x * 0.24,
    y: arrivalTangent.y * 0.76 + directUnit.y * 0.24,
  });

  const startHandleLength = clamp(directDistance * 0.42, 4.5, 26);
  const arrivalHandleLength = clamp(directDistance * 0.30, 3.5, 18);
  const controlOne = safeCurvePoint(
    addScaled(startLocal, startTangent, startHandleLength),
    geometry,
  );
  const controlTwo = safeCurvePoint(
    addScaled(impactLocal, arrivalTangent, -arrivalHandleLength),
    geometry,
  );

  const intermediateCount = clamp(Math.round(directDistance / 6), 5, 9);
  const impactTime = clamp(
    impactPoint.timeSeconds,
    0.1,
    Math.max(0.1, durationSeconds - 0.05),
  );
  const result: MovementPathPoint[] = [];

  for (let index = 1; index <= intermediateCount; index += 1) {
    const progress = index / (intermediateCount + 1);
    const nextProgress = Math.min(1, progress + 0.015);
    const pointLocal = safeCurvePoint(
      cubicBezierPoint(
        startLocal,
        controlOne,
        controlTwo,
        impactLocal,
        progress,
      ),
      geometry,
    );
    const tangentTarget = cubicBezierPoint(
      startLocal,
      controlOne,
      controlTwo,
      impactLocal,
      nextProgress,
    );
    const speedProgress = progress * progress * (3 - 2 * progress);

    result.push({
      id: createId(AUTO_ROAD_CURVE_ID_PREFIX.slice(0, -1)),
      label: `Road curve ${index}`,
      position: localMetresToScene(pointLocal, geometry),
      timeSeconds: Number((impactTime * progress).toFixed(3)),
      speedKmh: Number(
        (
          startPoint.speedKmh +
          (impactPoint.speedKmh - startPoint.speedKmh) * speedProgress
        ).toFixed(2),
      ),
      rotation: pointHeadingDegrees(pointLocal, tangentTarget, startPoint.rotation),
      action: "Cruise",
      notes: AUTO_ROAD_CURVE_NOTE_MARKER,
    });

  }

  return result;
}
