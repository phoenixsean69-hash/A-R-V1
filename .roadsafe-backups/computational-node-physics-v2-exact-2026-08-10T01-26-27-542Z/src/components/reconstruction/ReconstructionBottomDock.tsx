import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  Activity,
  ChevronUp,
  Expand,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  SkipBack,
  SkipForward,
} from "../icons/materialIcons";

import type {
  AccidentReconstruction,
  AccidentTimelineEvent,
} from "../../types/reconstruction";

import AccidentTimeline from "./AccidentTimeline";
import ReconstructionNodeEditor from "./ReconstructionNodeEditor";

import "./reconstructionBottomDock.css";

type BottomEditor = "timeline" | "nodes";

interface ReconstructionBottomDockProps {
  reconstruction: AccidentReconstruction;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  activeView: "2D" | "3D";
  selectedParticipantId: string | null;
  selectedSceneObjectId: string | null;

  onReset(): void;
  onPlayPause(): void;
  onStepBackward(): void;
  onStepForward(): void;
  onSeek(timeSeconds: number): void;
  onPlaybackSpeedChange(speed: number): void;
  onEventsChange(events: AccidentTimelineEvent[]): void;
  onSelectParticipantPathPoint(
    participantId: string,
    pointId: string,
  ): void;
  onSelectParticipant(participantId: string): void;
  onSelectSceneObject(objectId: string): void;
  onRunPhysics(): void;
  onSwitchView(view: "2D" | "3D"): void;
  onOpenNodeTarget(
    target:
      | "case"
      | "scene"
      | "objects"
      | "evidence"
      | "collision"
      | "physics",
  ): void;
}

const DEFAULT_HEIGHT = 184;
const MIN_HEIGHT = 126;
const MAX_HEIGHT = 360;
const COLLAPSED_HEIGHT = 28;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

