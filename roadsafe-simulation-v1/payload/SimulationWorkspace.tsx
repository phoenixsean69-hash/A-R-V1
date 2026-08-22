import { useEffect, useMemo, useState } from "react";
import type {
  ForensicAccidentInvestigation,
  ForensicCrashHypothesis,
} from "./forensicInvestigationTypes";
import type {
  ForensicSimulationParticipantInput,
  ForensicSimulationRun,
} from "./forensicSimulationTypes";
import { ForensicSimulationService } from "./forensicSimulationService";
import "./SimulationWorkspace.css";

interface Props {
  investigation: ForensicAccidentInvestigation;
  onMessage?(message: string): void;
}

interface DraftParticipant {
  id: string;
  sourceVehicleId?: string;
  label: string;
  massKg: string;
  startXMetres: string;
  startYMetres: string;
  speedKmh: string;
  headingDegrees: string;
  collisionRadiusMetres: string;
  brakingEnabled: boolean;
  reactionTimeSeconds: string;
  frictionCoefficient: string;
}

function num(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDraftParticipant(
  index: number,
  label = `Participant ${index + 1}`,
): DraftParticipant {
  return {
    id: `draft-participant-${Date.now()}-${index}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    label,
    massKg: index === 0 ? "1500" : "1400",
    startXMetres: index === 0 ? "-25" : "0",
    startYMetres: index === 0 ? "0" : "-25",
    speedKmh: "50",
    headingDegrees: index === 0 ? "0" : "90",
    collisionRadiusMetres: "1.4",
    brakingEnabled: false,
    reactionTimeSeconds: "1.0",
    frictionCoefficient: "0.70",
  };
}

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export default function SimulationWorkspace({
  investigation,
  onMessage,
}: Props) {
  const simulationHypotheses = useMemo(
    () =>
      investigation.hypotheses.filter(
        (hypothesis) =>
          hypothesis.selectedForSimulation &&
          hypothesis.status !== "Rejected",
      ),
    [investigation.hypotheses],
  );

  const [hypothesisId, setHypothesisId] = useState(
    simulationHypotheses[0]?.id ?? "",
  );
  const [durationSeconds, setDurationSeconds] = useState("8");
  const [timestepSeconds, setTimestepSeconds] = useState("0.05");
  const [restitutionCoefficient, setRestitutionCoefficient] = useState("0.25");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState<DraftParticipant[]>([
    createDraftParticipant(0),
    createDraftParticipant(1),
  ]);
  const [runs, setRuns] = useState<ForensicSimulationRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [playbackFrameIndex, setPlaybackFrameIndex] = useState(0);

  useEffect(() => {
    const loaded = ForensicSimulationService.getByCaseId(investigation.caseId);
    setRuns(loaded);
    setSelectedRunId((current) => current || loaded[0]?.id || "");
  }, [investigation.caseId]);

  useEffect(() => {
    if (
      hypothesisId &&
      !simulationHypotheses.some((item) => item.id === hypothesisId)
    ) {
      setHypothesisId(simulationHypotheses[0]?.id ?? "");
    }
  }, [hypothesisId, simulationHypotheses]);

  const selectedHypothesis = simulationHypotheses.find(
    (item) => item.id === hypothesisId,
  );

  const selectedRun =
    runs.find((run) => run.id === selectedRunId) ?? runs[0];

  const selectedFrame =
    selectedRun?.frames[
      Math.min(playbackFrameIndex, Math.max(0, selectedRun.frames.length - 1))
    ];

  useEffect(() => {
    setPlaybackFrameIndex(0);
  }, [selectedRunId]);

  const setMessage = (message: string) => onMessage?.(message);

  const updateParticipant = (
    id: string,
    patch: Partial<DraftParticipant>,
  ) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id
          ? { ...participant, ...patch }
          : participant,
      ),
    );
  };

  const addVehicleParticipant = (vehicleId: string) => {
    const vehicle = investigation.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return;

    setParticipants((current) => [
      ...current,
      {
        ...createDraftParticipant(current.length, vehicle.label),
        sourceVehicleId: vehicle.id,
        label: vehicle.label || vehicle.code,
      },
    ]);
  };

  const buildParticipantInput = (
    participant: DraftParticipant,
  ): ForensicSimulationParticipantInput => ({
    id: participant.id,
    sourceVehicleId: participant.sourceVehicleId,
    label: participant.label.trim(),
    massKg: num(participant.massKg, NaN),
    startXMetres: num(participant.startXMetres, NaN),
    startYMetres: num(participant.startYMetres, NaN),
    speedKmh: num(participant.speedKmh, NaN),
    headingDegrees: num(participant.headingDegrees, NaN),
    collisionRadiusMetres: num(participant.collisionRadiusMetres, NaN),
    brakingEnabled: participant.brakingEnabled,
    reactionTimeSeconds: num(participant.reactionTimeSeconds, NaN),
    frictionCoefficient: num(participant.frictionCoefficient, NaN),
  });

  const runSimulation = () => {
    if (!selectedHypothesis) {
      setMessage(
        "Select a hypothesis that was marked 'Send to simulation' in the Hypotheses module.",
      );
      return;
    }

    try {
      const run = ForensicSimulationService.run(
        {
          caseId: investigation.caseId,
          caseNumber: investigation.caseNumber,
          hypothesisId: selectedHypothesis.id,
          hypothesisCode: selectedHypothesis.code,
          hypothesisTitle: selectedHypothesis.title,
          durationSeconds: num(durationSeconds, NaN),
          timestepSeconds: num(timestepSeconds, NaN),
          restitutionCoefficient: num(restitutionCoefficient, NaN),
          gravityMetresPerSecondSquared: 9.80665,
          participants: participants.map(buildParticipantInput),
          notes: notes.trim(),
        },
        selectedHypothesis.impactRegion,
      );

      const loaded = ForensicSimulationService.getByCaseId(
        investigation.caseId,
      );
      setRuns(loaded);
      setSelectedRunId(run.id);
      setPlaybackFrameIndex(0);
      setMessage(`${run.code} completed and saved as Simulated provenance.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Simulation could not be completed.",
      );
    }
  };

  const deleteRun = (runId: string) => {
    ForensicSimulationService.delete(runId);
    const loaded = ForensicSimulationService.getByCaseId(
      investigation.caseId,
    );
    setRuns(loaded);
    setSelectedRunId(loaded[0]?.id ?? "");
    setMessage("Simulation run removed. Evidence and analysis were not changed.");
  };

  const copyImpactToParticipants = (hypothesis: ForensicCrashHypothesis) => {
    if (!hypothesis.impactRegion) {
      setMessage("This hypothesis has no proposed impact region.");
      return;
    }

    const { xMetres, yMetres } = hypothesis.impactRegion;
    setParticipants((current) =>
      current.map((participant, index) => {
        const offset = 25;
        if (index % 2 === 0) {
          return {
            ...participant,
            startXMetres: String(xMetres - offset),
            startYMetres: String(yMetres),
            headingDegrees: "0",
          };
        }

        return {
          ...participant,
          startXMetres: String(xMetres),
          startYMetres: String(yMetres - offset),
          headingDegrees: "90",
        };
      }),
    );

    setMessage(
      "Participant start positions were staged around the proposed impact region. These remain simulation inputs, not observations.",
    );
  };

  const frameBounds = useMemo(() => {
    if (!selectedRun) {
      return { minX: -30, maxX: 30, minY: -30, maxY: 30 };
    }

    const points = selectedRun.frames.flatMap((frame) =>
      frame.participants.map((participant) => ({
        x: participant.xMetres,
        y: participant.yMetres,
      })),
    );

    const region = investigation.hypotheses.find(
      (item) => item.id === selectedRun.hypothesisId,
    )?.impactRegion;

    if (region) {
      points.push(
        {
          x: region.xMetres - region.radiusMetres,
          y: region.yMetres - region.radiusMetres,
        },
        {
          x: region.xMetres + region.radiusMetres,
          y: region.yMetres + region.radiusMetres,
        },
      );
    }

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(-10, ...xs);
    const maxX = Math.max(10, ...xs);
    const minY = Math.min(-10, ...ys);
    const maxY = Math.max(10, ...ys);
    const padX = Math.max(5, (maxX - minX) * 0.08);
    const padY = Math.max(5, (maxY - minY) * 0.08);

    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [selectedRun, investigation.hypotheses]);

  const sx = (x: number) =>
    ((x - frameBounds.minX) /
      Math.max(0.001, frameBounds.maxX - frameBounds.minX)) *
    1000;

  const sy = (y: number) =>
    600 -
    ((y - frameBounds.minY) /
      Math.max(0.001, frameBounds.maxY - frameBounds.minY)) *
      600;

  const selectedRunHypothesis = selectedRun
    ? investigation.hypotheses.find(
        (item) => item.id === selectedRun.hypothesisId,
      )
    : undefined;

  return (
    <div className="fv2-stack fv2-sim-workstation">
      <section className="fv2-panel fv2-sim-hero">
        <header>
          <div>
            <span>Forensic scenario testing</span>
            <strong>Test a hypothesis without changing the evidence</strong>
          </div>
          <div className="fv2-sim-summary">
            <span>{simulationHypotheses.length} queued hypothesis(es)</span>
            <span>{runs.length} saved run(s)</span>
          </div>
        </header>

        <div className="fv2-sim-rule">
          Simulation output is always stored as <b>Simulated</b>. It may support,
          weaken or expose problems in a hypothesis, but it cannot rewrite an
          observation, measurement, witness statement or analysis finding.
        </div>

        <div className="fv2-sim-flow">
          <div>Hypothesis</div>
          <span>→</span>
          <div className="active">Physics test bench</div>
          <span>→</span>
          <div>Compare with evidence</div>
          <span>→</span>
          <div>2D / 3D / AR</div>
        </div>
      </section>

      {simulationHypotheses.length === 0 ? (
        <section className="fv2-panel fv2-sim-gate">
          <strong>No hypothesis is queued for simulation.</strong>
          <p>
            Go back to Hypotheses and use <b>Send to simulation</b> on a
            non-rejected hypothesis. Simulation is deliberately gated so an
            unrecorded scenario cannot bypass the forensic workflow.
          </p>
        </section>
      ) : (
        <div className="fv2-sim-layout">
          <div className="fv2-sim-main">
            <section className="fv2-panel">
              <header>
                <div>
                  <span>Run configuration</span>
                  <strong>Hypothesis and global physics inputs</strong>
                </div>
              </header>

              <div className="fv2-sim-config">
                <label className="fv2-field full">
                  <span>Hypothesis to test</span>
                  <select
                    value={hypothesisId}
                    onChange={(event) => setHypothesisId(event.target.value)}
                  >
                    {simulationHypotheses.map((hypothesis) => (
                      <option key={hypothesis.id} value={hypothesis.id}>
                        {hypothesis.code} · {hypothesis.title}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedHypothesis && (
                  <div className="fv2-sim-hypothesis-card">
                    <div>
                      <span>{selectedHypothesis.code}</span>
                      <strong>{selectedHypothesis.title}</strong>
                      <p>{selectedHypothesis.summary}</p>
                    </div>
                    <div className="fv2-sim-hypothesis-meta">
                      <span>{selectedHypothesis.status}</span>
                      <span>{selectedHypothesis.confidence}</span>
                      <span>Investigator Assumption</span>
                    </div>
                    {selectedHypothesis.impactRegion && (
                      <button
                        type="button"
                        onClick={() =>
                          copyImpactToParticipants(selectedHypothesis)
                        }
                      >
                        Stage participants around proposed impact region
                      </button>
                    )}
                  </div>
                )}

                <div className="fv2-sim-three">
                  <label className="fv2-field">
                    <span>Duration (s)</span>
                    <input
                      inputMode="decimal"
                      value={durationSeconds}
                      onChange={(event) =>
                        setDurationSeconds(event.target.value)
                      }
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Time step (s)</span>
                    <input
                      inputMode="decimal"
                      value={timestepSeconds}
                      onChange={(event) =>
                        setTimestepSeconds(event.target.value)
                      }
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Restitution e (0–1)</span>
                    <input
                      inputMode="decimal"
                      value={restitutionCoefficient}
                      onChange={(event) =>
                        setRestitutionCoefficient(event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="fv2-sim-gravity">
                  <span>Gravity</span>
                  <strong>9.80665 m/s²</strong>
                  <small>Standard gravity used for braking screening.</small>
                </div>

                <label className="fv2-field full">
                  <span>Run notes</span>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Record why these parameters were selected."
                  />
                </label>
              </div>
            </section>

            <section className="fv2-panel">
              <header>
                <div>
                  <span>Scenario participants</span>
                  <strong>Mass, motion, braking and collision envelopes</strong>
                </div>
                <button
                  type="button"
                  className="fv2-sim-add"
                  onClick={() =>
                    setParticipants((current) => [
                      ...current,
                      createDraftParticipant(current.length),
                    ])
                  }
                >
                  Add participant
                </button>
              </header>

              {investigation.vehicles.length > 0 && (
                <div className="fv2-sim-vehicle-shortcuts">
                  <span>Add examined vehicle:</span>
                  {investigation.vehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => addVehicleParticipant(vehicle.id)}
                    >
                      {vehicle.code} · {vehicle.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="fv2-sim-participant-grid">
                {participants.map((participant, index) => (
                  <article
                    key={participant.id}
                    className="fv2-sim-participant"
                  >
                    <div className="fv2-sim-participant-head">
                      <div>
                        <span>P{index + 1}</span>
                        <strong>
                          {participant.label || `Participant ${index + 1}`}
                        </strong>
                      </div>
                      {participants.length > 2 && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setParticipants((current) =>
                              current.filter(
                                (item) => item.id !== participant.id,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <label className="fv2-field full">
                      <span>Label</span>
                      <input
                        value={participant.label}
                        onChange={(event) =>
                          updateParticipant(participant.id, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>

                    <div className="fv2-sim-two">
                      <label className="fv2-field">
                        <span>Mass (kg)</span>
                        <input
                          inputMode="decimal"
                          value={participant.massKg}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              massKg: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="fv2-field">
                        <span>Speed (km/h)</span>
                        <input
                          inputMode="decimal"
                          value={participant.speedKmh}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              speedKmh: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="fv2-field">
                        <span>Start X (m)</span>
                        <input
                          inputMode="decimal"
                          value={participant.startXMetres}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              startXMetres: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="fv2-field">
                        <span>Start Y (m)</span>
                        <input
                          inputMode="decimal"
                          value={participant.startYMetres}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              startYMetres: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="fv2-field">
                        <span>Heading (°)</span>
                        <input
                          inputMode="decimal"
                          value={participant.headingDegrees}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              headingDegrees: event.target.value,
                            })
                          }
                        />
                        <small className="fv2-help">
                          0° east · 90° north · 180° west · 270° south
                        </small>
                      </label>

                      <label className="fv2-field">
                        <span>Collision radius (m)</span>
                        <input
                          inputMode="decimal"
                          value={participant.collisionRadiusMetres}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              collisionRadiusMetres: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <label className="fv2-sim-check">
                      <input
                        type="checkbox"
                        checked={participant.brakingEnabled}
                        onChange={(event) =>
                          updateParticipant(participant.id, {
                            brakingEnabled: event.target.checked,
                          })
                        }
                      />
                      <span>Apply braking after reaction time</span>
                    </label>

                    <div className="fv2-sim-two">
                      <label className="fv2-field">
                        <span>Reaction time (s)</span>
                        <input
                          inputMode="decimal"
                          disabled={!participant.brakingEnabled}
                          value={participant.reactionTimeSeconds}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              reactionTimeSeconds: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="fv2-field">
                        <span>Friction μ</span>
                        <input
                          inputMode="decimal"
                          disabled={!participant.brakingEnabled}
                          value={participant.frictionCoefficient}
                          onChange={(event) =>
                            updateParticipant(participant.id, {
                              frictionCoefficient: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    {participant.sourceVehicleId && (
                      <div className="fv2-sim-source">
                        Linked to examined vehicle{" "}
                        {investigation.vehicles.find(
                          (vehicle) =>
                            vehicle.id === participant.sourceVehicleId,
                        )?.code ?? participant.sourceVehicleId}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <footer>
                <button
                  type="button"
                  className="primary"
                  onClick={runSimulation}
                >
                  Run forensic simulation
                </button>
              </footer>
            </section>

            {selectedRun && (
              <>
                <section className="fv2-panel">
                  <header>
                    <div>
                      <span>Simulation playback</span>
                      <strong>
                        {selectedRun.code} · {selectedRun.hypothesisCode}
                      </strong>
                    </div>
                    <div className="fv2-sim-playback-time">
                      {selectedFrame
                        ? `${selectedFrame.timeSeconds.toFixed(2)} s`
                        : "0.00 s"}
                    </div>
                  </header>

                  <div className="fv2-sim-canvas">
                    <svg
                      viewBox="0 0 1000 600"
                      role="img"
                      aria-label="Forensic simulation plan view"
                    >
                      <defs>
                        <pattern
                          id="simGrid"
                          width="40"
                          height="40"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 40 0 L 0 0 0 40"
                            fill="none"
                            stroke="#353535"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect
                        x="0"
                        y="0"
                        width="1000"
                        height="600"
                        fill="url(#simGrid)"
                      />

                      {selectedRunHypothesis?.impactRegion && (
                        <circle
                          cx={sx(
                            selectedRunHypothesis.impactRegion.xMetres,
                          )}
                          cy={sy(
                            selectedRunHypothesis.impactRegion.yMetres,
                          )}
                          r={Math.max(
                            8,
                            (selectedRunHypothesis.impactRegion
                              .radiusMetres /
                              Math.max(
                                1,
                                frameBounds.maxX - frameBounds.minX,
                              )) *
                              1000,
                          )}
                          fill="rgba(232,135,45,.10)"
                          stroke="#e8872d"
                          strokeDasharray="8 6"
                          strokeWidth="2"
                        />
                      )}

                      {selectedRun.contacts.map((contact) => (
                        <g key={contact.id}>
                          <line
                            x1={sx(contact.xMetres) - 9}
                            y1={sy(contact.yMetres) - 9}
                            x2={sx(contact.xMetres) + 9}
                            y2={sy(contact.yMetres) + 9}
                            stroke="#d98585"
                            strokeWidth="3"
                          />
                          <line
                            x1={sx(contact.xMetres) + 9}
                            y1={sy(contact.yMetres) - 9}
                            x2={sx(contact.xMetres) - 9}
                            y2={sy(contact.yMetres) + 9}
                            stroke="#d98585"
                            strokeWidth="3"
                          />
                        </g>
                      ))}

                      {selectedFrame?.participants.map(
                        (frameParticipant, index) => {
                          const source = selectedRun.input.participants.find(
                            (item) =>
                              item.id === frameParticipant.participantId,
                          );
                          const radius =
                            ((source?.collisionRadiusMetres ?? 1.4) /
                              Math.max(
                                1,
                                frameBounds.maxX - frameBounds.minX,
                              )) *
                            1000;

                          return (
                            <g key={frameParticipant.participantId}>
                              <circle
                                cx={sx(frameParticipant.xMetres)}
                                cy={sy(frameParticipant.yMetres)}
                                r={Math.max(8, radius)}
                                fill={
                                  index % 2 === 0
                                    ? "rgba(111,159,150,.50)"
                                    : "rgba(137,167,194,.50)"
                                }
                                stroke={
                                  index % 2 === 0
                                    ? "#8ccdc3"
                                    : "#a9c4dd"
                                }
                                strokeWidth="2"
                              />
                              <text
                                x={sx(frameParticipant.xMetres) + 12}
                                y={sy(frameParticipant.yMetres) - 12}
                                fill="#ededed"
                                fontSize="13"
                                fontWeight="700"
                              >
                                {source?.label ??
                                  frameParticipant.participantId}
                              </text>
                            </g>
                          );
                        },
                      )}
                    </svg>
                  </div>

                  <div className="fv2-sim-scrubber">
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, selectedRun.frames.length - 1)}
                      value={Math.min(
                        playbackFrameIndex,
                        Math.max(0, selectedRun.frames.length - 1),
                      )}
                      onChange={(event) =>
                        setPlaybackFrameIndex(Number(event.target.value))
                      }
                    />
                    <div>
                      <span>0 s</span>
                      <span>
                        {selectedRun.input.durationSeconds.toFixed(2)} s
                      </span>
                    </div>
                  </div>
                </section>

                <section className="fv2-panel">
                  <header>
                    <div>
                      <span>Physics output</span>
                      <strong>Calculated and simulated results</strong>
                    </div>
                    <div className="fv2-sim-output-badges">
                      <span>{selectedRun.status}</span>
                      <span>{selectedRun.confidence} confidence</span>
                      <span>Simulated</span>
                    </div>
                  </header>

                  <div className="fv2-sim-metrics">
                    {selectedRun.participantMetrics.map((metric) => (
                      <article key={metric.participantId}>
                        <strong>{metric.label}</strong>
                        <dl>
                          <div>
                            <dt>Initial speed</dt>
                            <dd>
                              {formatNumber(
                                metric.initialSpeedMetresPerSecond,
                              )}{" "}
                              m/s
                            </dd>
                          </div>
                          <div>
                            <dt>Momentum</dt>
                            <dd>
                              {formatNumber(
                                metric.initialMomentumKgMetresPerSecond,
                                0,
                              )}{" "}
                              kg·m/s
                            </dd>
                          </div>
                          <div>
                            <dt>Kinetic energy</dt>
                            <dd>
                              {formatNumber(
                                metric.initialKineticEnergyJoules,
                                0,
                              )}{" "}
                              J
                            </dd>
                          </div>
                          <div>
                            <dt>Reaction distance</dt>
                            <dd>
                              {formatNumber(metric.reactionDistanceMetres)} m
                            </dd>
                          </div>
                          <div>
                            <dt>Theoretical braking</dt>
                            <dd>
                              {metric.theoreticalBrakingDistanceMetres ===
                              undefined
                                ? "Not applied"
                                : `${formatNumber(
                                    metric.theoreticalBrakingDistanceMetres,
                                  )} m`}
                            </dd>
                          </div>
                          <div>
                            <dt>Final speed</dt>
                            <dd>
                              {formatNumber(
                                metric.finalSpeedMetresPerSecond,
                              )}{" "}
                              m/s
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>

                  <div className="fv2-sim-contact-register">
                    <div className="fv2-sim-section-title">
                      <span>Contact events</span>
                      <strong>{selectedRun.contacts.length}</strong>
                    </div>

                    {selectedRun.contacts.length === 0 ? (
                      <div className="fv2-empty">
                        No contact occurred in this run.
                      </div>
                    ) : (
                      selectedRun.contacts.map((contact) => (
                        <article key={contact.id}>
                          <div>
                            <strong>
                              {contact.participantALabel} ↔{" "}
                              {contact.participantBLabel}
                            </strong>
                            <span>
                              t = {contact.timeSeconds.toFixed(3)} s
                            </span>
                          </div>
                          <div>
                            <span>
                              X {contact.xMetres.toFixed(2)} m · Y{" "}
                              {contact.yMetres.toFixed(2)} m
                            </span>
                            <span>
                              Relative speed{" "}
                              {contact.relativeSpeedMetresPerSecond.toFixed(
                                2,
                              )}{" "}
                              m/s
                            </span>
                            <span
                              className={
                                contact.insideProposedImpactRegion
                                  ? "match"
                                  : "mismatch"
                              }
                            >
                              {contact.insideProposedImpactRegion
                                ? "Inside proposed impact region"
                                : "Outside proposed impact region"}
                            </span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="fv2-panel">
                  <header>
                    <div>
                      <span>Audit trail</span>
                      <strong>Formulas, warnings and limitations</strong>
                    </div>
                  </header>

                  <div className="fv2-sim-audit">
                    <div>
                      <h3>Formulas used</h3>
                      <ul>
                        {selectedRun.formulas.map((formula) => (
                          <li key={formula}>{formula}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3>Warnings / limitations</h3>
                      <ul>
                        {selectedRun.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>

          <aside className="fv2-sim-runs">
            <section className="fv2-panel">
              <header>
                <div>
                  <span>Simulation run register</span>
                  <strong>{runs.length} saved run(s)</strong>
                </div>
              </header>

              {runs.length === 0 ? (
                <div className="fv2-empty">
                  No simulation runs have been saved yet.
                </div>
              ) : (
                <div className="fv2-sim-run-list">
                  {runs.map((run) => (
                    <article
                      key={run.id}
                      className={
                        selectedRun?.id === run.id ? "selected" : ""
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <span>{run.code}</span>
                        <strong>{run.hypothesisCode}</strong>
                        <small>{run.status}</small>
                        <small>
                          {new Date(run.createdAt).toLocaleString()}
                        </small>
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteRun(run.id)}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="fv2-panel fv2-notice">
              <b>Forensic rule</b>
              <p>
                The test bench is deliberately transparent. Every run preserves
                its inputs, units, formulas, warnings and hypothesis reference.
                A visually plausible result is not automatically a supported
                reconstruction.
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
