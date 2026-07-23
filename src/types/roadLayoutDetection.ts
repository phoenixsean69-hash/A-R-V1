import type {
  DrivingSide,
  ReconstructionPosition,
  RoadLayoutType,
  RoadSceneSettings,
  TrafficControlType,
} from "./reconstruction";

export interface RoadDetectionCoordinate {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  capturedAt: string;
}

export interface DetectedRoadPoint {
  latitude: number;
  longitude: number;
}

export interface DetectedRoadSegment {
  id: string;
  osmId: number;
  name: string;
  highwayType: string;
  laneCount?: number;
  oneWay?: boolean;
  surface?: string;
  maximumSpeedKmh?: number;
  junction?: string;
  isRoundabout: boolean;
  distanceFromOfficerMetres: number;
  points: DetectedRoadPoint[];
  scenePoints: ReconstructionPosition[];
}

export interface DetectedRoadFeature {
  id: string;
  type:
    | "Traffic Signal"
    | "Pedestrian Crossing"
    | "Stop Sign"
    | "Give Way Sign"
    | "Bus Stop"
    | "Bus Station";
  latitude: number;
  longitude: number;
  scenePosition: ReconstructionPosition;
  name?: string;
}

export interface RoadAddressResult {
  displayName: string;
  roadName: string;
  suburb: string;
  city: string;
  state: string;
  country: string;
}

export type RoadLayoutDetectionSource = "OpenStreetMap" | "Manual";

export type RoadLayoutConfidenceLabel =
  | "High"
  | "Moderate"
  | "Low"
  | "Manual";

export interface RoadLayoutDetection {
  id: string;
  source: RoadLayoutDetectionSource;
  coordinate: RoadDetectionCoordinate;
  address: RoadAddressResult;
  detectedLayout: RoadLayoutType;
  originalDetectedLayout?: RoadLayoutType;
  confidence: number;
  confidenceLabel: RoadLayoutConfidenceLabel;
  radiusMetres: number;
  roadNames: string[];
  branchCount: number;
  roads: DetectedRoadSegment[];
  features: DetectedRoadFeature[];
  junctionCentre: ReconstructionPosition;
  suggestedSceneSettings: RoadSceneSettings;
  fetchedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  manuallyCorrected: boolean;
  failureReason?: string;
  attribution: string;
}

export interface RoadLayoutManualSelection {
  roadLayout: RoadLayoutType;
  laneCount: number;
  roadRotation: number;
  drivingSide: DrivingSide;
  trafficControl: TrafficControlType;
  speedLimitKmh: number;
  showPedestrianCrossing: boolean;
}

export interface RoadDetectionResult {
  detection: RoadLayoutDetection;
  reverseGeocodingSucceeded: boolean;
  roadQuerySucceeded: boolean;
  warnings: string[];
}
