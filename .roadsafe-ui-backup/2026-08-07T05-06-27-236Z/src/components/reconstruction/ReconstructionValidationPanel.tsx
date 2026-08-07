import { memo, useMemo, useState } from "react";

import type { AccidentReconstruction } from "../../types/reconstruction";
import {
  getSuggestedFrictionCoefficient,
  validateReconstruction,
  type ValidationSeverity,
} from "../../services/reconstructionValidationService";

interface ReconstructionValidationPanelProps {
  reconstruction: AccidentReconstruction;
}

type UnitSystem = "Metric" | "Imperial";

const severityStyles: Record<ValidationSeverity, string> = {
  Critical: "border-red-200 bg-red-50 text-red-900",
  Warning: "border-amber-200 bg-amber-50 text-amber-950",
  Advisory: "border-sky-200 bg-sky-50 text-sky-950",
};

function ReconstructionValidationPanel({
  reconstruction,
}: ReconstructionValidationPanelProps) {
  const [reactionTimeSeconds, setReactionTimeSeconds] = useState(1.5);
  const [frictionCoefficient, setFrictionCoefficient] = useState(() =>
    getSuggestedFrictionCoefficient(reconstruction),
  );
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("Metric");

  const result = useMemo(
    () => validateReconstruction(reconstruction, { reactionTimeSeconds, frictionCoefficient }),
    [frictionCoefficient, reactionTimeSeconds, reconstruction],
  );
  const criticalCount = result.issues.filter((issue) => issue.severity === "Critical").length;
  const warningCount = result.issues.filter((issue) => issue.severity === "Warning").length;
  const formatDistance = (metres: number) => unitSystem === "Metric"
    ? `${metres.toFixed(1)} m`
    : `${(metres * 3.28084).toFixed(1)} ft`;
  const formatSpeed = (kmh: number) => unitSystem === "Metric"
    ? `${kmh.toFixed(0)} km/h`
    : `${(kmh * 0.621371).toFixed(0)} mph`;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-cyan-900 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Phase 2 · non-destructive audit</p>
            <h2 className="mt-1 text-xl font-black">Forensic Validation & Calculations</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100">
              Checks the officer-authored paths without moving them. Results change immediately when dots, timing, speeds or assumptions change.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-sm bg-white/10 px-4 py-3 text-center"><strong className="block text-xl">{criticalCount}</strong><span className="text-[10px] uppercase">Critical</span></span>
            <span className="rounded-sm bg-white/10 px-4 py-3 text-center"><strong className="block text-xl">{warningCount}</strong><span className="text-[10px] uppercase">Warnings</span></span>
            <span className="rounded-sm bg-white/10 px-4 py-3 text-center"><strong className="block text-xl">{result.passedChecks}/{result.totalChecks}</strong><span className="text-[10px] uppercase">Checks passed</span></span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <div className="rounded-sm border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-gray-950">Calculation assumptions</h3>
              <select value={unitSystem} onChange={(event) => setUnitSystem(event.target.value as UnitSystem)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold">
                <option>Metric</option>
                <option>Imperial</option>
              </select>
            </div>
            <label className="mt-4 block">
              <span className="flex justify-between text-xs font-bold text-gray-700"><span>Perception/reaction time</span><span>{reactionTimeSeconds.toFixed(1)} s</span></span>
              <input type="range" min={0.5} max={3} step={0.1} value={reactionTimeSeconds} onChange={(event) => setReactionTimeSeconds(Number(event.target.value))} className="mt-2 w-full" />
            </label>
            <label className="mt-4 block">
              <span className="flex justify-between text-xs font-bold text-gray-700"><span>Tyre/road friction coefficient</span><span>μ {frictionCoefficient.toFixed(2)}</span></span>
              <input type="range" min={0.15} max={1.05} step={0.01} value={frictionCoefficient} onChange={(event) => setFrictionCoefficient(Number(event.target.value))} className="mt-2 w-full" />
            </label>
            <button type="button" onClick={() => setFrictionCoefficient(getSuggestedFrictionCoefficient(reconstruction))} className="mt-4 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50">
              Use {reconstruction.scene.roadSurface.toLowerCase()}-road suggestion
            </button>
          </div>

          <div>
            <h3 className="font-black text-gray-950">Validation findings</h3>
            <div className="mt-3 space-y-2">
              {result.issues.length === 0 ? (
                <p className="rounded-sm border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">No conflicts detected under the selected assumptions.</p>
              ) : result.issues.map((issue) => (
                <div key={issue.id} className={`rounded-sm border p-3 ${severityStyles[issue.severity]}`}>
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm">{issue.title}</strong><span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black uppercase">{issue.severity}</span></div>
                  <p className="mt-1 text-xs leading-5 opacity-80">{issue.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-black text-gray-950">Participant calculations</h3>
          {result.participants.length === 0 ? (
            <p className="mt-3 rounded-sm border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Add a participant to begin validation.</p>
          ) : (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {result.participants.map((metrics) => (
                <article key={metrics.participantId} className="rounded-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-2"><h4 className="font-black text-gray-950">{metrics.participantName}</h4><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">Impact {formatSpeed(metrics.impactSpeedKmh)}</span></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-gray-500">Total path</dt><dd className="mt-1 font-black text-gray-900">{formatDistance(metrics.pathDistanceMetres)}</dd></div>
                    <div><dt className="text-gray-500">Reaction distance</dt><dd className="mt-1 font-black text-gray-900">{formatDistance(metrics.reactionDistanceMetres)}</dd></div>
                    <div><dt className="text-gray-500">Braking distance</dt><dd className="mt-1 font-black text-gray-900">{formatDistance(metrics.brakingDistanceMetres)}</dd></div>
                    <div><dt className="text-gray-500">Total stopping</dt><dd className="mt-1 font-black text-gray-900">{formatDistance(metrics.stoppingDistanceMetres)}</dd></div>
                    <div><dt className="text-gray-500">Confidence range</dt><dd className="mt-1 font-black text-gray-900">{formatDistance(metrics.stoppingDistanceRangeMetres[0])}–{formatDistance(metrics.stoppingDistanceRangeMetres[1])}</dd></div>
                    <div><dt className="text-gray-500">Authored brake distance</dt><dd className="mt-1 font-black text-gray-900">{metrics.availableBrakeDistanceMetres === null ? "No Brake point" : formatDistance(metrics.availableBrakeDistanceMetres)}</dd></div>
                    <div><dt className="text-gray-500">Peak acceleration</dt><dd className="mt-1 font-black text-gray-900">{metrics.maximumAccelerationMps2.toFixed(1)} m/s²</dd></div>
                    <div><dt className="text-gray-500">Peak deceleration</dt><dd className="mt-1 font-black text-gray-900">{metrics.maximumDecelerationMps2.toFixed(1)} m/s²</dd></div>
                  </dl>
                  {metrics.estimatedPreBrakeSpeedKmh !== null && (
                    <p className="mt-4 rounded-lg bg-cyan-50 p-3 text-xs text-cyan-950"><strong>Skid-based pre-brake estimate:</strong> {formatSpeed(metrics.estimatedPreBrakeSpeedKmh)} under the selected friction assumption.</p>
                  )}
                </article>
              ))}
            </div>
          )}
          <div className="mt-4 rounded-sm border border-dashed border-gray-300 bg-gray-50 p-4 text-xs leading-5 text-gray-600">
            <strong className="text-gray-900">Interpretation notice:</strong> these are screening calculations, not certified conclusions. Distances come from the calibrated scene; confidence ranges vary reaction time by ±0.5 s and friction by ±0.12. Record measured road drag, gradient, ABS behaviour and expert assumptions before relying on results in a formal report.
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(ReconstructionValidationPanel);
