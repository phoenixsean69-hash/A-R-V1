import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Expand,
  Map,
  Orbit,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Smartphone,
} from "../icons/materialIcons";

import type {
  AccidentReconstruction,
} from "../../types/reconstruction";

import type {
  ForensicAccidentInvestigation,
} from "../../features/forensicReconstruction/forensicInvestigationTypes";

import type {
  ForensicSimulationRun,
} from "../../features/forensicReconstruction/forensicSimulationTypes";

import {
  ForensicSimulationService,
} from "../../features/forensicReconstruction/forensicSimulationService";

import {
  ForensicCanonicalReconstructionService,
  type ForensicCanonicalReconstructionManifest,
} from "../../features/forensicReconstruction/forensicCanonicalReconstructionService";

import "../../features/forensicReconstruction/ForensicReconstructionWorkspace.css";

const Reconstruction3DViewer =
  lazy(
    () =>
      import(
        "../reconstruction/Reconstruction3DViewer"
      ),
  );

const ARReconstructionViewer =
  lazy(
    () =>
      import(
        "../reconstruction/ar/ARReconstructionViewer"
      ),
  );

interface Props {
  investigation:
    ForensicAccidentInvestigation;

  onMessage?(
    message: string,
  ): void;
}

type ViewMode =
  | "2D"
  | "3D"
  | "AR";

