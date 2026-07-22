import type {
  AccidentReconstruction,
  ParticipantPhysicsProfile,
  ReconstructionPhysicsSettings,
  ReconstructionVehicle,
} from "../../types/reconstruction";

import {
  DEFAULT_PHYSICS_SETTINGS,
  getDefaultParticipantPhysics,
} from "../../services/reconstructionPhysicsService";

interface PhysicsControlsPanelProps {
  reconstruction: AccidentReconstruction;
  onChange: (updates: Partial<AccidentReconstruction>) => void;
  onRunPhysics: () => void;
}

function updateParticipantPhysics(
  participant: ReconstructionVehicle,
  updates: Partial<ParticipantPhysicsProfile>,
): ReconstructionVehicle {
  return {
    ...participant,
    physics: {
      ...getDefaultParticipantPhysics(participant),
      ...(participant.physics ?? {}),
      ...updates,
    },
  };
}

export default function PhysicsControlsPanel({
  reconstruction,
  onChange,
  onRunPhysics,
}: PhysicsControlsPanelProps) {
  const settings: ReconstructionPhysicsSettings = {
    ...DEFAULT_PHYSICS_SETTINGS,
    ...(reconstruction.physicsSettings ?? {}),
  };

  const updateSettings = (updates: Partial<ReconstructionPhysicsSettings>) => {
    onChange({ physicsSettings: { ...settings, ...updates } });
  };

  const summary = reconstruction.lastPhysicsSimulation;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
      <div className="border-b border-violet-100 bg-blue-950 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
              Premium deterministic simulation
            </p>
            <h2 className="mt-1 text-xl font-black">2D Physics Assistance</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100">
              Use participant mass, approach speed, restitution, road friction and nearby hazards to generate post-impact movement, deflection, sliding and ricochet paths. The generated points remain fully editable and are used by saved footage.
            </p>
          </div>

          <button
            type="button"
            onClick={onRunPhysics}
            disabled={!settings.enabled || reconstruction.vehicles.length === 0}
            className="rounded-sm bg-white px-5 py-3 text-sm font-black text-blue-900 shadow transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
          >
            Run Physics & Bake Movement Paths
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-sm border border-gray-200 p-4">
            <div>
              <p className="text-sm font-black text-gray-900">Physics assistance</p>
              <p className="mt-1 text-xs text-gray-500">Disable to keep movement entirely officer-authored.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => updateSettings({ enabled: event.target.checked })}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between rounded-sm border border-violet-200 bg-violet-50 p-4">
            <div>
              <p className="text-sm font-black text-blue-900">Simulate before playback</p>
              <p className="mt-1 text-xs text-blue-900">
                Synchronize participants at the collision point and rebuild the impact response whenever playback starts from 0s.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoRunOnPlay}
              onChange={(event) => updateSettings({ autoRunOnPlay: event.target.checked })}
              className="h-5 w-5"
            />
          </label>


          <label className="block">
            <span className="text-xs font-bold text-gray-600">Simulation mode</span>
            <select
              value={settings.mode}
              onChange={(event) =>
                updateSettings({
                  mode: event.target.value as ReconstructionPhysicsSettings["mode"],
                })
              }
              className="mt-1 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm"
            >
              <option value="Guided Paths">Guided Paths</option>
              <option value="Physics After Primary Impact">Physics After Primary Impact</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs font-bold text-gray-600">Time step (s)</span>
              <input
                type="number"
                min={0.04}
                max={0.5}
                step={0.01}
                value={settings.timeStepSeconds}
                onChange={(event) => updateSettings({ timeStepSeconds: Number(event.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold text-gray-600">Stop speed (km/h)</span>
              <input
                type="number"
                min={0.5}
                max={15}
                step={0.5}
                value={settings.stopSpeedKmh}
                onChange={(event) => updateSettings({ stopSpeedKmh: Number(event.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold text-gray-600">Collision tolerance (m)</span>
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.1}
                value={settings.collisionToleranceMetres}
                onChange={(event) =>
                  updateSettings({ collisionToleranceMetres: Number(event.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold text-gray-600">Friction multiplier</span>
              <input
                type="number"
                min={0.1}
                max={2}
                step={0.05}
                value={settings.globalFrictionMultiplier}
                onChange={(event) =>
                  updateSettings({ globalFrictionMultiplier: Number(event.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center justify-between rounded-sm border border-gray-200 p-3">
            <div>
              <p className="text-sm font-black text-gray-900">Velocity vectors</p>
              <p className="mt-1 text-xs text-gray-500">Show direction and current speed over the scene.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showVelocityVectors}
              onChange={(event) => updateSettings({ showVelocityVectors: event.target.checked })}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between rounded-sm border border-gray-200 p-3">
            <div>
              <p className="text-sm font-black text-gray-900">Impact flash and debris</p>
              <p className="mt-1 text-xs text-gray-500">Show the collision shockwave and impact particles in playback and recorded footage.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showImpactEffects}
              onChange={(event) => updateSettings({ showImpactEffects: event.target.checked })}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between rounded-sm border border-gray-200 p-3">
            <div>
              <p className="text-sm font-black text-gray-900">Replace post-impact path</p>
              <p className="mt-1 text-xs text-gray-500">Keeps pre-impact officer points and replaces later points with the physics result.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.replacePostImpactPath}
              onChange={(event) => updateSettings({ replacePostImpactPath: event.target.checked })}
              className="h-5 w-5"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-black text-gray-950">Participant physics profiles</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Defaults are estimated by participant type. Adjust them when vehicle mass, load or behaviour is known.
            </p>
          </div>

          <div className="space-y-3">
            {reconstruction.vehicles.length === 0 && (
              <p className="rounded-sm border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                Add participants before configuring physics.
              </p>
            )}

            {reconstruction.vehicles.map((participant) => {
              const profile = {
                ...getDefaultParticipantPhysics(participant),
                ...(participant.physics ?? {}),
              };

              const update = (updates: Partial<ParticipantPhysicsProfile>) =>
                onChange({
                  vehicles: reconstruction.vehicles.map((candidate) =>
                    candidate.id === participant.id
                      ? updateParticipantPhysics(candidate, updates)
                      : candidate,
                  ),
                });

              return (
                <article key={participant.id} className="rounded-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-gray-950">{participant.name}</h4>
                      <p className="text-xs text-gray-500">{participant.type} · {participant.estimatedSpeedKmh} km/h default speed</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                      Enabled
                      <input
                        type="checkbox"
                        checked={profile.enabled}
                        onChange={(event) => update({ enabled: event.target.checked })}
                        className="h-4 w-4"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label>
                      <span className="text-[11px] font-bold text-gray-500">Mass (kg)</span>
                      <input
                        type="number"
                        min={30}
                        max={50000}
                        step={10}
                        value={profile.massKg}
                        onChange={(event) => update({ massKg: Number(event.target.value) })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs"
                      />
                    </label>
                    <label>
                      <span className="text-[11px] font-bold text-gray-500">Restitution</span>
                      <input
                        type="number"
                        min={0}
                        max={0.9}
                        step={0.01}
                        value={profile.restitution}
                        onChange={(event) => update({ restitution: Number(event.target.value) })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs"
                      />
                    </label>
                    <label>
                      <span className="text-[11px] font-bold text-gray-500">Radius (m)</span>
                      <input
                        type="number"
                        min={0.2}
                        max={5}
                        step={0.05}
                        value={profile.collisionRadiusMetres}
                        onChange={(event) => update({ collisionRadiusMetres: Number(event.target.value) })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs"
                      />
                    </label>
                    <label>
                      <span className="text-[11px] font-bold text-gray-500">Rolling friction</span>
                      <input
                        type="number"
                        min={0.1}
                        max={2.5}
                        step={0.05}
                        value={profile.rollingFriction}
                        onChange={(event) => update({ rollingFriction: Number(event.target.value) })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs"
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          {summary && (
            <div className="rounded-sm border border-violet-200 bg-violet-50 p-4">
              <h3 className="font-black text-violet-950">Last simulation</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-violet-900 sm:grid-cols-4">
                <p><strong>Participant collisions:</strong><br />{summary.participantCollisions}</p>
                <p><strong>Impact energy:</strong><br />{Number(summary.estimatedImpactEnergyKj ?? 0).toFixed(1)} kJ</p>
                <p><strong>Impact time:</strong><br />{Number(summary.primaryImpactTimeSeconds ?? reconstruction.durationSeconds / 2).toFixed(2)}s</p>
                <p><strong>Settled by:</strong><br />{Number(summary.simulatedDurationSeconds ?? reconstruction.durationSeconds).toFixed(2)}s</p>
                <p><strong>Solid impacts:</strong><br />{summary.solidObjectImpacts}</p>
                <p><strong>Potholes:</strong><br />{summary.potholeInteractions}</p>
                <p><strong>Low-grip areas:</strong><br />{summary.surfaceInteractions}</p>
                <p><strong>Generated points:</strong><br />{summary.generatedPathPoints}</p>
              </div>
              {summary.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-900">
                  {summary.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
        Physics assistance is a transparent, deterministic planning aid. It does not replace vehicle inspection, forensic measurements, specialist crash reconstruction, or court-approved simulation software.
      </div>
    </section>
  );
}
