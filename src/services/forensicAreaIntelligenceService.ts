import {
  areaSelectionFromPolygon,
  metresPerLongitudeDegree,
  pointInsidePolygon,
} from "./forensicAreaService";

import type {
  RealSceneAreaSelection,
  RealSceneBounds,
  RealSceneGeoPoint,
  RealSceneMapMode,
} from "../types/realSceneGeometry";

import type {
  RoadDetectionCoordinate,
} from "../types/roadLayoutDetection";

export interface ForensicAreaRoadCandidate {
  id: string;
  osmId: number;
  name: string;
  highwayType: string;
  points: RealSceneGeoPoint[];
  clippedByCore: boolean;
}

export interface ForensicAreaRoadIntelligence {
  scannedAt: string;
  roads: ForensicAreaRoadCandidate[];
  nearestRoadDistanceMetres: number;
  nearestRoadId?: string;
  clippedApproachCount: number;
  warning?: string;
}

interface OverpassElement {
  type: "way";
  id: number;
  tags?: Record<string, string | undefined>;
  geometry?: Array<{ lat: number; lon: number }>;
}

const ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const METRES_PER_LATITUDE_DEGREE = 110_540;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toLocal(
  point: RealSceneGeoPoint,
  anchor: RoadDetectionCoordinate,
) {
  return {
    x:
      (point.longitude - anchor.longitude) *
      metresPerLongitudeDegree(anchor.latitude),
    y:
      (point.latitude - anchor.latitude) *
      METRES_PER_LATITUDE_DEGREE,
  };
}

function boundsAround(
  anchor: RoadDetectionCoordinate,
  metres: number,
): RealSceneBounds {
  const lonScale = metresPerLongitudeDegree(anchor.latitude);

  return {
    north: anchor.latitude + metres / METRES_PER_LATITUDE_DEGREE,
    south: anchor.latitude - metres / METRES_PER_LATITUDE_DEGREE,
    east: anchor.longitude + metres / lonScale,
    west: anchor.longitude - metres / lonScale,
  };
}

function insideCore(
  point: RealSceneGeoPoint,
  core: RealSceneAreaSelection,
): boolean {
  return (
    point.latitude >= core.bounds.south &&
    point.latitude <= core.bounds.north &&
    point.longitude >= core.bounds.west &&
    point.longitude <= core.bounds.east &&
    pointInsidePolygon(point, core.polygon)
  );
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < 1e-9) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(
    ((px - ax) * dx + (py - ay) * dy) / lengthSq,
    0,
    1,
  );

  return Math.hypot(
    px - (ax + t * dx),
    py - (ay + t * dy),
  );
}

function roadDistance(
  anchor: RoadDetectionCoordinate,
  road: ForensicAreaRoadCandidate,
): number {
  const local = road.points.map((point) => toLocal(point, anchor));

  if (local.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (local.length === 1) {
    return Math.hypot(local[0].x, local[0].y);
  }

  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 1; index < local.length; index += 1) {
    minimum = Math.min(
      minimum,
      distanceToSegment(
        0,
        0,
        local[index - 1].x,
        local[index - 1].y,
        local[index].x,
        local[index].y,
      ),
    );
  }

  return minimum;
}

async function fetchRoads(
  bounds: RealSceneBounds,
): Promise<ForensicAreaRoadCandidate[]> {
  const query =
    `[out:json][timeout:18];way["highway"]["area"!="yes"](` +
    `${bounds.south},${bounds.west},${bounds.north},${bounds.east}` +
    `);out tags geom qt;`;

  const failures: string[] = [];

  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      20_000,
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        elements?: OverpassElement[];
      };

      return (payload.elements ?? [])
        .filter(
          (element) =>
            element.type === "way" &&
            Array.isArray(element.geometry) &&
            element.geometry.length >= 2,
        )
        .map((element) => ({
          id: `osm-road-${element.id}`,
          osmId: element.id,
          name:
            element.tags?.name ??
            element.tags?.ref ??
            "Unnamed road",
          highwayType: element.tags?.highway ?? "road",
          points: (element.geometry ?? []).map((point) => ({
            latitude: point.lat,
            longitude: point.lon,
          })),
          clippedByCore: false,
        }));
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw new Error(
    `Mapped-road scan failed: ${failures.join(" | ")}`,
  );
}

function cross(
  origin: RealSceneGeoPoint,
  first: RealSceneGeoPoint,
  second: RealSceneGeoPoint,
): number {
  return (
    (first.longitude - origin.longitude) *
      (second.latitude - origin.latitude) -
    (first.latitude - origin.latitude) *
      (second.longitude - origin.longitude)
  );
}

