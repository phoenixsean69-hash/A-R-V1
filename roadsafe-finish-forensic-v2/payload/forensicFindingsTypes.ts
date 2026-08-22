import type { ForensicConfidence } from "./forensicInvestigationTypes";

export type ForensicFindingCategory =
  | "Crash sequence"
  | "Impact / contact"
  | "Speed / kinematics"
  | "Vehicle condition"
  | "Road / environment"
  | "Driver / person factors"
  | "Witness / media consistency"
  | "Identity / involvement"
  | "Post-impact movement"
  | "Other";

export type ForensicFindingDisposition =
  | "Supported"
  | "Partly supported"
  | "Inconclusive"
  | "Contradicted"
  | "Deferred";

export type ForensicFindingReviewStatus =
  | "Draft"
  | "Ready for report"
  | "Excluded from report";

export type ForensicFindingProvenance =
  | "Calculated"
  | "AI Derived"
  | "Investigator Assumption"
  | "Simulated";

export interface ForensicFinalFinding {
  id: string;
  code: string;
  caseId: string;
  category: ForensicFindingCategory;
  statement: string;
  disposition: ForensicFindingDisposition;
  confidence: ForensicConfidence;
  provenance: ForensicFindingProvenance;
  rationale: string;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  supportingAnalysisFindingIds: string[];
  conflictingAnalysisFindingIds: string[];
  sourceMeasurementIds: string[];
  sourceHypothesisIds: string[];
  sourceSimulationRunIds: string[];
  canonicalReconstructionId?: string;
  limitations: string[];
  unresolvedQuestions: string[];
  reviewStatus: ForensicFindingReviewStatus;
  includeInReport: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FORENSIC_FINDING_CATEGORY_OPTIONS: ForensicFindingCategory[] = [
  "Crash sequence",
  "Impact / contact",
  "Speed / kinematics",
  "Vehicle condition",
  "Road / environment",
  "Driver / person factors",
  "Witness / media consistency",
  "Identity / involvement",
  "Post-impact movement",
  "Other",
];

export const FORENSIC_FINDING_DISPOSITION_OPTIONS: ForensicFindingDisposition[] = [
  "Supported",
  "Partly supported",
  "Inconclusive",
  "Contradicted",
  "Deferred",
];

export const FORENSIC_FINDING_REVIEW_STATUS_OPTIONS: ForensicFindingReviewStatus[] = [
  "Draft",
  "Ready for report",
  "Excluded from report",
];

export const FORENSIC_FINDING_PROVENANCE_OPTIONS: ForensicFindingProvenance[] = [
  "Calculated",
  "AI Derived",
  "Investigator Assumption",
  "Simulated",
];
