import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  ForensicAccidentInvestigation,
  ForensicConfidence,
} from "./forensicInvestigationTypes";
import {
  FORENSIC_CONFIDENCE_OPTIONS,
} from "./forensicInvestigationTypes";
import {
  FINAL_FINDING_CATEGORY_OPTIONS,
  FINAL_FINDING_DISPOSITION_OPTIONS,
  FINAL_FINDING_PROVENANCE_OPTIONS,
  FINAL_FINDING_REVIEW_STATUS_OPTIONS,
  type FinalFindingCategory,
  type FinalFindingDisposition,
  type FinalFindingDerivedProvenance,
  type FinalFindingReviewStatus,
  type ForensicFinalFinding,
} from "./forensicFindingsTypes";
import { ForensicFindingsService } from "./forensicFindingsService";
import { ForensicSimulationService } from "./forensicSimulationService";
import {
  ForensicCanonicalReconstructionService,
} from "./forensicCanonicalReconstructionService";
import "./FindingsWorkspace.css";

interface Props {
  investigation: ForensicAccidentInvestigation;
  onMessage?(message: string): void;
}

type LinkMode = "support" | "conflict";

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sourceCount(finding: ForensicFinalFinding): number {
  return (
    finding.supportingEvidenceIds.length +
    finding.supportingAnalysisFindingIds.length +
    finding.sourceMeasurementIds.length +
    finding.sourceHypothesisIds.length +
    finding.sourceSimulationRunIds.length +
    (finding.canonicalReconstructionId ? 1 : 0)
  );
}

function conflictCount(finding: ForensicFinalFinding): number {
  return (
    finding.conflictingEvidenceIds.length +
    finding.conflictingAnalysisFindingIds.length
  );
}

function readinessScore(finding: ForensicFinalFinding): number {
  let score = 0;
  if (finding.statement.trim()) score += 25;
  if (sourceCount(finding) > 0) score += 25;
  if (finding.rationale.trim()) score += 15;
  if (finding.confidence !== "Unverified") score += 10;
  if (finding.disposition !== "Deferred") score += 10;
  if (conflictCount(finding) === 0 || finding.limitations.length > 0) score += 10;
  if (finding.unresolvedQuestions.length === 0) score += 5;
  return Math.min(100, score);
}

