export type ForensicReportStatus = "Draft" | "Ready for review" | "Final";

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
  declarationAccepted: boolean;
  status: ForensicReportStatus;
  createdAt: string;
  updatedAt: string;
  finalisedAt?: string;
}
