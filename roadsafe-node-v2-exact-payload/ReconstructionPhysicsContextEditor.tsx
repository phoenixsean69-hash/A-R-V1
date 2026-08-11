import type {
  AccidentReconstruction,
  ParticipantPhysicsProfile,
  ReconstructionPhysicsSettings,
  SceneObjectPhysicsProfile,
} from "../../types/reconstruction";

import {
  DEFAULT_PHYSICS_SETTINGS,
  getDefaultParticipantPhysics,
  getDefaultSceneObjectPhysics,
} from "../../services/reconstructionPhysicsService";

import {
  getSceneObjectEffectiveMassKg,
} from "../../utils/reconstructionPhysicsDefaults";

import "./reconstructionPhysicsContextEditor.css";

interface Props {
  reconstruction: AccidentReconstruction;
  onChange(updates: Partial<AccidentReconstruction>): void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange(value: number): void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: NumberFieldProps) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function participantProfile(
  participant: AccidentReconstruction["vehicles"][number],
): ParticipantPhysicsProfile {
  return {
    ...getDefaultParticipantPhysics(participant),
    ...(participant.physics ?? {}),
  };
}

function objectProfile(
  object: AccidentReconstruction["sceneObjects"][number],
): SceneObjectPhysicsProfile {
  return {
    ...getDefaultSceneObjectPhysics(object),
    massKg: getSceneObjectEffectiveMassKg(object),
    ...(object.physics ?? {}),
  };
}