function convexHull(
  points: RealSceneGeoPoint[],
): RealSceneGeoPoint[] {
  const unique = Array.from(
    new Map(
      points.map((point) => [
        `${point.longitude.toFixed(8)}:${point.latitude.toFixed(8)}`,
        point,
      ]),
    ).values(),
  ).sort(
    (a, b) =>
      a.longitude - b.longitude ||
      a.latitude - b.latitude,
  );

  if (unique.length <= 3) {
    return unique;
  }

  const lower: RealSceneGeoPoint[] = [];

  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(
        lower[lower.length - 2],
        lower[lower.length - 1],
        point,
      ) <= 0
    ) {
      lower.pop();
    }

    lower.push(point);
  }

  const upper: RealSceneGeoPoint[] = [];

  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];

    while (
      upper.length >= 2 &&
      cross(
        upper[upper.length - 2],
        upper[upper.length - 1],
        point,
      ) <= 0
    ) {
      upper.pop();
    }

    upper.push(point);
  }

  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

function expandHull(
  hull: RealSceneGeoPoint[],
  anchor: RoadDetectionCoordinate,
  paddingMetres: number,
): RealSceneGeoPoint[] {
  const lonScale = metresPerLongitudeDegree(anchor.latitude);

  return hull.map((point) => {
    const x = (point.longitude - anchor.longitude) * lonScale;
    const y =
      (point.latitude - anchor.latitude) *
      METRES_PER_LATITUDE_DEGREE;
    const distance = Math.max(1, Math.hypot(x, y));
    const scale = (distance + paddingMetres) / distance;

    return {
      latitude:
        anchor.latitude +
        (y * scale) / METRES_PER_LATITUDE_DEGREE,
      longitude:
        anchor.longitude + (x * scale) / lonScale,
    };
  });
}

export const ForensicAreaIntelligenceService = {
  async scan(options: {
    anchor: RoadDetectionCoordinate;
    coreArea: RealSceneAreaSelection | null;
    contextArea: RealSceneAreaSelection | null;
  }): Promise<ForensicAreaRoadIntelligence> {
    const { anchor, coreArea, contextArea } = options;

    const roads = await fetchRoads(
      contextArea?.bounds ??
        coreArea?.bounds ??
        boundsAround(anchor, 220),
    );

    const enriched = roads.map((road) => {
      const insideCount = coreArea
        ? road.points.filter((point) =>
            insideCore(point, coreArea),
          ).length
        : 0;

      return {
        ...road,
        clippedByCore: Boolean(
          coreArea &&
            insideCount > 0 &&
            insideCount < road.points.length,
        ),
      };
    });

    let nearestRoadDistanceMetres =
      Number.POSITIVE_INFINITY;
    let nearestRoadId: string | undefined;

    for (const road of enriched) {
      const distance = roadDistance(anchor, road);

      if (distance < nearestRoadDistanceMetres) {
        nearestRoadDistanceMetres = distance;
        nearestRoadId = road.id;
      }
    }

    if (!Number.isFinite(nearestRoadDistanceMetres)) {
      nearestRoadDistanceMetres = 9999;
    }

    const clippedApproachCount = enriched.filter(
      (road) => road.clippedByCore,
    ).length;

    const warning =
      enriched.length === 0
        ? "No mapped roads were found around this scene."
        : nearestRoadDistanceMetres > 20
          ? "The accident anchor is far from mapped road geometry."
          : clippedApproachCount > 0
            ? `${clippedApproachCount} approach road(s) cross the forensic-core boundary.`
            : undefined;

    return {
      scannedAt: new Date().toISOString(),
      roads: enriched,
      nearestRoadDistanceMetres,
      nearestRoadId,
      clippedApproachCount,
      warning,
    };
  },

  suggestCore(options: {
    anchor: RoadDetectionCoordinate;
    roads: ForensicAreaRoadCandidate[];
    mapMode: RealSceneMapMode;
    zoom: number;
    bearing: number;
    pitch: number;
  }): RealSceneAreaSelection | null {
    const {
      anchor,
      roads,
      mapMode,
      zoom,
      bearing,
      pitch,
    } = options;

    const points = roads.flatMap((road) =>
      road.points.filter((point) => {
        const local = toLocal(point, anchor);

        return Math.hypot(local.x, local.y) <= 135;
      }),
    );

    const hull = convexHull([
      ...points,
      {
        latitude: anchor.latitude,
        longitude: anchor.longitude,
      },
    ]);

    if (hull.length < 3) {
      return null;
    }

    return areaSelectionFromPolygon(
      expandHull(hull, anchor, 14),
      {
        mapMode,
        zoom,
        bearing,
        pitch,
      },
    );
  },
};
