import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ForensicAccidentInvestigation,
} from "./forensicInvestigationTypes";
import {
  ForensicFindingsService,
} from "./forensicFindingsService";
import {
  ForensicSimulationService,
} from "./forensicSimulationService";
import {
  ForensicCanonicalReconstructionService,
} from "./forensicCanonicalReconstructionService";
import {
  ForensicReportService,
} from "./forensicReportService";
import type {
  ForensicReportRecord,
  ForensicReportStatus,
} from "./forensicReportTypes";
import "./ReportWorkspace.css";

interface Props {
  investigation: ForensicAccidentInvestigation;
  onMessage?(message: string): void;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(values: string[]): string {
  return values.join("\n");
}

export default function ReportWorkspace({
  investigation,
  onMessage,
}: Props) {
  const [report, setReport] =
    useState<ForensicReportRecord>(() =>
      ForensicReportService.getOrCreate(investigation),
    );

  const [recommendationsText, setRecommendationsText] =
    useState(joinLines(report.recommendations));

  const allFindings = useMemo(
    () => ForensicFindingsService.getByCaseId(investigation.caseId),
    [investigation.caseId],
  );

  const readyFindings = useMemo(
    () =>
      allFindings.filter(
        (finding) =>
          finding.reviewStatus === "Ready for report" &&
          finding.includeInReport,
      ),
    [allFindings],
  );

  const simulationRuns = useMemo(
    () => ForensicSimulationService.getByCaseId(investigation.caseId),
    [investigation.caseId],
  );

  const canonicalManifest = useMemo(
    () =>
      ForensicCanonicalReconstructionService.getManifest(
        investigation.caseId,
      ),
    [investigation.caseId],
  );

  useEffect(() => {
    const synced = ForensicReportService.syncReadyFindings(investigation);
    setReport(synced);
    setRecommendationsText(joinLines(synced.recommendations));
  }, [investigation]);

  const includedFindings = readyFindings.filter((finding) =>
    report.includedFindingIds.includes(finding.id),
  );

  const unresolvedQuestions = Array.from(
    new Set(allFindings.flatMap((finding) => finding.unresolvedQuestions)),
  );

  const limitations = Array.from(
    new Set(allFindings.flatMap((finding) => finding.limitations)),
  );

  const gates = [
    {
      label: "Case identity",
      ok: Boolean(
        investigation.caseNumber.trim() &&
          investigation.scene.location.trim() &&
          investigation.investigatingOfficer.trim(),
      ),
      detail: "Case number, location and investigating officer recorded",
    },
    {
      label: "Report-ready findings",
      ok: includedFindings.length > 0,
      detail: `${includedFindings.length} included final finding(s)`,
    },
    {
      label: "Reconstruction lineage",
      ok:
        simulationRuns.length === 0 ||
        Boolean(canonicalManifest),
      detail:
        simulationRuns.length === 0
          ? "No simulation used"
          : canonicalManifest
            ? `${canonicalManifest.hypothesisCode} → ${canonicalManifest.simulationRunCode}`
            : "Simulation exists but no canonical reconstruction is registered",
    },
    {
      label: "Investigator declaration",
      ok: report.declarationAccepted,
      detail: report.declarationAccepted
        ? "Accepted"
        : "Not yet accepted",
    },
  ];

  const gatePassCount = gates.filter((gate) => gate.ok).length;
  const finalReady =
    gatePassCount === gates.length &&
    report.executiveSummary.trim().length > 0 &&
    report.conclusion.trim().length > 0 &&
    report.preparedBy.trim().length > 0;

  const message = (value: string) => onMessage?.(value);

  const patchReport = (
    patch: Partial<
      Omit<
        ForensicReportRecord,
        "id" | "caseId" | "caseNumber" | "createdAt"
      >
    >,
  ) => {
    const updated = ForensicReportService.update(
      investigation.caseId,
      patch,
    );

    if (updated) {
      setReport(updated);
    }
  };

  const saveRecommendations = () => {
    patchReport({
      recommendations: splitLines(recommendationsText),
    });
  };

  const changeStatus = (status: ForensicReportStatus) => {
    try {
      saveRecommendations();
      const updated = ForensicReportService.setStatus(
        investigation,
        status,
      );
      setReport(updated);
      message(
        status === "Final"
          ? "Forensic report finalised."
          : `Report status changed to ${status}.`,
      );
    } catch (error) {
      message(
        error instanceof Error
          ? error.message
          : "Report status could not be changed.",
      );
    }
  };

  const printReport = () => {
    try {
      saveRecommendations();
      const current =
        ForensicReportService.getByCaseId(investigation.caseId) ?? report;
      ForensicReportService.openPrintable(investigation, current);
    } catch (error) {
      message(
        error instanceof Error
          ? error.message
          : "Printable report could not be opened.",
      );
    }
  };

  const downloadWord = () => {
    saveRecommendations();
    const current =
      ForensicReportService.getByCaseId(investigation.caseId) ?? report;
    ForensicReportService.downloadWord(investigation, current);
    message("Forensic report Word export created.");
  };

  const downloadJson = () => {
    saveRecommendations();
    const current =
      ForensicReportService.getByCaseId(investigation.caseId) ?? report;
    ForensicReportService.downloadJson(investigation, current);
    message("Forensic report JSON audit export created.");
  };

  return (
    <div className="fv2-stack fv2-report-workstation">
      <section className="fv2-panel fv2-report-hero">
        <header>
          <div>
            <span>Formal forensic output</span>
            <strong>Build the report from reviewed findings—not from visual plausibility</strong>
          </div>

          <div className="fv2-report-summary">
            <span>{report.code}</span>
            <span>{report.status}</span>
            <span>{includedFindings.length} finding(s) included</span>
          </div>
        </header>

        <div className="fv2-report-rule">
          The report is the final communication layer. Evidence remains evidence;
          calculations remain calculated; assumptions remain assumptions; simulation
          remains simulated. A final report may explain which hypothesis is best
          supported, but RoadSafe does not automatically assign legal guilt or liability.
        </div>

        <div className="fv2-report-flow">
          <div>Evidence</div>
          <span>→</span>
          <div>Analysis</div>
          <span>→</span>
          <div>Hypotheses</div>
          <span>→</span>
          <div>Simulation / Reconstruction</div>
          <span>→</span>
          <div>Findings</div>
          <span>→</span>
          <div className="active">Report</div>
        </div>
      </section>

      <div className="fv2-report-layout">
        <div className="fv2-report-main">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Report readiness</span>
                <strong>{gatePassCount}/{gates.length} forensic gates passed</strong>
              </div>
              <div className={finalReady ? "fv2-report-ready yes" : "fv2-report-ready"}>
                {finalReady ? "READY TO FINALISE" : "DRAFT / REVIEW REQUIRED"}
              </div>
            </header>

            <div className="fv2-report-gates">
              {gates.map((gate) => (
                <article key={gate.label} className={gate.ok ? "pass" : "fail"}>
                  <span>{gate.ok ? "✓" : "!"}</span>
                  <div>
                    <strong>{gate.label}</strong>
                    <small>{gate.detail}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Report composition</span>
                <strong>Investigator-authored narrative</strong>
              </div>
            </header>

            <div className="fv2-report-form">
              <label className="fv2-field full">
                <span>Report title</span>
                <input
                  value={report.title}
                  onChange={(event) =>
                    patchReport({ title: event.target.value })
                  }
                />
              </label>

              <label className="fv2-field full">
                <span>Executive summary</span>
                <textarea
                  rows={6}
                  value={report.executiveSummary}
                  onChange={(event) =>
                    patchReport({ executiveSummary: event.target.value })
                  }
                  placeholder="Summarise what was investigated, the principal evidence and the overall supported outcome without overstating certainty."
                />
              </label>

              <label className="fv2-field full">
                <span>Scope and methodology</span>
                <textarea
                  rows={6}
                  value={report.methodologySummary}
                  onChange={(event) =>
                    patchReport({ methodologySummary: event.target.value })
                  }
                />
              </label>

              <label className="fv2-field full">
                <span>Investigator conclusion</span>
                <textarea
                  rows={6}
                  value={report.conclusion}
                  onChange={(event) =>
                    patchReport({ conclusion: event.target.value })
                  }
                  placeholder="State the best-supported technical conclusion, its confidence and any material caveats. Do not automatically assign legal guilt."
                />
              </label>

              <label className="fv2-field full">
                <span>Recommendations / follow-up — one per line</span>
                <textarea
                  rows={5}
                  value={recommendationsText}
                  onChange={(event) =>
                    setRecommendationsText(event.target.value)
                  }
                  onBlur={saveRecommendations}
                  placeholder={"Obtain pending specialist result\nVerify CCTV timing calibration\nConduct road engineering inspection"}
                />
              </label>
            </div>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Included findings</span>
                <strong>Only findings marked Ready for report</strong>
              </div>
            </header>

            {includedFindings.length === 0 ? (
              <div className="fv2-empty">
                No final findings are currently marked Ready for report.
              </div>
            ) : (
              <div className="fv2-report-findings">
                {includedFindings.map((finding) => (
                  <article key={finding.id}>
                    <div className="fv2-report-finding-head">
                      <div>
                        <span>{finding.code} · {finding.category}</span>
                        <strong>{finding.statement}</strong>
                      </div>
                      <div>
                        <b>{finding.disposition}</b>
                        <b>{finding.confidence}</b>
                        <b>{finding.provenance}</b>
                      </div>
                    </div>

                    <p>{finding.rationale || "No rationale recorded."}</p>

                    <div className="fv2-report-finding-meta">
                      <span>
                        {finding.limitations.length} limitation(s)
                      </span>
                      <span>
                        {finding.unresolvedQuestions.length} unresolved question(s)
                      </span>
                      <span>
                        {finding.supportingEvidenceIds.length +
                          finding.supportingAnalysisFindingIds.length +
                          finding.sourceMeasurementIds.length +
                          finding.sourceHypothesisIds.length +
                          finding.sourceSimulationRunIds.length +
                          (finding.canonicalReconstructionId ? 1 : 0)} source link(s)
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Limitations and unresolved matters</span>
                <strong>Must travel with the conclusion</strong>
              </div>
            </header>

            <div className="fv2-report-two">
              <div>
                <h3>Limitations</h3>
                {limitations.length === 0 ? (
                  <p>No limitations recorded in final findings.</p>
                ) : (
                  <ul>
                    {limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3>Unresolved questions</h3>
                {unresolvedQuestions.length === 0 ? (
                  <p>No unresolved questions recorded.</p>
                ) : (
                  <ul>
                    {unresolvedQuestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Declaration and sign-off</span>
                <strong>Human accountability remains explicit</strong>
              </div>
            </header>

            <div className="fv2-report-signoff">
              <div className="fv2-report-two-fields">
                <label className="fv2-field">
                  <span>Prepared by</span>
                  <input
                    value={report.preparedBy}
                    onChange={(event) =>
                      patchReport({ preparedBy: event.target.value })
                    }
                  />
                </label>

                <label className="fv2-field">
                  <span>Reviewed by</span>
                  <input
                    value={report.reviewedBy}
                    onChange={(event) =>
                      patchReport({ reviewedBy: event.target.value })
                    }
                    placeholder="Supervisor / reviewing officer"
                  />
                </label>
              </div>

              <label className="fv2-report-declaration">
                <input
                  type="checkbox"
                  checked={report.declarationAccepted}
                  onChange={(event) =>
                    patchReport({
                      declarationAccepted: event.target.checked,
                    })
                  }
                />
                <span>
                  I confirm that this report distinguishes source observations and
                  measurements from calculated, assumed, AI-derived and simulated
                  material; that material limitations have not knowingly been omitted;
                  and that RoadSafe output has not been treated as an automatic legal
                  determination of guilt or liability.
                </span>
              </label>
            </div>
          </section>
        </div>

        <aside className="fv2-report-side">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Case record</span>
                <strong>{investigation.caseNumber}</strong>
              </div>
            </header>

            <dl className="fv2-report-case">
              <div>
                <dt>Title</dt>
                <dd>{investigation.caseTitle}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{investigation.scene.location || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{investigation.scene.accidentDate || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{investigation.scene.accidentTime || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Officer</dt>
                <dd>{investigation.investigatingOfficer || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Station</dt>
                <dd>{investigation.policeStation || "Not recorded"}</dd>
              </div>
            </dl>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Evidence basis</span>
                <strong>Source totals</strong>
              </div>
            </header>

            <div className="fv2-report-counts">
              {[
                ["Evidence", investigation.evidence.length],
                ["Measurements", investigation.measurements.length],
                ["Vehicles", investigation.vehicles.length],
                ["Persons", investigation.persons.length],
                ["Witnesses", investigation.witnesses.length],
                ["Analysis findings", investigation.analysisFindings.length],
                ["Hypotheses", investigation.hypotheses.length],
                ["Simulation runs", simulationRuns.length],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Derived lineage</span>
                <strong>Canonical reconstruction</strong>
              </div>
            </header>

            {canonicalManifest ? (
              <dl className="fv2-report-case">
                <div>
                  <dt>Hypothesis</dt>
                  <dd>{canonicalManifest.hypothesisCode}</dd>
                </div>
                <div>
                  <dt>Simulation</dt>
                  <dd>{canonicalManifest.simulationRunCode}</dd>
                </div>
                <div>
                  <dt>Provenance</dt>
                  <dd>{canonicalManifest.provenance}</dd>
                </div>
                <div>
                  <dt>Reconstruction</dt>
                  <dd title={canonicalManifest.reconstructionId}>
                    {canonicalManifest.reconstructionId}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="fv2-empty">
                No canonical reconstruction lineage recorded.
              </div>
            )}
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Report actions</span>
                <strong>{report.status}</strong>
              </div>
            </header>

            <div className="fv2-report-actions">
              <button
                type="button"
                onClick={() => changeStatus("Draft")}
              >
                Save as draft
              </button>

              <button
                type="button"
                onClick={() => changeStatus("Ready for review")}
              >
                Mark ready for review
              </button>

              <button
                type="button"
                className="primary"
                disabled={!finalReady}
                onClick={() => changeStatus("Final")}
              >
                Finalise report
              </button>

              <hr />

              <button type="button" onClick={printReport}>
                Print / Save PDF
              </button>

              <button type="button" onClick={downloadWord}>
                Export Word
              </button>

              <button type="button" onClick={downloadJson}>
                Export JSON audit
              </button>
            </div>
          </section>

          <section className="fv2-panel fv2-notice">
            <b>Report rule</b>
            <p>
              A final report is an accountable investigator product. RoadSafe can
              organise, calculate and visualise evidence, but the human investigator
              remains responsible for the report's conclusions and declared limitations.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
