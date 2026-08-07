import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
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

interface ReconstructionNodeEditorProps {
  reconstruction: AccidentReconstruction;
  currentTime: number;
  activeView: "2D" | "3D";
  open: boolean;
  selectedParticipantId: string | null;
  selectedSceneObjectId: string | null;
  onToggle(): void;
  onSelectParticipant(participantId: string): void;
  onSelectSceneObject(objectId: string): void;
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

interface DragState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: NodePosition;
  moved: boolean;
}

const NODE_WIDTH = 190;
const NODE_HEIGHT = 86;
const LOGICAL_WIDTH = 1240;

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
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  const bend = Math.max(
    54,
    Math.abs(endX - startX) * 0.42,
  );

  return [
    `M ${startX} ${startY}`,
    `C ${startX + bend} ${startY}`,
    `${endX - bend} ${endY}`,
    `${endX} ${endY}`,
  ].join(" ");
}

export default function ReconstructionNodeEditor({
  reconstruction,
  currentTime,
  activeView,
  open,
  selectedParticipantId,
  selectedSceneObjectId,
  onToggle,
  onSelectParticipant,
  onSelectSceneObject,
}: ReconstructionNodeEditorProps) {
  const viewportRef =
    useRef<HTMLDivElement | null>(null);

  const dragRef =
    useRef<DragState | null>(null);

  const [zoom, setZoom] =
    useState(0.86);

  const nodes = useMemo<NodeDescriptor[]>(
    () => {
      const participantNodes =
        reconstruction.vehicles.map(
          (participant, index) => ({
            id: `participant:${participant.id}`,
            kind: "participant" as const,
            title: participant.name,
            subtitle: participant.type,
            detail:
              `${participant.pathPoints.length} route point(s) · ${participant.estimatedSpeedKmh.toFixed(1)} km/h`,
            defaultPosition: {
              x: 270,
              y: 150 + index * 104,
            },
            selected:
              selectedParticipantId ===
              participant.id,
            onSelect: () =>
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
          kind: "case",
          title:
            reconstruction.accidentId ||
            "Accident case",
          subtitle:
            reconstruction.title ||
            "Reconstruction",
          detail:
            `${reconstruction.durationSeconds.toFixed(1)}s canonical timeline`,
          defaultPosition: {
            x: 28,
            y: 126,
          },
        },
        {
          id: "scene",
          kind: "scene",
          title: "Scene geometry",
          subtitle:
            reconstruction.scene.sceneEnvironment,
          detail:
            `${reconstruction.scene.sceneWidthMetres}m × ${reconstruction.scene.sceneHeightMetres}m`,
          defaultPosition: {
            x: 270,
            y: 32,
          },
        },
        ...participantNodes,
        {
          id: "objects",
          kind: "objects",
          title: "Objects & hazards",
          subtitle:
            `${reconstruction.sceneObjects.length} placed`,
          detail:
            firstSelectedObject
              ? `Selected: ${firstSelectedObject.label}`
              : "Road, environment and investigation objects",
          defaultPosition: {
            x: 530,
            y: 42,
          },
          selected:
            Boolean(firstSelectedObject),
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
          kind: "evidence",
          title: "Evidence",
          subtitle:
            `${reconstruction.evidenceRecords.length} record(s)`,
          detail:
            `${reconstruction.measurements.length} measurement(s) · ${reconstruction.photos.length} photo(s)`,
          defaultPosition: {
            x: 530,
            y: 154,
          },
        },
        {
          id: "collision",
          kind: "collision",
          title: "Primary collision",
          subtitle:
            reconstruction.collisionSetup
              ?.confirmed
              ? "Confirmed"
              : "Awaiting confirmation",
          detail:
            `X ${reconstruction.collisionPoint.x.toFixed(1)} · Y ${reconstruction.collisionPoint.y.toFixed(1)}`,
          defaultPosition: {
            x: 530,
            y: 282,
          },
          selected:
            reconstruction.collisionSetup
              ?.confirmed,
        },
        {
          id: "physics",
          kind: "physics",
          title: "Physics solver",
          subtitle:
            reconstruction.lastPhysicsSimulation
              ? "Baked"
              : "Not baked",
          detail:
            reconstruction.lastPhysicsSimulation
              ? `${reconstruction.lastPhysicsSimulation.participantCollisions} collision(s)`
              : "Run deterministic simulation",
          defaultPosition: {
            x: 794,
            y: 190,
          },
          selected:
            Boolean(
              reconstruction.lastPhysicsSimulation,
            ),
        },
        {
          id: "output",
          kind: "output",
          title: `${activeView} output`,
          subtitle:
            `${currentTime.toFixed(2)}s / ${reconstruction.durationSeconds.toFixed(1)}s`,
          detail:
            `${reconstruction.timelineEvents.length} timeline event(s)`,
          defaultPosition: {
            x: 1030,
            y: 190,
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

  const nodeSignature = useMemo(
    () =>
      nodes
        .map((node) => node.id)
        .join("|"),
    [nodes],
  );

  const [positions, setPositions] =
    useState<Record<string, NodePosition>>(
      {},
    );

  useEffect(() => {
    setPositions((current) => {
      const next: Record<
        string,
        NodePosition
      > = {};

      nodes.forEach((node) => {
        next[node.id] =
          current[node.id] ??
          node.defaultPosition;
      });

      return next;
    });
  }, [nodeSignature, nodes]);

  const connections = useMemo<
    NodeConnection[]
  >(() => {
    const participantConnections =
      reconstruction.vehicles.flatMap(
        (participant) => [
          {
            id: `scene-to-${participant.id}`,
            from: "scene",
            to: `participant:${participant.id}`,
            state: "ready" as const,
          },
          {
            id: `${participant.id}-to-collision`,
            from: `participant:${participant.id}`,
            to: "collision",
            state:
              reconstruction.collisionSetup
                ?.confirmed
                ? ("ready" as const)
                : ("pending" as const),
          },
        ],
      );

    return [
      {
        id: "case-to-scene",
        from: "case",
        to: "scene",
        state: "ready",
      },
      {
        id: "scene-to-objects",
        from: "scene",
        to: "objects",
        state:
          reconstruction.sceneObjects.length >
          0
            ? "ready"
            : "pending",
      },
      {
        id: "scene-to-evidence",
        from: "scene",
        to: "evidence",
        state:
          reconstruction.evidenceRecords
            .length > 0
            ? "ready"
            : "pending",
      },
      ...participantConnections,
      {
        id: "objects-to-collision",
        from: "objects",
        to: "collision",
        state: "pending",
      },
      {
        id: "evidence-to-collision",
        from: "evidence",
        to: "collision",
        state:
          reconstruction.collisionSetup
            ?.confirmed
            ? "ready"
            : "warning",
      },
      {
        id: "collision-to-physics",
        from: "collision",
        to: "physics",
        state:
          reconstruction.lastPhysicsSimulation
            ? "ready"
            : "pending",
      },
      {
        id: "physics-to-output",
        from: "physics",
        to: "output",
        state:
          reconstruction.lastPhysicsSimulation
            ? "ready"
            : "pending",
      },
    ];
  }, [reconstruction]);

  const logicalHeight = useMemo(
    () =>
      Math.max(
        470,
        170 +
          reconstruction.vehicles.length *
            104,
      ),
    [reconstruction.vehicles.length],
  );

  const resetLayout = () => {
    const next: Record<
      string,
      NodePosition
    > = {};

    nodes.forEach((node) => {
      next[node.id] =
        node.defaultPosition;
    });

    setPositions(next);
    setZoom(0.86);

    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  };

  const fitLayout = () => {
    const viewport =
      viewportRef.current;

    if (!viewport) {
      return;
    }

    const widthScale =
      (viewport.clientWidth - 28) /
      LOGICAL_WIDTH;

    const heightScale =
      (viewport.clientHeight - 28) /
      logicalHeight;

    setZoom(
      clamp(
        Math.min(
          widthScale,
          heightScale,
        ),
        0.5,
        1,
      ),
    );

    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    nodeId: string,
  ) => {
    if (
      event.button !== 0
    ) {
      return;
    }

    const position =
      positions[nodeId];

    if (!position) {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    dragRef.current = {
      id: nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: position,
      moved: false,
    };
  };

  const handleNodePointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const deltaX =
      (event.clientX -
        drag.startClientX) /
      zoom;

    const deltaY =
      (event.clientY -
        drag.startClientY) /
      zoom;

    if (
      Math.abs(deltaX) > 2 ||
      Math.abs(deltaY) > 2
    ) {
      drag.moved = true;
    }

    setPositions((current) => ({
      ...current,
      [drag.id]: {
        x: clamp(
          drag.startPosition.x +
            deltaX,
          0,
          LOGICAL_WIDTH -
            NODE_WIDTH,
        ),
        y: clamp(
          drag.startPosition.y +
            deltaY,
          0,
          logicalHeight -
            NODE_HEIGHT,
        ),
      },
    }));
  };

  const handleNodePointerUp = (
    event: ReactPointerEvent<HTMLElement>,
    node: NodeDescriptor,
  ) => {
    const drag = dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    dragRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    if (!drag.moved) {
      node.onSelect?.();
    }
  };

  return (
    <section
      className={`roadsafe-bottom-panel reconstruction-node-editor ${
        open ? "is-open" : ""
      }`}
      aria-label="Reconstruction node editor"
    >
      <header className="roadsafe-bottom-panel__header reconstruction-node-editor__header">
        <button
          type="button"
          className="reconstruction-node-editor__toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <Waypoints size={15} />
          <span>
            <strong>Reconstruction Nodes</strong>
            <small>
              Scene, evidence, impact,
              physics and output graph
            </small>
          </span>
          <ChevronUp
            size={14}
            className={
              open ? "" : "is-collapsed"
            }
          />
        </button>

        <div className="reconstruction-node-editor__summary">
          <span>
            {nodes.length} nodes
          </span>
          <span>
            {connections.length} links
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
            <label>
              <span>Zoom</span>
              <input
                type="range"
                min={0.5}
                max={1.25}
                step={0.05}
                value={zoom}
                onChange={(event) =>
                  setZoom(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
              <strong>
                {Math.round(zoom * 100)}%
              </strong>
            </label>
          </div>

          <div
            ref={viewportRef}
            className="reconstruction-node-editor__viewport"
          >
            <div
              className="reconstruction-node-editor__canvas"
              style={{
                width:
                  LOGICAL_WIDTH * zoom,
                height:
                  logicalHeight * zoom,
              }}
            >
              <div
                className="reconstruction-node-editor__scale"
                style={{
                  width: LOGICAL_WIDTH,
                  height: logicalHeight,
                  transform:
                    `scale(${zoom})`,
                }}
              >
                <svg
                  className="reconstruction-node-editor__links"
                  width={LOGICAL_WIDTH}
                  height={logicalHeight}
                  viewBox={`0 0 ${LOGICAL_WIDTH} ${logicalHeight}`}
                  aria-hidden="true"
                >
                  {connections.map(
                    (connection) => {
                      const from =
                        positions[
                          connection.from
                        ];

                      const to =
                        positions[
                          connection.to
                        ];

                      if (!from || !to) {
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
                          className={`reconstruction-node-editor__link is-${
                            connection.state ??
                            "pending"
                          }`}
                        />
                      );
                    },
                  )}
                </svg>

                {nodes.map((node) => {
                  const position =
                    positions[node.id] ??
                    node.defaultPosition;

                  return (
                    <article
                      key={node.id}
                      className={`reconstruction-node is-${node.kind} ${
                        node.selected
                          ? "is-selected"
                          : ""
                      }`}
                      style={{
                        left: position.x,
                        top: position.y,
                      }}
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
                      onPointerUp={(event) =>
                        handleNodePointerUp(
                          event,
                          node,
                        )
                      }
                      onPointerCancel={(event) =>
                        handleNodePointerUp(
                          event,
                          node,
                        )
                      }
                      tabIndex={0}
                      role={
                        node.onSelect
                          ? "button"
                          : undefined
                      }
                      onKeyDown={(event) => {
                        if (
                          node.onSelect &&
                          (event.key ===
                            "Enter" ||
                            event.key === " ")
                        ) {
                          event.preventDefault();
                          node.onSelect();
                        }
                      }}
                    >
                      <span className="reconstruction-node__socket reconstruction-node__socket--input" />

                      <header className="reconstruction-node__header">
                        <NodeIcon
                          kind={node.kind}
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

                      <span className="reconstruction-node__socket reconstruction-node__socket--output" />
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
