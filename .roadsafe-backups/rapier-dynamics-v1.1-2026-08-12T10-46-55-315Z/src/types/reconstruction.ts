import type { RealSceneGeometry } from "./realSceneGeometry";
import type { ForensicScenePackage } from "./forensicScenePipeline";

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

export type ReconstructionParticipantAssetId =
  | "car-sedan-generic"
  | "car-hatchback-generic"
  | "car-suv-generic"
  | "car-pickup-generic"
  | "bus-minibus-generic"
  | "bus-city-generic"
  | "truck-rigid-generic"
  | "truck-articulated-generic"
  | "truck-lorry-generic"
  | "truck-tractor-generic"
  | "two-wheel-motorcycle-generic"
  | "two-wheel-bicycle-generic"
  | "human-adult-generic"
  | "human-adult-male-generic"
  | "human-adult-female-generic"
  | "human-child-generic";

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

  
/**

   * Shared generic visual asset used by 2D, 3D and later AR.

   * Older cases may omit it; the asset registry resolves a type-specific default.

   */

  assetId?: ReconstructionParticipantAssetId;
  /**
   * Visual/model scale controlled by the reconstruction gizmo.
   * This does NOT change participant physics dimensions or mass.
   */
  visualScale?: number;
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

export type PhysicsCollisionShape = "Circle" | "Oriented Box";

export interface ParticipantPhysicsProfile {
  enabled: boolean;

  /**
   * Optional explicit approach speed used by the deterministic physics solver.
   * Route geometry still supplies the movement direction.
   */
  inputSpeedKmh?: number;

  massKg: number;
  collisionRadiusMetres: number;
  restitution: number;
  rollingFriction: number;
  lateralGrip: number;
  brakingDecelerationMps2: number;

  /** V2 contact geometry. Older cases fall back to type-specific defaults. */
  collisionShape?: PhysicsCollisionShape;
  lengthMetres?: number;
  widthMetres?: number;
  collisionFriction?: number;
  momentOfInertiaScale?: number;
}

/* Compatibility aliases used by the current editor. */
export type ReconstructionVehicleType = ReconstructionEntityType;
export type ReconstructionVehicleColour = ReconstructionEntityColour;
export type ReconstructionVehicle = ReconstructionEntity;

export type SceneEnvironmentType =
  | "Road / Junction"
  | "Open Ground"
  | "Mixed Site"
  | "Custom Site";

export type GroundSurfaceType =
  | "Unclassified Ground"
  | "Firm Soil"
  | "Loose Soil"
  | "Grass"
  | "Gravel"
  | "Sand"
  | "Mud"
  | "Concrete"
  | "Paved Yard"
  | "Mixed Surface";

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
  /** Officer-selected, metre-based real-world geometry shared by 2D and 3D. */
  realSceneGeometry?: RealSceneGeometry;

  /** Frozen canonical forensic geospatial package. */
  forensicScene?: ForensicScenePackage;
  /** Controls whether RoadSafe generates road geometry or preserves neutral ground. */
  sceneEnvironment: SceneEnvironmentType;
  groundSurface: GroundSurfaceType;
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

  /** Optional real-world DEM terrain around the calibrated accident location. */
  useRealTerrain: boolean;
  terrainAreaMetres: number;
  terrainExaggeration: number;
  conformRoadToTerrain: boolean;
}

export function createDefaultRoadSceneSettings(): RoadSceneSettings {
  return {
    sceneEnvironment: "Road / Junction",
    groundSurface: "Unclassified Ground",
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
    useRealTerrain: true,
    terrainAreaMetres: 500,
    terrainExaggeration: 1,
    conformRoadToTerrain: true,
  };
}


export function createDefaultGroundSceneSettings(
  sceneEnvironment: Extract<SceneEnvironmentType, "Open Ground" | "Custom Site"> = "Open Ground",
): RoadSceneSettings {
  return {
    ...createDefaultRoadSceneSettings(),
    sceneEnvironment,
    groundSurface: "Unclassified Ground",
    roadLayout: "Straight Road",
    laneCount: 1,
    roadRotation: 0,
    drivingSide: "Left",
    trafficControl: "None",
    speedLimitKmh: 0,
    showPavements: false,
    showLaneMarkings: false,
    showPedestrianCrossing: false,
    trafficVolume: "Light",
  };
}

export function usesGeneratedRoad(settings: Pick<RoadSceneSettings, "sceneEnvironment">): boolean {
  return settings.sceneEnvironment === "Road / Junction" || settings.sceneEnvironment === "Mixed Site";
}

