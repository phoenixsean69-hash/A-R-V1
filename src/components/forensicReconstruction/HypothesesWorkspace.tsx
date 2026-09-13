import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  CircleDot,
  ChevronDown,
  ClipboardList,
  Crosshair,
  FileSearch,
  Gauge,
  MapPinned,
  Orbit,
  Play,
  Plus,
  ScanLine,
  ShieldCheck,
  Trash2,
  Waypoints,
} from "../icons/materialIcons";
import {
  FORENSIC_CONFIDENCE_OPTIONS,
  HYPOTHESIS_STATUS_OPTIONS,
  type ForensicAccidentInvestigation,
  type ForensicConfidence,
  type ForensicCrashHypothesis,
  type HypothesisStatus,
} from "../../features/forensicReconstruction/forensicInvestigationTypes";
import { ForensicInvestigationService } from "../../features/forensicReconstruction/forensicInvestigationService";
import "../../features/forensicReconstruction/HypothesesWorkspace.css";

interface Props {
  investigation: ForensicAccidentInvestigation;
  onInvestigationChange(next: ForensicAccidentInvestigation): void;
  onMessage?(message: string): void;
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readiness(h: ForensicCrashHypothesis): number {
  let score = 0;
  if (h.summary.trim()) score += 20;
  if (h.supportingFindingIds.length + h.supportingEvidenceIds.length) score += 20;
  if (h.eventSequence.length >= 2) score += 20;
  if (h.impactRegion) score += 15;
  if (h.assumptions.length) score += 10;
  if (!h.missingEvidence.length) score += 10;
  if (h.confidence !== "Unverified") score += 5;
  return Math.min(100, score);
}

export default function HypothesesWorkspace({
  investigation,
  onInvestigationChange,
  onMessage,
}: Props) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<HypothesisStatus>("Draft");
  const [confidence, setConfidence] = useState<ForensicConfidence>("Unverified");

  const [supportingFindingIds, setSupportingFindingIds] = useState<Set<string>>(new Set());
  const [conflictingFindingIds, setConflictingFindingIds] = useState<Set<string>>(new Set());
  const [supportingEvidenceIds, setSupportingEvidenceIds] = useState<Set<string>>(new Set());
  const [conflictingEvidenceIds, setConflictingEvidenceIds] = useState<Set<string>>(new Set());
  const [sourceMeasurementIds, setSourceMeasurementIds] = useState<Set<string>>(new Set());
  const [sourceVehicleIds, setSourceVehicleIds] = useState<Set<string>>(new Set());
  const [sourcePersonIds, setSourcePersonIds] = useState<Set<string>>(new Set());
  const [sourceWitnessIds, setSourceWitnessIds] = useState<Set<string>>(new Set());

  const [assumptions, setAssumptions] = useState("");
  const [missingEvidence, setMissingEvidence] = useState("");
  const [impactX, setImpactX] = useState("");
  const [impactY, setImpactY] = useState("");
  const [impactRadius, setImpactRadius] = useState("");
  const [impactDescription, setImpactDescription] = useState("");
  const [eventSequence, setEventSequence] = useState("");
  const [notes, setNotes] = useState("");
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  const compared = useMemo(
    () => investigation.hypotheses.filter((h) => compareIds.has(h.id)),
    [investigation.hypotheses, compareIds],
  );

  const tell = (message: string) => onMessage?.(message);

