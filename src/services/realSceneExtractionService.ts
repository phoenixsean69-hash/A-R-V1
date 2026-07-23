import type {
  RealSceneAreaSelection,
  RealSceneBarrierGeometry,
  RealSceneBuildingGeometry,
  RealSceneExtractionResult,
  RealSceneGeoPoint,
  RealSceneGeometry,
  RealSceneLocalPoint,
  RealScenePathGeometry,
  RealSceneRoadGeometry,
  RealSceneSnapshotReference,
} from "../types/realSceneGeometry";

const OVERPASS_ENDPOINTS = [
  import.meta.env.VITE_OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter((value): value is string => Boolean(value));

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string | undefined>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface LocalPoint {
  x: number;
  y: number;
}

interface ProjectionContext {
  widthMetres: number;
  heightMetres: number;
  metresPerLongitudeDegree: number;
  metresPerLatitudeDegree: number;
  west: number;
  south: number;
}

const PATH_HIGHWAY_TYPES = new Set([
  "footway",
  "path",
  "steps",
  "cycleway",
  "bridleway",
  "pedestrian",
  "corridor",
  "platform",
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const matched = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!matched) return undefined;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value?: string): number | undefined {
  const number = parseNumber(value?.split(/[;|]/)[0]);
  return number === undefined ? undefined : Math.max(1, Math.round(number));
}

function parseBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  const normalised = value.toLowerCase();
  if (["yes", "true", "1", "-1"].includes(normalised)) return true;
  if (["no", "false", "0"].includes(normalised)) return false;
  return undefined;
}

function parseMaximumSpeed(value?: string): number | undefined {
  const speed = parseNumber(value);
  if (speed === undefined) return undefined;
  return /mph/i.test(value ?? "") ? Math.round(speed * 1.60934) : Math.round(speed);
}

function createProjection(selection: RealSceneAreaSelection): ProjectionContext {
  const centreLatitude =
    (selection.bounds.north + selection.bounds.south) / 2;
  const metresPerLatitudeDegree = 110_540;
  const metresPerLongitudeDegree =
    111_320 * Math.max(0.000001, Math.cos((centreLatitude * Math.PI) / 180));

  return {
    widthMetres: Math.max(
      1,
      (selection.bounds.east - selection.bounds.west) *
        metresPerLongitudeDegree,
    ),
    heightMetres: Math.max(
      1,
      (selection.bounds.north - selection.bounds.south) *
        metresPerLatitudeDegree,
    ),
    metresPerLongitudeDegree,
    metresPerLatitudeDegree,
    west: selection.bounds.west,
    south: selection.bounds.south,
  };
}

function toLocal(point: RealSceneGeoPoint, projection: ProjectionContext): LocalPoint {
  return {
    x: (point.longitude - projection.west) * projection.metresPerLongitudeDegree,
    y: (point.latitude - projection.south) * projection.metresPerLatitudeDegree,
  };
}

function toGeo(point: LocalPoint, projection: ProjectionContext): RealSceneGeoPoint {
  return {
    longitude:
      projection.west + point.x / projection.metresPerLongitudeDegree,
    latitude:
      projection.south + point.y / projection.metresPerLatitudeDegree,
  };
}

function toStoredLocal(
  point: LocalPoint,
  projection: ProjectionContext,
): RealSceneLocalPoint {
  return {
    xMetres: Number(point.x.toFixed(3)),
    yMetres: Number(point.y.toFixed(3)),
    xPercent: Number(
      clamp((point.x / projection.widthMetres) * 100, 0, 100).toFixed(5),
    ),
    yPercent: Number(
      clamp(100 - (point.y / projection.heightMetres) * 100, 0, 100).toFixed(5),
    ),
  };
}

function almostSame(left: LocalPoint, right: LocalPoint): boolean {
  return Math.hypot(left.x - right.x, left.y - right.y) <= 0.015;
}

