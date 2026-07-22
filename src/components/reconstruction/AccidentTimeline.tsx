import {
  useMemo,
  useState,
} from "react";

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

const EVENT_TYPES: TimelineEventType[] = [
  "Participant Action",
  "Collision",
  "Evidence",
  "Environment",
  "Observation",
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEventColour(type: TimelineEventType): string {
  switch (type) {
    case "Collision":
      return "#dc2626";
    case "Evidence":
      return "#9333ea";
    case "Environment":
      return "#0891b2";
    case "Observation":
      return "#475569";
    default:
      return "#2563eb";
  }
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

  const displayEvents = useMemo<DisplayTimelineEvent[]>(() => {
    const generated = participants.flatMap((participant) =>
      participant.pathPoints.map((point) => ({
        id: `path:${participant.id}:${point.id}`,
        timeSeconds: point.timeSeconds,
        title: `${participant.name}: ${point.label}`,
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

    return [...generated, ...manual].sort(
      (first, second) => first.timeSeconds - second.timeSeconds,
    );
  }, [events, participants]);

  const selectedEvent = displayEvents.find(
    (event) => event.id === selectedEventId,
  );

  const selectedManualEvent =
    selectedEvent && !selectedEvent.generated
      ? events.find((event) => event.id === selectedEvent.id) ?? null
      : null;

  const handleAddEvent = () => {
    const event: AccidentTimelineEvent = {
      id: createId("timeline-event"),
      timeSeconds: Math.min(durationSeconds, Math.max(0, currentTime)),
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

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Interactive timeline
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            Accident sequence
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Path actions appear automatically. Add officer observations,
            evidence or environmental events at any time.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddEvent}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
        >
          Add event at {currentTime.toFixed(1)}s
        </button>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          <div className="relative h-24 rounded-xl border border-gray-200 bg-gray-50 px-4">
            <div className="absolute left-4 right-4 top-12 h-1 rounded-full bg-gray-300" />

            <div
              className="absolute bottom-2 top-2 w-0.5 bg-red-500"
              style={{
                left: `calc(1rem + ${(currentTime / durationSeconds) * 100}% - ${(currentTime / durationSeconds) * 2}rem)`,
              }}
            >
              <span className="absolute -left-5 -top-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {currentTime.toFixed(1)}s
              </span>
            </div>

            {displayEvents.map((event, index) => {
              const position = Math.min(
                100,
                Math.max(0, (event.timeSeconds / durationSeconds) * 100),
              );

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleEventClick(event)}
                  className="absolute z-10 -translate-x-1/2"
                  style={{
                    left: `calc(1rem + ${position}% - ${position * 0.02}rem)`,
                    top: index % 2 === 0 ? 20 : 49,
                  }}
                  title={`${event.timeSeconds.toFixed(1)}s — ${event.title}`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full border-2 border-white shadow ${
                      selectedEventId === event.id ? "ring-4 ring-blue-300/60" : ""
                    }`}
                    style={{ backgroundColor: getEventColour(event.type) }}
                  />
                </button>
              );
            })}

            <div className="absolute bottom-1 left-4 right-4 flex justify-between text-[10px] font-medium text-gray-500">
              <span>0s</span>
              <span>{durationSeconds.toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
          {displayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => handleEventClick(event)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                selectedEventId === event.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: getEventColour(event.type) }}
              />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-gray-900">
                    {event.timeSeconds.toFixed(1)}s
                  </span>
                  <span className="truncate text-sm font-semibold text-gray-800">
                    {event.title}
                  </span>
                  {event.generated && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                      AUTO
                    </span>
                  )}
                </span>

                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  {event.description || event.type}
                </span>
              </span>
            </button>
          ))}

          {displayEvents.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
              Add participants, movement points or manual events to build the
              accident timeline.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          {!selectedEvent ? (
            <p className="text-sm text-gray-500">
              Select a timeline event to inspect or edit it.
            </p>
          ) : selectedEvent.generated ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Generated from movement path
              </p>
              <h3 className="mt-2 font-bold text-gray-900">
                {selectedEvent.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {selectedEvent.description}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                Edit this event from the participant&apos;s movement point
                controls.
              </p>
            </div>
          ) : selectedManualEvent ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Manual event
                </p>
                <button
                  type="button"
                  onClick={() => deleteManualEvent(selectedManualEvent.id)}
                  className="text-xs font-bold text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">Title</span>
                <input
                  value={selectedManualEvent.title}
                  onChange={(event) =>
                    updateManualEvent(selectedManualEvent.id, {
                      title: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="text-xs font-medium text-gray-600">
                    Time (s)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={durationSeconds}
                    step={0.1}
                    value={Number(selectedManualEvent.timeSeconds.toFixed(1))}
                    onChange={(event) =>
                      updateManualEvent(selectedManualEvent.id, {
                        timeSeconds: Math.min(
                          durationSeconds,
                          Math.max(0, Number(event.target.value)),
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                  />
                </label>

                <label>
                  <span className="text-xs font-medium text-gray-600">Type</span>
                  <select
                    value={selectedManualEvent.type}
                    onChange={(event) =>
                      updateManualEvent(selectedManualEvent.id, {
                        type: event.target.value as TimelineEventType,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">
                  Participant
                </span>
                <select
                  value={selectedManualEvent.participantId ?? ""}
                  onChange={(event) =>
                    updateManualEvent(selectedManualEvent.id, {
                      participantId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                >
                  <option value="">None</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">
                  Scene object
                </span>
                <select
                  value={selectedManualEvent.sceneObjectId ?? ""}
                  onChange={(event) =>
                    updateManualEvent(selectedManualEvent.id, {
                      sceneObjectId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                >
                  <option value="">None</option>
                  {sceneObjects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">
                  Description
                </span>
                <textarea
                  value={selectedManualEvent.description}
                  onChange={(event) =>
                    updateManualEvent(selectedManualEvent.id, {
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}