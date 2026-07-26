import type { AccidentCase } from "./accidentCase";
import type { RoadSafeRole } from "./auth";

export type CaseCloudEventType =
  | "case_created"
  | "case_updated"
  | "location_confirmed"
  | "road_geometry_detected"
  | "scene_generated"
  | "evidence_added"
  | "evidence_removed"
  | "reconstruction_started"
  | "reconstruction_saved"
  | "footage_recorded"
  | "case_submitted"
  | "changes_requested"
  | "comment_added"
  | "case_approved"
  | "case_closed"
  | "case_archived"
  | "officer_assigned"
  | "supervisor_assigned"
  | "status_changed";

export interface CaseCloudSession {
  teamId: string;
  userId: string;
  role: Exclude<RoadSafeRole, "unassigned">;
}

export interface CaseFunctionResponse {
  ok: boolean;
  message?: string;
  case?: AccidentCase;
  cases?: AccidentCase[];
  importedCases?: AccidentCase[];
  importedCount?: number;
  skippedCount?: number;
  skippedCaseNumbers?: string[];
}

export interface CaseCloudRecordEventDetail {
  record: AccidentCase;
}

export interface CaseCloudErrorEventDetail {
  caseId?: string;
  message: string;
}

export interface CaseCloudPendingEventDetail {
  caseId?: string;
}
