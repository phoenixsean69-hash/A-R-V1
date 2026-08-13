import {
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
  ParticipantPhysicsProfile,
  ReconstructionPhysicsSettings,
  SceneObjectPhysicsProfile,
} from "../../types/reconstruction";

import {
  DEFAULT_PHYSICS_SETTINGS,
  getDefaultParticipantPhysics,
  getDefaultSceneObjectPhysics,
} from "../../services/reconstructionPhysicsService";

import {
  getSceneObjectEffectiveMassKg,
} from "../../utils/reconstructionPhysicsDefaults";

import BufferedCommitInput from "./BufferedCommitInput";

import "./reconstructionNodeEditorFunctional.css";

type NodeTarget =
  | "case"
  | "scene"
  | "objects"
  | "evidence"
  | "collision"
  | "physics";

interface Props {
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
  onReconstructionChange(
    updates: Partial<AccidentReconstruction>,
  ): void;
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

type PortType =
  | "CASE"
  | "SCENE"
  | "BODY"
  | "OBJECT"
  | "EVIDENCE"
  | "IMPACT"
  | "SIM"
  | "VIEW";

interface NodePosition {
  x: number;
  y: number;
}

interface NodeDescriptor {
  id: string;
  kind: NodeKind;
  portType: PortType;
  title: string;
  subtitle: string;
  detail: string;
  defaultPosition: NodePosition;
  height: number;
  selected?: boolean;
  onSelect?: () => void;
}

interface NodeConnection {
  id: string;
  from: string;
  to: string;
  state: "ready" | "pending" | "warning" | "dirty";
}

interface ManualConnection {
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

interface StoredGraph {
  positions?: Record<string, NodePosition>;
  manualConnections?: ManualConnection[];
  zoom?: number;
  objectNodeSelectionId?: string | null;
}

const NODE_WIDTH = 246;
const LOGICAL_WIDTH = 1600;
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.45;
const DEFAULT_ZOOM = 0.78;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function numeric(raw: string, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function NodeIcon({ kind }: { kind: NodeKind }) {
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

function resolvedParticipantPhysics(
  participant: AccidentReconstruction["vehicles"][number],
): ParticipantPhysicsProfile {
  return {
    ...getDefaultParticipantPhysics(participant),
    ...(participant.physics ?? {}),
  };
}

function resolvedObjectPhysics(
  object: AccidentReconstruction["sceneObjects"][number],
): SceneObjectPhysicsProfile {
  return {
    ...getDefaultSceneObjectPhysics(object),
    massKg: getSceneObjectEffectiveMassKg(object),
    ...(object.physics ?? {}),
  };
}

function connectionPath(
  fromPosition: NodePosition,
  fromNode: NodeDescriptor,
  toPosition: NodePosition,
  toNode: NodeDescriptor,
) {
  const startX = fromPosition.x + NODE_WIDTH;
  const startY = fromPosition.y + fromNode.height / 2;
  const endX = toPosition.x;
  const endY = toPosition.y + toNode.height / 2;
  const bend = Math.max(60, Math.abs(endX - startX) * 0.42);

  return [
    `M ${startX} ${startY}`,
    `C ${startX + bend} ${startY}`,
    `${endX - bend} ${endY}`,
    `${endX} ${endY}`,
  ].join(" ");
}

function draftPath(
  fromPosition: NodePosition,
  fromNode: NodeDescriptor,
  point: NodePosition,
) {
  const startX = fromPosition.x + NODE_WIDTH;
  const startY = fromPosition.y + fromNode.height / 2;
  const bend = Math.max(60, Math.abs(point.x - startX) * 0.42);

  return [
    `M ${startX} ${startY}`,
    `C ${startX + bend} ${startY}`,
    `${point.x - bend} ${point.y}`,
    `${point.x} ${point.y}`,
  ].join(" ");
}

function canConnect(from: PortType, to: PortType) {
  const allowed: Record<PortType, PortType[]> = {
    CASE: ["SCENE"],
    SCENE: ["BODY", "OBJECT", "EVIDENCE", "IMPACT"],
    BODY: ["IMPACT", "SIM", "VIEW"],
    OBJECT: ["IMPACT", "SIM"],
    EVIDENCE: ["BODY", "OBJECT", "IMPACT"],
    IMPACT: ["SIM", "VIEW"],
    SIM: ["VIEW"],
    VIEW: [],
  };

  return allowed[from].includes(to);
}

function readStored(key: string): StoredGraph | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredGraph) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredGraph) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // UI layout persistence is never allowed to block forensic work.
  }
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange(value: number): void;
}) {
  return (
    <label>
      <span>{label}</span>
      <BufferedCommitInput
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) =>
          onChange(numeric(event.target.value, value))
        }
      />
    </label>
  );
}