export default function ReconstructionBottomDock({
  reconstruction,
  currentTime,
  isPlaying,
  playbackSpeed,
  activeView,
  selectedParticipantId,
  selectedSceneObjectId,
  onReset,
  onPlayPause,
  onStepBackward,
  onStepForward,
  onSeek,
  onPlaybackSpeedChange,
  onEventsChange,
  onSelectParticipantPathPoint,
  onSelectParticipant,
  onSelectSceneObject,
  onRunPhysics,
  onSwitchView,
  onOpenNodeTarget,
}: ReconstructionBottomDockProps) {
  const [height, setHeight] =
    useState(DEFAULT_HEIGHT);

  const [collapsed, setCollapsed] =
    useState(false);

  const [activeEditor, setActiveEditor] =
    useState<BottomEditor>("timeline");

  const [nodesMaximized, setNodesMaximized] =
    useState(false);

  const effectiveHeight =
    collapsed
      ? COLLAPSED_HEIGHT
      : height;

  const collisionCount =
    reconstruction.lastPhysicsSimulation
      ?.participantCollisions ?? 0;

  const physicsSummary =
    reconstruction.lastPhysicsSimulation
      ? `${reconstruction.lastPhysicsSimulation.totalDissipatedKineticEnergyKj.toFixed(
          1,
        )} kJ dissipated`
      : "Physics not baked";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shell =
      document.querySelector<HTMLElement>(
        ".roadsafe-workstation",
      );

    const propertiesHost =
      document.querySelector<HTMLElement>(
        ".roadsafe-workspace-context-slot",
      );

    const reconstructionHeader =
      document.querySelector<HTMLElement>(
        ".reconstruction-workspace__header",
      );

    if (!shell) {
      return;
    }

    shell.classList.add(
      "has-reconstruction-bottom-dock",
    );

    const updateGeometry = () => {
      const propertiesRect =
        propertiesHost?.getBoundingClientRect();

      const propertiesVisible =
        Boolean(propertiesRect) &&
        (propertiesRect?.width ?? 0) > 0 &&
        Boolean(propertiesHost) &&
        getComputedStyle(
          propertiesHost as HTMLElement,
        ).display !== "none";

      shell.style.setProperty(
        "--rs-bottom-properties-width",
        propertiesVisible
          ? `${Math.round(
              propertiesRect?.width ?? 0,
            )}px`
          : "0px",
      );

      const headerBottom =
        reconstructionHeader
          ?.getBoundingClientRect()
          .bottom ?? 0;

      shell.style.setProperty(
        "--rs-bottom-node-top",
        `${Math.max(
          0,
          Math.round(headerBottom),
        )}px`,
      );

      shell.style.setProperty(
        "--rs-bottom-dock-height",
        nodesMaximized
          ? "0px"
          : `${effectiveHeight}px`,
      );
    };

    updateGeometry();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(
            updateGeometry,
          )
        : null;

    if (observer) {
      if (propertiesHost) {
        observer.observe(
          propertiesHost,
        );
      }

      if (reconstructionHeader) {
        observer.observe(
          reconstructionHeader,
        );
      }
    }

    window.addEventListener(
      "resize",
      updateGeometry,
    );

    return () => {
      observer?.disconnect();

      window.removeEventListener(
        "resize",
        updateGeometry,
      );

      shell.classList.remove(
        "has-reconstruction-bottom-dock",
      );

      shell.style.removeProperty(
        "--rs-bottom-properties-width",
      );

      shell.style.removeProperty(
        "--rs-bottom-node-top",
      );

      shell.style.removeProperty(
        "--rs-bottom-dock-height",
      );
    };
  }, [
    effectiveHeight,
    nodesMaximized,
  ]);

  useEffect(() => {
    const openTimeline = () => {
      setActiveEditor("timeline");
      setNodesMaximized(false);
      setCollapsed(false);
    };

    const openNodes = () => {
      setActiveEditor("nodes");
      setCollapsed(false);
    };

    window.addEventListener(
      "roadsafe:timeline-open",
      openTimeline,
    );

    window.addEventListener(
      "roadsafe:nodes-open",
      openNodes,
    );

    return () => {
      window.removeEventListener(
        "roadsafe:timeline-open",
        openTimeline,
      );

      window.removeEventListener(
        "roadsafe:nodes-open",
        openNodes,
      );
    };
  }, []);

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      collapsed ||
      nodesMaximized
    ) {
      return;
    }

    event.preventDefault();

    const startY = event.clientY;
    const startHeight = height;

    const handleMove = (
      pointerEvent: PointerEvent,
    ) => {
      const viewportMaximum =
        Math.min(
          MAX_HEIGHT,
          window.innerHeight * 0.44,
        );

      setHeight(
        clamp(
          startHeight +
            (
              startY -
              pointerEvent.clientY
            ),
          MIN_HEIGHT,
          viewportMaximum,
        ),
      );
    };

    const handleUp = () => {
      window.removeEventListener(
        "pointermove",
        handleMove,
      );

      window.removeEventListener(
        "pointerup",
        handleUp,
      );
    };

    window.addEventListener(
      "pointermove",
      handleMove,
    );

    window.addEventListener(
      "pointerup",
      handleUp,
      { once: true },
    );
  };

  const selectEditor = (
    editor: BottomEditor,
  ) => {
    setActiveEditor(editor);
    setCollapsed(false);

    if (editor !== "nodes") {
      setNodesMaximized(false);
    }
  };

  const toggleCollapsed = () => {
    if (nodesMaximized) {
      setNodesMaximized(false);
    }

    setCollapsed(
      (current) => !current,
    );
  };

  const toggleNodesMaximized = () => {
    setActiveEditor("nodes");
    setCollapsed(false);
    setNodesMaximized(
      (current) => !current,
    );
  };

  return (
    <section
      className={[
        "reconstruction-screen-bottom-dock",
        collapsed
          ? "is-collapsed"
          : "",
        activeEditor === "nodes"
          ? "is-nodes"
          : "is-timeline",
        nodesMaximized
          ? "is-node-maximized"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        nodesMaximized
          ? undefined
          : {
              height:
                effectiveHeight,
            }
      }
      aria-label="Reconstruction bottom editor"
    >
      {!collapsed &&
        !nodesMaximized && (
          <div
            className="reconstruction-screen-bottom-dock__resize"
            role="separator"
            aria-label="Resize bottom editor"
            aria-orientation="horizontal"
            onPointerDown={
              handleResizePointerDown
            }
          />
        )}

      <header className="reconstruction-screen-bottom-dock__header">
        <div className="reconstruction-screen-bottom-dock__tabs">
          <button
            type="button"
            className={
              activeEditor ===
              "timeline"
                ? "is-active"
                : ""
            }
            aria-pressed={
              activeEditor ===
              "timeline"
            }
            onClick={() =>
              selectEditor(
                "timeline",
              )
            }
          >
            <ScanLine size={13} />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            className={
              activeEditor ===
              "nodes"
                ? "is-active"
                : ""
            }
            aria-pressed={
              activeEditor ===
              "nodes"
            }
            onClick={() =>
              selectEditor(
                "nodes",
              )
            }
          >
            <Layers3 size={13} />
            <span>Nodes</span>
          </button>

          <small>
            {activeEditor ===
            "timeline"
              ? "Shared 2D / 3D accident sequence"
              : "Scene, evidence, impact, physics and output graph"}
          </small>
        </div>

        <div className="reconstruction-screen-bottom-dock__header-tools">
          {activeEditor ===
            "timeline" && (
            <strong>
              {currentTime.toFixed(2)}s
            </strong>
          )}

          {activeEditor ===
            "nodes" && (
            <button
              type="button"
              onClick={
                toggleNodesMaximized
              }
              className={
                nodesMaximized
                  ? "is-active"
                  : ""
              }
              aria-pressed={
                nodesMaximized
              }
              title={
                nodesMaximized
                  ? "Restore Nodes to bottom dock"
                  : "Maximize Nodes in the centre workspace"
              }
              aria-label={
                nodesMaximized
                  ? "Restore Nodes to bottom dock"
                  : "Maximize Nodes in the centre workspace"
              }
            >
              <Expand size={13} />
            </button>
          )}

          {!nodesMaximized && (
            <button
              type="button"
              onClick={
                toggleCollapsed
              }
              title={
                collapsed
                  ? "Expand bottom editor"
                  : "Collapse bottom editor"
              }
              aria-label={
                collapsed
                  ? "Expand bottom editor"
                  : "Collapse bottom editor"
              }
            >
              <ChevronUp
                size={13}
              />
            </button>
          )}
        </div>
      </header>

      {!collapsed && (
        <div className="reconstruction-screen-bottom-dock__body">
          {activeEditor ===
            "timeline" ? (
            <>
              <div className="reconstruction-screen-bottom-dock__transport">
                <div className="reconstruction-screen-bottom-dock__transport-buttons">
                  <button
                    type="button"
                    onClick={onReset}
                    title="Reset playback"
                  >
                    <RotateCcw
                      size={14}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      onStepBackward
                    }
                    title="Step backward 0.1 seconds"
                  >
                    <SkipBack
                      size={14}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      onPlayPause
                    }
                    disabled={
                      reconstruction
                        .vehicles
                        .length ===
                      0
                    }
                    className="is-play"
                    title={
                      isPlaying
                        ? "Pause playback"
                        : "Start playback"
                    }
                  >
                    {isPlaying ? (
                      <Pause
                        size={14}
                      />
                    ) : (
                      <Play
                        size={14}
                      />
                    )}

                    <span>
                      {isPlaying
                        ? "Pause"
                        : "Play"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={
                      onStepForward
                    }
                    title="Step forward 0.1 seconds"
                  >
                    <SkipForward
                      size={14}
                    />
                  </button>
                </div>

                <div className="reconstruction-screen-bottom-dock__clock">
                  <strong data-playback-clock>
                    {currentTime.toFixed(
                      2,
                    )}
                    s
                  </strong>

                  <span>
                    /{" "}
                    {reconstruction.durationSeconds.toFixed(
                      1,
                    )}
                    s
                  </span>
                </div>

                <div className="reconstruction-screen-bottom-dock__summary">
                  <span>
                    <Activity
                      size={12}
                    />
                    {collisionCount}{" "}
                    collision(s)
                  </span>

                  <span>
                    {physicsSummary}
                  </span>
                </div>

                <label className="reconstruction-screen-bottom-dock__speed">
                  <span>Speed</span>

                  <select
                    value={
                      playbackSpeed
                    }
                    onChange={(
                      event,
                    ) =>
                      onPlaybackSpeedChange(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                    }
                  >
                    <option
                      value={0.25}
                    >
                      0.25×
                    </option>
                    <option
                      value={0.5}
                    >
                      0.5×
                    </option>
                    <option
                      value={1}
                    >
                      1×
                    </option>
                    <option
                      value={1.5}
                    >
                      1.5×
                    </option>
                    <option
                      value={2}
                    >
                      2×
                    </option>
                  </select>
                </label>
              </div>

              <div
                id="reconstruction-timeline-workspace"
                className="reconstruction-screen-bottom-dock__timeline"
              >
                <AccidentTimeline
                  durationSeconds={
                    reconstruction.durationSeconds
                  }
                  currentTime={
                    currentTime
                  }
                  participants={
                    reconstruction.vehicles
                  }
                  sceneObjects={
                    reconstruction.sceneObjects
                  }
                  events={
                    reconstruction.timelineEvents
                  }
                  onEventsChange={
                    onEventsChange
                  }
                  onSeek={onSeek}
                  onSelectParticipantPathPoint={
                    onSelectParticipantPathPoint
                  }
                  onSelectSceneObject={
                    onSelectSceneObject
                  }
                />
              </div>
            </>
          ) : (
            <div className="reconstruction-screen-bottom-dock__nodes">
              <ReconstructionNodeEditor
                reconstruction={
                  reconstruction
                }
                currentTime={
                  currentTime
                }
                activeView={
                  activeView
                }
                isPlaying={
                  isPlaying
                }
                onRunPhysics={
                  onRunPhysics
                }
                onPlayPause={
                  onPlayPause
                }
                onSeek={
                  onSeek
                }
                onSwitchView={
                  onSwitchView
                }
                onOpenNodeTarget={
                  onOpenNodeTarget
                }
                open
                selectedParticipantId={
                  selectedParticipantId
                }
                selectedSceneObjectId={
                  selectedSceneObjectId
                }
                onToggle={() =>
                  setCollapsed(
                    true,
                  )
                }
                onSelectParticipant={
                  onSelectParticipant
                }
                onSelectSceneObject={
                  onSelectSceneObject
                }
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
