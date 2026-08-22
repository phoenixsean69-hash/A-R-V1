import type { ForensicAccidentInvestigation } from "./forensicInvestigationTypes";
import { ForensicFindingsService } from "./forensicFindingsService";
import { ForensicSimulationService } from "./forensicSimulationService";
import { ForensicCanonicalReconstructionService } from "./forensicCanonicalReconstructionService";
import type { ForensicReportRecord, ForensicReportStatus } from "./forensicReportTypes";

const STORAGE_KEY = "roadsafe-forensic-report-v1";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAll(): ForensicReportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForensicReportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read forensic reports:", error);
    return [];
  }
}

function writeAll(records: ForensicReportRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function list(items: string[]): string {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>None recorded.</p>";
}

function buildHtml(
  investigation: ForensicAccidentInvestigation,
  report: ForensicReportRecord,
): string {
  const findings = ForensicFindingsService.getByCaseId(investigation.caseId)
    .filter((finding) => finding.reviewStatus === "Ready for report" && finding.includeInReport);
  const runs = ForensicSimulationService.getByCaseId(investigation.caseId);
  const manifest = ForensicCanonicalReconstructionService.getManifest(investigation.caseId);
  const limitations = Array.from(new Set(findings.flatMap((finding) => finding.limitations)));
  const unresolved = Array.from(new Set(findings.flatMap((finding) => finding.unresolvedQuestions)));

  const findingHtml = findings.length
    ? findings.map((finding) => `
<section class="finding">
  <h3>${escapeHtml(finding.code)} · ${escapeHtml(finding.category)}</h3>
  <p>${escapeHtml(finding.statement)}</p>
  <p><b>Disposition:</b> ${escapeHtml(finding.disposition)} · <b>Confidence:</b> ${escapeHtml(finding.confidence)} · <b>Provenance:</b> ${escapeHtml(finding.provenance)}</p>
  <p><b>Rationale:</b> ${escapeHtml(finding.rationale)}</p>
  <p><b>Limitations:</b></p>${list(finding.limitations)}
  <p><b>Unresolved questions:</b></p>${list(finding.unresolvedQuestions)}
</section>`).join("")
    : "<p>No final findings were marked Ready for report.</p>";

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(report.code)}</title>
<style>@page{margin:18mm}body{font-family:Saira,Arial,sans-serif;color:#222;line-height:1.45;font-size:11pt}h1{font-size:22pt;margin-bottom:4px}h2{font-size:14pt;border-bottom:1px solid #aaa;padding-bottom:4px;margin-top:24px}.meta,.notice,.finding{border:1px solid #bbb;padding:12px;margin:12px 0}.notice{background:#f4f4f4}.finding{break-inside:avoid}.signature{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}.line{border-top:1px solid #222;padding-top:5px;margin-top:35px}</style>
</head><body>
<p>RoadSafe AR · Evidence-first forensic investigation</p>
<h1>Forensic Accident Investigation Report</h1>
<p><b>${escapeHtml(report.code)}</b></p>
<div class="meta">
<p><b>Case:</b> ${escapeHtml(investigation.caseNumber)} · ${escapeHtml(investigation.caseTitle)}</p>
<p><b>Location:</b> ${escapeHtml(investigation.scene.location || "Not recorded")}</p>
<p><b>Date/time:</b> ${escapeHtml(investigation.scene.accidentDate || "Not recorded")} ${escapeHtml(investigation.scene.accidentTime || "")}</p>
<p><b>Investigating officer:</b> ${escapeHtml(investigation.investigatingOfficer || "Not recorded")}</p>
<p><b>Police station:</b> ${escapeHtml(investigation.policeStation || "Not recorded")}</p>
<p><b>Status:</b> ${escapeHtml(report.status)}</p>
</div>
<div class="notice"><b>Interpretive status:</b> source observations and measurements remain distinct from calculated, assumed, AI-derived and simulated material. RoadSafe does not automatically determine legal guilt or liability.</div>
<h2>1. Executive Summary</h2><p>${escapeHtml(report.executiveSummary || "Not recorded.")}</p>
<h2>2. Scope and Methodology</h2><p>${escapeHtml(report.methodologySummary || "Not recorded.")}</p>
<h2>3. Evidential Basis</h2>
<p>${investigation.evidence.length} evidence record(s); ${investigation.measurements.length} measurement(s); ${investigation.vehicles.length} vehicle(s); ${investigation.persons.length} person(s); ${investigation.witnesses.length} witness(es); ${investigation.analysisFindings.length} analysis finding(s); ${investigation.hypotheses.length} hypothesis/hypotheses; ${runs.length} simulation run(s).</p>
<h2>4. Derived Reconstruction Lineage</h2>
<p>${manifest ? `${escapeHtml(manifest.hypothesisCode)} → ${escapeHtml(manifest.simulationRunCode)} → ${escapeHtml(manifest.reconstructionId)} (provenance: ${escapeHtml(manifest.provenance)})` : "No canonical reconstruction lineage recorded."}</p>
<h2>5. Final Findings</h2>${findingHtml}
<h2>6. Limitations</h2>${list(limitations)}
<h2>7. Unresolved Questions</h2>${list(unresolved)}
<h2>8. Investigator Conclusion</h2><p>${escapeHtml(report.conclusion || "Not recorded.")}</p>
<h2>9. Recommendations / Follow-up</h2>${list(report.recommendations)}
<h2>10. Declaration and Sign-off</h2>
<p>The report distinguishes source material from derived interpretations and does not knowingly omit material limitations.</p>
<div class="signature"><div class="line">Prepared by: ${escapeHtml(report.preparedBy || "Not recorded")}</div><div class="line">Reviewed by: ${escapeHtml(report.reviewedBy || "Not recorded")}</div></div>
</body></html>`;
}

function downloadBlob(filename: string, content: BlobPart, mimeType: string): void {
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

export const ForensicReportService = {
  getByCaseId(caseId: string): ForensicReportRecord | null {
    return readAll().find((record) => record.caseId === caseId) ?? null;
  },

  getOrCreate(investigation: ForensicAccidentInvestigation): ForensicReportRecord {
    const existing = this.getByCaseId(investigation.caseId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const record: ForensicReportRecord = {
      id: createId("forensic-report"),
      code: `${investigation.caseNumber}-FR`,
      caseId: investigation.caseId,
      caseNumber: investigation.caseNumber,
      title: `${investigation.caseNumber} Forensic Accident Investigation Report`,
      executiveSummary: "",
      methodologySummary: "The investigation followed an evidence-first workflow. Source observations and measurements were recorded before interpretive analysis. Competing hypotheses were tested against available evidence, and any simulation or reconstruction output remained explicitly derived.",
      conclusion: "",
      recommendations: [],
      preparedBy: investigation.investigatingOfficer,
      reviewedBy: "",
      declarationAccepted: false,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    };

    writeAll([...readAll(), record]);
    return record;
  },

  update(
    caseId: string,
    patch: Partial<Omit<ForensicReportRecord, "id" | "caseId" | "caseNumber" | "createdAt">>,
  ): ForensicReportRecord | null {
    const all = readAll();
    let updated: ForensicReportRecord | null = null;
    const next = all.map((record) => {
      if (record.caseId !== caseId) return record;
      updated = { ...record, ...patch, updatedAt: new Date().toISOString() };
      return updated;
    });
    writeAll(next);
    return updated;
  },

  setStatus(
    investigation: ForensicAccidentInvestigation,
    status: ForensicReportStatus,
  ): ForensicReportRecord {
    const current = this.getOrCreate(investigation);

    if (status === "Final") {
      const readyFindings = ForensicFindingsService.getByCaseId(investigation.caseId)
        .filter((finding) => finding.reviewStatus === "Ready for report" && finding.includeInReport);
      const runs = ForensicSimulationService.getByCaseId(investigation.caseId);
      const manifest = ForensicCanonicalReconstructionService.getManifest(investigation.caseId);

      if (readyFindings.length === 0) throw new Error("At least one finding must be Ready for report before finalisation.");
      if (!current.executiveSummary.trim()) throw new Error("Record an executive summary before finalisation.");
      if (!current.conclusion.trim()) throw new Error("Record the investigator conclusion before finalisation.");
      if (!current.preparedBy.trim()) throw new Error("Record the report preparer before finalisation.");
      if (!current.declarationAccepted) throw new Error("Accept the forensic declaration before finalising the report.");
      if (runs.length > 0 && !manifest) throw new Error("Simulation exists but no canonical reconstruction lineage is registered.");
    }

    return this.update(investigation.caseId, {
      status,
      finalisedAt: status === "Final" ? new Date().toISOString() : undefined,
    }) ?? current;
  },

  openPrintable(investigation: ForensicAccidentInvestigation, report: ForensicReportRecord): void {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) throw new Error("The browser blocked the printable report window.");
    reportWindow.document.open();
    reportWindow.document.write(buildHtml(investigation, report));
    reportWindow.document.close();
    window.setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
    }, 200);
  },

  downloadWord(investigation: ForensicAccidentInvestigation, report: ForensicReportRecord): void {
    downloadBlob(`${investigation.caseNumber}-forensic-report.doc`, buildHtml(investigation, report), "application/msword;charset=utf-8");
  },

  downloadJson(investigation: ForensicAccidentInvestigation, report: ForensicReportRecord): void {
    const findings = ForensicFindingsService.getByCaseId(investigation.caseId)
      .filter((finding) => finding.reviewStatus === "Ready for report" && finding.includeInReport);
    const manifest = ForensicCanonicalReconstructionService.getManifest(investigation.caseId);
    const runs = ForensicSimulationService.getByCaseId(investigation.caseId);

    downloadBlob(
      `${investigation.caseNumber}-forensic-report.json`,
      JSON.stringify({ report, investigationId: investigation.id, findings, canonicalManifest: manifest, simulationRuns: runs }, null, 2),
      "application/json;charset=utf-8",
    );
  },
};
