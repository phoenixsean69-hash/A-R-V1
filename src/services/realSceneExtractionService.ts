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

const OVERPASS_ENDPOINTS = Array.from(
  new Set(
    [
      import.meta.env.VITE_OVERPASS_URL,
      "https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ].filter(
      (value): value is string =>
        Boolean(value),
    ),
  ),
);

const RESPONSE_CACHE_KEY =
  "roadsafe-real-scene-overpass-cache-v3";
const CACHE_MAX_AGE_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const ENDPOINT_STAGGER_MS = 220;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string | undefined>;
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
  lat?: number;
  lon?: number;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface CachedResponse {
  storedAt: number;
  response: OverpassResponse;
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

const inFlightRequests = new Map<
  string,
  Promise<OverpassResponse>
>();

const memoryCache = new Map<
  string,
  CachedResponse
>();

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

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) =>
    window.setTimeout(resolve, milliseconds),
  );
}

function parseNumber(
  value?: string,
): number | undefined {
  if (!value) return undefined;

  const matched = value
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);

  if (!matched) return undefined;

  const parsed = Number(matched[0]);
  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function parseInteger(
  value?: string,
): number | undefined {
  const parsed = parseNumber(
    value?.split(/[;|]/)[0],
  );

  return parsed === undefined
    ? undefined
    : Math.max(1, Math.round(parsed));
}

function parseBoolean(
  value?: string,
): boolean | undefined {
  if (!value) return undefined;

  const normalised = value.toLowerCase();

  if (
    ["yes", "true", "1", "-1"].includes(
      normalised,
    )
  ) {
    return true;
  }

  if (
    ["no", "false", "0"].includes(
      normalised,
    )
  ) {
    return false;
  }

  return undefined;
}

function parseMaximumSpeed(
  value?: string,
): number | undefined {
  const speed = parseNumber(value);
  if (speed === undefined) return undefined;

  return /mph/i.test(value ?? "")
    ? Math.round(speed * 1.60934)
    : Math.round(speed);
}

function cacheKey(
  selection: RealSceneAreaSelection,
): string {
  const { bounds } = selection;

  return [
    bounds.south.toFixed(6),
    bounds.west.toFixed(6),
    bounds.north.toFixed(6),
    bounds.east.toFixed(6),
  ].join(":");
}

function readCache(
  key: string,
): OverpassResponse | null {
  const memory = memoryCache.get(key);

  if (
    memory &&
    Date.now() - memory.storedAt <=
      CACHE_MAX_AGE_MS
  ) {
    return memory.response;
  }

  try {
    const stored =
      sessionStorage.getItem(
        RESPONSE_CACHE_KEY,
      );

    if (!stored) return null;

    const cache = JSON.parse(stored) as Record<
      string,
      CachedResponse
    >;
    const entry = cache[key];

    if (
      !entry ||
      Date.now() - entry.storedAt >
        CACHE_MAX_AGE_MS
    ) {
      return null;
    }

    memoryCache.set(key, entry);
    return entry.response;
  } catch {
    return null;
  }
}

function writeCache(
  key: string,
  response: OverpassResponse,
): void {
  const entry = {
    storedAt: Date.now(),
    response,
  };

  memoryCache.set(key, entry);

  try {
    const stored =
      sessionStorage.getItem(
        RESPONSE_CACHE_KEY,
      );
    const cache = stored
      ? (JSON.parse(stored) as Record<
          string,
          CachedResponse
        >)
      : {};

    cache[key] = entry;

    const ordered = Object.entries(cache)
      .sort(
        (first, second) =>
          second[1].storedAt -
          first[1].storedAt,
      )
      .slice(0, 6);

    const next = Object.fromEntries(ordered);
    const serialised = JSON.stringify(next);

    if (serialised.length < 4_000_000) {
      sessionStorage.setItem(
        RESPONSE_CACHE_KEY,
        serialised,
      );
    }
  } catch {
    // Cache failures must never block scene extraction.
  }
}

function createProjection(
  selection: RealSceneAreaSelection,
): ProjectionContext {
  const centreLatitude =
    (selection.bounds.north +
      selection.bounds.south) /
    2;

  const metresPerLatitudeDegree = 110_540;
  const metresPerLongitudeDegree =
    111_320 *
    Math.max(
      0.000001,
      Math.cos(
        (centreLatitude * Math.PI) /
          180,
      ),
    );

  return {
    widthMetres: Math.max(
      1,
      (selection.bounds.east -
        selection.bounds.west) *
        metresPerLongitudeDegree,
    ),
    heightMetres: Math.max(
      1,
      (selection.bounds.north -
        selection.bounds.south) *
        metresPerLatitudeDegree,
    ),
    metresPerLongitudeDegree,
    metresPerLatitudeDegree,
    west: selection.bounds.west,
    south: selection.bounds.south,
  };
}

