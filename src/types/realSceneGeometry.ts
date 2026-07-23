import type { RoadDetectionCoordinate } from "./roadLayoutDetection";

export type RealSceneMapMode = "street" | "hybrid" | "terrain";

export interface RealSceneGeoPoint {
  latitude: number;
  longitude: number;
}

export interface RealSceneBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RealSceneAreaSelection {
  id: string;
  bounds: RealSceneBounds;
  /** Closed geographic ring. The final point repeats the first point. */
  polygon: RealSceneGeoPoint[];
  centre: RoadDetectionCoordinate;
  mapMode: RealSceneMapMode;
  zoom: number;
  bearing: number;
  pitch: number;
  selectedAt: string;
}

export interface RealSceneLocalPoint {
  /** Easting from the selected area's western boundary. */
  xMetres: number;
  /** Northing from the selected area's southern boundary. */
  yMetres: number;
  xPercent: number;
  /** Screen-space percentage: north is 0, south is 100. */
  yPercent: number;
}

export interface RealSceneSnapshotReference {
  id: string;
  mapMode: RealSceneMapMode;
  capturedAt: string;
  bounds: RealSceneBounds;
  widthPixels: number;
  heightPixels: number;
  mimeType: string;
}

export interface RealSceneRoadGeometry {
  id: string;
  osmId: number;
  name: string;
  highwayType: string;
  laneCount: number;
  widthMetres: number;
  oneWay?: boolean;
  surface?: string;
  maximumSpeedKmh?: number;
  isRoundabout: boolean;
  points: RealSceneGeoPoint[];
  localPoints: RealSceneLocalPoint[];
}

export interface RealScenePathGeometry {
  id: string;
  osmId: number;
  name: string;
  pathType: string;
  widthMetres: number;
  points: RealSceneGeoPoint[];
  localPoints: RealSceneLocalPoint[];
}

export interface RealSceneBuildingGeometry {
  id: string;
  osmId: number;
  name: string;
  buildingType: string;
  levels?: number;
  heightMetres: number;
  points: RealSceneGeoPoint[];
  localPoints: RealSceneLocalPoint[];
}

export interface RealSceneBarrierGeometry {
  id: string;
  osmId: number;
  name: string;
  barrierType: string;
  heightMetres: number;
  points: RealSceneGeoPoint[];
  localPoints: RealSceneLocalPoint[];
}

export type RealSceneLandCoverType =
  | "Forest"
  | "Woodland"
  | "Scrub"
  | "Grass"
  | "Meadow"
  | "Farmland"
  | "Orchard"
  | "Park"
  | "Garden"
  | "Wetland"
  | "Bare Ground"
  | "Water"
  | "Other";

export interface RealSceneLandCoverGeometry {
  id: string;
  osmId: number;
  name: string;
  landCoverType: RealSceneLandCoverType;
  sourceTag: string;
  points: RealSceneGeoPoint[];
  localPoints: RealSceneLocalPoint[];
}

export type RealSceneVegetationType = "Tree" | "Palm" | "Shrub";

export interface RealSceneVegetationGeometry {
  id: string;
  osmId?: number;
  name: string;
  vegetationType: RealSceneVegetationType;
  position: RealSceneGeoPoint;
  localPosition: RealSceneLocalPoint;
  heightMetres: number;
  canopyDiameterMetres: number;
  /** True when the point was sampled deterministically from mapped land cover. */
  generatedFromLandCover: boolean;
}

export interface RealSceneGeometry {
  version: "RoadSafe Real Scene V1" | "RoadSafe Real Scene V2";
  status: "ready";
  selection: RealSceneAreaSelection;
  snapshot?: RealSceneSnapshotReference;
  origin: RealSceneGeoPoint;
  sceneWidthMetres: number;
  sceneHeightMetres: number;
  roads: RealSceneRoadGeometry[];
  paths: RealScenePathGeometry[];
  buildings: RealSceneBuildingGeometry[];
  barriers: RealSceneBarrierGeometry[];
  landCover?: RealSceneLandCoverGeometry[];
  vegetation?: RealSceneVegetationGeometry[];
  confidence: number;
  warnings: string[];
  attribution: string;
  extractedAt: string;
}

export interface RealSceneExtractionResult {
  geometry: RealSceneGeometry;
  warnings: string[];
}
