import type { RoadLayoutDetection } from "./roadLayoutDetection";
import type { GeoCoordinate } from "./fieldPlacement";

export type AccidentCaseStatus =
  | "Open"
  | "Under Investigation"
  | "Reconstruction Complete"
  | "Closed"
  | "Archived";

export interface AccidentCase {
  id: string;
  caseNumber: string;
  title: string;
  accidentDate: string;
  accidentTime: string;
  location: string;
  junctionId?: string;
  investigatingOfficer: string;
  policeStation: string;
  status: AccidentCaseStatus;
  reconstructionId?: string;
  roadLayoutDetection?: RoadLayoutDetection;
  siteCoordinate?: GeoCoordinate;
  footageIds: string[];
  primaryFootageId?: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccidentCaseFormValues {
  caseNumber: string;
  title: string;
  accidentDate: string;
  accidentTime: string;
  location: string;
  junctionId: string;
  investigatingOfficer: string;
  policeStation: string;
  status: AccidentCaseStatus;
  summary: string;
}

export interface AccidentCaseStats {
  hasReconstruction: boolean;
  participantCount: number;
  movementPointCount: number;
  evidenceCount: number;
  measurementCount: number;
  photoCount: number;
  sceneObjectCount: number;
  timelineEventCount: number;
  footageCount: number;
  reconstructionStatus: "Not Created" | "Draft" | "Completed";
  reconstructionLastSavedAt?: string;
}

export type CaseCompletionCheckKey =
  | "case-information"
  | "participants"
  | "participant-routes"
  | "accident-sequence"
  | "collision-event"
  | "evidence"
  | "reconstruction-saved";

export interface CaseCompletionCheck {
  key: CaseCompletionCheckKey;
  label: string;
  complete: boolean;
  detail: string;
}

export interface AccidentCaseCompletion {
  complete: boolean;
  completedCount: number;
  totalCount: number;
  percentage: number;
  checks: CaseCompletionCheck[];
}

export interface CaseStatusUpdateResult {
  record: AccidentCase;
  completion: AccidentCaseCompletion;
  blocked: boolean;
  message?: string;
}

export const ACCIDENT_CASE_STATUSES: AccidentCaseStatus[] = [
  "Open",
  "Under Investigation",
  "Reconstruction Complete",
  "Closed",
  "Archived",
];
