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
} from "../icons/materialIcons";

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
  positionX?: number;
  positionY?: number;
  rotation?: number;
  speedKmh?: number;
  action?: string;
}

type DopeSheetChannel =
  | "summary"
  | "x"
  | "y"
  | "rotation"
  | "speed"
  | "action"
  | "impact"
  | "evidence"
  | "scene"
  | "object";

type DopeSheetRowKind =
  | "collection"
  | "group"
  | "participant"
  | "channel"
  | "system"
  | "scene-object";

interface DopeSheetRow {
  id: string;
  label: string;
  subtitle?: string;
  depth: number;
  kind: DopeSheetRowKind;
  channel: DopeSheetChannel;
  events: DisplayTimelineEvent[];
  collapsible?: boolean;
}

const EVENT_TYPES: TimelineEventType[] = [
  "Participant Action",
  "Collision",
  "Evidence",
  "Environment",
  "Observation",
];

const ZOOM_LEVELS = [0.75, 1, 1.5, 2.25, 3.5];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function TimelineEventIcon({
  type,
}: {
  type: TimelineEventType;
}) {
  if (type === "Collision") {
    return <TriangleAlert size={9} strokeWidth={3} />;
  }

  if (type === "Evidence") {
    return <FileSearch size={9} strokeWidth={3} />;
  }

  if (
    type === "Environment" ||
    type === "Observation"
  ) {
    return <Camera size={9} strokeWidth={3} />;
  }

  return <Flag size={9} strokeWidth={3} />;
}

function DopeSheetRowIcon({
  row,
}: {
  row: DopeSheetRow;
}) {
  if (row.channel === "impact") {
    return <TriangleAlert size={10} strokeWidth={2.5} />;
  }

  if (row.channel === "evidence") {
    return <FileSearch size={10} strokeWidth={2.5} />;
  }

  if (
    row.channel === "scene" ||
    row.kind === "scene-object"
  ) {
    return <Camera size={10} strokeWidth={2.5} />;
  }

  if (row.kind === "participant") {
    return <CarFront size={10} strokeWidth={2.5} />;
  }

  return <Activity size={9} strokeWidth={2.4} />;
}

