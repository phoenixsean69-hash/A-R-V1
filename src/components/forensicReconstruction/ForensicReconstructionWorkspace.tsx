import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  DockviewReact,
  themeAbyss,
} from "dockview-react";

import type {
  DockviewReadyEvent,
  IDockviewPanelProps,
} from "dockview-react";

import "dockview-react/dist/styles/dockview.css";

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

type DockApi =
  DockviewReadyEvent["api"];

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface WorkspaceModel {
  investigation:
    ForensicAccidentInvestigation;

  runs:
    ForensicSimulationRun[];

  selectedRun?:
    ForensicSimulationRun;

  selectedRunId:
    string;

  setSelectedRunId:
    Dispatch<
      SetStateAction<string>
    >;

  viewRun?:
    ForensicSimulationRun;

  canonical:
    AccidentReconstruction | null;

  manifest:
    ForensicCanonicalReconstructionManifest | null;

  isCanonicalSelection:
    boolean;

  frameIndex:
    number;

  setFrameIndex:
    Dispatch<
      SetStateAction<number>
    >;

  playing:
    boolean;

  setPlaying:
    Dispatch<
      SetStateAction<boolean>
    >;

  playbackSpeed:
    number;

  setPlaybackSpeed:
    Dispatch<
      SetStateAction<number>
    >;

  bounds:
    Bounds;

  promote():
    void;

  activate(
    id:
      | "viewport-2d"
      | "viewport-3d"
      | "viewport-ar",
  ): void;

  openExpanded():
    void;

  message(
    value: string,
  ): void;
}

const WorkspaceContext =
  createContext<
    WorkspaceModel | null
  >(
    null,
  );

function useWorkspace():
  WorkspaceModel {
  const model =
    useContext(
      WorkspaceContext,
    );

  if (!model) {
    throw new Error(
      "RoadSafe Step 11 Dockview context is unavailable.",
    );
  }

  return model;
}

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? value
    : date.toLocaleString();
}

function createDefaultLayout(
  api: DockApi,
): void {
  const plan =
    api.addPanel({
      id:
        "viewport-2d",
      component:
        "viewport2d",
      title:
        "2D Plan",
      minimumWidth:
        420,
      minimumHeight:
        300,
    });

  api.addPanel({
    id:
      "viewport-3d",
    component:
      "viewport3d",
    title:
      "3D Scene",
    renderer:
      "always",
    inactive:
      true,
    minimumWidth:
      420,
    minimumHeight:
      300,
    position: {
      referencePanel:
        plan.id,
      direction:
        "within",
    },
  });

  api.addPanel({
    id:
      "viewport-ar",
    component:
      "viewportar",
    title:
      "AR Live",
    inactive:
      true,
    minimumWidth:
      420,
    minimumHeight:
      300,
    position: {
      referencePanel:
        plan.id,
      direction:
        "within",
    },
  });

  api.addPanel({
    id:
      "scene",
    component:
      "scene",
    title:
      "Scene",
    initialWidth:
      220,
    minimumWidth:
      170,
    maximumWidth:
      360,
    position: {
      referencePanel:
        plan.id,
      direction:
        "left",
    },
  });

  api.addPanel({
    id:
      "properties",
    component:
      "properties",
    title:
      "Properties",
    initialWidth:
      250,
    minimumWidth:
      185,
    maximumWidth:
      390,
    position: {
      referencePanel:
        plan.id,
      direction:
        "right",
    },
  });

  api.addPanel({
    id:
      "timeline",
    component:
      "timeline",
    title:
      "Timeline",
    initialHeight:
      145,
    minimumHeight:
      88,
    maximumHeight:
      260,
    position: {
      referencePanel:
        plan.id,
      direction:
        "below",
    },
  });
}

