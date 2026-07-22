import type { RoadLayoutDetection } from "./roadLayoutDetection";

import type {
  FieldPlacementRecord,
  FieldSceneCalibration,
  FieldWalkingTrack,
  GeoCoordinate,
} from "./fieldPlacement";

export interface ReconstructionPosition {
  x: number;
  y: number;
}

export type ReconstructionEntityType =
  | "Car"
  | "Bus"
  | "Truck"
  | "Motorcycle"
  | "Bicycle"
  | "Pedestrian"
  | "Officer"
  | "Witness";

export type ReconstructionEntityColour =
  | "Blue"
  | "Red"
  | "Green"
  | "Yellow"
  | "Black"
  | "White"
  | "Orange"
  | "Purple";

export type ReconstructionEntityRole =
  | "Driver"
  | "Passenger"
  | "Pedestrian"
  | "Cyclist"
  | "Officer"
  | "Witness";

export type MovementAction =
  | "Start"
  | "Enter Scene"
  | "Accelerate"
  | "Cruise"
  | "Brake"
  | "Turn Left"
  | "Turn Right"
  | "Swerve"
  | "Impact"
  | "Ricochet"
  | "Deflect"
  | "Slide"
  | "Fall"
  | "Stop"
  | "Exit Scene";

export interface MovementPathPoint {
  id: string;
  label: string;
  position: ReconstructionPosition;
  timeSeconds: number;
  speedKmh: number;
  rotation: number;
  action: MovementAction;
  linkedSceneObjectId?: string;
  notes?: string;
}

export interface ReconstructionEntity {
  id: string;
  name: string;
  type: ReconstructionEntityType;
  colour: ReconstructionEntityColour;
  estimatedSpeedKmh: number;

  /** Human-readable route context for reports and later AR narration. */
  originLocation: string;
  destinationLocation: string;

  /** Advanced, draggable movement route. */
  pathPoints: MovementPathPoint[];

  /** Legacy compatibility fields kept in sync with pathPoints. */
  startPosition: ReconstructionPosition;
  collisionPosition: ReconstructionPosition;
  finalPosition: ReconstructionPosition;
  startRotation: number;
  collisionRotation: number;
  finalRotation: number;
  collisionTimeSeconds: number;

  role?: ReconstructionEntityRole;
  injured?: boolean;
  insideVehicleId?: string;
  notes?: string;

  /** Optional deterministic 2D physics parameters. */
  physics?: ParticipantPhysicsProfile;
}

export interface ParticipantPhysicsProfile {
  enabled: boolean;
  massKg: number;
  collisionRadiusMetres: number;
  restitution: number;
  rollingFriction: number;
  lateralGrip: number;
  brakingDecelerationMps2: number;
}

/* Compatibility aliases used by the current editor. */
export type ReconstructionVehicleType = ReconstructionEntityType;
export type ReconstructionVehicleColour = ReconstructionEntityColour;
export type ReconstructionVehicle = ReconstructionEntity;

export type RoadLayoutType =
  | "Four-way Intersection"
  | "T-Junction"
  | "Straight Road"
  | "Roundabout"
  | "Pedestrian Crossing"
  | "Transport Terminus";

export type DrivingSide = "Left" | "Right";

export type TrafficControlType =
  | "None"
  | "Traffic Lights"
  | "Stop Signs"
  | "Give Way Signs";

export type SceneTimeOfDay =
  | "Day"
  | "Dawn"
  | "Dusk"
  | "Night";

export type SceneWeather =
  | "Clear"
  | "Rain"
  | "Fog"
  | "Dust";

export type RoadSurfaceCondition =
  | "Dry"
  | "Wet"
  | "Damaged";

export type SceneVisibility =
  | "Good"
  | "Reduced"
  | "Poor";

export type SceneTrafficVolume =
  | "Light"
  | "Moderate"
  | "Heavy";

export interface RoadSceneSettings {
  roadLayout: RoadLayoutType;
  laneCount: number;
  roadRotation: number;

