import type {
  RealSceneAreaSelection,
  RealSceneBarrierGeometry,
  RealSceneBuildingGeometry,
  RealSceneExtractionResult,
  RealSceneGeoPoint,
  RealSceneGeometry,
  RealSceneLandCoverGeometry,
  RealSceneLandCoverType,
  RealSceneLocalPoint,
  RealScenePathGeometry,
  RealSceneRoadGeometry,
  RealSceneSnapshotReference,
  RealSceneVegetationGeometry,
  RealSceneVegetationType,
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
  lat?: number;
  lon?: number;
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


function polygonArea(points: LocalPoint[]): number {
  const source =
    points.length > 1 && almostSame(points[0], points[points.length - 1])
      ? points.slice(0, -1)
      : points;
  if (source.length < 3) return 0;
  let total = 0;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[(index + 1) % source.length];
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

function pointInsidePolygon(point: LocalPoint, polygon: LocalPoint[]): boolean {
  const source =
    polygon.length > 1 && almostSame(polygon[0], polygon[polygon.length - 1])
      ? polygon.slice(0, -1)
      : polygon;
  let inside = false;
  for (let currentIndex = 0, previousIndex = source.length - 1;
    currentIndex < source.length;
    previousIndex = currentIndex, currentIndex += 1) {
    const current = source[currentIndex];
    const previous = source[previousIndex];
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          Math.max(0.0000001, previous.y - current.y) +
        current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function landCoverTypeFromTags(
  tags: Record<string, string | undefined>,
): RealSceneLandCoverType | null {
  const natural = tags.natural?.toLowerCase();
  const landuse = tags.landuse?.toLowerCase();
  const leisure = tags.leisure?.toLowerCase();

  if (natural === "wood") return "Woodland";
  if (natural === "scrub") return "Scrub";
  if (natural === "grassland") return "Grass";
  if (natural === "wetland") return "Wetland";
  if (natural === "bare_rock" || natural === "sand" || natural === "scree") {
    return "Bare Ground";
  }
  if (natural === "water" || tags.water || tags.waterway === "riverbank") {
    return "Water";
  }
  if (landuse === "forest") return "Forest";
  if (landuse === "grass" || landuse === "village_green") return "Grass";
  if (landuse === "meadow") return "Meadow";
  if (landuse === "farmland" || landuse === "farmyard") return "Farmland";
  if (landuse === "orchard" || landuse === "vineyard") return "Orchard";
  if (landuse === "recreation_ground" || leisure === "park") return "Park";
  if (leisure === "garden") return "Garden";
  if (leisure === "nature_reserve") return "Woodland";
  return null;
}

function vegetationProfile(type: RealSceneLandCoverType): {
  plantType: RealSceneVegetationType;
  squareMetresPerPlant: number;
  minimumHeight: number;
  maximumHeight: number;
  canopyRatio: number;
} | null {
  switch (type) {
    case "Forest":
    case "Woodland":
      return {
        plantType: "Tree",
        squareMetresPerPlant: 95,
        minimumHeight: 4.5,
        maximumHeight: 11,
        canopyRatio: 0.58,
      };
    case "Orchard":
      return {
        plantType: "Tree",
        squareMetresPerPlant: 150,
        minimumHeight: 2.6,
        maximumHeight: 6.2,
        canopyRatio: 0.72,
      };
    case "Scrub":
      return {
        plantType: "Shrub",
        squareMetresPerPlant: 75,
        minimumHeight: 0.7,
        maximumHeight: 2.3,
        canopyRatio: 1.15,
      };
    case "Park":
    case "Garden":
      return {
        plantType: "Tree",
        squareMetresPerPlant: 260,
        minimumHeight: 3.2,
        maximumHeight: 8.5,
        canopyRatio: 0.62,
      };
    default:
      return null;
  }
}

function buildLandCover(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneLandCoverGeometry | null {
  const tags = element.tags ?? {};
  const landCoverType = landCoverTypeFromTags(tags);
  if (!landCoverType) return null;

  const points = clipPolygon(
    toGeoPoints(element).map((point) => toLocal(point, projection)),
    projection.widthMetres,
    projection.heightMetres,
  );
  if (points.length < 4 || polygonArea(points) < 1) return null;

  const sourceTag = tags.natural
    ? `natural=${tags.natural}`
    : tags.landuse
      ? `landuse=${tags.landuse}`
      : tags.leisure
        ? `leisure=${tags.leisure}`
        : tags.water
          ? `water=${tags.water}`
          : "mapped land cover";

  return {
    id: `osm-land-cover-${element.id}`,
    osmId: element.id,
    name: tags.name?.trim() || landCoverType,
    landCoverType,
    sourceTag,
    points: points.map((point) => toGeo(point, projection)),
    localPoints: points.map((point) => toStoredLocal(point, projection)),
  };
}

function buildMappedVegetationPoint(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneVegetationGeometry | null {
  if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) return null;
  const local = toLocal(
    { latitude: element.lat as number, longitude: element.lon as number },
    projection,
  );
  if (
    local.x < 0 ||
    local.y < 0 ||
    local.x > projection.widthMetres ||
    local.y > projection.heightMetres
  ) {
    return null;
  }

  const tags = element.tags ?? {};
  const descriptor = `${tags.species ?? ""} ${tags.genus ?? ""} ${tags.leaf_type ?? ""}`.toLowerCase();
  const vegetationType: RealSceneVegetationType =
    tags.natural === "shrub"
      ? "Shrub"
      : descriptor.includes("palm")
        ? "Palm"
        : "Tree";
  const defaultHeight = vegetationType === "Shrub" ? 1.5 : vegetationType === "Palm" ? 8 : 6;
  const heightMetres = clamp(parseNumber(tags.height) ?? defaultHeight, 0.5, 32);
  const canopyDiameterMetres = clamp(
    parseNumber(tags.diameter_crown) ??
      (vegetationType === "Shrub" ? heightMetres * 1.15 : heightMetres * 0.55),
    0.5,
    18,
  );
  const position = toGeo(local, projection);

  return {
    id: `osm-vegetation-${element.id}`,
    osmId: element.id,
    name: tags.name?.trim() || (vegetationType === "Shrub" ? "Mapped shrub" : "Mapped tree"),
    vegetationType,
    position,
    localPosition: toStoredLocal(local, projection),
    heightMetres: Number(heightMetres.toFixed(2)),
    canopyDiameterMetres: Number(canopyDiameterMetres.toFixed(2)),
    generatedFromLandCover: false,
  };
}

function generateVegetationFromLandCover(
  cover: RealSceneLandCoverGeometry,
  projection: ProjectionContext,
  maximumRemaining: number,
): RealSceneVegetationGeometry[] {
  const profile = vegetationProfile(cover.landCoverType);
  if (!profile || maximumRemaining <= 0) return [];

  const polygon = cover.localPoints.map((point) => ({
    x: point.xMetres,
    y: point.yMetres,
  }));
  const area = polygonArea(polygon);
  const requested = clamp(
    Math.round(area / profile.squareMetresPerPlant),
    area >= 45 ? 1 : 0,
    Math.min(90, maximumRemaining),
  );
  if (requested <= 0) return [];

  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const minimumX = Math.max(0, Math.min(...xs));
  const maximumX = Math.min(projection.widthMetres, Math.max(...xs));
  const minimumY = Math.max(0, Math.min(...ys));
  const maximumY = Math.min(projection.heightMetres, Math.max(...ys));
  const random = createSeededRandom(cover.osmId * 2_654_435_761);
  const result: RealSceneVegetationGeometry[] = [];
  const maximumAttempts = requested * 28 + 80;

  for (let attempt = 0; attempt < maximumAttempts && result.length < requested; attempt += 1) {
    const local = {
      x: minimumX + random() * Math.max(0.01, maximumX - minimumX),
      y: minimumY + random() * Math.max(0.01, maximumY - minimumY),
    };
    if (!pointInsidePolygon(local, polygon)) continue;

    const heightMetres =
      profile.minimumHeight + random() * (profile.maximumHeight - profile.minimumHeight);
    const vegetationType =
      profile.plantType === "Tree" && random() > 0.965 ? "Palm" : profile.plantType;
    const canopyDiameterMetres = clamp(
      heightMetres * profile.canopyRatio * (0.78 + random() * 0.42),
      vegetationType === "Shrub" ? 0.7 : 1.2,
      vegetationType === "Shrub" ? 4.5 : 9,
    );
    const position = toGeo(local, projection);

    result.push({
      id: `${cover.id}-vegetation-${result.length + 1}`,
      osmId: cover.osmId,
      name: `${cover.name} vegetation`,
      vegetationType,
      position,
      localPosition: toStoredLocal(local, projection),
      heightMetres: Number(heightMetres.toFixed(2)),
      canopyDiameterMetres: Number(canopyDiameterMetres.toFixed(2)),
      generatedFromLandCover: true,
    });
  }

  return result;
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
  way["landuse"](${south},${west},${north},${east});
  way["natural"~"wood|scrub|grassland|wetland|bare_rock|sand|scree|water"](${south},${west},${north},${east});
  way["leisure"~"park|garden|nature_reserve"](${south},${west},${north},${east});
  way["waterway"="riverbank"](${south},${west},${north},${east});
  node["natural"~"tree|shrub"](${south},${west},${north},${east});
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
  landCover: RealSceneLandCoverGeometry[],
  vegetation: RealSceneVegetationGeometry[],
): number {
  const roadPointCount = roads.reduce(
    (total, road) => total + road.localPoints.length,
    0,
  );
  const coverage = Math.min(1, roadPointCount / 45);
  const featureScore = Math.min(
    1,
    (roads.length + paths.length + buildings.length + landCover.length + vegetation.length / 8) / 20,
  );
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
    const landCover: RealSceneLandCoverGeometry[] = [];
    const vegetation: RealSceneVegetationGeometry[] = [];

    for (const element of response.elements ?? []) {
      const tags = element.tags ?? {};

      if (element.type === "node") {
        if (tags.natural === "tree" || tags.natural === "shrub") {
          const mappedPlant = buildMappedVegetationPoint(element, projection);
          if (mappedPlant) vegetation.push(mappedPlant);
        }
        continue;
      }

      if (element.type !== "way" || !element.geometry?.length) continue;

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

      if (tags.barrier) {
        barriers.push(...buildBarrier(element, projection));
        if (tags.barrier !== "hedge") continue;
      }

      const cover = buildLandCover(element, projection);
      if (cover) landCover.push(cover);
    }

    const maximumVegetation = 360;
    for (const cover of landCover) {
      const remaining = maximumVegetation - vegetation.length;
      if (remaining <= 0) break;
      vegetation.push(...generateVegetationFromLandCover(cover, projection, remaining));
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
    if (landCover.length === 0) {
      warnings.push(
        "No mapped vegetation or land-cover polygons were returned. The map snapshot remains available for officer review.",
      );
    }
    if (!snapshot) {
      warnings.push(
        "The map canvas could not be stored as an image. Geographic bounds and vector geometry were still preserved.",
      );
    }

    const geometry: RealSceneGeometry = {
      version: "RoadSafe Real Scene V2",
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
      landCover,
      vegetation,
      confidence: calculateConfidence(roads, paths, buildings, landCover, vegetation),
      warnings,
      attribution: "Map geometry © OpenStreetMap contributors",
      extractedAt: new Date().toISOString(),
    };

    return { geometry, warnings };
  },
};
