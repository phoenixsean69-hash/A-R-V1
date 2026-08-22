import { useMemo, useState } from "react";
import type {
  ForensicAccidentInvestigation,
  ForensicConfidence,
} from "./forensicInvestigationTypes";
import {
  FORENSIC_CONFIDENCE_OPTIONS,
} from "./forensicInvestigationTypes";
import {
  FORENSIC_FINDING_CATEGORY_OPTIONS,
  FORENSIC_FINDING_DISPOSITION_OPTIONS,
  FORENSIC_FINDING_PROVENANCE_OPTIONS,
  FORENSIC_FINDING_REVIEW_STATUS_OPTIONS,
  type ForensicFindingCategory,
  type ForensicFindingDisposition,
  type ForensicFindingProvenance,
  type ForensicFindingReviewStatus,
} from "./forensicFindingsTypes";
import { ForensicFindingsService } from "./forensicFindingsService";
import { ForensicSimulationService } from "./forensicSimulationService";
import { ForensicCanonicalReconstructionService } from "./forensicCanonicalReconstructionService";
import "./FindingsWorkspace.css";

interface Props {
  investigation: ForensicAccidentInvestigation;
  onMessage?(message: string): void;
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function FindingsWorkspace({ investigation, onMessage }: Props) {
  const [revision, setRevision] = useState(0);
  const [category, setCategory] =
    useState<ForensicFindingCategory>("Crash sequence");
  const [statement, setStatement] = useState("");
  const [disposition, setDisposition] =
    useState<ForensicFindingDisposition>("Supported");
  const [confidence, setConfidence] =
    useState<ForensicConfidence>("Moderate");
  const [provenance, setProvenance] =
    useState<ForensicFindingProvenance>("Calculated");
  const [rationale, setRationale] = useState("");
  const [limitationsText, setLimitationsText] = useState("");
  const [unresolvedText, setUnresolvedText] = useState("");
  const [supportingEvidenceIds, setSupportingEvidenceIds] = useState<string[]>([]);
  const [conflictingEvidenceIds, setConflictingEvidenceIds] = useState<string[]>([]);
  const [supportingAnalysisFindingIds, setSupportingAnalysisFindingIds] =
    useState<string[]>([]);
  const [conflictingAnalysisFindingIds, setConflictingAnalysisFindingIds] =
    useState<string[]>([]);
  const [sourceMeasurementIds, setSourceMeasurementIds] = useState<string[]>([]);
  const [sourceHypothesisIds, setSourceHypothesisIds] = useState<string[]>([]);
  const [sourceSimulationRunIds, setSourceSimulationRunIds] = useState<string[]>([]);

  const findings = useMemo(
    () => ForensicFindingsService.getByCaseId(investigation.caseId),
    [investigation.caseId, revision],
  );

  const simulationRuns = useMemo(
    () => ForensicSimulationService.getByCaseId(investigation.caseId),
    [investigation.caseId, revision],
  );

  const canonicalManifest = useMemo(
    () =>
      ForensicCanonicalReconstructionService.getManifest(investigation.caseId),
    [investigation.caseId, revision],
  );

  const refresh = () => setRevision((value) => value + 1);
  const message = (value: string) => onMessage?.(value);

  const markEvidence = (id: string, kind: "support" | "conflict") => {
    if (kind === "support") {
      setSupportingEvidenceIds((current) => toggleValue(current, id));
      setConflictingEvidenceIds((current) => current.filter((item) => item !== id));
    } else {
      setConflictingEvidenceIds((current) => toggleValue(current, id));
      setSupportingEvidenceIds((current) => current.filter((item) => item !== id));
    }
  };

  const markAnalysis = (id: string, kind: "support" | "conflict") => {
    if (kind === "support") {
      setSupportingAnalysisFindingIds((current) => toggleValue(current, id));
      setConflictingAnalysisFindingIds((current) => current.filter((item) => item !== id));
    } else {
      setConflictingAnalysisFindingIds((current) => toggleValue(current, id));
      setSupportingAnalysisFindingIds((current) => current.filter((item) => item !== id));
    }
  };

  const resetComposer = () => {
    setCategory("Crash sequence");
    setStatement("");
    setDisposition("Supported");
    setConfidence("Moderate");
    setProvenance("Calculated");
    setRationale("");
    setLimitationsText("");
    setUnresolvedText("");
    setSupportingEvidenceIds([]);
    setConflictingEvidenceIds([]);
    setSupportingAnalysisFindingIds([]);
    setConflictingAnalysisFindingIds([]);
    setSourceMeasurementIds([]);
    setSourceHypothesisIds([]);
    setSourceSimulationRunIds([]);
  };

  const saveFinding = () => {
    if (!statement.trim()) {
      message("A final finding needs a clear technical statement.");
      return;
    }

    if (!rationale.trim()) {
      message("Record the investigator rationale before saving the finding.");
      return;
    }

    const finding = ForensicFindingsService.create(investigation.caseId, {
      category,
      statement: statement.trim(),
      disposition,
      confidence,
      provenance,
      rationale: rationale.trim(),
      supportingEvidenceIds,
      conflictingEvidenceIds,
      supportingAnalysisFindingIds,
      conflictingAnalysisFindingIds,
      sourceMeasurementIds,
      sourceHypothesisIds,
      sourceSimulationRunIds,
      canonicalReconstructionId: canonicalManifest?.reconstructionId,
      limitations: lines(limitationsText),
      unresolvedQuestions: lines(unresolvedText),
    });

    resetComposer();
    refresh();
    message(`${finding.code} saved to the final Findings register.`);
  };

  const setFindingReview = (
    findingId: string,
    reviewStatus: ForensicFindingReviewStatus,
  ) => {
    ForensicFindingsService.update(findingId, {
      reviewStatus,
      includeInReport: reviewStatus === "Ready for report",
    });
    refresh();
  };

  const readyCount = findings.filter(
    (finding) => finding.reviewStatus === "Ready for report" && finding.includeInReport,
  ).length;

  return (
    <div className="fv2-stack fv2-findings-workstation">
      <section className="fv2-panel fv2-findings-hero">
        <header>
          <div>
            <span>Investigator conclusions</span>
            <strong>Convert tested evidence into traceable final findings</strong>
          </div>
          <div className="fv2-findings-summary">
            <span>{findings.length} finding(s)</span>
            <span>{readyCount} ready for report</span>
          </div>
        </header>
        <div className="fv2-findings-rule">
          A final finding is an investigator conclusion, not a new observation. Every
          finding must retain confidence, provenance, supporting/conflicting sources,
          limitations and unresolved questions. Simulation and reconstruction remain
          derived material and do not become facts simply because they look plausible.
        </div>
      </section>

      <div className="fv2-findings-layout">
        <div className="fv2-findings-main">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Finding composer</span>
                <strong>Evidence-backed technical conclusion</strong>
              </div>
            </header>

            <div className="fv2-findings-form">
              <div className="fv2-findings-three">
                <label className="fv2-field">
                  <span>Category</span>
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as ForensicFindingCategory)
                    }
                  >
                    {FORENSIC_FINDING_CATEGORY_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="fv2-field">
                  <span>Disposition</span>
                  <select
                    value={disposition}
                    onChange={(event) =>
                      setDisposition(event.target.value as ForensicFindingDisposition)
                    }
                  >
                    {FORENSIC_FINDING_DISPOSITION_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="fv2-field">
                  <span>Confidence</span>
                  <select
                    value={confidence}
                    onChange={(event) =>
                      setConfidence(event.target.value as ForensicConfidence)
                    }
                  >
                    {FORENSIC_CONFIDENCE_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="fv2-field full">
                <span>Finding statement</span>
                <textarea
                  rows={4}
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                  placeholder="State the technical conclusion without assigning automatic legal guilt."
                />
              </label>

              <label className="fv2-field full">
                <span>Investigator rationale</span>
                <textarea
                  rows={4}
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  placeholder="Explain why the linked sources support, partly support, contradict or fail to resolve this conclusion."
                />
              </label>

              <label className="fv2-field full">
                <span>Finding provenance</span>
                <select
                  value={provenance}
                  onChange={(event) =>
                    setProvenance(event.target.value as ForensicFindingProvenance)
                  }
                >
                  {FORENSIC_FINDING_PROVENANCE_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <small className="fv2-help">
                  Observed and Measured records stay in their original registers; this
                  conclusion layer only uses derived provenance classes.
                </small>
              </label>
            </div>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Source trace</span>
                <strong>Support, conflict and tested derivation</strong>
              </div>
            </header>

            <div className="fv2-findings-source-sections">
              <SourceGroup title="Physical evidence">
                {investigation.evidence.length === 0 ? (
                  <div className="fv2-empty">No physical evidence records.</div>
                ) : investigation.evidence.map((item) => (
                  <SourceRow
                    key={item.id}
                    code={item.code}
                    text={item.description}
                    support={supportingEvidenceIds.includes(item.id)}
                    conflict={conflictingEvidenceIds.includes(item.id)}
                    onSupport={() => markEvidence(item.id, "support")}
                    onConflict={() => markEvidence(item.id, "conflict")}
                  />
                ))}
              </SourceGroup>

              <SourceGroup title="Analysis findings">
                {investigation.analysisFindings.length === 0 ? (
                  <div className="fv2-empty">No Analysis findings.</div>
                ) : investigation.analysisFindings.map((item) => (
                  <SourceRow
                    key={item.id}
                    code={item.code}
                    text={item.finding}
                    support={supportingAnalysisFindingIds.includes(item.id)}
                    conflict={conflictingAnalysisFindingIds.includes(item.id)}
                    onSupport={() => markAnalysis(item.id, "support")}
                    onConflict={() => markAnalysis(item.id, "conflict")}
                  />
                ))}
              </SourceGroup>

              <SourceGroup title="Measurements">
                <div className="fv2-findings-chip-grid">
                  {investigation.measurements.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={sourceMeasurementIds.includes(item.id) ? "selected" : ""}
                      onClick={() =>
                        setSourceMeasurementIds((current) => toggleValue(current, item.id))
                      }
                    >
                      {item.code} · {item.label}
                    </button>
                  ))}
                </div>
              </SourceGroup>

              <SourceGroup title="Hypotheses">
                <div className="fv2-findings-chip-grid">
                  {investigation.hypotheses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={sourceHypothesisIds.includes(item.id) ? "selected" : ""}
                      onClick={() =>
                        setSourceHypothesisIds((current) => toggleValue(current, item.id))
                      }
                    >
                      {item.code} · {item.title}
                    </button>
                  ))}
                </div>
              </SourceGroup>