  /** Physical dimensions represented by the 2D editor canvas. */
  sceneWidthMetres: number;
  sceneHeightMetres: number;
  drivingSide: DrivingSide;
  trafficControl: TrafficControlType;
  speedLimitKmh: number;
  showPavements: boolean;
  showLaneMarkings: boolean;
  showPedestrianCrossing: boolean;
  timeOfDay: SceneTimeOfDay;
  weather: SceneWeather;
  roadSurface: RoadSurfaceCondition;
  visibility: SceneVisibility;
  trafficVolume: SceneTrafficVolume;
}

export function createDefaultRoadSceneSettings(): RoadSceneSettings {
  return {
    roadLayout: "Four-way Intersection",
    laneCount: 2,
    roadRotation: 0,
    sceneWidthMetres: 60,
    sceneHeightMetres: 60,
    drivingSide: "Left",
    trafficControl: "Give Way Signs",
    speedLimitKmh: 60,
    showPavements: true,
    showLaneMarkings: true,
    showPedestrianCrossing: false,
    timeOfDay: "Day",
    weather: "Clear",
    roadSurface: "Dry",
    visibility: "Good",
    trafficVolume: "Moderate",
  };
}

export type SceneObjectCategory =
  | "Road Hazards"
  | "Physical Evidence"
  | "Traffic Control"
  | "Road Infrastructure"
  | "Environment"
  | "Investigation";

export type SceneObjectType =
  | "Pothole"
  | "Road Crack"
  | "Puddle"
  | "Oil Spill"
  | "Loose Gravel"
  | "Debris"
  | "Broken Glass"
  | "Fallen Branch"
  | "Skid Mark"
  | "Tyre Mark"
  | "Vehicle Part"
  | "Injury Location"
  | "Traffic Cone"
  | "Road Barrier"
  | "Stop Sign"
  | "Give Way Sign"
  | "Speed Limit Sign"
  | "Traffic Light"
  | "Street Light"
  | "Drain"
  | "Guardrail"
  | "Bus Stop"
  | "Parked Vehicle"
  | "Tree"
  | "Bush"
  | "Wall"
  | "Fence"
  | "CCTV Camera"
  | "Evidence Marker"
  | "Measurement Point"
  | "Witness Viewpoint";

export type SceneObjectSeverity =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export type SceneTraceStyle = "Single" | "Double";

export interface ReconstructionSceneObject {
  id: string;
  type: SceneObjectType;
  category: SceneObjectCategory;
  label: string;
  position: ReconstructionPosition;
  rotation: number;
  scale: number;
  severity: SceneObjectSeverity;
  visible: boolean;
  locked: boolean;
  notes: string;

  /* Optional measurements and object-specific values. */
  widthMetres?: number;
  lengthMetres?: number;
  depthCentimetres?: number;
  speedLimitKmh?: number;
  evidenceNumber?: number;

  /** Freehand curved trace for skid marks, tyre marks and road cracks. */
  tracePoints?: ReconstructionPosition[];
  traceWidth?: number;
  traceStyle?: SceneTraceStyle;
  traceSmoothing?: number;

  /** Optional interaction properties used by the premium physics preview. */
  physics?: SceneObjectPhysicsProfile;
}

export interface SceneObjectPhysicsProfile {
  enabled: boolean;
  collidable: boolean;
  collisionRadiusMetres: number;
  restitution: number;
  surfaceFrictionMultiplier: number;
  speedLossFactor: number;
  deflectionDegrees: number;
}

export type PhysicsSimulationMode =
  | "Guided Paths"
  | "Physics After Primary Impact";

export interface ReconstructionPhysicsSettings {
  enabled: boolean;
  mode: PhysicsSimulationMode;
  /** Rebuild a deterministic collision response when playback starts at 0s. */
  autoRunOnPlay: boolean;
  /** Debounced physics refresh while paths, collision settings or profiles change. */
  liveSimulation: boolean;
  timeStepSeconds: number;
  collisionToleranceMetres: number;
  globalFrictionMultiplier: number;
  airDrag: number;
  stopSpeedKmh: number;
  showVelocityVectors: boolean;
  showImpactEffects: boolean;
  replacePostImpactPath: boolean;
}