export default function FindingsWorkspace({
  investigation,
  onMessage,
}: Props) {
  const [findings, setFindings] = useState<ForensicFinalFinding[]>([]);
  const [category, setCategory] = useState<FinalFindingCategory>("Crash sequence");
  const [statement, setStatement] = useState("");
  const [disposition, setDisposition] = useState<FinalFindingDisposition>("Supported");
  const [confidence, setConfidence] = useState<ForensicConfidence>("Moderate");
  const [provenance, setProvenance] = useState<FinalFindingDerivedProvenance>(
    "Investigator Assumption",
  );
  const [reviewStatus, setReviewStatus] = useState<FinalFindingReviewStatus>("Draft");
  const [rationale, setRationale] = useState("");
  const [limitationsText, setLimitationsText] = useState("");
  const [unresolvedText, setUnresolvedText] = useState("");
  const [includeInReport, setIncludeInReport] = useState(false);

  const [supportingEvidenceIds, setSupportingEvidenceIds] = useState<Set<string>>(
    new Set(),
  );
  const [conflictingEvidenceIds, setConflictingEvidenceIds] = useState<Set<string>>(
    new Set(),
  );
  const [supportingAnalysisFindingIds, setSupportingAnalysisFindingIds] = useState<Set<string>>(
    new Set(),
  );
  const [conflictingAnalysisFindingIds, setConflictingAnalysisFindingIds] = useState<Set<string>>(
    new Set(),
  );
  const [sourceMeasurementIds, setSourceMeasurementIds] = useState<Set<string>>(new Set());
  const [sourceHypothesisIds, setSourceHypothesisIds] = useState<Set<string>>(new Set());
  const [sourceSimulationRunIds, setSourceSimulationRunIds] = useState<Set<string>>(
    new Set(),
  );
  const [useCanonicalReconstruction, setUseCanonicalReconstruction] = useState(false);

  const simulationRuns = useMemo(
    () => ForensicSimulationService.getByCaseId(investigation.caseId),
    [investigation.caseId],
  );

  const canonicalManifest = useMemo(
    () => ForensicCanonicalReconstructionService.getManifest(investigation.caseId),
    [investigation.caseId],
  );

  useEffect(() => {
    setFindings(ForensicFindingsService.getByCaseId(investigation.caseId));
  }, [investigation.caseId]);

  const readyCount = findings.filter(
    (finding) => finding.reviewStatus === "Ready for report" && finding.includeInReport,
  ).length;
  const unresolvedCount = findings.reduce(
    (total, finding) => total + finding.unresolvedQuestions.length,
    0,
  );
  const supportedCount = findings.filter(
    (finding) => finding.disposition === "Supported",
  ).length;

  const message = (value: string) => onMessage?.(value);

  const refresh = () => {
    setFindings(ForensicFindingsService.getByCaseId(investigation.caseId));
  };

  const toggleSet = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExclusive = (
    id: string,
    mode: LinkMode,
    supportSetter: Dispatch<SetStateAction<Set<string>>>,
    conflictSetter: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    if (mode === "support") {
      supportSetter((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      conflictSetter((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    conflictSetter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    supportSetter((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const resetComposer = () => {
    setCategory("Crash sequence");
    setStatement("");
    setDisposition("Supported");
    setConfidence("Moderate");
    setProvenance("Investigator Assumption");
    setReviewStatus("Draft");
    setRationale("");
    setLimitationsText("");
    setUnresolvedText("");
    setIncludeInReport(false);
    setSupportingEvidenceIds(new Set());
    setConflictingEvidenceIds(new Set());
    setSupportingAnalysisFindingIds(new Set());
    setConflictingAnalysisFindingIds(new Set());
    setSourceMeasurementIds(new Set());
    setSourceHypothesisIds(new Set());
    setSourceSimulationRunIds(new Set());
    setUseCanonicalReconstruction(false);
  };

  const addFinding = () => {
    if (!statement.trim()) {
      message("Write the finding statement before saving it.");
      return;
    }

    const totalSources =
      supportingEvidenceIds.size +
      supportingAnalysisFindingIds.size +
      sourceMeasurementIds.size +
      sourceHypothesisIds.size +
      sourceSimulationRunIds.size +
      (useCanonicalReconstruction && canonicalManifest ? 1 : 0);

    if (totalSources === 0) {
      message("Link at least one source before saving a final finding.");
      return;
    }

    if (
      (conflictingEvidenceIds.size > 0 || conflictingAnalysisFindingIds.size > 0) &&
      splitLines(limitationsText).length === 0
    ) {
      message("Record a limitation when a finding has conflicting source material.");
      return;
    }

    const effectiveReviewStatus = includeInReport ? "Ready for report" : reviewStatus;

    ForensicFindingsService.add({
      caseId: investigation.caseId,
      caseNumber: investigation.caseNumber,
      category,
      statement: statement.trim(),
      disposition,
      confidence,
      provenance,
      supportingEvidenceIds: [...supportingEvidenceIds],
      conflictingEvidenceIds: [...conflictingEvidenceIds],
      supportingAnalysisFindingIds: [...supportingAnalysisFindingIds],
      conflictingAnalysisFindingIds: [...conflictingAnalysisFindingIds],
      sourceMeasurementIds: [...sourceMeasurementIds],
      sourceHypothesisIds: [...sourceHypothesisIds],
      sourceSimulationRunIds: [...sourceSimulationRunIds],
      canonicalReconstructionId:
        useCanonicalReconstruction && canonicalManifest
          ? canonicalManifest.reconstructionId
          : undefined,
      rationale: rationale.trim(),
      limitations: splitLines(limitationsText),
      unresolvedQuestions: splitLines(unresolvedText),
      reviewStatus: effectiveReviewStatus,
      includeInReport: includeInReport || effectiveReviewStatus === "Ready for report",
    });

    refresh();
    resetComposer();
    message("Final finding saved with its source lineage.");
  };

  const setFindingStatus = (
    finding: ForensicFinalFinding,
    nextStatus: FinalFindingReviewStatus,
  ) => {
    ForensicFindingsService.setReviewStatus(finding.id, nextStatus);
    refresh();
    message(`${finding.code} set to ${nextStatus}.`);
  };

  const removeFinding = (finding: ForensicFinalFinding) => {
    ForensicFindingsService.delete(finding.id);
    refresh();
    message(`${finding.code} removed.`);
  };

  const analysisCode = (id: string) =>
    investigation.analysisFindings.find((finding) => finding.id === id)?.code ?? id;
  const evidenceCode = (id: string) =>
    investigation.evidence.find((record) => record.id === id)?.code ?? id;
  const measurementCode = (id: string) =>
    investigation.measurements.find((record) => record.id === id)?.code ?? id;
  const hypothesisCode = (id: string) =>
    investigation.hypotheses.find((record) => record.id === id)?.code ?? id;
  const simulationCode = (id: string) =>
    simulationRuns.find((record) => record.id === id)?.code ?? id;

  return (
    <div className="fv2-stack fv2-findings-workstation">
      <section className="fv2-panel fv2-findings-hero">
        <header>
          <div>
            <span>Final forensic findings</span>
            <strong>State only what the current evidence can support</strong>
          </div>
          <div className="fv2-findings-summary">
            <span>{findings.length} finding(s)</span>
            <span>{supportedCount} supported</span>
            <span>{readyCount} report-ready</span>
            <span>{unresolvedCount} unresolved question(s)</span>
          </div>
        </header>

        <div className="fv2-findings-rule">
          Findings are derived conclusions. They must remain traceable to their evidence,
          analysis, hypothesis and simulation sources. RoadSafe does not convert a simulated
          reconstruction into an observed fact, and it does not assign legal guilt.
        </div>

        <div className="fv2-findings-flow">
          <div>Evidence</div><span>→</span>
          <div>Analysis</div><span>→</span>
          <div>Hypotheses</div><span>→</span>
          <div>Simulation / Reconstruction</div><span>→</span>
          <div className="active">Findings</div><span>→</span>
          <div>Report</div>
        </div>
      </section>

      <div className="fv2-findings-layout">
        <div className="fv2-findings-main">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Findings register</span>
                <strong>Evidence-backed conclusions and unresolved issues</strong>
              </div>
            </header>

            {findings.length === 0 ? (
              <div className="fv2-findings-empty">
                <strong>No final findings recorded yet.</strong>
                <span>
                  Use the composer to create conclusions only after linking the source material
                  that supports or conflicts with each statement.
                </span>
              </div>
            ) : (
              <div className="fv2-findings-card-grid">
                {findings.map((finding) => {
                  const readiness = readinessScore(finding);
                  const support = sourceCount(finding);
                  const conflicts = conflictCount(finding);

                  return (
                    <article key={finding.id} className="fv2-finding-card">
                      <div className="fv2-finding-card-head">
                        <div>
                          <span>{finding.code} · {finding.category}</span>
                          <strong>{finding.statement}</strong>
                        </div>
                        <div className="fv2-finding-badges">
                          <span>{finding.disposition}</span>
                          <span>{finding.confidence}</span>
                          <span>{finding.provenance}</span>
                        </div>
                      </div>

                      <div className="fv2-finding-metrics">
                        <div>
                          <span>Sources</span>
                          <strong>{support}</strong>
                        </div>
                        <div className={conflicts > 0 ? "conflict" : ""}>
                          <span>Conflicts</span>
                          <strong>{conflicts}</strong>
                        </div>
                        <div className={finding.limitations.length > 0 ? "attention" : ""}>
                          <span>Limitations</span>
                          <strong>{finding.limitations.length}</strong>
                        </div>
                        <div className={finding.unresolvedQuestions.length > 0 ? "attention" : ""}>
                          <span>Unresolved</span>
                          <strong>{finding.unresolvedQuestions.length}</strong>
                        </div>
                      </div>

                      {finding.rationale && (
                        <div className="fv2-finding-rationale">
                          <span>Investigator rationale</span>
                          <p>{finding.rationale}</p>
                        </div>
                      )}

                      <div className="fv2-finding-source-chips">
                        {finding.supportingEvidenceIds.map((id) => (
                          <span key={`se-${id}`} className="support">+ {evidenceCode(id)}</span>
                        ))}
                        {finding.conflictingEvidenceIds.map((id) => (
                          <span key={`ce-${id}`} className="conflict">− {evidenceCode(id)}</span>
                        ))}
                        {finding.supportingAnalysisFindingIds.map((id) => (
                          <span key={`sa-${id}`} className="support">+ {analysisCode(id)}</span>
                        ))}
                        {finding.conflictingAnalysisFindingIds.map((id) => (
                          <span key={`ca-${id}`} className="conflict">− {analysisCode(id)}</span>
                        ))}
                        {finding.sourceMeasurementIds.map((id) => (
                          <span key={`m-${id}`}>{measurementCode(id)}</span>
                        ))}
                        {finding.sourceHypothesisIds.map((id) => (
                          <span key={`h-${id}`}>{hypothesisCode(id)}</span>
                        ))}
                        {finding.sourceSimulationRunIds.map((id) => (
                          <span key={`s-${id}`}>{simulationCode(id)}</span>
                        ))}
                        {finding.canonicalReconstructionId && (
                          <span>Canonical reconstruction</span>
                        )}
                      </div>

                      {finding.limitations.length > 0 && (
                        <div className="fv2-finding-list">
                          <span>Limitations</span>
                          <ul>
                            {finding.limitations.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      )}

                      {finding.unresolvedQuestions.length > 0 && (
                        <div className="fv2-finding-list unresolved">
                          <span>Unresolved questions</span>
                          <ul>
                            {finding.unresolvedQuestions.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      )}

                      <div className="fv2-finding-readiness">
                        <div>
                          <span>Finding readiness</span>
                          <strong>{readiness}%</strong>
                        </div>
                        <div className="fv2-finding-readiness-track">
                          <i style={{ width: `${readiness}%` }} />
                        </div>
                      </div>

                      <div className="fv2-finding-report-state">
                        <span>Report status</span>
                        <strong>{finding.reviewStatus}</strong>
                        <small>
                          {finding.includeInReport
                            ? "Included in report dataset"
                            : "Not included in report dataset"}
                        </small>
                      </div>

                      <div className="fv2-finding-actions">
                        {FINAL_FINDING_REVIEW_STATUS_OPTIONS.map((statusOption) => (
                          <button
                            key={statusOption}
                            type="button"
                            className={finding.reviewStatus === statusOption ? "active" : ""}
                            onClick={() => setFindingStatus(finding, statusOption)}
                          >
                            {statusOption}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeFinding(finding)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Report-readiness matrix</span>
                <strong>What can move forward and what still needs work</strong>
              </div>
            </header>

            <div className="fv2-findings-matrix">
              <div className="head">Finding</div>
              <div className="head">Disposition</div>
              <div className="head">Confidence</div>
              <div className="head">Sources</div>
              <div className="head">Unresolved</div>
              <div className="head">Report</div>

              {findings.map((finding) => (
                <div key={`row-${finding.id}`} className="row-group">
                  <div><strong>{finding.code}</strong><span>{finding.category}</span></div>
                  <div>{finding.disposition}</div>
                  <div>{finding.confidence}</div>
                  <div>{sourceCount(finding)}</div>
                  <div>{finding.unresolvedQuestions.length}</div>
                  <div>{finding.includeInReport ? "Include" : "Hold"}</div>
                </div>
              ))}

              {findings.length === 0 && (
                <div className="fv2-findings-matrix-empty">No findings to assess yet.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="fv2-findings-composer">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Finding composer</span>
                <strong>Create a traceable final conclusion</strong>
              </div>
            </header>

            <div className="fv2-findings-form">
              <label className="fv2-field full">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FinalFindingCategory)}
                >
                  {FINAL_FINDING_CATEGORY_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label className="fv2-field full">
                <span>Finding statement</span>
                <textarea
                  rows={5}
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                  placeholder="State the conclusion precisely and avoid claiming more than the linked sources support."
                />
              </label>

              <div className="fv2-findings-two">
                <label className="fv2-field">
                  <span>Disposition</span>
                  <select
                    value={disposition}
                    onChange={(event) => setDisposition(event.target.value as FinalFindingDisposition)}
                  >
                    {FINAL_FINDING_DISPOSITION_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="fv2-field">
                  <span>Confidence</span>
                  <select
                    value={confidence}
                    onChange={(event) => setConfidence(event.target.value as ForensicConfidence)}
                  >
                    {FORENSIC_CONFIDENCE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <label className="fv2-field full">
                <span>Derived provenance</span>
                <select
                  value={provenance}
                  onChange={(event) => setProvenance(event.target.value as FinalFindingDerivedProvenance)}
                >
                  {FINAL_FINDING_PROVENANCE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
                <small className="fv2-help">
                  Observed and Measured records stay in their original registers. Findings are derived records.
                </small>
              </label>

              <div className="fv2-findings-link-section">
                <div className="fv2-findings-section-title">
                  <span>Physical evidence</span>
                  <small>Supports or conflicts</small>
                </div>
                <div className="fv2-findings-link-list">
                  {investigation.evidence.map((record) => (
                    <article key={record.id}>
                      <div>
                        <strong>{record.code} · {record.type}</strong>
                        <span>{record.description}</span>
                      </div>
                      <div className="fv2-findings-link-actions">
                        <button
                          type="button"
                          className={supportingEvidenceIds.has(record.id) ? "support active" : "support"}
                          onClick={() => toggleExclusive(
                            record.id,
                            "support",
                            setSupportingEvidenceIds,
                            setConflictingEvidenceIds,
                          )}
                        >
                          Supports
                        </button>
                        <button
                          type="button"
                          className={conflictingEvidenceIds.has(record.id) ? "conflict active" : "conflict"}
                          onClick={() => toggleExclusive(
                            record.id,
                            "conflict",
                            setSupportingEvidenceIds,
                            setConflictingEvidenceIds,
                          )}
                        >
                          Conflicts
                        </button>
                      </div>
                    </article>
                  ))}
                  {investigation.evidence.length === 0 && <small>No evidence records available.</small>}
                </div>
              </div>

              <div className="fv2-findings-link-section">
                <div className="fv2-findings-section-title">
                  <span>Analysis findings</span>
                  <small>Supports or conflicts</small>
                </div>
                <div className="fv2-findings-link-list">
                  {investigation.analysisFindings.map((finding) => (
                    <article key={finding.id}>
                      <div>
                        <strong>{finding.code} · {finding.category}</strong>
                        <span>{finding.finding}</span>
                      </div>
                      <div className="fv2-findings-link-actions">
                        <button
                          type="button"
                          className={supportingAnalysisFindingIds.has(finding.id) ? "support active" : "support"}
                          onClick={() => toggleExclusive(
                            finding.id,
                            "support",
                            setSupportingAnalysisFindingIds,
                            setConflictingAnalysisFindingIds,
                          )}
                        >
                          Supports
                        </button>
                        <button
                          type="button"
                          className={conflictingAnalysisFindingIds.has(finding.id) ? "conflict active" : "conflict"}
                          onClick={() => toggleExclusive(
                            finding.id,
                            "conflict",
                            setSupportingAnalysisFindingIds,
                            setConflictingAnalysisFindingIds,
                          )}
                        >
                          Conflicts
                        </button>
                      </div>
                    </article>
                  ))}
                  {investigation.analysisFindings.length === 0 && <small>No analysis findings available.</small>}
                </div>
              </div>

              <div className="fv2-findings-source-grid">
                <div>
                  <span>Measurements</span>
                  <div className="fv2-evidence-select">
                    {investigation.measurements.map((record) => (
                      <label key={record.id}>
                        <input
                          type="checkbox"
                          checked={sourceMeasurementIds.has(record.id)}
                          onChange={() => toggleSet(setSourceMeasurementIds, record.id)}
                        />
                        <span><b>{record.code}</b> {record.label}</span>
                      </label>
                    ))}
                    {investigation.measurements.length === 0 && <small>None available.</small>}
                  </div>
                </div>

                <div>
                  <span>Hypotheses</span>
                  <div className="fv2-evidence-select">
                    {investigation.hypotheses.map((record) => (
                      <label key={record.id}>
                        <input
                          type="checkbox"
                          checked={sourceHypothesisIds.has(record.id)}
                          onChange={() => toggleSet(setSourceHypothesisIds, record.id)}
                        />
                        <span><b>{record.code}</b> {record.title}</span>
                      </label>
                    ))}
                    {investigation.hypotheses.length === 0 && <small>None available.</small>}
                  </div>
                </div>

                <div>
                  <span>Simulation runs</span>
                  <div className="fv2-evidence-select">
                    {simulationRuns.map((record) => (
                      <label key={record.id}>
                        <input
                          type="checkbox"
                          checked={sourceSimulationRunIds.has(record.id)}
                          onChange={() => toggleSet(setSourceSimulationRunIds, record.id)}
                        />
                        <span><b>{record.code}</b> {record.hypothesisCode} · {record.status}</span>
                      </label>
                    ))}
                    {simulationRuns.length === 0 && <small>None available.</small>}
                  </div>
                </div>

                <div>
                  <span>Canonical reconstruction</span>
                  <div className="fv2-findings-canonical-source">
                    {canonicalManifest ? (
                      <label>
                        <input
                          type="checkbox"
                          checked={useCanonicalReconstruction}
                          onChange={(event) => setUseCanonicalReconstruction(event.target.checked)}
                        />
                        <span>
                          <b>{canonicalManifest.simulationRunCode}</b> · {canonicalManifest.hypothesisCode}<br />
                          <small>Provenance: {canonicalManifest.provenance}</small>
                        </span>
                      </label>
                    ) : (
                      <small>No canonical reconstruction manifest available.</small>
                    )}
                  </div>
                </div>
              </div>

              <label className="fv2-field full">
                <span>Investigator rationale</span>
                <textarea
                  rows={4}
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  placeholder="Explain how the linked sources lead to this conclusion."
                />
              </label>

              <label className="fv2-field full">
                <span>Limitations — one per line</span>
                <textarea
                  rows={4}
                  value={limitationsText}
                  onChange={(event) => setLimitationsText(event.target.value)}
                  placeholder={"CCTV timing could not be independently calibrated\nVehicle B tyre examination remains incomplete"}
                />
              </label>

              <label className="fv2-field full">
                <span>Unresolved questions — one per line</span>
                <textarea
                  rows={4}
                  value={unresolvedText}
                  onChange={(event) => setUnresolvedText(event.target.value)}
                  placeholder={"Exact pre-impact speed remains a range\nDriver identity requires independent confirmation"}
                />
              </label>

              <div className="fv2-findings-two">
                <label className="fv2-field">
                  <span>Review status</span>
                  <select
                    value={reviewStatus}
                    onChange={(event) => setReviewStatus(event.target.value as FinalFindingReviewStatus)}
                  >
                    {FINAL_FINDING_REVIEW_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="fv2-findings-report-check">
                  <input
                    type="checkbox"
                    checked={includeInReport}
                    onChange={(event) => setIncludeInReport(event.target.checked)}
                  />
                  <span>
                    <b>Include in final report</b>
                    <small>Automatically marks the finding Ready for report.</small>
                  </span>
                </label>
              </div>
            </div>

            <footer>
              <button type="button" className="primary" onClick={addFinding}>
                Save final finding
              </button>
            </footer>
          </section>

          <section className="fv2-panel fv2-findings-legal-rule">
            <b>Legal neutrality</b>
            <p>
              RoadSafe Findings may describe evidence-supported movement, contact, condition,
              consistency and uncertainty. They must not automatically declare criminal or civil
              guilt, liability, intent or legal responsibility.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
