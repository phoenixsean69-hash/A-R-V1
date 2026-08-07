import {
  useMemo,
  useState,
} from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  Activity,
  Camera,
  CarFront,
  Eye,
  EyeOff,
  FileSearch,
  Flag,
  Plus,
  Trash2,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type {
  AccidentTimelineEvent,
  ReconstructionSceneObject,
  ReconstructionVehicle,
  TimelineEventType,
} from "../../types/reconstruction";

interface AccidentTimelineProps {
  durationSeconds: number;
  currentTime: number;
  participants: ReconstructionVehicle[];
  sceneObjects: ReconstructionSceneObject[];
  events: AccidentTimelineEvent[];
  onEventsChange: (events: AccidentTimelineEvent[]) => void;
  onSeek: (timeSeconds: number) => void;
  onSelectParticipantPathPoint: (
    participantId: string,
    pointId: string,
  ) => void;
  onSelectSceneObject: (objectId: string) => void;
}

interface DisplayTimelineEvent {
  id: string;
  timeSeconds: number;
  title: string;
  description: string;
  type: TimelineEventType;
  participantId?: string;
  sceneObjectId?: string;
  pointId?: string;
  generated: boolean;
}

interface TimelineTrack {
  id: string;
  label: string;
  subtitle: string;
  colour: string;
  events: DisplayTimelineEvent[];
}

function TimelineTrackIcon({ trackId }: { trackId: string }) {
  if (trackId === "system:impact") return <TriangleAlert size={10} strokeWidth={3} />;
  if (trackId === "system:evidence") return <FileSearch size={10} strokeWidth={3} />;
  if (trackId === "system:scene") return <Camera size={10} strokeWidth={3} />;
  return <CarFront size={10} strokeWidth={3} />;
}

function TimelineEventIcon({ type }: { type: TimelineEventType }) {
  if (type === "Collision") return <TriangleAlert size={9} strokeWidth={3} />;
  if (type === "Evidence") return <FileSearch size={9} strokeWidth={3} />;
  if (type === "Environment" || type === "Observation") {
    return <Camera size={9} strokeWidth={3} />;
  }
  return <Flag size={9} strokeWidth={3} />;
}

const EVENT_TYPES: TimelineEventType[] = [
  "Participant Action",
  "Collision",
  "Evidence",
  "Environment",
  "Observation",
];

const ZOOM_LEVELS = [1, 1.5, 2.25, 3.5];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEventColour(type: TimelineEventType): string {
  switch (type) {
    case "Collision":
      return "#ef4444";
    case "Evidence":
      return "#f59e0b";
    case "Environment":
      return "#14b8a6";
    case "Observation":
      return "#94a3b8";
    default:
      return "#3b82f6";
  }
}

