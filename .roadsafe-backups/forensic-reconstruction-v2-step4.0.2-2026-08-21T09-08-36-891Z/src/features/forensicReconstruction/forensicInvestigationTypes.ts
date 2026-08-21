export type ForensicProvenance =
  | "Observed"
  | "Measured"
  | "Imported"
  | "Witness Reported"
  | "Calculated"
  | "AI Derived"
  | "Investigator Assumption"
  | "Simulated";

export type ForensicConfidence =
  | "Verified"
  | "High"
  | "Moderate"
  | "Low"
  | "Unverified";

export type EvidenceSource =
  | "Crime Scene"
  | "Vehicle"
  | "Victim"
  | "Witness"
  | "CCTV / Media"
  | "Laboratory"
  | "Other";

export type PhysicalEvidenceType =
  | "Skid Mark"
  | "Tyre Impression"
  | "Scuff Mark"
  | "Gouge / Road Mark"
  | "Debris"
  | "Broken Vehicle Part"
  | "Glass"
  | "Paint Chip / Transfer"
  | "Grease / Lubricant"
  | "Fluid"
  | "Dust / Dirt / Mud"
  | "Drag Mark"
  | "Personal Article"
  | "Vehicle Article"
  | "Fibre / Fabric"
  | "Hair"
  | "Biological Trace"
  | "Mechanical Condition"
  | "Vehicle Damage"
  | "Photograph"
  | "Sketch"
  | "Other";

export interface ForensicSpatialPosition {
  xMetres: number;
  yMetres: number;
  zMetres?: number;
  accuracyMetres?: number;
  datumLabel?: string;
}

export type MeasurementCategory =
  | "Distance"
  | "Length"
  | "Width"
  | "Height"
  | "Angle"
  | "Radius"
  | "Road / Lane"
  | "Vehicle Rest Position"
  | "Evidence Position"
  | "Skid / Scuff"
  | "Debris Field"
  | "Damage Height"
  | "Other";

export interface ForensicSceneIntake {
  location: string;
  accidentDate: string;
  accidentTime: string;
  weather: string;
  lighting: string;
  roadCondition: string;
  trafficControlState: string;
  roadGeometry: string;
  sceneDatumLabel: string;
  coordinateNotes: string;
  preservationNotes: string;
  lastUpdatedAt: string;
}

