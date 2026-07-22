import type {
  ReconstructionPosition,
  RoadLayoutType,
  RoadSceneSettings,
  TrafficControlType,
} from "../types/reconstruction";

import { createDefaultRoadSceneSettings } from "../types/reconstruction";

import type {
  DetectedRoadFeature,
  DetectedRoadPoint,
  DetectedRoadSegment,
  RoadAddressResult,
  RoadDetectionCoordinate,
  RoadDetectionResult,
  RoadLayoutDetection,
  RoadLayoutManualSelection,
} from "../types/roadLayoutDetection";

const DEFAULT_RADIUS_METRES = 80;
const NOMINATIM_REVERSE_URL =
  import.meta.env.VITE_NOMINATIM_REVERSE_URL ??
  "https://nominatim.openstreetmap.org/reverse";

const OVERPASS_ENDPOINTS = [
  import.meta.env.VITE_OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter((value): value is string => Boolean(value));

const ROAD_QUERY_CACHE_KEY = "roadsafe-road-layout-query-cache-v1";
const CACHE_MAX_AGE_MS = 15 * 60 * 1000;

interface NominatimReverseResponse {
  display_name?: string;
  address?: Record<string, string | undefined>;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
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

interface CachedRoadDetection {
  storedAt: number;
  result: RoadDetectionResult;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normaliseAngle(angle: number): number {
  let value = angle % 360;
  if (value > 180) value -= 360;
  if (value < -180) value += 360;
  return value;
}

function angularDifference(left: number, right: number): number {
  return Math.abs(normaliseAngle(left - right));
}

function toLocalMetres(
  point: DetectedRoadPoint,
  origin: Pick<RoadDetectionCoordinate, "latitude" | "longitude">,
): LocalPoint {
  const latitudeRadians = (origin.latitude * Math.PI) / 180;
  const metresPerLongitudeDegree = 111_320 * Math.cos(latitudeRadians);
  const metresPerLatitudeDegree = 110_540;

  return {
    x: (point.longitude - origin.longitude) * metresPerLongitudeDegree,
    y: (point.latitude - origin.latitude) * metresPerLatitudeDegree,
  };
}

function toScenePosition(
  point: DetectedRoadPoint,
  origin: Pick<RoadDetectionCoordinate, "latitude" | "longitude">,
  radiusMetres: number,
): ReconstructionPosition {
  const local = toLocalMetres(point, origin);
  const scale = 45 / Math.max(10, radiusMetres);

  return {
    x: clamp(50 + local.x * scale, 2, 98),
    y: clamp(50 - local.y * scale, 2, 98),
  };
}

function distanceFromPointToSegment(
  point: LocalPoint,
  start: LocalPoint,
  end: LocalPoint,
): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const squaredLength = deltaX * deltaX + deltaY * deltaY;

  if (squaredLength === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const position = clamp(
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
      squaredLength,
    0,
    1,
  );

  const projected = {
    x: start.x + position * deltaX,
    y: start.y + position * deltaY,
  };

  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function distanceFromRoadMetres(
  points: DetectedRoadPoint[],
  origin: RoadDetectionCoordinate,
): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;

  const localPoints = points.map((point) => toLocalMetres(point, origin));
  const officer = { x: 0, y: 0 };

  if (localPoints.length === 1) {
    return Math.hypot(localPoints[0].x, localPoints[0].y);
  }

  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 1; index < localPoints.length; index += 1) {
    minimum = Math.min(
      minimum,
      distanceFromPointToSegment(
        officer,
        localPoints[index - 1],
        localPoints[index],
      ),
    );
  }

  return minimum;
}

function parseInteger(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value.split(/[;|]/)[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMaximumSpeed(value?: string): number | undefined {
  if (!value) return undefined;

  const matched = value.match(/\d+/);
  if (!matched) return undefined;

  const parsed = Number(matched[0]);
  if (!Number.isFinite(parsed)) return undefined;

  return /mph/i.test(value) ? Math.round(parsed * 1.60934) : parsed;
}

function parseOneWay(value?: string): boolean | undefined {
  if (!value) return undefined;
  if (["yes", "1", "true", "-1"].includes(value.toLowerCase())) return true;
  if (["no", "0", "false"].includes(value.toLowerCase())) return false;
  return undefined;
}

function isSignificantRoad(highwayType: string): boolean {
  return ![
    "footway",
    "path",
    "steps",
    "cycleway",
    "bridleway",
    "pedestrian",
    "corridor",
    "platform",
    "construction",
    "proposed",
  ].includes(highwayType);
}

function getBearingDegrees(start: LocalPoint, end: LocalPoint): number {
  const east = end.x - start.x;
  const north = end.y - start.y;

  return (Math.atan2(east, north) * 180) / Math.PI;
}

function getDirectionBearings(
  road: DetectedRoadSegment,
  centre: RoadDetectionCoordinate,
): number[] {
  if (road.points.length < 2) return [];

  const points = road.points.map((point) => toLocalMetres(point, centre));
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const distance = Math.hypot(point.x, point.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  const directions: number[] = [];
  const centrePoint = points[nearestIndex];

  for (let index = nearestIndex - 1; index >= 0; index -= 1) {
    if (Math.hypot(points[index].x - centrePoint.x, points[index].y - centrePoint.y) >= 7) {
      directions.push(getBearingDegrees(centrePoint, points[index]));
      break;
    }
  }

  for (let index = nearestIndex + 1; index < points.length; index += 1) {
    if (Math.hypot(points[index].x - centrePoint.x, points[index].y - centrePoint.y) >= 7) {
      directions.push(getBearingDegrees(centrePoint, points[index]));
      break;
    }
  }

  if (directions.length === 0 && points.length >= 2) {
    directions.push(getBearingDegrees(points[0], points[points.length - 1]));
  }

  return directions;
}

function deduplicateBearings(bearings: number[]): number[] {
  const result: number[] = [];

  bearings.forEach((bearing) => {
    if (!result.some((existing) => angularDifference(existing, bearing) < 28)) {
      result.push(bearing);
    }
  });

  return result;
}

function selectLayout(
  roads: DetectedRoadSegment[],
  features: DetectedRoadFeature[],
  coordinate: RoadDetectionCoordinate,
): {
  layout: RoadLayoutType;
  branchCount: number;
  confidence: number;
  dominantBearing: number;
} {
  const nearbyRoads = roads.filter(
    (road) =>
      road.distanceFromOfficerMetres <= 28 &&
      isSignificantRoad(road.highwayType),
  );

  const roundabout = roads.find(
    (road) =>
      road.isRoundabout && road.distanceFromOfficerMetres <= 55,
  );

  const busFeatureCount = features.filter((feature) =>
    ["Bus Stop", "Bus Station"].includes(feature.type),
  ).length;

  const serviceRoadCount = nearbyRoads.filter(
    (road) => road.highwayType === "service",
  ).length;

  const bearings = deduplicateBearings(
    nearbyRoads.flatMap((road) => getDirectionBearings(road, coordinate)),
  );

  const primaryRoad = [...roads]
    .filter((road) => isSignificantRoad(road.highwayType))
    .sort(
      (left, right) =>
        left.distanceFromOfficerMetres - right.distanceFromOfficerMetres,
    )[0];

  const primaryBearings = primaryRoad
    ? getDirectionBearings(primaryRoad, coordinate)
    : [];
  const dominantBearing = primaryBearings[0] ?? bearings[0] ?? 90;

  if (roundabout) {
    return {
      layout: "Roundabout",
      branchCount: Math.max(3, bearings.length),
      confidence: 0.96,
      dominantBearing,
    };
  }

  if (busFeatureCount > 0 && (serviceRoadCount >= 2 || nearbyRoads.length >= 4)) {
    return {
      layout: "Transport Terminus",
      branchCount: bearings.length,
      confidence: 0.78,
      dominantBearing,
    };
  }

  if (bearings.length >= 4) {
    return {
      layout: "Four-way Intersection",
      branchCount: bearings.length,
      confidence: bearings.length === 4 ? 0.86 : 0.73,
      dominantBearing,
    };
  }

  if (bearings.length === 3) {
    return {
      layout: "T-Junction",
      branchCount: 3,
      confidence: 0.84,
      dominantBearing,
    };
  }

  const crossingCount = features.filter(
    (feature) => feature.type === "Pedestrian Crossing",
  ).length;

  if (crossingCount > 0 && bearings.length <= 2) {
    return {
      layout: "Pedestrian Crossing",
      branchCount: Math.max(2, bearings.length),
      confidence: 0.82,
      dominantBearing,
    };
  }

  return {
    layout: "Straight Road",
    branchCount: Math.max(1, bearings.length),
    confidence:
      primaryRoad && primaryRoad.distanceFromOfficerMetres <= 15 ? 0.76 : 0.58,
    dominantBearing,
  };
}

function getMode(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const counts = new Map<number, number>();

  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function getTrafficControl(features: DetectedRoadFeature[]): TrafficControlType {
  if (features.some((feature) => feature.type === "Traffic Signal")) {
    return "Traffic Lights";
  }

  if (features.some((feature) => feature.type === "Stop Sign")) {
    return "Stop Signs";
  }

  if (features.some((feature) => feature.type === "Give Way Sign")) {
    return "Give Way Signs";
  }

  return "None";
}

function buildSceneSettings(
  layout: RoadLayoutType,
  roads: DetectedRoadSegment[],
  features: DetectedRoadFeature[],
  dominantBearing: number,
): RoadSceneSettings {
  const nearestRoads = [...roads]
    .filter((road) => isSignificantRoad(road.highwayType))
    .sort(
      (left, right) =>
        left.distanceFromOfficerMetres - right.distanceFromOfficerMetres,
    )
    .slice(0, 4);

  const laneCount = clamp(
    getMode(
      nearestRoads
        .map((road) => road.laneCount)
        .filter((value): value is number => Boolean(value)),
      2,
    ),
    1,
    6,
  );

  const speedLimitKmh = clamp(
    nearestRoads.find((road) => road.maximumSpeedKmh)?.maximumSpeedKmh ?? 60,
    10,
    160,
  );

  const defaultSettings = createDefaultRoadSceneSettings();

  return {
    ...defaultSettings,
    roadLayout: layout,
    laneCount,
    roadRotation: Math.round(normaliseAngle(dominantBearing - 90)),
    drivingSide: "Left",
    trafficControl: getTrafficControl(features),
    speedLimitKmh,
    showPedestrianCrossing: features.some(
      (feature) => feature.type === "Pedestrian Crossing",
    ),
  };
}

function getConfidenceLabel(confidence: number): RoadLayoutDetection["confidenceLabel"] {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Moderate";
  return "Low";
}

function emptyAddress(): RoadAddressResult {
  return {
    displayName: "Location detected from device",
    roadName: "",
    suburb: "",
    city: "",
    state: "",
    country: "",
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMilliseconds: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMilliseconds);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function reverseGeocode(
  coordinate: RoadDetectionCoordinate,
): Promise<RoadAddressResult> {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coordinate.latitude));
  url.searchParams.set("lon", String(coordinate.longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const contactEmail = import.meta.env.VITE_NOMINATIM_EMAIL;
  if (contactEmail) url.searchParams.set("email", contactEmail);

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
      },
    },
    15_000,
  );

  if (!response.ok) {
    throw new Error(`Address lookup failed with status ${response.status}.`);
  }

  const result = (await response.json()) as NominatimReverseResponse;
  const address = result.address ?? {};

  return {
    displayName: result.display_name ?? "Location detected from device",
    roadName:
      address.road ??
      address.pedestrian ??
      address.residential ??
      address.neighbourhood ??
      "",
    suburb:
      address.suburb ?? address.neighbourhood ?? address.quarter ?? "",
    city:
      address.city ?? address.town ?? address.village ?? address.municipality ?? "",
    state: address.state ?? address.region ?? "",
    country: address.country ?? "",
  };
}

function buildOverpassQuery(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): string {
  const latitude = coordinate.latitude.toFixed(7);
  const longitude = coordinate.longitude.toFixed(7);
  const featureRadius = Math.max(radiusMetres, 100);

  return `
[out:json][timeout:20];
(
  way(around:${radiusMetres},${latitude},${longitude})["highway"]["area"!="yes"];
  node(around:${radiusMetres},${latitude},${longitude})["highway"="traffic_signals"];
  node(around:${radiusMetres},${latitude},${longitude})["highway"="crossing"];
  node(around:${radiusMetres},${latitude},${longitude})["highway"="stop"];
  node(around:${radiusMetres},${latitude},${longitude})["highway"="give_way"];
  node(around:${featureRadius},${latitude},${longitude})["highway"="bus_stop"];
  node(around:${featureRadius},${latitude},${longitude})["amenity"="bus_station"];
  node(around:${featureRadius},${latitude},${longitude})["public_transport"="station"];
);
out tags geom;
`;
}

async function queryOverpass(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): Promise<OverpassResponse> {
  const query = buildOverpassQuery(coordinate, radiusMetres);
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({ data: query }).toString(),
        },
        25_000,
      );

      if (!response.ok) {
        throw new Error(`Road query failed with status ${response.status}.`);
      }

      return (await response.json()) as OverpassResponse;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured road-data services failed.");
}

function parseRoads(
  response: OverpassResponse,
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): DetectedRoadSegment[] {
  return (response.elements ?? [])
    .filter(
      (element): element is OverpassElement & { geometry: Array<{ lat: number; lon: number }> } =>
        element.type === "way" &&
        Array.isArray(element.geometry) &&
        element.geometry.length >= 2 &&
        Boolean(element.tags?.highway),
    )
    .map((element) => {
      const points = element.geometry.map((point) => ({
        latitude: point.lat,
        longitude: point.lon,
      }));
      const tags = element.tags ?? {};
      const junction = tags.junction;

      return {
        id: `way-${element.id}`,
        osmId: element.id,
        name: tags.name ?? tags.ref ?? "Unnamed road",
        highwayType: tags.highway ?? "road",
        laneCount: parseInteger(tags.lanes),
        oneWay: parseOneWay(tags.oneway),
        surface: tags.surface,
        maximumSpeedKmh: parseMaximumSpeed(tags.maxspeed),
        junction,
        isRoundabout: junction === "roundabout" || junction === "circular",
        distanceFromOfficerMetres: Number(
          distanceFromRoadMetres(points, coordinate).toFixed(2),
        ),
        points,
        scenePoints: points.map((point) =>
          toScenePosition(point, coordinate, radiusMetres),
        ),
      } satisfies DetectedRoadSegment;
    })
    .filter((road) => road.distanceFromOfficerMetres <= radiusMetres + 25)
    .sort(
      (left, right) =>
        left.distanceFromOfficerMetres - right.distanceFromOfficerMetres,
    );
}

function getFeatureType(
  element: OverpassElement,
): DetectedRoadFeature["type"] | null {
  const tags = element.tags ?? {};

  if (tags.highway === "traffic_signals") return "Traffic Signal";
  if (tags.highway === "crossing") return "Pedestrian Crossing";
  if (tags.highway === "stop") return "Stop Sign";
  if (tags.highway === "give_way") return "Give Way Sign";
  if (tags.highway === "bus_stop") return "Bus Stop";
  if (tags.amenity === "bus_station" || tags.public_transport === "station") {
    return "Bus Station";
  }

  return null;
}

function parseFeatures(
  response: OverpassResponse,
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): DetectedRoadFeature[] {
  return (response.elements ?? [])
    .filter(
      (element): element is OverpassElement & { lat: number; lon: number } =>
        element.type === "node" &&
        Number.isFinite(element.lat) &&
        Number.isFinite(element.lon),
    )
    .flatMap((element) => {
      const type = getFeatureType(element);
      if (!type) return [];

      const point = {
        latitude: element.lat,
        longitude: element.lon,
      };

      return [
        {
          id: `node-${element.id}`,
          type,
          latitude: element.lat,
          longitude: element.lon,
          scenePosition: toScenePosition(point, coordinate, radiusMetres),
          name: element.tags?.name,
        } satisfies DetectedRoadFeature,
      ];
    });
}

function createManualDetection(
  coordinate: RoadDetectionCoordinate,
  selection: RoadLayoutManualSelection,
  address: RoadAddressResult = emptyAddress(),
  reason?: string,
): RoadLayoutDetection {
  const settings: RoadSceneSettings = {
    ...createDefaultRoadSceneSettings(),
    roadLayout: selection.roadLayout,
    laneCount: clamp(selection.laneCount, 1, 6),
    roadRotation: normaliseAngle(selection.roadRotation),
    drivingSide: selection.drivingSide,
    trafficControl: selection.trafficControl,
    speedLimitKmh: clamp(selection.speedLimitKmh, 10, 160),
    showPedestrianCrossing: selection.showPedestrianCrossing,
  };

  return {
    id: createId("road-layout"),
    source: "Manual",
    coordinate,
    address,
    detectedLayout: selection.roadLayout,
    confidence: 1,
    confidenceLabel: "Manual",
    radiusMetres: DEFAULT_RADIUS_METRES,
    roadNames: address.roadName ? [address.roadName] : [],
    branchCount: 0,
    roads: [],
    features: [],
    junctionCentre: { x: 50, y: 50 },
    suggestedSceneSettings: settings,
    fetchedAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    manuallyCorrected: true,
    failureReason: reason,
    attribution: "Manual road-layout selection by the investigating officer.",
  };
}

function cacheKey(coordinate: RoadDetectionCoordinate, radiusMetres: number): string {
  return [
    coordinate.latitude.toFixed(5),
    coordinate.longitude.toFixed(5),
    radiusMetres,
  ].join(":");
}

function readCachedResult(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): RoadDetectionResult | null {
  try {
    const stored = sessionStorage.getItem(ROAD_QUERY_CACHE_KEY);
    if (!stored) return null;

    const cache = JSON.parse(stored) as Record<string, CachedRoadDetection>;
    const entry = cache[cacheKey(coordinate, radiusMetres)];

    if (!entry || Date.now() - entry.storedAt > CACHE_MAX_AGE_MS) {
      return null;
    }

    return entry.result;
  } catch {
    return null;
  }
}

function writeCachedResult(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
  result: RoadDetectionResult,
): void {
  try {
    const stored = sessionStorage.getItem(ROAD_QUERY_CACHE_KEY);
    const cache = stored
      ? (JSON.parse(stored) as Record<string, CachedRoadDetection>)
      : {};

    cache[cacheKey(coordinate, radiusMetres)] = {
      storedAt: Date.now(),
      result,
    };

    sessionStorage.setItem(ROAD_QUERY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache failures must never block case creation.
  }
}

export const RoadLayoutDetectionService = {
  async detectAtCoordinate(
    coordinate: RoadDetectionCoordinate,
    radiusMetres = DEFAULT_RADIUS_METRES,
    forceRefresh = false,
  ): Promise<RoadDetectionResult> {
    if (!forceRefresh) {
      const cached = readCachedResult(coordinate, radiusMetres);
      if (cached) return cached;
    }

    const warnings: string[] = [];
    const [addressResult, roadResult] = await Promise.allSettled([
      reverseGeocode(coordinate),
      queryOverpass(coordinate, radiusMetres),
    ]);

    const address =
      addressResult.status === "fulfilled" ? addressResult.value : emptyAddress();

    if (addressResult.status === "rejected") {
      warnings.push(
        addressResult.reason instanceof Error
          ? addressResult.reason.message
          : "The nearby address could not be determined.",
      );
    }

    if (roadResult.status === "rejected") {
      const reason =
        roadResult.reason instanceof Error
          ? roadResult.reason.message
          : "Nearby road geometry could not be downloaded.";
      warnings.push(reason);

      const fallback = createManualDetection(
        coordinate,
        {
          roadLayout: "Four-way Intersection",
          laneCount: 2,
          roadRotation: 0,
          drivingSide: "Left",
          trafficControl: "None",
          speedLimitKmh: 60,
          showPedestrianCrossing: false,
        },
        address,
        reason,
      );

      const result = {
        detection: {
          ...fallback,
          confirmedAt: undefined,
        },
        reverseGeocodingSucceeded: addressResult.status === "fulfilled",
        roadQuerySucceeded: false,
        warnings,
      } satisfies RoadDetectionResult;

      writeCachedResult(coordinate, radiusMetres, result);
      return result;
    }

    const roads = parseRoads(roadResult.value, coordinate, radiusMetres);
    const features = parseFeatures(roadResult.value, coordinate, radiusMetres);

    if (roads.length === 0) {
      warnings.push(
        "OpenStreetMap returned no usable roads near the selected location.",
      );
    }

    const selection = selectLayout(roads, features, coordinate);
    let confidence = selection.confidence;
    const nearestRoadDistance = roads[0]?.distanceFromOfficerMetres;

    if (nearestRoadDistance !== undefined && nearestRoadDistance > 30) {
      confidence -= 0.2;
      warnings.push(
        `The selected position is approximately ${nearestRoadDistance.toFixed(
          0,
        )} m from the nearest mapped road. Adjust the map pin when necessary.`,
      );
    }

    if (roads.length === 0) confidence = 0.15;
    confidence = clamp(confidence, 0.05, 0.99);

    const sceneSettings = buildSceneSettings(
      selection.layout,
      roads,
      features,
      selection.dominantBearing,
    );

    const roadNames = Array.from(
      new Set(
        roads
          .map((road) => road.name)
          .filter((name) => name && name !== "Unnamed road"),
      ),
    );

    const detection: RoadLayoutDetection = {
      id: createId("road-layout"),
      source: roads.length > 0 ? "OpenStreetMap" : "Manual",
      coordinate,
      address,
      detectedLayout: selection.layout,
      confidence,
      confidenceLabel: getConfidenceLabel(confidence),
      radiusMetres,
      roadNames,
      branchCount: selection.branchCount,
      roads,
      features,
      junctionCentre: { x: 50, y: 50 },
      suggestedSceneSettings: sceneSettings,
      fetchedAt: new Date().toISOString(),
      manuallyCorrected: false,
      failureReason:
        roads.length === 0
          ? "No usable OpenStreetMap road geometry was returned."
          : undefined,
      attribution: "Road and address data © OpenStreetMap contributors.",
    };

    const result = {
      detection,
      reverseGeocodingSucceeded: addressResult.status === "fulfilled",
      roadQuerySucceeded: roads.length > 0,
      warnings,
    } satisfies RoadDetectionResult;

    writeCachedResult(coordinate, radiusMetres, result);
    return result;
  },

  createManualDetection,

  applyOfficerCorrections(
    detection: RoadLayoutDetection,
    settings: RoadSceneSettings,
    confirmedBy: string,
  ): RoadLayoutDetection {
    const layoutChanged = settings.roadLayout !== detection.detectedLayout;

    return {
      ...detection,
      originalDetectedLayout:
        layoutChanged && !detection.originalDetectedLayout
          ? detection.detectedLayout
          : detection.originalDetectedLayout,
      detectedLayout: settings.roadLayout,
      suggestedSceneSettings: settings,
      manuallyCorrected:
        detection.manuallyCorrected ||
        layoutChanged ||
        JSON.stringify(settings) !== JSON.stringify(detection.suggestedSceneSettings),
      confirmedAt: new Date().toISOString(),
      confirmedBy,
    };
  },

  normalise(detection: RoadLayoutDetection): RoadLayoutDetection {
    const coordinate = {
      latitude: Number(detection.coordinate?.latitude ?? 0),
      longitude: Number(detection.coordinate?.longitude ?? 0),
      accuracyMetres: Math.max(
        0,
        Number(detection.coordinate?.accuracyMetres ?? 0),
      ),
      capturedAt:
        detection.coordinate?.capturedAt ?? new Date().toISOString(),
    };

    const settings = {
      ...createDefaultRoadSceneSettings(),
      ...(detection.suggestedSceneSettings ?? {}),
    };

    return {
      ...detection,
      id: detection.id || createId("road-layout"),
      source: detection.source ?? "Manual",
      coordinate,
      address: detection.address ?? emptyAddress(),
      detectedLayout: detection.detectedLayout ?? settings.roadLayout,
      confidence: clamp(Number(detection.confidence ?? 0), 0, 1),
      confidenceLabel:
        detection.confidenceLabel ?? getConfidenceLabel(detection.confidence ?? 0),
      radiusMetres: Math.max(20, Number(detection.radiusMetres ?? 80)),
      roadNames: Array.isArray(detection.roadNames) ? detection.roadNames : [],
      branchCount: Math.max(0, Number(detection.branchCount ?? 0)),
      roads: Array.isArray(detection.roads) ? detection.roads : [],
      features: Array.isArray(detection.features) ? detection.features : [],
      junctionCentre: detection.junctionCentre ?? { x: 50, y: 50 },
      suggestedSceneSettings: settings,
      fetchedAt: detection.fetchedAt || new Date().toISOString(),
      manuallyCorrected: detection.manuallyCorrected ?? false,
      attribution:
        detection.attribution ||
        (detection.source === "OpenStreetMap"
          ? "Road and address data © OpenStreetMap contributors."
          : "Manual road-layout selection by the investigating officer."),
    };
  },
};
