export type ForensicReportStatus =
  | "Draft"
  | "Ready for review"
  | "Final";

export interface ForensicReportRecord {
  id: string;
  code: string;
  caseId: string;
  caseNumber: string;
  title: string;
  executiveSummary: string;
  methodologySummary: string;
  conclusion: string;
  recommendations: string[];
  preparedBy: string;
  reviewedBy: string;
  status: ForensicReportStatus;
  declarationAccepted: boolean;
  includedFindingIds: string[];
  createdAt: string;
  updatedAt: string;
  finalisedAt?: string;
}

export interface ForensicReportSnapshot {
  report: ForensicReportRecord;
  generatedAt: string;
  case: {
    caseId: string;
    caseNumber: string;
    caseTitle: string;
    investigatingOfficer: string;
    policeStation: string;
    location: string;
    accidentDate: string;
    accidentTime: string;
  };
  sourceCounts: {
    evidence: number;
    measurements: number;
    vehicles: number;
    persons: number;
    witnesses: number;
    analysisFindings: number;
    hypotheses: number;
    simulationRuns: number;
    reportFindings: number;
  };
  canonicalLineage?: {
    hypothesisCode: string;
    simulationRunCode: string;
    reconstructionId: string;
    provenance: "Simulated";
    updatedAt: string;
  };
  findings: Array<{
    code: string;
    category: string;
    statement: string;
    disposition: string;
    confidence: string;
    provenance: string;
    rationale: string;
    limitations: string[];
    unresolvedQuestions: string[];
    sourceSummary: string[];
  }>;
  unresolvedQuestions: string[];
  limitations: string[];
}
