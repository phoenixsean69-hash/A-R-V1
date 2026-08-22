import type {
  ForensicFinalFinding,
  FinalFindingReviewStatus,
} from "./forensicFindingsTypes";

const STORAGE_KEY = "roadsafe-forensic-final-findings-v1";

function readAll(): ForensicFinalFinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ForensicFinalFinding[];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((finding) => ({
      ...finding,
      supportingEvidenceIds: Array.isArray(finding.supportingEvidenceIds)
        ? finding.supportingEvidenceIds
        : [],
      conflictingEvidenceIds: Array.isArray(finding.conflictingEvidenceIds)
        ? finding.conflictingEvidenceIds
        : [],
      supportingAnalysisFindingIds: Array.isArray(finding.supportingAnalysisFindingIds)
        ? finding.supportingAnalysisFindingIds
        : [],
      conflictingAnalysisFindingIds: Array.isArray(finding.conflictingAnalysisFindingIds)
        ? finding.conflictingAnalysisFindingIds
        : [],
      sourceMeasurementIds: Array.isArray(finding.sourceMeasurementIds)
        ? finding.sourceMeasurementIds
        : [],
      sourceHypothesisIds: Array.isArray(finding.sourceHypothesisIds)
        ? finding.sourceHypothesisIds
        : [],
      sourceSimulationRunIds: Array.isArray(finding.sourceSimulationRunIds)
        ? finding.sourceSimulationRunIds
        : [],
      limitations: Array.isArray(finding.limitations) ? finding.limitations : [],
      unresolvedQuestions: Array.isArray(finding.unresolvedQuestions)
        ? finding.unresolvedQuestions
        : [],
      includeInReport: Boolean(finding.includeInReport),
    }));
  } catch (error) {
    console.error("Failed to read forensic final findings:", error);
    return [];
  }
}

function writeAll(findings: ForensicFinalFinding[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(findings));
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextCode(caseId: string): string {
  const highest = readAll()
    .filter((finding) => finding.caseId === caseId)
    .reduce((current, finding) => {
      const match = /^F-(\\d+)$/i.exec(finding.code);
      if (!match) return current;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(current, value) : current;
    }, 0);

  return `F-${String(highest + 1).padStart(3, "0")}`;
}

export const ForensicFindingsService = {
  getByCaseId(caseId: string): ForensicFinalFinding[] {
    return readAll()
      .filter((finding) => finding.caseId === caseId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  add(
    input: Omit<ForensicFinalFinding, "id" | "code" | "createdAt" | "updatedAt">,
  ): ForensicFinalFinding {
    const now = new Date().toISOString();
    const finding: ForensicFinalFinding = {
      ...input,
      id: createId("final-finding"),
      code: nextCode(input.caseId),
      createdAt: now,
      updatedAt: now,
    };

    writeAll([...readAll(), finding]);
    return finding;
  },

  update(
    findingId: string,
    patch: Partial<
      Omit<ForensicFinalFinding, "id" | "code" | "caseId" | "caseNumber" | "createdAt">
    >,
  ): ForensicFinalFinding | null {
    const all = readAll();
    let updated: ForensicFinalFinding | null = null;

    const next = all.map((finding) => {
      if (finding.id !== findingId) return finding;

      updated = {
        ...finding,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      return updated;
    });

    writeAll(next);
    return updated;
  },

  setReviewStatus(
    findingId: string,
    reviewStatus: FinalFindingReviewStatus,
  ): ForensicFinalFinding | null {
    return this.update(findingId, {
      reviewStatus,
      includeInReport: reviewStatus === "Ready for report",
    });
  },

  delete(findingId: string): void {
    writeAll(readAll().filter((finding) => finding.id !== findingId));
  },
};