  const toggle = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExclusive = (
    id: string,
    positive: boolean,
    positiveSetter: Dispatch<SetStateAction<Set<string>>>,
    negativeSetter: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    if (positive) {
      positiveSetter((current) => {
        const next = new Set(current);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      negativeSetter((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } else {
      negativeSetter((current) => {
        const next = new Set(current);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      positiveSetter((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const reset = () => {
    setTitle(""); setSummary(""); setStatus("Draft"); setConfidence("Unverified");
    setSupportingFindingIds(new Set()); setConflictingFindingIds(new Set());
    setSupportingEvidenceIds(new Set()); setConflictingEvidenceIds(new Set());
    setSourceMeasurementIds(new Set()); setSourceVehicleIds(new Set());
    setSourcePersonIds(new Set()); setSourceWitnessIds(new Set());
    setAssumptions(""); setMissingEvidence(""); setImpactX(""); setImpactY("");
    setImpactRadius(""); setImpactDescription(""); setEventSequence(""); setNotes("");
  };

  const addHypothesis = () => {
    if (!title.trim() || !summary.trim()) {
      tell("A hypothesis needs both a title and a proposed crash explanation.");
      return;
    }

    const x = numberOrUndefined(impactX);
    const y = numberOrUndefined(impactY);
    const radius = numberOrUndefined(impactRadius);
    const anyImpact = impactX.trim() || impactY.trim() || impactRadius.trim();

    if (anyImpact && (x === undefined || y === undefined || radius === undefined || radius <= 0)) {
      tell("Impact region needs valid X, Y and radius values; radius must be greater than zero.");
      return;
    }

    const saved = ForensicInvestigationService.addHypothesis(investigation, {
      title: title.trim(),
      summary: summary.trim(),
      status,
      confidence,
      provenance: "Investigator Assumption",
      supportingFindingIds: [...supportingFindingIds],
      conflictingFindingIds: [...conflictingFindingIds],
      supportingEvidenceIds: [...supportingEvidenceIds],
      conflictingEvidenceIds: [...conflictingEvidenceIds],
      sourceMeasurementIds: [...sourceMeasurementIds],
      sourceVehicleIds: [...sourceVehicleIds],
      sourcePersonIds: [...sourcePersonIds],
      sourceWitnessIds: [...sourceWitnessIds],
      assumptions: lines(assumptions),
      missingEvidence: lines(missingEvidence),
      impactRegion:
        x !== undefined && y !== undefined && radius !== undefined
          ? { xMetres: x, yMetres: y, radiusMetres: radius, description: impactDescription.trim() }
          : undefined,
      eventSequence: lines(eventSequence).map((description, index) => ({
        id: `hyp-event-${Date.now()}-${index + 1}`,
        order: index + 1,
        description,
      })),
      selectedForSimulation: false,
      notes: notes.trim(),
    });

    onInvestigationChange(saved);
    reset();
    tell("Crash hypothesis saved.");
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= 2) {
        tell("Compare up to two hypotheses at a time.");
        return current;
      }
      next.add(id);
      return next;
    });
  };

  const queue = (h: ForensicCrashHypothesis) => {
    if (h.status === "Rejected") {
      tell("A rejected hypothesis cannot be sent to simulation.");
      return;
    }
    const saved = ForensicInvestigationService.setHypothesisSimulationSelected(
      investigation, h.id, !h.selectedForSimulation,
    );
    onInvestigationChange(saved);
    tell(
      h.selectedForSimulation
        ? `${h.code} removed from the future simulation queue.`
        : `${h.code} marked for future physics / simulation testing.`,
    );
  };

  const remove = (h: ForensicCrashHypothesis) => {
    onInvestigationChange(
      ForensicInvestigationService.deleteHypothesis(investigation, h.id),
    );
    setCompareIds((current) => {
      const next = new Set(current); next.delete(h.id); return next;
    });
    tell(`${h.code} removed.`);
  };

  return (
    <div className="fv2-stack fv2-hyp-viz">
      <header className="fv2-hyp-viz-commandbar">
        <div className="fv2-hyp-viz-commandbar__identity">
          <span className="fv2-hyp-viz-commandbar__icon">
            <Orbit size={36} />
          </span>

          <div>
            <small>Competing crash hypotheses</small>
            <strong>Hypothesis Testing Workstation</strong>
          </div>
        </div>

        <div className="fv2-hyp-viz-commandbar__status">
          <span>
            <Orbit size={15} />
            <b>{investigation.hypotheses.length}</b>
            hypotheses
          </span>

          <span>
            <Waypoints size={15} />
            <b>{compareIds.size}/2</b>
            compare
          </span>

          <span>
            <Play size={15} />
            <b>
              {
                investigation.hypotheses.filter(
                  (h) => h.selectedForSimulation,
                ).length
              }
            </b>
            queued
          </span>

          <span>
            <MapPinned size={15} />
            <b>
              {
                investigation.hypotheses.filter(
                  (h) => h.impactRegion,
                ).length
              }
            </b>
            regions
          </span>
        </div>
      </header>

      <div className="fv2-hyp-viz-layout">
        <main className="fv2-hyp-viz-canvas">
          <section className="fv2-hyp-viz-map-module">
            <header>
              <MapPinned size={20} />

              <div>
                <span>Hypothesis geometry</span>
                <strong>Proposed impact regions</strong>
              </div>

              <div className="fv2-hyp-viz-map-stats">
                <span>
                  <b>
                    {
                      investigation.hypotheses.filter(
                        (h) => h.impactRegion,
                      ).length
                    }
                  </b>
                  plotted
                </span>

                <span>
                  <b>{investigation.hypotheses.length}</b>
                  total
                </span>
              </div>
            </header>

            <div className="fv2-hyp-viz-map">
              <div className="fv2-hyp-viz-axis x-axis" />
              <div className="fv2-hyp-viz-axis y-axis" />

              {investigation.hypotheses
                .filter((h) => h.impactRegion)
                .map((h) => {
                  const positioned =
                    investigation.hypotheses
                      .filter((x) => x.impactRegion)
                      .map((x) => x.impactRegion!);

                  const maxAbs = Math.max(
                    10,
                    ...positioned.flatMap((p) => [
                      Math.abs(p.xMetres) + p.radiusMetres,
                      Math.abs(p.yMetres) + p.radiusMetres,
                    ]),
                  );

                  const p = h.impactRegion!;
                  const left =
                    50 +
                    (p.xMetres / (maxAbs * 2)) * 86;
                  const top =
                    50 -
                    (p.yMetres / (maxAbs * 2)) * 86;
                  const size = Math.max(
                    22,
                    Math.min(
                      130,
                      (p.radiusMetres / maxAbs) * 190,
                    ),
                  );

                  return (
                    <div
                      key={h.id}
                      className={`fv2-hyp-viz-region ${
                        h.selectedForSimulation
                          ? "is-queued"
                          : ""
                      }`}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                      }}
                      title={`${h.code} · ${h.title}`}
                    >
                      <span>{h.code}</span>
                    </div>
                  );
                })}

              {!investigation.hypotheses.some(
                (h) => h.impactRegion,
              ) && (
                <div className="fv2-hyp-viz-map-empty">
                  <MapPinned size={52} />
                  <strong>No impact regions plotted</strong>
                  <small>
                    X / Y / radius geometry appears here
                  </small>
                </div>
              )}

              <div className="fv2-hyp-viz-map-origin">
                <Crosshair size={18} />
                <span>Scene datum</span>
              </div>
            </div>
          </section>

          <section className="fv2-hyp-viz-register">
            <header>
              <Orbit size={20} />

              <div>
                <span>Hypothesis register</span>
                <strong>Competing explanations</strong>
              </div>

              <div className="fv2-hyp-viz-module-count">
                <b>{investigation.hypotheses.length}</b>
                <span>active records</span>
              </div>
            </header>

            {investigation.hypotheses.length === 0 ? (
              <div className="fv2-hyp-viz-empty">
                <Orbit size={50} />
                <strong>No hypotheses registered</strong>
                <small>
                  Build the first testable explanation in the inspector
                </small>
              </div>
            ) : (
              <div className="fv2-hyp-viz-card-grid">
                {investigation.hypotheses.map((h) => {
                  const supportCount =
                    h.supportingFindingIds.length +
                    h.supportingEvidenceIds.length;

                  const conflictCount =
                    h.conflictingFindingIds.length +
                    h.conflictingEvidenceIds.length;

                  const ready = readiness(h);

                  return (
                    <article
                      key={h.id}
                      className={`fv2-hyp-viz-card ${
                        h.selectedForSimulation
                          ? "is-queued"
                          : ""
                      }`}
                    >
                      <header>
                        <div className="fv2-hyp-viz-card__identity">
                          <span className="fv2-hyp-viz-card__icon">
                            <Orbit size={27} />
                          </span>

                          <div>
                            <small>{h.code}</small>
                            <strong>{h.title}</strong>
                          </div>
                        </div>

                        <span className="fv2-hyp-viz-card__status">
                          {h.status}
                        </span>
                      </header>

                      <p>{h.summary}</p>

                      <div className="fv2-hyp-viz-readiness-row">
                        <div
                          className="fv2-hyp-viz-readiness-ring"
                          style={{
                            background: `conic-gradient(#e8872d ${ready}%, #333 ${ready}% 100%)`,
                          }}
                        >
                          <span>{ready}%</span>
                        </div>

                        <div className="fv2-hyp-viz-metric">
                          <ShieldCheck size={20} />
                          <span>Support</span>
                          <strong>{supportCount}</strong>
                        </div>

                        <div
                          className={`fv2-hyp-viz-metric ${
                            conflictCount > 0
                              ? "is-conflict"
                              : ""
                          }`}
                        >
                          <CircleDot size={20} />
                          <span>Conflict</span>
                          <strong>{conflictCount}</strong>
                        </div>

                        <div
                          className={`fv2-hyp-viz-metric ${
                            h.missingEvidence.length > 0
                              ? "is-attention"
                              : ""
                          }`}
                        >
                          <FileSearch size={20} />
                          <span>Missing</span>
                          <strong>
                            {h.missingEvidence.length}
                          </strong>
                        </div>
                      </div>

                      <div className="fv2-hyp-viz-card__meta">
                        <span>
                          <Gauge size={14} />
                          {h.confidence}
                        </span>

                        <span>
                          <Waypoints size={14} />
                          {h.eventSequence.length}
                          {" "}
                          events
                        </span>

                        <span>
                          <ClipboardList size={14} />
                          {h.assumptions.length}
                          {" "}
                          assumptions
                        </span>
                      </div>

                      {h.impactRegion && (
                        <div className="fv2-hyp-viz-card__geometry">
                          <MapPinned size={18} />

                          <span>
                            X {h.impactRegion.xMetres.toFixed(2)}
                            {"  ·  "}
                            Y {h.impactRegion.yMetres.toFixed(2)}
                            {"  ·  "}
                            R {h.impactRegion.radiusMetres.toFixed(2)}
                            {" m"}
                          </span>
                        </div>
                      )}

                      <footer>
                        <button
                          type="button"
                          className={
                            compareIds.has(h.id)
                              ? "is-active"
                              : ""
                          }
                          onClick={() => toggleCompare(h.id)}
                          title={
                            compareIds.has(h.id)
                              ? "Remove from comparison"
                              : "Compare hypothesis"
                          }
                          aria-label={
                            compareIds.has(h.id)
                              ? "Remove from comparison"
                              : "Compare hypothesis"
                          }
                        >
                          <Waypoints size={16} />
                          <span>Compare</span>
                        </button>

                        <button
                          type="button"
                          className={
                            h.selectedForSimulation
                              ? "is-active"
                              : ""
                          }
                          onClick={() => queue(h)}
                          title={
                            h.selectedForSimulation
                              ? "Remove from simulation queue"
                              : "Queue for simulation"
                          }
                          aria-label={
                            h.selectedForSimulation
                              ? "Remove from simulation queue"
                              : "Queue for simulation"
                          }
                        >
                          <Play size={16} />
                          <span>
                            {h.selectedForSimulation
                              ? "Queued"
                              : "Simulate"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() => remove(h)}
                          title={`Remove ${h.code}`}
                          aria-label={`Remove ${h.code}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </footer>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {compared.length > 0 && (
            <section className="fv2-hyp-viz-compare">
              <header>
                <Waypoints size={20} />

                <div>
                  <span>Comparison</span>
                  <strong>
                    {compared.length === 2
                      ? "Competing hypothesis comparison"
                      : "Select one more hypothesis"}
                  </strong>
                </div>

                <div className="fv2-hyp-viz-module-count">
                  <b>{compared.length}/2</b>
                  <span>selected</span>
                </div>
              </header>

              <div className="fv2-hyp-viz-compare-grid">
                {compared.map((h) => (
                  <article key={h.id}>
                    <div className="fv2-hyp-viz-compare-title">
                      <span>{h.code}</span>
                      <strong>{h.title}</strong>
                    </div>

                    <div className="fv2-hyp-viz-compare-metrics">
                      <span>
                        <b>{readiness(h)}%</b>
                        readiness
                      </span>

                      <span>
                        <b>
                          {
                            h.supportingFindingIds.length +
                            h.supportingEvidenceIds.length
                          }
                        </b>
                        support
                      </span>

                      <span>
                        <b>
                          {
                            h.conflictingFindingIds.length +
                            h.conflictingEvidenceIds.length
                          }
                        </b>
                        conflicts
                      </span>

                      <span>
                        <b>{h.missingEvidence.length}</b>
                        missing
                      </span>
                    </div>

                    <div className="fv2-hyp-viz-compare-details">
                      <div>
                        <span>Status</span>
                        <strong>{h.status}</strong>
                      </div>

                      <div>
                        <span>Confidence</span>
                        <strong>{h.confidence}</strong>
                      </div>

                      <div>
                        <span>Assumptions</span>
                        <strong>
                          {h.assumptions.length
                            ? h.assumptions.join("; ")
                            : "None"}
                        </strong>
                      </div>

                      <div>
                        <span>Missing evidence</span>
                        <strong>
                          {h.missingEvidence.length
                            ? h.missingEvidence.join("; ")
                            : "None"}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="fv2-hyp-viz-inspector">
          <section className="fv2-hyp-viz-inspector-module">
            <header>
              <Orbit size={19} />

              <div>
                <span>Hypothesis composer</span>
                <strong>Testable explanation</strong>
              </div>
            </header>

            <div className="fv2-hyp-viz-inspector-body">
              <label className="fv2-hyp-viz-field">
                <span>Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="H1 · Vehicle A entered first"
                />
              </label>

              <label className="fv2-hyp-viz-field">
                <span>Proposed explanation</span>
                <textarea
                  rows={5}
                  value={summary}
                  onChange={(e) =>
                    setSummary(e.target.value)
                  }
                  placeholder="Describe the proposed sequence"
                />
              </label>

              <div className="fv2-hyp-viz-two">
                <label>
                  <span>Status</span>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as HypothesisStatus,
                      )
                    }
                  >
                    {HYPOTHESIS_STATUS_OPTIONS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Confidence</span>
                  <select
                    value={confidence}
                    onChange={(e) =>
                      setConfidence(
                        e.target
                          .value as ForensicConfidence,
                      )
                    }
                  >
                    {FORENSIC_CONFIDENCE_OPTIONS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="fv2-hyp-viz-provenance">
                <ShieldCheck size={23} />

                <div>
                  <span>Provenance</span>
                  <strong>Investigator Assumption</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="fv2-hyp-viz-inspector-module">
            <header>
              <MapPinned size={19} />

              <div>
                <span>Impact geometry</span>
                <strong>Scene-relative region</strong>
              </div>
            </header>

            <div className="fv2-hyp-viz-geometry-console">
              <label>
                <span>X</span>
                <strong>
                  {impactX.trim() || "—"}
                  <small>m</small>
                </strong>
                <input
                  inputMode="decimal"
                  value={impactX}
                  onChange={(e) =>
                    setImpactX(e.target.value)
                  }
                  aria-label="Impact X metres"
                />
              </label>

              <label>
                <span>Y</span>
                <strong>
                  {impactY.trim() || "—"}
                  <small>m</small>
                </strong>
                <input
                  inputMode="decimal"
                  value={impactY}
                  onChange={(e) =>
                    setImpactY(e.target.value)
                  }
                  aria-label="Impact Y metres"
                />
              </label>

              <label>
                <span>Radius</span>
                <strong>
                  {impactRadius.trim() || "—"}
                  <small>m</small>
                </strong>
                <input
                  inputMode="decimal"
                  value={impactRadius}
                  onChange={(e) =>
                    setImpactRadius(e.target.value)
                  }
                  aria-label="Impact radius metres"
                />
              </label>
            </div>

            <label className="fv2-hyp-viz-field fv2-hyp-viz-field--padded">
              <span>Region description</span>
              <input
                value={impactDescription}
                onChange={(e) =>
                  setImpactDescription(e.target.value)
                }
                placeholder="Optional impact-region description"
              />
            </label>
          </section>

          <details
            className="fv2-hyp-viz-inspector-module"
            open
          >
            <summary>
              <FileSearch size={19} />

              <div>
                <span>Evidence relationships</span>
                <strong>
                  {
                    supportingFindingIds.size +
                    conflictingFindingIds.size +
                    supportingEvidenceIds.size +
                    conflictingEvidenceIds.size
                  }
                  {" "}
                  classified
                </strong>
              </div>

              <ChevronDown size={18} />
            </summary>

            <div className="fv2-hyp-viz-relation-groups">
              <div>
                <header>
                  <span>Analysis findings</span>
                  <small>
                    {investigation.analysisFindings.length}
                  </small>
                </header>

                {investigation.analysisFindings.length === 0 ? (
                  <div className="fv2-hyp-viz-drawer-empty">
                    No analysis findings
                  </div>
                ) : (
                  <div className="fv2-hyp-viz-relation-list">
                    {investigation.analysisFindings.map(
                      (finding) => (
                        <article key={finding.id}>
                          <div>
                            <strong>
                              {finding.code}
                              {" · "}
                              {finding.category}
                            </strong>
                            <span>{finding.finding}</span>
                          </div>

                          <div>
                            <button
                              type="button"
                              className={
                                supportingFindingIds.has(
                                  finding.id,
                                )
                                  ? "support is-active"
                                  : "support"
                              }
                              onClick={() =>
                                toggleExclusive(
                                  finding.id,
                                  true,
                                  setSupportingFindingIds,
                                  setConflictingFindingIds,
                                )
                              }
                              title="Supports hypothesis"
                            >
                              <ShieldCheck size={15} />
                              <span>Support</span>
                            </button>

                            <button
                              type="button"
                              className={
                                conflictingFindingIds.has(
                                  finding.id,
                                )
                                  ? "conflict is-active"
                                  : "conflict"
                              }
                              onClick={() =>
                                toggleExclusive(
                                  finding.id,
                                  false,
                                  setSupportingFindingIds,
                                  setConflictingFindingIds,
                                )
                              }
                              title="Conflicts with hypothesis"
                            >
                              <CircleDot size={15} />
                              <span>Conflict</span>
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div>
                <header>
                  <span>Physical evidence</span>
                  <small>{investigation.evidence.length}</small>
                </header>

                {investigation.evidence.length === 0 ? (
                  <div className="fv2-hyp-viz-drawer-empty">
                    No physical evidence
                  </div>
                ) : (
                  <div className="fv2-hyp-viz-relation-list">
                    {investigation.evidence.map(
                      (evidence) => (
                        <article key={evidence.id}>
                          <div>
                            <strong>
                              {evidence.code}
                              {" · "}
                              {evidence.type}
                            </strong>
                            <span>{evidence.description}</span>
                          </div>

                          <div>
                            <button
                              type="button"
                              className={
                                supportingEvidenceIds.has(
                                  evidence.id,
                                )
                                  ? "support is-active"
                                  : "support"
                              }
                              onClick={() =>
                                toggleExclusive(
                                  evidence.id,
                                  true,
                                  setSupportingEvidenceIds,
                                  setConflictingEvidenceIds,
                                )
                              }
                              title="Supports hypothesis"
                            >
                              <ShieldCheck size={15} />
                              <span>Support</span>
                            </button>

                            <button
                              type="button"
                              className={
                                conflictingEvidenceIds.has(
                                  evidence.id,
                                )
                                  ? "conflict is-active"
                                  : "conflict"
                              }
                              onClick={() =>
                                toggleExclusive(
                                  evidence.id,
                                  false,
                                  setSupportingEvidenceIds,
                                  setConflictingEvidenceIds,
                                )
                              }
                              title="Conflicts with hypothesis"
                            >
                              <CircleDot size={15} />
                              <span>Conflict</span>
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>

          <details className="fv2-hyp-viz-inspector-module">
            <summary>
              <ScanLine size={19} />

              <div>
                <span>Context records</span>
                <strong>
                  {
                    sourceMeasurementIds.size +
                    sourceVehicleIds.size +
                    sourcePersonIds.size +
                    sourceWitnessIds.size
                  }
                  {" "}
                  linked
                </strong>
              </div>

              <ChevronDown size={18} />
            </summary>

            <div className="fv2-hyp-viz-context-grid">
              <details>
                <summary>
                  <span>Measurements</span>
                  <b>
                    {sourceMeasurementIds.size}/
                    {investigation.measurements.length}
                  </b>
                </summary>

                <div>
                  {investigation.measurements.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={sourceMeasurementIds.has(
                          r.id,
                        )}
                        onChange={() =>
                          toggle(
                            setSourceMeasurementIds,
                            r.id,
                          )
                        }
                      />

                      <span>
                        <b>{r.code}</b>
                        {" "}
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </details>

              <details>
                <summary>
                  <span>Vehicles</span>
                  <b>
                    {sourceVehicleIds.size}/
                    {investigation.vehicles.length}
                  </b>
                </summary>

                <div>
                  {investigation.vehicles.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={sourceVehicleIds.has(r.id)}
                        onChange={() =>
                          toggle(
                            setSourceVehicleIds,
                            r.id,
                          )
                        }
                      />

                      <span>
                        <b>{r.code}</b>
                        {" "}
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </details>

              <details>
                <summary>
                  <span>Persons / drivers</span>
                  <b>
                    {sourcePersonIds.size}/
                    {investigation.persons.length}
                  </b>
                </summary>

                <div>
                  {investigation.persons.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={sourcePersonIds.has(r.id)}
                        onChange={() =>
                          toggle(
                            setSourcePersonIds,
                            r.id,
                          )
                        }
                      />

                      <span>
                        <b>{r.code}</b>
                        {" "}
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </details>

              <details>
                <summary>
                  <span>Witnesses</span>
                  <b>
                    {sourceWitnessIds.size}/
                    {investigation.witnesses.length}
                  </b>
                </summary>

                <div>
                  {investigation.witnesses.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={sourceWitnessIds.has(r.id)}
                        onChange={() =>
                          toggle(
                            setSourceWitnessIds,
                            r.id,
                          )
                        }
                      />

                      <span>
                        <b>{r.code}</b>
                        {" "}
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </details>

          <section className="fv2-hyp-viz-inspector-module">
            <header>
              <Waypoints size={19} />

              <div>
                <span>Event sequence</span>
                <strong>
                  {lines(eventSequence).length}
                  {" "}
                  event(s)
                </strong>
              </div>
            </header>

            {lines(eventSequence).length > 0 && (
              <ol className="fv2-hyp-viz-sequence-preview">
                {lines(eventSequence).map(
                  (description, index) => (
                    <li key={`${index}-${description}`}>
                      <span>{index + 1}</span>
                      <p>{description}</p>
                    </li>
                  ),
                )}
              </ol>
            )}

            <textarea
              className="fv2-hyp-viz-sequence-input"
              rows={5}
              value={eventSequence}
              onChange={(e) =>
                setEventSequence(e.target.value)
              }
              placeholder={"Approach\nBraking\nContact\nPost-impact movement"}
            />
          </section>

          <details className="fv2-hyp-viz-inspector-module">
            <summary>
              <ClipboardList size={19} />

              <div>
                <span>Assumptions / gaps</span>
                <strong>
                  {lines(assumptions).length}
                  {" "}
                  assumptions ·
                  {" "}
                  {lines(missingEvidence).length}
                  {" "}
                  missing
                </strong>
              </div>

              <ChevronDown size={18} />
            </summary>

            <div className="fv2-hyp-viz-text-pair">
              <label>
                <span>Assumptions</span>
                <textarea
                  rows={4}
                  value={assumptions}
                  onChange={(e) =>
                    setAssumptions(e.target.value)
                  }
                  placeholder="One assumption per line"
                />
              </label>

              <label>
                <span>Missing evidence</span>
                <textarea
                  rows={4}
                  value={missingEvidence}
                  onChange={(e) =>
                    setMissingEvidence(e.target.value)
                  }
                  placeholder="One unresolved need per line"
                />
              </label>
            </div>
          </details>

          <details className="fv2-hyp-viz-inspector-module">
            <summary>
              <ClipboardList size={19} />

              <div>
                <span>Hypothesis notes</span>
                <strong>
                  {notes.trim()
                    ? "Notes recorded"
                    : "Optional"}
                </strong>
              </div>

              <ChevronDown size={18} />
            </summary>

            <textarea
              className="fv2-hyp-viz-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional investigator notes"
            />
          </details>

          <button
            type="button"
            className="fv2-hyp-viz-save"
            onClick={addHypothesis}
          >
            <Plus size={17} />
            <span>Save hypothesis</span>
          </button>
        </aside>
      </div>
    </div>
  );

}