export function sceneEnvironmentLabel(settings: Pick<RoadSceneSettings, "sceneEnvironment" | "roadLayout" | "groundSurface">): string {
  if (settings.sceneEnvironment === "Road / Junction") return settings.roadLayout;
  if (settings.sceneEnvironment === "Mixed Site") return `Mixed Site · ${settings.roadLayout}`;
  return `${settings.sceneEnvironment} · ${settings.groundSurface}`;
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

  /**
   * Effective collision mass used when a participant strikes this object.
   * The object remains investigator-positioned; very heavy values approximate
   * fixed infrastructure while light values absorb less participant momentum.
   */
  massKg?: number;

  collisionRadiusMetres: number;
  restitution: number;
  surfaceFrictionMultiplier: number;
  speedLossFactor: number;
  deflectionDegrees: number;

  /** V2 static contact geometry. */
  collisionShape?: PhysicsCollisionShape;
  lengthMetres?: number;
  widthMetres?: number;
  collisionFriction?: number;
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

  /** Assumed contact-duration range used only for transparent average-force estimates. */
  contactDurationMinimumMs: number;
  contactDurationMaximumMs: number;
}

export interface CollisionSetup {
  source: "Manual" | "Derived";
  confirmed: boolean;
  locked: boolean;
  toleranceMetres: number;
  confidence?: "High" | "Medium" | "Low";
  notes: string;
  lastCalculatedAt?: string;
}

export interface PhysicsVector2D {
  x: number;
  y: number;
}

export interface PhysicsForceRange {
  minimum: number;
  maximum: number;
}

export type CollisionKinematicOutcome =
  | "Stick"
  | "SlideTogether"
  | "Deflect"
  | "Ricochet"
  | "Stop";

export interface ParticipantCollisionKinematics {
  participantId: string;
  massKg: number;
  impactPosition: ReconstructionPosition;
  finalPosition: ReconstructionPosition;

  incomingVelocityMps: PhysicsVector2D;
  outgoingVelocityMps: PhysicsVector2D;
  incomingSpeedKmh: number;
  outgoingSpeedKmh: number;
  deltaVelocityMps: PhysicsVector2D;
  deltaVMetresPerSecond: number;

  momentumBeforeNs: PhysicsVector2D;
  momentumAfterNs: PhysicsVector2D;
  impulseNs: PhysicsVector2D;
  impulseMagnitudeNs: number;

  incomingTranslationalKineticEnergyKj: number;
  outgoingTranslationalKineticEnergyKj: number;
  incomingRotationalKineticEnergyKj: number;
  outgoingRotationalKineticEnergyKj: number;
  totalIncomingKineticEnergyKj: number;
  totalOutgoingKineticEnergyKj: number;

  postImpactTravelDistanceMetres: number;
  postImpactDisplacementMetres: number;
  timeToRestSeconds?: number;
  outcome: CollisionKinematicOutcome;
}

export interface CollisionKinematicsSummary {
  collisionEventId: string;
  timeSeconds: number;
  contactPoint: ReconstructionPosition;
  participantIds: string[];
  relativeImpactSpeedKmh: number;
  impactAngleDegrees: number;

  normalImpulseNs: number;
  frictionImpulseNs: number;
  totalImpulseNs: number;
  assumedContactDurationRangeMs: PhysicsForceRange;
  estimatedAverageForceRangeKn: PhysicsForceRange;

  totalIncomingTranslationalKineticEnergyKj: number;
  totalOutgoingTranslationalKineticEnergyKj: number;
  totalIncomingRotationalKineticEnergyKj: number;
  totalOutgoingRotationalKineticEnergyKj: number;
  totalIncomingKineticEnergyKj: number;
  totalOutgoingKineticEnergyKj: number;
  dissipatedKineticEnergyKj: number;
  solverEstimatedDissipatedEnergyKj: number;

  outcome: CollisionKinematicOutcome;
  participants: ParticipantCollisionKinematics[];
}

/*
 * [RoadSafe:CanonicalImpactResponseDataV1]
 *
 * One participant-specific, solver-derived impact record shared by 3D, AR,
 * reports and later visual-response controllers.
 */
export type ParticipantImpactResponseClass =
  | "Rigid Vehicle"
  | "Two Wheeler"
  | "Human Body";

export type ParticipantImpactContactZone =
  | "Front"
  | "Rear"
  | "Left Side"
  | "Right Side"
  | "Centre";

export interface ParticipantImpactResponse {
  schemaVersion:
    "RoadSafe Impact Response V1";

  collisionEventId: string;
  participantId: string;
  participantType:
    ReconstructionEntityType;