function clipLineSegment(
  start: LocalPoint,
  end: LocalPoint,
  width: number,
  height: number,
): [LocalPoint, LocalPoint] | null {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const p = [-deltaX, deltaX, -deltaY, deltaY];
  const q = [start.x, width - start.x, start.y, height - start.y];
  let minimum = 0;
  let maximum = 1;

  for (let index = 0; index < 4; index += 1) {
    if (Math.abs(p[index]) < 0.0000001) {
      if (q[index] < 0) return null;
      continue;
    }

    const ratio = q[index] / p[index];
    if (p[index] < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return null;
  }

  return [
    { x: start.x + deltaX * minimum, y: start.y + deltaY * minimum },
    { x: start.x + deltaX * maximum, y: start.y + deltaY * maximum },
  ];
}

function clipPolyline(
  points: LocalPoint[],
  width: number,
  height: number,
): LocalPoint[][] {
  const paths: LocalPoint[][] = [];
  let current: LocalPoint[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const clipped = clipLineSegment(points[index - 1], points[index], width, height);
    if (!clipped) {
      if (current.length >= 2) paths.push(current);
      current = [];
      continue;
    }

    const [start, end] = clipped;
    if (current.length === 0) current.push(start, end);
    else if (almostSame(current[current.length - 1], start)) current.push(end);
    else {
      if (current.length >= 2) paths.push(current);
      current = [start, end];
    }
  }

  if (current.length >= 2) paths.push(current);

  return paths.map((path) =>
    path.filter((point, index) => index === 0 || !almostSame(point, path[index - 1])),
  );
}

function clipPolygonAgainstEdge(
  points: LocalPoint[],
  inside: (point: LocalPoint) => boolean,
  intersection: (start: LocalPoint, end: LocalPoint) => LocalPoint,
): LocalPoint[] {
  if (points.length === 0) return [];
  const output: LocalPoint[] = [];
  let previous = points[points.length - 1];
  let previousInside = inside(previous);

  for (const point of points) {
    const pointInside = inside(point);
    if (pointInside) {
      if (!previousInside) output.push(intersection(previous, point));
      output.push(point);
    } else if (previousInside) {
      output.push(intersection(previous, point));
    }
    previous = point;
    previousInside = pointInside;
  }
  return output;
}

function clipPolygon(
  original: LocalPoint[],
  width: number,
  height: number,
): LocalPoint[] {
  const points =
    original.length > 1 && almostSame(original[0], original[original.length - 1])
      ? original.slice(0, -1)
      : [...original];

  const verticalIntersection = (edgeX: number) =>
    (start: LocalPoint, end: LocalPoint): LocalPoint => {
      const ratio =
        Math.abs(end.x - start.x) < 0.0000001
          ? 0
          : (edgeX - start.x) / (end.x - start.x);
      return { x: edgeX, y: start.y + (end.y - start.y) * ratio };
    };

  const horizontalIntersection = (edgeY: number) =>
    (start: LocalPoint, end: LocalPoint): LocalPoint => {
      const ratio =
        Math.abs(end.y - start.y) < 0.0000001
          ? 0
          : (edgeY - start.y) / (end.y - start.y);
      return { x: start.x + (end.x - start.x) * ratio, y: edgeY };
    };

  let clipped = clipPolygonAgainstEdge(
    points,
    (point) => point.x >= 0,
    verticalIntersection(0),
  );
  clipped = clipPolygonAgainstEdge(
    clipped,
    (point) => point.x <= width,
    verticalIntersection(width),
  );
  clipped = clipPolygonAgainstEdge(
    clipped,
    (point) => point.y >= 0,
    horizontalIntersection(0),
  );
  clipped = clipPolygonAgainstEdge(
    clipped,
    (point) => point.y <= height,
    horizontalIntersection(height),
  );

  if (clipped.length >= 3 && !almostSame(clipped[0], clipped[clipped.length - 1])) {
    clipped.push({ ...clipped[0] });
  }
  return clipped;
}

function defaultLaneCount(highwayType: string): number {
  if (["motorway", "trunk"].includes(highwayType)) return 4;
  if (["primary", "secondary", "tertiary"].includes(highwayType)) return 2;
  return 2;
}

function defaultRoadWidth(highwayType: string, lanes: number): number {
  if (highwayType === "service") return Math.max(3.2, lanes * 3);
  if (["track", "living_street"].includes(highwayType)) return Math.max(3, lanes * 2.8);
  if (["motorway", "trunk"].includes(highwayType)) return Math.max(7.2, lanes * 3.45);
  return Math.max(5.5, lanes * 3.25);
}

function defaultPathWidth(pathType: string): number {
  if (pathType === "pedestrian") return 3;
  if (pathType === "cycleway") return 2.2;
  if (pathType === "steps") return 1.8;
  return 1.5;
}

function toGeoPoints(element: OverpassElement): RealSceneGeoPoint[] {
  return (element.geometry ?? [])
    .filter(
      (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon),
    )
    .map((point) => ({ latitude: point.lat, longitude: point.lon }));
}

function buildRoadsAndPaths(
  element: OverpassElement,
  projection: ProjectionContext,
): {
  roads: RealSceneRoadGeometry[];
  paths: RealScenePathGeometry[];
} {
  const tags = element.tags ?? {};
  const highwayType = tags.highway ?? "road";
  const geoPoints = toGeoPoints(element);
  if (geoPoints.length < 2) return { roads: [], paths: [] };

  const localSegments = clipPolyline(
    geoPoints.map((point) => toLocal(point, projection)),
    projection.widthMetres,
    projection.heightMetres,
  );

  if (PATH_HIGHWAY_TYPES.has(highwayType)) {
    const explicitWidth = parseNumber(tags.width);
    const widthMetres = clamp(
      explicitWidth ?? defaultPathWidth(highwayType),
      0.6,
      12,
    );
    return {
      roads: [],
      paths: localSegments.map((segment, index) => ({
        id: `osm-path-${element.id}-${index + 1}`,
        osmId: element.id,
        name: tags.name?.trim() || highwayType.replaceAll("_", " "),
        pathType: highwayType,
        widthMetres: Number(widthMetres.toFixed(2)),
        points: segment.map((point) => toGeo(point, projection)),
        localPoints: segment.map((point) => toStoredLocal(point, projection)),
      })),
    };
  }

  const lanes = clamp(
    parseInteger(tags.lanes) ?? defaultLaneCount(highwayType),
    1,
    12,
  );
  const explicitWidth = parseNumber(tags.width);
  const widthMetres = clamp(
    explicitWidth ?? defaultRoadWidth(highwayType, lanes),
    2.4,
    45,
  );

  return {
    paths: [],
    roads: localSegments.map((segment, index) => ({
      id: `osm-road-${element.id}-${index + 1}`,
      osmId: element.id,
      name: tags.name?.trim() || "Unnamed road",
      highwayType,
      laneCount: lanes,
      widthMetres: Number(widthMetres.toFixed(2)),
      oneWay: parseBoolean(tags.oneway),
      surface: tags.surface,
      maximumSpeedKmh: parseMaximumSpeed(tags.maxspeed),
      isRoundabout: tags.junction === "roundabout",
      points: segment.map((point) => toGeo(point, projection)),
      localPoints: segment.map((point) => toStoredLocal(point, projection)),
    })),
  };
}

function buildBuilding(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneBuildingGeometry | null {
  const tags = element.tags ?? {};
  const points = clipPolygon(
    toGeoPoints(element).map((point) => toLocal(point, projection)),
    projection.widthMetres,
    projection.heightMetres,
  );
  if (points.length < 4) return null;

  const levels = parseInteger(tags["building:levels"]);
  const height = parseNumber(tags.height) ?? (levels ? levels * 3 : 4.2);
  return {
    id: `osm-building-${element.id}`,
    osmId: element.id,
    name: tags.name?.trim() || "Mapped building",
    buildingType: tags.building ?? "yes",
    levels,
    heightMetres: Number(clamp(height, 2.2, 120).toFixed(2)),
    points: points.map((point) => toGeo(point, projection)),
    localPoints: points.map((point) => toStoredLocal(point, projection)),
  };
}

function buildBarrier(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneBarrierGeometry[] {
  const tags = element.tags ?? {};
  const geoPoints = toGeoPoints(element);
  if (geoPoints.length < 2) return [];
  const segments = clipPolyline(
    geoPoints.map((point) => toLocal(point, projection)),
    projection.widthMetres,
    projection.heightMetres,
  );
  const barrierType = tags.barrier ?? "barrier";
  const height = parseNumber(tags.height) ??
    (["wall", "fence"].includes(barrierType) ? 1.8 : 0.9);

  return segments.map((segment, index) => ({
    id: `osm-barrier-${element.id}-${index + 1}`,
    osmId: element.id,
    name: tags.name?.trim() || barrierType.replaceAll("_", " "),
    barrierType,
    heightMetres: Number(clamp(height, 0.3, 8).toFixed(2)),
    points: segment.map((point) => toGeo(point, projection)),
    localPoints: segment.map((point) => toStoredLocal(point, projection)),
  }));
}

function createOverpassQuery(selection: RealSceneAreaSelection): string {
  const { south, west, north, east } = selection.bounds;
  return `[out:json][timeout:35];
(
  way["highway"](${south},${west},${north},${east});
  way["building"](${south},${west},${north},${east});
  way["barrier"](${south},${west},${north},${east});
);
out tags geom;`;
}

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 38_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Overpass returned HTTP ${response.status}.`);
      }
      return (await response.json()) as OverpassResponse;
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Real scene geometry could not be retrieved from OpenStreetMap.");
}

function calculateConfidence(
  roads: RealSceneRoadGeometry[],
  paths: RealScenePathGeometry[],
  buildings: RealSceneBuildingGeometry[],
): number {
  const roadPointCount = roads.reduce(
    (total, road) => total + road.localPoints.length,
    0,
  );
  const coverage = Math.min(1, roadPointCount / 45);
  const featureScore = Math.min(1, (roads.length + paths.length + buildings.length) / 16);
  return Number(clamp(0.35 + coverage * 0.45 + featureScore * 0.2, 0.35, 0.98).toFixed(2));
}

export const RealSceneExtractionService = {
  async extract(
    selection: RealSceneAreaSelection,
    snapshot?: RealSceneSnapshotReference,
  ): Promise<RealSceneExtractionResult> {
    const projection = createProjection(selection);

    if (
      projection.widthMetres < 8 ||
      projection.heightMetres < 8
    ) {
      throw new Error(
        "The selected scene is too small. Draw an area at least 8 metres wide and high.",
      );
    }

    if (
      projection.widthMetres > 1_200 ||
      projection.heightMetres > 1_200
    ) {
      throw new Error(
        "The selected scene is too large. Keep each side below 1.2 kilometres for an accurate reconstruction.",
      );
    }

    const response = await fetchOverpass(createOverpassQuery(selection));
    const roads: RealSceneRoadGeometry[] = [];
    const paths: RealScenePathGeometry[] = [];
    const buildings: RealSceneBuildingGeometry[] = [];
    const barriers: RealSceneBarrierGeometry[] = [];

    for (const element of response.elements ?? []) {
      if (element.type !== "way" || !element.geometry?.length) continue;
      const tags = element.tags ?? {};

      if (tags.highway) {
        const parsed = buildRoadsAndPaths(element, projection);
        roads.push(...parsed.roads);
        paths.push(...parsed.paths);
        continue;
      }

      if (tags.building) {
        const building = buildBuilding(element, projection);
        if (building) buildings.push(building);
        continue;
      }

      if (tags.barrier) barriers.push(...buildBarrier(element, projection));
    }

    const warnings: string[] = [];
    if (roads.length === 0) {
      warnings.push(
        "No mapped vehicle road was found inside the selected boundary. The snapshot and selected ground area were preserved for manual correction.",
      );
    }
    if (buildings.length === 0) {
      warnings.push(
        "No mapped building footprints were returned. Buildings visible in imagery may need to be added manually.",
      );
    }
    if (!snapshot) {
      warnings.push(
        "The map canvas could not be stored as an image. Geographic bounds and vector geometry were still preserved.",
      );
    }

    const geometry: RealSceneGeometry = {
      version: "RoadSafe Real Scene V1",
      status: "ready",
      selection,
      snapshot,
      origin: {
        latitude: selection.bounds.south,
        longitude: selection.bounds.west,
      },
      sceneWidthMetres: Number(projection.widthMetres.toFixed(2)),
      sceneHeightMetres: Number(projection.heightMetres.toFixed(2)),
      roads,
      paths,
      buildings,
      barriers,
      confidence: calculateConfidence(roads, paths, buildings),
      warnings,
      attribution: "Map geometry © OpenStreetMap contributors",
      extractedAt: new Date().toISOString(),
    };

    return { geometry, warnings };
  },
};