function toLocal(
  point: RealSceneGeoPoint,
  projection: ProjectionContext,
): LocalPoint {
  return {
    x:
      (point.longitude -
        projection.west) *
      projection.metresPerLongitudeDegree,
    y:
      (point.latitude -
        projection.south) *
      projection.metresPerLatitudeDegree,
  };
}

function toGeo(
  point: LocalPoint,
  projection: ProjectionContext,
): RealSceneGeoPoint {
  return {
    longitude:
      projection.west +
      point.x /
        projection.metresPerLongitudeDegree,
    latitude:
      projection.south +
      point.y /
        projection.metresPerLatitudeDegree,
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
      clamp(
        (point.x /
          projection.widthMetres) *
          100,
        0,
        100,
      ).toFixed(6),
    ),
    yPercent: Number(
      clamp(
        100 -
          (point.y /
            projection.heightMetres) *
            100,
        0,
        100,
      ).toFixed(6),
    ),
  };
}

function almostSame(
  first: LocalPoint,
  second: LocalPoint,
): boolean {
  return (
    Math.hypot(
      first.x - second.x,
      first.y - second.y,
    ) <= 0.015
  );
}

function clipLineSegment(
  start: LocalPoint,
  end: LocalPoint,
  width: number,
  height: number,
): [LocalPoint, LocalPoint] | null {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const p = [
    -deltaX,
    deltaX,
    -deltaY,
    deltaY,
  ];
  const q = [
    start.x,
    width - start.x,
    start.y,
    height - start.y,
  ];

  let minimum = 0;
  let maximum = 1;

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    if (
      Math.abs(p[index]) <
      0.0000001
    ) {
      if (q[index] < 0) return null;
      continue;
    }

    const ratio =
      q[index] / p[index];

    if (p[index] < 0) {
      minimum = Math.max(
        minimum,
        ratio,
      );
    } else {
      maximum = Math.min(
        maximum,
        ratio,
      );
    }

    if (minimum > maximum) {
      return null;
    }
  }

  return [
    {
      x:
        start.x +
        deltaX * minimum,
      y:
        start.y +
        deltaY * minimum,
    },
    {
      x:
        start.x +
        deltaX * maximum,
      y:
        start.y +
        deltaY * maximum,
    },
  ];
}

function clipPolyline(
  points: LocalPoint[],
  width: number,
  height: number,
): LocalPoint[][] {
  const paths: LocalPoint[][] = [];
  let current: LocalPoint[] = [];

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const clipped = clipLineSegment(
      points[index - 1],
      points[index],
      width,
      height,
    );

    if (!clipped) {
      if (current.length >= 2) {
        paths.push(current);
      }
      current = [];
      continue;
    }

    const [start, end] = clipped;

    if (current.length === 0) {
      current.push(start, end);
    } else if (
      almostSame(
        current[current.length - 1],
        start,
      )
    ) {
      current.push(end);
    } else {
      if (current.length >= 2) {
        paths.push(current);
      }

      current = [start, end];
    }
  }

  if (current.length >= 2) {
    paths.push(current);
  }

  return paths.map((path) =>
    path.filter(
      (point, index) =>
        index === 0 ||
        !almostSame(
          point,
          path[index - 1],
        ),
    ),
  );
}

