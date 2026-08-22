import type {
  ForensicAccidentInvestigation,
} from "./forensicInvestigationTypes";
import type {
  ForensicFinalFinding,
} from "./forensicFindingsTypes";
import {
  ForensicFindingsService,
} from "./forensicFindingsService";
import {
  ForensicSimulationService,
} from "./forensicSimulationService";
import {
  ForensicCanonicalReconstructionService,
} from "./forensicCanonicalReconstructionService";
import type {
  ForensicReportRecord,
  ForensicReportSnapshot,
  ForensicReportStatus,
} from "./forensicReportTypes";

const STORAGE_KEY = "roadsafe-forensic-report-v1";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function readAll(): ForensicReportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ForensicReportRecord[];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((record) => ({
      ...record,
      recommendations: Array.isArray(record.recommendations)
        ? record.recommendations
        : [],
      includedFindingIds: Array.isArray(record.includedFindingIds)
        ? record.includedFindingIds
        : [],
      declarationAccepted: Boolean(record.declarationAccepted),
    }));
  } catch (error) {
    console.error("Failed to read forensic report records:", error);
    return [];
  }
}

function writeAll(records: ForensicReportRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function reportCode(caseNumber: string): string {
  return `${caseNumber}-FR`;
}

function defaultMethodology(): string {
  return [
    "The investigation followed an evidence-first workflow.",
    "Scene observations, measurements, vehicle/person records and witness accounts were recorded before interpretive analysis.",
    "Competing hypotheses were tested against the available evidence.",
    "Where simulation or reconstruction was used, those outputs remained explicitly derived and did not replace source evidence.",
  ].join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadBlob(
  filename: string,
  content: BlobPart,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sourceSummary(
  finding: ForensicFinalFinding,
  investigation: ForensicAccidentInvestigation,
): string[] {
  const lines: string[] = [];

  const evidenceCodes = finding.supportingEvidenceIds
    .map((id) => investigation.evidence.find((item) => item.id === id)?.code)
    .filter(Boolean);

  const conflictingEvidenceCodes = finding.conflictingEvidenceIds
    .map((id) => investigation.evidence.find((item) => item.id === id)?.code)
    .filter(Boolean);

  const analysisCodes = finding.supportingAnalysisFindingIds
    .map((id) =>
      investigation.analysisFindings.find((item) => item.id === id)?.code,
    )
    .filter(Boolean);

  const conflictingAnalysisCodes = finding.conflictingAnalysisFindingIds
    .map((id) =>
      investigation.analysisFindings.find((item) => item.id === id)?.code,
    )
    .filter(Boolean);

  const measurementCodes = finding.sourceMeasurementIds
    .map((id) =>
      investigation.measurements.find((item) => item.id === id)?.code,
    )
    .filter(Boolean);

  const hypothesisCodes = finding.sourceHypothesisIds
    .map((id) => investigation.hypotheses.find((item) => item.id === id)?.code)
    .filter(Boolean);

  const simulationRuns =
    ForensicSimulationService.getByCaseId(investigation.caseId);
  const simulationCodes = finding.sourceSimulationRunIds
    .map((id) => simulationRuns.find((item) => item.id === id)?.code)
    .filter(Boolean);

  if (evidenceCodes.length) {
    lines.push(`Supporting evidence: ${evidenceCodes.join(", ")}`);
  }
  if (conflictingEvidenceCodes.length) {
    lines.push(`Conflicting evidence: ${conflictingEvidenceCodes.join(", ")}`);
  }
  if (analysisCodes.length) {
    lines.push(`Supporting analysis: ${analysisCodes.join(", ")}`);
  }
  if (conflictingAnalysisCodes.length) {
    lines.push(`Conflicting analysis: ${conflictingAnalysisCodes.join(", ")}`);
  }
  if (measurementCodes.length) {
    lines.push(`Measurements: ${measurementCodes.join(", ")}`);
  }
  if (hypothesisCodes.length) {
    lines.push(`Hypotheses: ${hypothesisCodes.join(", ")}`);
  }
  if (simulationCodes.length) {
    lines.push(`Simulation runs: ${simulationCodes.join(", ")}`);
  }
  if (finding.canonicalReconstructionId) {
    lines.push(
      `Canonical reconstruction: ${finding.canonicalReconstructionId}`,
    );
  }

  return lines;
}

function buildPrintableHtml(snapshot: ForensicReportSnapshot): string {
  const list = (items: string[]) =>
    items.length
      ? `<ul>${items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`
      : "<p>None recorded.</p>";

  const findingsHtml = snapshot.findings.length
    ? snapshot.findings
        .map(
          (finding) => `
<section class="finding">
  <div class="finding-head">
    <strong>${escapeHtml(finding.code)} · ${escapeHtml(
      finding.category,
    )}</strong>
    <span>${escapeHtml(finding.disposition)} · ${escapeHtml(
      finding.confidence,
    )}</span>
  </div>
  <p>${escapeHtml(finding.statement)}</p>
  <p><b>Provenance:</b> ${escapeHtml(finding.provenance)}</p>
  <p><b>Investigator rationale:</b> ${escapeHtml(
    finding.rationale || "Not recorded",
  )}</p>
  <p><b>Source trace:</b></p>
  ${list(finding.sourceSummary)}
  <p><b>Limitations:</b></p>
  ${list(finding.limitations)}
  <p><b>Unresolved questions:</b></p>
  ${list(finding.unresolvedQuestions)}
</section>`,
        )
        .join("")
    : "<p>No findings were marked Ready for report.</p>";

  const lineage = snapshot.canonicalLineage
    ? `
<table>
  <tr><th>Source hypothesis</th><td>${escapeHtml(
    snapshot.canonicalLineage.hypothesisCode,
  )}</td></tr>
  <tr><th>Simulation run</th><td>${escapeHtml(
    snapshot.canonicalLineage.simulationRunCode,
  )}</td></tr>
  <tr><th>Canonical reconstruction</th><td>${escapeHtml(
    snapshot.canonicalLineage.reconstructionId,
  )}</td></tr>
  <tr><th>Derived provenance</th><td>${escapeHtml(
    snapshot.canonicalLineage.provenance,
  )}</td></tr>
</table>`
    : "<p>No canonical reconstruction lineage was recorded.</p>";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(snapshot.report.code)} Forensic Report</title>
<style>
@page { margin: 18mm; }
body { font-family: "Saira", Arial, sans-serif; color: #202020; font-size: 11pt; line-height: 1.45; }
h1 { font-size: 23pt; margin: 0 0 4px; }
h2 { font-size: 14pt; border-bottom: 1px solid #aaa; padding-bottom: 4px; margin-top: 24px; }
.meta, .notice { border: 1px solid #bbb; padding: 12px; margin: 12px 0; }
.notice { background: #f3f3f3; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #bbb; padding: 7px; text-align: left; vertical-align: top; }
th { width: 28%; background: #f4f4f4; }
.finding { border: 1px solid #bdbdbd; padding: 12px; margin: 12px 0; break-inside: avoid; }
.finding-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
.small { font-size: 9pt; color: #555; }
.signature { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
.line { border-top: 1px solid #222; padding-top: 5px; margin-top: 38px; }
</style>
</head>
<body>
<p class="small">RoadSafe AR · Evidence-first forensic investigation</p>
<h1>Forensic Accident Investigation Report</h1>
<p><strong>${escapeHtml(snapshot.report.code)}</strong></p>

<div class="meta">
  <p><b>Case:</b> ${escapeHtml(snapshot.case.caseNumber)} · ${escapeHtml(
    snapshot.case.caseTitle,
  )}</p>
  <p><b>Date / time:</b> ${escapeHtml(
    snapshot.case.accidentDate,
  )} ${escapeHtml(snapshot.case.accidentTime)}</p>
  <p><b>Location:</b> ${escapeHtml(snapshot.case.location)}</p>
  <p><b>Investigating officer:</b> ${escapeHtml(
    snapshot.case.investigatingOfficer || "Not recorded",
  )}</p>
  <p><b>Police station:</b> ${escapeHtml(
    snapshot.case.policeStation || "Not recorded",
  )}</p>
  <p><b>Report status:</b> ${escapeHtml(snapshot.report.status)}</p>
  <p><b>Generated:</b> ${escapeHtml(snapshot.generatedAt)}</p>
</div>

<div class="notice">
  <b>Interpretive status.</b>
  This report distinguishes source evidence from calculated, assumed, AI-derived and simulated material.
  A reconstruction or simulation is a tested explanatory output and does not automatically establish legal guilt, civil liability or criminal responsibility.
</div>

<h2>1. Executive Summary</h2>
<p>${escapeHtml(snapshot.report.executiveSummary || "Not recorded.")}</p>

<h2>2. Scope and Methodology</h2>
<p>${escapeHtml(snapshot.report.methodologySummary || "Not recorded.")}</p>

<h2>3. Evidential Basis</h2>
<table>
  <tr><th>Physical evidence</th><td>${snapshot.sourceCounts.evidence}</td></tr>
  <tr><th>Measurements</th><td>${snapshot.sourceCounts.measurements}</td></tr>
  <tr><th>Vehicles examined</th><td>${snapshot.sourceCounts.vehicles}</td></tr>
  <tr><th>Persons</th><td>${snapshot.sourceCounts.persons}</td></tr>
  <tr><th>Witnesses</th><td>${snapshot.sourceCounts.witnesses}</td></tr>
  <tr><th>Analysis findings</th><td>${snapshot.sourceCounts.analysisFindings}</td></tr>
  <tr><th>Hypotheses</th><td>${snapshot.sourceCounts.hypotheses}</td></tr>
  <tr><th>Simulation runs</th><td>${snapshot.sourceCounts.simulationRuns}</td></tr>
</table>

<h2>4. Hypothesis / Simulation / Reconstruction Lineage</h2>
${lineage}

<h2>5. Final Findings</h2>
${findingsHtml}

<h2>6. Limitations</h2>
${list(snapshot.limitations)}

<h2>7. Unresolved Questions</h2>
${list(snapshot.unresolvedQuestions)}

<h2>8. Investigator Conclusion</h2>
<p>${escapeHtml(snapshot.report.conclusion || "Not recorded.")}</p>

<h2>9. Recommendations / Follow-up</h2>
${list(snapshot.report.recommendations)}

<h2>10. Declaration and Sign-off</h2>
<p>
The undersigned confirms that the report distinguishes observed/measured source material from derived interpretations and that unresolved limitations have not knowingly been omitted.
</p>
<div class="signature">
  <div>
    <div class="line">Prepared by: ${escapeHtml(
      snapshot.report.preparedBy || "Not recorded",
    )}</div>
  </div>
  <div>
    <div class="line">Reviewed by: ${escapeHtml(
      snapshot.report.reviewedBy || "Not recorded",
    )}</div>
  </div>
</div>
</body>
</html>`;
}

export const ForensicReportService = {
  getByCaseId(caseId: string): ForensicReportRecord | null {
    return readAll().find((record) => record.caseId === caseId) ?? null;
  },

  getOrCreate(
    investigation: ForensicAccidentInvestigation,
  ): ForensicReportRecord {
    const existing = this.getByCaseId(investigation.caseId);
    if (existing) return existing;

    const readyFindings = ForensicFindingsService.getByCaseId(
      investigation.caseId,
    ).filter(
      (finding) =>
        finding.reviewStatus === "Ready for report" &&
        finding.includeInReport,
    );

    const now = new Date().toISOString();

    const record: ForensicReportRecord = {
      id: createId("forensic-report"),
      code: reportCode(investigation.caseNumber),
      caseId: investigation.caseId,
      caseNumber: investigation.caseNumber,
      title: `${investigation.caseNumber} Forensic Accident Investigation Report`,
      executiveSummary: "",
      methodologySummary: defaultMethodology(),
      conclusion: "",
      recommendations: [],
      preparedBy: investigation.investigatingOfficer,
      reviewedBy: "",
      status: "Draft",
      declarationAccepted: false,
      includedFindingIds: readyFindings.map((finding) => finding.id),
      createdAt: now,
      updatedAt: now,
    };

    writeAll([...readAll(), record]);
    return record;
  },

  update(
    caseId: string,
    patch: Partial<
      Omit<
        ForensicReportRecord,
        "id" | "caseId" | "caseNumber" | "createdAt"
      >
    >,
  ): ForensicReportRecord | null {
    const all = readAll();
    let updated: ForensicReportRecord | null = null;

    const next = all.map((record) => {
      if (record.caseId !== caseId) return record;

      updated = {
        ...record,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      return updated;
    });

    writeAll(next);
    return updated;
  },

  syncReadyFindings(
    investigation: ForensicAccidentInvestigation,
  ): ForensicReportRecord {
    const current = this.getOrCreate(investigation);

    const includedFindingIds = ForensicFindingsService.getByCaseId(
      investigation.caseId,
    )
      .filter(
        (finding) =>
          finding.reviewStatus === "Ready for report" &&
          finding.includeInReport,
      )
      .map((finding) => finding.id);

    return (
      this.update(investigation.caseId, {
        includedFindingIds,
      }) ?? current
    );
  },

  setStatus(
    investigation: ForensicAccidentInvestigation,
    status: ForensicReportStatus,
  ): ForensicReportRecord {
    const current = this.syncReadyFindings(investigation);

    if (status === "Final") {
      const snapshot = this.buildSnapshot(investigation, current);

      if (snapshot.findings.length === 0) {
        throw new Error(
          "At least one finding must be marked Ready for report before finalisation.",
        );
      }

      if (!current.executiveSummary.trim()) {
        throw new Error("Record an executive summary before finalisation.");
      }

      if (!current.conclusion.trim()) {
        throw new Error("Record the investigator conclusion before finalisation.");
      }

      if (!current.preparedBy.trim()) {
        throw new Error("Record the report preparer before finalisation.");
      }

      if (!current.declarationAccepted) {
        throw new Error(
          "Accept the forensic declaration before finalising the report.",
        );
      }
    }

    const updated =
      this.update(investigation.caseId, {
        status,
        finalisedAt: status === "Final" ? new Date().toISOString() : undefined,
      }) ?? current;

    return updated;
  },

  buildSnapshot(
    investigation: ForensicAccidentInvestigation,
    reportRecord?: ForensicReportRecord,
  ): ForensicReportSnapshot {
    const report = reportRecord ?? this.getOrCreate(investigation);
    const allFindings = ForensicFindingsService.getByCaseId(
      investigation.caseId,
    );

    const findingIds = new Set(report.includedFindingIds);

    const findings = allFindings
      .filter(
        (finding) =>
          findingIds.has(finding.id) &&
          finding.reviewStatus === "Ready for report" &&
          finding.includeInReport,
      )
      .map((finding) => ({
        code: finding.code,
        category: finding.category,
        statement: finding.statement,
        disposition: finding.disposition,
        confidence: finding.confidence,
        provenance: finding.provenance,
        rationale: finding.rationale,
        limitations: finding.limitations,
        unresolvedQuestions: finding.unresolvedQuestions,
        sourceSummary: sourceSummary(finding, investigation),
      }));

    const unresolvedQuestions = Array.from(
      new Set(
        allFindings.flatMap((finding) => finding.unresolvedQuestions),
      ),
    );

    const limitations = Array.from(
      new Set(allFindings.flatMap((finding) => finding.limitations)),
    );

    const runs = ForensicSimulationService.getByCaseId(investigation.caseId);
    const manifest =
      ForensicCanonicalReconstructionService.getManifest(investigation.caseId);

    return {
      report,
      generatedAt: new Date().toISOString(),
      case: {
        caseId: investigation.caseId,
        caseNumber: investigation.caseNumber,
        caseTitle: investigation.caseTitle,
        investigatingOfficer: investigation.investigatingOfficer,
        policeStation: investigation.policeStation,
        location: investigation.scene.location,
        accidentDate: investigation.scene.accidentDate,
        accidentTime: investigation.scene.accidentTime,
      },
      sourceCounts: {
        evidence: investigation.evidence.length,
        measurements: investigation.measurements.length,
        vehicles: investigation.vehicles.length,
        persons: investigation.persons.length,
        witnesses: investigation.witnesses.length,
        analysisFindings: investigation.analysisFindings.length,
        hypotheses: investigation.hypotheses.length,
        simulationRuns: runs.length,
        reportFindings: findings.length,
      },
      canonicalLineage: manifest
        ? {
            hypothesisCode: manifest.hypothesisCode,
            simulationRunCode: manifest.simulationRunCode,
            reconstructionId: manifest.reconstructionId,
            provenance: manifest.provenance,
            updatedAt: manifest.updatedAt,
          }
        : undefined,
      findings,
      unresolvedQuestions,
      limitations,
    };
  },

  openPrintable(
    investigation: ForensicAccidentInvestigation,
    reportRecord?: ForensicReportRecord,
  ): void {
    const snapshot = this.buildSnapshot(investigation, reportRecord);
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!reportWindow) {
      throw new Error(
        "The browser blocked the printable report window. Allow pop-ups and try again.",
      );
    }

    reportWindow.document.open();
    reportWindow.document.write(buildPrintableHtml(snapshot));
    reportWindow.document.close();

    window.setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
    }, 250);
  },

  downloadWord(
    investigation: ForensicAccidentInvestigation,
    reportRecord?: ForensicReportRecord,
  ): void {
    const snapshot = this.buildSnapshot(investigation, reportRecord);
    downloadBlob(
      `${snapshot.case.caseNumber}-forensic-report.doc`,
      buildPrintableHtml(snapshot),
      "application/msword;charset=utf-8",
    );
  },

  downloadJson(
    investigation: ForensicAccidentInvestigation,
    reportRecord?: ForensicReportRecord,
  ): void {
    const snapshot = this.buildSnapshot(investigation, reportRecord);
    downloadBlob(
      `${snapshot.case.caseNumber}-forensic-report.json`,
      JSON.stringify(snapshot, null, 2),
      "application/json;charset=utf-8",
    );
  },
};
