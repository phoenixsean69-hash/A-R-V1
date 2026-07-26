import type { RoadLayoutDetection } from "./roadLayoutDetection";
import type { GeoCoordinate } from "./fieldPlacement";

export type AccidentCaseStatus =
  | "Open"
  | "Under Investigation"
  | "Reconstruction Complete"
  | "Closed"
  | "Archived";

export type AccidentCaseReviewStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "approved";

export type AccidentCaseCloudSyncState =
  | "local"
  | "pending"
  | "synced"
  | "error";

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

  /**
   * Shared Appwrite case metadata.
   *
   * These fields are optional so older local RoadSafe cases continue to open
   * before they are imported into the station database.
   */
  stationTeamId?: string;
  createdByUserId?: string;
  assignedOfficerUserId?: string;
  assignedSupervisorUserId?: string;
  reviewStatus?: AccidentCaseReviewStatus;
  cloudVersion?: number;
  cloudSyncedAt?: string;
  cloudSyncState?: AccidentCaseCloudSyncState;
  cloudSyncError?: string;
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