export interface ForensicEvidenceRecord {
  id: string;
  code: string;
  source: EvidenceSource;
  type: PhysicalEvidenceType;
  description: string;
  locationDescription: string;
  spatialPosition?: ForensicSpatialPosition;
  provenance: ForensicProvenance;
  confidence: ForensicConfidence;
  collected: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForensicMeasurementRecord {
  id: string;
  code: string;
  category: MeasurementCategory;
  label: string;
  value: number;
  unit: string;
  method: string;
  locationDescription: string;
  sourceEvidenceIds: string[];
  provenance: "Measured" | "Calculated" | "Imported";
  confidence: ForensicConfidence;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type VehicleInspectionStatus =
  | "Not examined"
  | "Initial scene check"
  | "Detailed examination completed"
  | "Awaiting specialist inspection";

export type VehicleDamageArea =
  | "Front"
  | "Front-left"
  | "Left side"
  | "Rear-left"
  | "Rear"
  | "Rear-right"
  | "Right side"
  | "Front-right"
  | "Roof"
  | "Underbody";

export type VehicleTraceType =
  | "Paint transfer"
  | "Glass"
  | "Fibre / fabric"
  | "Biological trace"
  | "Soil / mud"
  | "Grease / oil"
  | "Vehicle fragment"
  | "Other";

export interface ForensicVehicleDamagePhotoRef {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
  sha256?: string;
  damageArea?: VehicleDamageArea;
}

export interface ForensicVehicleExamination {
  id: string;
  code: string;
  label: string;
  registration: string;
  makeModel: string;
  vehicleType: string;
  inspectionStatus: VehicleInspectionStatus;
  scenePositionSummary: string;
  mechanicalFinding: string;
  damageAreas: VehicleDamageArea[];
  damageSeverity: string;
  damageDescription: string;
  damagePhotos: ForensicVehicleDamagePhotoRef[];
  traceTypes: VehicleTraceType[];
  traceNotes: string;
  sourceEvidenceIds: string[];
  provenance: ForensicProvenance;
  confidence: ForensicConfidence;
  createdAt: string;
  updatedAt: string;
}

export type PersonIdentityStatus =
  | "Identified"
  | "Identity not yet confirmed"
  | "Unknown person";

export type PersonInjuryArea =
  | "Head / face"
  | "Neck"
  | "Chest"
  | "Abdomen / pelvis"
  | "Back / spine"
  | "Left arm / hand"
  | "Right arm / hand"
  | "Left leg / foot"
  | "Right leg / foot"
  | "Multiple areas";

export interface ForensicPersonRecord {
  id: string;
  code: string;
  label: string;
  identityStatus: PersonIdentityStatus;
  fullName: string;
  identityNumber: string;
  licenceNumber: string;
  involvement: string;
  linkedVehicleId?: string;
  foundLocation: string;
  bodyPosition: string;
  spatialPosition?: ForensicSpatialPosition;
  observedCondition: string;
  injurySeriousness: string;
  injuryAreas: PersonInjuryArea[];
  protectionObserved: string;
  nextAction: string;
  sourceEvidenceIds: string[];
  provenance: ForensicProvenance;
  confidence: ForensicConfidence;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForensicAccidentInvestigation {
  version: 2;
  id: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  investigatingOfficer: string;
  policeStation: string;
  scene: ForensicSceneIntake;
  evidence: ForensicEvidenceRecord[];
  measurements: ForensicMeasurementRecord[];
  vehicles: ForensicVehicleExamination[];
  persons: ForensicPersonRecord[];
  createdAt: string;
  updatedAt: string;
}

export const FORENSIC_PROVENANCE_OPTIONS: ForensicProvenance[] = [
  "Observed",
  "Measured",
  "Imported",
  "Witness Reported",
  "Calculated",
  "AI Derived",
  "Investigator Assumption",
  "Simulated",
];

export const FORENSIC_CONFIDENCE_OPTIONS: ForensicConfidence[] = [
  "Verified",
  "High",
  "Moderate",
  "Low",
  "Unverified",
];

export const EVIDENCE_SOURCE_OPTIONS: EvidenceSource[] = [
  "Crime Scene",
  "Vehicle",
  "Victim",
  "Witness",
  "CCTV / Media",
  "Laboratory",
  "Other",
];

export const PHYSICAL_EVIDENCE_TYPE_OPTIONS: PhysicalEvidenceType[] = [
  "Skid Mark",
  "Tyre Impression",
  "Scuff Mark",
  "Gouge / Road Mark",
  "Debris",
  "Broken Vehicle Part",
  "Glass",
  "Paint Chip / Transfer",
  "Grease / Lubricant",
  "Fluid",
  "Dust / Dirt / Mud",
  "Drag Mark",
  "Personal Article",
  "Vehicle Article",
  "Fibre / Fabric",
  "Hair",
  "Biological Trace",
  "Mechanical Condition",
  "Vehicle Damage",
  "Photograph",
  "Sketch",
  "Other",
];


export const MEASUREMENT_CATEGORY_OPTIONS: MeasurementCategory[] = [
  "Distance",
  "Length",
  "Width",
  "Height",
  "Angle",
  "Radius",
  "Road / Lane",
  "Vehicle Rest Position",
  "Evidence Position",
  "Skid / Scuff",
  "Debris Field",
  "Damage Height",
  "Other",
];

export const MEASUREMENT_UNIT_OPTIONS = [
  "m",
  "cm",
  "mm",
  "degrees",
  "km/h",
  "s",
  "N",
  "kg",
  "other",
] as const;

export const VEHICLE_TYPE_OPTIONS = [
  "Passenger car / sedan",
  "SUV / crossover",
  "Pickup / light truck",
  "Van / minibus",
  "Bus / coach",
  "Heavy truck",
  "Motorcycle",
  "Bicycle",
  "Emergency vehicle",
  "Agricultural / construction vehicle",
] as const;

export const VEHICLE_INSPECTION_STATUS_OPTIONS: VehicleInspectionStatus[] = [
  "Not examined",
  "Initial scene check",
  "Detailed examination completed",
  "Awaiting specialist inspection",
];

export const VEHICLE_SCENE_POSITION_OPTIONS = [
  "Stopped in traffic lane",
  "Stopped partly in traffic lane",
  "On road shoulder",
  "Off the carriageway",
  "Inside junction / intersection",
  "Against roadside object / barrier",
  "Moved before examination",
  "Towed before examination",
  "Position unknown",
] as const;

export const VEHICLE_MECHANICAL_FINDING_OPTIONS = [
  "No obvious pre-crash defect observed",
  "Tyre defect / damage suspected",
  "Brake defect suspected",
  "Steering defect suspected",
  "Lighting defect suspected",
  "Suspension defect suspected",
  "Mechanical condition could not be established",
  "Specialist mechanical examination required",
] as const;

export const VEHICLE_DAMAGE_AREA_OPTIONS: VehicleDamageArea[] = [
  "Front",
  "Front-left",
  "Left side",
  "Rear-left",
  "Rear",
  "Rear-right",
  "Right side",
  "Front-right",
  "Roof",
  "Underbody",
];

export const VEHICLE_DAMAGE_SEVERITY_OPTIONS = [
  "No visible damage",
  "Minor",
  "Moderate",
  "Severe",
  "Extensive / major deformation",
  "Not yet assessed",
] as const;

export const VEHICLE_TRACE_TYPE_OPTIONS: VehicleTraceType[] = [
  "Paint transfer",
  "Glass",
  "Fibre / fabric",
  "Biological trace",
  "Soil / mud",
  "Grease / oil",
  "Vehicle fragment",
  "Other",
];

export const PERSON_IDENTITY_STATUS_OPTIONS: PersonIdentityStatus[] = [
  "Identified",
  "Identity not yet confirmed",
  "Unknown person",
];

export const PERSON_INVOLVEMENT_OPTIONS = [
  "Driver",
  "Front-seat passenger",
  "Rear-seat passenger",
  "Other vehicle occupant",
  "Pedestrian",
  "Cyclist",
  "Motorcyclist",
  "Pillion / motorcycle passenger",
  "Person struck while outside vehicle",
  "Emergency responder involved in crash",
] as const;

export const PERSON_FOUND_LOCATION_OPTIONS = [
  "Inside vehicle - driver seat",
  "Inside vehicle - front passenger seat",
  "Inside vehicle - rear seat",
  "Inside vehicle - other / unclear seat",
  "On carriageway / traffic lane",
  "On road shoulder",
  "On sidewalk / pedestrian area",
  "Off the carriageway",
  "Against roadside object / barrier",
  "Moved before position was recorded",
  "Already removed from scene",
  "Position unknown",
] as const;

export const PERSON_BODY_POSITION_OPTIONS = [
  "Seated in vehicle",
  "Trapped in vehicle",
  "Standing / walking",
  "Sitting on ground",
  "Lying on back",
  "Lying face-down",
  "Lying on left side",
  "Lying on right side",
  "Position changed before recording",
  "Not established",
] as const;

export const PERSON_OBSERVED_CONDITION_OPTIONS = [
  "Walking / responsive",
  "Conscious but visibly injured",
  "Disoriented / confused",
  "Unconscious / unresponsive",
  "Trapped / unable to leave position",
  "No obvious injury observed",
  "Already receiving medical care",
  "Already removed before police assessment",
  "Condition not established",
] as const;

export const PERSON_INJURY_SERIOUSNESS_OPTIONS = [
  "No visible injury",
  "Minor / suspected minor injury",
  "Serious / suspected serious injury",
  "Fatality confirmed by authorised source",
  "Not yet established",
] as const;

export const PERSON_INJURY_AREA_OPTIONS: PersonInjuryArea[] = [
  "Head / face",
  "Neck",
  "Chest",
  "Abdomen / pelvis",
  "Back / spine",
  "Left arm / hand",
  "Right arm / hand",
  "Left leg / foot",
  "Right leg / foot",
  "Multiple areas",
];

export const PERSON_PROTECTION_OPTIONS = [
  "Seat belt fastened",
  "Seat belt not fastened",
  "Helmet worn",
  "Helmet not worn",
  "Child restraint used",
  "Not applicable",
  "Could not determine",
] as const;

export const PERSON_NEXT_ACTION_OPTIONS = [
  "Remained at scene",
  "Transported by ambulance",
  "Transported by private vehicle",
  "Taken to hospital - method unknown",
  "Released / left scene after assessment",
  "Remained for authorised removal",
  "Already removed before police arrival",
  "Not established",
] as const;

