import type { RealSceneAreaSelection, RealSceneBounds, RealSceneGeoPoint } from "../types/realSceneGeometry";
import type { RoadDetectionCoordinate } from "../types/roadLayoutDetection";
import type { ForensicAreaSnapshot, ForensicLocalMetricFrame } from "../types/forensicScenePipeline";

const METRES_PER_LATITUDE_DEGREE = 110_540;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function metresPerLongitudeDegree(latitudeDegrees: number): number {
  return 111_320 * Math.max(0.000001, Math.cos((latitudeDegrees * Math.PI) / 180));
}

export function dimensionsForBounds(bounds: RealSceneBounds) {
  const centreLatitude = (bounds.north + bounds.south) / 2;
  const width = Math.max(0, (bounds.east - bounds.west) * metresPerLongitudeDegree(centreLatitude));
  const height = Math.max(0, (bounds.north - bounds.south) * METRES_PER_LATITUDE_DEGREE);
  return { width, height, areaSquareMetres: width * height };
}

export function coordinateInsideBounds(coordinate: { latitude: number; longitude: number }, bounds: RealSceneBounds): boolean {
  return coordinate.latitude >= bounds.south && coordinate.latitude <= bounds.north && coordinate.longitude >= bounds.west && coordinate.longitude <= bounds.east;
}

function polygonForBounds(bounds: RealSceneBounds): RealSceneGeoPoint[] {
  return [
    { latitude: bounds.south, longitude: bounds.west },
    { latitude: bounds.south, longitude: bounds.east },
    { latitude: bounds.north, longitude: bounds.east },
    { latitude: bounds.north, longitude: bounds.west },
    { latitude: bounds.south, longitude: bounds.west },
  ];
}

export function areaSelectionFromBounds(
  bounds: RealSceneBounds,
  template?: Pick<RealSceneAreaSelection, "mapMode" | "zoom" | "bearing" | "pitch">,
): RealSceneAreaSelection {
  return {
    id: createId("forensic-area"),
    bounds,
    polygon: polygonForBounds(bounds),
    centre: {
      latitude: (bounds.north + bounds.south) / 2,
      longitude: (bounds.east + bounds.west) / 2,
      accuracyMetres: 0,
      capturedAt: new Date().toISOString(),
    },
    mapMode: template?.mapMode ?? "hybrid",
    zoom: template?.zoom ?? 17,
    bearing: template?.bearing ?? 0,
    pitch: template?.pitch ?? 0,
    selectedAt: new Date().toISOString(),
  };
}

export function createContextArea(coreArea: RealSceneAreaSelection, bufferMetres: number): RealSceneAreaSelection {
  const safeBuffer = Math.max(10, Math.min(350, bufferMetres));
  const centreLatitude = (coreArea.bounds.north + coreArea.bounds.south) / 2;
  const latPad = safeBuffer / METRES_PER_LATITUDE_DEGREE;
  const lonPad = safeBuffer / metresPerLongitudeDegree(centreLatitude);
  return areaSelectionFromBounds(
    {
      north: coreArea.bounds.north + latPad,
      south: coreArea.bounds.south - latPad,
      east: coreArea.bounds.east + lonPad,
      west: coreArea.bounds.west - lonPad,
    },
    coreArea,
  );
}

export function createLocalMetricFrame(coreArea: RealSceneAreaSelection, anchor: RoadDetectionCoordinate): ForensicLocalMetricFrame {
  const lonScale = metresPerLongitudeDegree(anchor.latitude);
  return {
    schemaVersion: "RoadSafe Local Frame V1",
    origin: { ...anchor },
    axes: { x: "East", y: "Up", z: "North" },
    units: "metres",
    metresPerLatitudeDegree: METRES_PER_LATITUDE_DEGREE,
    metresPerLongitudeDegree: lonScale,
    coreBounds: { ...coreArea.bounds },
    anchorOffsetFromSouthWestMetres: {
      east: (anchor.longitude - coreArea.bounds.west) * lonScale,
      north: (anchor.latitude - coreArea.bounds.south) * METRES_PER_LATITUDE_DEGREE,
    },
  };
}

export function buildForensicAreaSnapshot(
  coreArea: RealSceneAreaSelection,
  anchor: RoadDetectionCoordinate,
  contextBufferMetres: number,
): ForensicAreaSnapshot {
  if (!coordinateInsideBounds(anchor, coreArea.bounds)) {
    throw new Error("The forensic core must contain the accident anchor.");
  }

  const core = dimensionsForBounds(coreArea.bounds);
  if (core.width < 8 || core.height < 8) throw new Error("The forensic core must be at least 8 metres wide and high.");
  if (core.width > 1_200 || core.height > 1_200) throw new Error("Keep each forensic-core side below 1.2 km.");

  const contextArea = createContextArea(coreArea, contextBufferMetres);
  const context = dimensionsForBounds(contextArea.bounds);

  return {
    schemaVersion: "RoadSafe Case Area V1",
    id: createId("case-area"),
    frozenAt: new Date().toISOString(),
    boundaryMode: "Rectangle",
    coreArea: {
      ...coreArea,
      bounds: { ...coreArea.bounds },
      polygon: coreArea.polygon.map((point) => ({ ...point })),
    },
    contextArea,
    contextBufferMetres: Math.max(10, Math.min(350, contextBufferMetres)),
    accidentAnchor: { ...anchor },
    localFrame: createLocalMetricFrame(coreArea, anchor),
    coreDimensionsMetres: {
      width: Number(core.width.toFixed(3)),
      height: Number(core.height.toFixed(3)),
      areaSquareMetres: Number(core.areaSquareMetres.toFixed(2)),
    },
    contextDimensionsMetres: {
      width: Number(context.width.toFixed(3)),
      height: Number(context.height.toFixed(3)),
      areaSquareMetres: Number(context.areaSquareMetres.toFixed(2)),
    },
  };
}
