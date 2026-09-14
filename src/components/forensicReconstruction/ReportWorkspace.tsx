import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CarFront,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Database,
  Download,
  FileSearch,
  FileText,
  Gauge,
  Orbit,
  PersonStanding,
  Play,
  Printer,
  Save,
  ScanLine,
  ShieldCheck,
  Users,
  Waypoints,
} from "../icons/materialIcons";
import type { ForensicAccidentInvestigation } from "../../features/forensicReconstruction/forensicInvestigationTypes";
import { ForensicFindingsService } from "../../features/forensicReconstruction/forensicFindingsService";
import { ForensicSimulationService } from "../../features/forensicReconstruction/forensicSimulationService";
import { ForensicCanonicalReconstructionService } from "../../features/forensicReconstruction/forensicCanonicalReconstructionService";
import { ForensicReportService } from "../../features/forensicReconstruction/forensicReportService";
import type { ForensicReportRecord, ForensicReportStatus } from "../../features/forensicReconstruction/forensicReportTypes";
import "../../features/forensicReconstruction/ReportWorkspace.css";

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
    <div className="fv2-stack fv2-report-viz">
      <header className="fv2-report-viz-commandbar">
        <div className="fv2-report-viz-commandbar__identity">
          <span className="fv2-report-viz-commandbar__icon">
            <FileText size={36} />
          </span>

          <div>
            <small>Formal forensic output</small>
            <strong>Report Finalisation Workstation</strong>
          </div>
        </div>

        <div className="fv2-report-viz-commandbar__status">
          <span>
            <FileText size={15} />
            <b>{report.code}</b>
          </span>

          <span>
            <CircleDot size={15} />
            <b>{report.status}</b>
          </span>

          <span>
            <BarChart3 size={15} />
            <b>{readyFindings.length}</b>
            findings
          </span>

          <span>
            <ShieldCheck size={15} />
            <b>{gates.filter((gate) => gate.ok).length}/{gates.length}</b>
            gates
          </span>
        </div>
      </header>

      <div className="fv2-report-viz-layout">
        <main className="fv2-report-viz-canvas">
          <section className="fv2-report-viz-gates">
            <header>
              <ShieldCheck size={20} />

              <div>
                <span>Finalisation gates</span>
                <strong>
                  {finalReady
                    ? "Report can be finalised"
                    : "Review requirements remain"}
                </strong>
              </div>

              <div
                className={`fv2-report-viz-ready ${
                  finalReady ? "is-ready" : ""
                }`}
              >
                <span>
                  {finalReady
                    ? "READY"
                    : "REVIEW REQUIRED"}
                </span>
              </div>
            </header>

            <div className="fv2-report-viz-gate-grid">
              {gates.map((gate, index) => (
                <article
                  key={gate.label}
                  className={gate.ok ? "is-pass" : "is-fail"}
                >
                  <span className="fv2-report-viz-gate-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {gate.ok ? (
                    <CheckCircle2 size={28} />
                  ) : (
                    <AlertTriangle size={28} />
                  )}

                  <div>
                    <small>{gate.ok ? "Passed" : "Pending"}</small>
                    <strong>{gate.label}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="fv2-report-viz-editor">
            <header>
              <ClipboardList size={20} />

              <div>
                <span>Report composition</span>
                <strong>Investigator-authored narrative</strong>
              </div>

              <div className="fv2-report-viz-editor-status">
                <span>
                  {report.executiveSummary.trim()
                    ? "Summary ready"
                    : "Summary missing"}
                </span>

                <span>
                  {report.conclusion.trim()
                    ? "Conclusion ready"
                    : "Conclusion missing"}
                </span>
              </div>
            </header>

            <div className="fv2-report-viz-title-row">
              <FileText size={24} />

              <label>
                <span>Report title</span>
                <input
                  value={report.title}
                  onChange={(event) =>
                    patch({ title: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="fv2-report-viz-editor-grid">
              <label className="fv2-report-viz-editor-block">
                <span>Executive summary</span>
                <textarea
                  rows={7}
                  value={report.executiveSummary}
                  onChange={(event) =>
                    patch({
                      executiveSummary: event.target.value,
                    })
                  }
                  placeholder="Concise summary of the investigation and principal findings"
                />
              </label>

              <label className="fv2-report-viz-editor-block">
                <span>Scope and methodology</span>
                <textarea
                  rows={7}
                  value={report.methodologySummary}
                  onChange={(event) =>
                    patch({
                      methodologySummary:
                        event.target.value,
                    })
                  }
                  placeholder="Methods, sources and reconstruction approach"
                />
              </label>
            </div>

            <label className="fv2-report-viz-conclusion">
              <div>
                <Gauge size={20} />
                <span>Investigator conclusion</span>
              </div>

              <textarea
                rows={7}
                value={report.conclusion}
                onChange={(event) =>
                  patch({
                    conclusion: event.target.value,
                  })
                }
                placeholder="Final investigator conclusion"
              />
            </label>

            <details className="fv2-report-viz-drawer">
              <summary>
                <Waypoints size={18} />

                <div>
                  <span>Recommendations / follow-up</span>
                  <strong>
                    {splitLines(recommendationsText).length}
                    {" "}
                    item(s)
                  </strong>
                </div>

                <ChevronDown size={18} />
              </summary>

              <textarea
                rows={5}
                value={recommendationsText}
                onChange={(event) =>
                  setRecommendationsText(
                    event.target.value,
                  )
                }
                onBlur={saveRecommendations}
                placeholder="One recommendation per line"
              />
            </details>
          </section>

          <section className="fv2-report-viz-findings">
            <header>
              <BarChart3 size={20} />

              <div>
                <span>Formal findings</span>
                <strong>Report-ready findings only</strong>
              </div>

              <div className="fv2-report-viz-module-count">
                <b>{readyFindings.length}</b>
                <span>included</span>
              </div>
            </header>

            {readyFindings.length === 0 ? (
              <div className="fv2-report-viz-empty">
                <BarChart3 size={44} />
                <strong>No report-ready findings</strong>
                <small>
                  Mark reviewed findings Ready for report first
                </small>
              </div>
            ) : (
              <div className="fv2-report-viz-finding-grid">
                {readyFindings.map((finding) => (
                  <article key={finding.id}>
                    <header>
                      <div>
                        <small>{finding.code}</small>
                        <strong>{finding.category}</strong>
                      </div>

                      <span>{finding.confidence}</span>
                    </header>

                    <p>{finding.statement}</p>

                    <div className="fv2-report-viz-finding-meta">
                      <span>
                        <CircleDot size={13} />
                        {finding.disposition}
                      </span>

                      <span>
                        <ShieldCheck size={13} />
                        {finding.provenance}
                      </span>
                    </div>

                    {finding.rationale && (
                      <small className="fv2-report-viz-rationale">
                        {finding.rationale}
                      </small>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="fv2-report-viz-issues-grid">
            <section className="fv2-report-viz-issues">
              <header>
                <AlertTriangle size={19} />

                <div>
                  <span>Limitations</span>
                  <strong>
                    {limitations.length}
                    {" "}
                    recorded
                  </strong>
                </div>
              </header>

              {limitations.length === 0 ? (
                <div className="fv2-report-viz-issue-empty">
                  <CheckCircle2 size={28} />
                  <span>None recorded</span>
                </div>
              ) : (
                <div className="fv2-report-viz-issue-list">
                  {limitations.map((item, index) => (
                    <article key={item}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="fv2-report-viz-issues">
              <header>
                <FileSearch size={19} />

                <div>
                  <span>Unresolved matters</span>
                  <strong>
                    {unresolved.length}
                    {" "}
                    question(s)
                  </strong>
                </div>
              </header>

              {unresolved.length === 0 ? (
                <div className="fv2-report-viz-issue-empty">
                  <CheckCircle2 size={28} />
                  <span>None recorded</span>
                </div>
              ) : (
                <div className="fv2-report-viz-issue-list">
                  {unresolved.map((item, index) => (
                    <article key={item}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="fv2-report-viz-signoff">
            <header>
              <ShieldCheck size={20} />

              <div>
                <span>Declaration and sign-off</span>
                <strong>Human accountability</strong>
              </div>

              <div
                className={`fv2-report-viz-declaration-state ${
                  report.declarationAccepted
                    ? "is-accepted"
                    : ""
                }`}
              >
                <span>
                  {report.declarationAccepted
                    ? "DECLARED"
                    : "PENDING"}
                </span>
              </div>
            </header>

            <div className="fv2-report-viz-signoff-grid">
              <label>
                <PersonStanding size={22} />

                <div>
                  <span>Prepared by</span>
                  <input
                    value={report.preparedBy}
                    onChange={(event) =>
                      patch({
                        preparedBy: event.target.value,
                      })
                    }
                  />
                </div>
              </label>

              <label>
                <Users size={22} />

                <div>
                  <span>Reviewed by</span>
                  <input
                    value={report.reviewedBy}
                    onChange={(event) =>
                      patch({
                        reviewedBy: event.target.value,
                      })
                    }
                  />
                </div>
              </label>
            </div>

            <label className="fv2-report-viz-declaration">
              <input
                type="checkbox"
                checked={report.declarationAccepted}
                onChange={(event) =>
                  patch({
                    declarationAccepted:
                      event.target.checked,
                  })
                }
              />

              <ShieldCheck size={24} />

              <div>
                <strong>Investigator declaration</strong>
                <span>
                  I confirm that source observations and measurements
                  are distinguished from calculated, assumed,
                  AI-derived and simulated material, and that material
                  limitations have not knowingly been omitted.
                </span>
              </div>
            </label>
          </section>
        </main>

        <aside className="fv2-report-viz-inspector">
          <section className="fv2-report-viz-inspector-module">
            <header>
              <Database size={19} />

              <div>
                <span>Source totals</span>
                <strong>{investigation.caseNumber}</strong>
              </div>
            </header>

            <div className="fv2-report-viz-source-grid">
              <article>
                <ScanLine size={23} />
                <span>Evidence</span>
                <strong>{investigation.evidence.length}</strong>
              </article>

              <article>
                <Gauge size={23} />
                <span>Measurements</span>
                <strong>
                  {investigation.measurements.length}
                </strong>
              </article>

              <article>
                <CarFront size={23} />
                <span>Vehicles</span>
                <strong>{investigation.vehicles.length}</strong>
              </article>

              <article>
                <PersonStanding size={23} />
                <span>Persons</span>
                <strong>{investigation.persons.length}</strong>
              </article>

              <article>
                <Users size={23} />
                <span>Witnesses</span>
                <strong>{investigation.witnesses.length}</strong>
              </article>

              <article>
                <BarChart3 size={23} />
                <span>Analysis</span>
                <strong>
                  {investigation.analysisFindings.length}
                </strong>
              </article>

              <article>
                <Orbit size={23} />
                <span>Hypotheses</span>
                <strong>{investigation.hypotheses.length}</strong>
              </article>

              <article>
                <Play size={23} />
                <span>Simulations</span>
                <strong>{runs.length}</strong>
              </article>
            </div>
          </section>

          <section className="fv2-report-viz-inspector-module">
            <header>
              <Waypoints size={19} />

              <div>
                <span>Derived lineage</span>
                <strong>Canonical reconstruction</strong>
              </div>
            </header>

            {manifest ? (
              <div className="fv2-report-viz-lineage">
                <div>
                  <Orbit size={18} />
                  <span>Hypothesis</span>
                  <strong>{manifest.hypothesisCode}</strong>
                </div>

                <div>
                  <Play size={18} />
                  <span>Simulation</span>
                  <strong>{manifest.simulationRunCode}</strong>
                </div>

                <div>
                  <ShieldCheck size={18} />
                  <span>Provenance</span>
                  <strong>{manifest.provenance}</strong>
                </div>

                <div>
                  <Waypoints size={18} />
                  <span>Reconstruction</span>
                  <strong
                    title={manifest.reconstructionId}
                  >
                    {manifest.reconstructionId}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="fv2-report-viz-empty compact">
                <Waypoints size={34} />
                <strong>No canonical lineage</strong>
              </div>
            )}
          </section>

          <section className="fv2-report-viz-inspector-module fv2-report-viz-actions">
            <header>
              <FileText size={19} />

              <div>
                <span>Report actions</span>
                <strong>{report.status}</strong>
              </div>
            </header>

            <div className="fv2-report-viz-action-grid">
              <button
                type="button"
                onClick={() => changeStatus("Draft")}
              >
                <Save size={18} />
                <span>Draft</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  changeStatus("Ready for review")
                }
              >
                <FileSearch size={18} />
                <span>Review</span>
              </button>

              <button
                type="button"
                className="primary"
                disabled={!finalReady}
                onClick={() => changeStatus("Final")}
              >
                <ShieldCheck size={18} />
                <span>Finalise</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    saveRecommendations();
                    const current =
                      ForensicReportService.getByCaseId(
                        investigation.caseId,
                      ) ?? report;

                    ForensicReportService.openPrintable(
                      investigation,
                      current,
                    );
                  } catch (error) {
                    message(
                      error instanceof Error
                        ? error.message
                        : "Print view could not be opened.",
                    );
                  }
                }}
              >
                <Printer size={18} />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  saveRecommendations();

                  const current =
                    ForensicReportService.getByCaseId(
                      investigation.caseId,
                    ) ?? report;

                  ForensicReportService.downloadWord(
                    investigation,
                    current,
                  );
                }}
              >
                <Download size={18} />
                <span>Word</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  saveRecommendations();

                  const current =
                    ForensicReportService.getByCaseId(
                      investigation.caseId,
                    ) ?? report;

                  ForensicReportService.downloadJson(
                    investigation,
                    current,
                  );
                }}
              >
                <Database size={18} />
                <span>JSON</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );

}
