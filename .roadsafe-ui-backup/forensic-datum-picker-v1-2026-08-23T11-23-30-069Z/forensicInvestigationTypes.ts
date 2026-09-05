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

export type VehicleRegistryCheckStatus =
  | "Vehicle found / active"
  | "Vehicle found / inactive"
  | "Not found"
  | "Registry unavailable"
  | "Check failed";

export type VehicleRegistryCheckSource =
  | "Official registry gateway"
  | "Demo registry";

export interface ForensicVehicleRegistryCheck {
  provider: "CVR / ZIMTIS";
  source: VehicleRegistryCheckSource;
  status: VehicleRegistryCheckStatus;
  checkedAt: string;
  checkedBy: string;
  purpose: "Road traffic accident investigation";
  queriedRegistration: string;
  registryReference?: string;
  matchedRegistration?: string;
  makeModel?: string;
  vehicleClass?: string;
  registrationStatus?: string;
  registeredOwnerName?: string;
  registeredOwnerIdentityNumber?: string;
  registeredOwnerIdentityMasked?: string;
  registeredOwnerType?: "Individual" | "Organisation" | "Unknown";
  message: string;
}

export type DriverCandidateStatus =
  | "Possible driver — not confirmed";

export type DriverRegistryCheckStatus =
  | "Registered / valid"
  | "Registered / expired"
  | "Suspended / disqualified"
  | "Not found"
  | "Identity mismatch"
  | "Registry unavailable"
  | "Check failed";

export type DriverRegistryCheckSource =
  | "Official registry gateway"
  | "Demo registry";

export interface ForensicDriverRegistryCheck {
  provider: "CVR / ZIMTIS";
  source: DriverRegistryCheckSource;
  status: DriverRegistryCheckStatus;
  checkedAt: string;
  checkedBy: string;
  purpose: "Road traffic accident investigation";
  queriedLicenceNumber: string;
  queriedIdentityMasked: string;
  registryReference?: string;
  matchedFullName?: string;
  matchedLicenceNumber?: string;
  licenceCodes: string[];
  issueDate?: string;
  expiryDate?: string;
  penaltyPoints?: number;
  restrictionSummary?: string;
  message: string;
}

