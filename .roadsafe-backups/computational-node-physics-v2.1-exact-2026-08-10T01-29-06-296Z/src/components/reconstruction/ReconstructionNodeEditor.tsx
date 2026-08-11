import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  Activity,
  Camera,
  ChevronUp,
  Crosshair,
  FileSearch,
  Gauge,
  Layers3,
  Route,
  Ruler,
  Waypoints,
} from "../icons/materialIcons";

import type {
  AccidentReconstruction,
} from "../../types/reconstruction";

import "./reconstructionNodeEditorFunctional.css";

type NodeTarget =
  | "case"
  | "scene"
  | "objects"
  | "evidence"
  | "collision"
  | "physics";

interface ReconstructionNodeEditorProps {
  reconstruction: AccidentReconstruction;
  currentTime: number;
  activeView: "2D" | "3D";
  isPlaying: boolean;
  open: boolean;
  selectedParticipantId: string | null;
  selectedSceneObjectId: string | null;
  onToggle(): void;
  onSelectParticipant(participantId: string): void;
  onSelectSceneObject(objectId: string): void;
  onRunPhysics(): void;
  onPlayPause(): void;
  onSeek(timeSeconds: number): void;
  onSwitchView(view: "2D" | "3D"): void;
  onOpenNodeTarget(target: NodeTarget): void;
}

type NodeKind =
  | "case"
  | "scene"
  | "participant"
  | "objects"
  | "evidence"
  | "collision"
  | "physics"
  | "output";

interface NodePosition {
  x: number;
  y: number;
}

interface NodeDescriptor {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  detail: string;
  defaultPosition: NodePosition;
  selected?: boolean;
  onSelect?: () => void;
}

interface NodeConnection {
  id: string;
  from: string;
  to: string;
  state?: "ready" | "pending" | "warning";
}

interface ManualNodeConnection {
  id: string;
  from: string;
  to: string;
}

interface DragState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: NodePosition;
  moved: boolean;
}

interface PanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
}

interface LinkDraft {
  from: string;
  pointerId: number;
  point: NodePosition;
}

interface StoredGraphState {
  positions?: Record<string, NodePosition>;
  manualConnections?: ManualNodeConnection[];
  zoom?: number;
}

const NODE_WIDTH = 210;
const NODE_HEIGHT = 116;
const LOGICAL_WIDTH = 1420;
const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.55;
const DEFAULT_ZOOM = 0.86;

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

function NodeIcon({
  kind,
}: {
  kind: NodeKind;
}) {
  switch (kind) {
    case "case":
      return <FileSearch size={15} />;
    case "scene":
      return <Layers3 size={15} />;
    case "participant":
      return <Route size={15} />;
    case "objects":
      return <Crosshair size={15} />;
    case "evidence":
      return <Ruler size={15} />;
    case "collision":
      return <Activity size={15} />;
    case "physics":
      return <Gauge size={15} />;
    case "output":
      return <Camera size={15} />;
  }
}

function makeConnectionPath(
  from: NodePosition,
  to: NodePosition,
): string {
  const startX =
    from.x + NODE_WIDTH;

  const startY =
    from.y + NODE_HEIGHT / 2;

  const endX =
    to.x;

  const endY =
    to.y + NODE_HEIGHT / 2;

  const bend =
    Math.max(
      54,
      Math.abs(
        endX - startX,
      ) * 0.42,
    );

  return [
    `M ${startX} ${startY}`,
    `C ${startX + bend} ${startY}`,
    `${endX - bend} ${endY}`,
    `${endX} ${endY}`,
  ].join(" ");
}

function makeDraftConnectionPath(
  from: NodePosition,
  point: NodePosition,
): string {
  const startX =
    from.x + NODE_WIDTH;

  const startY =
    from.y + NODE_HEIGHT / 2;

  const bend =
    Math.max(
      54,
      Math.abs(
        point.x - startX,
      ) * 0.42,
    );

  return [
    `M ${startX} ${startY}`,
    `C ${startX + bend} ${startY}`,
    `${point.x - bend} ${point.y}`,
    `${point.x} ${point.y}`,
  ].join(" ");
}

function isStoredPosition(
  value: unknown,
): value is NodePosition {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Partial<NodePosition>;

  return (
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y)
  );
}

function readStoredGraph(
  key: string,
): StoredGraphState | null {
  try {
    const raw =
      localStorage.getItem(
        key,
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as
        StoredGraphState;

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredGraph(
  key: string,
  state: StoredGraphState,
): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        state,
      ),
    );
  } catch {
    // Node layout is UI metadata only.
    // Reconstruction saving must never fail because this cache is unavailable.
  }
}