export default function ForensicReconstructionWorkspace({
  investigation,
  onMessage,
}: Props) {
  const navigate =
    useNavigate();

  const dockApiRef =
    useRef<DockApi | null>(
      null,
    );

  const layoutListenerRef =
    useRef<{
      dispose():
        void;
    } | null>(
      null,
    );

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
    frameIndex,
    setFrameIndex,
  ] =
    useState(
      0,
    );

  const [
    playing,
    setPlaying,
  ] =
    useState(
      false,
    );

  const [
    playbackSpeed,
    setPlaybackSpeed,
  ] =
    useState(
      1,
    );

  const [
    dockReady,
    setDockReady,
  ] =
    useState(
      false,
    );

  const layoutKey =
    `roadsafe.step11.dock.v1:${investigation.caseId}`;

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
        savedManifest?.simulationRunId ??
        loaded[0]?.id ??
        "",
      );
    },
    [
      investigation.caseId,
    ],
  );

  useEffect(
    () => () =>
      layoutListenerRef.current?.dispose(),
    [],
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
      if (!selectedRun) {
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

        setPlaying(
          false,
        );

        message(
          `${selectedRun.code} is now canonical for 2D, 3D and AR.`,
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

  const activate =
    (
      id:
        | "viewport-2d"
        | "viewport-3d"
        | "viewport-ar",
    ) => {
      dockApiRef.current
        ?.getPanel(
          id,
        )
        ?.api.setActive();
    };

  const openExpanded =
    () => {
      if (!canonical) {
        message(
          "Create the canonical reconstruction first.",
        );

        return;
      }

      const active =
        dockApiRef.current
          ?.activePanel
          ?.id;

      navigate(
        active ===
        "viewport-ar"
          ? `/cases/${investigation.caseId}/reconstruction/ar`
          : `/cases/${investigation.caseId}/reconstruction/canonical`,
      );
    };

  useEffect(
    () => {
      setFrameIndex(
        0,
      );

      setPlaying(
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
        !playing ||
        !viewRun ||
        viewRun.frames.length <
          2
      ) {
        return;
      }

      const base =
        (
          viewRun.input.durationSeconds *
          1000
        ) /
        Math.max(
          1,
          viewRun.frames.length -
            1,
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
          Math.max(
            16,
            Math.min(
              180,
              base /
                playbackSpeed,
            ),
          ),
        );

      return () =>
        window.clearInterval(
          timer,
        );
    },
    [
      playing,
      playbackSpeed,
      viewRun,
    ],
  );

  const bounds =
    useMemo(
      (): Bounds => {
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
        viewHypothesis,
        viewRun,
      ],
    );

  const resetLayout =
    () => {
      const api =
        dockApiRef.current;

      if (!api) {
        return;
      }

      localStorage.removeItem(
        layoutKey,
      );

      api.clear();

      createDefaultLayout(
        api,
      );

      api.getPanel(
        "viewport-2d",
      )?.api.setActive();

      message(
        "Step 11 dock layout reset.",
      );
    };

  const onReady =
    (
      event:
        DockviewReadyEvent,
    ) => {
      dockApiRef.current =
        event.api;

      layoutListenerRef.current?.dispose();

      let restored =
        false;

      const saved =
        localStorage.getItem(
          layoutKey,
        );

      if (saved) {
        try {
          event.api.fromJSON(
            JSON.parse(
              saved,
            ),
          );

          restored =
            true;
        } catch (
          error
        ) {
          console.warn(
            "RoadSafe could not restore the saved Step 11 dock layout.",
            error,
          );

          localStorage.removeItem(
            layoutKey,
          );
        }
      }

      if (!restored) {
        createDefaultLayout(
          event.api,
        );
      }

      layoutListenerRef.current =
        event.api.onDidLayoutChange(
          () => {
            try {
              localStorage.setItem(
                layoutKey,
                JSON.stringify(
                  event.api.toJSON(),
                ),
              );
            } catch (
              error
            ) {
              console.warn(
                "RoadSafe could not persist the Step 11 dock layout.",
                error,
              );
            }
          },
        );

      setDockReady(
        true,
      );
    };

  const model =
    useMemo<
      WorkspaceModel
    >(
      () => ({
        investigation,
        runs,
        selectedRun,
        selectedRunId,
        setSelectedRunId,
        viewRun,
        canonical,
        manifest,
        isCanonicalSelection,
        frameIndex,
        setFrameIndex,
        playing,
        setPlaying,
        playbackSpeed,
        setPlaybackSpeed,
        bounds,
        promote,
        activate,
        openExpanded,
        message,
      }),
      [
        bounds,
        canonical,
        frameIndex,
        investigation,
        isCanonicalSelection,
        manifest,
        playbackSpeed,
        playing,
        runs,
        selectedRun,
        selectedRunId,
        viewRun,
      ],
    );

  return (
    <WorkspaceContext.Provider
      value={
        model
      }
    >
      <div className="fv2-dock-workstation">
        <header className="fv2-dock-commandbar">
          <div className="fv2-dock-commandbar__identity">
            <span>
              STEP 11
            </span>

            <strong>
              2D / 3D / AR
            </strong>

            <em>
              {canonical
                ? "CANONICAL"
                : "PREVIEW"}
            </em>
          </div>

          <div className="fv2-dock-commandbar__status">
            <span>
              <b>
                {viewRun?.code ??
                  "NO RUN"}
              </b>
              source
            </span>

            <span>
              <b>
                {viewRun?.input.participants.length ??
                  0}
              </b>
              actors
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
          </div>

          <div className="fv2-dock-commandbar__actions">
            <button
              type="button"
              onClick={
                resetLayout
              }
              title="Reset dock layout"
              aria-label="Reset dock layout"
            >
              <RefreshCw
                size={
                  15
                }
              />
            </button>

            <button
              type="button"
              disabled={
                !canonical
              }
              onClick={
                openExpanded
              }
              title="Open active viewport full screen"
              aria-label="Open active viewport full screen"
            >
              <Expand
                size={
                  15
                }
              />
            </button>
          </div>
        </header>

        <div className="fv2-dock-host">
          {!dockReady && (
            <div className="fv2-dock-boot">
              <RefreshCw
                className="fv2-dock-spin"
                size={
                  22
                }
              />

              <span>
                Building dock...
              </span>
            </div>
          )}

          <DockviewReact
            className="roadsafe-dockview"
            theme={{
              ...themeAbyss,
              tabAnimation:
                "smooth",
            }}
            components={
              DOCK_COMPONENTS
            }
            onReady={
              onReady
            }
          />
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}

function ScenePanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useWorkspace();

  return (
    <div className="fv2-dock-panel fv2-dock-scene">
      <section>
        <PanelHeading
          title="Simulation"
          value={
            String(
              model.runs.length,
            )
          }
        />

        <select
          value={
            model.selectedRun?.id ??
            ""
          }
          disabled={
            model.runs.length ===
            0
          }
          onChange={(
            event,
          ) =>
            model.setSelectedRunId(
              event.target.value,
            )
          }
        >
          {model.runs.length ===
          0 ? (
            <option value="">
              No simulation
            </option>
          ) : (
            model.runs.map(
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
                  {run.code}
                  {" / "}
                  {run.hypothesisCode}
                </option>
              ),
            )
          )}
        </select>

        <button
          type="button"
          className={
            model.isCanonicalSelection
              ? "is-current"
              : ""
          }
          disabled={
            !model.selectedRun
          }
          onClick={
            model.promote
          }
        >
          {model.isCanonicalSelection ? (
            <RefreshCw
              size={
                14
              }
            />
          ) : (
            <CheckCircle2
              size={
                14
              }
            />
          )}

          <span>
            {model.isCanonicalSelection
              ? "Rebuild canonical"
              : "Set canonical"}
          </span>
        </button>
      </section>

      <section>
        <PanelHeading
          title="Participants"
          value={
            String(
              model.viewRun?.input.participants.length ??
              0,
            )
          }
        />

        <div className="fv2-dock-tree">
          {model.viewRun?.input.participants.map(
            (
              participant,
              index,
            ) => (
              <article
                key={
                  participant.id
                }
              >
                <i>
                  {index +
                    1}
                </i>

                <div>
                  <strong>
                    {
                      participant.label
                    }
                  </strong>

                  <small>
                    {participant.speedKmh.toFixed(
                      1,
                    )}{" "}
                    km/h
                  </small>
                </div>
              </article>
            ),
          )}

          {!model.viewRun && (
            <p>
              No participants.
            </p>
          )}
        </div>
      </section>

      <section>
        <PanelHeading
          title="Contacts"
          value={
            String(
              model.viewRun?.contacts.length ??
              0,
            )
          }
        />

        <div className="fv2-dock-contact-list">
          {model.viewRun?.contacts.slice(
            0,
            8,
          ).map(
            (
              contact,
            ) => (
              <article
                key={
                  contact.id
                }
              >
                <span>
                  {contact.timeSeconds.toFixed(
                    2,
                  )}
                  s
                </span>

                <strong>
                  {contact.participantALabel}
                  {" / "}
                  {contact.participantBLabel}
                </strong>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function PropertiesPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useWorkspace();

  return (
    <div className="fv2-dock-panel fv2-dock-properties">
      <section>
        <PanelHeading
          title="Reconstruction"
          value={
            model.canonical
              ? "LOCKED"
              : "PREVIEW"
          }
          ready={
            Boolean(
              model.canonical,
            )
          }
        />

        <dl>
          <Property
            label="Case"
            value={
              model.investigation.caseNumber
            }
          />

          <Property
            label="Hypothesis"
            value={
              model.manifest?.hypothesisCode ??
              model.viewRun?.hypothesisCode ??
              "-"
            }
          />

          <Property
            label="Run"
            value={
              model.manifest?.simulationRunCode ??
              model.viewRun?.code ??
              "-"
            }
          />

          <Property
            label="Evidence"
            value={
              String(
                model.investigation.evidence.length,
              )
            }
          />

          <Property
            label="Measurements"
            value={
              String(
                model.investigation.measurements.length,
              )
            }
          />

          <Property
            label="Analysis"
            value={
              String(
                model.investigation.analysisFindings.length,
              )
            }
          />

          <Property
            label="Updated"
            value={
              model.manifest
                ? formatDate(
                    model.manifest.updatedAt,
                  )
                : "-"
            }
          />
        </dl>
      </section>

      <section>
        <PanelHeading
          title="Viewports"
        />

        <div className="fv2-dock-view-buttons">
          <button
            type="button"
            onClick={() =>
              model.activate(
                "viewport-2d",
              )
            }
            title="2D Plan"
          >
            <Map
              size={
                16
              }
            />
            <span>
              2D
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              model.activate(
                "viewport-3d",
              )
            }
            title="3D Scene"
          >
            <Orbit
              size={
                16
              }
            />
            <span>
              3D
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              model.activate(
                "viewport-ar",
              )
            }
            title="AR Live"
          >
            <Smartphone
              size={
                16
              }
            />
            <span>
              AR
            </span>
          </button>
        </div>
      </section>

      <section className="fv2-dock-rule">
        <ShieldCheck
          size={
            16
          }
        />

        <p>
          Derived views remain traceable to the selected
          hypothesis and simulation run.
        </p>
      </section>
    </div>
  );
}

function TimelinePanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useWorkspace();

  const run =
    model.viewRun;

  const maxFrame =
    Math.max(
      0,
      (
        run?.frames.length ??
        1
      ) -
        1,
    );

  const safeFrame =
    Math.min(
      model.frameIndex,
      maxFrame,
    );

  const frame =
    run?.frames[
      safeFrame
    ];

  return (
    <div className="fv2-dock-timeline">
      <div className="fv2-dock-timeline__controls">
        <button
          type="button"
          disabled={
            !run
          }
          onClick={() => {
            model.setPlaying(
              false,
            );
            model.setFrameIndex(
              0,
            );
          }}
          title="First frame"
        >
          <SkipBack
            size={
              15
            }
          />
        </button>

        <button
          type="button"
          disabled={
            !run
          }
          onClick={() => {
            model.setPlaying(
              false,
            );
            model.setFrameIndex(
              (
                value,
              ) =>
                Math.max(
                  0,
                  value -
                    1,
                ),
            );
          }}
          title="Previous frame"
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
          disabled={
            !run
          }
          onClick={() =>
            model.setPlaying(
              (
                value,
              ) =>
                !value,
            )
          }
          title={
            model.playing
              ? "Pause"
              : "Play"
          }
        >
          {model.playing ? (
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
          disabled={
            !run
          }
          onClick={() => {
            model.setPlaying(
              false,
            );
            model.setFrameIndex(
              (
                value,
              ) =>
                Math.min(
                  maxFrame,
                  value +
                    1,
                ),
            );
          }}
          title="Next frame"
        >
          <ChevronRight
            size={
              16
            }
          />
        </button>

        <button
          type="button"
          disabled={
            !run
          }
          onClick={() => {
            model.setPlaying(
              false,
            );
            model.setFrameIndex(
              maxFrame,
            );
          }}
          title="Last frame"
        >
          <SkipForward
            size={
              15
            }
          />
        </button>

        <select
          value={
            model.playbackSpeed
          }
          onChange={(
            event,
          ) =>
            model.setPlaybackSpeed(
              Number(
                event.target.value,
              ),
            )
          }
          title="Playback speed"
        >
          <option value="0.5">
            0.5x
          </option>
          <option value="1">
            1x
          </option>
          <option value="2">
            2x
          </option>
        </select>

        <output>
          {frame?.timeSeconds.toFixed(
            2,
          ) ??
            "0.00"}
          s
        </output>
      </div>

      <input
        className="fv2-dock-timeline__range"
        type="range"
        min="0"
        max={
          maxFrame
        }
        value={
          safeFrame
        }
        disabled={
          !run
        }
        onChange={(
          event,
        ) => {
          model.setPlaying(
            false,
          );
          model.setFrameIndex(
            Number(
              event.target.value,
            ),
          );
        }}
        aria-label="Reconstruction timeline"
      />

      <div className="fv2-dock-timeline__marks">
        <span>
          0.00
        </span>

        {run?.contacts.slice(
          0,
          6,
        ).map(
          (
            contact,
          ) => (
            <i
              key={
                contact.id
              }
              style={{
                left:
                  `${Math.min(
                    100,
                    Math.max(
                      0,
                      (
                        contact.timeSeconds /
                        Math.max(
                          0.001,
                          run.input.durationSeconds,
                        )
                      ) *
                        100,
                    ),
                  )}%`,
              }}
              title={`${contact.participantALabel} / ${contact.participantBLabel} at ${contact.timeSeconds.toFixed(
                2,
              )} s`}
            />
          ),
        )}

        <span>
          {run?.input.durationSeconds.toFixed(
            2,
          ) ??
            "0.00"}
        </span>
      </div>
    </div>
  );
}

function Viewport2DPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useWorkspace();

  const run =
    model.viewRun;

  const hypothesis =
    run
      ? model.investigation.hypotheses.find(
          (
            item,
          ) =>
            item.id ===
            run.hypothesisId,
        )
      : undefined;

  if (!run) {
    return (
      <ViewportGate
        icon={
          <AlertTriangle
            size={
              27
            }
          />
        }
        title="Simulation required"
        detail="Complete Step 10 first."
      />
    );
  }

  const frame =
    run.frames[
      Math.min(
        model.frameIndex,
        Math.max(
          0,
          run.frames.length -
            1,
        ),
      )
    ];

  const sx =
    (
      x: number,
    ) =>
      (
        (
          x -
          model.bounds.minX
        ) /
        Math.max(
          0.001,
          model.bounds.maxX -
          model.bounds.minX,
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
          model.bounds.minY
        ) /
        Math.max(
          0.001,
          model.bounds.maxY -
          model.bounds.minY,
        )
      ) *
        600;

  return (
    <div className="fv2-dock-viewport fv2-dock-viewport--2d">
      <svg
        viewBox="0 0 1000 600"
        aria-label="2D reconstruction viewport"
      >
        <defs>
          <pattern
            id="roadSafeDockFineGrid"
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

          <pattern
            id="roadSafeDockGrid"
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
          width="1000"
          height="600"
          fill="#1c1c1c"
        />

        <rect
          width="1000"
          height="600"
          fill="url(#roadSafeDockFineGrid)"
        />

        <rect
          width="1000"
          height="600"
          fill="url(#roadSafeDockGrid)"
        />

        {hypothesis?.impactRegion && (
          <circle
            cx={
              sx(
                hypothesis.impactRegion.xMetres,
              )
            }
            cy={
              sy(
                hypothesis.impactRegion.yMetres,
              )
            }
            r={
              Math.max(
                10,
                (
                  hypothesis.impactRegion.radiusMetres /
                  Math.max(
                    1,
                    model.bounds.maxX -
                    model.bounds.minX,
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

        {run.input.participants.map(
          (
            participant,
            index,
          ) => {
            const points =
              run.frames.flatMap(
                (
                  candidate,
                ) => {
                  const item =
                    candidate.participants.find(
                      (
                        value,
                      ) =>
                        value.participantId ===
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
                  points.join(
                    " ",
                  )
                }
                fill="none"
                stroke={
                  index %
                    2 ===
                  0
                    ? "#e8872d"
                    : "#8fa5ba"
                }
                strokeWidth="3"
                opacity=".72"
              />
            );
          },
        )}

        {run.contacts.map(
          (
            contact,
          ) => (
            <circle
              key={
                contact.id
              }
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
          ),
        )}

        {frame?.participants.map(
          (
            participant,
            index,
          ) => {
            const source =
              run.input.participants.find(
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

      {!model.canonical && (
        <span className="fv2-dock-preview-flag">
          PREVIEW
        </span>
      )}
    </div>
  );
}

function Viewport3DPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useWorkspace();

  if (!model.canonical) {
    return (
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
          !model.selectedRun
        }
        onCreate={
          model.promote
        }
      />
    );
  }

  const frame =
    model.viewRun
      ? model.viewRun.frames[
          Math.min(
            model.frameIndex,
            Math.max(
              0,
              model.viewRun.frames.length -
                1,
            ),
          )
        ]
      : undefined;

  return (
    <div className="fv2-dock-viewport fv2-dock-viewport--3d">
      <Suspense
        fallback={
          <ViewportLoading
            label="Loading 3D"
          />
        }
      >
        <Reconstruction3DViewer
          reconstruction={
            model.canonical
          }
          onSwitchTo2D={() =>
            model.activate(
              "viewport-2d",
            )
          }
          onRunPhysics={() =>
            model.message(
              "Physics is frozen in Step 11. Return to Simulation to change it.",
            )
          }
          onPreparePlayback={() =>
            model.canonical as AccidentReconstruction
          }
          compact
          workspaceMode
          workspaceTimeSeconds={
            frame?.timeSeconds ??
            0
          }
          workspacePlaying={
            model.playing
          }
          workspacePlaybackSpeed={
            model.playbackSpeed
          }
        />
      </Suspense>
    </div>
  );
}

function ViewportARPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useWorkspace();

  if (!model.canonical) {
    return (
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
          !model.selectedRun
        }
        onCreate={
          model.promote
        }
      />
    );
  }

  return (
    <div className="fv2-dock-viewport fv2-dock-viewport--ar">
      <Suspense
        fallback={
          <ViewportLoading
            label="Loading AR"
          />
        }
      >
        <ARReconstructionViewer
          caseId={
            model.investigation.caseId
          }
          caseNumber={
            model.investigation.caseNumber
          }
          caseTitle={
            model.investigation.caseTitle
          }
          recordedBy={
            model.investigation.investigatingOfficer
          }
          reconstruction={
            model.canonical
          }
          onExit={() =>
            model.activate(
              "viewport-2d",
            )
          }
        />
      </Suspense>
    </div>
  );
}

function PanelHeading({
  title,
  value,
  ready = false,
}: {
  title: string;
  value?: string;
  ready?: boolean;
}) {
  return (
    <div className="fv2-dock-section-title">
      <strong>
        {title}
      </strong>

      {value && (
        <span
          className={
            ready
              ? "is-ready"
              : ""
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}

function Property({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>
        {label}
      </dt>

      <dd title={value}>
        {value}
      </dd>
    </div>
  );
}

function ViewportLoading({
  label,
}: {
  label: string;
}) {
  return (
    <div className="fv2-dock-gate">
      <RefreshCw
        className="fv2-dock-spin"
        size={
          25
        }
      />

      <strong>
        {label}
      </strong>
    </div>
  );
}

function ViewportGate({
  icon,
  title,
  detail,
}: {
  icon:
    ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="fv2-dock-gate">
      {icon}

      <strong>
        {title}
      </strong>

      <span>
        {detail}
      </span>
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
    <div className="fv2-dock-gate">
      {icon}

      <strong>
        {title}
      </strong>

      <button
        type="button"
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

const DOCK_COMPONENTS = {
  scene:
    ScenePanel,
  properties:
    PropertiesPanel,
  timeline:
    TimelinePanel,
  viewport2d:
    Viewport2DPanel,
  viewport3d:
    Viewport3DPanel,
  viewportar:
    ViewportARPanel,
};