function getChannelValue(
  row: DopeSheetRow,
  event: DisplayTimelineEvent,
): string {
  switch (row.channel) {
    case "x":
      return event.positionX === undefined
        ? ""
        : `X ${event.positionX.toFixed(2)}`;

    case "y":
      return event.positionY === undefined
        ? ""
        : `Y ${event.positionY.toFixed(2)}`;

    case "rotation":
      return event.rotation === undefined
        ? ""
        : `${event.rotation.toFixed(1)}°`;

    case "speed":
      return event.speedKmh === undefined
        ? ""
        : `${event.speedKmh.toFixed(1)} km/h`;

    case "action":
      return event.action ?? event.title;

    default:
      return event.title;
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
  const [selectedEventId, setSelectedEventId] =
    useState<string | null>(null);

  const [zoomIndex, setZoomIndex] =
    useState(2);

  const [showGenerated, setShowGenerated] =
    useState(true);

  const [showManual, setShowManual] =
    useState(true);

  /*
   * [RoadSafe:BlenderDopeSheetTimelineV1]
   *
   * The collapsed set keeps the timeline visually dense like Blender's
   * Dope Sheet while leaving the underlying forensic timeline model intact.
   */
  const [collapsedRows, setCollapsedRows] =
    useState<Set<string>>(
      () => new Set(),
    );

  const safeDuration =
    Math.max(0.1, durationSeconds);

  const zoom =
    ZOOM_LEVELS[zoomIndex];

  const trackWidth =
    Math.max(
      960,
      Math.round(
        safeDuration * 110 * zoom,
      ),
    );

  const displayEvents =
    useMemo<DisplayTimelineEvent[]>(
      () => {
        const generated =
          participants.flatMap(
            (participant) =>
              participant.pathPoints.map(
                (point) => ({
                  id: `path:${participant.id}:${point.id}`,
                  timeSeconds:
                    point.timeSeconds,
                  title:
                    point.label ||
                    point.action,
                  description:
                    point.notes ||
                    `${point.action} at ${point.speedKmh.toFixed(0)} km/h`,
                  type:
                    point.action === "Impact"
                      ? ("Collision" as const)
                      : ("Participant Action" as const),
                  participantId:
                    participant.id,
                  sceneObjectId:
                    point.linkedSceneObjectId,
                  pointId: point.id,
                  generated: true,
                  positionX:
                    point.position.x,
                  positionY:
                    point.position.y,
                  rotation:
                    point.rotation,
                  speedKmh:
                    point.speedKmh,
                  action:
                    point.action,
                }),
              ),
          );

        const manual =
          events.map((event) => ({
            ...event,
            generated: false,
          }));

        return [
          ...generated,
          ...manual,
        ]
          .filter((event) =>
            event.generated
              ? showGenerated
              : showManual,
          )
          .sort(
            (first, second) =>
              first.timeSeconds -
              second.timeSeconds,
          );
      },
      [
        events,
        participants,
        showGenerated,
        showManual,
      ],
    );

  const rows =
    useMemo<DopeSheetRow[]>(
      () => {
        const output:
          DopeSheetRow[] = [];

        const collectionCollapsed =
          collapsedRows.has(
            "collection",
          );

        output.push({
          id: "collection",
          label: "Collection",
          subtitle:
            `${participants.length + sceneObjects.length} item(s)`,
          depth: 0,
          kind: "collection",
          channel: "summary",
          events: displayEvents,
          collapsible: true,
        });

        if (collectionCollapsed) {
          return output;
        }

        const participantsCollapsed =
          collapsedRows.has(
            "group:participants",
          );

        output.push({
          id: "group:participants",
          label: "Participants",
          subtitle:
            `${participants.length}`,
          depth: 1,
          kind: "group",
          channel: "summary",
          events: displayEvents.filter(
            (event) =>
              Boolean(
                event.participantId,
              ),
          ),
          collapsible: true,
        });

        if (!participantsCollapsed) {
          for (
            const participant
            of participants
          ) {
            const participantEvents =
              displayEvents.filter(
                (event) =>
                  event.participantId ===
                  participant.id,
              );

            const participantRowId =
              `participant:${participant.id}`;

            output.push({
              id: participantRowId,
              label: participant.name,
              subtitle: participant.type,
              depth: 2,
              kind: "participant",
              channel: "summary",
              events:
                participantEvents,
              collapsible: true,
            });

            if (
              collapsedRows.has(
                participantRowId,
              )
            ) {
              continue;
            }

            const transformsId =
              `transforms:${participant.id}`;

            output.push({
              id: transformsId,
              label: "Object Transforms",
              subtitle:
                `${participant.pathPoints.length} key(s)`,
              depth: 3,
              kind: "group",
              channel: "summary",
              events:
                participantEvents,
              collapsible: true,
            });

            if (
              collapsedRows.has(
                transformsId,
              )
            ) {
              continue;
            }

            const generatedParticipantEvents =
              participantEvents.filter(
                (event) =>
                  event.generated,
              );

            const channelRows:
              Array<{
                channel: DopeSheetChannel;
                label: string;
                events: DisplayTimelineEvent[];
              }> = [
                {
                  channel: "x",
                  label: "X Location",
                  events:
                    generatedParticipantEvents,
                },
                {
                  channel: "y",
                  label: "Y Location",
                  events:
                    generatedParticipantEvents,
                },
                {
                  channel: "rotation",
                  label: "Rotation",
                  events:
                    generatedParticipantEvents,
                },
                {
                  channel: "speed",
                  label: "Speed",
                  events:
                    generatedParticipantEvents,
                },
                {
                  channel: "action",
                  label: "Action / Event",
                  events:
                    participantEvents,
                },
              ];

            for (
              const channelRow
              of channelRows
            ) {
              output.push({
                id:
                  `${participant.id}:${channelRow.channel}`,
                label:
                  channelRow.label,
                depth: 4,
                kind: "channel",
                channel:
                  channelRow.channel,
                events:
                  channelRow.events,
              });
            }
          }
        }

        if (
          sceneObjects.length > 0
        ) {
          const objectsGroupId =
            "group:scene-objects";

          output.push({
            id: objectsGroupId,
            label: "Scene Objects",
            subtitle:
              `${sceneObjects.length}`,
            depth: 1,
            kind: "group",
            channel: "object",
            events: displayEvents.filter(
              (event) =>
                Boolean(
                  event.sceneObjectId,
                ),
            ),
            collapsible: true,
          });

          if (
            !collapsedRows.has(
              objectsGroupId,
            )
          ) {
            for (
              const object
              of sceneObjects
            ) {
              output.push({
                id:
                  `scene-object:${object.id}`,
                label: object.label,
                subtitle: "Scene Object",
                depth: 2,
                kind: "scene-object",
                channel: "object",
                events:
                  displayEvents.filter(
                    (event) =>
                      event.sceneObjectId ===
                      object.id,
                  ),
              });
            }
          }
        }

        const investigationId =
          "group:investigation";

        output.push({
          id: investigationId,
          label: "Investigation",
          subtitle: "Markers",
          depth: 1,
          kind: "group",
          channel: "summary",
          events:
            displayEvents.filter(
              (event) =>
                event.type !==
                "Participant Action",
            ),
          collapsible: true,
        });

        if (
          !collapsedRows.has(
            investigationId,
          )
        ) {
          const impactEvents =
            displayEvents.filter(
              (event) =>
                event.type ===
                "Collision",
            );

          const evidenceEvents =
            displayEvents.filter(
              (event) =>
                event.type ===
                "Evidence",
            );

          const sceneEvents =
            displayEvents.filter(
              (event) =>
                !event.participantId &&
                (
                  event.type ===
                    "Environment" ||
                  event.type ===
                    "Observation"
                ),
            );

          output.push(
            {
              id: "system:impact",
              label: "Impacts",
              subtitle:
                `${impactEvents.length}`,
              depth: 2,
              kind: "system",
              channel: "impact",
              events: impactEvents,
            },
            {
              id: "system:evidence",
              label: "Evidence",
              subtitle:
                `${evidenceEvents.length}`,
              depth: 2,
              kind: "system",
              channel: "evidence",
              events:
                evidenceEvents,
            },
            {
              id: "system:scene",
              label: "Scene Notes",
              subtitle:
                `${sceneEvents.length}`,
              depth: 2,
              kind: "system",
              channel: "scene",
              events: sceneEvents,
            },
          );
        }

        return output;
      },
      [
        collapsedRows,
        displayEvents,
        participants,
        sceneObjects,
      ],
    );

  const selectedEvent =
    displayEvents.find(
      (event) =>
        event.id ===
        selectedEventId,
    );

  const selectedManualEvent =
    selectedEvent &&
    !selectedEvent.generated
      ? events.find(
          (event) =>
            event.id ===
            selectedEvent.id,
        ) ?? null
      : null;

  const tickStep = useMemo(() => {
    const targetTicks =
      Math.max(
        10,
        Math.min(
          32,
          trackWidth / 95,
        ),
      );

    const rawStep =
      safeDuration / targetTicks;

    if (rawStep <= 0.1) return 0.1;
    if (rawStep <= 0.25) return 0.25;
    if (rawStep <= 0.5) return 0.5;
    if (rawStep <= 1) return 1;
    if (rawStep <= 2) return 2;
    if (rawStep <= 5) return 5;
    if (rawStep <= 10) return 10;
    return 15;
  }, [safeDuration, trackWidth]);

  const ticks = useMemo(() => {
    const output: number[] = [];

    for (
      let value = 0;
      value <=
      safeDuration + 0.001;
      value += tickStep
    ) {
      output.push(
        Number(value.toFixed(2)),
      );
    }

    if (
      output[output.length - 1] !==
      safeDuration
    ) {
      output.push(safeDuration);
    }

    return output;
  }, [safeDuration, tickStep]);

  const handleAddEvent = () => {
    const event:
      AccidentTimelineEvent = {
        id: createId(
          "timeline-event",
        ),
        timeSeconds: clamp(
          currentTime,
          0,
          safeDuration,
        ),
        title:
          "New observation",
        description: "",
        type: "Observation",
      };

    onEventsChange([
      ...events,
      event,
    ]);

    setSelectedEventId(
      event.id,
    );
  };

  const updateManualEvent = (
    eventId: string,
    updates:
      Partial<AccidentTimelineEvent>,
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

  const deleteManualEvent = (
    eventId: string,
  ) => {
    onEventsChange(
      events.filter(
        (event) =>
          event.id !== eventId,
      ),
    );

    setSelectedEventId(null);
  };

  const handleEventClick = (
    event: DisplayTimelineEvent,
  ) => {
    setSelectedEventId(
      event.id,
    );

    onSeek(
      event.timeSeconds,
    );

    if (
      event.generated &&
      event.participantId &&
      event.pointId
    ) {
      onSelectParticipantPathPoint(
        event.participantId,
        event.pointId,
      );
    } else if (
      event.sceneObjectId
    ) {
      onSelectSceneObject(
        event.sceneObjectId,
      );
    }
  };

  const seekFromTrack = (
    event:
      ReactPointerEvent<HTMLDivElement>,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const progress = clamp(
      (
        event.clientX -
        rect.left
      ) /
        Math.max(
          1,
          rect.width,
        ),
      0,
      1,
    );

    onSeek(
      progress * safeDuration,
    );
  };

  const handleTrackPointerMove = (
    event:
      ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.buttons !== 1
    ) {
      return;
    }

    seekFromTrack(event);
  };

  const toggleRow = (
    rowId: string,
  ) => {
    setCollapsedRows(
      (current) => {
        const next =
          new Set(current);

        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }

        return next;
      },
    );
  };

  const playheadLeft =
    `${(
      clamp(
        currentTime,
        0,
        safeDuration,
      ) /
      safeDuration
    ) * 100}%`;

  return (
    <section
      className="reconstruction-timeline reconstruction-dopesheet"
      aria-label="Interactive accident dope sheet"
    >
      <header className="reconstruction-dopesheet__toolbar">
        <div className="reconstruction-dopesheet__mode">
          <Activity size={12} />
          <strong>
            Dope Sheet Summary
          </strong>
        </div>

        <div className="reconstruction-dopesheet__toolbar-actions">
          <button
            type="button"
            onClick={() =>
              setShowGenerated(
                (value) => !value,
              )
            }
            className={
              showGenerated
                ? "is-active"
                : ""
            }
            title="Toggle generated movement keys"
          >
            {showGenerated ? (
              <Eye size={12} />
            ) : (
              <EyeOff size={12} />
            )}
            Auto
          </button>

          <button
            type="button"
            onClick={() =>
              setShowManual(
                (value) => !value,
              )
            }
            className={
              showManual
                ? "is-active"
                : ""
            }
            title="Toggle investigator markers"
          >
            {showManual ? (
              <Eye size={12} />
            ) : (
              <EyeOff size={12} />
            )}
            Manual
          </button>

          <span className="reconstruction-dopesheet__separator" />

          <button
            type="button"
            onClick={() =>
              setZoomIndex(
                (value) =>
                  Math.max(
                    0,
                    value - 1,
                  ),
              )
            }
            disabled={
              zoomIndex === 0
            }
            title="Zoom out timeline"
          >
            <ZoomOut size={12} />
          </button>

          <span className="reconstruction-dopesheet__zoom">
            {zoom.toFixed(2)}×
          </span>

          <button
            type="button"
            onClick={() =>
              setZoomIndex(
                (value) =>
                  Math.min(
                    ZOOM_LEVELS.length - 1,
                    value + 1,
                  ),
              )
            }
            disabled={
              zoomIndex ===
              ZOOM_LEVELS.length - 1
            }
            title="Zoom in timeline"
          >
            <ZoomIn size={12} />
          </button>

          <span className="reconstruction-dopesheet__separator" />

          <button
            type="button"
            onClick={handleAddEvent}
            className="is-marker-action"
            title="Add investigator marker at current time"
          >
            <Plus size={12} />
            Marker @ {currentTime.toFixed(1)}s
          </button>
        </div>

        <div className="reconstruction-dopesheet__selection-summary">
          {selectedEvent ? (
            <>
              <TimelineEventIcon
                type={selectedEvent.type}
              />
              <span>
                {selectedEvent.title}
              </span>
              <strong>
                {selectedEvent.timeSeconds.toFixed(2)}s
              </strong>
            </>
          ) : (
            <span>
              Click a keyframe to inspect/select it
            </span>
          )}
        </div>
      </header>

      <div className="reconstruction-dopesheet__viewport">
        <div className="reconstruction-dopesheet__row is-ruler">
          <div className="reconstruction-dopesheet__label is-ruler-label">
            <span className="reconstruction-dopesheet__tree-spacer" />
            <Activity size={10} />
            <strong>Channels</strong>
          </div>

          <div
            className="reconstruction-dopesheet__track is-ruler-track"
            style={{
              width: trackWidth,
            }}
            onPointerDown={seekFromTrack}
            onPointerMove={handleTrackPointerMove}
          >
            {ticks.map((tick) => {
              const left =
                (tick / safeDuration) *
                100;

              return (
                <span
                  key={tick}
                  className="reconstruction-dopesheet__tick-label"
                  style={{
                    left: `${left}%`,
                  }}
                >
                  <i />
                  {tick.toFixed(
                    tickStep < 1
                      ? tickStep < 0.5
                        ? 2
                        : 1
                      : 0,
                  )}
                  s
                </span>
              );
            })}

            <div
              className="reconstruction-dopesheet__playhead is-ruler-playhead"
              style={{
                left: playheadLeft,
              }}
            >
              <span>
                {currentTime.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {rows.map((row) => {
          const collapsed =
            collapsedRows.has(
              row.id,
            );

          return (
            <div
              key={row.id}
              className={[
                "reconstruction-dopesheet__row",
                `is-${row.kind}`,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className="reconstruction-dopesheet__label"
                style={{
                  paddingLeft:
                    `${8 + row.depth * 14}px`,
                }}
              >
                {row.collapsible ? (
                  <button
                    type="button"
                    className="reconstruction-dopesheet__disclosure"
                    onClick={() =>
                      toggleRow(row.id)
                    }
                    aria-label={
                      collapsed
                        ? `Expand ${row.label}`
                        : `Collapse ${row.label}`
                    }
                    title={
                      collapsed
                        ? `Expand ${row.label}`
                        : `Collapse ${row.label}`
                    }
                  >
                    {collapsed
                      ? "▸"
                      : "▾"}
                  </button>
                ) : (
                  <span className="reconstruction-dopesheet__tree-spacer" />
                )}

                <span className="reconstruction-dopesheet__row-icon">
                  <DopeSheetRowIcon
                    row={row}
                  />
                </span>

                <span className="reconstruction-dopesheet__label-text">
                  <strong>
                    {row.label}
                  </strong>

                  {row.subtitle && (
                    <small>
                      {row.subtitle}
                    </small>
                  )}
                </span>
              </div>

              <div
                className="reconstruction-dopesheet__track"
                style={{
                  width: trackWidth,
                }}
                onPointerDown={seekFromTrack}
                onPointerMove={handleTrackPointerMove}
              >
                <span className="reconstruction-dopesheet__baseline" />

                {ticks.map((tick) => (
                  <i
                    key={`${row.id}-${tick}`}
                    className="reconstruction-dopesheet__grid-line"
                    style={{
                      left:
                        `${(tick / safeDuration) * 100}%`,
                    }}
                  />
                ))}

                <div
                  className="reconstruction-dopesheet__playhead"
                  style={{
                    left: playheadLeft,
                  }}
                />

                {row.events.map((event) => {
                  const left =
                    (
                      clamp(
                        event.timeSeconds,
                        0,
                        safeDuration,
                      ) /
                      safeDuration
                    ) * 100;

                  const selected =
                    selectedEventId ===
                    event.id;

                  const valueLabel =
                    getChannelValue(
                      row,
                      event,
                    );

                  return (
                    <button
                      key={`${row.id}:${event.id}`}
                      type="button"
                      className={[
                        "reconstruction-dopesheet__keyframe",
                        selected
                          ? "is-selected"
                          : "",
                        event.generated
                          ? "is-generated"
                          : "is-manual",
                        event.type ===
                        "Collision"
                          ? "is-impact"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        left: `${left}%`,
                      }}
                      onPointerDown={(pointerEvent) =>
                        pointerEvent.stopPropagation()
                      }
                      onClick={() =>
                        handleEventClick(
                          event,
                        )
                      }
                      title={`${event.timeSeconds.toFixed(2)}s — ${row.label}: ${valueLabel}`}
                    >
                      <span />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedManualEvent && (
        <div className="reconstruction-dopesheet__event-editor">
          <label>
            <span>Title</span>
            <input
              value={
                selectedManualEvent.title
              }
              onChange={(event) =>
                updateManualEvent(
                  selectedManualEvent.id,
                  {
                    title:
                      event.target.value,
                  },
                )
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
              value={Number(
                selectedManualEvent.timeSeconds.toFixed(
                  2,
                ),
              )}
              onChange={(event) =>
                updateManualEvent(
                  selectedManualEvent.id,
                  {
                    timeSeconds: clamp(
                      Number(
                        event.target.value,
                      ),
                      0,
                      safeDuration,
                    ),
                  },
                )
              }
            />
          </label>

          <label>
            <span>Type</span>
            <select
              value={
                selectedManualEvent.type
              }
              onChange={(event) =>
                updateManualEvent(
                  selectedManualEvent.id,
                  {
                    type:
                      event.target.value as TimelineEventType,
                  },
                )
              }
            >
              {EVENT_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Participant</span>
            <select
              value={
                selectedManualEvent.participantId ??
                ""
              }
              onChange={(event) =>
                updateManualEvent(
                  selectedManualEvent.id,
                  {
                    participantId:
                      event.target.value ||
                      undefined,
                  },
                )
              }
            >
              <option value="">
                None
              </option>

              {participants.map(
                (participant) => (
                  <option
                    key={participant.id}
                    value={participant.id}
                  >
                    {participant.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Scene object</span>
            <select
              value={
                selectedManualEvent.sceneObjectId ??
                ""
              }
              onChange={(event) =>
                updateManualEvent(
                  selectedManualEvent.id,
                  {
                    sceneObjectId:
                      event.target.value ||
                      undefined,
                  },
                )
              }
            >
              <option value="">
                None
              </option>

              {sceneObjects.map(
                (object) => (
                  <option
                    key={object.id}
                    value={object.id}
                  >
                    {object.label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="is-description">
            <span>Description</span>
            <input
              value={
                selectedManualEvent.description
              }
              onChange={(event) =>
                updateManualEvent(
                  selectedManualEvent.id,
                  {
                    description:
                      event.target.value,
                  },
                )
              }
            />
          </label>

          <button
            type="button"
            className="reconstruction-dopesheet__delete"
            onClick={() =>
              deleteManualEvent(
                selectedManualEvent.id,
              )
            }
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}
    </section>
  );
}
