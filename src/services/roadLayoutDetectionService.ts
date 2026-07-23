import { loadGoogleMaps } from "./googleMapsLoader";
import type { GoogleGeocoderResult } from "./googleMapsLoader";
import type {
  DetectedRoadFeature,
  DetectedRoadSegment,
  RoadAddressResult,
  RoadDetectionCoordinate,
  RoadDetectionResult,
  RoadLayoutDetection,
  RoadLayoutManualSelection,
} from "../types/roadLayoutDetection";
import type {
  ReconstructionPosition,
  RoadLayoutType,
  RoadSceneSettings,
} from "../types/reconstruction";
import { createDefaultRoadSceneSettings } from "../types/reconstruction";

const DEFAULT_RADIUS_METRES = 80;
const CACHE_KEY = "roadsafe-google-road-context-cache-v1";
const CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const GOOGLE_ROADS_PROXY_URL = String(
  import.meta.env.VITE_GOOGLE_ROADS_PROXY_URL ?? "",
).trim();

interface CachedRoadDetection {
  storedAt: number;
  result: RoadDetectionResult;
}

interface GoogleRoadProxyResponse {
  detection?: Partial<RoadLayoutDetection>;
  warnings?: string[];
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

function getConfidenceLabel(
  confidence: number,
): RoadLayoutDetection["confidenceLabel"] {
  if (confidence >= 0.78) return "High";
  if (confidence >= 0.48) return "Moderate";
  return "Low";
}

function emptyAddress(): RoadAddressResult {
  return {
    displayName: "Location selected on Google Maps",
    roadName: "",
    suburb: "",
    city: "",
    state: "",
    country: "",
  };
}

function component(
  result: GoogleGeocoderResult,
  ...types: string[]
): string {
  const item = result.address_components?.find((candidate) =>
    types.some((type) => candidate.types.includes(type)),
  );
  return item?.long_name ?? "";
}

function addressFromGeocoder(result?: GoogleGeocoderResult): RoadAddressResult {
  if (!result) return emptyAddress();
  return {
    displayName: result.formatted_address ?? "Location selected on Google Maps",
    roadName: component(result, "route"),
    suburb: component(
      result,
      "sublocality",
      "sublocality_level_1",
      "neighborhood",
    ),
    city: component(result, "locality", "postal_town", "administrative_area_level_2"),
    state: component(result, "administrative_area_level_1"),
    country: component(result, "country"),
  };
}

async function reverseGeocode(
  coordinate: RoadDetectionCoordinate,
): Promise<{ address: RoadAddressResult; result?: GoogleGeocoderResult }> {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({
    location: { lat: coordinate.latitude, lng: coordinate.longitude },
  });
  const result = response.results[0];
  return { address: addressFromGeocoder(result), result };
}

function inferLayout(result?: GoogleGeocoderResult): {
  layout: RoadLayoutType;
  confidence: number;
  branchCount: number;
} {
  const types = result?.types ?? [];
  if (types.includes("intersection")) {
    return {
      layout: "Four-way Intersection",
      confidence: 0.5,
      branchCount: 4,
    };
  }
  if (
    types.includes("route") ||
    types.includes("street_address") ||
    types.includes("premise")
  ) {
    return {
      layout: "Straight Road",
      confidence: 0.38,
      branchCount: 2,
    };
  }
  return {
    layout: "Straight Road",
    confidence: 0.18,
    branchCount: 0,
  };
}

function buildSettings(
  layout: RoadLayoutType,
  address: RoadAddressResult,
): RoadSceneSettings {
  return {
    ...createDefaultRoadSceneSettings(),
    roadLayout: layout,
    laneCount: 2,
    roadRotation: 0,
    trafficControl: "None",
    showPedestrianCrossing: layout === "Pedestrian Crossing",
    speedLimitKmh: address.roadName ? 60 : 50,
  };
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
    attribution: "Officer-confirmed road layout displayed on Google Maps.",
  };
}

function cacheKey(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): string {
  return [
    coordinate.latitude.toFixed(5),
    coordinate.longitude.toFixed(5),
    radiusMetres,
  ].join(":");
}

function readCache(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): RoadDetectionResult | null {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const cache = JSON.parse(stored) as Record<string, CachedRoadDetection>;
    const entry = cache[cacheKey(coordinate, radiusMetres)];
    if (!entry || Date.now() - entry.storedAt > CACHE_MAX_AGE_MS) return null;
    return entry.result;
  } catch {
    return null;
  }
}