              <SourceGroup title="Simulation runs">
                <div className="fv2-findings-chip-grid">
                  {simulationRuns.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      className={sourceSimulationRunIds.includes(run.id) ? "selected" : ""}
                      onClick={() =>
                        setSourceSimulationRunIds((current) => toggleValue(current, run.id))
                      }
                    >
                      {run.code} · {run.hypothesisCode}
                    </button>
                  ))}
                </div>
                {canonicalManifest && (
                  <div className="fv2-findings-canonical">
                    Canonical reconstruction: {canonicalManifest.reconstructionId} · source {canonicalManifest.hypothesisCode} → {canonicalManifest.simulationRunCode}
                  </div>
                )}
              </SourceGroup>
            </div>
          </section>

          <section className="fv2-panel">
            <header>
              <div>
                <span>Caveats</span>
                <strong>Limitations and unresolved questions</strong>
              </div>
            </header>
            <div className="fv2-findings-two">
              <label className="fv2-field">
                <span>Limitations — one per line</span>
                <textarea
                  rows={5}
                  value={limitationsText}
                  onChange={(event) => setLimitationsText(event.target.value)}
                />
              </label>
              <label className="fv2-field">
                <span>Unresolved questions — one per line</span>
                <textarea
                  rows={5}
                  value={unresolvedText}
                  onChange={(event) => setUnresolvedText(event.target.value)}
                />
              </label>
            </div>
            <footer>
              <button type="button" className="primary" onClick={saveFinding}>
                Save final finding
              </button>
            </footer>
          </section>
        </div>

        <aside className="fv2-findings-side">
          <section className="fv2-panel">
            <header>
              <div>
                <span>Findings register</span>
                <strong>{findings.length} record(s)</strong>
              </div>
            </header>

            {findings.length === 0 ? (
              <div className="fv2-empty">No final findings recorded yet.</div>
            ) : (
              <div className="fv2-findings-register">
                {findings.map((finding) => (
                  <article key={finding.id}>
                    <div className="fv2-findings-card-head">
                      <div>
                        <span>{finding.code} · {finding.category}</span>
                        <strong>{finding.statement}</strong>
                      </div>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          ForensicFindingsService.remove(finding.id);
                          refresh();
                          message(`${finding.code} removed.`);
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="fv2-findings-badges">
                      <span>{finding.disposition}</span>
                      <span>{finding.confidence}</span>
                      <span>{finding.provenance}</span>
                    </div>

                    <p>{finding.rationale}</p>

                    <div className="fv2-findings-card-counts">
                      <span>{finding.supportingEvidenceIds.length + finding.supportingAnalysisFindingIds.length} support</span>
                      <span>{finding.conflictingEvidenceIds.length + finding.conflictingAnalysisFindingIds.length} conflict</span>
                      <span>{finding.limitations.length} limitation(s)</span>
                      <span>{finding.unresolvedQuestions.length} unresolved</span>
                    </div>

                    <label className="fv2-field full">
                      <span>Report status</span>
                      <select
                        value={finding.reviewStatus}
                        onChange={(event) =>
                          setFindingReview(
                            finding.id,
                            event.target.value as ForensicFindingReviewStatus,
                          )
                        }
                      >
                        {FORENSIC_FINDING_REVIEW_STATUS_OPTIONS.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="fv2-panel fv2-notice">
            <b>Legal neutrality</b>
            <p>
              Findings may describe technical consistency, movement, impact,
              kinematics, vehicle condition and evidential support. RoadSafe does not
              automatically decide guilt, liability or criminal responsibility.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SourceGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fv2-findings-source-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function SourceRow({
  code,
  text,
  support,
  conflict,
  onSupport,
  onConflict,
}: {
  code: string;
  text: string;
  support: boolean;
  conflict: boolean;
  onSupport(): void;
  onConflict(): void;
}) {
  return (
    <div className="fv2-findings-source-row">
      <div>
        <strong>{code}</strong>
        <span>{text}</span>
      </div>
      <div>
        <button
          type="button"
          className={support ? "support selected" : "support"}
          onClick={onSupport}
        >
          Supports
        </button>
        <button
          type="button"
          className={conflict ? "conflict selected" : "conflict"}
          onClick={onConflict}
        >
          Conflicts
        </button>
      </div>
    </div>
  );
}
