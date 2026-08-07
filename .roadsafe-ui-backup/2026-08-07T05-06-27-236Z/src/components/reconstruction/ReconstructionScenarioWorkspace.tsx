import { memo, useMemo, useState } from "react";

import type { AccidentReconstruction } from "../../types/reconstruction";
import {
  ReconstructionScenarioService,
  type AssumptionClassification,
  type ReconstructionScenario,
  type ScenarioStatus,
} from "../../services/reconstructionScenarioService";
import {
  getSuggestedFrictionCoefficient,
  validateReconstruction,
} from "../../services/reconstructionValidationService";

interface ReconstructionScenarioWorkspaceProps {
  reconstruction: AccidentReconstruction;
  onLoadScenario: (scenario: ReconstructionScenario) => void;
}

const CLASSIFICATIONS: AssumptionClassification[] = ["Observed", "Measured", "Reported", "Estimated", "Assumed"];
const STATUSES: ScenarioStatus[] = ["Under Review", "Accepted", "Rejected"];

function scenarioMetrics(scenario: ReconstructionScenario) {
  const result = validateReconstruction(scenario.snapshot, {
    reactionTimeSeconds: 1.5,
    frictionCoefficient: getSuggestedFrictionCoefficient(scenario.snapshot),
  });
  return {
    critical: result.issues.filter((issue) => issue.severity === "Critical").length,
    warnings: result.issues.filter((issue) => issue.severity === "Warning").length,
    impactSpread: result.impactTimeSpreadSeconds,
    participants: result.participants,
  };
}

