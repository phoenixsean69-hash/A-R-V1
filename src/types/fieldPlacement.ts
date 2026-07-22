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

export type FieldPlacementMethod =
  | "Single GPS"
  | "Averaged GPS"
  | "Walking Trace"
  | "Manual";

export interface FieldPlacementRecord {
  id: string;
  targetType: FieldPlacementTargetType;
  targetId: string;
  subTargetId?: string;
  targetLabel: string;
  coordinate: GeoCoordinate;
  scenePosition: FieldScenePosition;
  sampleCount: number;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
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
  | "EvidenceTrail";

export interface FieldWalkingTrack {
  id: string;
  targetType: FieldWalkingTrackTargetType;
  targetId: string;
  targetLabel: string;
  coordinates: GeoCoordinate[];
  scenePoints: FieldScenePosition[];
  startedAt: string;
  completedAt: string;
  distanceMetres: number;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
  recordedBy: string;
}

export interface AveragedLocationResult {
  coordinate: GeoCoordinate;
  sampleCount: number;
  averageAccuracyMetres: number;
  bestAccuracyMetres: number;
  rejectedSampleCount: number;
}

export type FieldAccuracyQuality =
  | "Excellent"
  | "Good"
  | "Acceptable"
  | "Poor";
