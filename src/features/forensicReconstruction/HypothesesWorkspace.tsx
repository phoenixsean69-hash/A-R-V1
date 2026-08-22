import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  FORENSIC_CONFIDENCE_OPTIONS,
  HYPOTHESIS_STATUS_OPTIONS,
  type ForensicAccidentInvestigation,
  type ForensicConfidence,
  type ForensicCrashHypothesis,
  type HypothesisStatus,
} from "./forensicInvestigationTypes";
import { ForensicInvestigationService } from "./forensicInvestigationService";
import "./HypothesesWorkspace.css";

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

  const code = (kind: string, id: string) => {
    const list =
      kind === "finding" ? investigation.analysisFindings :
      kind === "evidence" ? investigation.evidence :
      kind === "measurement" ? investigation.measurements :
      kind === "vehicle" ? investigation.vehicles :
      kind === "person" ? investigation.persons :
      investigation.witnesses;
    return list.find((item) => item.id === id)?.code ?? id;
  };

  return (
    <div className="fv2-stack fv2-hyp-workstation">
      <section className="fv2-panel fv2-hyp-hero">
        <header>
          <div>
            <span>Competing crash hypotheses</span>
            <strong>Build explanations that can be challenged by the evidence</strong>
          </div>
          <div className="fv2-hyp-summary">
            <span>{investigation.hypotheses.length} hypothesis(es)</span>
            <span>{compareIds.size}/2 comparison</span>
            <span>{investigation.hypotheses.filter((h) => h.selectedForSimulation).length} queued</span>
          </div>
        </header>
        <div className="fv2-hyp-rule">
          A hypothesis is not an observed fact. RoadSafe stores it as an Investigator
          Assumption, shows what supports and conflicts with it, and only then allows
          it to move toward physics or simulation testing.
        </div>
        <div className="fv2-hyp-flow">
          <div>Evidence</div><span>→</span><div>Analysis</div><span>→</span>
          <div className="active">Competing hypotheses</div><span>→</span><div>Physics / simulation</div>
        </div>
      </section>

      <div className="fv2-hyp-layout">
        <div className="fv2-hyp-main">
          <section className="fv2-panel">
            <header><div><span>Hypothesis register</span><strong>Current competing explanations</strong></div></header>
            {investigation.hypotheses.length === 0 ? (
              <div className="fv2-hyp-empty">
                <strong>No crash hypotheses yet.</strong>
                <span>Create plausible alternatives where the current evidence allows more than one explanation.</span>
              </div>
            ) : (
              <div className="fv2-hyp-card-grid">
                {investigation.hypotheses.map((h) => (
                  <article key={h.id} className={`fv2-hyp-card ${h.selectedForSimulation ? "is-queued" : ""}`}>
                    <div className="fv2-hyp-card-head">
                      <div><span>{h.code}</span><strong>{h.title}</strong></div>
                      <div className="fv2-hyp-badges"><span>{h.status}</span><span>{h.confidence}</span></div>
                    </div>
                    <p>{h.summary}</p>
                    <div className="fv2-hyp-metrics">
                      <div><span>Support</span><strong>{h.supportingFindingIds.length + h.supportingEvidenceIds.length}</strong></div>
                      <div className={(h.conflictingFindingIds.length + h.conflictingEvidenceIds.length) ? "conflict" : ""}>
                        <span>Conflict</span><strong>{h.conflictingFindingIds.length + h.conflictingEvidenceIds.length}</strong>
                      </div>
                      <div><span>Assumptions</span><strong>{h.assumptions.length}</strong></div>
                      <div className={h.missingEvidence.length ? "attention" : ""}><span>Missing</span><strong>{h.missingEvidence.length}</strong></div>
                    </div>
                    <div className="fv2-hyp-readiness">
                      <div><span>Test readiness</span><strong>{readiness(h)}%</strong></div>
                      <div className="fv2-hyp-readiness-track"><i style={{ width: `${readiness(h)}%` }} /></div>
                    </div>
                    {h.impactRegion && (
                      <div className="fv2-hyp-impact">
                        <span>Proposed impact region</span>
                        <strong>X {h.impactRegion.xMetres.toFixed(2)} m · Y {h.impactRegion.yMetres.toFixed(2)} m · R {h.impactRegion.radiusMetres.toFixed(2)} m</strong>
                        {h.impactRegion.description && <small>{h.impactRegion.description}</small>}
                      </div>
                    )}
                    {h.eventSequence.length > 0 && (
                      <ol className="fv2-hyp-sequence">
                        {h.eventSequence.map((event) => (
                          <li key={event.id}><span>{event.order}</span><p>{event.description}</p></li>
                        ))}
                      </ol>
                    )}
                    <div className="fv2-hyp-card-actions">
                      <button type="button" className={compareIds.has(h.id) ? "is-active" : ""} onClick={() => toggleCompare(h.id)}>
                        {compareIds.has(h.id) ? "Remove comparison" : "Compare"}
                      </button>
                      <button type="button" className={h.selectedForSimulation ? "simulation-selected" : ""} onClick={() => queue(h)}>
                        {h.selectedForSimulation ? "Queued for simulation" : "Send to simulation"}
                      </button>
                      <button type="button" className="danger" onClick={() => remove(h)}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {compared.length > 0 && (
            <section className="fv2-panel">
              <header><div><span>Side-by-side hypothesis comparison</span><strong>{compared.length === 2 ? "Compare competing explanations" : "Select one more hypothesis"}</strong></div></header>
              <div className="fv2-hyp-compare-grid">
                {compared.map((h) => (
                  <article key={h.id} className="fv2-hyp-compare-card">
                    <div className="fv2-hyp-compare-title"><span>{h.code}</span><strong>{h.title}</strong></div>
                    <dl>
                      <div><dt>Status</dt><dd>{h.status}</dd></div>
                      <div><dt>Confidence</dt><dd>{h.confidence}</dd></div>
                      <div><dt>Supporting findings</dt><dd>{h.supportingFindingIds.map((id) => code("finding", id)).join(", ") || "None"}</dd></div>
                      <div><dt>Conflicting findings</dt><dd>{h.conflictingFindingIds.map((id) => code("finding", id)).join(", ") || "None"}</dd></div>
                      <div><dt>Supporting evidence</dt><dd>{h.supportingEvidenceIds.map((id) => code("evidence", id)).join(", ") || "None"}</dd></div>
                      <div><dt>Conflicting evidence</dt><dd>{h.conflictingEvidenceIds.map((id) => code("evidence", id)).join(", ") || "None"}</dd></div>
                      <div><dt>Assumptions</dt><dd>{h.assumptions.join("; ") || "None recorded"}</dd></div>
                      <div><dt>Missing evidence</dt><dd>{h.missingEvidence.join("; ") || "None recorded"}</dd></div>
                      <div><dt>Test readiness</dt><dd>{readiness(h)}%</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="fv2-panel">
            <header><div><span>Proposed impact regions</span><strong>Scene-relative hypothesis geometry</strong></div></header>
            <div className="fv2-hyp-impact-map">
              <div className="fv2-hyp-axis x-axis" /><div className="fv2-hyp-axis y-axis" />
              {investigation.hypotheses.filter((h) => h.impactRegion).map((h) => {
                const positioned = investigation.hypotheses.filter((x) => x.impactRegion).map((x) => x.impactRegion!);
                const maxAbs = Math.max(10, ...positioned.flatMap((p) => [Math.abs(p.xMetres) + p.radiusMetres, Math.abs(p.yMetres) + p.radiusMetres]));
                const p = h.impactRegion!;
                const left = 50 + (p.xMetres / (maxAbs * 2)) * 86;
                const top = 50 - (p.yMetres / (maxAbs * 2)) * 86;
                const size = Math.max(18, Math.min(120, (p.radiusMetres / maxAbs) * 180));
                return <div key={h.id} className="fv2-hyp-impact-region" style={{ left: `${left}%`, top: `${top}%`, width: `${size}px`, height: `${size}px` }}><span>{h.code}</span></div>;
              })}
              {!investigation.hypotheses.some((h) => h.impactRegion) && (
                <div className="fv2-hyp-map-empty">Proposed impact regions will appear here after X/Y/radius values are recorded.</div>
              )}
            </div>
            <div className="fv2-hyp-map-note">
              Coordinates use the scene datum/reference. These are proposed regions for hypothesis testing, not confirmed points of impact.
            </div>
          </section>
        </div>

        <aside className="fv2-hyp-composer">
          <section className="fv2-panel">
            <header><div><span>Hypothesis composer</span><strong>Create a testable crash explanation</strong></div></header>
            <div className="fv2-hyp-form">
              <label className="fv2-field full"><span>Hypothesis title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. H1 — Vehicle A entered the junction before Vehicle B" /></label>
              <label className="fv2-field full"><span>Proposed crash explanation</span><textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe the proposed sequence without presenting it as established fact." /></label>
              <div className="fv2-hyp-two-col">
                <label className="fv2-field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as HypothesisStatus)}>{HYPOTHESIS_STATUS_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="fv2-field"><span>Confidence</span><select value={confidence} onChange={(e) => setConfidence(e.target.value as ForensicConfidence)}>{FORENSIC_CONFIDENCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
              </div>
              <div className="fv2-hyp-fixed-provenance"><span>Provenance</span><strong>Investigator Assumption</strong><small>Fixed by design. A hypothesis cannot be stored as Observed or Measured.</small></div>

              <div className="fv2-hyp-link-section">
                <div className="fv2-hyp-section-title"><span>Analysis findings</span><small>Supporting or conflicting</small></div>
                {investigation.analysisFindings.length === 0 ? <div className="fv2-empty-select">No analysis findings available.</div> : (
                  <div className="fv2-hyp-link-list">
                    {investigation.analysisFindings.map((f) => (
                      <article key={f.id}>
                        <div><strong>{f.code} · {f.category}</strong><span>{f.finding}</span></div>
                        <div className="fv2-hyp-link-actions">
                          <button type="button" className={`support ${supportingFindingIds.has(f.id) ? "active" : ""}`} onClick={() => toggleExclusive(f.id, true, setSupportingFindingIds, setConflictingFindingIds)}>Supports</button>
                          <button type="button" className={`conflict ${conflictingFindingIds.has(f.id) ? "active" : ""}`} onClick={() => toggleExclusive(f.id, false, setSupportingFindingIds, setConflictingFindingIds)}>Conflicts</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="fv2-hyp-link-section">
                <div className="fv2-hyp-section-title"><span>Physical evidence</span><small>Direct relationship</small></div>
                {investigation.evidence.length === 0 ? <div className="fv2-empty-select">No physical evidence available.</div> : (
                  <div className="fv2-hyp-link-list">
                    {investigation.evidence.map((evidence) => (
                      <article key={evidence.id}>
                        <div><strong>{evidence.code} · {evidence.type}</strong><span>{evidence.description}</span></div>
                        <div className="fv2-hyp-link-actions">
                          <button type="button" className={`support ${supportingEvidenceIds.has(evidence.id) ? "active" : ""}`} onClick={() => toggleExclusive(evidence.id, true, setSupportingEvidenceIds, setConflictingEvidenceIds)}>Supports</button>
                          <button type="button" className={`conflict ${conflictingEvidenceIds.has(evidence.id) ? "active" : ""}`} onClick={() => toggleExclusive(evidence.id, false, setSupportingEvidenceIds, setConflictingEvidenceIds)}>Conflicts</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="fv2-hyp-context-grid">
                <div><span>Measurements used</span><div className="fv2-evidence-select">{investigation.measurements.map((r) => <label key={r.id}><input type="checkbox" checked={sourceMeasurementIds.has(r.id)} onChange={() => toggle(setSourceMeasurementIds, r.id)} /><span><b>{r.code}</b> {r.label}</span></label>)}</div></div>
                <div><span>Vehicles used</span><div className="fv2-evidence-select">{investigation.vehicles.map((r) => <label key={r.id}><input type="checkbox" checked={sourceVehicleIds.has(r.id)} onChange={() => toggle(setSourceVehicleIds, r.id)} /><span><b>{r.code}</b> {r.label}</span></label>)}</div></div>
                <div><span>Persons / drivers used</span><div className="fv2-evidence-select">{investigation.persons.map((r) => <label key={r.id}><input type="checkbox" checked={sourcePersonIds.has(r.id)} onChange={() => toggle(setSourcePersonIds, r.id)} /><span><b>{r.code}</b> {r.label}</span></label>)}</div></div>
                <div><span>Witnesses used</span><div className="fv2-evidence-select">{investigation.witnesses.map((r) => <label key={r.id}><input type="checkbox" checked={sourceWitnessIds.has(r.id)} onChange={() => toggle(setSourceWitnessIds, r.id)} /><span><b>{r.code}</b> {r.label}</span></label>)}</div></div>
              </div>

              <label className="fv2-field full"><span>Assumptions — one per line</span><textarea rows={4} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} /></label>
              <label className="fv2-field full"><span>Missing evidence / unresolved needs — one per line</span><textarea rows={4} value={missingEvidence} onChange={(e) => setMissingEvidence(e.target.value)} /></label>

              <div className="fv2-hyp-section-title"><span>Proposed impact region</span><small>Relative to scene datum; not confirmed POI</small></div>
              <div className="fv2-hyp-three-col">
                <label className="fv2-field"><span>X (m)</span><input inputMode="decimal" value={impactX} onChange={(e) => setImpactX(e.target.value)} /></label>
                <label className="fv2-field"><span>Y (m)</span><input inputMode="decimal" value={impactY} onChange={(e) => setImpactY(e.target.value)} /></label>
                <label className="fv2-field"><span>Radius (m)</span><input inputMode="decimal" value={impactRadius} onChange={(e) => setImpactRadius(e.target.value)} /></label>
              </div>
              <label className="fv2-field full"><span>Impact-region description</span><input value={impactDescription} onChange={(e) => setImpactDescription(e.target.value)} /></label>
              <label className="fv2-field full"><span>Proposed event sequence — one event per line</span><textarea rows={6} value={eventSequence} onChange={(e) => setEventSequence(e.target.value)} placeholder={"Vehicle A approaches\nBraking begins\nVehicles make contact\nPost-impact movement"} /></label>
              <label className="fv2-field full"><span>Hypothesis notes</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            </div>
            <footer><button type="button" className="primary" onClick={addHypothesis}>Save hypothesis</button></footer>
          </section>

          <section className="fv2-panel fv2-notice">
            <b>Forensic rule</b>
            <p>Multiple hypotheses may remain active. RoadSafe should prefer the explanation that survives evidence and physics testing—not the explanation entered first.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