export default function ReconstructionPhysicsContextEditor({
  reconstruction,
  onChange,
}: Props) {
  const settings: ReconstructionPhysicsSettings = {
    ...DEFAULT_PHYSICS_SETTINGS,
    ...(reconstruction.physicsSettings ?? {}),
  };

  const invalidate = (
    updates: Partial<AccidentReconstruction>,
  ) =>
    onChange({
      ...updates,
      lastPhysicsSimulation: undefined,
    });

  const updateSettings = (
    updates: Partial<ReconstructionPhysicsSettings>,
  ) =>
    invalidate({
      physicsSettings: {
        ...settings,
        ...updates,
      },
    });

  const updateParticipantPhysics = (
    participantId: string,
    updates: Partial<ParticipantPhysicsProfile>,
  ) =>
    invalidate({
      vehicles: reconstruction.vehicles.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              physics: {
                ...participantProfile(participant),
                ...updates,
              },
            }
          : participant,
      ),
    });

  const updateParticipantSpeed = (
    participantId: string,
    speedKmh: number,
  ) => {
    const speed = Math.max(0, Math.min(250, speedKmh));

    invalidate({
      vehicles: reconstruction.vehicles.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              estimatedSpeedKmh: speed,
              physics: {
                ...participantProfile(participant),
                inputSpeedKmh: speed,
              },
            }
          : participant,
      ),
    });
  };

  const updateObjectPhysics = (
    objectId: string,
    updates: Partial<SceneObjectPhysicsProfile>,
  ) =>
    invalidate({
      sceneObjects: reconstruction.sceneObjects.map((object) =>
        object.id === objectId
          ? {
              ...object,
              physics: {
                ...objectProfile(object),
                ...updates,
              },
            }
          : object,
      ),
    });

  return (
    <details className="rs-physics-context" open>
      <summary>
        <span>Canonical physics inputs</span>
        <strong
          className={
            reconstruction.lastPhysicsSimulation
              ? "is-baked"
              : "is-dirty"
          }
        >
          {reconstruction.lastPhysicsSimulation ? "BAKED" : "DIRTY"}
        </strong>
      </summary>

      <div className="rs-physics-context__body">
        <section className="rs-physics-context__section">
          <header>
            <strong>Global solver</strong>
            <small>Every change invalidates the old bake.</small>
          </header>

          <div className="rs-physics-context__grid">
            <label className="is-check">
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  updateSettings({ enabled: event.target.checked })
                }
              />
            </label>

            <NumberField
              label="Time step (s)"
              value={settings.timeStepSeconds}
              min={0.004}
              max={0.1}
              step={0.005}
              onChange={(value) => updateSettings({ timeStepSeconds: value })}
            />
            <NumberField
              label="Contact tolerance (m)"
              value={settings.collisionToleranceMetres}
              min={0}
              max={0.35}
              step={0.01}
              onChange={(value) =>
                updateSettings({ collisionToleranceMetres: value })
              }
            />
            <NumberField
              label="Global friction"
              value={settings.globalFrictionMultiplier}
              min={0.05}
              max={3}
              step={0.05}
              onChange={(value) =>
                updateSettings({ globalFrictionMultiplier: value })
              }
            />
            <NumberField
              label="Air drag"
              value={settings.airDrag}
              min={0}
              max={0.5}
              step={0.005}
              onChange={(value) => updateSettings({ airDrag: value })}
            />
            <NumberField
              label="Stop speed (km/h)"
              value={settings.stopSpeedKmh}
              min={0.05}
              max={8}
              step={0.1}
              onChange={(value) => updateSettings({ stopSpeedKmh: value })}
            />
          </div>
        </section>

        <section className="rs-physics-context__section">
          <header>
            <strong>Participants</strong>
            <small>Solver speed, mass, geometry and response.</small>
          </header>

          {reconstruction.vehicles.length === 0 ? (
            <p className="rs-physics-context__empty">No participants.</p>
          ) : (
            <div className="rs-physics-context__stack">
              {reconstruction.vehicles.map((participant) => {
                const profile = participantProfile(participant);
                const speed =
                  profile.inputSpeedKmh ?? participant.estimatedSpeedKmh;

                return (
                  <details
                    key={participant.id}
                    className="rs-physics-context__entity"
                  >
                    <summary>
                      <span>{participant.name}</span>
                      <small>
                        {participant.type} · {speed.toFixed(1)} km/h ·{" "}
                        {profile.massKg.toFixed(0)} kg
                      </small>
                    </summary>

                    <div className="rs-physics-context__grid">
                      <label className="is-check">
                        <span>Physics enabled</span>
                        <input
                          type="checkbox"
                          checked={profile.enabled}
                          onChange={(event) =>
                            updateParticipantPhysics(participant.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      </label>

                      <NumberField
                        label="Simulation speed (km/h)"
                        value={speed}
                        min={0}
                        max={250}
                        step={1}
                        onChange={(value) =>
                          updateParticipantSpeed(participant.id, value)
                        }
                      />
                      <NumberField
                        label="Mass (kg)"
                        value={profile.massKg}
                        min={1}
                        max={100000}
                        step={5}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            massKg: value,
                          })
                        }
                      />
                      <NumberField
                        label="Restitution"
                        value={profile.restitution}
                        min={0}
                        max={1}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            restitution: value,
                          })
                        }
                      />
                      <NumberField
                        label="Collision friction"
                        value={profile.collisionFriction ?? 0.65}
                        min={0}
                        max={2}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            collisionFriction: value,
                          })
                        }
                      />
                      <NumberField
                        label="Rolling friction"
                        value={profile.rollingFriction}
                        min={0.05}
                        max={3}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            rollingFriction: value,
                          })
                        }
                      />
                      <NumberField
                        label="Lateral grip"
                        value={profile.lateralGrip}
                        min={0}
                        max={2}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            lateralGrip: value,
                          })
                        }
                      />
                      <NumberField
                        label="Braking (m/s²)"
                        value={profile.brakingDecelerationMps2}
                        min={0.1}
                        max={18}
                        step={0.1}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            brakingDecelerationMps2: value,
                          })
                        }
                      />
                      <NumberField
                        label="Collision radius (m)"
                        value={profile.collisionRadiusMetres}
                        min={0.05}
                        max={15}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            collisionRadiusMetres: value,
                          })
                        }
                      />
                      <NumberField
                        label="Length (m)"
                        value={profile.lengthMetres ?? 4.5}
                        min={0.2}
                        max={30}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            lengthMetres: value,
                          })
                        }
                      />
                      <NumberField
                        label="Width (m)"
                        value={profile.widthMetres ?? 1.8}
                        min={0.15}
                        max={5}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            widthMetres: value,
                          })
                        }
                      />
                      <NumberField
                        label="Inertia scale"
                        value={profile.momentOfInertiaScale ?? 1}
                        min={0.05}
                        max={5}
                        step={0.05}
                        onChange={(value) =>
                          updateParticipantPhysics(participant.id, {
                            momentOfInertiaScale: value,
                          })
                        }
                      />

                      <label>
                        <span>Collision shape</span>
                        <select
                          value={profile.collisionShape ?? "Oriented Box"}
                          onChange={(event) =>
                            updateParticipantPhysics(participant.id, {
                              collisionShape:
                                event.target.value as
                                  ParticipantPhysicsProfile["collisionShape"],
                            })
                          }
                        >
                          <option value="Oriented Box">Oriented Box</option>
                          <option value="Circle">Circle</option>
                        </select>
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <section className="rs-physics-context__section">
          <header>
            <strong>Scene objects</strong>
            <small>Mass now affects collidable-object impulse response.</small>
          </header>

          {reconstruction.sceneObjects.length === 0 ? (
            <p className="rs-physics-context__empty">No scene objects.</p>
          ) : (
            <div className="rs-physics-context__stack">
              {reconstruction.sceneObjects.map((object) => {
                const profile = objectProfile(object);
                const mass =
                  profile.massKg ?? getSceneObjectEffectiveMassKg(object);

                return (
                  <details
                    key={object.id}
                    className="rs-physics-context__entity"
                  >
                    <summary>
                      <span>{object.label}</span>
                      <small>
                        {object.type} · {mass.toFixed(0)} kg
                      </small>
                    </summary>

                    <div className="rs-physics-context__grid">
                      <label className="is-check">
                        <span>Enabled</span>
                        <input
                          type="checkbox"
                          checked={profile.enabled}
                          onChange={(event) =>
                            updateObjectPhysics(object.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      </label>
                      <label className="is-check">
                        <span>Collidable</span>
                        <input
                          type="checkbox"
                          checked={profile.collidable}
                          onChange={(event) =>
                            updateObjectPhysics(object.id, {
                              collidable: event.target.checked,
                            })
                          }
                        />
                      </label>

                      <NumberField
                        label="Mass (kg)"
                        value={mass}
                        min={0.1}
                        max={100000000}
                        step={1}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, { massKg: value })
                        }
                      />
                      <NumberField
                        label="Restitution"
                        value={profile.restitution}
                        min={0}
                        max={1}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            restitution: value,
                          })
                        }
                      />
                      <NumberField
                        label="Collision friction"
                        value={profile.collisionFriction ?? 0.65}
                        min={0}
                        max={2}
                        step={0.05}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            collisionFriction: value,
                          })
                        }
                      />
                      <NumberField
                        label="Surface friction"
                        value={profile.surfaceFrictionMultiplier}
                        min={0.05}
                        max={3}
                        step={0.05}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            surfaceFrictionMultiplier: value,
                          })
                        }
                      />
                      <NumberField
                        label="Speed retained"
                        value={profile.speedLossFactor}
                        min={0}
                        max={1}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            speedLossFactor: value,
                          })
                        }
                      />
                      <NumberField
                        label="Deflection (°)"
                        value={profile.deflectionDegrees}
                        min={-45}
                        max={45}
                        step={0.5}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            deflectionDegrees: value,
                          })
                        }
                      />
                      <NumberField
                        label="Collision radius (m)"
                        value={profile.collisionRadiusMetres}
                        min={0.05}
                        max={50}
                        step={0.05}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            collisionRadiusMetres: value,
                          })
                        }
                      />
                      <NumberField
                        label="Length (m)"
                        value={profile.lengthMetres ?? 1}
                        min={0.05}
                        max={200}
                        step={0.05}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            lengthMetres: value,
                          })
                        }
                      />
                      <NumberField
                        label="Width (m)"
                        value={profile.widthMetres ?? 1}
                        min={0.05}
                        max={100}
                        step={0.05}
                        onChange={(value) =>
                          updateObjectPhysics(object.id, {
                            widthMetres: value,
                          })
                        }
                      />

                      <label>
                        <span>Collision shape</span>
                        <select
                          value={profile.collisionShape ?? "Circle"}
                          onChange={(event) =>
                            updateObjectPhysics(object.id, {
                              collisionShape:
                                event.target.value as
                                  SceneObjectPhysicsProfile["collisionShape"],
                            })
                          }
                        >
                          <option value="Circle">Circle</option>
                          <option value="Oriented Box">Oriented Box</option>
                        </select>
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </details>
  );
}
