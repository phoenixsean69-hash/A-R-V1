import type { ForensicConfidence } from "./forensicInvestigationTypes";

export type SimulationRunStatus =
  | "Completed"
  | "Completed with warnings"
  | "Invalid inputs";

export interface ForensicSimulationParticipantInput {
  id: string;
  sourceVehicleId?: string;
  sourcePersonId?: string;
  label: string;
  massKg: number;
  startXMetres: number;
  startYMetres: number;
  speedKmh: number;
  headingDegrees: number;
  collisionRadiusMetres: number;
  brakingEnabled: boolean;
  reactionTimeSeconds: number;
  frictionCoefficient: number;
}

export interface ForensicSimulationInput {
  caseId: string;
  caseNumber: string;
  hypothesisId: string;
  hypothesisCode: string;
  hypothesisTitle: string;
  durationSeconds: number;
  timestepSeconds: number;
  restitutionCoefficient: number;
  gravityMetresPerSecondSquared: number;
  participants: ForensicSimulationParticipantInput[];
  notes: string;
}

export interface ForensicSimulationParticipantMetric {
  participantId: string;
  label: string;
  initialSpeedMetresPerSecond: number;
  initialMomentumKgMetresPerSecond: number;
  initialKineticEnergyJoules: number;
  reactionDistanceMetres: number;
  theoreticalBrakingDistanceMetres?: number;
  theoreticalStoppingDistanceMetres?: number;
  finalSpeedMetresPerSecond: number;
  finalXMetres: number;
  finalYMetres: number;
  enteredProposedImpactRegion: boolean;
}

export interface ForensicSimulationFrameParticipant {
  participantId: string;
  xMetres: number;
  yMetres: number;
  speedMetresPerSecond: number;
}

export interface ForensicSimulationFrame {
  timeSeconds: number;
  participants: ForensicSimulationFrameParticipant[];
}

export interface ForensicSimulationContactEvent {
  id: string;
  timeSeconds: number;
  participantAId: string;
  participantBId: string;
  participantALabel: string;
  participantBLabel: string;
  xMetres: number;
  yMetres: number;
  relativeSpeedMetresPerSecond: number;
  insideProposedImpactRegion: boolean;
}

export interface ForensicSimulationRun {
  id: string;
  code: string;
  caseId: string;
  caseNumber: string;
  hypothesisId: string;
  hypothesisCode: string;
  hypothesisTitle: string;
  provenance: "Simulated";
  confidence: ForensicConfidence;
  status: SimulationRunStatus;
  input: ForensicSimulationInput;
  participantMetrics: ForensicSimulationParticipantMetric[];
  frames: ForensicSimulationFrame[];
  contacts: ForensicSimulationContactEvent[];
  warnings: string[];
  formulas: string[];
  createdAt: string;
}
