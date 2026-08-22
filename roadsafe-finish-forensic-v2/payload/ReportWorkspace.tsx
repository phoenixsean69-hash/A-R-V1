import { useMemo, useState } from "react";
import type { ForensicAccidentInvestigation } from "./forensicInvestigationTypes";
import { ForensicFindingsService } from "./forensicFindingsService";
import { ForensicSimulationService } from "./forensicSimulationService";
import { ForensicCanonicalReconstructionService } from "./forensicCanonicalReconstructionService";
import { ForensicReportService } from "./forensicReportService";
import type { ForensicReportRecord, ForensicReportStatus } from "./forensicReportTypes";
import "./ReportWorkspace.css";

interface Props {
  investigation: ForensicAccidentInvestigation;
  onMessage?(message: string): void;
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export default function ReportWorkspace({ investigation, onMessage }: Props) {
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<ForensicReportRecord>(() =>
    ForensicReportService.getOrCreate(investigation),
  );
  const [recommendationsText, setRecommendationsText] = useState(
    report.recommendations.join("\n"),
  );

  const findings = useMemo(
    () => ForensicFindingsService.getByCaseId(investigation.caseId),
    [investigation.caseId, revision],
  );
  const readyFindings = findings.filter(
    (finding) => finding.reviewStatus === "Ready for report" && finding.includeInReport,
  );
  const runs = useMemo(
    () => ForensicSimulationService.getByCaseId(investigation.caseId),
    [investigation.caseId, revision],
  );
  const manifest = useMemo(
    () => ForensicCanonicalReconstructionService.getManifest(investigation.caseId),
    [investigation.caseId, revision],
  );

  const message = (value: string) => onMessage?.(value);
  const refresh = () => setRevision((value) => value + 1);

  const patch = (
    changes: Partial<Omit<ForensicReportRecord, "id" | "caseId" | "caseNumber" | "createdAt">>,
  ) => {
    const updated = ForensicReportService.update(investigation.caseId, changes);
    if (updated) setReport(updated);
  };

  const saveRecommendations = () => {
    patch({ recommendations: splitLines(recommendationsText) });
  };

  const changeStatus = (status: ForensicReportStatus) => {
    try {
      saveRecommendations();
      const current = ForensicReportService.getByCaseId(investigation.caseId) ?? report;
      setReport(current);
      const updated = ForensicReportService.setStatus(investigation, status);
      setReport(updated);
      refresh();
      message(status === "Final" ? "Forensic report finalised." : `Report status changed to ${status}.`);
    } catch (error) {
      message(error instanceof Error ? error.message : "Report status could not be changed.");
    }
  };

  const gates = [
    {
      label: "Case identity",
      ok: Boolean(investigation.caseNumber.trim() && investigation.scene.location.trim() && investigation.investigatingOfficer.trim()),
    },
    { label: "Report-ready findings", ok: readyFindings.length > 0 },
    { label: "Derived lineage", ok: runs.length === 0 || Boolean(manifest) },
    { label: "Investigator declaration", ok: report.declarationAccepted },
  ];

  const finalReady =
    gates.every((gate) => gate.ok) &&
    Boolean(report.executiveSummary.trim()) &&
    Boolean(report.conclusion.trim()) &&
    Boolean(report.preparedBy.trim());

  const limitations = Array.from(new Set(findings.flatMap((finding) => finding.limitations)));
  const unresolved = Array.from(new Set(findings.flatMap((finding) => finding.unresolvedQuestions)));

  return (
    <div className="fv2-stack fv2-report-workstation">
      <section className="fv2-panel fv2-report-hero">
        <header>
          <div>
            <span>Formal forensic output</span>
            <strong>Build the report from reviewed findings</strong>
          </div>
          <div className="fv2-report-summary">
            <span>{report.code}</span>
            <span>{report.status}</span>
            <span>{readyFindings.length} finding(s) included</span>
          </div>
        </header>
        <div className="fv2-report-rule">
          The report is the final communication layer. Evidence remains evidence;
          calculations remain calculated; assumptions remain assumptions; simulation
          remains simulated. RoadSafe does not automatically assign legal guilt or liability.
        </div>
      </section>

      <div className="fv2-report-layout">
        <div className="fv2-report-main">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Finalisation gates</span>
                <strong>{gates.filter((gate) => gate.ok).length}/{gates.length} passed</strong>
              </div>
              <div className={finalReady ? "fv2-report-ready yes" : "fv2-report-ready"}>
                {finalReady ? "READY TO FINALISE" : "DRAFT / REVIEW REQUIRED"}
              </div>
            </header>
            <div className="fv2-report-gates">
              {gates.map((gate) => (
                <article key={gate.label} className={gate.ok ? "pass" : "fail"}>
                  <span>{gate.ok ? "✓" : "!"}</span>
                  <strong>{gate.label}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="fv2-panel">
            <header><div><span>Report composition</span><strong>Investigator-authored narrative</strong></div></header>
            <div className="fv2-report-form">
              <label className="fv2-field full">
                <span>Report title</span>
                <input value={report.title} onChange={(event) => patch({ title: event.target.value })} />
              </label>
              <label className="fv2-field full">
                <span>Executive summary</span>
                <textarea rows={6} value={report.executiveSummary} onChange={(event) => patch({ executiveSummary: event.target.value })} />
              </label>
              <label className="fv2-field full">
                <span>Scope and methodology</span>
                <textarea rows={6} value={report.methodologySummary} onChange={(event) => patch({ methodologySummary: event.target.value })} />
              </label>
              <label className="fv2-field full">
                <span>Investigator conclusion</span>
                <textarea rows={6} value={report.conclusion} onChange={(event) => patch({ conclusion: event.target.value })} />
              </label>
              <label className="fv2-field full">
                <span>Recommendations / follow-up — one per line</span>
                <textarea rows={5} value={recommendationsText} onChange={(event) => setRecommendationsText(event.target.value)} onBlur={saveRecommendations} />
              </label>
            </div>
          </section>

          <section className="fv2-panel">
            <header><div><span>Formal findings</span><strong>Ready for report only</strong></div></header>
            {readyFindings.length === 0 ? (
              <div className="fv2-empty">No findings are marked Ready for report.</div>
            ) : (
              <div className="fv2-report-findings">
                {readyFindings.map((finding) => (
                  <article key={finding.id}>
                    <span>{finding.code} · {finding.category}</span>
                    <strong>{finding.statement}</strong>
                    <div><b>{finding.disposition}</b><b>{finding.confidence}</b><b>{finding.provenance}</b></div>
                    <p>{finding.rationale}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="fv2-panel">
            <header><div><span>Limitations and unresolved matters</span><strong>Must remain visible</strong></div></header>
            <div className="fv2-report-two">
              <div><h3>Limitations</h3>{limitations.length ? <ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None recorded.</p>}</div>
              <div><h3>Unresolved questions</h3>{unresolved.length ? <ul>{unresolved.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None recorded.</p>}</div>
            </div>
          </section>

          <section className="fv2-panel">
            <header><div><span>Declaration and sign-off</span><strong>Human accountability</strong></div></header>
            <div className="fv2-report-signoff">
              <div className="fv2-report-two-fields">
                <label className="fv2-field"><span>Prepared by</span><input value={report.preparedBy} onChange={(event) => patch({ preparedBy: event.target.value })} /></label>
                <label className="fv2-field"><span>Reviewed by</span><input value={report.reviewedBy} onChange={(event) => patch({ reviewedBy: event.target.value })} /></label>
              </div>
              <label className="fv2-report-declaration">
                <input type="checkbox" checked={report.declarationAccepted} onChange={(event) => patch({ declarationAccepted: event.target.checked })} />
                <span>I confirm that this report distinguishes source observations and measurements from calculated, assumed, AI-derived and simulated material; that material limitations have not knowingly been omitted; and that RoadSafe output has not been treated as an automatic legal determination of guilt or liability.</span>
              </label>
            </div>
          </section>
        </div>

        <aside className="fv2-report-side">
          <section className="fv2-panel">
            <header><div><span>Source totals</span><strong>{investigation.caseNumber}</strong></div></header>
            <div className="fv2-report-counts">
              {[
                ["Evidence", investigation.evidence.length],
                ["Measurements", investigation.measurements.length],
                ["Vehicles", investigation.vehicles.length],
                ["Persons", investigation.persons.length],
                ["Witnesses", investigation.witnesses.length],
                ["Analysis", investigation.analysisFindings.length],
                ["Hypotheses", investigation.hypotheses.length],
                ["Simulations", runs.length],
              ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
          </section>

          <section className="fv2-panel">
            <header><div><span>Derived lineage</span><strong>Canonical reconstruction</strong></div></header>
            {manifest ? (
              <dl className="fv2-report-case">
                <div><dt>Hypothesis</dt><dd>{manifest.hypothesisCode}</dd></div>
                <div><dt>Simulation</dt><dd>{manifest.simulationRunCode}</dd></div>
                <div><dt>Provenance</dt><dd>{manifest.provenance}</dd></div>
                <div><dt>Reconstruction</dt><dd title={manifest.reconstructionId}>{manifest.reconstructionId}</dd></div>
              </dl>
            ) : <div className="fv2-empty">No canonical lineage recorded.</div>}
          </section>

          <section className="fv2-panel">
            <header><div><span>Report actions</span><strong>{report.status}</strong></div></header>
            <div className="fv2-report-actions">
              <button type="button" onClick={() => changeStatus("Draft")}>Save as draft</button>
              <button type="button" onClick={() => changeStatus("Ready for review")}>Mark ready for review</button>
              <button type="button" className="primary" disabled={!finalReady} onClick={() => changeStatus("Final")}>Finalise report</button>
              <hr />
              <button type="button" onClick={() => {
                try {
                  saveRecommendations();
                  const current = ForensicReportService.getByCaseId(investigation.caseId) ?? report;
                  ForensicReportService.openPrintable(investigation, current);
                } catch (error) {
                  message(error instanceof Error ? error.message : "Print view could not be opened.");
                }
              }}>Print / Save PDF</button>
              <button type="button" onClick={() => {
                saveRecommendations();
                const current = ForensicReportService.getByCaseId(investigation.caseId) ?? report;
                ForensicReportService.downloadWord(investigation, current);
              }}>Export Word</button>
              <button type="button" onClick={() => {
                saveRecommendations();
                const current = ForensicReportService.getByCaseId(investigation.caseId) ?? report;
                ForensicReportService.downloadJson(investigation, current);
              }}>Export JSON audit</button>
            </div>
          </section>

          <section className="fv2-panel fv2-notice">
            <b>Report rule</b>
            <p>A final report is an accountable investigator product. RoadSafe can organise, calculate and visualise evidence, but the investigator remains responsible for conclusions and limitations.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
