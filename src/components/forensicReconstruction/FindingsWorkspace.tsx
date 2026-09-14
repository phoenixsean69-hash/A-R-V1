import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Database,
  FileSearch,
  Flag,
  Gauge,
  Orbit,
  Play,
  Plus,
  Ruler,
  ScanLine,
  ShieldCheck,
  Trash2,
  Waypoints,
} from "../icons/materialIcons";
import type {
  ForensicAccidentInvestigation,
  ForensicConfidence,
} from "../../features/forensicReconstruction/forensicInvestigationTypes";
import {
  FORENSIC_CONFIDENCE_OPTIONS,
} from "../../features/forensicReconstruction/forensicInvestigationTypes";
import {
  FORENSIC_FINDING_CATEGORY_OPTIONS,
  FORENSIC_FINDING_DISPOSITION_OPTIONS,
  FORENSIC_FINDING_PROVENANCE_OPTIONS,
  FORENSIC_FINDING_REVIEW_STATUS_OPTIONS,
  type ForensicFindingCategory,
  type ForensicFindingDisposition,
  type ForensicFindingProvenance,
  type ForensicFindingReviewStatus,
} from "../../features/forensicReconstruction/forensicFindingsTypes";
import { ForensicFindingsService } from "../../features/forensicReconstruction/forensicFindingsService";
import { ForensicSimulationService } from "../../features/forensicReconstruction/forensicSimulationService";
import { ForensicCanonicalReconstructionService } from "../../features/forensicReconstruction/forensicCanonicalReconstructionService";
import "../../features/forensicReconstruction/FindingsWorkspace.css";

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
    <div className="fv2-stack fv2-findings-viz">
      <header className="fv2-findings-viz-commandbar">
        <div className="fv2-findings-viz-commandbar__identity">
          <span className="fv2-findings-viz-commandbar__icon">
            <Flag size={36} />
          </span>

          <div>
            <small>Investigator conclusions</small>
            <strong>Forensic Findings Workstation</strong>
          </div>
        </div>

        <div className="fv2-findings-viz-commandbar__status">
          <span>
            <Flag size={15} />
            <b>{findings.length}</b>
            findings
          </span>

          <span>
            <CheckCircle2 size={15} />
            <b>{readyCount}</b>
            report ready
          </span>

          <span>
            <ShieldCheck size={15} />
            <b>
              {supportingEvidenceIds.length +
                supportingAnalysisFindingIds.length}
            </b>
            support
          </span>

          <span>
            <CircleDot size={15} />
            <b>
              {conflictingEvidenceIds.length +
                conflictingAnalysisFindingIds.length}
            </b>
            conflict
          </span>
        </div>
      </header>

      <div className="fv2-findings-viz-layout">
        <main className="fv2-findings-viz-canvas">
          <section className="fv2-findings-viz-composer">
            <header>
              <ClipboardList size={20} />

              <div>
                <span>Finding composer</span>
                <strong>Evidence-backed technical conclusion</strong>
              </div>

              <div className="fv2-findings-viz-composer-state">
                <span>
                  {statement.trim() ? "STATEMENT" : "STATEMENT MISSING"}
                </span>
                <span>
                  {rationale.trim() ? "RATIONALE" : "RATIONALE MISSING"}
                </span>
              </div>
            </header>

            <div className="fv2-findings-viz-instruments">
              <label>
                <ClipboardList size={24} />

                <div>
                  <span>Category</span>
                  <strong>{category}</strong>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value as ForensicFindingCategory,
                      )
                    }
                  >
                    {FORENSIC_FINDING_CATEGORY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label>
                <ShieldCheck size={24} />

                <div>
                  <span>Disposition</span>
                  <strong>{disposition}</strong>

                  <select
                    value={disposition}
                    onChange={(event) =>
                      setDisposition(
                        event.target.value as ForensicFindingDisposition,
                      )
                    }
                  >
                    {FORENSIC_FINDING_DISPOSITION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label>
                <Gauge size={24} />

                <div>
                  <span>Confidence</span>
                  <strong>{confidence}</strong>

                  <select
                    value={confidence}
                    onChange={(event) =>
                      setConfidence(
                        event.target.value as ForensicConfidence,
                      )
                    }
                  >
                    {FORENSIC_CONFIDENCE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label>
                <Database size={24} />

                <div>
                  <span>Provenance</span>
                  <strong>{provenance}</strong>

                  <select
                    value={provenance}
                    onChange={(event) =>
                      setProvenance(
                        event.target.value as ForensicFindingProvenance,
                      )
                    }
                  >
                    {FORENSIC_FINDING_PROVENANCE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <div className="fv2-findings-viz-writing-grid">
              <label className="fv2-findings-viz-writing">
                <div>
                  <Flag size={19} />
                  <span>Technical finding</span>
                </div>

                <textarea
                  rows={6}
                  value={statement}
                  onChange={(event) =>
                    setStatement(event.target.value)
                  }
                  placeholder="State the technical conclusion."
                />
              </label>

              <label className="fv2-findings-viz-writing">
                <div>
                  <FileSearch size={19} />
                  <span>Investigator rationale</span>
                </div>

                <textarea
                  rows={6}
                  value={rationale}
                  onChange={(event) =>
                    setRationale(event.target.value)
                  }
                  placeholder="Explain how the selected sources support or challenge the conclusion."
                />
              </label>
            </div>
          </section>

          <section className="fv2-findings-viz-readiness">
            <article>
              <ShieldCheck size={28} />

              <div>
                <span>Supporting sources</span>
                <strong>
                  {supportingEvidenceIds.length +
                    supportingAnalysisFindingIds.length}
                </strong>
              </div>
            </article>

            <article>
              <CircleDot size={28} />

              <div>
                <span>Conflicting sources</span>
                <strong>
                  {conflictingEvidenceIds.length +
                    conflictingAnalysisFindingIds.length}
                </strong>
              </div>
            </article>

            <article>
              <AlertTriangle size={28} />

              <div>
                <span>Limitations</span>
                <strong>{lines(limitationsText).length}</strong>
              </div>
            </article>

            <article>
              <FileSearch size={28} />

              <div>
                <span>Unresolved</span>
                <strong>{lines(unresolvedText).length}</strong>
              </div>
            </article>

            <article>
              <Waypoints size={28} />

              <div>
                <span>Canonical lineage</span>
                <strong>
                  {canonicalManifest ? "Linked" : "None"}
                </strong>
              </div>
            </article>
          </section>

          <section className="fv2-findings-viz-sources">
            <header>
              <FileSearch size={20} />

              <div>
                <span>Source trace</span>
                <strong>Support, conflict and tested derivation</strong>
              </div>

              <div className="fv2-findings-viz-source-totals">
                <span>
                  <ScanLine size={14} />
                  {investigation.evidence.length}
                </span>

                <span>
                  <Activity size={14} />
                  {investigation.analysisFindings.length}
                </span>

                <span>
                  <Ruler size={14} />
                  {investigation.measurements.length}
                </span>

                <span>
                  <Orbit size={14} />
                  {investigation.hypotheses.length}
                </span>

                <span>
                  <Play size={14} />
                  {simulationRuns.length}
                </span>
              </div>
            </header>

            <div className="fv2-findings-viz-source-stack">
              <SourceGroup
                title="Physical evidence"
                count={investigation.evidence.length}
                icon={<ScanLine size={19} />}
                open
              >
                {investigation.evidence.length === 0 ? (
                  <div className="fv2-findings-viz-source-empty">
                    No physical evidence
                  </div>
                ) : (
                  investigation.evidence.map((item) => (
                    <SourceRow
                      key={item.id}
                      code={item.code}
                      text={item.description}
                      support={supportingEvidenceIds.includes(item.id)}
                      conflict={conflictingEvidenceIds.includes(item.id)}
                      onSupport={() =>
                        markEvidence(item.id, "support")
                      }
                      onConflict={() =>
                        markEvidence(item.id, "conflict")
                      }
                    />
                  ))
                )}
              </SourceGroup>

              <SourceGroup
                title="Analysis findings"
                count={investigation.analysisFindings.length}
                icon={<Activity size={19} />}
                open
              >
                {investigation.analysisFindings.length === 0 ? (
                  <div className="fv2-findings-viz-source-empty">
                    No analysis findings
                  </div>
                ) : (
                  investigation.analysisFindings.map((item) => (
                    <SourceRow
                      key={item.id}
                      code={item.code}
                      text={item.finding}
                      support={supportingAnalysisFindingIds.includes(
                        item.id,
                      )}
                      conflict={conflictingAnalysisFindingIds.includes(
                        item.id,
                      )}
                      onSupport={() =>
                        markAnalysis(item.id, "support")
                      }
                      onConflict={() =>
                        markAnalysis(item.id, "conflict")
                      }
                    />
                  ))
                )}
              </SourceGroup>

              <SourceGroup
                title="Measurements"
                count={investigation.measurements.length}
                icon={<Ruler size={19} />}
              >
                <div className="fv2-findings-viz-chip-grid">
                  {investigation.measurements.length === 0 ? (
                    <span className="fv2-findings-viz-source-empty">
                      No measurements
                    </span>
                  ) : (
                    investigation.measurements.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          sourceMeasurementIds.includes(item.id)
                            ? "is-selected"
                            : ""
                        }
                        onClick={() =>
                          setSourceMeasurementIds((current) =>
                            toggleValue(current, item.id),
                          )
                        }
                      >
                        <Ruler size={14} />
                        <span>
                          {item.code} / {item.label}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </SourceGroup>

              <SourceGroup
                title="Hypotheses"
                count={investigation.hypotheses.length}
                icon={<Orbit size={19} />}
              >
                <div className="fv2-findings-viz-chip-grid">
                  {investigation.hypotheses.length === 0 ? (
                    <span className="fv2-findings-viz-source-empty">
                      No hypotheses
                    </span>
                  ) : (
                    investigation.hypotheses.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          sourceHypothesisIds.includes(item.id)
                            ? "is-selected"
                            : ""
                        }
                        onClick={() =>
                          setSourceHypothesisIds((current) =>
                            toggleValue(current, item.id),
                          )
                        }
                      >
                        <Orbit size={14} />
                        <span>
                          {item.code} / {item.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </SourceGroup>

              <SourceGroup
                title="Simulation runs"
                count={simulationRuns.length}
                icon={<Play size={19} />}
              >
                <div className="fv2-findings-viz-chip-grid">
                  {simulationRuns.length === 0 ? (
                    <span className="fv2-findings-viz-source-empty">
                      No simulation runs
                    </span>
                  ) : (
                    simulationRuns.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        className={
                          sourceSimulationRunIds.includes(run.id)
                            ? "is-selected"
                            : ""
                        }
                        onClick={() =>
                          setSourceSimulationRunIds((current) =>
                            toggleValue(current, run.id),
                          )
                        }
                      >
                        <Play size={14} />
                        <span>
                          {run.code} / {run.hypothesisCode}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {canonicalManifest && (
                  <div className="fv2-findings-viz-lineage">
                    <Waypoints size={17} />

                    <div>
                      <span>Canonical reconstruction</span>
                      <strong>
                        {canonicalManifest.hypothesisCode}
                        {" / "}
                        {canonicalManifest.simulationRunCode}
                      </strong>
                    </div>
                  </div>
                )}
              </SourceGroup>
            </div>
          </section>

          <details className="fv2-findings-viz-caveats">
            <summary>
              <AlertTriangle size={20} />

              <div>
                <span>Caveats</span>
                <strong>
                  {lines(limitationsText).length +
                    lines(unresolvedText).length}
                  {" "}
                  recorded
                </strong>
              </div>

              <ChevronDown size={18} />
            </summary>

            <div className="fv2-findings-viz-caveat-grid">
              <label>
                <span>Limitations</span>
                <textarea
                  rows={5}
                  value={limitationsText}
                  onChange={(event) =>
                    setLimitationsText(event.target.value)
                  }
                  placeholder="One limitation per line"
                />
              </label>

              <label>
                <span>Unresolved questions</span>
                <textarea
                  rows={5}
                  value={unresolvedText}
                  onChange={(event) =>
                    setUnresolvedText(event.target.value)
                  }
                  placeholder="One unresolved question per line"
                />
              </label>
            </div>
          </details>

          <button
            type="button"
            className="fv2-findings-viz-save"
            onClick={saveFinding}
          >
            <Plus size={18} />
            <span>Save final finding</span>
          </button>
        </main>

        <aside className="fv2-findings-viz-register">
          <section>
            <header>
              <Flag size={20} />

              <div>
                <span>Findings register</span>
                <strong>{findings.length} record(s)</strong>
              </div>

              <div className="fv2-findings-viz-register-count">
                <b>{readyCount}</b>
                <span>report ready</span>
              </div>
            </header>

            {findings.length === 0 ? (
              <div className="fv2-findings-viz-register-empty">
                <Flag size={48} />
                <strong>No final findings</strong>
                <span>Saved conclusions appear here</span>
              </div>
            ) : (
              <div className="fv2-findings-viz-register-list">
                {findings.map((finding) => (
                  <article key={finding.id}>
                    <header>
                      <div className="fv2-findings-viz-register-identity">
                        <span className="fv2-findings-viz-register-icon">
                          <Flag size={24} />
                        </span>

                        <div>
                          <small>{finding.code}</small>
                          <strong>{finding.category}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          ForensicFindingsService.remove(finding.id);
                          refresh();
                          message(`${finding.code} removed.`);
                        }}
                        title={`Remove ${finding.code}`}
                        aria-label={`Remove ${finding.code}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </header>

                    <p>{finding.statement}</p>

                    <div className="fv2-findings-viz-register-instruments">
                      <span>
                        <ShieldCheck size={14} />
                        {finding.disposition}
                      </span>

                      <span>
                        <Gauge size={14} />
                        {finding.confidence}
                      </span>

                      <span>
                        <Database size={14} />
                        {finding.provenance}
                      </span>
                    </div>

                    <div className="fv2-findings-viz-register-counts">
                      <span>
                        <b>
                          {finding.supportingEvidenceIds.length +
                            finding.supportingAnalysisFindingIds.length}
                        </b>
                        support
                      </span>

                      <span>
                        <b>
                          {finding.conflictingEvidenceIds.length +
                            finding.conflictingAnalysisFindingIds.length}
                        </b>
                        conflict
                      </span>

                      <span>
                        <b>{finding.limitations.length}</b>
                        limits
                      </span>

                      <span>
                        <b>{finding.unresolvedQuestions.length}</b>
                        unresolved
                      </span>
                    </div>

                    <details>
                      <summary>
                        <FileSearch size={15} />
                        <span>Rationale</span>
                        <ChevronDown size={15} />
                      </summary>

                      <p>{finding.rationale}</p>
                    </details>

                    <label className="fv2-findings-viz-review">
                      <span>Report status</span>

                      <select
                        value={finding.reviewStatus}
                        onChange={(event) =>
                          setFindingReview(
                            finding.id,
                            event.target
                              .value as ForensicFindingReviewStatus,
                          )
                        }
                      >
                        {FORENSIC_FINDING_REVIEW_STATUS_OPTIONS.map(
                          (item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SourceGroup({
  title,
  count,
  icon,
  open = false,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="fv2-findings-viz-source-group" open={open}>
      <summary>
        {icon}

        <div>
          <span>{title}</span>
          <strong>{count} record(s)</strong>
        </div>

        <ChevronDown size={17} />
      </summary>

      <div className="fv2-findings-viz-source-group__body">
        {children}
      </div>
    </details>
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
    <article className="fv2-findings-viz-source-row">
      <div>
        <strong>{code}</strong>
        <span>{text}</span>
      </div>

      <div>
        <button
          type="button"
          className={support ? "support is-selected" : "support"}
          onClick={onSupport}
          title="Supports finding"
        >
          <ShieldCheck size={15} />
          <span>Support</span>
        </button>

        <button
          type="button"
          className={conflict ? "conflict is-selected" : "conflict"}
          onClick={onConflict}
          title="Conflicts with finding"
        >
          <CircleDot size={15} />
          <span>Conflict</span>
        </button>
      </div>
    </article>
  );
}