function getTrackColour(index: number): string {
  const colours = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4"];
  return colours[index % colours.length];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function AccidentTimeline({
  durationSeconds,
  currentTime,
  participants,
  sceneObjects,
  events,
  onEventsChange,
  onSeek,
  onSelectParticipantPathPoint,
  onSelectSceneObject,
}: AccidentTimelineProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [showGenerated, setShowGenerated] = useState(true);
  const [showManual, setShowManual] = useState(true);

  const safeDuration = Math.max(0.1, durationSeconds);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const trackWidth = Math.max(920, Math.round(safeDuration * 90 * zoom));

  const displayEvents = useMemo<DisplayTimelineEvent[]>(() => {
    const generated = participants.flatMap((participant) =>
      participant.pathPoints.map((point) => ({
        id: `path:${participant.id}:${point.id}`,
        timeSeconds: point.timeSeconds,
        title: point.label || point.action,
        description:
          point.notes ||
          `${point.action} at ${point.speedKmh.toFixed(0)} km/h`,
        type:
          point.action === "Impact"
            ? ("Collision" as const)
            : ("Participant Action" as const),
        participantId: participant.id,
        sceneObjectId: point.linkedSceneObjectId,
        pointId: point.id,
        generated: true,
      })),
    );

    const manual = events.map((event) => ({
      ...event,
      generated: false,
    }));

    return [...generated, ...manual]
      .filter((event) => (event.generated ? showGenerated : showManual))
      .sort((first, second) => first.timeSeconds - second.timeSeconds);
  }, [events, participants, showGenerated, showManual]);

  const tracks = useMemo<TimelineTrack[]>(() => {
    const participantTracks = participants.map((participant, index) => ({
      id: `participant:${participant.id}`,
      label: participant.name,
      subtitle: participant.type,
      colour: getTrackColour(index),
      events: displayEvents.filter(
        (event) => event.participantId === participant.id,
      ),
    }));

    const impactEvents = displayEvents.filter(
      (event) => event.type === "Collision",
    );
    const evidenceEvents = displayEvents.filter(
      (event) => event.type === "Evidence",
    );
    const sceneEvents = displayEvents.filter(
      (event) =>
        !event.participantId &&
        (event.type === "Environment" || event.type === "Observation"),
    );

    return [
      ...participantTracks,
      {
        id: "system:impact",
        label: "Impacts",
        subtitle: `${impactEvents.length} recorded`,
        colour: "#ef4444",
        events: impactEvents,
      },
      {
        id: "system:evidence",
        label: "Evidence",
        subtitle: `${evidenceEvents.length} linked`,
        colour: "#f59e0b",
        events: evidenceEvents,
      },
      {
        id: "system:scene",
        label: "Scene notes",
        subtitle: `${sceneEvents.length} event(s)`,
        colour: "#14b8a6",
        events: sceneEvents,
      },
    ];
  }, [displayEvents, participants]);

  const selectedEvent = displayEvents.find(
    (event) => event.id === selectedEventId,
  );

  const selectedManualEvent =
    selectedEvent && !selectedEvent.generated
      ? events.find((event) => event.id === selectedEvent.id) ?? null
      : null;

  const tickStep = useMemo(() => {
    const targetTicks = Math.max(8, Math.min(24, trackWidth / 95));
    const rawStep = safeDuration / targetTicks;
    if (rawStep <= 0.5) return 0.5;
    if (rawStep <= 1) return 1;
    if (rawStep <= 2) return 2;
    if (rawStep <= 5) return 5;
    if (rawStep <= 10) return 10;
    return 15;
  }, [safeDuration, trackWidth]);

  const ticks = useMemo(() => {
    const output: number[] = [];
    for (let value = 0; value <= safeDuration + 0.001; value += tickStep) {
      output.push(Number(value.toFixed(2)));
    }
    if (output[output.length - 1] !== safeDuration) output.push(safeDuration);
    return output;
  }, [safeDuration, tickStep]);

  const handleAddEvent = () => {
    const event: AccidentTimelineEvent = {
      id: createId("timeline-event"),
      timeSeconds: clamp(currentTime, 0, safeDuration),
      title: "New observation",
      description: "",
      type: "Observation",
    };

    onEventsChange([...events, event]);
    setSelectedEventId(event.id);
  };

  const updateManualEvent = (
    eventId: string,
    updates: Partial<AccidentTimelineEvent>,
  ) => {
    onEventsChange(
      events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              ...updates,
            }
          : event,
      ),
    );
  };

  const deleteManualEvent = (eventId: string) => {
    onEventsChange(events.filter((event) => event.id !== eventId));
    setSelectedEventId(null);
  };

  const handleEventClick = (event: DisplayTimelineEvent) => {
    setSelectedEventId(event.id);
    onSeek(event.timeSeconds);

    if (event.generated && event.participantId && event.pointId) {
      onSelectParticipantPathPoint(event.participantId, event.pointId);
    } else if (event.sceneObjectId) {
      onSelectSceneObject(event.sceneObjectId);
    }
  };

  const seekFromTrack = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const progress = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    onSeek(progress * safeDuration);
  };

  return (
    <section className="reconstruction-timeline" aria-label="Interactive accident timeline">
      <header className="reconstruction-timeline__header">
        <div>
          <p className="reconstruction-timeline__eyebrow">Interactive timeline</p>
          <h2>Accident sequence</h2>
          <p>
            Scrub, inspect and edit the exact event sequence shared by the 2D and 3D views.
          </p>
        </div>

        <div className="reconstruction-timeline__actions">
          <button
            type="button"
            onClick={() => setShowGenerated((value) => !value)}
            className={showGenerated ? "is-active" : ""}
            title="Toggle generated path events"
          >
            {showGenerated ? <Eye size={13} /> : <EyeOff size={13} />}
            Auto
          </button>
          <button
            type="button"
            onClick={() => setShowManual((value) => !value)}
            className={showManual ? "is-active" : ""}
            title="Toggle investigator events"
          >
            {showManual ? <Eye size={13} /> : <EyeOff size={13} />}
            Manual
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}
            disabled={zoomIndex === 0}
            title="Zoom out timeline"
          >
            <ZoomOut size={13} />
          </button>
          <span className="reconstruction-timeline__zoom">{zoom.toFixed(2)}×</span>
          <button
            type="button"
            onClick={() =>
              setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))
            }
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            title="Zoom in timeline"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={handleAddEvent}
            className="reconstruction-timeline__add"
          >
            <Plus size={13} />
            Add at {currentTime.toFixed(1)}s
          </button>
        </div>
      </header>

      <div className="reconstruction-timeline__scrubber">
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.01}
          value={clamp(currentTime, 0, safeDuration)}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Timeline playback position"
        />
        <div>
          <span>{currentTime.toFixed(2)}s</span>
          <strong>{safeDuration.toFixed(1)}s</strong>
        </div>
      </div>

      <div className="reconstruction-timeline__viewport">
        <div className="reconstruction-timeline__labels">
          <div className="reconstruction-timeline__label reconstruction-timeline__label--ruler">
            <Activity size={13} />
            Tracks
          </div>
          {tracks.map((track) => (
            <div key={track.id} className="reconstruction-timeline__label">
              <span
                className="reconstruction-timeline__track-icon"
                style={{ backgroundColor: track.colour }}
              >
                <TimelineTrackIcon trackId={track.id} />
              </span>
              <div>
                <strong>{track.label}</strong>
                <small>{track.subtitle}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="reconstruction-timeline__scroll">
          <div className="reconstruction-timeline__surface" style={{ width: trackWidth }}>
            <div className="reconstruction-timeline__ruler">
              {ticks.map((tick) => {
                const left = (tick / safeDuration) * 100;
                return (
                  <span key={tick} style={{ left: `${left}%` }}>
                    <i />
                    {tick.toFixed(tickStep < 1 ? 1 : 0)}s
                  </span>
                );
              })}
            </div>

            <div
              className="reconstruction-timeline__cursor"
              style={{ left: `${(clamp(currentTime, 0, safeDuration) / safeDuration) * 100}%` }}
            >
              <span>{currentTime.toFixed(1)}s</span>
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                className="reconstruction-timeline__track"
                onPointerDown={seekFromTrack}
              >
                <div className="reconstruction-timeline__track-line" />
                {ticks.map((tick) => (
                  <i
                    key={`${track.id}-${tick}`}
                    className="reconstruction-timeline__grid-line"
                    style={{ left: `${(tick / safeDuration) * 100}%` }}
                  />
                ))}
                {track.events.map((event) => {
                  const left = (clamp(event.timeSeconds, 0, safeDuration) / safeDuration) * 100;
                  return (
                    <button
                      key={`${track.id}:${event.id}`}
                      type="button"
                      className={`reconstruction-timeline__marker ${selectedEventId === event.id ? "is-selected" : ""}`}
                      style={{
                        left: `${left}%`,
                        borderColor: getEventColour(event.type),
                        backgroundColor: `${getEventColour(event.type)}26`,
                      }}
                      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                      onClick={() => handleEventClick(event)}
                      title={`${event.timeSeconds.toFixed(2)}s — ${event.title}`}
                    >
                      <span
                        className="reconstruction-timeline__event-icon"
                        style={{ backgroundColor: getEventColour(event.type) }}
                      >
                        <TimelineEventIcon type={event.type} />
                      </span>
                      <strong>{event.title}</strong>
                      {event.generated && <small>AUTO</small>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="reconstruction-timeline__inspector">
        {!selectedEvent ? (
          <div className="reconstruction-timeline__empty">
            Select a marker to inspect it, or click any track to move playback to that time.
          </div>
        ) : selectedEvent.generated ? (
          <div className="reconstruction-timeline__selected-event">
            <div>
              <span
                className="reconstruction-timeline__event-icon"
                style={{ backgroundColor: getEventColour(selectedEvent.type) }}
              >
                <TimelineEventIcon type={selectedEvent.type} />
              </span>
              <div>
                <small>Generated movement event</small>
                <strong>{selectedEvent.title}</strong>
              </div>
            </div>
            <p>{selectedEvent.description}</p>
            <time>{selectedEvent.timeSeconds.toFixed(2)}s</time>
          </div>
        ) : selectedManualEvent ? (
          <div className="reconstruction-timeline__editor">
            <label>
              <span>Title</span>
              <input
                value={selectedManualEvent.title}
                onChange={(event) =>
                  updateManualEvent(selectedManualEvent.id, {
                    title: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>Time</span>
              <input
                type="number"
                min={0}
                max={safeDuration}
                step={0.01}
                value={Number(selectedManualEvent.timeSeconds.toFixed(2))}
                onChange={(event) =>
                  updateManualEvent(selectedManualEvent.id, {
                    timeSeconds: clamp(Number(event.target.value), 0, safeDuration),
                  })
                }
              />
            </label>

            <label>
              <span>Type</span>
              <select
                value={selectedManualEvent.type}
                onChange={(event) =>
                  updateManualEvent(selectedManualEvent.id, {
                    type: event.target.value as TimelineEventType,
                  })
                }
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Participant</span>
              <select
                value={selectedManualEvent.participantId ?? ""}
                onChange={(event) =>
                  updateManualEvent(selectedManualEvent.id, {
                    participantId: event.target.value || undefined,
                  })
                }
              >
                <option value="">None</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Scene object</span>
              <select
                value={selectedManualEvent.sceneObjectId ?? ""}
                onChange={(event) =>
                  updateManualEvent(selectedManualEvent.id, {
                    sceneObjectId: event.target.value || undefined,
                  })
                }
              >
                <option value="">None</option>
                {sceneObjects.map((object) => (
                  <option key={object.id} value={object.id}>
                    {object.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="reconstruction-timeline__description">
              <span>Description</span>
              <textarea
                value={selectedManualEvent.description}
                onChange={(event) =>
                  updateManualEvent(selectedManualEvent.id, {
                    description: event.target.value,
                  })
                }
                rows={2}
              />
            </label>

            <button
              type="button"
              className="reconstruction-timeline__delete"
              onClick={() => deleteManualEvent(selectedManualEvent.id)}
            >
              <Trash2 size={13} />
              Delete event
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