const VIEW_TABS = [
  {
    id:
      "2D" as const,
    label:
      "2D Plan",
    Icon:
      Map,
  },
  {
    id:
      "3D" as const,
    label:
      "3D Scene",
    Icon:
      Orbit,
  },
  {
    id:
      "AR" as const,
    label:
      "AR Live",
    Icon:
      Smartphone,
  },
];

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      value,
    );

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

  const [
    runs,
    setRuns,
  ] =
    useState<
      ForensicSimulationRun[]
    >(
      [],
    );

  const [
    selectedRunId,
    setSelectedRunId,
  ] =
    useState(
      "",
    );

  const [
    manifest,
    setManifest,
  ] =
    useState<
      ForensicCanonicalReconstructionManifest | null
    >(
      null,
    );

  const [
    canonical,
    setCanonical,
  ] =
    useState<
      AccidentReconstruction | null
    >(
      null,
    );

  const [
    view,
    setView,
  ] =
    useState<ViewMode>(
      "2D",
    );

  const [
    frameIndex,
    setFrameIndex,
  ] =
    useState(
      0,
    );

  const [
    playing2D,
    setPlaying2D,
  ] =
    useState(
      false,
    );

  useEffect(
    () => {
      const loaded =
        ForensicSimulationService.getByCaseId(
          investigation.caseId,
        );

      const savedManifest =
        ForensicCanonicalReconstructionService.getManifest(
          investigation.caseId,
        );

      const savedCanonical =
        ForensicCanonicalReconstructionService.getCanonicalReconstruction(
          investigation.caseId,
        );

      setRuns(
        loaded,
      );

      setManifest(
        savedManifest,
      );

      setCanonical(
        savedCanonical,
      );

      setSelectedRunId(
        (
          current,
        ) =>
          current ||
          savedManifest?.simulationRunId ||
          loaded[0]?.id ||
          "",
      );
    },
    [
      investigation.caseId,
    ],
  );

  const selectedRun =
    useMemo(
      () =>
        runs.find(
          (
            run,
          ) =>
            run.id ===
            selectedRunId,
        ) ??
        runs[0],
      [
        runs,
        selectedRunId,
      ],
    );

  const canonicalRun =
    useMemo(
      () =>
        manifest
          ? runs.find(
              (
                run,
              ) =>
                run.id ===
                manifest.simulationRunId,
            )
          : undefined,
      [
        manifest,
        runs,
      ],
    );

  const viewRun =
    canonicalRun ??
    selectedRun;

  const viewHypothesis =
    viewRun
      ? investigation.hypotheses.find(
          (
            hypothesis,
          ) =>
            hypothesis.id ===
            viewRun.hypothesisId,
        )
      : undefined;

  const isCanonicalSelection =
    Boolean(
      selectedRun &&
      manifest &&
      canonical &&
      manifest.simulationRunId ===
        selectedRun.id,
    );

  const message =
    (
      value: string,
    ) =>
      onMessage?.(
        value,
      );

  const promote =
    () => {
      if (
        !selectedRun
      ) {
        message(
          "No saved simulation run is available.",
        );

        return;
      }

      try {
        const result =
          ForensicCanonicalReconstructionService.promoteSimulationRun(
            investigation,
            selectedRun,
          );

        setManifest(
          result.manifest,
        );

        setCanonical(
          result.reconstruction,
        );

        setFrameIndex(
          0,
        );

        message(
          `${selectedRun.code} is now the canonical 2D, 3D and AR reconstruction.`,
        );
      } catch (
        error
      ) {
        message(
          error instanceof
          Error
            ? error.message
            : "Canonical reconstruction could not be created.",
        );
      }
    };

  const openExpanded =
    () => {
      if (
        !canonical
      ) {
        message(
          "Create the canonical reconstruction first.",
        );

        return;
      }

      navigate(
        view ===
        "AR"
          ? `/cases/${investigation.caseId}/reconstruction/ar`
          : `/cases/${investigation.caseId}/reconstruction/canonical`,
      );
    };

  useEffect(
    () => {
      setFrameIndex(
        0,
      );

      setPlaying2D(
        false,
      );
    },
    [
      viewRun?.id,
    ],
  );

  useEffect(
    () => {
      if (
        view !==
        "2D"
      ) {
        setPlaying2D(
          false,
        );
      }
    },
    [
      view,
    ],
  );

  useEffect(
    () => {
      if (
        !playing2D ||
        !viewRun ||
        viewRun.frames.length <
          2
      ) {
        return;
      }

      const intervalMs =
        Math.max(
          16,
          Math.min(
            120,
            (
              viewRun.input.durationSeconds *
              1000
            ) /
              Math.max(
                1,
                viewRun.frames.length -
                  1,
              ),
          ),
        );

      const timer =
        window.setInterval(
          () => {
            setFrameIndex(
              (
                current,
              ) =>
                current >=
                viewRun.frames.length -
                  1
                  ? 0
                  : current +
                    1,
            );
          },
          intervalMs,
        );

      return () => {
        window.clearInterval(
          timer,
        );
      };
    },
    [
      playing2D,
      viewRun,
    ],
  );

  const previewBounds =
    useMemo(
      () => {
        if (
          !viewRun ||
          viewRun.frames.length ===
            0
        ) {
          return {
            minX:
              -30,
            maxX:
              30,
            minY:
              -30,
            maxY:
              30,
          };
        }

        const points =
          viewRun.frames.flatMap(
            (
              frame,
            ) =>
              frame.participants.map(
                (
                  participant,
                ) => ({
                  x:
                    participant.xMetres,
                  y:
                    participant.yMetres,
                }),
              ),
          );

        if (
          viewHypothesis?.impactRegion
        ) {
          const region =
            viewHypothesis.impactRegion;

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
            (
              point,
            ) =>
              point.x,
          );

        const ys =
          points.map(
            (
              point,
            ) =>
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
            (
              maxX -
              minX
            ) *
              0.12,
          );

        const padY =
          Math.max(
            5,
            (
              maxY -
              minY
            ) *
              0.12,
          );

        return {
          minX:
            minX -
            padX,
          maxX:
            maxX +
            padX,
          minY:
            minY -
            padY,
          maxY:
            maxY +
            padY,
        };
      },
      [
        viewRun,
        viewHypothesis,
      ],
    );

  const sx =
    (
      x: number,
    ) =>
      (
        (
          x -
          previewBounds.minX
        ) /
        Math.max(
          0.001,
          previewBounds.maxX -
          previewBounds.minX,
        )
      ) *
      1000;

  const sy =
    (
      y: number,
    ) =>
      600 -
      (
        (
          y -
          previewBounds.minY
        ) /
        Math.max(
          0.001,
          previewBounds.maxY -
          previewBounds.minY,
        )
      ) *
        600;

  const frame =
    viewRun
      ? viewRun.frames[
          Math.min(
            frameIndex,
            Math.max(
              0,
              viewRun.frames.length -
                1,
            ),
          )
        ]
      : undefined;

  const setPreviousFrame =
    () => {
      if (
        !viewRun
      ) {
        return;
      }

      setFrameIndex(
        (
          current,
        ) =>
          Math.max(
            0,
            current -
              1,
          ),
      );
    };

  const setNextFrame =
    () => {
      if (
        !viewRun
      ) {
        return;
      }

      setFrameIndex(
        (
          current,
        ) =>
          Math.min(
            viewRun.frames.length -
              1,
            current +
              1,
          ),
      );
    };

  return (
    <div className="fv2-multiview-workstation">
      <section className="fv2-panel fv2-multiview-shell">
        <header className="fv2-multiview-toolbar">
          <nav
            className="fv2-multiview-tabs"
            role="tablist"
            aria-label="Reconstruction viewport"
          >
            {VIEW_TABS.map(
              ({
                id,
                label,
                Icon,
              }) => (
                <button
                  key={
                    id
                  }
                  type="button"
                  role="tab"
                  aria-selected={
                    view ===
                    id
                  }
                  className={
                    view ===
                    id
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setView(
                      id,
                    )
                  }
                >
                  <Icon
                    size={
                      16
                    }
                    strokeWidth={
                      1.8
                    }
                  />

                  <span>
                    {
                      label
                    }
                  </span>
                </button>
              ),
            )}
          </nav>

          <div className="fv2-multiview-source-tools">
            <label
              className="fv2-multiview-run-picker"
              title="Simulation source"
            >
              <span className="fv2-multiview-sr-only">
                Simulation source
              </span>

              <select
                value={
                  selectedRun?.id ??
                  ""
                }
                disabled={
                  runs.length ===
                  0
                }
                onChange={(
                  event,
                ) =>
                  setSelectedRunId(
                    event.target.value,
                  )
                }
              >
                {runs.length ===
                0 ? (
                  <option value="">
                    No simulation
                  </option>
                ) : (
                  runs.map(
                    (
                      run,
                    ) => (
                      <option
                        key={
                          run.id
                        }
                        value={
                          run.id
                        }
                      >
                        {
                          run.code
                        }{" "}
                        /{" "}
                        {
                          run.hypothesisCode
                        }
                      </option>
                    ),
                  )
                )}
              </select>
            </label>

            <button
              type="button"
              className={`fv2-multiview-canonical ${
                isCanonicalSelection
                  ? "is-current"
                  : ""
              }`}
              disabled={
                !selectedRun
              }
              onClick={
                promote
              }
              title={
                isCanonicalSelection
                  ? "Rebuild canonical reconstruction"
                  : "Set selected simulation as canonical"
              }
            >
              {isCanonicalSelection ? (
                <RefreshCw
                  size={
                    15
                  }
                />
              ) : (
                <CheckCircle2
                  size={
                    15
                  }
                />
              )}

              <span>
                {isCanonicalSelection
                  ? "Rebuild"
                  : "Canonical"}
              </span>
            </button>

            <button
              type="button"
              className="fv2-multiview-icon-button"
              disabled={
                !canonical
              }
              onClick={
                openExpanded
              }
              title={
                view ===
                "AR"
                  ? "Open AR full screen"
                  : "Open full reconstruction editor"
              }
              aria-label={
                view ===
                "AR"
                  ? "Open AR full screen"
                  : "Open full reconstruction editor"
              }
            >
              <Expand
                size={
                  16
                }
              />
            </button>
          </div>
        </header>

        <div className="fv2-multiview-statusbar">
          <span>
            <b>
              {viewRun?.code ??
                "NO RUN"}
            </b>
            source
          </span>

          <span
            className={
              canonical
                ? "is-ready"
                : "is-preview"
            }
          >
            <b>
              {canonical
                ? "CANONICAL"
                : "PREVIEW"}
            </b>
            state
          </span>

          <span>
            <b>
              {viewRun?.input.participants.length ??
                0}
            </b>
            participants
          </span>

          <span>
            <b>
              {viewRun
                ? `${viewRun.input.durationSeconds.toFixed(
                    2,
                  )}s`
                : "0.00s"}
            </b>
            duration
          </span>

          <span>
            <b>
              {manifest?.hypothesisCode ??
                "-"}
            </b>
            hypothesis
          </span>
        </div>

        <div className="fv2-multiview-stage">
          {view ===
            "2D" && (
            <div className="fv2-multiview-2d">
              {!viewRun ? (
                <div className="fv2-multiview-empty">
                  <AlertTriangle
                    size={
                      26
                    }
                  />

                  <strong>
                    Simulation required
                  </strong>

                  <span>
                    Complete Step 10 first.
                  </span>
                </div>
              ) : (
                <>
                  <div className="fv2-multiview-plan">
                    <svg
                      viewBox="0 0 1000 600"
                      aria-label="2D reconstruction viewport"
                    >
                      <defs>
                        <pattern
                          id="roadSafeMultiViewGrid"
                          width="40"
                          height="40"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 40 0 L 0 0 0 40"
                            fill="none"
                            stroke="#343434"
                            strokeWidth="1"
                          />
                        </pattern>

                        <pattern
                          id="roadSafeMultiViewFineGrid"
                          width="10"
                          height="10"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 10 0 L 0 0 0 10"
                            fill="none"
                            stroke="#292929"
                            strokeWidth=".55"
                          />
                        </pattern>
                      </defs>

                      <rect
                        x="0"
                        y="0"
                        width="1000"
                        height="600"
                        fill="#1c1c1c"
                      />

                      <rect
                        x="0"
                        y="0"
                        width="1000"
                        height="600"
                        fill="url(#roadSafeMultiViewFineGrid)"
                      />

                      <rect
                        x="0"
                        y="0"
                        width="1000"
                        height="600"
                        fill="url(#roadSafeMultiViewGrid)"
                      />

                      <line
                        x1="500"
                        y1="0"
                        x2="500"
                        y2="600"
                        stroke="#454545"
                        strokeWidth="1"
                      />

                      <line
                        x1="0"
                        y1="300"
                        x2="1000"
                        y2="300"
                        stroke="#454545"
                        strokeWidth="1"
                      />

                      {viewHypothesis?.impactRegion && (
                        <circle
                          cx={
                            sx(
                              viewHypothesis.impactRegion.xMetres,
                            )
                          }
                          cy={
                            sy(
                              viewHypothesis.impactRegion.yMetres,
                            )
                          }
                          r={
                            Math.max(
                              10,
                              (
                                viewHypothesis.impactRegion.radiusMetres /
                                Math.max(
                                  1,
                                  previewBounds.maxX -
                                  previewBounds.minX,
                                )
                              ) *
                                1000,
                            )
                          }
                          fill="rgba(232,135,45,.08)"
                          stroke="#e8872d"
                          strokeDasharray="8 6"
                          strokeWidth="2"
                        />
                      )}

                      {viewRun.input.participants.map(
                        (
                          participant,
                          participantIndex,
                        ) => {
                          const path =
                            viewRun.frames.flatMap(
                              (
                                candidate,
                              ) => {
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
                              points={
                                path.join(
                                  " ",
                                )
                              }
                              fill="none"
                              stroke={
                                participantIndex %
                                  2 ===
                                0
                                  ? "#e8872d"
                                  : "#a8bac8"
                              }
                              strokeWidth="3"
                              opacity=".72"
                            />
                          );
                        },
                      )}

                      {viewRun.contacts.map(
                        (
                          contact,
                        ) => (
                          <g
                            key={
                              contact.id
                            }
                          >
                            <circle
                              cx={
                                sx(
                                  contact.xMetres,
                                )
                              }
                              cy={
                                sy(
                                  contact.yMetres,
                                )
                              }
                              r="10"
                              fill="none"
                              stroke="#d86d6d"
                              strokeWidth="2.5"
                            />

                            <line
                              x1={
                                sx(
                                  contact.xMetres,
                                ) -
                                14
                              }
                              y1={
                                sy(
                                  contact.yMetres,
                                )
                              }
                              x2={
                                sx(
                                  contact.xMetres,
                                ) +
                                14
                              }
                              y2={
                                sy(
                                  contact.yMetres,
                                )
                              }
                              stroke="#d86d6d"
                              strokeWidth="2"
                            />

                            <line
                              x1={
                                sx(
                                  contact.xMetres,
                                )
                              }
                              y1={
                                sy(
                                  contact.yMetres,
                                ) -
                                14
                              }
                              x2={
                                sx(
                                  contact.xMetres,
                                )
                              }
                              y2={
                                sy(
                                  contact.yMetres,
                                ) +
                                14
                              }
                              stroke="#d86d6d"
                              strokeWidth="2"
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
                            viewRun.input.participants.find(
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
                                cx={
                                  sx(
                                    participant.xMetres,
                                  )
                                }
                                cy={
                                  sy(
                                    participant.yMetres,
                                  )
                                }
                                r="15"
                                fill={
                                  index %
                                    2 ===
                                  0
                                    ? "#e8872d"
                                    : "#718ca7"
                                }
                                stroke="#f2f2f2"
                                strokeWidth="2"
                              />

                              <circle
                                cx={
                                  sx(
                                    participant.xMetres,
                                  )
                                }
                                cy={
                                  sy(
                                    participant.yMetres,
                                  )
                                }
                                r="5"
                                fill="#202020"
                              />

                              <text
                                x={
                                  sx(
                                    participant.xMetres,
                                  ) +
                                  20
                                }
                                y={
                                  sy(
                                    participant.yMetres,
                                  ) -
                                  17
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

                    {!canonical && (
                      <div className="fv2-multiview-preview-flag">
                        PREVIEW
                      </div>
                    )}
                  </div>

                  <div className="fv2-multiview-playback">
                    <button
                      type="button"
                      onClick={() =>
                        setFrameIndex(
                          0,
                        )
                      }
                      title="First frame"
                      aria-label="First frame"
                    >
                      <SkipBack
                        size={
                          15
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={
                        setPreviousFrame
                      }
                      title="Previous frame"
                      aria-label="Previous frame"
                    >
                      <ChevronLeft
                        size={
                          16
                        }
                      />
                    </button>

                    <button
                      type="button"
                      className="is-primary"
                      onClick={() =>
                        setPlaying2D(
                          (
                            current,
                          ) =>
                            !current,
                        )
                      }
                      title={
                        playing2D
                          ? "Pause"
                          : "Play"
                      }
                      aria-label={
                        playing2D
                          ? "Pause reconstruction"
                          : "Play reconstruction"
                      }
                    >
                      {playing2D ? (
                        <Pause
                          size={
                            17
                          }
                        />
                      ) : (
                        <Play
                          size={
                            17
                          }
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={
                        setNextFrame
                      }
                      title="Next frame"
                      aria-label="Next frame"
                    >
                      <ChevronRight
                        size={
                          16
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPlaying2D(
                          false,
                        );

                        setFrameIndex(
                          0,
                        );
                      }}
                      title="Reset playback"
                      aria-label="Reset playback"
                    >
                      <RefreshCw
                        size={
                          15
                        }
                      />
                    </button>

                    <input
                      type="range"
                      min="0"
                      max={
                        Math.max(
                          0,
                          viewRun.frames.length -
                            1,
                        )
                      }
                      value={
                        Math.min(
                          frameIndex,
                          Math.max(
                            0,
                            viewRun.frames.length -
                              1,
                          ),
                        )
                      }
                      onChange={(
                        event,
                      ) => {
                        setPlaying2D(
                          false,
                        );

                        setFrameIndex(
                          Number(
                            event.target.value,
                          ),
                        );
                      }}
                      aria-label="Reconstruction timeline"
                    />

                    <output>
                      {frame?.timeSeconds.toFixed(
                        2,
                      ) ??
                        "0.00"}
                      s
                    </output>

                    <button
                      type="button"
                      onClick={() =>
                        setFrameIndex(
                          Math.max(
                            0,
                            viewRun.frames.length -
                              1,
                          ),
                        )
                      }
                      title="Last frame"
                      aria-label="Last frame"
                    >
                      <SkipForward
                        size={
                          15
                        }
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {view ===
            "3D" && (
            <div className="fv2-multiview-3d">
              {!canonical ? (
                <CanonicalGate
                  icon={
                    <Orbit
                      size={
                        30
                      }
                    />
                  }
                  title="3D needs a canonical scene"
                  disabled={
                    !selectedRun
                  }
                  onCreate={
                    promote
                  }
                />
              ) : (
                <Suspense
                  fallback={
                    <ViewportLoading
                      label="Loading 3D scene"
                    />
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
                        "Physics is frozen in Step 11. Return to Simulation to change it.",
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

          {view ===
            "AR" && (
            <div className="fv2-multiview-ar">
              {!canonical ? (
                <CanonicalGate
                  icon={
                    <Smartphone
                      size={
                        30
                      }
                    />
                  }
                  title="AR needs a canonical scene"
                  disabled={
                    !selectedRun
                  }
                  onCreate={
                    promote
                  }
                />
              ) : (
                <Suspense
                  fallback={
                    <ViewportLoading
                      label="Loading AR engine"
                    />
                  }
                >
                  <div className="fv2-multiview-ar-embed">
                    <ARReconstructionViewer
                      caseId={
                        investigation.caseId
                      }
                      caseNumber={
                        investigation.caseNumber
                      }
                      caseTitle={
                        investigation.caseTitle
                      }
                      recordedBy={
                        investigation.investigatingOfficer
                      }
                      reconstruction={
                        canonical
                      }
                      onExit={() =>
                        setView(
                          "2D",
                        )
                      }
                    />
                  </div>
                </Suspense>
              )}
            </div>
          )}
        </div>

        <footer className="fv2-multiview-footer">
          <div>
            <span
              className={
                canonical
                  ? "is-ready"
                  : ""
              }
            >
              <ShieldCheck
                size={
                  14
                }
              />

              {canonical
                ? "Canonical locked"
                : "Preview only"}
            </span>

            {manifest && (
              <span>
                {manifest.simulationRunCode}
                {" / "}
                {manifest.hypothesisCode}
              </span>
            )}
          </div>

          <span>
            {canonical
              ? `${canonical.vehicles.length} participant(s) / ${canonical.durationSeconds.toFixed(
                  2,
                )} s`
              : "Promote a simulation run to enable 3D + AR"}
          </span>
        </footer>
      </section>

      <details className="fv2-panel fv2-multiview-provenance">
        <summary>
          <span>
            <ShieldCheck
              size={
                15
              }
            />

            Provenance
          </span>

          <ChevronRight
            size={
              15
            }
          />
        </summary>

        <div className="fv2-multiview-provenance-grid">
          <article>
            <span>
              Evidence
            </span>

            <strong>
              {
                investigation.evidence.length
              }
            </strong>

            <small>
              locked source
            </small>
          </article>

          <article>
            <span>
              Measurements
            </span>

            <strong>
              {
                investigation.measurements.length
              }
            </strong>

            <small>
              locked source
            </small>
          </article>

          <article>
            <span>
              Analysis
            </span>

            <strong>
              {
                investigation.analysisFindings.length
              }
            </strong>

            <small>
              locked source
            </small>
          </article>

          <article>
            <span>
              Simulation
            </span>

            <strong>
              {manifest?.simulationRunCode ??
                "-"}
            </strong>

            <small>
              canonical source
            </small>
          </article>

          <article>
            <span>
              Updated
            </span>

            <strong>
              {manifest
                ? formatDate(
                    manifest.updatedAt,
                  )
                : "-"}
            </strong>

            <small>
              manifest
            </small>
          </article>
        </div>
      </details>
    </div>
  );
}

function ViewportLoading({
  label,
}: {
  label: string;
}) {
  return (
    <div className="fv2-multiview-empty">
      <RefreshCw
        className="fv2-multiview-spin"
        size={
          26
        }
      />

      <strong>
        {label}
      </strong>
    </div>
  );
}

function CanonicalGate({
  icon,
  title,
  disabled,
  onCreate,
}: {
  icon:
    ReactNode;

  title: string;

  disabled: boolean;

  onCreate():
    void;
}) {
  return (
    <div className="fv2-multiview-empty">
      {icon}

      <strong>
        {title}
      </strong>

      <button
        type="button"
        className="primary"
        disabled={
          disabled
        }
        onClick={
          onCreate
        }
      >
        <CheckCircle2
          size={
            14
          }
        />

        Canonical
      </button>
    </div>
  );
}