/*
 * [RoadSafe:FunctionalReconstructionNodeEditorV1]
 *
 * The forensic reconstruction remains authoritative.
 * System links are derived from case data and cannot be deleted.
 * User-created links are persistent analyst relationships only.
 */
export default function ReconstructionNodeEditor({
  reconstruction,
  currentTime,
  activeView,
  isPlaying,
  open,
  selectedParticipantId,
  selectedSceneObjectId,
  onToggle,
  onSelectParticipant,
  onSelectSceneObject,
  onRunPhysics,
  onPlayPause,
  onSeek,
  onSwitchView,
  onOpenNodeTarget,
}: ReconstructionNodeEditorProps) {
  const viewportRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const dragRef =
    useRef<DragState | null>(
      null,
    );

  const panRef =
    useRef<PanState | null>(
      null,
    );

  const loadedStorageKeyRef =
    useRef<string | null>(
      null,
    );

  const [
    zoom,
    setZoom,
  ] =
    useState(
      DEFAULT_ZOOM,
    );

  const [
    positions,
    setPositions,
  ] =
    useState<
      Record<
        string,
        NodePosition
      >
    >({});

  const [
    manualConnections,
    setManualConnections,
  ] =
    useState<
      ManualNodeConnection[]
    >([]);

  const [
    selectedLinkId,
    setSelectedLinkId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    linkDraft,
    setLinkDraft,
  ] =
    useState<LinkDraft | null>(
      null,
    );

  const [
    panning,
    setPanning,
  ] =
    useState(false);

  const [
    statusMessage,
    setStatusMessage,
  ] =
    useState(
      "System links follow the live reconstruction. Drag an output socket to an input socket to add an analyst link.",
    );

  const storageKey =
    useMemo(
      () =>
        `roadsafe:reconstruction-node-graph:v1:${reconstruction.id}`,
      [
        reconstruction.id,
      ],
    );

  const nodes =
    useMemo<
      NodeDescriptor[]
    >(
      () => {
        const participantNodes =
          reconstruction.vehicles.map(
            (
              participant,
              index,
            ) => ({
              id:
                `participant:${participant.id}`,
              kind:
                "participant" as const,
              title:
                participant.name,
              subtitle:
                participant.type,
              detail:
                `${participant.pathPoints.length} route point(s) · ${participant.estimatedSpeedKmh.toFixed(1)} km/h`,
              defaultPosition: {
                x: 280,
                y:
                  154 +
                  index *
                    132,
              },
              selected:
                selectedParticipantId ===
                participant.id,
              onSelect:
                () =>
                  onSelectParticipant(
                    participant.id,
                  ),
            }),
          );

        const firstSelectedObject =
          reconstruction.sceneObjects.find(
            (object) =>
              object.id ===
              selectedSceneObjectId,
          );

        return [
          {
            id: "case",
            kind:
              "case" as const,
            title:
              reconstruction.accidentId ||
              "Accident case",
            subtitle:
              reconstruction.title ||
              "Reconstruction",
            detail:
              `${reconstruction.durationSeconds.toFixed(1)}s canonical timeline`,
            defaultPosition: {
              x: 32,
              y: 132,
            },
          },
          {
            id: "scene",
            kind:
              "scene" as const,
            title:
              "Scene geometry",
            subtitle:
              reconstruction.scene
                .sceneEnvironment,
            detail:
              `${reconstruction.scene.sceneWidthMetres}m × ${reconstruction.scene.sceneHeightMetres}m`,
            defaultPosition: {
              x: 280,
              y: 26,
            },
          },
          ...participantNodes,
          {
            id: "objects",
            kind:
              "objects" as const,
            title:
              "Objects & hazards",
            subtitle:
              `${reconstruction.sceneObjects.length} placed`,
            detail:
              firstSelectedObject
                ? `Selected: ${firstSelectedObject.label}`
                : "Road, environment and investigation objects",
            defaultPosition: {
              x: 570,
              y: 44,
            },
            selected:
              Boolean(
                firstSelectedObject,
              ),
            onSelect:
              firstSelectedObject
                ? () =>
                    onSelectSceneObject(
                      firstSelectedObject.id,
                    )
                : undefined,
          },
          {
            id: "evidence",
            kind:
              "evidence" as const,
            title:
              "Evidence",
            subtitle:
              `${reconstruction.evidenceRecords.length} record(s)`,
            detail:
              `${reconstruction.measurements.length} measurement(s) · ${reconstruction.photos.length} photo(s)`,
            defaultPosition: {
              x: 570,
              y: 184,
            },
          },
          {
            id: "collision",
            kind:
              "collision" as const,
            title:
              "Primary collision",
            subtitle:
              reconstruction
                .collisionSetup
                ?.confirmed
                ? "Confirmed"
                : "Awaiting confirmation",
            detail:
              `X ${reconstruction.collisionPoint.x.toFixed(1)} · Y ${reconstruction.collisionPoint.y.toFixed(1)}`,
            defaultPosition: {
              x: 570,
              y: 332,
            },
            selected:
              reconstruction
                .collisionSetup
                ?.confirmed,
          },
          {
            id: "physics",
            kind:
              "physics" as const,
            title:
              "Physics solver",
            subtitle:
              reconstruction
                .lastPhysicsSimulation
                ? "Baked"
                : "Not baked",
            detail:
              reconstruction
                .lastPhysicsSimulation
                ? `${reconstruction.lastPhysicsSimulation.participantCollisions} collision(s)`
                : "Run deterministic simulation",
            defaultPosition: {
              x: 880,
              y: 228,
            },
            selected:
              Boolean(
                reconstruction
                  .lastPhysicsSimulation,
              ),
          },
          {
            id: "output",
            kind:
              "output" as const,
            title:
              `${activeView} output`,
            subtitle:
              `${currentTime.toFixed(2)}s / ${reconstruction.durationSeconds.toFixed(1)}s`,
            detail:
              `${reconstruction.timelineEvents.length} timeline event(s)`,
            defaultPosition: {
              x: 1170,
              y: 228,
            },
            selected: true,
          },
        ];
      },
      [
        activeView,
        currentTime,
        onSelectParticipant,
        onSelectSceneObject,
        reconstruction,
        selectedParticipantId,
        selectedSceneObjectId,
      ],
    );

  const nodeSignature =
    useMemo(
      () =>
        nodes
          .map(
            (node) =>
              node.id,
          )
          .join("|"),
      [nodes],
    );

  const nodeIds =
    useMemo(
      () =>
        new Set(
          nodes.map(
            (node) =>
              node.id,
          ),
        ),
      [
        nodeSignature,
        nodes,
      ],
    );

  const systemConnections =
    useMemo<
      NodeConnection[]
    >(
      () => {
        const participantConnections =
          reconstruction.vehicles.flatMap(
            (
              participant,
            ) => [
              {
                id:
                  `scene-to-${participant.id}`,
                from:
                  "scene",
                to:
                  `participant:${participant.id}`,
                state:
                  "ready" as const,
              },
              {
                id:
                  `${participant.id}-to-collision`,
                from:
                  `participant:${participant.id}`,
                to:
                  "collision",
                state:
                  reconstruction
                    .collisionSetup
                    ?.confirmed
                    ? ("ready" as const)
                    : ("pending" as const),
              },
            ],
          );

        return [
          {
            id:
              "case-to-scene",
            from:
              "case",
            to:
              "scene",
            state:
              "ready",
          },
          {
            id:
              "scene-to-objects",
            from:
              "scene",
            to:
              "objects",
            state:
              reconstruction
                .sceneObjects
                .length >
              0
                ? "ready"
                : "pending",
          },
          {
            id:
              "scene-to-evidence",
            from:
              "scene",
            to:
              "evidence",
            state:
              reconstruction
                .evidenceRecords
                .length >
              0
                ? "ready"
                : "pending",
          },
          ...participantConnections,
          {
            id:
              "objects-to-collision",
            from:
              "objects",
            to:
              "collision",
            state:
              reconstruction
                .collisionSetup
                ?.confirmed
                ? "ready"
                : "pending",
          },
          {
            id:
              "evidence-to-collision",
            from:
              "evidence",
            to:
              "collision",
            state:
              reconstruction
                .collisionSetup
                ?.confirmed
                ? "ready"
                : "warning",
          },
          {
            id:
              "collision-to-physics",
            from:
              "collision",
            to:
              "physics",
            state:
              reconstruction
                .lastPhysicsSimulation
                ? "ready"
                : "pending",
          },
          {
            id:
              "physics-to-output",
            from:
              "physics",
            to:
              "output",
            state:
              reconstruction
                .lastPhysicsSimulation
                ? "ready"
                : "pending",
          },
        ];
      },
      [
        reconstruction,
      ],
    );

  const logicalHeight =
    useMemo(
      () =>
        Math.max(
          560,
          202 +
            reconstruction
              .vehicles.length *
              132,
        ),
      [
        reconstruction
          .vehicles.length,
      ],
    );

  useEffect(
    () => {
      const stored =
        readStoredGraph(
          storageKey,
        );

      const nextPositions:
        Record<
          string,
          NodePosition
        > = {};

      nodes.forEach(
        (node) => {
          const storedPosition =
            stored
              ?.positions?.[
                node.id
              ];

          nextPositions[
            node.id
          ] =
            isStoredPosition(
              storedPosition,
            )
              ? {
                  x: clamp(
                    storedPosition.x,
                    0,
                    LOGICAL_WIDTH -
                      NODE_WIDTH,
                  ),
                  y: clamp(
                    storedPosition.y,
                    0,
                    logicalHeight -
                      NODE_HEIGHT,
                  ),
                }
              : node.defaultPosition;
        },
      );

      const restoredLinks =
        (
          stored
            ?.manualConnections ??
          []
        ).filter(
          (connection) =>
            nodeIds.has(
              connection.from,
            ) &&
            nodeIds.has(
              connection.to,
            ) &&
            connection.from !==
              connection.to,
        );

      setPositions(
        nextPositions,
      );

      setManualConnections(
        restoredLinks,
      );

      setSelectedLinkId(
        null,
      );

      setZoom(
        clamp(
          stored?.zoom ??
            DEFAULT_ZOOM,
          MIN_ZOOM,
          MAX_ZOOM,
        ),
      );

      loadedStorageKeyRef.current =
        storageKey;
    },
    [
      storageKey,
      nodeSignature,
    ],
  );

  useEffect(
    () => {
      if (
        loadedStorageKeyRef
          .current !==
        storageKey
      ) {
        return;
      }

      writeStoredGraph(
        storageKey,
        {
          positions,
          manualConnections,
          zoom,
        },
      );
    },
    [
      manualConnections,
      positions,
      storageKey,
      zoom,
    ],
  );

  useEffect(
    () => {
      setManualConnections(
        (current) =>
          current.filter(
            (connection) =>
              nodeIds.has(
                connection.from,
              ) &&
              nodeIds.has(
                connection.to,
              ) &&
              connection.from !==
                connection.to,
          ),
      );
    },
    [
      nodeSignature,
    ],
  );

  const logicalPointFromClient =
    useCallback(
      (
        clientX: number,
        clientY: number,
      ): NodePosition | null => {
        const viewport =
          viewportRef.current;

        if (!viewport) {
          return null;
        }

        const rect =
          viewport.getBoundingClientRect();

        return {
          x:
            (
              clientX -
              rect.left +
              viewport.scrollLeft
            ) /
            zoom,
          y:
            (
              clientY -
              rect.top +
              viewport.scrollTop
            ) /
            zoom,
        };
      },
      [
        zoom,
      ],
    );

  const resetLayout =
    () => {
      const next:
        Record<
          string,
          NodePosition
        > = {};

      nodes.forEach(
        (node) => {
          next[
            node.id
          ] =
            node.defaultPosition;
        },
      );

      setPositions(
        next,
      );

      setZoom(
        DEFAULT_ZOOM,
      );

      setSelectedLinkId(
        null,
      );

      const viewport =
        viewportRef.current;

      if (viewport) {
        viewport.scrollLeft =
          0;

        viewport.scrollTop =
          0;
      }

      setStatusMessage(
        "Node layout reset. Analyst links were preserved.",
      );
    };

  const fitLayout =
    () => {
      const viewport =
        viewportRef.current;

      if (!viewport) {
        return;
      }

      const widthScale =
        (
          viewport.clientWidth -
          30
        ) /
        LOGICAL_WIDTH;

      const heightScale =
        (
          viewport.clientHeight -
          30
        ) /
        logicalHeight;

      setZoom(
        clamp(
          Math.min(
            widthScale,
            heightScale,
          ),
          MIN_ZOOM,
          1,
        ),
      );

      viewport.scrollLeft =
        0;

      viewport.scrollTop =
        0;

      setStatusMessage(
        "Graph fitted to the current node-editor viewport.",
      );
    };

  const clearManualLinks =
    () => {
      setManualConnections(
        [],
      );

      setSelectedLinkId(
        null,
      );

      setStatusMessage(
        "All analyst-created links were removed. System links remain intact.",
      );
    };

  const deleteSelectedLink =
    () => {
      if (!selectedLinkId) {
        return;
      }

      setManualConnections(
        (current) =>
          current.filter(
            (connection) =>
              connection.id !==
              selectedLinkId,
          ),
      );

      setSelectedLinkId(
        null,
      );

      setStatusMessage(
        "Analyst link removed.",
      );
    };

  const handleNodePointerDown =
    (
      event:
        ReactPointerEvent<HTMLElement>,
      nodeId: string,
    ) => {
      if (
        event.button !== 0
      ) {
        return;
      }

      const position =
        positions[
          nodeId
        ];

      if (!position) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      event.currentTarget
        .setPointerCapture(
          event.pointerId,
        );

      dragRef.current = {
        id: nodeId,
        pointerId:
          event.pointerId,
        startClientX:
          event.clientX,
        startClientY:
          event.clientY,
        startPosition:
          position,
        moved: false,
      };
    };

  const handleNodePointerMove =
    (
      event:
        ReactPointerEvent<HTMLElement>,
    ) => {
      const drag =
        dragRef.current;

      if (
        !drag ||
        drag.pointerId !==
          event.pointerId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const deltaX =
        (
          event.clientX -
          drag.startClientX
        ) /
        zoom;

      const deltaY =
        (
          event.clientY -
          drag.startClientY
        ) /
        zoom;

      if (
        Math.abs(
          deltaX,
        ) >
          2 ||
        Math.abs(
          deltaY,
        ) >
          2
      ) {
        drag.moved =
          true;
      }

      setPositions(
        (current) => ({
          ...current,
          [drag.id]: {
            x: clamp(
              drag
                .startPosition
                .x +
                deltaX,
              0,
              LOGICAL_WIDTH -
                NODE_WIDTH,
            ),
            y: clamp(
              drag
                .startPosition
                .y +
                deltaY,
              0,
              logicalHeight -
                NODE_HEIGHT,
            ),
          },
        }),
      );
    };

  const handleNodePointerUp =
    (
      event:
        ReactPointerEvent<HTMLElement>,
      node:
        NodeDescriptor,
    ) => {
      const drag =
        dragRef.current;

      if (
        !drag ||
        drag.pointerId !==
          event.pointerId
      ) {
        return;
      }

      dragRef.current =
        null;

      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId,
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId,
          );
      }

      if (
        !drag.moved
      ) {
        node.onSelect?.();
      }
    };

  const handleViewportPointerDown =
    (
      event:
        ReactPointerEvent<HTMLDivElement>,
    ) => {
      if (
        event.button !== 0 &&
        event.button !== 1 &&
        event.button !== 2
      ) {
        return;
      }

      const target =
        event.target as
          HTMLElement;

      if (
        target.closest(
          ".reconstruction-node",
        ) ||
        target.closest(
          ".reconstruction-node-editor__link",
        )
      ) {
        return;
      }

      event.preventDefault();

      viewportRef.current?.focus();

      event.currentTarget
        .setPointerCapture(
          event.pointerId,
        );

      panRef.current = {
        pointerId:
          event.pointerId,
        startClientX:
          event.clientX,
        startClientY:
          event.clientY,
        startScrollLeft:
          event.currentTarget
            .scrollLeft,
        startScrollTop:
          event.currentTarget
            .scrollTop,
      };

      setPanning(
        true,
      );
    };

  const handleViewportPointerMove =
    (
      event:
        ReactPointerEvent<HTMLDivElement>,
    ) => {
      const pan =
        panRef.current;

      if (
        !pan ||
        pan.pointerId !==
          event.pointerId
      ) {
        return;
      }

      event.preventDefault();

      event.currentTarget
        .scrollLeft =
        pan.startScrollLeft -
        (
          event.clientX -
          pan.startClientX
        );

      event.currentTarget
        .scrollTop =
        pan.startScrollTop -
        (
          event.clientY -
          pan.startClientY
        );
    };

  const endViewportPan =
    (
      event:
        ReactPointerEvent<HTMLDivElement>,
    ) => {
      const pan =
        panRef.current;

      if (
        !pan ||
        pan.pointerId !==
          event.pointerId
      ) {
        return;
      }

      panRef.current =
        null;

      setPanning(
        false,
      );

      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId,
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId,
          );
      }
    };

  const handleWheel =
    (
      event:
        ReactWheelEvent<HTMLDivElement>,
    ) => {
      event.preventDefault();

      const viewport =
        viewportRef.current;

      if (!viewport) {
        return;
      }

      const rect =
        viewport.getBoundingClientRect();

      const pointerX =
        event.clientX -
        rect.left;

      const pointerY =
        event.clientY -
        rect.top;

      const logicalX =
        (
          viewport.scrollLeft +
          pointerX
        ) /
        zoom;

      const logicalY =
        (
          viewport.scrollTop +
          pointerY
        ) /
        zoom;

      const factor =
        event.deltaY < 0
          ? 1.1
          : 0.9;

      const nextZoom =
        clamp(
          zoom * factor,
          MIN_ZOOM,
          MAX_ZOOM,
        );

      if (
        Math.abs(
          nextZoom -
          zoom,
        ) <
        0.0001
      ) {
        return;
      }

      setZoom(
        nextZoom,
      );

      requestAnimationFrame(
        () => {
          viewport.scrollLeft =
            logicalX *
              nextZoom -
            pointerX;

          viewport.scrollTop =
            logicalY *
              nextZoom -
            pointerY;
        },
      );
    };

  const beginLink =
    (
      event:
        ReactPointerEvent<HTMLButtonElement>,
      nodeId: string,
    ) => {
      if (
        event.button !== 0
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const point =
        logicalPointFromClient(
          event.clientX,
          event.clientY,
        );

      if (!point) {
        return;
      }

      viewportRef.current?.focus();

      setSelectedLinkId(
        null,
      );

      setLinkDraft({
        from:
          nodeId,
        pointerId:
          event.pointerId,
        point,
      });

      setStatusMessage(
        "Linking: drag to another node's input socket.",
      );
    };

  useEffect(
    () => {
      if (!linkDraft) {
        return;
      }

      const handleMove =
        (
          event:
            PointerEvent,
        ) => {
          if (
            event.pointerId !==
            linkDraft.pointerId
          ) {
            return;
          }

          const point =
            logicalPointFromClient(
              event.clientX,
              event.clientY,
            );

          if (!point) {
            return;
          }

          setLinkDraft(
            (current) =>
              current
                ? {
                    ...current,
                    point,
                  }
                : current,
          );
        };

      const handleUp =
        (
          event:
            PointerEvent,
        ) => {
          if (
            event.pointerId !==
            linkDraft.pointerId
          ) {
            return;
          }

          const element =
            document.elementFromPoint(
              event.clientX,
              event.clientY,
            ) as
              | HTMLElement
              | null;

          const inputSocket =
            element?.closest(
              "[data-node-input-id]",
            ) as
              | HTMLElement
              | null;

          const to =
            inputSocket
              ?.dataset
              .nodeInputId;

          if (
            !to ||
            to ===
              linkDraft.from
          ) {
            setStatusMessage(
              to ===
                linkDraft.from
                ? "A node cannot be linked to itself."
                : "Link cancelled.",
            );

            setLinkDraft(
              null,
            );

            return;
          }

          const systemDuplicate =
            systemConnections.some(
              (connection) =>
                connection.from ===
                  linkDraft.from &&
                connection.to ===
                  to,
            );

          const manualDuplicate =
            manualConnections.some(
              (connection) =>
                connection.from ===
                  linkDraft.from &&
                connection.to ===
                  to,
            );

          if (
            systemDuplicate ||
            manualDuplicate
          ) {
            setStatusMessage(
              "That connection already exists.",
            );

            setLinkDraft(
              null,
            );

            return;
          }

          const connection:
            ManualNodeConnection = {
              id:
                `manual:${linkDraft.from}:${to}:${Date.now()}`,
              from:
                linkDraft.from,
              to,
            };

          setManualConnections(
            (current) => [
              ...current,
              connection,
            ],
          );

          setSelectedLinkId(
            connection.id,
          );

          setStatusMessage(
            "Analyst relationship created and saved with this node workspace.",
          );

          setLinkDraft(
            null,
          );
        };

      window.addEventListener(
        "pointermove",
        handleMove,
      );

      window.addEventListener(
        "pointerup",
        handleUp,
        {
          once: true,
        },
      );

      window.addEventListener(
        "pointercancel",
        handleUp,
        {
          once: true,
        },
      );

      return () => {
        window.removeEventListener(
          "pointermove",
          handleMove,
        );

        window.removeEventListener(
          "pointerup",
          handleUp,
        );

        window.removeEventListener(
          "pointercancel",
          handleUp,
        );
      };
    },
    [
      linkDraft,
      logicalPointFromClient,
      manualConnections,
      systemConnections,
    ],
  );

  const runPrimaryNodeAction =
    (
      node:
        NodeDescriptor,
    ) => {
      switch (
        node.kind
      ) {
        case "case":
          onOpenNodeTarget(
            "case",
          );
          return;

        case "scene":
          onOpenNodeTarget(
            "scene",
          );
          return;

        case "participant":
          node.onSelect?.();
          return;

        case "objects":
          onOpenNodeTarget(
            "objects",
          );
          return;

        case "evidence":
          onOpenNodeTarget(
            "evidence",
          );
          return;

        case "collision":
          onOpenNodeTarget(
            "collision",
          );
          return;

        case "physics":
          onRunPhysics();
          return;

        case "output":
          onPlayPause();
          return;
      }
    };

  const primaryActionLabel =
    (
      node:
        NodeDescriptor,
    ): string => {
      switch (
        node.kind
      ) {
        case "case":
          return "Open case";
        case "scene":
          return "Scene controls";
        case "participant":
          return "Select";
        case "objects":
          return "Objects";
        case "evidence":
          return "Evidence";
        case "collision":
          return "Impact controls";
        case "physics":
          return reconstruction
            .lastPhysicsSimulation
            ? "Re-run physics"
            : "Run physics";
        case "output":
          return isPlaying
            ? "Pause"
            : "Play";
      }
    };

  const draftFromPosition =
    linkDraft
      ? positions[
          linkDraft.from
        ]
      : undefined;

  return (
    <section
      className={`roadsafe-bottom-panel reconstruction-node-editor ${open ? "is-open" : ""}`}
      aria-label="Reconstruction node editor"
    >
      <header className="roadsafe-bottom-panel__header reconstruction-node-editor__header">
        <button
          type="button"
          className="reconstruction-node-editor__toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <Waypoints
            size={15}
          />

          <span>
            <strong>
              Reconstruction Nodes
            </strong>

            <small>
              Live reconstruction graph
            </small>
          </span>

          <ChevronUp
            size={14}
            className={
              open
                ? ""
                : "is-collapsed"
            }
          />
        </button>

        <div className="reconstruction-node-editor__summary">
          <span>
            {nodes.length} nodes
          </span>

          <span>
            {systemConnections.length} system links
          </span>

          <span>
            {manualConnections.length} analyst links
          </span>

          <span>
            {activeView} view
          </span>
        </div>
      </header>

      {open && (
        <div className="roadsafe-bottom-panel__body reconstruction-node-editor__body">
          <div className="reconstruction-node-editor__toolbar">
            <button
              type="button"
              onClick={fitLayout}
            >
              Fit
            </button>

            <button
              type="button"
              onClick={resetLayout}
            >
              Reset layout
            </button>

            <button
              type="button"
              onClick={clearManualLinks}
              disabled={
                manualConnections.length ===
                0
              }
            >
              Clear analyst links
            </button>

            <button
              type="button"
              onClick={deleteSelectedLink}
              disabled={
                !selectedLinkId
              }
            >
              Delete link
            </button>

            <label>
              <span>
                Zoom
              </span>

              <input
                type="range"
                min={
                  MIN_ZOOM
                }
                max={
                  MAX_ZOOM
                }
                step={0.05}
                value={zoom}
                onChange={(
                  event,
                ) =>
                  setZoom(
                    Number(
                      event
                        .target
                        .value,
                    ),
                  )
                }
              />

              <strong>
                {Math.round(
                  zoom *
                    100,
                )}
                %
              </strong>
            </label>

            <span className="reconstruction-node-editor__status">
              {statusMessage}
            </span>
          </div>

          <div
            ref={viewportRef}
            className={`reconstruction-node-editor__viewport ${panning ? "is-panning" : ""}`}
            tabIndex={0}
            onPointerDown={
              handleViewportPointerDown
            }
            onPointerMove={
              handleViewportPointerMove
            }
            onPointerUp={
              endViewportPan
            }
            onPointerCancel={
              endViewportPan
            }
            onWheel={
              handleWheel
            }
            onContextMenu={(
              event,
            ) =>
              event.preventDefault()
            }
            onKeyDown={(
              event,
            ) => {
              if (
                (
                  event.key ===
                    "Delete" ||
                  event.key ===
                    "Backspace"
                ) &&
                selectedLinkId
              ) {
                event.preventDefault();
                deleteSelectedLink();
              }

              if (
                event.key.toLowerCase() ===
                "f"
              ) {
                event.preventDefault();
                fitLayout();
              }
            }}
          >
            <div
              className="reconstruction-node-editor__canvas"
              style={{
                width:
                  LOGICAL_WIDTH *
                  zoom,
                height:
                  logicalHeight *
                  zoom,
              }}
            >
              <div
                className="reconstruction-node-editor__scale"
                style={{
                  width:
                    LOGICAL_WIDTH,
                  height:
                    logicalHeight,
                  transform:
                    `scale(${zoom})`,
                }}
              >
                <svg
                  className="reconstruction-node-editor__links"
                  width={
                    LOGICAL_WIDTH
                  }
                  height={
                    logicalHeight
                  }
                  viewBox={`0 0 ${LOGICAL_WIDTH} ${logicalHeight}`}
                >
                  {systemConnections.map(
                    (
                      connection,
                    ) => {
                      const from =
                        positions[
                          connection
                            .from
                        ];

                      const to =
                        positions[
                          connection
                            .to
                        ];

                      if (
                        !from ||
                        !to
                      ) {
                        return null;
                      }

                      return (
                        <path
                          key={
                            connection.id
                          }
                          d={makeConnectionPath(
                            from,
                            to,
                          )}
                          className={`reconstruction-node-editor__link is-system is-${connection.state ?? "pending"}`}
                        />
                      );
                    },
                  )}

                  {manualConnections.map(
                    (
                      connection,
                    ) => {
                      const from =
                        positions[
                          connection
                            .from
                        ];

                      const to =
                        positions[
                          connection
                            .to
                        ];

                      if (
                        !from ||
                        !to
                      ) {
                        return null;
                      }

                      return (
                        <path
                          key={
                            connection.id
                          }
                          d={makeConnectionPath(
                            from,
                            to,
                          )}
                          className={`reconstruction-node-editor__link is-manual ${selectedLinkId === connection.id ? "is-selected" : ""}`}
                          onPointerDown={(
                            event,
                          ) => {
                            event.preventDefault();
                            event.stopPropagation();

                            viewportRef.current?.focus();

                            setSelectedLinkId(
                              connection.id,
                            );

                            setStatusMessage(
                              "Analyst link selected. Press Delete or use Delete link.",
                            );
                          }}
                        />
                      );
                    },
                  )}

                  {linkDraft &&
                    draftFromPosition && (
                      <path
                        d={makeDraftConnectionPath(
                          draftFromPosition,
                          linkDraft.point,
                        )}
                        className="reconstruction-node-editor__link-preview"
                      />
                    )}
                </svg>

                {nodes.map(
                  (node) => {
                    const position =
                      positions[
                        node.id
                      ] ??
                      node.defaultPosition;

                    return (
                      <article
                        key={
                          node.id
                        }
                        className={`reconstruction-node is-${node.kind} ${node.selected ? "is-selected" : ""}`}
                        style={{
                          left:
                            position.x,
                          top:
                            position.y,
                        }}
                        tabIndex={0}
                        onClick={() =>
                          node
                            .onSelect?.()
                        }
                        onDoubleClick={() =>
                          runPrimaryNodeAction(
                            node,
                          )
                        }
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.key ===
                              "Enter"
                          ) {
                            event.preventDefault();
                            runPrimaryNodeAction(
                              node,
                            );
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="reconstruction-node__socket reconstruction-node__socket--input"
                          data-node-input-id={
                            node.id
                          }
                          title={`Connect into ${node.title}`}
                          aria-label={`Input socket for ${node.title}`}
                          onPointerDown={(
                            event,
                          ) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(
                            event,
                          ) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        />

                        <header
                          className="reconstruction-node__header reconstruction-node__drag-handle"
                          onPointerDown={(
                            event,
                          ) =>
                            handleNodePointerDown(
                              event,
                              node.id,
                            )
                          }
                          onPointerMove={
                            handleNodePointerMove
                          }
                          onPointerUp={(
                            event,
                          ) =>
                            handleNodePointerUp(
                              event,
                              node,
                            )
                          }
                          onPointerCancel={(
                            event,
                          ) =>
                            handleNodePointerUp(
                              event,
                              node,
                            )
                          }
                        >
                          <NodeIcon
                            kind={
                              node.kind
                            }
                          />

                          <strong>
                            {node.title}
                          </strong>
                        </header>

                        <div className="reconstruction-node__body">
                          <span>
                            {node.subtitle}
                          </span>

                          <small>
                            {node.detail}
                          </small>
                        </div>

                        <div
                          className="reconstruction-node__actions"
                          onPointerDown={(
                            event,
                          ) =>
                            event.stopPropagation()
                          }
                          onClick={(
                            event,
                          ) =>
                            event.stopPropagation()
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              runPrimaryNodeAction(
                                node,
                              )
                            }
                          >
                            {primaryActionLabel(
                              node,
                            )}
                          </button>

                          {node.kind ===
                            "output" && (
                            <>
                              <button
                                type="button"
                                className={
                                  activeView ===
                                  "2D"
                                    ? "is-active"
                                    : ""
                                }
                                onClick={() =>
                                  onSwitchView(
                                    "2D",
                                  )
                                }
                              >
                                2D
                              </button>

                              <button
                                type="button"
                                className={
                                  activeView ===
                                  "3D"
                                    ? "is-active"
                                    : ""
                                }
                                onClick={() =>
                                  onSwitchView(
                                    "3D",
                                  )
                                }
                              >
                                3D
                              </button>

                              <button
                                type="button"
                                title="Jump to start"
                                onClick={() =>
                                  onSeek(
                                    0,
                                  )
                                }
                              >
                                0s
                              </button>

                              <button
                                type="button"
                                title="Jump to end"
                                onClick={() =>
                                  onSeek(
                                    reconstruction
                                      .durationSeconds,
                                  )
                                }
                              >
                                End
                              </button>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`reconstruction-node__socket reconstruction-node__socket--output ${linkDraft?.from === node.id ? "is-linking" : ""}`}
                          title={`Drag to create analyst link from ${node.title}`}
                          aria-label={`Output socket for ${node.title}`}
                          onPointerDown={(
                            event,
                          ) =>
                            beginLink(
                              event,
                              node.id,
                            )
                          }
                          onClick={(
                            event,
                          ) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        />
                      </article>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