function clipPolygonAgainstEdge(
  points: LocalPoint[],
  inside: (
    point: LocalPoint,
  ) => boolean,
  intersection: (
    start: LocalPoint,
    end: LocalPoint,
  ) => LocalPoint,
): LocalPoint[] {
  if (points.length === 0) {
    return [];
  }

  const output: LocalPoint[] = [];
  let previous =
    points[points.length - 1];
  let previousInside =
    inside(previous);

  for (const point of points) {
    const pointInside = inside(point);

    if (pointInside) {
      if (!previousInside) {
        output.push(
          intersection(
            previous,
            point,
          ),
        );
      }

      output.push(point);
    } else if (previousInside) {
      output.push(
        intersection(
          previous,
          point,
        ),
      );
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
    original.length > 1 &&
    almostSame(
      original[0],
      original[
        original.length - 1
      ],
    )
      ? original.slice(0, -1)
      : [...original];

  const verticalIntersection =
    (edgeX: number) =>
    (
      start: LocalPoint,
      end: LocalPoint,
    ): LocalPoint => {
      const ratio =
        Math.abs(
          end.x - start.x,
        ) < 0.0000001
          ? 0
          : (edgeX - start.x) /
            (end.x - start.x);

      return {
        x: edgeX,
        y:
          start.y +
          (end.y - start.y) *
            ratio,
      };
    };

  const horizontalIntersection =
    (edgeY: number) =>
    (
      start: LocalPoint,
      end: LocalPoint,
    ): LocalPoint => {
      const ratio =
        Math.abs(
          end.y - start.y,
        ) < 0.0000001
          ? 0
          : (edgeY - start.y) /
            (end.y - start.y);

      return {
        x:
          start.x +
          (end.x - start.x) *
            ratio,
        y: edgeY,
      };
    };

  let clipped =
    clipPolygonAgainstEdge(
      points,
      (point) => point.x >= 0,
      verticalIntersection(0),
    );

  clipped =
    clipPolygonAgainstEdge(
      clipped,
      (point) =>
        point.x <= width,
      verticalIntersection(width),
    );

  clipped =
    clipPolygonAgainstEdge(
      clipped,
      (point) => point.y >= 0,
      horizontalIntersection(0),
    );

  clipped =
    clipPolygonAgainstEdge(
      clipped,
      (point) =>
        point.y <= height,
      horizontalIntersection(height),
    );

  if (
    clipped.length >= 3 &&
    !almostSame(
      clipped[0],
      clipped[
        clipped.length - 1
      ],
    )
  ) {
    clipped.push({
      ...clipped[0],
    });
  }

  return clipped;
}

function polygonArea(
  points: LocalPoint[],
): number {
  const source =
    points.length > 1 &&
    almostSame(
      points[0],
      points[points.length - 1],
    )
      ? points.slice(0, -1)
      : points;

  if (source.length < 3) return 0;

  let total = 0;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const current = source[index];
    const next =
      source[
        (index + 1) %
          source.length
      ];

    total +=
      current.x * next.y -
      next.x * current.y;
  }

  return Math.abs(total) / 2;
}

function pointInsidePolygon(
  point: LocalPoint,
  polygon: LocalPoint[],
): boolean {
  const source =
    polygon.length > 1 &&
    almostSame(
      polygon[0],
      polygon[
        polygon.length - 1
      ],
    )
      ? polygon.slice(0, -1)
      : polygon;

  let inside = false;

  for (
    let currentIndex = 0,
      previousIndex =
        source.length - 1;
    currentIndex < source.length;
    previousIndex =
      currentIndex,
      currentIndex += 1
  ) {
    const current =
      source[currentIndex];
    const previous =
      source[previousIndex];

    const crosses =
      current.y > point.y !==
        previous.y > point.y &&
      point.x <
        ((previous.x - current.x) *
          (point.y - current.y)) /
          Math.max(
            0.0000001,
            previous.y - current.y,
          ) +
          current.x;

    if (crosses) inside = !inside;
  }

  return inside;
}

function createSeededRandom(
  seed: number,
): () => number {
  let state = seed >>> 0;

  return () => {
    state =
      (state * 1_664_525 +
        1_013_904_223) >>>
      0;

    return state / 4_294_967_296;
  };
}

function toGeoPoints(
  element: OverpassElement,
): RealSceneGeoPoint[] {
  if (
    Array.isArray(
      element.geometry,
    )
  ) {
    return element.geometry
      .filter(
        (point) =>
          Number.isFinite(
            point.lat,
          ) &&
          Number.isFinite(
            point.lon,
          ),
      )
      .map((point) => ({
        latitude: point.lat,
        longitude: point.lon,
      }));
  }

  if (
    Number.isFinite(element.lat) &&
    Number.isFinite(element.lon)
  ) {
    return [
      {
        latitude:
          element.lat as number,
        longitude:
          element.lon as number,
      },
    ];
  }

  return [];
}

function defaultLaneCount(
  highwayType: string,
): number {
  if (
    [
      "motorway",
      "trunk",
      "primary",
    ].includes(highwayType)
  ) {
    return 4;
  }

  return 2;
}

function defaultRoadWidth(
  highwayType: string,
  lanes: number,
): number {
  const laneWidth =
    [
      "motorway",
      "trunk",
      "primary",
    ].includes(highwayType)
      ? 3.5
      : 3.1;

  return Math.max(
    3.2,
    lanes * laneWidth,
  );
}

function defaultPathWidth(
  highwayType: string,
): number {
  if (highwayType === "cycleway") {
    return 2;
  }

  if (
    highwayType === "pedestrian"
  ) {
    return 3;
  }

  return 1.4;
}

function landCoverTypeFromTags(
  tags: Record<
    string,
    string | undefined
  >,
): RealSceneLandCoverType | null {
  const natural =
    tags.natural?.toLowerCase();
  const landuse =
    tags.landuse?.toLowerCase();
  const leisure =
    tags.leisure?.toLowerCase();

  if (natural === "wood") {
    return "Woodland";
  }

  if (natural === "scrub") {
    return "Scrub";
  }

  if (
    natural === "grassland"
  ) {
    return "Grass";
  }

  if (natural === "wetland") {
    return "Wetland";
  }

  if (
    ["bare_rock", "sand", "scree"].includes(
      natural ?? "",
    )
  ) {
    return "Bare Ground";
  }

  if (
    natural === "water" ||
    tags.water ||
    tags.waterway ===
      "riverbank"
  ) {
    return "Water";
  }

  if (landuse === "forest") {
    return "Forest";
  }

  if (
    landuse === "grass" ||
    landuse ===
      "village_green"
  ) {
    return "Grass";
  }

  if (landuse === "meadow") {
    return "Meadow";
  }

  if (
    landuse === "farmland" ||
    landuse === "farmyard"
  ) {
    return "Farmland";
  }

  if (
    landuse === "orchard" ||
    landuse === "vineyard"
  ) {
    return "Orchard";
  }

  if (
    landuse ===
      "recreation_ground" ||
    leisure === "park"
  ) {
    return "Park";
  }

  if (leisure === "garden") {
    return "Garden";
  }

  return null;
}

function vegetationTypeFromTags(
  tags: Record<
    string,
    string | undefined
  >,
): RealSceneVegetationType {
  if (
    tags.natural === "shrub"
  ) {
    return "Shrub";
  }

  const species = `${
    tags.species ?? ""
  } ${tags.genus ?? ""}`.toLowerCase();

  return species.includes("palm")
    ? "Palm"
    : "Tree";
}

function buildRoadsAndPaths(
  element: OverpassElement,
  projection: ProjectionContext,
): {
  roads: RealSceneRoadGeometry[];
  paths: RealScenePathGeometry[];
} {
  const tags = element.tags ?? {};
  const highwayType =
    tags.highway ?? "road";
  const geoPoints =
    toGeoPoints(element);

  if (geoPoints.length < 2) {
    return {
      roads: [],
      paths: [],
    };
  }

  const localSegments =
    clipPolyline(
      geoPoints.map((point) =>
        toLocal(point, projection),
      ),
      projection.widthMetres,
      projection.heightMetres,
    );

  if (
    PATH_HIGHWAY_TYPES.has(
      highwayType,
    )
  ) {
    const widthMetres = clamp(
      parseNumber(tags.width) ??
        defaultPathWidth(
          highwayType,
        ),
      0.6,
      12,
    );

    return {
      roads: [],
      paths:
        localSegments.map(
          (segment, index) => ({
            id: `osm-path-${element.id}-${index + 1}`,
            osmId: element.id,
            name:
              tags.name?.trim() ||
              highwayType.replaceAll(
                "_",
                " ",
              ),
            pathType: highwayType,
            widthMetres: Number(
              widthMetres.toFixed(2),
            ),
            points: segment.map(
              (point) =>
                toGeo(
                  point,
                  projection,
                ),
            ),
            localPoints:
              segment.map(
                (point) =>
                  toStoredLocal(
                    point,
                    projection,
                  ),
              ),
          }),
        ),
    };
  }

  const lanes = clamp(
    parseInteger(tags.lanes) ??
      defaultLaneCount(
        highwayType,
      ),
    1,
    12,
  );

  const widthMetres = clamp(
    parseNumber(tags.width) ??
      defaultRoadWidth(
        highwayType,
        lanes,
      ),
    2.4,
    45,
  );

  return {
    paths: [],
    roads: localSegments.map(
      (segment, index) => ({
        id: `osm-road-${element.id}-${index + 1}`,
        osmId: element.id,
        name:
          tags.name?.trim() ||
          tags.ref?.trim() ||
          "Unnamed road",
        highwayType,
        laneCount: lanes,
        widthMetres: Number(
          widthMetres.toFixed(2),
        ),
        oneWay: parseBoolean(
          tags.oneway,
        ),
        surface: tags.surface,
        maximumSpeedKmh:
          parseMaximumSpeed(
            tags.maxspeed,
          ),
        isRoundabout:
          tags.junction ===
            "roundabout" ||
          tags.junction ===
            "circular",
        points: segment.map(
          (point) =>
            toGeo(
              point,
              projection,
            ),
        ),
        localPoints:
          segment.map(
            (point) =>
              toStoredLocal(
                point,
                projection,
              ),
          ),
      }),
    ),
  };
}

function buildBuilding(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneBuildingGeometry | null {
  const tags = element.tags ?? {};

  const points = clipPolygon(
    toGeoPoints(element).map(
      (point) =>
        toLocal(point, projection),
    ),
    projection.widthMetres,
    projection.heightMetres,
  );

  if (
    points.length < 4 ||
    polygonArea(points) < 1
  ) {
    return null;
  }

  const levels = parseInteger(
    tags["building:levels"],
  );

  const height =
    parseNumber(tags.height) ??
    (levels ? levels * 3 : 4.2);

  return {
    id: `osm-building-${element.id}`,
    osmId: element.id,
    name:
      tags.name?.trim() ||
      "Mapped building",
    buildingType:
      tags.building ?? "yes",
    levels,
    heightMetres: Number(
      clamp(height, 2.2, 120).toFixed(
        2,
      ),
    ),
    points: points.map((point) =>
      toGeo(point, projection),
    ),
    localPoints: points.map(
      (point) =>
        toStoredLocal(
          point,
          projection,
        ),
    ),
  };
}

function buildBarrier(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneBarrierGeometry[] {
  const tags = element.tags ?? {};
  const geoPoints =
    toGeoPoints(element);

  if (geoPoints.length < 2) {
    return [];
  }

  const segments = clipPolyline(
    geoPoints.map((point) =>
      toLocal(point, projection),
    ),
    projection.widthMetres,
    projection.heightMetres,
  );

  const barrierType =
    tags.barrier ?? "barrier";
  const height =
    parseNumber(tags.height) ??
    (["wall", "fence"].includes(
      barrierType,
    )
      ? 1.8
      : 0.9);

  return segments.map(
    (segment, index) => ({
      id: `osm-barrier-${element.id}-${index + 1}`,
      osmId: element.id,
      name:
        tags.name?.trim() ||
        barrierType.replaceAll(
          "_",
          " ",
        ),
      barrierType,
      heightMetres: Number(
        clamp(height, 0.3, 8).toFixed(
          2,
        ),
      ),
      points: segment.map(
        (point) =>
          toGeo(
            point,
            projection,
          ),
      ),
      localPoints: segment.map(
        (point) =>
          toStoredLocal(
            point,
            projection,
          ),
      ),
    }),
  );
}

function buildLandCover(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneLandCoverGeometry | null {
  const tags = element.tags ?? {};
  const landCoverType =
    landCoverTypeFromTags(tags);

  if (!landCoverType) {
    return null;
  }

  const points = clipPolygon(
    toGeoPoints(element).map(
      (point) =>
        toLocal(point, projection),
    ),
    projection.widthMetres,
    projection.heightMetres,
  );

  if (
    points.length < 4 ||
    polygonArea(points) < 2
  ) {
    return null;
  }

  const sourceTag =
    tags.natural
      ? `natural=${tags.natural}`
      : tags.landuse
        ? `landuse=${tags.landuse}`
        : tags.leisure
          ? `leisure=${tags.leisure}`
          : "mapped land cover";

  return {
    id: `osm-land-cover-${element.id}`,
    osmId: element.id,
    name:
      tags.name?.trim() ||
      landCoverType,
    landCoverType,
    sourceTag,
    points: points.map((point) =>
      toGeo(point, projection),
    ),
    localPoints: points.map(
      (point) =>
        toStoredLocal(
          point,
          projection,
        ),
    ),
  };
}

function buildMappedVegetation(
  element: OverpassElement,
  projection: ProjectionContext,
): RealSceneVegetationGeometry | null {
  const point =
    toGeoPoints(element)[0];

  if (!point) return null;

  const local = toLocal(
    point,
    projection,
  );

  if (
    local.x < 0 ||
    local.x >
      projection.widthMetres ||
    local.y < 0 ||
    local.y >
      projection.heightMetres
  ) {
    return null;
  }

  const tags = element.tags ?? {};
  const type =
    vegetationTypeFromTags(tags);

  const height =
    parseNumber(tags.height) ??
    (type === "Shrub" ? 1.4 : 7);

  const canopy =
    parseNumber(tags.diameter_crown) ??
    (type === "Shrub" ? 1.5 : 4.5);

  return {
    id: `osm-vegetation-${element.id}`,
    osmId: element.id,
    name:
      tags.name?.trim() ||
      type,
    vegetationType: type,
    position: point,
    localPosition: toStoredLocal(
      local,
      projection,
    ),
    heightMetres: Number(
      clamp(height, 0.4, 45).toFixed(
        2,
      ),
    ),
    canopyDiameterMetres: Number(
      clamp(canopy, 0.5, 25).toFixed(
        2,
      ),
    ),
    generatedFromLandCover: false,
  };
}

function generateVegetationFromCover(
  cover: RealSceneLandCoverGeometry,
  projection: ProjectionContext,
  maximum: number,
): RealSceneVegetationGeometry[] {
  if (
    ![
      "Forest",
      "Woodland",
      "Scrub",
      "Orchard",
      "Park",
      "Garden",
    ].includes(cover.landCoverType)
  ) {
    return [];
  }

  const localPolygon =
    cover.localPoints.map(
      (point) => ({
        x: point.xMetres,
        y: point.yMetres,
      }),
    );

  const area = polygonArea(
    localPolygon,
  );

  const density =
    cover.landCoverType ===
      "Forest"
      ? 65
      : cover.landCoverType ===
          "Woodland"
        ? 100
        : cover.landCoverType ===
            "Scrub"
          ? 135
          : 180;

  const count = Math.min(
    maximum,
    Math.max(
      0,
      Math.round(area / density),
    ),
  );

  if (count === 0) return [];

  const seed =
    cover.osmId ^
    Math.round(area * 10);
  const random =
    createSeededRandom(seed);

  const xs =
    localPolygon.map(
      (point) => point.x,
    );
  const ys =
    localPolygon.map(
      (point) => point.y,
    );

  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);

  const result: RealSceneVegetationGeometry[] =
    [];
  let attempts = 0;

  while (
    result.length < count &&
    attempts < count * 25
  ) {
    attempts += 1;

    const point = {
      x:
        minimumX +
        (maximumX - minimumX) *
          random(),
      y:
        minimumY +
        (maximumY - minimumY) *
          random(),
    };

    if (
      !pointInsidePolygon(
        point,
        localPolygon,
      )
    ) {
      continue;
    }

    const shrub =
      cover.landCoverType ===
        "Scrub" &&
      random() < 0.72;

    result.push({
      id: `${cover.id}-generated-${result.length + 1}`,
      name: shrub
        ? "Mapped shrub"
        : "Mapped tree",
      vegetationType: shrub
        ? "Shrub"
        : "Tree",
      position: toGeo(
        point,
        projection,
      ),
      localPosition:
        toStoredLocal(
          point,
          projection,
        ),
      heightMetres: Number(
        (
          shrub
            ? 0.8 + random() * 1.5
            : 4 + random() * 6
        ).toFixed(2),
      ),
      canopyDiameterMetres: Number(
        (
          shrub
            ? 1 + random() * 1.5
            : 2.5 + random() * 4
        ).toFixed(2),
      ),
      generatedFromLandCover:
        true,
    });
  }

  return result;
}

function expandBounds(
  selection: RealSceneAreaSelection,
  paddingMetres: number,
): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  const centreLatitude =
    (selection.bounds.north +
      selection.bounds.south) /
    2;

  const latitudePadding =
    paddingMetres / 110_540;
  const longitudePadding =
    paddingMetres /
    (111_320 *
      Math.max(
        0.000001,
        Math.cos(
          (centreLatitude *
            Math.PI) /
            180,
        ),
      ));

  return {
    south:
      selection.bounds.south -
      latitudePadding,
    west:
      selection.bounds.west -
      longitudePadding,
    north:
      selection.bounds.north +
      latitudePadding,
    east:
      selection.bounds.east +
      longitudePadding,
  };
}

function createOverpassQuery(
  selection: RealSceneAreaSelection,
  paddingMetres = 16,
  roadsOnly = false,
): string {
  const {
    south,
    west,
    north,
    east,
  } = expandBounds(
    selection,
    paddingMetres,
  );

  if (roadsOnly) {
    return `[out:json][timeout:9];
way["highway"]["area"!="yes"](${south},${west},${north},${east});
out tags geom qt;`;
  }

  return `[out:json][timeout:14];
(
  way["highway"]["area"!="yes"](${south},${west},${north},${east});
  way["building"](${south},${west},${north},${east});
  way["barrier"](${south},${west},${north},${east});
  way["landuse"](${south},${west},${north},${east});
  way["natural"~"wood|scrub|grassland|wetland|bare_rock|sand|scree|water"](${south},${west},${north},${east});
  way["leisure"~"park|garden|nature_reserve"](${south},${west},${north},${east});
  way["waterway"="riverbank"](${south},${west},${north},${east});
  node["natural"~"tree|shrub"](${south},${west},${north},${east});
);
out tags geom qt;`;
}

async function requestEndpoint(
  endpoint: string,
  query: string,
  controller: AbortController,
): Promise<OverpassResponse> {
  const timeout =
    window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

  try {
    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          data: query,
        }).toString(),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Overpass returned HTTP ${response.status}.`,
      );
    }

    return (await response.json()) as OverpassResponse;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchFirstSuccessful(
  query: string,
): Promise<OverpassResponse> {
  if (
    OVERPASS_ENDPOINTS.length === 0
  ) {
    throw new Error(
      "No Overpass endpoint is configured.",
    );
  }

  return await new Promise<OverpassResponse>(
    (resolve, reject) => {
      const controllers =
        OVERPASS_ENDPOINTS.map(
          () => new AbortController(),
        );

      const errors: unknown[] = [];
      let finished = false;
      let rejected = 0;

      const finishWithSuccess = (
        response: OverpassResponse,
      ) => {
        if (finished) return;
        finished = true;

        controllers.forEach(
          (controller) =>
            controller.abort(),
        );

        resolve(response);
      };

      const finishWithFailure = (
        error: unknown,
      ) => {
        errors.push(error);
        rejected += 1;

        if (
          !finished &&
          rejected ===
            OVERPASS_ENDPOINTS.length
        ) {
          finished = true;
          const meaningful =
            errors.find(
              (item) =>
                item instanceof Error &&
                item.name !==
                  "AbortError",
            );

          reject(
            meaningful instanceof Error
              ? meaningful
              : new Error(
                  "All configured road-data services failed.",
                ),
          );
        }
      };

      OVERPASS_ENDPOINTS.forEach(
        (
          endpoint,
          index,
        ) => {
          void delay(
            index *
              ENDPOINT_STAGGER_MS,
          ).then(async () => {
            if (finished) return;

            try {
              const response =
                await requestEndpoint(
                  endpoint,
                  query,
                  controllers[index],
                );

              finishWithSuccess(
                response,
              );
            } catch (error) {
              if (
                !finished ||
                !(error instanceof DOMException) ||
                error.name !==
                  "AbortError"
              ) {
                finishWithFailure(
                  error,
                );
              }
            }
          });
        },
      );
    },
  );
}

function mergeResponses(
  first: OverpassResponse,
  second: OverpassResponse,
): OverpassResponse {
  const unique = new Map<
    string,
    OverpassElement
  >();

  for (const element of [
    ...(first.elements ?? []),
    ...(second.elements ?? []),
  ]) {
    unique.set(
      `${element.type}:${element.id}`,
      element,
    );
  }

  return {
    elements: [...unique.values()],
  };
}

async function fetchSceneData(
  selection: RealSceneAreaSelection,
): Promise<OverpassResponse> {
  const key = cacheKey(selection);
  const cached = readCache(key);

  if (cached) {
    return cached;
  }

  const existing =
    inFlightRequests.get(key);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const primary =
      await fetchFirstSuccessful(
        createOverpassQuery(
          selection,
        ),
      );

    const hasRoad =
      (primary.elements ?? []).some(
        (element) =>
          element.type === "way" &&
          Boolean(
            element.tags?.highway,
          ),
      );

    const result = hasRoad
      ? primary
      : mergeResponses(
          primary,
          await fetchFirstSuccessful(
            createOverpassQuery(
              selection,
              42,
              true,
            ),
          ),
        );

    writeCache(key, result);
    return result;
  })();

  inFlightRequests.set(key, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(key);
  }
}

function calculateConfidence(
  roads: RealSceneRoadGeometry[],
  paths: RealScenePathGeometry[],
  buildings: RealSceneBuildingGeometry[],
  landCover: RealSceneLandCoverGeometry[],
  vegetation: RealSceneVegetationGeometry[],
): number {
  const roadPointCount =
    roads.reduce(
      (total, road) =>
        total +
        road.localPoints.length,
      0,
    );

  const coverage = Math.min(
    1,
    roadPointCount / 35,
  );

  const featureScore = Math.min(
    1,
    (roads.length +
      paths.length +
      buildings.length +
      landCover.length +
      vegetation.length / 10) /
      18,
  );

  return Number(
    clamp(
      0.35 +
        coverage * 0.47 +
        featureScore * 0.18,
      0.35,
      0.99,
    ).toFixed(2),
  );
}

export const RealSceneExtractionService = {
  async extract(
    selection: RealSceneAreaSelection,
    snapshot?: RealSceneSnapshotReference,
  ): Promise<RealSceneExtractionResult> {
    const projection =
      createProjection(selection);

    if (
      projection.widthMetres < 8 ||
      projection.heightMetres < 8
    ) {
      throw new Error(
        "The selected scene is too small. Draw an area at least 8 metres wide and high.",
      );
    }

    if (
      projection.widthMetres >
        1_200 ||
      projection.heightMetres >
        1_200
    ) {
      throw new Error(
        "The selected scene is too large. Keep each side below 1.2 kilometres for an accurate reconstruction.",
      );
    }

    const response =
      await fetchSceneData(
        selection,
      );

    const roads: RealSceneRoadGeometry[] =
      [];
    const paths: RealScenePathGeometry[] =
      [];
    const buildings: RealSceneBuildingGeometry[] =
      [];
    const barriers: RealSceneBarrierGeometry[] =
      [];
    const landCover: RealSceneLandCoverGeometry[] =
      [];
    const vegetation: RealSceneVegetationGeometry[] =
      [];

    for (const element of
      response.elements ?? []) {
      const tags = element.tags ?? {};

      if (
        element.type === "node"
      ) {
        if (
          tags.natural === "tree" ||
          tags.natural === "shrub"
        ) {
          const mapped =
            buildMappedVegetation(
              element,
              projection,
            );

          if (mapped) {
            vegetation.push(mapped);
          }
        }

        continue;
      }

      if (
        element.type !== "way" ||
        !element.geometry?.length
      ) {
        continue;
      }

      if (tags.highway) {
        const parsed =
          buildRoadsAndPaths(
            element,
            projection,
          );

        roads.push(...parsed.roads);
        paths.push(...parsed.paths);
        continue;
      }

      if (tags.building) {
        const building =
          buildBuilding(
            element,
            projection,
          );

        if (building) {
          buildings.push(building);
        }

        continue;
      }

      if (tags.barrier) {
        barriers.push(
          ...buildBarrier(
            element,
            projection,
          ),
        );

        if (
          tags.barrier !== "hedge"
        ) {
          continue;
        }
      }

      const cover =
        buildLandCover(
          element,
          projection,
        );

      if (cover) {
        landCover.push(cover);
      }
    }

    const maximumVegetation = 300;

    for (const cover of landCover) {
      const remaining =
        maximumVegetation -
        vegetation.length;

      if (remaining <= 0) break;

      vegetation.push(
        ...generateVegetationFromCover(
          cover,
          projection,
          remaining,
        ),
      );
    }

    const warnings: string[] = [];

    if (roads.length === 0) {
      warnings.push(
        "No mapped vehicle-road centreline intersects the selected boundary. The exact selected area is preserved for manual road correction.",
      );
    }

    if (buildings.length === 0) {
      warnings.push(
        "No mapped building footprints intersect the selected boundary. Buildings visible in imagery may require manual placement.",
      );
    }

    if (
      landCover.length === 0
    ) {
      warnings.push(
        "No mapped land-cover polygon intersects the selected boundary. Satellite imagery remains available for officer review.",
      );
    }

    if (!snapshot) {
      warnings.push(
        "The map snapshot was not attached yet. Geographic bounds and vector geometry remain precise.",
      );
    }

    const geometry: RealSceneGeometry = {
      version:
        "RoadSafe Real Scene V2",
      status: "ready",
      selection,
      snapshot,
      origin: {
        latitude:
          selection.bounds.south,
        longitude:
          selection.bounds.west,
      },
      sceneWidthMetres: Number(
        projection.widthMetres.toFixed(
          3,
        ),
      ),
      sceneHeightMetres: Number(
        projection.heightMetres.toFixed(
          3,
        ),
      ),
      roads,
      paths,
      buildings,
      barriers,
      landCover,
      vegetation,
      confidence:
        calculateConfidence(
          roads,
          paths,
          buildings,
          landCover,
          vegetation,
        ),
      warnings,
      attribution:
        "Map geometry © OpenStreetMap contributors",
      extractedAt:
        new Date().toISOString(),
    };

    return {
      geometry,
      warnings,
    };
  },

  /**
   * Seed the exact source response already acquired and archived by the
   * forensic pipeline. This prevents a second Overpass request during
   * normalisation and guarantees that archived evidence and rendered geometry
   * come from the same payload.
   */
  seedResponse(
    selection: RealSceneAreaSelection,
    response: OverpassResponse,
  ): void {
    writeCache(
      cacheKey(
        selection,
      ),
      response,
    );
  },

  clearCache(): void {
    memoryCache.clear();

    try {
      sessionStorage.removeItem(
        RESPONSE_CACHE_KEY,
      );
    } catch {
      // Ignore storage cleanup failures.
    }
  },
};
