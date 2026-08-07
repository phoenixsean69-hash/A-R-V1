import type {
  RealSceneAreaSelection,
  RealSceneBounds,
  RealSceneGeometry,
} from "./realSceneGeometry";
import type { RoadDetectionCoordinate } from "./roadLayoutDetection";

export type ForensicSourceClassification =
  | "Measured"
  | "Source-reported"
  | "Derived"
  | "Estimated"
  | "Manually corrected"
  | "Unknown";

export type ForensicSourceStatus = "ready" | "partial" | "unavailable";
export type ForensicQaSeverity = "pass" | "warning" | "error";

export interface ForensicLocalMetricFrame {
  schemaVersion: "RoadSafe Local Frame V1";
  origin: RoadDetectionCoordinate;
  axes: { x: "East"; y: "Up"; z: "North" };
  units: "metres";
  metresPerLatitudeDegree: number;
  metresPerLongitudeDegree: number;
  coreBounds: RealSceneBounds;
  anchorOffsetFromSouthWestMetres: { east: number; north: number };
}

export interface ForensicAreaSnapshot {
  schemaVersion: "RoadSafe Case Area V1";
  id: string;
  frozenAt: string;
  boundaryMode: "Rectangle" | "Polygon" | "Radius";
  coreArea: RealSceneAreaSelection;
  contextArea: RealSceneAreaSelection;
  contextBufferMetres: number;
  accidentAnchor: RoadDetectionCoordinate;
  localFrame: ForensicLocalMetricFrame;
  coreDimensionsMetres: { width: number; height: number; areaSquareMetres: number };
  contextDimensionsMetres: { width: number; height: number; areaSquareMetres: number };
}

export interface ForensicArchiveReference {
  id: string;
  kind: "osm-raw" | "osm-normalized" | "elevation-raw" | "pipeline-manifest";
  capturedAt: string;
  sha256: string;
  byteLength: number;
  storage: "IndexedDB";
  mimeType: "application/json";
}

export interface ForensicSourceRecord {
  id: string;
  layer: "roads" | "buildings" | "paths" | "barriers" | "land-cover" | "vegetation" | "terrain" | "area";
  provider: string;
  classification: ForensicSourceClassification;
  status: ForensicSourceStatus;
  confidence: number;
  capturedAt: string;
  coverage: "core" | "context" | "core+context";
  nominalResolutionMetres?: number;
  archive?: ForensicArchiveReference;
  attribution: string;
  notes: string[];
}

export interface ForensicTerrainGrid {
  schemaVersion: "RoadSafe Terrain Grid V1";
  status: "ready" | "fallback-flat";
  bounds: RealSceneBounds;
  rows: number;
  columns: number;
  /** Row-major, south -> north and west -> east. Absolute metres above MSL. */
  elevationsMetres: number[];
  minimumElevationMetres: number;
  maximumElevationMetres: number;
  meanElevationMetres: number;
  originElevationMetres: number;
  reliefMetres: number;
  nominalResolutionMetres: number;
  provider: "Open-Meteo Elevation API / Copernicus DEM" | "Flat low-confidence fallback";
  classification: ForensicSourceClassification;
  confidence: number;
  capturedAt: string;
  attribution: string;
  archive?: ForensicArchiveReference;
  notes: string[];
}

export interface ForensicLayerAssessment {
  layer: Exclude<ForensicSourceRecord["layer"], "area">;
  classification: ForensicSourceClassification;
  confidence: number;
  sourceIds: string[];
  featureCount?: number;
  notes: string[];
}

export interface ForensicQaCheck {
  id: string;
  label: string;
  severity: ForensicQaSeverity;
  value: string;
  detail: string;
}

export interface ForensicQaReport {
  schemaVersion: "RoadSafe Geometry QA V1";
  generatedAt: string;
  geometryCompletenessPercent: number;
  elevationCoveragePercent: number;
  sourceArchivePercent: number;
  overallScorePercent: number;
  decision: "GOOD — REVIEW REQUIRED" | "LIMITED — CORRECTION REQUIRED" | "INSUFFICIENT — DO NOT USE";
  checks: ForensicQaCheck[];
  warnings: string[];
}

export interface ForensicScenePackage {
  schemaVersion: "RoadSafe Forensic Scene V1";
  id: string;
  version: 1;
  createdAt: string;
  area: ForensicAreaSnapshot;
  terrain: ForensicTerrainGrid;
  sources: ForensicSourceRecord[];
  layers: ForensicLayerAssessment[];
  qa: ForensicQaReport;
  snapshotSha256: string;
  geometrySha256: string;
  legacyGeometryVersion: RealSceneGeometry["version"];
  reviewStatus: "pending-investigator-review" | "investigator-confirmed";
  investigatorConfirmedAt?: string;
}

export interface ForensicPipelineStage {
  id: "freeze-area" | "archive-osm" | "normalize-geometry" | "acquire-elevation" | "archive-elevation" | "quality-assurance" | "freeze-package";
  label: string;
  status: "waiting" | "running" | "complete" | "warning" | "failed";
  progressPercent: number;
  message: string;
}

export interface ForensicPipelineBuildResult {
  geometry: RealSceneGeometry;
  scenePackage: ForensicScenePackage;
  stages: ForensicPipelineStage[];
}
