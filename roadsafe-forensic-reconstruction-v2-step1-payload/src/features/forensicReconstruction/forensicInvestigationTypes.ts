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

export interface ForensicSceneIntake {
  location: string;
  accidentDate: string;
  accidentTime: string;
  weather: string;
  lighting: string;
  roadCondition: string;
  trafficControlState: string;
  roadGeometry: string;
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
  provenance: ForensicProvenance;
  confidence: ForensicConfidence;
  collected: boolean;
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
