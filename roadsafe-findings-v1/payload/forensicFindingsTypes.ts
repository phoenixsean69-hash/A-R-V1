import type {
  ForensicConfidence,
  ForensicProvenance,
} from "./forensicInvestigationTypes";

export type FinalFindingCategory =
  | "Crash sequence"
  | "Impact area / contact"
  | "Speed / kinematics"
  | "Vehicle condition"
  | "Road / environment"
  | "Driver / person factors"
  | "Witness / media consistency"
  | "Identity / involvement"
  | "Post-impact movement"
  | "Other";

export type FinalFindingDisposition =
  | "Supported"
  | "Partly supported"
  | "Inconclusive"
  | "Contradicted"
  | "Deferred";

export type FinalFindingReviewStatus =
  | "Draft"
  | "Ready for report"
  | "Excluded from report";

export type FinalFindingDerivedProvenance = Extract<
  ForensicProvenance,
  "Calculated" | "Imported" | "AI Derived" | "Investigator Assumption"
>;

export interface ForensicFinalFinding {
  id: string;
  code: string;
  caseId: string;
  caseNumber: string;
  category: FinalFindingCategory;
  statement: string;
  disposition: FinalFindingDisposition;
  confidence: ForensicConfidence;
  provenance: FinalFindingDerivedProvenance;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  supportingAnalysisFindingIds: string[];
  conflictingAnalysisFindingIds: string[];
  sourceMeasurementIds: string[];
  sourceHypothesisIds: string[];
  sourceSimulationRunIds: string[];
  canonicalReconstructionId?: string;
  rationale: string;
  limitations: string[];
  unresolvedQuestions: string[];
  reviewStatus: FinalFindingReviewStatus;
  includeInReport: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FINAL_FINDING_CATEGORY_OPTIONS: FinalFindingCategory[] = [
  "Crash sequence",
  "Impact area / contact",
  "Speed / kinematics",
  "Vehicle condition",
  "Road / environment",
  "Driver / person factors",
  "Witness / media consistency",
  "Identity / involvement",
  "Post-impact movement",
  "Other",
];

export const FINAL_FINDING_DISPOSITION_OPTIONS: FinalFindingDisposition[] = [
  "Supported",
  "Partly supported",
  "Inconclusive",
  "Contradicted",
  "Deferred",
];

export const FINAL_FINDING_REVIEW_STATUS_OPTIONS: FinalFindingReviewStatus[] = [
  "Draft",
  "Ready for report",
  "Excluded from report",
];

export const FINAL_FINDING_PROVENANCE_OPTIONS: FinalFindingDerivedProvenance[] = [
  "Investigator Assumption",
  "Calculated",
  "Imported",
  "AI Derived",
];
