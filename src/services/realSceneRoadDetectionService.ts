import type {
  RealSceneGeometry,
  RealSceneLocalPoint,
} from "../types/realSceneGeometry";
import type {
  DetectedRoadSegment,
  RoadDetectionCoordinate,
  RoadDetectionResult,
  RoadLayoutDetection,
} from "../types/roadLayoutDetection";
import {
  createDefaultRoadSceneSettings,
  type ReconstructionPosition,
  type RoadLayoutType,
  type RoadSceneSettings,
} from "../types/reconstruction";

interface Vector2 {
  x: number;
  y: number;
}

interface NearestRoadPoint {
  distanceMetres: number;
  segmentIndex: number;
  progress: number;
  localPoint: Vector2;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normaliseAngle(value: number): number {
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

function angularDifference(first: number, second: number): number {
  return Math.abs(normaliseAngle(first - second));
}

function distance(first: Vector2, second: Vector2): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function subtract(end: Vector2, start: Vector2): Vector2 {
  return {
    x: end.x - start.x,
    y: end.y - start.y,
  };
}

function length(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

function normalise(
  vector: Vector2,
  fallback: Vector2 = { x: 1, y: 0 },
): Vector2 {
  const magnitude = length(vector);

  if (magnitude > 0.000001) {
    return {
      x: vector.x / magnitude,
      y: vector.y / magnitude,
    };
  }

  const fallbackMagnitude = length(fallback) || 1;

  return {
    x: fallback.x / fallbackMagnitude,
    y: fallback.y / fallbackMagnitude,
  };
}

function bearingFromVector(vector: Vector2): number {
  const unit = normalise(vector);
  const north = -unit.y;
  const east = unit.x;

  return (Math.atan2(east, north) * 180) / Math.PI;
}

function coordinateToLocal(
  coordinate: Pick<RoadDetectionCoordinate, "latitude" | "longitude">,
  geometry: RealSceneGeometry,
): Vector2 {
  const { bounds } = geometry.selection;
  const centreLatitude = (bounds.north + bounds.south) / 2;
  const metresPerLongitudeDegree =
    111_320 *
    Math.max(
      0.000001,
      Math.cos((centreLatitude * Math.PI) / 180),
    );

  return {
    x:
      (coordinate.longitude - bounds.west) *
      metresPerLongitudeDegree,
    y: (coordinate.latitude - bounds.south) * 110_540,
  };
}

export function preciseCoordinateToScenePosition(
  coordinate: Pick<RoadDetectionCoordinate, "latitude" | "longitude">,
  geometry: RealSceneGeometry,
): ReconstructionPosition {
  const { bounds } = geometry.selection;
  const width = Math.max(0.000000001, bounds.east - bounds.west);
  const height = Math.max(0.000000001, bounds.north - bounds.south);

  return {
    x: Number(
      clamp(
        ((coordinate.longitude - bounds.west) / width) * 100,
        0,
        100,
      ).toFixed(6),
    ),
    y: Number(
      clamp(
        ((bounds.north - coordinate.latitude) / height) * 100,
        0,
        100,
      ).toFixed(6),
    ),
  };
}

function nearestPointOnSegment(
  point: Vector2,
  start: Vector2,
  end: Vector2,
): {
  distanceMetres: number;
  progress: number;
  point: Vector2;
} {
  const segment = subtract(end, start);
  const squaredLength =
    segment.x * segment.x + segment.y * segment.y;

  const progress =
    squaredLength <= 0.000001
      ? 0
      : clamp(
          ((point.x - start.x) * segment.x +
            (point.y - start.y) * segment.y) /
            squaredLength,
          0,
          1,
        );

  const projected = {
    x: start.x + segment.x * progress,
    y: start.y + segment.y * progress,
  };

  return {
    distanceMetres: distance(point, projected),
    progress,
    point: projected,
  };
}

function nearestRoadPoint(
  localPoints: RealSceneLocalPoint[],
  target: Vector2,
): NearestRoadPoint {
  let best: NearestRoadPoint = {
    distanceMetres: Number.POSITIVE_INFINITY,
    segmentIndex: 0,
    progress: 0,
    localPoint: target,
  };

  for (let index = 1; index < localPoints.length; index += 1) {
    const start = {
      x: localPoints[index - 1].xMetres,
      y: localPoints[index - 1].yMetres,
    };
    const end = {
      x: localPoints[index].xMetres,
      y: localPoints[index].yMetres,
    };

    const candidate = nearestPointOnSegment(target, start, end);

    if (candidate.distanceMetres < best.distanceMetres) {
      best = {
        distanceMetres: candidate.distanceMetres,
        segmentIndex: index - 1,
        progress: candidate.progress,
        localPoint: candidate.point,
      };
    }
  }

  return best;
}

function roadDirectionBearings(
  localPoints: RealSceneLocalPoint[],
  nearest: NearestRoadPoint,
): number[] {
  const bearings: number[] = [];

  const currentSegmentStart =
    localPoints[nearest.segmentIndex];
  const currentSegmentEnd =
    localPoints[
      Math.min(
        localPoints.length - 1,
        nearest.segmentIndex + 1,
      )
    ];

  const defaultDirection = normalise({
    x:
      currentSegmentEnd.xMetres -
      currentSegmentStart.xMetres,
    y:
      -(
        currentSegmentEnd.yMetres -
        currentSegmentStart.yMetres
      ),
  });

  let backwardPoint: Vector2 | null = null;
  let forwardPoint: Vector2 | null = null;

  for (
    let index = nearest.segmentIndex;
    index >= 0;
    index -= 1
  ) {
    const point = {
      x: localPoints[index].xMetres,
      y: localPoints[index].yMetres,
    };

    if (distance(point, nearest.localPoint) >= 5) {
      backwardPoint = point;
      break;
    }
  }

  for (
    let index = nearest.segmentIndex + 1;
    index < localPoints.length;
    index += 1
  ) {
    const point = {
      x: localPoints[index].xMetres,
      y: localPoints[index].yMetres,
    };

    if (distance(point, nearest.localPoint) >= 5) {
      forwardPoint = point;
      break;
    }
  }

  if (backwardPoint) {
    bearings.push(
      bearingFromVector({
        x: backwardPoint.x - nearest.localPoint.x,
        y: -(backwardPoint.y - nearest.localPoint.y),
      }),
    );
  }

  if (forwardPoint) {
    bearings.push(
      bearingFromVector({
        x: forwardPoint.x - nearest.localPoint.x,
        y: -(forwardPoint.y - nearest.localPoint.y),
      }),
    );
  }

  if (bearings.length === 0) {
    bearings.push(bearingFromVector(defaultDirection));
  }

  return bearings;
}

function deduplicateBearings(bearings: number[]): number[] {
  const result: number[] = [];

  bearings.forEach((bearing) => {
    if (
      !result.some(
        (existing) =>
          angularDifference(existing, bearing) < 26,
      )
    ) {
      result.push(bearing);
    }
  });

  return result;
}

function mode(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;

  const counts = new Map<number, number>();
  values.forEach((value) =>
    counts.set(value, (counts.get(value) ?? 0) + 1),
  );

  return (
    [...counts.entries()].sort(
      (first, second) => second[1] - first[1],
    )[0]?.[0] ?? fallback
  );
}

function confidenceLabel(
  confidence: number,
): RoadLayoutDetection["confidenceLabel"] {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Moderate";
  return "Low";
}

function determineLayout(
  roads: Array<{
    road: DetectedRoadSegment;
    bearings: number[];
  }>,
): {
  layout: RoadLayoutType;
  branchCount: number;
  dominantBearing: number;
  confidence: number;
} {
  const nearby = roads.filter(
    ({ road }) => road.distanceFromOfficerMetres <= 32,
  );
  const roundabout = nearby.find(
    ({ road }) => road.isRoundabout,
  );

  const bearings = deduplicateBearings(
    nearby.flatMap((item) => item.bearings),
  );

  const primary = [...roads].sort(
    (first, second) =>
      first.road.distanceFromOfficerMetres -
      second.road.distanceFromOfficerMetres,
  )[0];

  const dominantBearing =
    primary?.bearings[0] ?? bearings[0] ?? 90;

  if (roundabout) {
    return {
      layout: "Roundabout",
      branchCount: Math.max(3, bearings.length),
      dominantBearing,
      confidence: 0.96,
    };
  }

  if (bearings.length >= 4) {
    return {
      layout: "Four-way Intersection",
      branchCount: bearings.length,
      dominantBearing,
      confidence: bearings.length === 4 ? 0.91 : 0.82,
    };
  }

  if (bearings.length === 3) {
    return {
      layout: "T-Junction",
      branchCount: 3,
      dominantBearing,
      confidence: 0.89,
    };
  }

  return {
    layout: "Straight Road",
    branchCount: Math.max(1, bearings.length),
    dominantBearing,
    confidence:
      (primary?.road.distanceFromOfficerMetres ?? 100) <= 12
        ? 0.84
        : 0.68,
  };
}

function buildSettings(
  layout: RoadLayoutType,
  roads: DetectedRoadSegment[],
  dominantBearing: number,
  geometry: RealSceneGeometry,
): RoadSceneSettings {
  const nearestRoads = [...roads]
    .sort(
      (first, second) =>
        first.distanceFromOfficerMetres -
        second.distanceFromOfficerMetres,
    )
    .slice(0, 5);

  const laneCount = clamp(
    mode(
      nearestRoads
        .map((road) => road.laneCount)
        .filter(
          (value): value is number =>
            value !== undefined,
        ),
      2,
    ),
    1,
    8,
  );

  const speedLimitKmh = clamp(
    mode(
      nearestRoads
        .map((road) => road.maximumSpeedKmh)
        .filter(
          (value): value is number =>
            value !== undefined,
        ),
      60,
    ),
    10,
    160,
  );

  return {
    ...createDefaultRoadSceneSettings(),
    sceneEnvironment: "Road / Junction",
    roadLayout: layout,
    laneCount,
    roadRotation: Math.round(
      normaliseAngle(dominantBearing - 90),
    ),
    drivingSide: "Left",
    trafficControl: "None",
    speedLimitKmh,
    sceneWidthMetres: geometry.sceneWidthMetres,
    sceneHeightMetres: geometry.sceneHeightMetres,
    realSceneGeometry: geometry,
  };
}

export const RealSceneRoadDetectionService = {
  detect(
    geometry: RealSceneGeometry,
    coordinate: RoadDetectionCoordinate,
    locationName = "",
  ): RoadDetectionResult {
    const targetLocal = coordinateToLocal(
      coordinate,
      geometry,
    );

    const roadsWithMetadata = geometry.roads
      .filter(
        (road) =>
          road.points.length >= 2 &&
          road.localPoints.length >= 2,
      )
      .map((road) => {
        const nearest = nearestRoadPoint(
          road.localPoints,
          targetLocal,
        );

        const detectedRoad: DetectedRoadSegment = {
          id: road.id,
          osmId: road.osmId,
          name: road.name || "Unnamed road",
          highwayType: road.highwayType,
          laneCount: road.laneCount,
          oneWay: road.oneWay,
          surface: road.surface,
          maximumSpeedKmh: road.maximumSpeedKmh,
          junction: road.isRoundabout
            ? "roundabout"
            : undefined,
          isRoundabout: road.isRoundabout,
          distanceFromOfficerMetres: Number(
            nearest.distanceMetres.toFixed(3),
          ),
          points: road.points,
          scenePoints: road.localPoints.map(
            (point) => ({
              x: point.xPercent,
              y: point.yPercent,
            }),
          ),
        };

        return {
          road: detectedRoad,
          bearings: roadDirectionBearings(
            road.localPoints,
            nearest,
          ),
        };
      })
      .sort(
        (first, second) =>
          first.road.distanceFromOfficerMetres -
          second.road.distanceFromOfficerMetres,
      );

    const roads = roadsWithMetadata.map(
      (item) => item.road,
    );

    const selection = determineLayout(
      roadsWithMetadata,
    );

    let confidence = selection.confidence;
    const warnings = [...geometry.warnings];
    const nearestRoadDistance =
      roads[0]?.distanceFromOfficerMetres;

    if (roads.length === 0) {
      confidence = 0.25;
      warnings.push(
        "No mapped road centreline intersects the verified scene boundary. Manual road settings remain available.",
      );
    } else if (
      nearestRoadDistance !== undefined &&
      nearestRoadDistance > 24
    ) {
      confidence = Math.max(
        0.45,
        confidence - 0.22,
      );
      warnings.push(
        `The accident marker is ${nearestRoadDistance.toFixed(
          1,
        )} m from the nearest mapped road centreline. Verify the red marker before creating the scene.`,
      );
    }

    const junctionCentre =
      preciseCoordinateToScenePosition(
        coordinate,
        geometry,
      );

    const settings = buildSettings(
      selection.layout,
      roads,
      selection.dominantBearing,
      geometry,
    );

    const roadNames = Array.from(
      new Set(
        roads
          .map((road) => road.name)
          .filter(
            (name) =>
              name && name !== "Unnamed road",
          ),
      ),
    );

    const detection: RoadLayoutDetection = {
      id: createId("road-layout"),
      source:
        roads.length > 0
          ? "OpenStreetMap"
          : "Manual",
      coordinate,
      address: {
        displayName:
          locationName.trim() ||
          `${coordinate.latitude.toFixed(
            6,
          )}, ${coordinate.longitude.toFixed(6)}`,
        roadName: roadNames[0] ?? "",
        suburb: "",
        city: "",
        state: "",
        country: "Zimbabwe",
      },
      detectedLayout: selection.layout,
      confidence: Number(
        clamp(confidence, 0.05, 0.99).toFixed(2),
      ),
      confidenceLabel: confidenceLabel(confidence),
      radiusMetres: Math.max(
        geometry.sceneWidthMetres,
        geometry.sceneHeightMetres,
      ) / 2,
      roadNames,
      branchCount: selection.branchCount,
      roads,
      features: [],
      junctionCentre,
      suggestedSceneSettings: settings,
      fetchedAt: new Date().toISOString(),
      manuallyCorrected: false,
      failureReason:
        roads.length === 0
          ? "No usable mapped road geometry intersected the verified boundary."
          : undefined,
      attribution:
        "Road geometry derived from the officer-verified OpenStreetMap scene extraction.",
    };

    return {
      detection,
      reverseGeocodingSucceeded: Boolean(
        locationName.trim(),
      ),
      roadQuerySucceeded: roads.length > 0,
      warnings,
    };
  },
};
