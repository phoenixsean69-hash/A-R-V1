import type {
  ForensicFinalFinding,
  ForensicFindingCategory,
  ForensicFindingDisposition,
  ForensicFindingProvenance,
} from "./forensicFindingsTypes";
import type { ForensicConfidence } from "./forensicInvestigationTypes";

const STORAGE_KEY = "roadsafe-forensic-final-findings-v1";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
      supportingAnalysisFindingIds: Array.isArray(
        finding.supportingAnalysisFindingIds,
      )
        ? finding.supportingAnalysisFindingIds
        : [],
      conflictingAnalysisFindingIds: Array.isArray(
        finding.conflictingAnalysisFindingIds,
      )
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
    console.error("Failed to read forensic findings:", error);
    return [];
  }
}

function writeAll(findings: ForensicFinalFinding[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(findings));
}

function nextCode(caseId: string): string {
  const highest = readAll()
    .filter((finding) => finding.caseId === caseId)
    .reduce((max, finding) => {
      const match = /^F-(\d+)$/.exec(finding.code);
      const value = match ? Number(match[1]) : 0;
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

  return `F-${String(highest + 1).padStart(3, "0")}`;
}

export const ForensicFindingsService = {
  getByCaseId(caseId: string): ForensicFinalFinding[] {
    return readAll()
      .filter((finding) => finding.caseId === caseId)
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  create(
    caseId: string,
    input: {
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
    },
  ): ForensicFinalFinding {
    const now = new Date().toISOString();

    const finding: ForensicFinalFinding = {
      id: createId("final-finding"),
      code: nextCode(caseId),
      caseId,
      ...input,
      reviewStatus: "Draft",
      includeInReport: false,
      createdAt: now,
      updatedAt: now,
    };

    writeAll([...readAll(), finding]);
    return finding;
  },

  update(
    findingId: string,
    patch: Partial<
      Omit<ForensicFinalFinding, "id" | "code" | "caseId" | "createdAt">
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

  remove(findingId: string): void {
    writeAll(readAll().filter((finding) => finding.id !== findingId));
  },
};