export interface CollisionSetup {
  source: "Manual" | "Derived";
  confirmed: boolean;
  locked: boolean;
  toleranceMetres: number;
  notes: string;
  lastCalculatedAt?: string;
}

export interface PhysicsSimulationSummary {
  ranAt: string;
  participantCollisions: number;
  primaryImpactTimeSeconds: number;
  estimatedImpactEnergyKj: number;
  solidObjectImpacts: number;
  potholeInteractions: number;
  surfaceInteractions: number;
  generatedPathPoints: number;
  simulatedDurationSeconds: number;
  warnings: string[];
}

export type TimelineEventType =
  | "Participant Action"
  | "Collision"
  | "Evidence"
  | "Environment"
  | "Observation";

export interface AccidentTimelineEvent {
  id: string;
  timeSeconds: number;
  title: string;
  description: string;
  type: TimelineEventType;
  participantId?: string;
  sceneObjectId?: string;
}


export type SceneMeasurementKind =
  | "Distance"
  | "Braking Distance"
  | "Skid Length"
  | "Lane Width"
  | "Road Width"
  | "Impact to Rest"
  | "Participant Separation"
  | "Custom";

export interface SceneMeasurement {
  id: string;
  measurementNumber: number;
  label: string;
  kind: SceneMeasurementKind;
  start: ReconstructionPosition;
  end: ReconstructionPosition;
  distanceMetres: number;
  colour: string;
  visible: boolean;
  locked: boolean;
  notes: string;
  linkedParticipantId?: string;
  linkedSceneObjectId?: string;
  linkedTimelineEventId?: string;
}

export type EvidenceCategory =
  | "Road Condition"
  | "Vehicle Evidence"
  | "Human Evidence"
  | "Trace Evidence"
  | "Environmental"
  | "Digital"
  | "Other";

export type EvidenceStatus =
  | "Observed"
  | "Photographed"
  | "Collected"
  | "Analysed";

export interface EvidenceRecord {
  id: string;
  evidenceNumber: number;
  title: string;
  category: EvidenceCategory;
  status: EvidenceStatus;
  description: string;
  notes: string;
  position: ReconstructionPosition;
  recordedAt: string;
  recordedBy: string;
  linkedParticipantId?: string;
  linkedSceneObjectId?: string;
  linkedTimelineEventId?: string;
  measurementIds: string[];
  photoIds: string[];
}

export interface ScenePhotoAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  thumbnailDataUrl: string;
  caption: string;
  takenAt: string;
  position: ReconstructionPosition;
  bearingDegrees: number;
  linkedEvidenceId?: string;
  linkedParticipantId?: string;
  linkedSceneObjectId?: string;

  /** Optional field metadata when the photograph was captured on site. */
  geoCoordinate?: GeoCoordinate;
  fieldPlacementId?: string;
}

export interface AccidentReconstruction {
  id: string;
  accidentId: string;
  junctionId: string;
  title: string;
  description: string;
  durationSeconds: number;
  vehicles: ReconstructionEntity[];
  collisionPoint: ReconstructionPosition;
  scene: RoadSceneSettings;
  sceneObjects: ReconstructionSceneObject[];
  timelineEvents: AccidentTimelineEvent[];
  measurements: SceneMeasurement[];
  evidenceRecords: EvidenceRecord[];
  photos: ScenePhotoAttachment[];

  /** Real-world scene calibration and permanent GPS field audit. */
  fieldCalibration?: FieldSceneCalibration;
  fieldPlacements: FieldPlacementRecord[];
  fieldWalkingTracks: FieldWalkingTrack[];

  /** Primary collision marker and deterministic physics configuration. */
  collisionSetup?: CollisionSetup;
  physicsSettings?: ReconstructionPhysicsSettings;
  lastPhysicsSimulation?: PhysicsSimulationSummary;

  /** Original or manually confirmed road geometry used to build the scene. */
  roadLayoutDetection?: RoadLayoutDetection;

  createdAt: string;
  updatedAt: string;
  status: "Draft" | "Completed";
}
