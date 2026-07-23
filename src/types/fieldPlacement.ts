export interface FieldScenePosition {
  x: number;
  y: number;
}

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  altitudeMetres?: number | null;
  headingDegrees?: number | null;
  speedMetresPerSecond?: number | null;
  capturedAt: string;
}

export interface RejectedGeoCoordinate {
  coordinate: GeoCoordinate;
  reason:
    | "Invalid coordinate"
    | "Poor accuracy"
    | "Duplicate sample"
    | "Impossible jump"
    | "Out-of-order timestamp";
}

export interface FieldSceneCalibration {
  id: string;
  origin: GeoCoordinate;
  directionReference: GeoCoordinate;
  widthReference?: GeoCoordinate;
  sceneWidthMetres: number;
  sceneHeightMetres: number;
  rotationDegrees: number;
  directionReferenceDistanceMetres: number;
  widthReferenceDistanceMetres?: number;
  yAxisSide: "Left" | "Right";
  createdAt: string;
  createdBy: string;
}

export type FieldPlacementTargetType =
  | "ParticipantPathPoint"
  | "SceneObject"
  | "EvidenceRecord"
  | "MeasurementStart"
  | "MeasurementEnd"
  | "CollisionPoint";

export interface FieldPlacementTarget {
  type: FieldPlacementTargetType;
  targetId: string;
  subTargetId?: string;
  label: string;
}

export type FieldCaptureMode = "Point" | "Line" | "Boundary";

export type FieldPlacementMethod =
  | "Single GPS"
  | "Averaged GPS"
  | "Walking Trace"
  | "Walking Boundary"
  | "Manual";

export interface FieldPlacementRecord {
  id: string;
  targetType: FieldPlacementTargetType;
  targetId: string;
  subTargetId?: string;
  targetLabel: string;
  coordinate: GeoCoordinate;
  scenePosition: FieldScenePosition;
  rawScenePosition?: FieldScenePosition;
  sampleCount: number;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
  observedSpreadMetres?: number;
  estimatedUncertaintyMetres?: number;
  rawSamples?: GeoCoordinate[];
  rejectedSamples?: RejectedGeoCoordinate[];
  method: FieldPlacementMethod;
  acceptedPoorAccuracy: boolean;
  manuallyAdjusted: boolean;
  originalScenePosition?: FieldScenePosition;
  adjustmentReason?: string;
  confirmedAt: string;
  confirmedBy: string;
}

export type FieldWalkingTrackTargetType =
  | "ParticipantPath"
  | "SkidMark"
  | "TyreMark"
  | "RoadCrack"
  | "EvidenceTrail"
  | "SceneObjectLine"
  | "SceneObjectBoundary";

export interface FieldWalkingTrack {
  id: string;
  targetType: FieldWalkingTrackTargetType;
  targetId: string;
  targetLabel: string;
  captureMode?: "Line" | "Boundary";
  /** Processed, authoritative coordinates used by the reconstruction. */
  coordinates: GeoCoordinate[];
  /** Original device readings preserved for forensic audit. */
  rawCoordinates?: GeoCoordinate[];
  /** Samples excluded from the processed geometry, with reasons. */
  rejectedCoordinates?: RejectedGeoCoordinate[];
  scenePoints: FieldScenePosition[];
  rawScenePoints?: FieldScenePosition[];
  startedAt: string;
  completedAt: string;
  distanceMetres: number;
  rawDistanceMetres?: number;
  areaSquareMetres?: number;
  closedBoundary?: boolean;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
  estimatedUncertaintyMetres?: number;
  processingMethod?: string;
  recordedBy: string;
}

export interface AveragedLocationResult {
  coordinate: GeoCoordinate;
  sampleCount: number;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
  rejectedSampleCount: number;
  observedSpreadMetres?: number;
  estimatedUncertaintyMetres?: number;
  rawSamples?: GeoCoordinate[];
  rejectedSamples?: RejectedGeoCoordinate[];
}

export interface ProcessedWalkingTrace {
  captureMode: "Line" | "Boundary";
  rawCoordinates: GeoCoordinate[];
  acceptedCoordinates: GeoCoordinate[];
  rejectedCoordinates: RejectedGeoCoordinate[];
  processedCoordinates: GeoCoordinate[];
  rawDistanceMetres: number;
  processedDistanceMetres: number;
  areaSquareMetres?: number;
  closedBoundary: boolean;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
  estimatedUncertaintyMetres: number;
  processingMethod: string;
}

export interface SceneBoundsAssessment {
  rawPosition: FieldScenePosition;
  insideScene: boolean;
  outsideEastMetres: number;
  outsideWestMetres: number;
  outsideNorthMetres: number;
  outsideSouthMetres: number;
}

export type FieldAccuracyQuality =
  | "Excellent"
  | "Good"
  | "Acceptable"
  | "Poor";