/*
 * [RoadSafe:ComputationalNodeGraphV2]
 *
 * System links are the executable dependency graph.
 * Node parameter edits write directly to canonical reconstruction state.
 * Physical-input edits invalidate lastPhysicsSimulation, marking Physics and
 * Output dirty until the deterministic solver is run again.
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
  onReconstructionChange,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [positions, setPositions] =
    useState<Record<string, NodePosition>>({});
  const [manualConnections, setManualConnections] =
    useState<ManualConnection[]>([]);
  const [selectedLinkId, setSelectedLinkId] =
    useState<string | null>(null);
  const [linkDraft, setLinkDraft] =
    useState<LinkDraft | null>(null);
  const [panning, setPanning] = useState(false);
  const [objectNodeSelectionId, setObjectNodeSelectionId] =
    useState<string | null>(selectedSceneObjectId);
  const [status, setStatus] =
    useState("Edit canonical inputs; Physics becomes DIRTY until re-run.");

  const storageKey =
    `roadsafe:reconstruction-node-graph:v2:${reconstruction.id}`;

  useEffect(() => {
    if (selectedSceneObjectId) {
      setObjectNodeSelectionId(selectedSceneObjectId);
    }
  }, [selectedSceneObjectId]);

  useEffect(() => {
    if (!objectNodeSelectionId && reconstruction.sceneObjects[0]) {
      setObjectNodeSelectionId(reconstruction.sceneObjects[0].id);
    }
  }, [objectNodeSelectionId, reconstruction.sceneObjects]);

  const activeObject = useMemo(
    () =>
      reconstruction.sceneObjects.find(
        (object) => object.id === objectNodeSelectionId,
      ) ??
      reconstruction.sceneObjects[0] ??
      null,
    [objectNodeSelectionId, reconstruction.sceneObjects],
  );

  const nodes = useMemo<NodeDescriptor[]>(() => {
    const participantNodes = reconstruction.vehicles.map(
      (participant, index) => {
        const profile = resolvedParticipantPhysics(participant);
        const speed =
          profile.inputSpeedKmh ?? participant.estimatedSpeedKmh;

        return {
          id: `participant:${participant.id}`,
          kind: "participant" as const,
          portType: "BODY" as const,
          title: participant.name,
          subtitle: participant.type,
          detail: `${speed.toFixed(1)} km/h · ${profile.massKg.toFixed(0)} kg`,
          height: 292,
          defaultPosition: {
            x: 300,
            y: 165 + index * 314,
          },
          selected: selectedParticipantId === participant.id,
          onSelect: () => onSelectParticipant(participant.id),
        };
      },
    );

    return [
      {
        id: "case",
        kind: "case",
        portType: "CASE",
        title: reconstruction.accidentId || "Accident case",
        subtitle: reconstruction.title || "Reconstruction",
        detail: `${reconstruction.durationSeconds.toFixed(1)}s canonical timeline`,
        height: 116,
        defaultPosition: { x: 28, y: 220 },
      },
      {
        id: "scene",
        kind: "scene",
        portType: "SCENE",
        title: "Scene geometry",
        subtitle: reconstruction.scene.sceneEnvironment,
        detail:
          `${reconstruction.scene.sceneWidthMetres}m × ` +
          `${reconstruction.scene.sceneHeightMetres}m`,
        height: 116,
        defaultPosition: { x: 300, y: 28 },
      },
      ...participantNodes,
      {
        id: "objects",
        kind: "objects",
        portType: "OBJECT",
        title: "Objects & hazards",
        subtitle: `${reconstruction.sceneObjects.length} placed`,
        detail: activeObject
          ? `${activeObject.label} · ${activeObject.type}`
          : "No object selected",
        height: 304,
        defaultPosition: { x: 632, y: 34 },
        selected:
          Boolean(activeObject) &&
          selectedSceneObjectId === activeObject?.id,
        onSelect: activeObject
          ? () => onSelectSceneObject(activeObject.id)
          : undefined,
      },
      {
        id: "evidence",
        kind: "evidence",
        portType: "EVIDENCE",
        title: "Evidence",
        subtitle: `${reconstruction.evidenceRecords.length} record(s)`,
        detail:
          `${reconstruction.measurements.length} measurement(s) · ` +
          `${reconstruction.photos.length} photo(s)`,
        height: 116,
        defaultPosition: { x: 632, y: 360 },
      },
      {
        id: "collision",
        kind: "collision",
        portType: "IMPACT",
        title: "Primary collision",
        subtitle: reconstruction.collisionSetup?.confirmed
          ? "Confirmed"
          : "Awaiting confirmation",
        detail:
          `X ${reconstruction.collisionPoint.x.toFixed(1)} · ` +
          `Y ${reconstruction.collisionPoint.y.toFixed(1)}`,
        height: 116,
        defaultPosition: { x: 632, y: 505 },
        selected: reconstruction.collisionSetup?.confirmed,
      },
      {
        id: "physics",
        kind: "physics",
        portType: "SIM",
        title: "Physics solver",
        subtitle: reconstruction.lastPhysicsSimulation
          ? "Baked"
          : "DIRTY · rerun required",
        detail: reconstruction.lastPhysicsSimulation
          ? `${reconstruction.lastPhysicsSimulation.participantCollisions} collision(s)`
          : "Canonical input changed",
        height: 286,
        defaultPosition: { x: 965, y: 210 },
        selected: Boolean(reconstruction.lastPhysicsSimulation),
      },
      {
        id: "output",
        kind: "output",
        portType: "VIEW",
        title: `${activeView} output`,
        subtitle:
          `${currentTime.toFixed(2)}s / ` +
          `${reconstruction.durationSeconds.toFixed(1)}s`,
        detail: reconstruction.lastPhysicsSimulation
          ? "Physics output current"
          : "Physics output stale",
        height: 176,
        defaultPosition: { x: 1290, y: 265 },
        selected: true,
      },
    ];
  }, [
    activeObject,
    activeView,
    currentTime,
    onSelectParticipant,
    onSelectSceneObject,
    reconstruction,
    selectedParticipantId,
    selectedSceneObjectId,
  ]);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const nodeSignature = nodes
    .map((node) => `${node.id}:${node.height}`)
    .join("|");

  const logicalHeight = Math.max(
    720,
    210 + reconstruction.vehicles.length * 314,
  );

  const systemConnections = useMemo<NodeConnection[]>(() => {
    const dirty = !reconstruction.lastPhysicsSimulation;

    return [
      {
        id: "case-scene",
        from: "case",
        to: "scene",
        state: "ready",
      },
      ...reconstruction.vehicles.flatMap((participant) => [
        {
          id: `scene-${participant.id}`,
          from: "scene",
          to: `participant:${participant.id}`,
          state: "ready" as const,
        },
        {
          id: `${participant.id}-impact`,
          from: `participant:${participant.id}`,
          to: "collision",
          state: reconstruction.collisionSetup?.confirmed
            ? ("ready" as const)
            : ("pending" as const),
        },
      ]),
      {
        id: "scene-objects",
        from: "scene",
        to: "objects",
        state: reconstruction.sceneObjects.length ? "ready" : "pending",
      },
      {
        id: "scene-evidence",
        from: "scene",
        to: "evidence",
        state: reconstruction.evidenceRecords.length ? "ready" : "pending",
      },
      {
        id: "objects-impact",
        from: "objects",
        to: "collision",
        state: "ready",
      },
      {
        id: "evidence-impact",
        from: "evidence",
        to: "collision",
        state: reconstruction.collisionSetup?.confirmed
          ? "ready"
          : "warning",
      },
      {
        id: "impact-physics",
        from: "collision",
        to: "physics",
        state: dirty ? "dirty" : "ready",
      },
      {
        id: "physics-output",
        from: "physics",
        to: "output",
        state: dirty ? "dirty" : "ready",
      },
    ];
  }, [reconstruction]);

  useEffect(() => {
    const stored = readStored(storageKey);
    const next: Record<string, NodePosition> = {};

    nodes.forEach((node) => {
      const saved = stored?.positions?.[node.id];

      next[node.id] =
        saved &&
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y)
          ? {
              x: clamp(saved.x, 0, LOGICAL_WIDTH - NODE_WIDTH),
              y: clamp(saved.y, 0, logicalHeight - node.height),
            }
          : node.defaultPosition;
    });

    setPositions(next);
    setManualConnections(
      (stored?.manualConnections ?? []).filter(
        (connection) =>
          nodeById.has(connection.from) &&
          nodeById.has(connection.to),
      ),
    );
    setZoom(
      clamp(
        stored?.zoom ?? DEFAULT_ZOOM,
        MIN_ZOOM,
        MAX_ZOOM,
      ),
    );

    if (stored?.objectNodeSelectionId) {
      setObjectNodeSelectionId(stored.objectNodeSelectionId);
    }

    loadedKeyRef.current = storageKey;
  }, [storageKey, nodeSignature]);

  useEffect(() => {
    if (loadedKeyRef.current !== storageKey) return;

    writeStored(storageKey, {
      positions,
      manualConnections,
      zoom,
      objectNodeSelectionId,
    });
  }, [
    manualConnections,
    objectNodeSelectionId,
    positions,
    storageKey,
    zoom,
  ]);

  const invalidate = (
    updates: Partial<AccidentReconstruction>,
    message: string,
  ) => {
    onReconstructionChange({
      ...updates,
      lastPhysicsSimulation: undefined,
    });
    setStatus(`${message} · Physics DIRTY`);
  };

  const updateParticipantSpeed = (
    participantId: string,
    speedKmh: number,
  ) => {
    const speed = clamp(speedKmh, 0, 250);

    invalidate(
      {
        vehicles: reconstruction.vehicles.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                estimatedSpeedKmh: speed,
                physics: {
                  ...resolvedParticipantPhysics(participant),
                  inputSpeedKmh: speed,
                },
              }
            : participant,
        ),
      },
      `Speed ${speed.toFixed(1)} km/h`,
    );
  };

  const updateParticipantPhysics = (
    participantId: string,
    updates: Partial<ParticipantPhysicsProfile>,
  ) =>
    invalidate(
      {
        vehicles: reconstruction.vehicles.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                physics: {
                  ...resolvedParticipantPhysics(participant),
                  ...updates,
                },
              }
            : participant,
        ),
      },
      "Participant physics updated",
    );

  const updateObjectPhysics = (
    objectId: string,
    updates: Partial<SceneObjectPhysicsProfile>,
  ) =>
    invalidate(
      {
        sceneObjects: reconstruction.sceneObjects.map((object) =>
          object.id === objectId
            ? {
                ...object,
                physics: {
                  ...resolvedObjectPhysics(object),
                  ...updates,
                },
              }
            : object,
        ),
      },
      "Object physics updated",
    );

  const settings: ReconstructionPhysicsSettings = {
    ...DEFAULT_PHYSICS_SETTINGS,
    ...(reconstruction.physicsSettings ?? {}),
  };

  const updateGlobalPhysics = (
    updates: Partial<ReconstructionPhysicsSettings>,
  ) =>
    invalidate(
      {
        physicsSettings: {
          ...settings,
          ...updates,
        },
      },
      "Solver settings updated",
    );

  const resetLayout = () => {
    setPositions(
      Object.fromEntries(
        nodes.map((node) => [node.id, node.defaultPosition]),
      ),
    );
    setZoom(DEFAULT_ZOOM);
    setStatus("Layout reset.");
  };

  const fitLayout = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    setZoom(
      clamp(
        Math.min(
          (viewport.clientWidth - 24) / LOGICAL_WIDTH,
          (viewport.clientHeight - 24) / logicalHeight,
        ),
        MIN_ZOOM,
        1,
      ),
    );
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    setStatus("Graph fitted.");
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    node: NodeDescriptor,
  ) => {
    if (event.button !== 0) return;

    const start = positions[node.id];
    if (!start) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: start,
    };
  };

  const handleNodePointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const node = nodeById.get(drag.id);
    if (!node) return;

    const dx = (event.clientX - drag.startClientX) / zoom;
    const dy = (event.clientY - drag.startClientY) / zoom;

    setPositions((current) => ({
      ...current,
      [drag.id]: {
        x: clamp(
          drag.startPosition.x + dx,
          0,
          LOGICAL_WIDTH - NODE_WIDTH,
        ),
        y: clamp(
          drag.startPosition.y + dy,
          0,
          logicalHeight - node.height,
        ),
      },
    }));
  };

  const handleNodePointerUp = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleViewportPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (![0, 1, 2].includes(event.button)) return;

    const target = event.target as HTMLElement;
    if (
      target.closest(".reconstruction-node") ||
      target.closest(".reconstruction-node-editor__link")
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      startScrollTop: event.currentTarget.scrollTop,
    };
    setPanning(true);
  };

  const handleViewportPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;

    event.currentTarget.scrollLeft =
      pan.startScrollLeft - (event.clientX - pan.startClientX);
    event.currentTarget.scrollTop =
      pan.startScrollTop - (event.clientY - pan.startClientY);
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;

    panRef.current = null;
    setPanning(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (
    event: ReactWheelEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const logicalX = (viewport.scrollLeft + px) / zoom;
    const logicalY = (viewport.scrollTop + py) / zoom;
    const nextZoom = clamp(
      zoom * (event.deltaY < 0 ? 1.1 : 0.9),
      MIN_ZOOM,
      MAX_ZOOM,
    );

    setZoom(nextZoom);

    requestAnimationFrame(() => {
      viewport.scrollLeft = logicalX * nextZoom - px;
      viewport.scrollTop = logicalY * nextZoom - py;
    });
  };

  const logicalPoint = (
    clientX: number,
    clientY: number,
  ): NodePosition | null => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();

    return {
      x:
        (clientX - rect.left + viewport.scrollLeft) /
        zoom,
      y:
        (clientY - rect.top + viewport.scrollTop) /
        zoom,
    };
  };

  const beginLink = (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: NodeDescriptor,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const point = logicalPoint(event.clientX, event.clientY);
    if (!point) return;

    setLinkDraft({
      from: node.id,
      pointerId: event.pointerId,
      point,
    });
    setStatus(`${node.portType} link: drop on compatible input.`);
  };

  useEffect(() => {
    if (!linkDraft) return;

    const move = (event: PointerEvent) => {
      if (event.pointerId !== linkDraft.pointerId) return;
      const point = logicalPoint(event.clientX, event.clientY);
      if (point) {
        setLinkDraft((current) =>
          current ? { ...current, point } : current,
        );
      }
    };

    const up = (event: PointerEvent) => {
      if (event.pointerId !== linkDraft.pointerId) return;

      const from = nodeById.get(linkDraft.from);
      const element = document.elementFromPoint(
        event.clientX,
        event.clientY,
      ) as HTMLElement | null;
      const input = element?.closest(
        "[data-node-input-id]",
      ) as HTMLElement | null;
      const to = input?.dataset.nodeInputId
        ? nodeById.get(input.dataset.nodeInputId)
        : undefined;

      if (!from || !to || from.id === to.id) {
        setStatus("Link cancelled.");
        setLinkDraft(null);
        return;
      }

      if (!canConnect(from.portType, to.portType)) {
        setStatus(
          `Type mismatch: ${from.portType} cannot feed ${to.portType}.`,
        );
        setLinkDraft(null);
        return;
      }

      const duplicate =
        systemConnections.some(
          (connection) =>
            connection.from === from.id &&
            connection.to === to.id,
        ) ||
        manualConnections.some(
          (connection) =>
            connection.from === from.id &&
            connection.to === to.id,
        );

      if (duplicate) {
        setStatus("That link already exists.");
        setLinkDraft(null);
        return;
      }

      const connection: ManualConnection = {
        id: `manual:${from.id}:${to.id}:${Date.now()}`,
        from: from.id,
        to: to.id,
      };

      setManualConnections((current) => [...current, connection]);
      setSelectedLinkId(connection.id);
      setStatus(
        `Typed analyst link ${from.portType} → ${to.portType} created.`,
      );
      setLinkDraft(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [
    linkDraft,
    manualConnections,
    nodeById,
    systemConnections,
    zoom,
  ]);

  const deleteSelectedLink = () => {
    if (!selectedLinkId) return;

    setManualConnections((current) =>
      current.filter((connection) => connection.id !== selectedLinkId),
    );
    setSelectedLinkId(null);
    setStatus("Analyst link deleted.");
  };

  const runAction = (node: NodeDescriptor) => {
    switch (node.kind) {
      case "case":
      case "scene":
      case "objects":
      case "evidence":
        onOpenNodeTarget(node.kind);
        return;
      case "collision":
        onOpenNodeTarget("collision");
        return;
      case "participant":
        node.onSelect?.();
        return;
      case "physics":
        onRunPhysics();
        setStatus("Physics solver executed.");
        return;
      case "output":
        onPlayPause();
        return;
    }
  };

  const draftNode = linkDraft
    ? nodeById.get(linkDraft.from)
    : undefined;
  const draftPosition = draftNode
    ? positions[draftNode.id]
    : undefined;

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
            <small>Computational graph</small>
          </span>
          <ChevronUp
            size={14}
            className={open ? "" : "is-collapsed"}
          />
        </button>

        <div className="reconstruction-node-editor__summary">
          <span>{nodes.length} nodes</span>
          <span>{systemConnections.length} executable links</span>
          <span>{manualConnections.length} analyst links</span>
          <strong
            className={
              reconstruction.lastPhysicsSimulation
                ? "is-baked"
                : "is-dirty"
            }
          >
            {reconstruction.lastPhysicsSimulation ? "BAKED" : "DIRTY"}
          </strong>
        </div>
      </header>

      {open && (
        <div className="roadsafe-bottom-panel__body reconstruction-node-editor__body">
          <div className="reconstruction-node-editor__toolbar">
            <button type="button" onClick={fitLayout}>
              Fit
            </button>
            <button type="button" onClick={resetLayout}>
              Reset layout
            </button>
            <button
              type="button"
              disabled={!selectedLinkId}
              onClick={deleteSelectedLink}
            >
              Delete link
            </button>

            <label>
              <span>Zoom</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(event) =>
                  setZoom(Number(event.target.value))
                }
              />
              <strong>{Math.round(zoom * 100)}%</strong>
            </label>

            <span className="reconstruction-node-editor__status">
              {status}
            </span>
          </div>

          <div
            ref={viewportRef}
            className={`reconstruction-node-editor__viewport ${
              panning ? "is-panning" : ""
            }`}
            tabIndex={0}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (
                (event.key === "Delete" ||
                  event.key === "Backspace") &&
                selectedLinkId
              ) {
                event.preventDefault();
                deleteSelectedLink();
              }

              if (event.key.toLowerCase() === "f") {
                event.preventDefault();
                fitLayout();
              }
            }}
          >
            <div
              className="reconstruction-node-editor__canvas"
              style={{
                width: LOGICAL_WIDTH * zoom,
                height: logicalHeight * zoom,
              }}
            >
              <div
                className="reconstruction-node-editor__scale"
                style={{
                  width: LOGICAL_WIDTH,
                  height: logicalHeight,
                  transform: `scale(${zoom})`,
                }}
              >
                <svg
                  className="reconstruction-node-editor__links"
                  width={LOGICAL_WIDTH}
                  height={logicalHeight}
                  viewBox={`0 0 ${LOGICAL_WIDTH} ${logicalHeight}`}
                >
                  {systemConnections.map((connection) => {
                    const from = positions[connection.from];
                    const to = positions[connection.to];
                    const fromNode = nodeById.get(connection.from);
                    const toNode = nodeById.get(connection.to);

                    if (!from || !to || !fromNode || !toNode) return null;

                    return (
                      <path
                        key={connection.id}
                        d={connectionPath(
                          from,
                          fromNode,
                          to,
                          toNode,
                        )}
                        className={`reconstruction-node-editor__link is-system is-${connection.state}`}
                      />
                    );
                  })}

                  {manualConnections.map((connection) => {
                    const from = positions[connection.from];
                    const to = positions[connection.to];
                    const fromNode = nodeById.get(connection.from);
                    const toNode = nodeById.get(connection.to);

                    if (!from || !to || !fromNode || !toNode) return null;

                    return (
                      <path
                        key={connection.id}
                        d={connectionPath(
                          from,
                          fromNode,
                          to,
                          toNode,
                        )}
                        className={`reconstruction-node-editor__link is-manual ${
                          selectedLinkId === connection.id
                            ? "is-selected"
                            : ""
                        }`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedLinkId(connection.id);
                        }}
                      />
                    );
                  })}

                  {linkDraft && draftNode && draftPosition && (
                    <path
                      d={draftPath(
                        draftPosition,
                        draftNode,
                        linkDraft.point,
                      )}
                      className="reconstruction-node-editor__link-preview"
                    />
                  )}
                </svg>

                {nodes.map((node) => {
                  const position =
                    positions[node.id] ?? node.defaultPosition;

                  const participant =
                    node.kind === "participant"
                      ? reconstruction.vehicles.find(
                          (candidate) =>
                            `participant:${candidate.id}` === node.id,
                        )
                      : undefined;

                  const participantPhysics = participant
                    ? resolvedParticipantPhysics(participant)
                    : undefined;

                  const objectPhysics = activeObject
                    ? resolvedObjectPhysics(activeObject)
                    : undefined;

                  return (
                    <article
                      key={node.id}
                      className={`reconstruction-node is-${node.kind} ${
                        node.selected ? "is-selected" : ""
                      } ${
                        node.kind === "physics" &&
                        !reconstruction.lastPhysicsSimulation
                          ? "is-dirty"
                          : ""
                      }`}
                      style={{
                        left: position.x,
                        top: position.y,
                        height: node.height,
                      }}
                      tabIndex={0}
                      onDoubleClick={() => runAction(node)}
                    >
                      <button
                        type="button"
                        className="reconstruction-node__socket reconstruction-node__socket--input"
                        data-node-input-id={node.id}
                        data-port-type={node.portType}
                        title={`Input · ${node.portType}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      />

                      <header
                        className="reconstruction-node__header"
                        onPointerDown={(event) =>
                          handleNodePointerDown(event, node)
                        }
                        onPointerMove={handleNodePointerMove}
                        onPointerUp={handleNodePointerUp}
                        onPointerCancel={handleNodePointerUp}
                      >
                        <NodeIcon kind={node.kind} />
                        <strong>{node.title}</strong>
                        <em>{node.portType}</em>
                      </header>

                      <div className="reconstruction-node__summary-block">
                        <span>{node.subtitle}</span>
                        <small>{node.detail}</small>
                      </div>

                      {participant && participantPhysics && (
                        <div className="reconstruction-node__parameters">
                          <NumberInput
                            label="Speed km/h"
                            value={
                              participantPhysics.inputSpeedKmh ??
                              participant.estimatedSpeedKmh
                            }
                            min={0}
                            max={250}
                            step={1}
                            onChange={(value) =>
                              updateParticipantSpeed(
                                participant.id,
                                value,
                              )
                            }
                          />
                          <NumberInput
                            label="Mass kg"
                            value={participantPhysics.massKg}
                            min={1}
                            max={100000}
                            step={5}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                massKg: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Restitution"
                            value={participantPhysics.restitution}
                            min={0}
                            max={1}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                restitution: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Collision μ"
                            value={
                              participantPhysics.collisionFriction ?? 0.65
                            }
                            min={0}
                            max={2}
                            step={0.05}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                collisionFriction: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Rolling μ"
                            value={participantPhysics.rollingFriction}
                            min={0.05}
                            max={3}
                            step={0.05}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                rollingFriction: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Grip"
                            value={participantPhysics.lateralGrip}
                            min={0}
                            max={2}
                            step={0.05}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                lateralGrip: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Brake m/s²"
                            value={
                              participantPhysics.brakingDecelerationMps2
                            }
                            min={0.1}
                            max={18}
                            step={0.1}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                brakingDecelerationMps2: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Radius m"
                            value={
                              participantPhysics.collisionRadiusMetres
                            }
                            min={0.05}
                            max={15}
                            step={0.05}
                            onChange={(value) =>
                              updateParticipantPhysics(participant.id, {
                                collisionRadiusMetres: value,
                              })
                            }
                          />
                        </div>
                      )}

                      {node.kind === "objects" && (
                        <div className="reconstruction-node__parameters">
                          <label className="is-wide">
                            <span>Object</span>
                            <select
                              value={activeObject?.id ?? ""}
                              onChange={(event) => {
                                const id = event.target.value;
                                setObjectNodeSelectionId(id);
                                if (id) onSelectSceneObject(id);
                              }}
                            >
                              {reconstruction.sceneObjects.map((object) => (
                                <option key={object.id} value={object.id}>
                                  {object.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          {activeObject && objectPhysics && (
                            <>
                              <NumberInput
                                label="Mass kg"
                                value={
                                  objectPhysics.massKg ??
                                  getSceneObjectEffectiveMassKg(activeObject)
                                }
                                min={0.1}
                                max={100000000}
                                step={1}
                                onChange={(value) =>
                                  updateObjectPhysics(activeObject.id, {
                                    massKg: value,
                                  })
                                }
                              />
                              <NumberInput
                                label="Restitution"
                                value={objectPhysics.restitution}
                                min={0}
                                max={1}
                                onChange={(value) =>
                                  updateObjectPhysics(activeObject.id, {
                                    restitution: value,
                                  })
                                }
                              />
                              <NumberInput
                                label="Collision μ"
                                value={
                                  objectPhysics.collisionFriction ?? 0.65
                                }
                                min={0}
                                max={2}
                                step={0.05}
                                onChange={(value) =>
                                  updateObjectPhysics(activeObject.id, {
                                    collisionFriction: value,
                                  })
                                }
                              />
                              <NumberInput
                                label="Surface μ"
                                value={
                                  objectPhysics.surfaceFrictionMultiplier
                                }
                                min={0.05}
                                max={3}
                                step={0.05}
                                onChange={(value) =>
                                  updateObjectPhysics(activeObject.id, {
                                    surfaceFrictionMultiplier: value,
                                  })
                                }
                              />
                              <NumberInput
                                label="Speed retained"
                                value={objectPhysics.speedLossFactor}
                                min={0}
                                max={1}
                                onChange={(value) =>
                                  updateObjectPhysics(activeObject.id, {
                                    speedLossFactor: value,
                                  })
                                }
                              />
                              <NumberInput
                                label="Deflect °"
                                value={objectPhysics.deflectionDegrees}
                                min={-45}
                                max={45}
                                step={0.5}
                                onChange={(value) =>
                                  updateObjectPhysics(activeObject.id, {
                                    deflectionDegrees: value,
                                  })
                                }
                              />
                              <label className="is-check">
                                <span>Enabled</span>
                                <input
                                  type="checkbox"
                                  checked={objectPhysics.enabled}
                                  onChange={(event) =>
                                    updateObjectPhysics(activeObject.id, {
                                      enabled: event.target.checked,
                                    })
                                  }
                                />
                              </label>
                              <label className="is-check">
                                <span>Collidable</span>
                                <input
                                  type="checkbox"
                                  checked={objectPhysics.collidable}
                                  onChange={(event) =>
                                    updateObjectPhysics(activeObject.id, {
                                      collidable: event.target.checked,
                                    })
                                  }
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}

                      {node.kind === "physics" && (
                        <div className="reconstruction-node__parameters">
                          <label className="is-check">
                            <span>Enabled</span>
                            <input
                              type="checkbox"
                              checked={settings.enabled}
                              onChange={(event) =>
                                updateGlobalPhysics({
                                  enabled: event.target.checked,
                                })
                              }
                            />
                          </label>
                          <NumberInput
                            label="Step s"
                            value={settings.timeStepSeconds}
                            min={0.004}
                            max={0.1}
                            step={0.005}
                            onChange={(value) =>
                              updateGlobalPhysics({
                                timeStepSeconds: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Tolerance m"
                            value={settings.collisionToleranceMetres}
                            min={0}
                            max={0.35}
                            step={0.01}
                            onChange={(value) =>
                              updateGlobalPhysics({
                                collisionToleranceMetres: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Global μ"
                            value={settings.globalFrictionMultiplier}
                            min={0.05}
                            max={3}
                            step={0.05}
                            onChange={(value) =>
                              updateGlobalPhysics({
                                globalFrictionMultiplier: value,
                              })
                            }
                          />
                          <NumberInput
                            label="Air drag"
                            value={settings.airDrag}
                            min={0}
                            max={0.5}
                            step={0.005}
                            onChange={(value) =>
                              updateGlobalPhysics({ airDrag: value })
                            }
                          />
                          <NumberInput
                            label="Stop km/h"
                            value={settings.stopSpeedKmh}
                            min={0.05}
                            max={8}
                            step={0.1}
                            onChange={(value) =>
                              updateGlobalPhysics({ stopSpeedKmh: value })
                            }
                          />
                        </div>
                      )}

                      <div className="reconstruction-node__actions">
                        <button
                          type="button"
                          onClick={() => runAction(node)}
                        >
                          {node.kind === "physics"
                            ? reconstruction.lastPhysicsSimulation
                              ? "Re-run Physics"
                              : "Run Physics"
                            : node.kind === "output"
                              ? isPlaying
                                ? "Pause"
                                : "Play"
                              : node.kind === "participant"
                                ? "Select"
                                : "Open"}
                        </button>

                        {node.kind === "output" && (
                          <>
                            <button
                              type="button"
                              className={
                                activeView === "2D" ? "is-active" : ""
                              }
                              onClick={() => onSwitchView("2D")}
                            >
                              2D
                            </button>
                            <button
                              type="button"
                              className={
                                activeView === "3D" ? "is-active" : ""
                              }
                              onClick={() => onSwitchView("3D")}
                            >
                              3D
                            </button>
                            <button
                              type="button"
                              onClick={() => onSeek(0)}
                            >
                              0s
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onSeek(reconstruction.durationSeconds)
                              }
                            >
                              End
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        className="reconstruction-node__socket reconstruction-node__socket--output"
                        data-port-type={node.portType}
                        title={`Output · ${node.portType}`}
                        onPointerDown={(event) => beginLink(event, node)}
                      />
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