  timeSeconds: number;
  responseClass:
    ParticipantImpactResponseClass;

  contactPoint:
    ReconstructionPosition;

  impactPosition:
    ReconstructionPosition;

  contactZone:
    ParticipantImpactContactZone;

  /**
   * Collision-manifold normal directed toward this participant's response.
   */
  participantNormal:
    PhysicsVector2D;

  /**
   * Direction of the participant's complete normal + friction impulse.
   */
  impulseDirection:
    PhysicsVector2D;

  impulseNs:
    PhysicsVector2D;

  impulseMagnitudeNs: number;

  incomingVelocityMps:
    PhysicsVector2D;

  outgoingVelocityMps:
    PhysicsVector2D;

  deltaVelocityMps:
    PhysicsVector2D;

  deltaVMetresPerSecond: number;

  angularVelocityChangeDegreesPerSecond:
    number;

  outcome:
    CollisionKinematicOutcome;

  relativeImpactSpeedKmh: number;
  estimatedEnergyKj: number;
}

export interface PhysicsCollisionEvent {
  id: string;
  timeSeconds: number;
  type: "Participant-Participant" | "Participant-Object";
  participantIds: string[];
  sceneObjectId?: string;
  contactPoint: ReconstructionPosition;
  normal: ReconstructionPosition;
  relativeSpeedKmh: number;
  impactAngleDegrees: number;
  normalImpulseNs: number;
  frictionImpulseNs: number;
  totalImpulseNs: number;
  estimatedEnergyKj: number;
  estimatedAverageForceRangeKn: PhysicsForceRange;
  angularVelocityChangesDegPerSecond: Record<string, number>;

  /**
   * Optional for compatibility with reconstructions saved before Response V1.
   * Every newly calculated collision event supplies this array.
   */
  impactResponses?:
    ParticipantImpactResponse[];

  kinematics?: CollisionKinematicsSummary;
}

export interface PhysicsSimulationSummary {
  solverVersion: "RoadSafe Physics V2";
  ranAt: string;
  participantCollisions: number;
  primaryImpactTimeSeconds: number;
  estimatedImpactEnergyKj: number;
  solidObjectImpacts: number;
  potholeInteractions: number;
  surfaceInteractions: number;
  generatedPathPoints: number;
  simulatedDurationSeconds: number;
  collisionEvents: PhysicsCollisionEvent[];
  primaryCollisionKinematics?: CollisionKinematicsSummary;
  participantKinematics: ParticipantCollisionKinematics[];
  totalIncomingKineticEnergyKj: number;
  totalOutgoingKineticEnergyKj: number;
  totalDissipatedKineticEnergyKj: number;
  totalPostImpactTravelDistanceMetres: number;
  estimatedAverageForceRangeKn?: PhysicsForceRange;
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

/*
 * [RoadSafe:PhotoAssistedReconstructionV1]
 *
 * A photograph remains immutable source evidence. These records store the
 * investigator's explicit interpretation of a point visible in that image.
 * Only confirmed constraints may be applied to canonical reconstruction state.
 */
export type ScenePhotoConstraintKind =
  | "Primary Impact Point"
  | "Participant Path Point"
  | "Participant Heading"
  | "Scene Object Position"
  | "Evidence Position";

export type ScenePhotoConstraintStatus =
  | "Draft"
  | "Confirmed"
  | "Applied";

export type ScenePhotoConstraintConfidence =
  | "High"
  | "Medium"
  | "Low";

export interface ScenePhotoConstraint {
  id: string;
  photoId: string;
  kind: ScenePhotoConstraintKind;
  label: string;
  status: ScenePhotoConstraintStatus;
  confidence: ScenePhotoConstraintConfidence;

  /** Normalised 0..100 location selected directly on the source image. */
  imagePoint: ReconstructionPosition;

  /** Canonical 0..100 scene coordinate explicitly assigned by the investigator. */
  scenePosition: ReconstructionPosition;

  participantId?: string;
  pathPointId?: string;
  sceneObjectId?: string;
  evidenceId?: string;

  /** Used only when kind === "Participant Heading". */
  headingDegrees?: number;

  notes: string;
  createdAt: string;
  confirmedAt?: string;
  appliedAt?: string;

  /** Human-readable immutable audit note describing the applied canonical change. */
  applicationSummary?: string;
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

  /**
   * Investigator-confirmed interpretations derived from scene photographs.
   * Optional for compatibility with reconstructions saved before Photo V1.
   */
  photoConstraints?: ScenePhotoConstraint[];

  /** Real-world anchor retained even when no road geometry is generated. */
  siteCoordinate?: GeoCoordinate;

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