function writeCache(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
  result: RoadDetectionResult,
): void {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    const cache = stored
      ? (JSON.parse(stored) as Record<string, CachedRoadDetection>)
      : {};
    cache[cacheKey(coordinate, radiusMetres)] = {
      storedAt: Date.now(),
      result,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Session storage is an optimisation only.
  }
}

async function queryGoogleRoadsProxy(
  coordinate: RoadDetectionCoordinate,
  radiusMetres: number,
): Promise<GoogleRoadProxyResponse | null> {
  if (!GOOGLE_ROADS_PROXY_URL) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(GOOGLE_ROADS_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "road-context",
        coordinate,
        radiusMetres,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Google Roads proxy returned ${response.status}.`);
    }
    return (await response.json()) as GoogleRoadProxyResponse;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalisePosition(position?: ReconstructionPosition): ReconstructionPosition {
  return {
    x: clamp(Number(position?.x ?? 50), -1000, 1000),
    y: clamp(Number(position?.y ?? 50), -1000, 1000),
  };
}

function normaliseRoad(
  road: Partial<DetectedRoadSegment>,
  index: number,
): DetectedRoadSegment {
  return {
    id: road.id || createId("google-road"),
    providerId: String(road.providerId ?? road.id ?? `google-road-${index}`),
    name: road.name || "Mapped road",
    highwayType: road.highwayType || "road",
    laneCount:
      typeof road.laneCount === "number"
        ? clamp(Math.round(road.laneCount), 1, 12)
        : undefined,
    oneWay: road.oneWay,
    surface: road.surface,
    maximumSpeedKmh:
      typeof road.maximumSpeedKmh === "number"
        ? clamp(Math.round(road.maximumSpeedKmh), 1, 200)
        : undefined,
    junction: road.junction,
    isRoundabout: Boolean(road.isRoundabout),
    distanceFromOfficerMetres: Math.max(
      0,
      Number(road.distanceFromOfficerMetres ?? 0),
    ),
    points: Array.isArray(road.points)
      ? road.points.map((point) => ({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
        }))
      : [],
    scenePoints: Array.isArray(road.scenePoints)
      ? road.scenePoints.map(normalisePosition)
      : [],
  };
}

function normaliseFeature(
  feature: Partial<DetectedRoadFeature>,
  index: number,
): DetectedRoadFeature {
  return {
    id: feature.id || createId(`google-feature-${index}`),
    type: feature.type ?? "Traffic Signal",
    latitude: Number(feature.latitude ?? 0),
    longitude: Number(feature.longitude ?? 0),
    scenePosition: normalisePosition(feature.scenePosition),
    name: feature.name,
  };
}

function normaliseDetection(
  detection: Partial<RoadLayoutDetection>,
  fallbackCoordinate?: RoadDetectionCoordinate,
): RoadLayoutDetection {
  const coordinate: RoadDetectionCoordinate = {
    latitude: Number(
      detection.coordinate?.latitude ?? fallbackCoordinate?.latitude ?? 0,
    ),
    longitude: Number(
      detection.coordinate?.longitude ?? fallbackCoordinate?.longitude ?? 0,
    ),
    accuracyMetres: Math.max(
      0,
      Number(
        detection.coordinate?.accuracyMetres ??
          fallbackCoordinate?.accuracyMetres ??
          0,
      ),
    ),
    capturedAt:
      detection.coordinate?.capturedAt ??
      fallbackCoordinate?.capturedAt ??
      new Date().toISOString(),
  };
  const settings: RoadSceneSettings = {
    ...createDefaultRoadSceneSettings(),
    ...(detection.suggestedSceneSettings ?? {}),
  };
  const roads = Array.isArray(detection.roads)
    ? detection.roads.map(normaliseRoad)
    : [];
  const features = Array.isArray(detection.features)
    ? detection.features.map(normaliseFeature)
    : [];

  return {
    id: detection.id || createId("road-layout"),
    source: detection.source === "Manual" ? "Manual" : "Google Maps",
    coordinate,
    address: detection.address ?? emptyAddress(),
    detectedLayout: detection.detectedLayout ?? settings.roadLayout,
    originalDetectedLayout: detection.originalDetectedLayout,
    confidence: clamp(Number(detection.confidence ?? 0), 0, 1),
    confidenceLabel:
      detection.confidenceLabel ?? getConfidenceLabel(detection.confidence ?? 0),
    radiusMetres: Math.max(20, Number(detection.radiusMetres ?? 80)),
    roadNames: Array.isArray(detection.roadNames) ? detection.roadNames : [],
    branchCount: Math.max(0, Number(detection.branchCount ?? 0)),
    roads,
    features,
    junctionCentre: normalisePosition(detection.junctionCentre),
    suggestedSceneSettings: settings,
    fetchedAt: detection.fetchedAt || new Date().toISOString(),
    confirmedAt: detection.confirmedAt,
    confirmedBy: detection.confirmedBy,
    manuallyCorrected: detection.manuallyCorrected ?? false,
    failureReason: detection.failureReason,
    attribution:
      detection.attribution ||
      (detection.source === "Manual"
        ? "Officer-confirmed road layout displayed on Google Maps."
        : "Map, address and road context © Google."),
  };
}

export const RoadLayoutDetectionService = {
  async detectAtCoordinate(
    coordinate: RoadDetectionCoordinate,
    radiusMetres = DEFAULT_RADIUS_METRES,
    forceRefresh = false,
  ): Promise<RoadDetectionResult> {
    if (!forceRefresh) {
      const cached = readCache(coordinate, radiusMetres);
      if (cached) return cached;
    }

    const warnings: string[] = [];
    const [geocodeResult, proxyResult] = await Promise.allSettled([
      reverseGeocode(coordinate),
      queryGoogleRoadsProxy(coordinate, radiusMetres),
    ]);

    const geocoded =
      geocodeResult.status === "fulfilled"
        ? geocodeResult.value
        : { address: emptyAddress(), result: undefined };

    if (geocodeResult.status === "rejected") {
      warnings.push(
        geocodeResult.reason instanceof Error
          ? geocodeResult.reason.message
          : "Google could not resolve the nearby address.",
      );
    }

    if (proxyResult.status === "fulfilled" && proxyResult.value?.detection) {
      const detection = normaliseDetection(
        {
          ...proxyResult.value.detection,
          source: "Google Maps",
          coordinate,
          address: proxyResult.value.detection.address ?? geocoded.address,
          radiusMetres,
          attribution: "Map, address and road context © Google.",
        },
        coordinate,
      );
      warnings.push(...(proxyResult.value.warnings ?? []));
      const result: RoadDetectionResult = {
        detection,
        reverseGeocodingSucceeded: geocodeResult.status === "fulfilled",
        roadQuerySucceeded: detection.roads.length > 0,
        warnings,
      };
      writeCache(coordinate, radiusMetres, result);
      return result;
    }

    if (proxyResult.status === "rejected") {
      warnings.push(
        proxyResult.reason instanceof Error
          ? proxyResult.reason.message
          : "The secured Google Roads proxy could not be reached.",
      );
    } else if (!GOOGLE_ROADS_PROXY_URL) {
      warnings.push(
        "Detailed road geometry requires VITE_GOOGLE_ROADS_PROXY_URL. Confirm the road layout manually until the secured proxy is configured.",
      );
    }

    const inferred = inferLayout(geocoded.result);
    const settings = buildSettings(inferred.layout, geocoded.address);
    const detection: RoadLayoutDetection = {
      id: createId("road-layout"),
      source: "Google Maps",
      coordinate,
      address: geocoded.address,
      detectedLayout: inferred.layout,
      confidence: inferred.confidence,
      confidenceLabel: getConfidenceLabel(inferred.confidence),
      radiusMetres,
      roadNames: geocoded.address.roadName ? [geocoded.address.roadName] : [],
      branchCount: inferred.branchCount,
      roads: [],
      features: [],
      junctionCentre: { x: 50, y: 50 },
      suggestedSceneSettings: settings,
      fetchedAt: new Date().toISOString(),
      manuallyCorrected: false,
      failureReason:
        "Google address context was available, but detailed road geometry was not returned by a secured Roads proxy.",
      attribution: "Map and address context © Google.",
    };

    const result: RoadDetectionResult = {
      detection,
      reverseGeocodingSucceeded: geocodeResult.status === "fulfilled",
      roadQuerySucceeded: false,
      warnings,
    };
    writeCache(coordinate, radiusMetres, result);
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
        JSON.stringify(settings) !==
          JSON.stringify(detection.suggestedSceneSettings),
      confirmedAt: new Date().toISOString(),
      confirmedBy,
    };
  },

  normalise(detection: RoadLayoutDetection): RoadLayoutDetection {
    return normaliseDetection(detection, detection.coordinate);
  },
};