function ReconstructionScenarioWorkspace({ reconstruction, onLoadScenario }: ReconstructionScenarioWorkspaceProps) {
  const [scenarios, setScenarios] = useState(() => ReconstructionScenarioService.list(reconstruction.id));
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(scenarios[0]?.id ?? null);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [assumptionLabel, setAssumptionLabel] = useState("");
  const [assumptionValue, setAssumptionValue] = useState("");
  const [assumptionClass, setAssumptionClass] = useState<AssumptionClassification>("Assumed");
  const [assumptionEvidenceIds, setAssumptionEvidenceIds] = useState<string[]>([]);

  const refresh = () => setScenarios(ReconstructionScenarioService.list(reconstruction.id));
  const selected = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  const comparisons = useMemo(() => scenarios.map((scenario) => ({ scenario, metrics: scenarioMetrics(scenario) })), [scenarios]);

  const updateSelected = (updates: Parameters<typeof ReconstructionScenarioService.update>[1]) => {
    if (!selected) return;
    ReconstructionScenarioService.update(selected.id, updates);
    refresh();
  };

  const addAssumption = () => {
    if (!selected || !assumptionLabel.trim() || !assumptionValue.trim()) return;
    updateSelected({
      assumptions: [...selected.assumptions, {
        id: `assumption-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: assumptionLabel.trim(),
        value: assumptionValue.trim(),
        classification: assumptionClass,
        evidenceRecordIds: assumptionEvidenceIds,
        notes: "",
      }],
    });
    setAssumptionLabel("");
    setAssumptionValue("");
    setAssumptionEvidenceIds([]);
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-950 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Alternative hypotheses</p>
            <h2 className="mt-1 text-xl font-black">Scenario Comparison Workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">Preserve the working reconstruction, test alternatives, link assumptions to evidence and document why a scenario was accepted or rejected.</p>
          </div>
          <div className="flex min-w-[280px] gap-2">
            <input value={newScenarioName} onChange={(event) => setNewScenarioName(event.target.value)} placeholder={`Scenario ${String.fromCharCode(65 + scenarios.length)}`} className="min-w-0 flex-1 rounded-sm border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-indigo-300" />
            <button type="button" onClick={() => {
              const created = ReconstructionScenarioService.create(reconstruction, newScenarioName || `Scenario ${String.fromCharCode(65 + scenarios.length)}`);
              setSelectedScenarioId(created.id);
              setNewScenarioName("");
              refresh();
            }} className="rounded-sm bg-white px-4 py-2 text-xs font-black text-indigo-950">Save Current as Scenario</button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {scenarios.length === 0 ? (
          <p className="rounded-sm border border-dashed border-indigo-300 bg-indigo-50 p-7 text-center text-sm text-indigo-900">Create Scenario A from the current reconstruction, then change the working speeds, timing, braking point or heading and save another scenario for comparison.</p>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              <h3 className="font-black text-gray-950">Saved scenarios</h3>
              {comparisons.map(({ scenario, metrics }) => (
                <button key={scenario.id} type="button" onClick={() => setSelectedScenarioId(scenario.id)} className={`w-full rounded-sm border p-4 text-left transition ${selectedScenarioId === scenario.id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-gray-200 hover:bg-gray-50"}`}>
                  <div className="flex items-center justify-between gap-3"><strong className="text-sm text-gray-950">{scenario.name}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${scenario.preferred ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>{scenario.preferred ? "Preferred" : scenario.status}</span></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"><span className="rounded-lg bg-red-50 p-2 text-red-800"><strong className="block text-base">{metrics.critical}</strong>Critical</span><span className="rounded-lg bg-amber-50 p-2 text-amber-900"><strong className="block text-base">{metrics.warnings}</strong>Warnings</span><span className="rounded-lg bg-sky-50 p-2 text-sky-900"><strong className="block text-base">{metrics.impactSpread?.toFixed(2) ?? "—"}s</strong>Impact spread</span></div>
                  <p className="mt-3 text-[11px] text-gray-500">{metrics.participants.map((participant) => `${participant.participantName}: ${participant.impactSpeedKmh.toFixed(0)} km/h impact`).join(" · ") || "No participants"}</p>
                </button>
              ))}
            </div>

            {selected && (
              <div className="space-y-4 rounded-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} className="min-w-[180px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold" />
                  <select value={selected.status} onChange={(event) => updateSelected({ status: event.target.value as ScenarioStatus })} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                  <button type="button" onClick={() => { ReconstructionScenarioService.setPreferred(reconstruction.id, selected.id); refresh(); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Mark Preferred</button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onLoadScenario(selected)} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-black text-white">Load into Editor</button>
                  <button type="button" onClick={() => { ReconstructionScenarioService.capture(selected.id, reconstruction); refresh(); }} className="rounded-lg border border-indigo-300 px-4 py-2 text-xs font-black text-indigo-800">Replace with Current Scene</button>
                  <button type="button" onClick={() => { if (window.confirm(`Delete ${selected.name}?`)) { ReconstructionScenarioService.remove(selected.id); setSelectedScenarioId(null); refresh(); } }} className="rounded-lg border border-red-200 px-4 py-2 text-xs font-black text-red-700">Delete</button>
                </div>

                <div>
                  <h4 className="font-black text-gray-950">Evidence-backed assumptions</h4>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_0.8fr_auto]"><input value={assumptionLabel} onChange={(event) => setAssumptionLabel(event.target.value)} placeholder="e.g. Vehicle A speed" className="rounded-lg border border-gray-300 px-3 py-2 text-xs" /><input value={assumptionValue} onChange={(event) => setAssumptionValue(event.target.value)} placeholder="e.g. 65 km/h" className="rounded-lg border border-gray-300 px-3 py-2 text-xs" /><select value={assumptionClass} onChange={(event) => setAssumptionClass(event.target.value as AssumptionClassification)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs">{CLASSIFICATIONS.map((classification) => <option key={classification}>{classification}</option>)}</select><button type="button" onClick={addAssumption} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">Add</button></div>
                  {reconstruction.evidenceRecords.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{reconstruction.evidenceRecords.map((record) => <label key={record.id} className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[10px]"><input type="checkbox" checked={assumptionEvidenceIds.includes(record.id)} onChange={(event) => setAssumptionEvidenceIds((current) => event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id))} />{record.title}</label>)}</div>}
                  <div className="mt-3 space-y-2">{selected.assumptions.map((assumption) => <div key={assumption.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-3"><div><p className="text-xs font-black text-gray-900">{assumption.label}: {assumption.value}</p><p className="mt-1 text-[10px] text-gray-500">{assumption.classification} · {assumption.evidenceRecordIds.length} linked evidence item(s)</p></div><button type="button" onClick={() => updateSelected({ assumptions: selected.assumptions.filter((item) => item.id !== assumption.id) })} className="text-[10px] font-black text-red-600">Remove</button></div>)}</div>
                </div>

                <label className="block"><span className="text-xs font-black text-gray-700">Acceptance/rejection conclusion</span><textarea value={selected.conclusion} onChange={(event) => updateSelected({ conclusion: event.target.value })} rows={4} placeholder="State why this scenario is supported, disputed, accepted or rejected…" className="mt-1 w-full rounded-sm border border-gray-300 px-3 py-2 text-sm" /></label>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(ReconstructionScenarioWorkspace);
