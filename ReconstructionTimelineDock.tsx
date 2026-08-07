import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  Activity,
  ChevronUp,
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

import "./reconstructionTimelineDock.css";

interface ReconstructionTimelineDockProps {
  reconstruction: AccidentReconstruction;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;

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
  onSelectSceneObject(objectId: string): void;
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

export default function ReconstructionTimelineDock({
  reconstruction,
  currentTime,
  isPlaying,
  playbackSpeed,
  onReset,
  onPlayPause,
  onStepBackward,
  onStepForward,
  onSeek,
  onPlaybackSpeedChange,
  onEventsChange,
  onSelectParticipantPathPoint,
  onSelectSceneObject,
}: ReconstructionTimelineDockProps) {
  const [height, setHeight] =
    useState(DEFAULT_HEIGHT);

  const [collapsed, setCollapsed] =
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

  /*
   * Tell AppShell exactly how much vertical screen space this independent
   * editor owns. Both the centre workspace and right Properties host then
   * terminate above the timeline.
   */
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shell =
      document.querySelector<HTMLElement>(
        ".roadsafe-workstation",
      );

    if (!shell) {
      return;
    }

    shell.classList.add(
      "has-reconstruction-screen-timeline",
    );

    shell.style.setProperty(
      "--rs-screen-timeline-height",
      `${effectiveHeight}px`,
    );

    return () => {
      shell.classList.remove(
        "has-reconstruction-screen-timeline",
      );

      shell.style.removeProperty(
        "--rs-screen-timeline-height",
      );
    };
  }, [effectiveHeight]);

  /*
   * The Timeline tool in AccidentReconstructionEditor dispatches this event.
   * That keeps the dock independent from the page/component layout while still
   * allowing the toolbar to reveal it.
   */
  useEffect(() => {
    const handleOpen =
      () => setCollapsed(false);

    window.addEventListener(
      "roadsafe:timeline-open",
      handleOpen,
    );

    return () => {
      window.removeEventListener(
        "roadsafe:timeline-open",
        handleOpen,
      );
    };
  }, []);

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (collapsed) return;

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
            (startY - pointerEvent.clientY),
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

  return (
    <section
      className={`reconstruction-screen-timeline-dock ${
        collapsed ? "is-collapsed" : ""
      }`}
      style={{
        height: effectiveHeight,
      }}
      aria-label="Reconstruction timeline"
    >
      {!collapsed && (
        <div
          className="reconstruction-screen-timeline-dock__resize"
          role="separator"
          aria-label="Resize timeline"
          aria-orientation="horizontal"
          onPointerDown={
            handleResizePointerDown
          }
        />
      )}

      <header className="reconstruction-screen-timeline-dock__header">
        <div className="reconstruction-screen-timeline-dock__identity">
          <ScanLine size={13} />
          <strong>Timeline</strong>
          <span>
            Shared 2D / 3D accident sequence
          </span>
        </div>

        <div className="reconstruction-screen-timeline-dock__header-tools">
          <strong>
            {currentTime.toFixed(2)}s
          </strong>

          <button
            type="button"
            onClick={() =>
              setCollapsed(
                (current) => !current,
              )
            }
            title={
              collapsed
                ? "Expand timeline"
                : "Collapse timeline"
            }
            aria-label={
              collapsed
                ? "Expand timeline"
                : "Collapse timeline"
            }
          >
            <ChevronUp size={13} />
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="reconstruction-screen-timeline-dock__body">
          <div className="reconstruction-screen-timeline-dock__transport">
            <div className="reconstruction-screen-timeline-dock__transport-buttons">
              <button
                type="button"
                onClick={onReset}
                title="Reset playback"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                onClick={onStepBackward}
                title="Step backward 0.1 seconds"
              >
                <SkipBack size={14} />
              </button>

              <button
                type="button"
                onClick={onPlayPause}
                disabled={
                  reconstruction.vehicles
                    .length === 0
                }
                className="is-play"
                title={
                  isPlaying
                    ? "Pause playback"
                    : "Start playback"
                }
              >
                {isPlaying ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}
                <span>
                  {isPlaying
                    ? "Pause"
                    : "Play"}
                </span>
              </button>

              <button
                type="button"
                onClick={onStepForward}
                title="Step forward 0.1 seconds"
              >
                <SkipForward size={14} />
              </button>
            </div>

            <div className="reconstruction-screen-timeline-dock__clock">
              <strong data-playback-clock>
                {currentTime.toFixed(2)}s
              </strong>
              <span>
                /{" "}
                {reconstruction.durationSeconds.toFixed(
                  1,
                )}
                s
              </span>
            </div>

            <div className="reconstruction-screen-timeline-dock__summary">
              <span>
                <Activity size={12} />
                {collisionCount} collision(s)
              </span>

              <span>
                {physicsSummary}
              </span>
            </div>

            <label className="reconstruction-screen-timeline-dock__speed">
              <span>Speed</span>

              <select
                value={playbackSpeed}
                onChange={(event) =>
                  onPlaybackSpeedChange(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              >
                <option value={0.25}>
                  0.25×
                </option>
                <option value={0.5}>
                  0.5×
                </option>
                <option value={1}>
                  1×
                </option>
                <option value={1.5}>
                  1.5×
                </option>
                <option value={2}>
                  2×
                </option>
              </select>
            </label>
          </div>

          <div
            id="reconstruction-timeline-workspace"
            className="reconstruction-screen-timeline-dock__timeline"
          >
            <AccidentTimeline
              durationSeconds={
                reconstruction.durationSeconds
              }
              currentTime={currentTime}
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
        </div>
      )}
    </section>
  );
}
