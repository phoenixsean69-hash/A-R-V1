import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AccidentReconstruction } from "../../types/reconstruction";
import type { ForensicAccidentInvestigation } from "./forensicInvestigationTypes";
import type { ForensicSimulationRun } from "./forensicSimulationTypes";
import { ForensicSimulationService } from "./forensicSimulationService";
import {
  ForensicCanonicalReconstructionService,
  type ForensicCanonicalReconstructionManifest,
} from "./forensicCanonicalReconstructionService";
import "./ForensicReconstructionWorkspace.css";

const Reconstruction3DViewer =
  lazy(
    () =>
      import(
        "../../components/reconstruction/Reconstruction3DViewer"
      ),
  );

interface Props {
  investigation: ForensicAccidentInvestigation;
  onMessage?(message: string): void;
}

type ViewMode =
  | "2D"
  | "3D"
  | "AR";

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

export default function ForensicReconstructionWorkspace({
  investigation,
  onMessage,
}: Props) {
  const navigate =
    useNavigate();

  const [runs, setRuns] =
    useState<
      ForensicSimulationRun[]
    >([]);

  const [selectedRunId, setSelectedRunId] =
    useState("");

  const [manifest, setManifest] =
    useState<
      ForensicCanonicalReconstructionManifest | null
    >(null);

  const [canonical, setCanonical] =
    useState<
      AccidentReconstruction | null
    >(null);

  const [view, setView] =
    useState<ViewMode>("2D");

  const [frameIndex, setFrameIndex] =
    useState(0);

  useEffect(() => {
    const loaded =
      ForensicSimulationService
        .getByCaseId(
          investigation.caseId,
        );

    setRuns(loaded);

    setSelectedRunId(
      (current) =>
        current ||
        loaded[0]?.id ||
        "",
    );

    const savedManifest =
      ForensicCanonicalReconstructionService
        .getManifest(
          investigation.caseId,
        );

    setManifest(
      savedManifest,
    );

    setCanonical(
      ForensicCanonicalReconstructionService
        .getCanonicalReconstruction(
          investigation.caseId,
        ),
    );
  }, [
    investigation.caseId,
  ]);

  const selectedRun =
    runs.find(
      (run) =>
        run.id ===
        selectedRunId,
    ) ??
    runs[0];

  const selectedHypothesis =
    selectedRun
      ? investigation
          .hypotheses.find(
            (hypothesis) =>
              hypothesis.id ===
              selectedRun.hypothesisId,
          )
      : undefined;

  const isCanonicalSelection =
    Boolean(
      selectedRun &&
        manifest &&
        manifest
          .simulationRunId ===
          selectedRun.id &&
        canonical,
    );

  useEffect(() => {
    setFrameIndex(0);
  }, [
    selectedRunId,
  ]);

  const previewBounds =
    useMemo(() => {
      if (
        !selectedRun ||
        selectedRun
          .frames.length ===
          0
      ) {
        return {
          minX: -30,
          maxX: 30,
          minY: -30,
          maxY: 30,
        };
      }

      const points =
        selectedRun.frames.flatMap(
          (frame) =>
            frame.participants.map(
              (participant) => ({
                x:
                  participant
                    .xMetres,
                y:
                  participant
                    .yMetres,
              }),
            ),
        );

      if (
        selectedHypothesis
          ?.impactRegion
      ) {
        const region =
          selectedHypothesis
            .impactRegion;

        points.push(
          {
            x:
              region.xMetres -
              region.radiusMetres,
            y:
              region.yMetres -
              region.radiusMetres,
          },
          {
            x:
              region.xMetres +
              region.radiusMetres,
            y:
              region.yMetres +
              region.radiusMetres,
          },
        );
      }

      const xs =
        points.map(
          (point) =>
            point.x,
        );

      const ys =
        points.map(
          (point) =>
            point.y,
        );

      const minX =
        Math.min(
          -10,
          ...xs,
        );

      const maxX =
        Math.max(
          10,
          ...xs,
        );

      const minY =
        Math.min(
          -10,
          ...ys,
        );

      const maxY =
        Math.max(
          10,
          ...ys,
        );

      const padX =
        Math.max(
          5,
          (maxX - minX) *
            0.1,
        );

      const padY =
        Math.max(
          5,
          (maxY - minY) *
            0.1,
        );

      return {
        minX:
          minX - padX,
        maxX:
          maxX + padX,
        minY:
          minY - padY,
        maxY:
          maxY + padY,
      };
    }, [
      selectedRun,
      selectedHypothesis,
    ]);

  const sx = (
    x: number,
  ) =>
    ((x -
      previewBounds.minX) /
      Math.max(
        0.001,
        previewBounds.maxX -
          previewBounds.minX,
      )) *
    1000;

  const sy = (
    y: number,
  ) =>
    600 -
    ((y -
      previewBounds.minY) /
      Math.max(
        0.001,
        previewBounds.maxY -
          previewBounds.minY,
      )) *
      600;

  const frame =
    selectedRun
      ? selectedRun.frames[
          Math.min(
            frameIndex,
            Math.max(
              0,
              selectedRun
                .frames.length -
                1,
            ),
          )
        ]
      : undefined;

  const message = (
    value: string,
  ) =>
    onMessage?.(value);

  const promote = () => {
    if (!selectedRun) {
      message(
        "No saved simulation run is available to promote.",
      );
      return;
    }

    try {
      const result =
        ForensicCanonicalReconstructionService
          .promoteSimulationRun(
            investigation,
            selectedRun,
          );

      setManifest(
        result.manifest,
      );

      setCanonical(
        result.reconstruction,
      );

      message(
        `${selectedRun.code} is now the canonical reconstruction source for 2D, 3D and AR.`,
      );
    } catch (error) {
      message(
        error instanceof
          Error
          ? error.message
          : "Canonical reconstruction could not be created.",
      );
    }
  };

  const openCanonicalEditor =
    () => {
      if (!canonical) {
        message(
          "Create the canonical reconstruction first.",
        );
        return;
      }

      navigate(
        `/cases/${investigation.caseId}/reconstruction/canonical`,
      );
    };

  const openAR = () => {
    if (!canonical) {
      message(
        "Create the canonical reconstruction before opening AR.",
      );
      return;
    }

    navigate(
      `/cases/${investigation.caseId}/reconstruction/ar`,
    );
  };

  return (
    <div className="fv2-stack fv2-recon-workstation">
      <section className="fv2-panel fv2-recon-hero">
        <header>
          <div>
            <span>
              Canonical reconstruction
            </span>
            <strong>
              One scenario · three views · one provenance chain
            </strong>
          </div>

          <div className="fv2-recon-summary">
            <span>
              {runs.length} simulation run(s)
            </span>
            <span>
              {canonical
                ? "Canonical ready"
                : "Canonical not built"}
            </span>
            <span>
              2D · 3D · AR
            </span>
          </div>
        </header>

        <div className="fv2-recon-rule">
          2D, 3D and AR are presentation views of the same
          canonical reconstruction. They do not create three
          independent versions of the crash. The canonical
          record is derived from a named hypothesis and a saved
          simulation run, while the original forensic evidence
          remains unchanged.
        </div>

        <div className="fv2-recon-flow">
          <div>
            Evidence + Analysis
          </div>
          <span>→</span>
          <div>
            Hypothesis
          </div>
          <span>→</span>
          <div>
            Simulation
          </div>
          <span>→</span>
          <div className="active">
            Canonical reconstruction
          </div>
          <span>→</span>
          <div>
            2D / 3D / AR
          </div>
        </div>
      </section>

      {runs.length === 0 ? (
        <section className="fv2-panel fv2-recon-gate">
          <strong>
            No saved simulation run is available.
          </strong>
          <p>
            Complete at least one Simulation run first. RoadSafe
            will not create a reconstruction directly from an
            untested hypothesis.
          </p>
        </section>
      ) : (
        <div className="fv2-recon-layout">
          <div className="fv2-recon-main">
            <section className="fv2-panel">
              <header>
                <div>
                  <span>
                    Canonical source
                  </span>
                  <strong>
                    Select the simulation that will drive every view
                  </strong>
                </div>
              </header>

              <div className="fv2-recon-source">
                <label className="fv2-field full">
                  <span>
                    Saved simulation run
                  </span>
                  <select
                    value={
                      selectedRun?.id ??
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      setSelectedRunId(
                        event.target
                          .value,
                      )
                    }
                  >
                    {runs.map(
                      (run) => (
                        <option
                          key={run.id}
                          value={run.id}
                        >
                          {run.code} ·{" "}
                          {run.hypothesisCode} ·{" "}
                          {run.status}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {selectedRun && (
                  <div className="fv2-recon-lineage">
                    <article>
                      <span>
                        Hypothesis
                      </span>
                      <strong>
                        {selectedRun.hypothesisCode}
                      </strong>
                      <small>
                        {selectedRun.hypothesisTitle}
                      </small>
                    </article>

                    <div>→</div>

                    <article>
                      <span>
                        Simulation
                      </span>
                      <strong>
                        {selectedRun.code}
                      </strong>
                      <small>
                        {selectedRun.status}
                      </small>
                    </article>

                    <div>→</div>

                    <article
                      className={
                        isCanonicalSelection
                          ? "ready"
                          : ""
                      }
                    >
                      <span>
                        Canonical
                      </span>
                      <strong>
                        {isCanonicalSelection
                          ? "Current"
                          : "Not promoted"}
                      </strong>
                      <small>
                        Provenance: Simulated
                      </small>
                    </article>
                  </div>
                )}

                {selectedRun && (
                  <div className="fv2-recon-source-grid">
                    <div>
                      <span>
                        Participants
                      </span>
                      <strong>
                        {
                          selectedRun
                            .input
                            .participants
                            .length
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Contacts
                      </span>
                      <strong>
                        {
                          selectedRun
                            .contacts
                            .length
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Duration
                      </span>
                      <strong>
                        {selectedRun.input.durationSeconds.toFixed(
                          2,
                        )}{" "}
                        s
                      </strong>
                    </div>

                    <div>
                      <span>
                        Confidence
                      </span>
                      <strong>
                        {
                          selectedRun.confidence
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Run provenance
                      </span>
                      <strong>
                        {
                          selectedRun.provenance
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Created
                      </span>
                      <strong>
                        {formatDate(
                          selectedRun.createdAt,
                        )}
                      </strong>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="primary fv2-recon-promote"
                  onClick={promote}
                >
                  {isCanonicalSelection
                    ? "Rebuild canonical from this run"
                    : "Make this the canonical reconstruction"}
                </button>

                <small className="fv2-recon-help">
                  Rebuilding changes only the derived reconstruction
                  output. It does not change Scene Intake, Evidence,
                  Measurements, Vehicles, Persons, Witnesses,
                  Analysis or Hypotheses.
                </small>
              </div>
            </section>

            <section className="fv2-panel fv2-recon-view-panel">
              <header>
                <div>
                  <span>
                    Reconstruction viewer
                  </span>
                  <strong>
                    Shared canonical scenario
                  </strong>
                </div>

                <div className="fv2-recon-tabs">
                  {(
                    [
                      "2D",
                      "3D",
                      "AR",
                    ] as ViewMode[]
                  ).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={
                          view ===
                          mode
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setView(
                            mode,
                          )
                        }
                      >
                        {mode}
                      </button>
                    ),
                  )}
                </div>
              </header>

              {view === "2D" && (
                <div className="fv2-recon-2d">
                  {!selectedRun ? (
                    <div className="fv2-recon-view-empty">
                      Select a simulation run.
                    </div>
                  ) : (
                    <>
                      <div className="fv2-recon-plan">
                        <svg
                          viewBox="0 0 1000 600"
                          aria-label="Canonical reconstruction 2D preview"
                        >
                          <defs>
                            <pattern
                              id="forensicReconGrid"
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
                            fill="url(#forensicReconGrid)"
                          />

                          {selectedHypothesis?.impactRegion && (
                            <circle
                              cx={sx(
                                selectedHypothesis
                                  .impactRegion
                                  .xMetres,
                              )}
                              cy={sy(
                                selectedHypothesis
                                  .impactRegion
                                  .yMetres,
                              )}
                              r={Math.max(
                                10,
                                (selectedHypothesis
                                  .impactRegion
                                  .radiusMetres /
                                  Math.max(
                                    1,
                                    previewBounds.maxX -
                                      previewBounds.minX,
                                  )) *
                                  1000,
                              )}
                              fill="rgba(232,135,45,.09)"
                              stroke="#e8872d"
                              strokeDasharray="8 6"
                              strokeWidth="2"
                            />
                          )}

                          {selectedRun.input.participants.map(
                            (
                              participant,
                              participantIndex,
                            ) => {
                              const path =
                                selectedRun.frames.flatMap(
                                  (candidate) => {
                                    const item =
                                      candidate.participants.find(
                                        (
                                          frameParticipant,
                                        ) =>
                                          frameParticipant.participantId ===
                                          participant.id,
                                      );

                                    return item
                                      ? [
                                          `${sx(
                                            item.xMetres,
                                          )},${sy(
                                            item.yMetres,
                                          )}`,
                                        ]
                                      : [];
                                  },
                                );

                              return (
                                <polyline
                                  key={
                                    participant.id
                                  }
                                  points={path.join(
                                    " ",
                                  )}
                                  fill="none"
                                  stroke={
                                    participantIndex %
                                      2 ===
                                    0
                                      ? "#8ccdc3"
                                      : "#a9c4dd"
                                  }
                                  strokeWidth="3"
                                  opacity=".65"
                                />
                              );
                            },
                          )}

                          {selectedRun.contacts.map(
                            (contact) => (
                              <g
                                key={
                                  contact.id
                                }
                              >
                                <line
                                  x1={
                                    sx(
                                      contact.xMetres,
                                    ) - 10
                                  }
                                  y1={
                                    sy(
                                      contact.yMetres,
                                    ) - 10
                                  }
                                  x2={
                                    sx(
                                      contact.xMetres,
                                    ) + 10
                                  }
                                  y2={
                                    sy(
                                      contact.yMetres,
                                    ) + 10
                                  }
                                  stroke="#df8d8d"
                                  strokeWidth="3"
                                />
                                <line
                                  x1={
                                    sx(
                                      contact.xMetres,
                                    ) + 10
                                  }
                                  y1={
                                    sy(
                                      contact.yMetres,
                                    ) - 10
                                  }
                                  x2={
                                    sx(
                                      contact.xMetres,
                                    ) - 10
                                  }
                                  y2={
                                    sy(
                                      contact.yMetres,
                                    ) + 10
                                  }
                                  stroke="#df8d8d"
                                  strokeWidth="3"
                                />
                              </g>
                            ),
                          )}

                          {frame?.participants.map(
                            (
                              participant,
                              index,
                            ) => {
                              const source =
                                selectedRun.input.participants.find(
                                  (
                                    item,
                                  ) =>
                                    item.id ===
                                    participant.participantId,
                                );

                              return (
                                <g
                                  key={
                                    participant.participantId
                                  }
                                >
                                  <circle
                                    cx={sx(
                                      participant.xMetres,
                                    )}
                                    cy={sy(
                                      participant.yMetres,
                                    )}
                                    r="13"
                                    fill={
                                      index %
                                        2 ===
                                      0
                                        ? "#6f9f96"
                                        : "#718ca7"
                                    }
                                    stroke="#ededed"
                                    strokeWidth="2"
                                  />
                                  <text
                                    x={
                                      sx(
                                        participant.xMetres,
                                      ) + 18
                                    }
                                    y={
                                      sy(
                                        participant.yMetres,
                                      ) - 15
                                    }
                                    fill="#ededed"
                                    fontSize="13"
                                    fontWeight="700"
                                  >
                                    {source?.label ??
                                      `P${index + 1}`}
                                  </text>
                                </g>
                              );
                            },
                          )}
                        </svg>
                      </div>

                      <div className="fv2-recon-scrubber">
                        <input
                          type="range"
                          min="0"
                          max={Math.max(
                            0,
                            selectedRun.frames.length -
                              1,
                          )}
                          value={Math.min(
                            frameIndex,
                            Math.max(
                              0,
                              selectedRun.frames.length -
                                1,
                            ),
                          )}
                          onChange={(
                            event,
                          ) =>
                            setFrameIndex(
                              Number(
                                event.target
                                  .value,
                              ),
                            )
                          }
                        />

                        <div>
                          <span>
                            {frame?.timeSeconds.toFixed(
                              2,
                            ) ??
                              "0.00"}{" "}
                            s
                          </span>
                          <span>
                            {selectedRun.input.durationSeconds.toFixed(
                              2,
                            )}{" "}
                            s
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {view === "3D" && (
                <div className="fv2-recon-3d">
                  {!canonical ? (
                    <div className="fv2-recon-view-empty">
                      <strong>
                        Canonical 3D is not ready.
                      </strong>
                      <span>
                        Promote a saved simulation run first.
                      </span>
                    </div>
                  ) : (
                    <Suspense
                      fallback={
                        <div className="fv2-recon-view-empty">
                          Loading canonical 3D scene...
                        </div>
                      }
                    >
                      <Reconstruction3DViewer
                        reconstruction={
                          canonical
                        }
                        onSwitchTo2D={() =>
                          setView(
                            "2D",
                          )
                        }
                        onRunPhysics={() => {
                          message(
                            "Canonical reconstruction physics is frozen here. Return to Simulation to change the tested physics.",
                          );
                        }}
                        onPreparePlayback={() =>
                          canonical
                        }
                        compact
                        workspaceMode
                      />
                    </Suspense>
                  )}
                </div>
              )}

              {view === "AR" && (
                <div className="fv2-recon-ar">
                  <div className="fv2-recon-ar-reticle">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="fv2-recon-ar-copy">
                    <span>
                      Mobile AR overlay
                    </span>
                    <strong>
                      Same canonical reconstruction
                    </strong>
                    <p>
                      AR does not rebuild the scene. It opens the case-linked
                      canonical reconstruction and aligns that derived output
                      with the physical location.
                    </p>

                    <button
                      type="button"
                      className="primary"
                      disabled={
                        !canonical
                      }
                      onClick={openAR}
                    >
                      Open AR reconstruction
                    </button>

                    {!canonical && (
                      <small>
                        Promote a simulation run first.
                      </small>
                    )}
                  </div>
                </div>
              )}

              <div className="fv2-recon-view-footer">
                <button
                  type="button"
                  className="primary"
                  disabled={
                    !canonical
                  }
                  onClick={
                    openCanonicalEditor
                  }
                >
                  Open full 2D / 3D workspace
                </button>

                <span>
                  {canonical
                    ? `${canonical.vehicles.length} participant(s) · ${canonical.durationSeconds.toFixed(
                        2,
                      )} s · ${
                        manifest?.simulationRunCode ??
                        "canonical"
                      }`
                    : "Canonical reconstruction not yet created"}
                </span>
              </div>
            </section>
          </div>

          <aside className="fv2-recon-side">
            <section className="fv2-panel">
              <header>
                <div>
                  <span>
                    Source integrity
                  </span>
                  <strong>
                    What the reconstruction can and cannot change
                  </strong>
                </div>
              </header>

              <div className="fv2-recon-integrity">
                {[
                  [
                    "Scene Intake",
                    "Protected source",
                  ],
                  [
                    "Physical Evidence",
                    `${investigation.evidence.length} protected record(s)`,
                  ],
                  [
                    "Measurements",
                    `${investigation.measurements.length} protected record(s)`,
                  ],
                  [
                    "Vehicles",
                    `${investigation.vehicles.length} examined record(s)`,
                  ],
                  [
                    "Persons",
                    `${investigation.persons.length} record(s)`,
                  ],
                  [
                    "Witnesses",
                    `${investigation.witnesses.length} reported account(s)`,
                  ],
                  [
                    "Analysis",
                    `${investigation.analysisFindings.length} finding(s)`,
                  ],
                ].map(
                  ([
                    label,
                    detail,
                  ]) => (
                    <article
                      key={
                        label
                      }
                    >
                      <div>
                        <strong>
                          {
                            label
                          }
                        </strong>
                        <span>
                          {
                            detail
                          }
                        </span>
                      </div>
                      <b>
                        LOCKED
                      </b>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section className="fv2-panel">
              <header>
                <div>
                  <span>
                    Canonical manifest
                  </span>
                  <strong>
                    Derived-output audit
                  </strong>
                </div>
              </header>

              {!manifest ? (
                <div className="fv2-empty">
                  No canonical manifest has been created yet.
                </div>
              ) : (
                <dl className="fv2-recon-manifest">
                  <div>
                    <dt>
                      Hypothesis
                    </dt>
                    <dd>
                      {
                        manifest.hypothesisCode
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Simulation
                    </dt>
                    <dd>
                      {
                        manifest.simulationRunCode
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Reconstruction
                    </dt>
                    <dd title={manifest.reconstructionId}>
                      {
                        manifest.reconstructionId
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Provenance
                    </dt>
                    <dd>
                      {
                        manifest.provenance
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Updated
                    </dt>
                    <dd>
                      {formatDate(
                        manifest.updatedAt,
                      )}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="fv2-panel fv2-notice">
              <b>
                Forensic rule
              </b>
              <p>
                A reconstruction is a tested visual explanation of the
                evidence. It must remain traceable to the hypothesis and
                simulation that produced it. Visual plausibility alone does
                not establish legal fault.
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