export interface ForensicPersonRecord {
  id: string;
  code: string;
  label: string;
  identityStatus: PersonIdentityStatus;
  fullName: string;
  identityNumber: string;
  licenceNumber: string;
  vehicleRegistryCheck?: ForensicVehicleRegistryCheck;
  driverRegistryCheck?: ForensicDriverRegistryCheck;
  driverCandidateStatus?: DriverCandidateStatus;
  driverCandidateSource?: "Registered vehicle owner";
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

export type WitnessIdentityStatus =
  | "Identified"
  | "Identity not yet confirmed"
  | "Unknown witness";

export type WitnessObservationTopic =
  | "Vehicle identity / registration"
  | "Driver identity"
  | "Direction of travel"
  | "Lane / road position"
  | "Traffic signal / sign state"
  | "Braking / skid / evasive action"
  | "Speed impression"
  | "Horn / sound / warning"
  | "Collision point / area"
  | "Pedestrian / cyclist movement"
  | "Post-impact movement"
  | "Vehicle / person leaving scene"
  | "Road / weather / lighting condition"
  | "Other";

export interface ForensicWitnessRecord {
  id: string;
  code: string;
  label: string;
  identityStatus: WitnessIdentityStatus;
  fullName: string;
  contactDetails: string;
  linkedPersonId?: string;
  relationshipToCrash: string;
  statementDate: string;
  statementTime: string;
  statementMethod: string;
  observationCoverage: string;
  observationLocation: string;
  spatialPosition?: ForensicSpatialPosition;
  viewCondition: string;
  approximateDistanceMetres?: number;
  observationTopics: WitnessObservationTopic[];
  statementSummary: string;
  sourceEvidenceIds: string[];
  assessmentStatus: string;
  assessmentNotes: string;
  provenance: "Witness Reported";
  confidence: ForensicConfidence;
  createdAt: string;
  updatedAt: string;
}

export type AnalysisFindingStatus =
  | "Supported by current evidence"
  | "Partly supported"
  | "Conflicting evidence"
  | "Insufficient evidence"
  | "Requires specialist review"
  | "Not yet assessed";

export type AnalysisOrigin =
  | "Investigator analysis"
  | "Calculated"
  | "Imported specialist finding"
  | "AI Derived";

export type AnalysisLimitation =
  | "Missing physical evidence"
  | "Missing measurement"
  | "Conflicting witness accounts"
  | "Limited CCTV / media"
  | "Scene altered before documentation"
  | "Vehicle moved before examination"
  | "Person moved / removed before recording"
  | "Driver / person identity not confirmed"
  | "Specialist / laboratory result pending"
  | "Measurement uncertainty"
  | "Other";

export interface ForensicAnalysisFinding {
  id: string;
  code: string;
  category: string;
  method: string;
  finding: string;
  status: AnalysisFindingStatus;
  usesSceneIntake: boolean;
  sourceEvidenceIds: string[];
  sourceMeasurementIds: string[];
  sourceVehicleIds: string[];
  sourcePersonIds: string[];
  sourceWitnessIds: string[];
  limitations: AnalysisLimitation[];
  limitationNotes: string;
  followUpAction: string;
  origin: AnalysisOrigin;
  confidence: ForensicConfidence;
  createdAt: string;
  updatedAt: string;
}

export type HypothesisStatus =
  | "Draft"
  | "Under review"
  | "Ready for simulation"
  | "Rejected"
  | "Superseded";

export interface ForensicHypothesisImpactRegion {
  xMetres: number;
  yMetres: number;
  radiusMetres: number;
  description: string;
}

export interface ForensicHypothesisEvent {
  id: string;
  order: number;
  description: string;
}

export interface ForensicCrashHypothesis {
  id: string;
  code: string;
  title: string;
  summary: string;
  status: HypothesisStatus;
  confidence: ForensicConfidence;
  provenance: "Investigator Assumption";
  supportingFindingIds: string[];
  conflictingFindingIds: string[];
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  sourceMeasurementIds: string[];
  sourceVehicleIds: string[];
  sourcePersonIds: string[];
  sourceWitnessIds: string[];
  assumptions: string[];
  missingEvidence: string[];
  impactRegion?: ForensicHypothesisImpactRegion;
  eventSequence: ForensicHypothesisEvent[];
  selectedForSimulation: boolean;
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
  witnesses: ForensicWitnessRecord[];
  analysisFindings: ForensicAnalysisFinding[];
  hypotheses: ForensicCrashHypothesis[];
  createdAt: string;
  updatedAt: string;
}

export const HYPOTHESIS_STATUS_OPTIONS: HypothesisStatus[] = [
  "Draft",
  "Under review",
  "Ready for simulation",
  "Rejected",
  "Superseded",
];

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

export const WITNESS_IDENTITY_STATUS_OPTIONS: WitnessIdentityStatus[] = [
  "Identified",
  "Identity not yet confirmed",
  "Unknown witness",
];

export const WITNESS_RELATIONSHIP_OPTIONS = [
  "Independent bystander",
  "Nearby resident / business staff",
  "Driver involved in crash",
  "Passenger / vehicle occupant involved",
  "Pedestrian / cyclist involved",
  "Police / first responder",
  "Road worker / security staff",
] as const;

export const WITNESS_STATEMENT_METHOD_OPTIONS = [
  "Written and signed statement",
  "Audio-recorded interview",
  "Video-recorded interview",
  "Officer contemporaneous notes",
  "Verbal account - not signed",
  "Telephone / remote statement",
] as const;

export const WITNESS_OBSERVATION_COVERAGE_OPTIONS = [
  "Saw events before and through impact",
  "Saw impact only",
  "Saw events before impact but lost view at impact",
  "Saw post-impact movement / aftermath only",
  "Heard collision but did not see impact",
  "Saw only part of the sequence",
  "Timing / coverage unclear",
] as const;

export const WITNESS_VIEW_CONDITION_OPTIONS = [
  "Clear / unobstructed view",
  "Partly obstructed view",
  "Heavily obstructed view",
  "Viewed through vehicle / window / building",
  "Night / low-light limited view",
  "Weather limited view",
  "View position not established",
] as const;

export const WITNESS_ASSESSMENT_STATUS_OPTIONS = [
  "Not yet assessed",
  "Broadly consistent with physical evidence",
  "Partly consistent with physical evidence",
  "Conflicts with physical evidence",
  "Conflicts with another witness account",
  "Requires follow-up / clarification",
] as const;

export const WITNESS_OBSERVATION_TOPIC_OPTIONS: WitnessObservationTopic[] = [
  "Vehicle identity / registration",
  "Driver identity",
  "Direction of travel",
  "Lane / road position",
  "Traffic signal / sign state",
  "Braking / skid / evasive action",
  "Speed impression",
  "Horn / sound / warning",
  "Collision point / area",
  "Pedestrian / cyclist movement",
  "Post-impact movement",
  "Vehicle / person leaving scene",
  "Road / weather / lighting condition",
  "Other",
];

export const ANALYSIS_CATEGORY_OPTIONS = [
  "Collision / impact area",
  "Vehicle movement / path",
  "Speed / braking",
  "Driver / person identity",
  "Visibility / perception",
  "Road / environment",
  "Vehicle mechanical condition",
  "Damage / trace correlation",
  "Witness consistency",
  "Event timing / sequence",
  "Avoidability / response opportunity",
] as const;

export const ANALYSIS_METHOD_OPTIONS = [
  "Evidence correlation",
  "Investigator review",
  "Measurement / calculation",
  "CCTV / video review",
  "Vehicle damage comparison",
  "Trace / transfer comparison",
  "Witness consistency review",
  "Driver / vehicle registry review",
  "Specialist / laboratory report",
  "AI-assisted evidence review",
] as const;

export const ANALYSIS_STATUS_OPTIONS: AnalysisFindingStatus[] = [
  "Supported by current evidence",
  "Partly supported",
  "Conflicting evidence",
  "Insufficient evidence",
  "Requires specialist review",
  "Not yet assessed",
];

export const ANALYSIS_ORIGIN_OPTIONS: AnalysisOrigin[] = [
  "Investigator analysis",
  "Calculated",
  "Imported specialist finding",
  "AI Derived",
];

export const ANALYSIS_LIMITATION_OPTIONS: AnalysisLimitation[] = [
  "Missing physical evidence",
  "Missing measurement",
  "Conflicting witness accounts",
  "Limited CCTV / media",
  "Scene altered before documentation",
  "Vehicle moved before examination",
  "Person moved / removed before recording",
  "Driver / person identity not confirmed",
  "Specialist / laboratory result pending",
  "Measurement uncertainty",
  "Other",
];

export const ANALYSIS_FOLLOW_UP_OPTIONS = [
  "No further action identified",
  "Collect additional scene evidence",
  "Obtain / review CCTV or video",
  "Re-interview witness",
  "Obtain specialist vehicle examination",
  "Obtain laboratory comparison",
  "Confirm driver / person identity",
  "Obtain additional measurements",
  "Revisit scene / verify position",
] as const;
