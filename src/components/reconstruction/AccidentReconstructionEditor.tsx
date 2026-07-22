import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import { Link } from "react-router-dom";

import { ReconstructionService } from "../../services/reconstructionService";
import { FieldPlacementService } from "../../services/fieldPlacementService";
import {
  DEFAULT_PHYSICS_SETTINGS,
  applyPhysicsSimulation,
} from "../../services/reconstructionPhysicsService";
import { getSceneObjectCatalogItem } from "../../data/sceneObjectCatalog";

import AccidentTimeline from "./AccidentTimeline";
import ReconstructionRecorder from "../footage/ReconstructionRecorder";
import FieldPlacementPanel from "../fieldPlacement/FieldPlacementPanel";
import EvidenceMarkerLayer from "./EvidenceMarkerLayer";
import { EvidenceWorkspacePanel } from "./EvidenceWorkspace";
import MeasurementOverlay from "./MeasurementLayer";
import ParticipantPathPanel from "./ParticipantPathPanel";
import RoadSceneEnvironment from "./RoadSceneEnvironment";
import ReconstructionBasemap from "./ReconstructionBasemap";
import type { ReconstructionBasemapMode } from "./ReconstructionBasemap";
import SceneObjectPalette from "./SceneObjectPalette";
import SceneObjectRenderer from "./SceneObjectRenderer";
import SceneObjectSettingsPanel from "./SceneObjectSettingsPanel";
import SceneSettingsPanel from "./SceneSettingsPanel";
import CollisionSetupPanel from "./CollisionSetupPanel";
import PhysicsControlsPanel from "./PhysicsControlsPanel";
import ReconstructionGuide from "./ReconstructionGuide";
import ReconstructionValidationPanel from "./ReconstructionValidationPanel";
import ReconstructionScenarioWorkspace from "./ReconstructionScenarioWorkspace";

import type {
  AccidentReconstruction,
  EvidenceRecord,
  MovementPathPoint,
  ReconstructionPosition,
  ReconstructionSceneObject,
  ReconstructionVehicle,
  ReconstructionVehicleColour,
  ReconstructionVehicleType,
  RoadSceneSettings,
  SceneMeasurement,
  SceneObjectType,
  ScenePhotoAttachment,
} from "../../types/reconstruction";
import type { ReconstructionFootage } from "../../types/reconstructionFootage";
import type { FieldPlacementTarget } from "../../types/fieldPlacement";

import { createDefaultRoadSceneSettings } from "../../types/reconstruction";

import {
  buildSmoothSvgPath,
  clamp,
  getParticipantStateAtTime,
  getPointsCentroid,
  getReconstructionImpactEffectState,
  isTraceableSceneObjectType,
  shiftSceneObjectTrace,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "../../utils/reconstructionGeometry";

import {
  updateMeasurementDistance,
} from "../../utils/evidenceGeometry";

const Reconstruction3DViewer = lazy(() => import("./Reconstruction3DViewer"));

export interface ReconstructionCaseContext {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  casePath: string;
  reportPath: string;
  footagePath: string;
  recordedBy?: string;
}

interface AccidentReconstructionEditorProps {
  reconstructionId?: string;
  caseContext?: ReconstructionCaseContext;
  onReconstructionSaved?: (
    reconstruction: AccidentReconstruction,
  ) => void;
  onFootageSaved?: (footage: ReconstructionFootage) => void;
}

type DragState =
  | {
      kind: "participant-path-point";
      participantId: string;
      pointId: string;
    }
  | {
      kind: "scene-object";
      objectId: string;
    }
  | {
      kind: "scene-object-trace-point";
      objectId: string;
      pointIndex: number;
    }
  | {
      kind: "measurement-point";
      measurementId: string;
      endpoint: "start" | "end";
    }
  | {
      kind: "evidence-record";
      evidenceId: string;
    }
  | {
      kind: "collision-point";
    };

interface ParticipantShapeProps {
  participant: ReconstructionVehicle;
  selected: boolean;
}

const PARTICIPANT_TYPES: ReconstructionVehicleType[] = [
  "Car",
  "Bus",
  "Truck",
  "Motorcycle",
  "Bicycle",
  "Pedestrian",
  "Officer",
  "Witness",
];

const PARTICIPANT_COLOURS: ReconstructionVehicleColour[] = [
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Black",
  "White",
  "Orange",
  "Purple",
];

const HUMAN_TYPES: ReconstructionVehicleType[] = [
  "Pedestrian",
  "Officer",
  "Witness",
];

const MAX_TRACE_POINTS = 250;

type SaveMessageType = "success" | "error" | "info";

function validateReconstruction(
  reconstruction: AccidentReconstruction,
): string[] {
  const errors: string[] = [];

  if (!reconstruction.title.trim()) {
    errors.push("A reconstruction title is required.");
  }

  if (!reconstruction.accidentId.trim()) {
    errors.push("An accident or case ID is required.");
  }

  if (reconstruction.vehicles.length === 0) {
    errors.push("Add at least one scene participant.");
  }

  if (!reconstruction.collisionSetup?.confirmed) {
    errors.push("Confirm the primary collision point before saving.");
  }

  reconstruction.vehicles.forEach((participant) => {
    if (participant.pathPoints.length < 2) {
      errors.push(
        `${participant.name || participant.type} needs at least two movement points.`,
      );
    }

    const invalidPoint = participant.pathPoints.some(
      (point) =>
        point.timeSeconds < 0 ||
        point.timeSeconds > reconstruction.durationSeconds,
    );

    if (invalidPoint) {
      errors.push(
        `${participant.name || participant.type} has a path point outside the reconstruction duration.`,
      );
    }
  });

  return errors;
}

function isHumanParticipant(type: ReconstructionVehicleType): boolean {
  return HUMAN_TYPES.includes(type);
}

function getDefaultSpeed(type: ReconstructionVehicleType): number {
  switch (type) {
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return 5;
    case "Bicycle":
      return 15;
    case "Motorcycle":
      return 50;
    case "Bus":
    case "Truck":
      return 40;
    default:
      return 50;
  }
}

function getMaximumSpeed(type: ReconstructionVehicleType): number {
  if (isHumanParticipant(type)) return 20;
  if (type === "Bicycle") return 60;
  return 180;
}

function getDefaultRole(
  type: ReconstructionVehicleType,
): ReconstructionVehicle["role"] {
  switch (type) {
    case "Officer":
      return "Officer";
    case "Witness":
      return "Witness";
    case "Bicycle":
      return "Cyclist";
    case "Pedestrian":
      return "Pedestrian";
    default:
      return "Driver";
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getParticipantColour(colour: ReconstructionVehicleColour): string {
  switch (colour) {
    case "Blue":
      return "#2563eb";
    case "Red":
      return "#dc2626";
    case "Green":
      return "#16a34a";
    case "Yellow":
      return "#eab308";
    case "Black":
      return "#111827";
    case "White":
      return "#f9fafb";
    case "Orange":
      return "#ea580c";
    case "Purple":
      return "#9333ea";
  }
}

function getVehicleDimensions(type: ReconstructionVehicleType): {
  width: number;
  height: number;
} {
  switch (type) {
    case "Bus":
      return { width: 66, height: 28 };
    case "Truck":
      return { width: 58, height: 30 };
    case "Motorcycle":
      return { width: 30, height: 14 };
    case "Bicycle":
      return { width: 42, height: 25 };
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return { width: 30, height: 48 };
    default:
      return { width: 46, height: 24 };
  }
}

function getPathPointColour(point: MovementPathPoint): string {
  switch (point.action) {
    case "Start":
    case "Enter Scene":
      return "#16a34a";
    case "Brake":
      return "#f59e0b";
    case "Impact":
      return "#dc2626";
    case "Swerve":
    case "Turn Left":
    case "Turn Right":
    case "Deflect":
      return "#06b6d4";
    case "Ricochet":
      return "#f97316";
    case "Slide":
    case "Fall":
      return "#9333ea";
    case "Stop":
    case "Exit Scene":
      return "#475569";
    default:
      return "#2563eb";
  }
}

function createSceneObject(
  type: SceneObjectType,
  position: ReconstructionPosition,
  index: number,
): ReconstructionSceneObject {
  const catalogItem = getSceneObjectCatalogItem(type);

  const object: ReconstructionSceneObject = {
    id: createId("scene-object"),
    type,
    category: catalogItem.category,
    label: `${catalogItem.label} ${index}`,
    position,
    rotation: 0,
    scale: 1,
    severity: catalogItem.defaultSeverity,
    visible: true,
    locked: false,
    notes: "",
  };

  if (type === "Pothole") {
    return {
      ...object,
      widthMetres: 1,
      depthCentimetres: 8,
    };
  }

  if (isTraceableSceneObjectType(type)) {
    return {
      ...object,
      tracePoints: [],
      traceWidth: type === "Road Crack" ? 0.45 : 0.75,
      traceStyle: type === "Skid Mark" ? "Double" : "Single",
      traceSmoothing: 0.85,
      lengthMetres: 2,
    };
  }

  if (
    ["Road Barrier", "Guardrail", "Wall", "Fence"].includes(type)
  ) {
    return { ...object, lengthMetres: 2 };
  }

  if (type === "Speed Limit Sign") {
    return { ...object, speedLimitKmh: 60 };
  }

  if (type === "Evidence Marker") {
    return { ...object, evidenceNumber: index };
  }

  return object;
}

function createDefaultPathPoints(
  type: ReconstructionVehicleType,
  durationSeconds: number,
  collisionPoint: ReconstructionPosition,
  index: number,
): MovementPathPoint[] {
  const human = isHumanParticipant(type);
  const vehicleApproaches = [
    { start: { x: 8, y: 46 }, final: { x: 78, y: 56 }, rotation: 0 },
    { start: { x: 54, y: 8 }, final: { x: 44, y: 78 }, rotation: 90 },
    { start: { x: 92, y: 54 }, final: { x: 22, y: 44 }, rotation: 180 },
    { start: { x: 46, y: 92 }, final: { x: 56, y: 22 }, rotation: 270 },
  ];
  const approach = vehicleApproaches[(index - 1) % vehicleApproaches.length];
  const start = human ? { x: 82, y: 52 } : approach.start;
  const final = human ? { x: 60, y: 66 } : approach.final;
  const approachRotation = human ? 180 : approach.rotation;
  const speed = getDefaultSpeed(type);

  return [
    {
      id: createId("path-start"),
      label: human ? "Enters scene" : "Starts approach",
      position: start,
      timeSeconds: 0,
      speedKmh: speed,
      rotation: approachRotation,
      action: "Start",
      notes: "",
    },
    {
      id: createId("path-impact"),
      label: "Impact point",
      position: collisionPoint,
      timeSeconds: durationSeconds / 2,
      speedKmh: Math.max(0, speed * 0.65),
      rotation: approachRotation,
      action: "Impact",
      notes: "",
    },
    {
      id: createId("path-stop"),
      label: "Final position",
      position: final,
      timeSeconds: durationSeconds,
      speedKmh: 0,
      rotation: human ? 205 : approachRotation + 12,
      action: "Stop",
      notes: "",
    },
  ];
}

function createDefaultReconstruction(): AccidentReconstruction {
  const now = new Date().toISOString();

  return {
    id: createId("reconstruction"),
    accidentId: "",
    junctionId: "",
    title: "New Accident Reconstruction",
    description: "",
    durationSeconds: 6,
    collisionPoint: { x: 50, y: 50 },
    scene: createDefaultRoadSceneSettings(),
    sceneObjects: [],
    timelineEvents: [],
    measurements: [],
    evidenceRecords: [],
    photos: [],
    fieldPlacements: [],
    fieldWalkingTracks: [],
    collisionSetup: {
      source: "Manual",
      confirmed: false,
      locked: false,
      toleranceMetres: 2,
      notes: "",
    },
    physicsSettings: { ...DEFAULT_PHYSICS_SETTINGS },
    status: "Draft",
    createdAt: now,
    updatedAt: now,
    vehicles: [],
  };
}

function ParticipantShape({ participant, selected }: ParticipantShapeProps) {
  const colour = getParticipantColour(participant.colour);

  if (isHumanParticipant(participant.type)) {
    return (
      <div
        className={`relative flex h-12 w-8 flex-col items-center ${
          selected ? "drop-shadow-[0_0_8px_rgba(34,211,238,1)]" : ""
        }`}
      >
        <span
          className="block h-3.5 w-3.5 rounded-full border-2 border-white"
          style={{ backgroundColor: colour }}
        />
        <span
          className="mt-0.5 block h-5 w-3 rounded-sm border border-white"
          style={{ backgroundColor: colour }}
        />
        <span
          className="absolute left-1 top-5 h-1 w-6 rounded-full"
          style={{ backgroundColor: colour }}
        />
        <span className="mt-0.5 flex gap-1">
          <span
            className="block h-4 w-1.5 rounded-full"
            style={{ backgroundColor: colour }}
          />
          <span
            className="block h-4 w-1.5 rounded-full"
            style={{ backgroundColor: colour }}
          />
        </span>

        {participant.injured && (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white shadow">
            !
          </span>
        )}
      </div>
    );
  }

  if (participant.type === "Bicycle") {
    return (
      <div
        className={`relative h-8 w-12 ${
          selected ? "drop-shadow-[0_0_8px_rgba(34,211,238,1)]" : ""
        }`}
      >
        <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full border-[3px] border-white" />
        <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-[3px] border-white" />
        <span
          className="absolute left-3 top-3 h-1 w-7 rotate-12 rounded-full"
          style={{ backgroundColor: colour }}
        />
        <span
          className="absolute left-5 top-1 h-5 w-1 -rotate-12 rounded-full"
          style={{ backgroundColor: colour }}
        />
      </div>
    );
  }

  const dimensions = getVehicleDimensions(participant.type);

  return (
    <div
      className={`flex items-center justify-center rounded-md border-2 border-white shadow-lg ${
        selected ? "ring-4 ring-cyan-300/40" : ""
      }`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: colour,
      }}
    >
      <span
        className={`px-1 text-[9px] font-bold drop-shadow ${
          participant.colour === "White" ? "text-gray-900" : "text-white"
        }`}
      >
        {participant.name}
      </span>
    </div>
  );
}

function ImpactEffectOverlay({
  effect,
}: {
  effect: ReturnType<typeof getReconstructionImpactEffectState>;
}) {
  if (!effect.active) return null;

  const fade = 1 - effect.progress;
  const burstDistance = 18 + effect.progress * 62 * effect.intensity;
  const ringSize = 42 + effect.progress * 150 * effect.intensity;

  return (
    <div
      className="pointer-events-none absolute z-[85] h-0 w-0"
      style={{
        left: `${effect.position.x}%`,
        top: `${effect.position.y}%`,
      }}
      aria-hidden="true"
    >
      <span
        className="absolute left-0 top-0 rounded-full border-4 border-amber-200 shadow-[0_0_26px_rgba(251,191,36,0.95)]"
        style={{
          width: ringSize,
          height: ringSize,
          opacity: fade * 0.9,
          transform: "translate(-50%, -50%)",
        }}
      />
      <span
        className="absolute left-0 top-0 rounded-full bg-white shadow-[0_0_50px_24px_rgba(251,146,60,0.9)]"
        style={{
          width: 34 * effect.intensity,
          height: 34 * effect.intensity,
          opacity: Math.max(0, 1 - effect.progress * 4),
          transform: `translate(-50%, -50%) scale(${1 + effect.progress * 2})`,
        }}
      />
      {Array.from({ length: 14 }, (_, index) => {
        const angle = index * (360 / 14) + (index % 2) * 7;
        return (
          <span
            key={angle}
            className={`absolute left-0 top-0 h-1 rounded-full ${
              index % 3 === 0 ? "bg-red-500" : "bg-amber-300"
            }`}
            style={{
              width: 9 + (index % 4) * 5 + effect.progress * 22,
              opacity: fade,
              transformOrigin: "0 50%",
              transform: `rotate(${angle}deg) translateX(${burstDistance}px)`,
              boxShadow: "0 0 8px rgba(251,191,36,0.95)",
            }}
          />
        );
      })}
      <span
        className="absolute left-0 top-0 -translate-x-1/2 rounded-md bg-red-700 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-white shadow-xl"
        style={{
          opacity: Math.max(0, 1 - effect.progress * 2.2),
          transform: `translate(-50%, ${-54 - effect.progress * 18}px) scale(${1 + (1 - fade) * 0.15})`,
        }}
      >
        IMPACT
      </span>
    </div>
  );
}

function getEditableTracePointIndices(pointCount: number): number[] {
  if (pointCount <= 14) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }

  const step = Math.ceil(pointCount / 12);
  const indices = Array.from(
    { length: pointCount },
    (_, index) => index,
  ).filter((index) => index % step === 0);

  if (indices[indices.length - 1] !== pointCount - 1) {
    indices.push(pointCount - 1);
  }

  return indices;
}

function orientPathPointsToRoute(
  pathPoints: MovementPathPoint[],
): MovementPathPoint[] {
  const points = sortMovementPathPoints(pathPoints);

  return points.map((point, index) => {
    const start = index < points.length - 1 ? point : points[index - 1];
    const end = index < points.length - 1 ? points[index + 1] : point;
    if (!start || !end) return point;

    const deltaX = end.position.x - start.position.x;
    const deltaY = end.position.y - start.position.y;
    if (Math.hypot(deltaX, deltaY) < 0.001) return point;

    return {
      ...point,
      rotation: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
    };
  });
}

const participantPathGeometryCache = new WeakMap<
  MovementPathPoint[],
  { path: string; skidPath: string }
>();

function getParticipantPathGeometry(pathPoints: MovementPathPoint[]) {
  const cached = participantPathGeometryCache.get(pathPoints);
  if (cached) return cached;
  const path = buildSmoothSvgPath(pathPoints.map((point) => point.position), 0.85);
  const skidPoints = pathPoints.filter((point, index) =>
    point.action === "Brake" || point.action === "Slide" ||
    (index > 0 && (pathPoints[index - 1].action === "Brake" || pathPoints[index - 1].action === "Slide")),
  );
  const geometry = {
    path,
    skidPath: skidPoints.length > 1
      ? buildSmoothSvgPath(skidPoints.map((point) => point.position), 0.7)
      : "",
  };
  participantPathGeometryCache.set(pathPoints, geometry);
  return geometry;
}

function getVisibleParticipantControlPoints(
  pathPoints: MovementPathPoint[],
): MovementPathPoint[] {
  return sortMovementPathPoints(pathPoints).filter((point) => {
    const generated = point.id.startsWith("physics-point") ||
      point.notes?.includes("Generated by the RoadSafe deterministic 2D physics preview.");
    return !generated || point.action === "Ricochet" || point.action === "Deflect" || point.action === "Stop";
  });
}

export default function AccidentReconstructionEditor({
  reconstructionId,
  caseContext,
  onReconstructionSaved,
  onFootageSaved,
}: AccidentReconstructionEditorProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastPlaybackPaintRef = useRef<number | null>(null);
  const traceDrawingObjectIdRef = useRef<string | null>(null);
  const saveMessageTimerRef = useRef<number | null>(null);
  const pointerMoveFrameRef = useRef<number | null>(null);
  const latestPointerPositionRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const currentTimeRef = useRef(0);
  const routeDrawingParticipantIdRef = useRef<string | null>(null);
  const routeDraftPointsRef = useRef<ReconstructionPosition[]>([]);
  const undoStackRef = useRef<AccidentReconstruction[]>([]);
  const redoStackRef = useRef<AccidentReconstruction[]>([]);
  const historySnapshotRef = useRef<AccidentReconstruction | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const applyingHistoryRef = useRef(false);
  const livePhysicsTimerRef = useRef<number | null>(null);

  const [reconstruction, setReconstruction] = useState<AccidentReconstruction>(
    () => {
      if (reconstructionId) {
        return (
          ReconstructionService.getById(reconstructionId) ??
          createDefaultReconstruction()
        );
      }

      const created = createDefaultReconstruction();

      return caseContext
        ? {
            ...created,
            accidentId: caseContext.caseNumber,
          }
        : created;
    },
  );

  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(reconstruction.vehicles[0]?.id ?? null);
  const [selectedPathPointId, setSelectedPathPointId] = useState<string | null>(
    reconstruction.vehicles[0]?.pathPoints[0]?.id ?? null,
  );
  const [newParticipantType, setNewParticipantType] =
    useState<ReconstructionVehicleType>("Car");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sceneExpanded, setSceneExpanded] = useState(false);
  const [activeReconstructionView, setActiveReconstructionView] = useState<"2D" | "3D">("2D");
  const [sceneView, setSceneView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [basemapMode, setBasemapMode] = useState<ReconstructionBasemapMode>("Diagram");
  const [routeDrawingParticipantId, setRouteDrawingParticipantId] = useState<string | null>(null);
  const [, setHistoryVersion] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const [activeSceneObjectType, setActiveSceneObjectType] =
    useState<SceneObjectType | null>(null);
  const [selectedSceneObjectId, setSelectedSceneObjectId] = useState<
    string | null
  >(reconstruction.sceneObjects[0]?.id ?? null);
  const [traceToolObjectId, setTraceToolObjectId] = useState<string | null>(null);

  const [measurementToolActive, setMeasurementToolActive] = useState(false);
  const [measurementDraftStart, setMeasurementDraftStart] =
    useState<ReconstructionPosition | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(
    reconstruction.measurements[0]?.id ?? null,
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    reconstruction.evidenceRecords[0]?.id ?? null,
  );
  const [activeEvidencePlacementId, setActiveEvidencePlacementId] =
    useState<string | null>(null);

  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageType, setSaveMessageType] =
    useState<SaveMessageType>("success");
  const [fieldPlacementOpen, setFieldPlacementOpen] = useState(false);
  const [fieldPlacementInitialTarget, setFieldPlacementInitialTarget] =
    useState<FieldPlacementTarget | null>(null);
  const [pendingGpsSceneObjectId, setPendingGpsSceneObjectId] = useState<
    string | null
  >(null);
  const [collisionPlacementActive, setCollisionPlacementActive] = useState(false);

  const clientToScenePosition = useCallback((clientX: number, clientY: number) => {
    const rectangle = sceneRef.current?.getBoundingClientRect();
    if (!rectangle) return null;
    const localX = (clientX - rectangle.left - rectangle.width / 2 - sceneView.panX) / sceneView.zoom + rectangle.width / 2;
    const localY = (clientY - rectangle.top - rectangle.height / 2 - sceneView.panY) / sceneView.zoom + rectangle.height / 2;
    return {
      x: clamp((localX / rectangle.width) * 100, 0, 100),
      y: clamp((localY / rectangle.height) * 100, 0, 100),
    };
  }, [sceneView]);

  const showSaveMessage = useCallback(
    (message: string, type: SaveMessageType = "success", duration = 3000) => {
      if (saveMessageTimerRef.current !== null) {
        window.clearTimeout(saveMessageTimerRef.current);
      }

      setSaveMessage(message);
      setSaveMessageType(type);

      saveMessageTimerRef.current = window.setTimeout(() => {
        setSaveMessage("");
        saveMessageTimerRef.current = null;
      }, duration);
    },
    [],
  );

  useEffect(() => {
    const loaded = reconstructionId
      ? ReconstructionService.getById(reconstructionId)
      : null;

    const next = loaded ?? createDefaultReconstruction();

    setReconstruction(
      caseContext
        ? {
            ...next,
            accidentId: caseContext.caseNumber,
          }
        : next,
    );
  }, [reconstructionId, caseContext?.caseId, caseContext?.caseNumber]);

  useEffect(() => {
    setSelectedParticipantId(reconstruction.vehicles[0]?.id ?? null);
    setSelectedPathPointId(
      reconstruction.vehicles[0]?.pathPoints[0]?.id ?? null,
    );
    setSelectedSceneObjectId(reconstruction.sceneObjects[0]?.id ?? null);
    setSelectedMeasurementId(reconstruction.measurements[0]?.id ?? null);
    setSelectedEvidenceId(reconstruction.evidenceRecords[0]?.id ?? null);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setIsPlaying(false);
    setDragState(null);
    setActiveSceneObjectType(null);
    setTraceToolObjectId(null);
    setMeasurementToolActive(false);
    setMeasurementDraftStart(null);
    setActiveEvidencePlacementId(null);
    setCollisionPlacementActive(false);
    setFieldPlacementOpen(false);
    setFieldPlacementInitialTarget(null);
    setPendingGpsSceneObjectId(null);
  }, [reconstruction.id]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!historySnapshotRef.current || applyingHistoryRef.current) {
      historySnapshotRef.current = reconstruction;
      applyingHistoryRef.current = false;
      return;
    }
    const previous = historySnapshotRef.current;
    if (previous === reconstruction) return;
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      undoStackRef.current = [...undoStackRef.current.slice(-39), previous];
      redoStackRef.current = [];
      historySnapshotRef.current = reconstruction;
      historyTimerRef.current = null;
      setHistoryVersion((value) => value + 1);
    }, 280);
  }, [reconstruction]);

  const physicsInputSignature = useMemo(() => JSON.stringify({
    collisionPoint: reconstruction.collisionPoint,
    scene: reconstruction.scene,
    objects: reconstruction.sceneObjects.map(({ id, type, position, rotation, physics }) => ({ id, type, position, rotation, physics })),
    vehicles: reconstruction.vehicles.map((participant) => ({
      id: participant.id,
      type: participant.type,
      physics: participant.physics,
      pathPoints: sortMovementPathPoints(participant.pathPoints).filter((point) => point.action !== "Deflect" && point.action !== "Ricochet" && point.action !== "Slide"),
    })),
    settings: reconstruction.physicsSettings,
  }), [reconstruction]);

  useEffect(() => {
    const settings = { ...DEFAULT_PHYSICS_SETTINGS, ...(reconstruction.physicsSettings ?? {}) };
    if (!settings.enabled || !settings.liveSimulation || reconstruction.vehicles.length < 1) return;
    if (livePhysicsTimerRef.current !== null) window.clearTimeout(livePhysicsTimerRef.current);
    livePhysicsTimerRef.current = window.setTimeout(() => {
      setReconstruction((current) => applyPhysicsSimulation(current));
      livePhysicsTimerRef.current = null;
    }, 500);
    return () => {
      if (livePhysicsTimerRef.current !== null) window.clearTimeout(livePhysicsTimerRef.current);
    };
  }, [physicsInputSignature]);

  useEffect(() => {
    if (!sceneExpanded) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSceneExpanded(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sceneExpanded]);

  useEffect(() => {
    return () => {
      if (saveMessageTimerRef.current !== null) {
        window.clearTimeout(saveMessageTimerRef.current);
      }

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      if (pointerMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveFrameRef.current);
      }
    };
  }, []);

  const selectedParticipant = useMemo(
    () =>
      reconstruction.vehicles.find(
        (participant) => participant.id === selectedParticipantId,
      ) ?? null,
    [reconstruction.vehicles, selectedParticipantId],
  );

  const selectedSceneObject = useMemo(
    () =>
      reconstruction.sceneObjects.find(
        (object) => object.id === selectedSceneObjectId,
      ) ?? null,
    [reconstruction.sceneObjects, selectedSceneObjectId],
  );

  const impactEffect = useMemo(
    () => getReconstructionImpactEffectState(reconstruction, currentTime),
    [currentTime, reconstruction],
  );

  const openFieldPlacementForTarget = useCallback(
    (target: FieldPlacementTarget | null) => {
      setIsPlaying(false);
      setCollisionPlacementActive(false);
      setMeasurementToolActive(false);
      setMeasurementDraftStart(null);
      setActiveEvidencePlacementId(null);
      setActiveSceneObjectType(null);
      setTraceToolObjectId(null);
      setFieldPlacementInitialTarget(target);
      setFieldPlacementOpen(true);
    },
    [],
  );

  const handlePlaceActiveSceneObjectWithGps = useCallback(() => {
    if (!activeSceneObjectType) return;

    const object = createSceneObject(
      activeSceneObjectType,
      { x: 50, y: 50 },
      reconstruction.sceneObjects.length + 1,
    );

    setReconstruction((current) => ({
      ...current,
      sceneObjects: [...current.sceneObjects, object],
    }));
    setSelectedSceneObjectId(object.id);
    setSelectedParticipantId(null);
    setSelectedPathPointId(null);
    setPendingGpsSceneObjectId(object.id);

    openFieldPlacementForTarget({
      type: "SceneObject",
      targetId: object.id,
      label: `Scene object — ${object.label}`,
    });
  }, [
    activeSceneObjectType,
    openFieldPlacementForTarget,
    reconstruction.sceneObjects.length,
  ]);

  const handlePlaceSelectedSceneObjectWithGps = useCallback(() => {
    if (!selectedSceneObject) return;

    openFieldPlacementForTarget({
      type: "SceneObject",
      targetId: selectedSceneObject.id,
      label: `Scene object — ${selectedSceneObject.label}`,
    });
  }, [openFieldPlacementForTarget, selectedSceneObject]);

  const handlePlaceParticipantPointWithGps = useCallback(
    (pointId: string) => {
      if (!selectedParticipant) return;

      const point = selectedParticipant.pathPoints.find(
        (item) => item.id === pointId,
      );
      if (!point) return;

      setSelectedPathPointId(point.id);
      openFieldPlacementForTarget({
        type: "ParticipantPathPoint",
        targetId: selectedParticipant.id,
        subTargetId: point.id,
        label: `${selectedParticipant.name} — ${point.label} (${point.action})`,
      });
    },
    [openFieldPlacementForTarget, selectedParticipant],
  );

  const handleCloseFieldPlacement = useCallback(() => {
    if (pendingGpsSceneObjectId) {
      const pendingId = pendingGpsSceneObjectId;

      setReconstruction((current) => {
        const wasConfirmed = current.fieldPlacements.some(
          (placement) =>
            placement.targetType === "SceneObject" &&
            placement.targetId === pendingId,
        );

        if (wasConfirmed) return current;

        return {
          ...current,
          sceneObjects: current.sceneObjects.filter(
            (object) => object.id !== pendingId,
          ),
        };
      });

      setSelectedSceneObjectId((current) =>
        current === pendingId ? null : current,
      );
    }

    setPendingGpsSceneObjectId(null);
    setFieldPlacementInitialTarget(null);
    setFieldPlacementOpen(false);
  }, [pendingGpsSceneObjectId]);

  const handleFieldPlacementConfirmed = useCallback(
    (target: FieldPlacementTarget) => {
      if (
        target.type === "SceneObject" &&
        target.targetId === pendingGpsSceneObjectId
      ) {
        setPendingGpsSceneObjectId(null);
      }
    },
    [pendingGpsSceneObjectId],
  );

  const updateSceneSettings = useCallback(
    (updates: Partial<RoadSceneSettings>) => {
      setReconstruction((current) => {
        const scene = {
          ...current.scene,
          ...updates,
        };

        return {
          ...current,
          scene,
          measurements: current.measurements.map((measurement) =>
            updateMeasurementDistance(measurement, scene),
          ),
        };
      });
    },
    [],
  );

  const updateParticipant = useCallback(
    (participantId: string, updates: Partial<ReconstructionVehicle>) => {
      setReconstruction((current) => ({
        ...current,
        vehicles: current.vehicles.map((participant) => {
          if (participant.id !== participantId) return participant;

          const updated = {
            ...participant,
            ...updates,
          };

          return updates.pathPoints
            ? syncLegacyParticipantFields(updated)
            : updated;
        }),
      }));
    },
    [],
  );

  const updatePathPoint = useCallback(
    (
      participantId: string,
      pointId: string,
      updates: Partial<MovementPathPoint>,
    ) => {
      setReconstruction((current) => {
        const updated: AccidentReconstruction = {
          ...current,
          vehicles: current.vehicles.map((participant) => {
            if (participant.id !== participantId) return participant;

            const pathPoints = orientPathPointsToRoute(
              participant.pathPoints.map((point) =>
                point.id === pointId
                  ? {
                      ...point,
                      ...updates,
                    }
                  : point,
              ),
            );

            return syncLegacyParticipantFields({
              ...participant,
              pathPoints,
            });
          }),
        };

        return updates.position
          ? FieldPlacementService.markManuallyAdjusted({
              reconstruction: {
                ...updated,
                physicsSettings: {
                  ...DEFAULT_PHYSICS_SETTINGS,
                  ...(updated.physicsSettings ?? {}),
                  autoRunOnPlay: false,
                  liveSimulation: false,
                },
                lastPhysicsSimulation: undefined,
              },
              targetType: "ParticipantPathPoint",
              targetId: participantId,
              subTargetId: pointId,
            })
          : updated;
      });
    },
    [],
  );

  const handleParticipantHeadingChange = useCallback(
    (heading: string, degrees: number) => {
      if (!selectedParticipant) return;
      const points = sortMovementPathPoints(selectedParticipant.pathPoints);
      if (points.length === 0) return;
      const finalPoint = points[points.length - 1];
      const impactPoint = [...points].reverse().find((point) => point.action === "Impact");
      const anchor = impactPoint?.position ?? points[Math.max(0, points.length - 2)].position;
      const radians = (degrees * Math.PI) / 180;
      const destination = {
        x: clamp(anchor.x + Math.cos(radians) * 34, 3, 97),
        y: clamp(anchor.y + Math.sin(radians) * 34, 3, 97),
      };
      updateParticipant(selectedParticipant.id, {
        destinationLocation: `${heading}bound`,
        pathPoints: orientPathPointsToRoute(points.map((point) =>
          point.id === finalPoint.id ? { ...point, position: destination } : point,
        )),
      });
      setSelectedPathPointId(finalPoint.id);
    },
    [selectedParticipant, updateParticipant],
  );

  const updateSceneObject = useCallback(
    (
      objectId: string,
      updates: Partial<ReconstructionSceneObject>,
    ) => {
      setReconstruction((current) => {
        const updated: AccidentReconstruction = {
          ...current,
          sceneObjects: current.sceneObjects.map((object) => {
            if (object.id !== objectId) return object;

            if (updates.position) {
              return {
                ...object,
                ...updates,
                tracePoints: shiftSceneObjectTrace(object, updates.position),
              };
            }

            return {
              ...object,
              ...updates,
            };
          }),
        };

        return updates.position
          ? FieldPlacementService.markManuallyAdjusted({
              reconstruction: updated,
              targetType: "SceneObject",
              targetId: objectId,
            })
          : updated;
      });
    },
    [],
  );


  const updateMeasurement = useCallback(
    (measurementId: string, updates: Partial<SceneMeasurement>) => {
      setReconstruction((current) => {
        let updated: AccidentReconstruction = {
          ...current,
          measurements: current.measurements.map((measurement) =>
            measurement.id === measurementId
              ? updateMeasurementDistance(
                  {
                    ...measurement,
                    ...updates,
                  },
                  current.scene,
                )
              : measurement,
          ),
        };

        if (updates.start) {
          updated = FieldPlacementService.markManuallyAdjusted({
            reconstruction: updated,
            targetType: "MeasurementStart",
            targetId: measurementId,
          });
        }

        if (updates.end) {
          updated = FieldPlacementService.markManuallyAdjusted({
            reconstruction: updated,
            targetType: "MeasurementEnd",
            targetId: measurementId,
          });
        }

        return updated;
      });
    },
    [],
  );

  const updateEvidenceRecord = useCallback(
    (evidenceId: string, updates: Partial<EvidenceRecord>) => {
      setReconstruction((current) => {
        const updated: AccidentReconstruction = {
          ...current,
          evidenceRecords: current.evidenceRecords.map((record) =>
            record.id === evidenceId
              ? {
                  ...record,
                  ...updates,
                }
              : record,
          ),
        };

        return updates.position
          ? FieldPlacementService.markManuallyAdjusted({
              reconstruction: updated,
              targetType: "EvidenceRecord",
              targetId: evidenceId,
            })
          : updated;
      });
    },
    [],
  );

  const updatePhoto = useCallback(
    (photoId: string, updates: Partial<ScenePhotoAttachment>) => {
      setReconstruction((current) => ({
        ...current,
        photos: current.photos.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                ...updates,
              }
            : photo,
        ),
      }));
    },
    [],
  );

  const handleSelectParticipant = useCallback(
    (participantId: string, pointId?: string) => {
      const participant = reconstruction.vehicles.find(
        (item) => item.id === participantId,
      );

      setSelectedParticipantId(participantId);
      setSelectedPathPointId(
        pointId ?? participant?.pathPoints[0]?.id ?? null,
      );
      setSelectedSceneObjectId(null);
      setSelectedMeasurementId(null);
      setSelectedEvidenceId(null);
      setActiveSceneObjectType(null);
      setTraceToolObjectId(null);
    },
    [reconstruction.vehicles],
  );

  const handleSelectSceneObject = useCallback((objectId: string) => {
    setSelectedSceneObjectId(objectId);
    setSelectedParticipantId(null);
    setSelectedPathPointId(null);
    setSelectedMeasurementId(null);
    setSelectedEvidenceId(null);
    setActiveSceneObjectType(null);
  }, []);

  const handleAddParticipant = useCallback(() => {
    const index = reconstruction.vehicles.length + 1;
    const human = isHumanParticipant(newParticipantType);
    const pathPoints = createDefaultPathPoints(
      newParticipantType,
      reconstruction.durationSeconds,
      reconstruction.collisionPoint,
      index,
    );

    const participant = syncLegacyParticipantFields({
      id: createId("participant"),
      name: `${newParticipantType} ${index}`,
      type: newParticipantType,
      colour: human ? "Yellow" : index % 2 === 0 ? "Red" : "Blue",
      estimatedSpeedKmh: getDefaultSpeed(newParticipantType),
      originLocation: "",
      destinationLocation: "",
      pathPoints,
      startPosition: pathPoints[0].position,
      collisionPosition: pathPoints[1].position,
      finalPosition: pathPoints[pathPoints.length - 1].position,
      startRotation: pathPoints[0].rotation,
      collisionRotation: pathPoints[1].rotation,
      finalRotation: pathPoints[pathPoints.length - 1].rotation,
      collisionTimeSeconds: pathPoints[1].timeSeconds,
      role: getDefaultRole(newParticipantType),
      injured: false,
    });

    setReconstruction((current) => ({
      ...current,
      vehicles: [...current.vehicles, participant],
    }));

    setSelectedParticipantId(participant.id);
    setSelectedPathPointId(pathPoints[0].id);
    setSelectedSceneObjectId(null);
  }, [
    newParticipantType,
    reconstruction.collisionPoint,
    reconstruction.durationSeconds,
    reconstruction.vehicles.length,
  ]);

  const handleDeleteParticipant = useCallback(() => {
    if (!selectedParticipantId) return;

    const remaining = reconstruction.vehicles.filter(
      (participant) => participant.id !== selectedParticipantId,
    );

    setReconstruction((current) => ({
      ...current,
      vehicles: current.vehicles.filter(
        (participant) => participant.id !== selectedParticipantId,
      ),
      timelineEvents: current.timelineEvents.filter(
        (event) => event.participantId !== selectedParticipantId,
      ),
      measurements: current.measurements.map((measurement) =>
        measurement.linkedParticipantId === selectedParticipantId
          ? { ...measurement, linkedParticipantId: undefined }
          : measurement,
      ),
      evidenceRecords: current.evidenceRecords.map((record) =>
        record.linkedParticipantId === selectedParticipantId
          ? { ...record, linkedParticipantId: undefined }
          : record,
      ),
      photos: current.photos.map((photo) =>
        photo.linkedParticipantId === selectedParticipantId
          ? { ...photo, linkedParticipantId: undefined }
          : photo,
      ),
    }));

    setSelectedParticipantId(remaining[0]?.id ?? null);
    setSelectedPathPointId(remaining[0]?.pathPoints[0]?.id ?? null);
  }, [reconstruction.vehicles, selectedParticipantId]);

  const handleParticipantTypeChange = useCallback(
    (participant: ReconstructionVehicle, type: ReconstructionVehicleType) => {
      updateParticipant(participant.id, {
        type,
        estimatedSpeedKmh: getDefaultSpeed(type),
        role: getDefaultRole(type),
        injured: isHumanParticipant(type) ? participant.injured ?? false : false,
      });
    },
    [updateParticipant],
  );

  const handleAddPathPoint = useCallback(() => {
    if (!selectedParticipant) return;

    const state = getParticipantStateAtTime(selectedParticipant, currentTime);
    const timeSeconds = clamp(
      currentTime || reconstruction.durationSeconds / 2,
      0.1,
      Math.max(0.1, reconstruction.durationSeconds - 0.1),
    );

    const point: MovementPathPoint = {
      id: createId("path-point"),
      label: `Path point ${selectedParticipant.pathPoints.length + 1}`,
      position: state.position,
      timeSeconds,
      speedKmh: state.speedKmh,
      rotation: state.rotation,
      action: "Cruise",
      notes: "",
    };

    updateParticipant(selectedParticipant.id, {
      pathPoints: sortMovementPathPoints([
        ...selectedParticipant.pathPoints,
        point,
      ]),
    });

    setSelectedPathPointId(point.id);
  }, [
    currentTime,
    reconstruction.durationSeconds,
    selectedParticipant,
    updateParticipant,
  ]);

  const handleDeletePathPoint = useCallback(
    (pointId: string) => {
      if (!selectedParticipant || selectedParticipant.pathPoints.length <= 2) {
        return;
      }

      const points = selectedParticipant.pathPoints.filter(
        (point) => point.id !== pointId,
      );

      updateParticipant(selectedParticipant.id, { pathPoints: points });
      setSelectedPathPointId(points[0]?.id ?? null);
    },
    [selectedParticipant, updateParticipant],
  );

  const handleScenePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!sceneRef.current || event.button !== 0) return;

      const target = event.target as HTMLElement;

      const position = clientToScenePosition(event.clientX, event.clientY);
      if (!position) return;

      if (routeDrawingParticipantId) {
        if (target.closest('[data-scene-interactive="true"]')) return;
        routeDrawingParticipantIdRef.current = routeDrawingParticipantId;
        routeDraftPointsRef.current = [position];
        return;
      }

      if (collisionPlacementActive) {
        if (target.closest('[data-scene-interactive="true"]')) return;

        setReconstruction((current) =>
          FieldPlacementService.markManuallyAdjusted({
            reconstruction: {
              ...current,
              collisionPoint: position,
              collisionSetup: {
                source: "Manual",
                confirmed: true,
                locked: false,
                toleranceMetres: current.collisionSetup?.toleranceMetres ?? 2,
                notes: current.collisionSetup?.notes ?? "",
                lastCalculatedAt: new Date().toISOString(),
              },
            },
            targetType: "CollisionPoint",
            targetId: current.id,
          }),
        );
        setCollisionPlacementActive(false);
        return;
      }

      if (measurementToolActive) {
        if (target.closest('[data-scene-interactive="true"]')) return;

        if (!measurementDraftStart) {
          setMeasurementDraftStart(position);
          return;
        }

        const measurement: SceneMeasurement = updateMeasurementDistance(
          {
            id: createId("measurement"),
            measurementNumber: reconstruction.measurements.length + 1,
            label: `Scene measurement ${reconstruction.measurements.length + 1}`,
            kind: "Distance",
            start: measurementDraftStart,
            end: position,
            distanceMetres: 0,
            colour: "#0ea5e9",
            visible: true,
            locked: false,
            notes: "",
          },
          reconstruction.scene,
        );

        setReconstruction((current) => ({
          ...current,
          measurements: [...current.measurements, measurement],
        }));
        setSelectedMeasurementId(measurement.id);
        setSelectedEvidenceId(null);
        setMeasurementDraftStart(null);
        setMeasurementToolActive(false);
        return;
      }

      if (activeEvidencePlacementId) {
        if (target.closest('[data-scene-interactive="true"]')) return;
        updateEvidenceRecord(activeEvidencePlacementId, { position });
        setSelectedEvidenceId(activeEvidencePlacementId);
        setActiveEvidencePlacementId(null);
        return;
      }

      if (target.closest('[data-scene-interactive="true"]')) return;

      if (traceToolObjectId) {
        traceDrawingObjectIdRef.current = traceToolObjectId;

        setReconstruction((current) => ({
          ...current,
          sceneObjects: current.sceneObjects.map((object) =>
            object.id === traceToolObjectId
              ? {
                  ...object,
                  tracePoints: [position],
                  position,
                }
              : object,
          ),
        }));

        return;
      }

      if (!activeSceneObjectType) return;

      const object = createSceneObject(
        activeSceneObjectType,
        position,
        reconstruction.sceneObjects.length + 1,
      );

      setReconstruction((current) => ({
        ...current,
        sceneObjects: [...current.sceneObjects, object],
      }));

      setSelectedSceneObjectId(object.id);
      setSelectedParticipantId(null);
      setSelectedPathPointId(null);

      if (isTraceableSceneObjectType(object.type)) {
        setTraceToolObjectId(object.id);
      }
    }, [
      activeEvidencePlacementId,
      activeSceneObjectType,
      clientToScenePosition,
      collisionPlacementActive,
      measurementDraftStart,
      measurementToolActive,
      reconstruction.measurements.length,
      reconstruction.scene,
      reconstruction.sceneObjects.length,
      routeDrawingParticipantId,
      traceToolObjectId,
      updateEvidenceRecord,
    ],
  );


  const handleMeasurementEndpointPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      measurementId: string,
      endpoint: "start" | "end",
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedMeasurementId(measurementId);
      setSelectedEvidenceId(null);
      setSelectedParticipantId(null);
      setSelectedSceneObjectId(null);
      setDragState({
        kind: "measurement-point",
        measurementId,
        endpoint,
      });
    },
    [],
  );

  const handleEvidencePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, evidenceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedEvidenceId(evidenceId);
      setSelectedMeasurementId(null);
      setSelectedParticipantId(null);
      setSelectedSceneObjectId(null);
      setDragState({ kind: "evidence-record", evidenceId });
    },
    [],
  );

  const handleAddEvidence = useCallback(() => {
    const selectedObject = reconstruction.sceneObjects.find(
      (object) => object.id === selectedSceneObjectId,
    );
    const record: EvidenceRecord = {
      id: createId("evidence"),
      evidenceNumber: reconstruction.evidenceRecords.length + 1,
      title: selectedObject?.label ?? `Evidence ${reconstruction.evidenceRecords.length + 1}`,
      category:
        selectedObject?.category === "Physical Evidence"
          ? "Trace Evidence"
          : selectedObject?.category === "Road Hazards"
            ? "Road Condition"
            : "Other",
      status: "Observed",
      description: selectedObject?.notes ?? "",
      notes: "",
      position: selectedObject?.position ?? { x: 50, y: 50 },
      recordedAt: new Date().toISOString(),
      recordedBy: "",
      linkedSceneObjectId: selectedObject?.id,
      measurementIds: [],
      photoIds: [],
    };

    setReconstruction((current) => ({
      ...current,
      evidenceRecords: [...current.evidenceRecords, record],
    }));
    setSelectedEvidenceId(record.id);
    setSelectedMeasurementId(null);
  }, [
    reconstruction.evidenceRecords.length,
    reconstruction.sceneObjects,
    selectedSceneObjectId,
  ]);

  const handleDeleteEvidence = useCallback((evidenceId: string) => {
    setReconstruction((current) => ({
      ...current,
      evidenceRecords: current.evidenceRecords.filter(
        (record) => record.id !== evidenceId,
      ),
      photos: current.photos.map((photo) =>
        photo.linkedEvidenceId === evidenceId
          ? { ...photo, linkedEvidenceId: undefined }
          : photo,
      ),
    }));
    setSelectedEvidenceId(null);
    setActiveEvidencePlacementId(null);
  }, []);

  const handleDeleteMeasurement = useCallback((measurementId: string) => {
    setReconstruction((current) => ({
      ...current,
      measurements: current.measurements.filter(
        (measurement) => measurement.id !== measurementId,
      ),
      evidenceRecords: current.evidenceRecords.map((record) => ({
        ...record,
        measurementIds: record.measurementIds.filter(
          (id) => id !== measurementId,
        ),
      })),
    }));
    setSelectedMeasurementId(null);
  }, []);

  const handleSceneObjectPointerDown = useCallback(
    (
      event: ReactPointerEvent<SVGPathElement | HTMLButtonElement>,
      object: ReconstructionSceneObject,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      handleSelectSceneObject(object.id);

      if (!object.locked && traceToolObjectId !== object.id) {
        setDragState({ kind: "scene-object", objectId: object.id });
      }
    },
    [handleSelectSceneObject, traceToolObjectId],
  );

  const handleDeleteSceneObject = useCallback(() => {
    if (!selectedSceneObjectId) return;

    setReconstruction((current) => ({
      ...current,
      sceneObjects: current.sceneObjects.filter(
        (object) => object.id !== selectedSceneObjectId,
      ),
      timelineEvents: current.timelineEvents.filter(
        (event) => event.sceneObjectId !== selectedSceneObjectId,
      ),
      vehicles: current.vehicles.map((participant) =>
        syncLegacyParticipantFields({
          ...participant,
          pathPoints: participant.pathPoints.map((point) =>
            point.linkedSceneObjectId === selectedSceneObjectId
              ? { ...point, linkedSceneObjectId: undefined }
              : point,
          ),
        }),
      ),
      measurements: current.measurements.map((measurement) =>
        measurement.linkedSceneObjectId === selectedSceneObjectId
          ? { ...measurement, linkedSceneObjectId: undefined }
          : measurement,
      ),
      evidenceRecords: current.evidenceRecords.map((record) =>
        record.linkedSceneObjectId === selectedSceneObjectId
          ? { ...record, linkedSceneObjectId: undefined }
          : record,
      ),
      photos: current.photos.map((photo) =>
        photo.linkedSceneObjectId === selectedSceneObjectId
          ? { ...photo, linkedSceneObjectId: undefined }
          : photo,
      ),
    }));

    setSelectedSceneObjectId(null);
    setTraceToolObjectId(null);
  }, [selectedSceneObjectId]);

  const handleDuplicateSceneObject = useCallback(() => {
    if (!selectedSceneObject) return;

    const offset = { x: 4, y: 4 };
    const duplicate: ReconstructionSceneObject = {
      ...selectedSceneObject,
      id: createId("scene-object"),
      label: `${selectedSceneObject.label} copy`,
      position: {
        x: clamp(selectedSceneObject.position.x + offset.x, 0, 100),
        y: clamp(selectedSceneObject.position.y + offset.y, 0, 100),
      },
      tracePoints: selectedSceneObject.tracePoints?.map((point) => ({
        x: clamp(point.x + offset.x, 0, 100),
        y: clamp(point.y + offset.y, 0, 100),
      })),
      locked: false,
    };

    setReconstruction((current) => ({
      ...current,
      sceneObjects: [...current.sceneObjects, duplicate],
    }));

    setSelectedSceneObjectId(duplicate.id);
  }, [selectedSceneObject]);

  const handleClearSceneObjects = useCallback(() => {
    setReconstruction((current) => ({
      ...current,
      sceneObjects: [],
      timelineEvents: current.timelineEvents.map((event) => ({
        ...event,
        sceneObjectId: undefined,
      })),
      vehicles: current.vehicles.map((participant) =>
        syncLegacyParticipantFields({
          ...participant,
          pathPoints: participant.pathPoints.map((point) => ({
            ...point,
            linkedSceneObjectId: undefined,
          })),
        }),
      ),
    }));

    setSelectedSceneObjectId(null);
    setActiveSceneObjectType(null);
    setTraceToolObjectId(null);
  }, []);

  const handleReconstructionChange = useCallback(
    (updates: Partial<AccidentReconstruction>) => {
      setReconstruction((current) => ({ ...current, ...updates }));
    },
    [],
  );

  const handleRunPhysics = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setReconstruction((current) => applyPhysicsSimulation(current));
    showSaveMessage(
      "Physics paths generated. Review the movement and save the reconstruction when satisfied.",
      "info",
      4000,
    );
  }, [showSaveMessage]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const startsFromBeginning =
      currentTimeRef.current <= 0.01 ||
      currentTimeRef.current >= reconstruction.durationSeconds;

    if (currentTimeRef.current >= reconstruction.durationSeconds) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }

    const settings = {
      ...DEFAULT_PHYSICS_SETTINGS,
      ...(reconstruction.physicsSettings ?? {}),
    };

    if (
      startsFromBeginning &&
      settings.enabled &&
      settings.mode === "Physics After Primary Impact" &&
      settings.autoRunOnPlay &&
      reconstruction.vehicles.length > 0
    ) {
      const simulated = applyPhysicsSimulation(reconstruction);
      setReconstruction(simulated);

      if ((simulated.lastPhysicsSimulation?.participantCollisions ?? 0) > 0) {
        showSaveMessage(
          "Collision response prepared: impact impulse, deflection, slide and natural stopping are active.",
          "info",
          3500,
        );
      } else if (reconstruction.vehicles.length > 1) {
        showSaveMessage(
          "The participants have no meaningful relative impact speed. Review their approach directions and impact speeds.",
          "info",
          4500,
        );
      }
    }

    setIsPlaying(true);
  }, [isPlaying, reconstruction, showSaveMessage]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    lastFrameTimeRef.current = null;
    lastPlaybackPaintRef.current = null;
  }, []);

  const handleSave = useCallback(() => {
    const recordToSave: AccidentReconstruction = caseContext
      ? {
          ...reconstruction,
          accidentId: caseContext.caseNumber,
        }
      : reconstruction;

    const validationErrors = validateReconstruction(recordToSave);

    if (validationErrors.length > 0) {
      showSaveMessage(validationErrors.join(" "), "error", 6000);
      return;
    }

    try {
      const saved = ReconstructionService.save(recordToSave);
      setReconstruction(saved);
      onReconstructionSaved?.(saved);
      showSaveMessage(
        caseContext
          ? `${caseContext.caseNumber} reconstruction saved.`
          : "Reconstruction saved successfully.",
        "success",
        2500,
      );
    } catch (error) {
      console.error("Failed to save reconstruction:", error);
      showSaveMessage(
        error instanceof Error
          ? error.message
          : "The reconstruction could not be saved.",
        "error",
        5000,
      );
    }
  }, [
    caseContext,
    onReconstructionSaved,
    reconstruction,
    showSaveMessage,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      lastPlaybackPaintRef.current = null;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      return;
    }

    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsedSeconds = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      const nextTime =
        currentTimeRef.current + elapsedSeconds * playbackSpeed;

      if (nextTime >= reconstruction.durationSeconds) {
        currentTimeRef.current = reconstruction.durationSeconds;
        setCurrentTime(reconstruction.durationSeconds);
        setIsPlaying(false);
        animationFrameRef.current = null;
        return;
      }

      currentTimeRef.current = nextTime;
      if (
        lastPlaybackPaintRef.current === null ||
        timestamp - lastPlaybackPaintRef.current >= 30
      ) {
        lastPlaybackPaintRef.current = timestamp;
        setCurrentTime(nextTime);
      }
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      lastFrameTimeRef.current = null;
      lastPlaybackPaintRef.current = null;
    };
  }, [isPlaying, playbackSpeed, reconstruction.durationSeconds]);

  useEffect(() => {
    if (!dragState && !traceToolObjectId && !routeDrawingParticipantId) {
      return;
    }

    const processPointerMove = () => {
      pointerMoveFrameRef.current = null;

      const coordinates = latestPointerPositionRef.current;

      if (!sceneRef.current || !coordinates) {
        return;
      }

      const position = clientToScenePosition(coordinates.clientX, coordinates.clientY);
      if (!position) return;

      if (routeDrawingParticipantIdRef.current) {
        const points = routeDraftPointsRef.current;
        const previous = points[points.length - 1];
        if (!previous || Math.hypot(position.x - previous.x, position.y - previous.y) >= 0.65) {
          routeDraftPointsRef.current = [...points, position].slice(-120);
        }
      }

      const traceObjectId = traceDrawingObjectIdRef.current;

      if (traceObjectId) {
        setReconstruction((current) => ({
          ...current,
          sceneObjects: current.sceneObjects.map((object) => {
            if (object.id !== traceObjectId) return object;

            const currentPoints = object.tracePoints ?? [];

            if (currentPoints.length >= MAX_TRACE_POINTS) {
              return object;
            }

            const previous = currentPoints[currentPoints.length - 1];

            if (
              previous &&
              Math.hypot(position.x - previous.x, position.y - previous.y) < 0.55
            ) {
              return object;
            }

            const tracePoints = [...currentPoints, position];

            return {
              ...object,
              tracePoints,
              position: getPointsCentroid(tracePoints),
            };
          }),
        }));
      }

      if (!dragState) return;

      if (dragState.kind === "participant-path-point") {
        updatePathPoint(dragState.participantId, dragState.pointId, {
          position,
        });
      } else if (dragState.kind === "scene-object") {
        updateSceneObject(dragState.objectId, { position });
      } else if (dragState.kind === "measurement-point") {
        updateMeasurement(dragState.measurementId, {
          [dragState.endpoint]: position,
        });
      } else if (dragState.kind === "evidence-record") {
        updateEvidenceRecord(dragState.evidenceId, { position });
      } else if (dragState.kind === "collision-point") {
        setReconstruction((current) =>
          FieldPlacementService.markManuallyAdjusted({
            reconstruction: {
              ...current,
              collisionPoint: position,
              collisionSetup: {
                source: "Manual",
                confirmed: current.collisionSetup?.confirmed ?? false,
                locked: current.collisionSetup?.locked ?? false,
                toleranceMetres: current.collisionSetup?.toleranceMetres ?? 2,
                notes: current.collisionSetup?.notes ?? "",
                lastCalculatedAt: new Date().toISOString(),
              },
            },
            targetType: "CollisionPoint",
            targetId: current.id,
          }),
        );
      } else {
        setReconstruction((current) => ({
          ...current,
          sceneObjects: current.sceneObjects.map((object) => {
            if (object.id !== dragState.objectId) return object;

            const tracePoints = [...(object.tracePoints ?? [])];
            tracePoints[dragState.pointIndex] = position;

            return {
              ...object,
              tracePoints,
              position: getPointsCentroid(tracePoints),
            };
          }),
        }));
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      latestPointerPositionRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if (pointerMoveFrameRef.current === null) {
        pointerMoveFrameRef.current = window.requestAnimationFrame(
          processPointerMove,
        );
      }
    };

    const handlePointerUp = () => {
      const finishedTracing = traceDrawingObjectIdRef.current !== null;
      const routeParticipantId = routeDrawingParticipantIdRef.current;
      const routePoints = routeDraftPointsRef.current;

      if (pointerMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveFrameRef.current);
        pointerMoveFrameRef.current = null;
      }

      latestPointerPositionRef.current = null;
      setDragState(null);
      traceDrawingObjectIdRef.current = null;
      routeDrawingParticipantIdRef.current = null;
      routeDraftPointsRef.current = [];

      if (finishedTracing) {
        setTraceToolObjectId(null);
      }

      if (routeParticipantId && routePoints.length >= 2) {
        setReconstruction((current) => ({
          ...current,
          physicsSettings: {
            ...DEFAULT_PHYSICS_SETTINGS,
            ...(current.physicsSettings ?? {}),
            autoRunOnPlay: false,
            liveSimulation: false,
          },
          lastPhysicsSimulation: undefined,
          vehicles: current.vehicles.map((participant) => {
            if (participant.id !== routeParticipantId) return participant;
            const sampleStep = Math.max(1, Math.ceil(routePoints.length / 16));
            const sampled = routePoints.filter((_, index) => index % sampleStep === 0);
            if (sampled[sampled.length - 1] !== routePoints[routePoints.length - 1]) sampled.push(routePoints[routePoints.length - 1]);
            const impactIndex = sampled.reduce((best, point, index) =>
              Math.hypot(point.x - current.collisionPoint.x, point.y - current.collisionPoint.y) <
              Math.hypot(sampled[best].x - current.collisionPoint.x, sampled[best].y - current.collisionPoint.y) ? index : best, 0);
            const points: MovementPathPoint[] = sampled.map((position, index) => ({
              id: createId("path-point"),
              label: index === 0 ? "Route start" : index === impactIndex ? "Primary impact" : index === sampled.length - 1 ? "Natural stop" : `Route ${index + 1}`,
              position: index === impactIndex ? current.collisionPoint : position,
              timeSeconds: (index / Math.max(1, sampled.length - 1)) * current.durationSeconds,
              speedKmh: index === sampled.length - 1 ? 0 : (participant.pathPoints[0]?.speedKmh ?? 40),
              rotation: participant.pathPoints[0]?.rotation ?? 0,
              action: index === 0 ? "Start" : index === impactIndex ? "Impact" : index === sampled.length - 1 ? "Stop" : "Cruise",
            }));
            return syncLegacyParticipantFields({
              ...participant,
              pathPoints: orientPathPointsToRoute(points),
            });
          }),
        }));
        setRouteDrawingParticipantId(null);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      if (pointerMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveFrameRef.current);
        pointerMoveFrameRef.current = null;
      }
    };
  }, [
    dragState,
    clientToScenePosition,
    routeDrawingParticipantId,
    traceToolObjectId,
    updateEvidenceRecord,
    updateMeasurement,
    updatePathPoint,
    updateSceneObject,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedSceneObject) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteSceneObject();
        return;
      }

      const amount = event.shiftKey ? 5 : 1;
      let x = selectedSceneObject.position.x;
      let y = selectedSceneObject.position.y;

      if (event.key === "ArrowLeft") x -= amount;
      else if (event.key === "ArrowRight") x += amount;
      else if (event.key === "ArrowUp") y -= amount;
      else if (event.key === "ArrowDown") y += amount;
      else return;

      event.preventDefault();
      updateSceneObject(selectedSceneObject.id, {
        position: {
          x: clamp(x, 0, 100),
          y: clamp(y, 0, 100),
        },
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSceneObject, selectedSceneObject, updateSceneObject]);

  const handleUndo = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
      const snapshot = historySnapshotRef.current;
      if (snapshot && snapshot !== reconstruction) undoStackRef.current.push(snapshot);
    }
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(reconstruction);
    applyingHistoryRef.current = true;
    historySnapshotRef.current = previous;
    setReconstruction(previous);
    setHistoryVersion((value) => value + 1);
  }, [reconstruction]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(reconstruction);
    applyingHistoryRef.current = true;
    historySnapshotRef.current = next;
    setReconstruction(next);
    setHistoryVersion((value) => value + 1);
  }, [reconstruction]);

  useEffect(() => {
    const handleHistoryKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handleRedo(); else handleUndo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleHistoryKeyDown);
    return () => window.removeEventListener("keydown", handleHistoryKeyDown);
  }, [handleRedo, handleUndo]);

  const handleDurationChange = (durationSeconds: number) => {
    const previousDuration = reconstruction.durationSeconds;

    setReconstruction((current) => ({
      ...current,
      durationSeconds,
      vehicles: current.vehicles.map((participant) => {
        const pathPoints = participant.pathPoints.map((point, index, points) => ({
          ...point,
          timeSeconds:
            index === points.length - 1 && point.timeSeconds === previousDuration
              ? durationSeconds
              : clamp(point.timeSeconds, 0, durationSeconds),
        }));

        return syncLegacyParticipantFields({ ...participant, pathPoints });
      }),
      timelineEvents: current.timelineEvents.map((event) => ({
        ...event,
        timeSeconds: clamp(event.timeSeconds, 0, durationSeconds),
      })),
    }));

    setCurrentTime((time) => Math.min(time, durationSeconds));
  };

  const sceneCursorClass =
    activeSceneObjectType ||
    traceToolObjectId ||
    collisionPlacementActive ||
    measurementToolActive ||
    activeEvidencePlacementId
      ? "cursor-crosshair"
      : "";

  return (
    <div className="min-h-screen bg-gray-100 p-4 lg:p-6">
      <div className="mx-auto max-w-[2200px]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              {caseContext ? caseContext.caseNumber : "RoadSafe AR"}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Accident Reconstruction Editor
            </h1>
            {caseContext && (
              <p className="mt-1 text-sm font-semibold text-indigo-700">
                Linked case: {caseContext.caseTitle}
              </p>
            )}
            <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600">
              Build detailed multi-point movement paths, connect actions to the
              timeline and trace curved physical evidence directly on the road.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {saveMessage && (
              <span
                role={saveMessageType === "error" ? "alert" : "status"}
                className={`max-w-xl rounded-lg px-3 py-2 text-sm font-semibold ${
                  saveMessageType === "error"
                    ? "bg-red-50 text-red-700"
                    : saveMessageType === "info"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-green-50 text-green-700"
                }`}
              >
                {saveMessage}
              </span>
            )}

            {caseContext ? (
              <>
                <Link
                  to={caseContext.casePath}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
                >
                  ← Back to Case
                </Link>

                <Link
                  to={caseContext.reportPath}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 active:scale-95"
                >
                  View Report
                </Link>

                <Link
                  to={caseContext.footagePath}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 active:scale-95"
                >
                  Saved Footage
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
                >
                  ← Back to Dashboard
                </Link>

                <Link
                  to="/cases"
                  className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 active:scale-95"
                >
                  Accident Cases
                </Link>

                <Link
                  to="/cases/new"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 active:scale-95"
                >
                  + New Case
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => openFieldPlacementForTarget(null)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-5 py-3 font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100 active:scale-95"
            >
              Field GPS Placement
            </button>

            {caseContext && (
              <ReconstructionRecorder
                reconstruction={reconstruction}
                caseId={caseContext.caseId}
                caseNumber={caseContext.caseNumber}
                recordedBy={caseContext.recordedBy}
                onBeforeRecord={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                  currentTimeRef.current = 0;
                  const physicsSettings = {
                    ...DEFAULT_PHYSICS_SETTINGS,
                    ...(reconstruction.physicsSettings ?? {}),
                  };
                  const preparedReconstruction =
                    physicsSettings.enabled &&
                    physicsSettings.mode === "Physics After Primary Impact" &&
                    physicsSettings.autoRunOnPlay &&
                    reconstruction.vehicles.length > 0
                      ? applyPhysicsSimulation(reconstruction)
                      : reconstruction;
                  const recordToSave = {
                    ...preparedReconstruction,
                    accidentId: caseContext.caseNumber,
                  };
                  const saved = ReconstructionService.save(recordToSave);
                  setReconstruction(saved);
                  onReconstructionSaved?.(saved);
                  return saved;
                }}
                onSaved={(footage) => {
                  onFootageSaved?.(footage);
                  showSaveMessage(
                    "Reconstruction footage saved to the case.",
                    "success",
                    3000,
                  );
                }}
              />
            )}

            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
            >
              Save Reconstruction
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700">View</span>
            <div className="flex rounded-lg border border-gray-300 bg-gray-50 p-1">
            {(["2D", "3D"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveReconstructionView(view);
                }}
                className={`rounded-md px-5 py-2 text-sm font-bold transition ${activeReconstructionView === view ? "bg-slate-900 text-white shadow-sm" : "text-gray-600 hover:bg-white"}`}
              >
                {view === "2D" ? "2D" : "3D"}
              </button>
            ))}
            </div>
          </div>
          <span className="text-xs text-gray-500">Only the selected view runs.</span>
        </div>

        {activeReconstructionView === "3D" && (
          <Suspense fallback={<div className="rounded-2xl bg-slate-950 p-8 text-center text-sm font-bold text-sky-200">Loading interactive 3D reconstruction…</div>}>
            <Reconstruction3DViewer
              reconstruction={reconstruction}
              onSwitchTo2D={() => setActiveReconstructionView("2D")}
              onRunPhysics={handleRunPhysics}
            />
          </Suspense>
        )}

        <div className={`${activeReconstructionView === "3D" ? "hidden" : "grid"} items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)_310px] 2xl:grid-cols-[280px_minmax(0,1fr)_330px]`}>
          <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Accident Case</h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Reconstruction title
                </span>
                <input
                  value={reconstruction.title}
                  onChange={(event) =>
                    setReconstruction((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="text-xs font-medium text-gray-700">
                    Accident ID
                  </span>
                  <input
                    value={caseContext?.caseNumber ?? reconstruction.accidentId}
                    disabled={Boolean(caseContext)}
                    onChange={(event) =>
                      setReconstruction((current) => ({
                        ...current,
                        accidentId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  {caseContext && (
                    <span className="mt-1 block text-[10px] text-gray-500">
                      Locked to the current accident case.
                    </span>
                  )}
                </label>

                <label>
                  <span className="text-xs font-medium text-gray-700">
                    Junction ID
                  </span>
                  <input
                    value={reconstruction.junctionId}
                    onChange={(event) =>
                      setReconstruction((current) => ({
                        ...current,
                        junctionId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Description
                </span>
                <textarea
                  value={reconstruction.description}
                  onChange={(event) =>
                    setReconstruction((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Duration: {reconstruction.durationSeconds}s
                </span>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={reconstruction.durationSeconds}
                  onChange={(event) =>
                    handleDurationChange(Number(event.target.value))
                  }
                  className="mt-2 w-full"
                />
              </label>
            </div>

            <SceneSettingsPanel
              settings={reconstruction.scene}
              onChange={updateSceneSettings}
            />

            <SceneObjectPalette
              activeType={activeSceneObjectType}
              objects={reconstruction.sceneObjects}
              selectedObjectId={selectedSceneObjectId}
              onToolSelect={(type) => {
                setActiveSceneObjectType(type);
                setTraceToolObjectId(null);
                setCollisionPlacementActive(false);
                setSelectedParticipantId(null);
              }}
              onPlaceActiveWithGps={handlePlaceActiveSceneObjectWithGps}
              onCancelPlacement={() => setActiveSceneObjectType(null)}
              onSelectObject={handleSelectSceneObject}
              onClearObjects={handleClearSceneObjects}
            />

            <div className="mt-6 border-t border-gray-200 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-gray-900">Scene Participants</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={newParticipantType}
                    onChange={(event) =>
                      setNewParticipantType(
                        event.target.value as ReconstructionVehicleType,
                      )
                    }
                    className="rounded-lg border border-gray-300 px-2 py-2 text-xs"
                  >
                    {PARTICIPANT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddParticipant}
                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {reconstruction.vehicles.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => handleSelectParticipant(participant.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selectedParticipantId === participant.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-gray-300"
                      style={{
                        backgroundColor: getParticipantColour(participant.colour),
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {participant.name}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {participant.originLocation || "Origin not set"} →{" "}
                        {participant.destinationLocation || "destination not set"}
                      </span>
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">
                      {participant.pathPoints.length} pts
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main
            className={`min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${
              sceneExpanded
                ? "fixed inset-2 z-[100] flex flex-col shadow-2xl sm:inset-4"
                : ""
            }`}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
              <div>
                <h2 className="font-bold text-gray-900">
                  Reconstruction Scene
                </h2>
                <p className="text-xs text-gray-500">
                  Full calibrated area: {reconstruction.scene.sceneWidthMetres}m × {reconstruction.scene.sceneHeightMetres}m. Drag movement points or expand for detailed placement.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(["Diagram", "Street", "Satellite"] as ReconstructionBasemapMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBasemapMode(mode)}
                      className={`rounded-md px-2.5 py-1.5 text-[10px] font-black ${basemapMode === mode ? "bg-white text-blue-700 shadow" : "text-gray-500 hover:text-gray-900"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={handleUndo} disabled={undoStackRef.current.length === 0 && historyTimerRef.current === null} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-black disabled:opacity-40">Undo</button>
                <button type="button" onClick={handleRedo} disabled={redoStackRef.current.length === 0} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-black disabled:opacity-40">Redo</button>
                <button
                  type="button"
                  disabled={!selectedParticipantId}
                  onClick={() => setRouteDrawingParticipantId((current) => current ? null : selectedParticipantId)}
                  className={`rounded-lg px-3 py-2 text-xs font-black text-white disabled:bg-gray-400 ${routeDrawingParticipantId ? "bg-rose-600" : "bg-cyan-700 hover:bg-cyan-800"}`}
                >
                  {routeDrawingParticipantId ? "Cancel Route" : "Draw Route"}
                </button>
                <span className="rounded-full bg-green-100 px-2 py-1 font-bold text-green-700">
                  Start
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-700">
                  Brake
                </span>
                <span className="rounded-full bg-cyan-100 px-2 py-1 font-bold text-cyan-700">
                  Turn / Swerve
                </span>
                <span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-700">
                  Impact
                </span>
                <button
                  type="button"
                  onClick={() => setSceneExpanded((current) => !current)}
                  className="ml-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-700"
                  aria-pressed={sceneExpanded}
                  title={sceneExpanded ? "Return to the editor layout" : "Use the largest available scene viewport"}
                >
                  {sceneExpanded ? "Exit Expanded View" : "Expand Map View"}
                </button>
              </div>
            </div>

            <div
              ref={sceneRef}
              onPointerDown={handleScenePointerDown}
              className={`relative isolate touch-none overflow-hidden bg-slate-600 ${
                sceneExpanded
                  ? "min-h-[320px] flex-1"
                  : ""
              } ${sceneCursorClass}`}
              style={
                sceneExpanded
                  ? undefined
                  : { height: "clamp(700px, 76vh, 1000px)" }
              }
            >
              <div data-scene-interactive="true" className="absolute right-3 top-3 z-[90] grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-2 text-white shadow-xl backdrop-blur">
                <span />
                <button type="button" onClick={() => setSceneView((view) => ({ ...view, panY: view.panY + 40 }))} className="rounded bg-white/15 p-2 font-black">↑</button>
                <button type="button" onClick={() => setSceneView((view) => ({ ...view, zoom: Math.min(2.5, view.zoom + 0.2) }))} className="rounded bg-white/15 p-2 font-black">+</button>
                <button type="button" onClick={() => setSceneView((view) => ({ ...view, panX: view.panX + 40 }))} className="rounded bg-white/15 p-2 font-black">←</button>
                <button type="button" onClick={() => setSceneView({ zoom: 1, panX: 0, panY: 0 })} className="rounded bg-white/15 p-2 text-[9px] font-black">FIT</button>
                <button type="button" onClick={() => setSceneView((view) => ({ ...view, panX: view.panX - 40 }))} className="rounded bg-white/15 p-2 font-black">→</button>
                <button type="button" onClick={() => setSceneView((view) => ({ ...view, zoom: Math.max(0.65, view.zoom - 0.2) }))} className="rounded bg-white/15 p-2 font-black">−</button>
                <button type="button" onClick={() => setSceneView((view) => ({ ...view, panY: view.panY - 40 }))} className="rounded bg-white/15 p-2 font-black">↓</button>
                <span className="self-center text-center text-[9px] font-black">{Math.round(sceneView.zoom * 100)}%</span>
              </div>

              {routeDrawingParticipantId && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[95] -translate-x-1/2 rounded-full bg-cyan-800 px-4 py-2 text-xs font-black text-white shadow-lg">
                  Hold and draw the complete route; release to create editable points through the collision
                </div>
              )}

              <div
                className="absolute inset-0 origin-center"
                style={{ transform: `translate(${sceneView.panX}px, ${sceneView.panY}px) scale(${sceneView.zoom})` }}
              >
              {basemapMode === "Diagram" ? (
                <RoadSceneEnvironment settings={reconstruction.scene} />
              ) : (
                <ReconstructionBasemap calibration={reconstruction.fieldCalibration} mode={basemapMode} />
              )}

              {collisionPlacementActive && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full bg-red-700 px-4 py-2 text-xs font-black text-white shadow-lg">
                  Click the exact primary collision location on the road scene
                </div>
              )}

              <button
                type="button"
                data-scene-interactive="true"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!reconstruction.collisionSetup?.locked) {
                    setDragState({ kind: "collision-point" });
                  }
                }}
                className={`absolute z-[55] -translate-x-1/2 -translate-y-1/2 ${
                  reconstruction.collisionSetup?.locked ? "cursor-not-allowed" : "cursor-move"
                }`}
                style={{
                  left: `${reconstruction.collisionPoint.x}%`,
                  top: `${reconstruction.collisionPoint.y}%`,
                }}
                title="Primary collision point — drag to reposition when unlocked"
              >
                {!isPlaying && <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-red-500/20" />}
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-red-600 text-[10px] font-black text-white shadow-xl ring-4 ring-red-500/25">
                  HIT
                </span>
                <span className="absolute left-1/2 top-11 w-max -translate-x-1/2 rounded-md bg-red-950/90 px-2 py-1 text-[9px] font-black text-white shadow">
                  Primary collision
                </span>
              </button>

              <ImpactEffectOverlay effect={impactEffect} />

              {measurementToolActive && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-sky-700 px-4 py-2 text-xs font-bold text-white shadow-lg">
                  {measurementDraftStart
                    ? "Click the measurement end point"
                    : "Click the measurement start point"}
                </div>
              )}

              {activeEvidencePlacementId && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-gray-950 shadow-lg">
                  Click the scene to position the selected evidence marker
                </div>
              )}

              {activeSceneObjectType && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-lg">
                  Click to place: {activeSceneObjectType}
                </div>
              )}

              {traceToolObjectId && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-lg">
                  Hold and drag to trace a curved {selectedSceneObject?.type}
                </div>
              )}

              {reconstruction.sceneObjects.map((object) => (
                <SceneObjectRenderer
                  key={object.id}
                  object={object}
                  selected={selectedSceneObjectId === object.id}
                  onSelect={() => handleSelectSceneObject(object.id)}
                  onPointerDown={(event) =>
                    handleSceneObjectPointerDown(event, object)
                  }
                />
              ))}

              <MeasurementOverlay
                measurements={reconstruction.measurements}
                selectedMeasurementId={selectedMeasurementId}
                draftStart={measurementDraftStart}
                onSelect={(measurementId) => {
                  setSelectedMeasurementId(measurementId);
                  setSelectedEvidenceId(null);
                  setSelectedParticipantId(null);
                  setSelectedSceneObjectId(null);
                }}
                onEndpointPointerDown={handleMeasurementEndpointPointerDown}
              />

              <EvidenceMarkerLayer
                records={reconstruction.evidenceRecords}
                selectedEvidenceId={selectedEvidenceId}
                onSelect={(evidenceId) => {
                  setSelectedEvidenceId(evidenceId);
                  setSelectedMeasurementId(null);
                  setSelectedParticipantId(null);
                  setSelectedSceneObjectId(null);
                }}
                onPointerDown={handleEvidencePointerDown}
              />

              {selectedSceneObject?.tracePoints &&
                selectedSceneObject.tracePoints.length >= 2 &&
                getEditableTracePointIndices(
                  selectedSceneObject.tracePoints.length,
                ).map((pointIndex) => {
                  const point = selectedSceneObject.tracePoints?.[pointIndex];
                  if (!point) return null;

                  return (
                    <button
                      key={`${selectedSceneObject.id}-trace-${pointIndex}`}
                      type="button"
                      data-scene-interactive="true"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragState({
                          kind: "scene-object-trace-point",
                          objectId: selectedSceneObject.id,
                          pointIndex,
                        });
                      }}
                      className="absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-purple-500 shadow"
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      title={`Curve point ${pointIndex + 1}`}
                    />
                  );
                })}

              {reconstruction.vehicles.map((participant, participantIndex) => {
                const state = getParticipantStateAtTime(participant, currentTime);
                const pathPoints = sortMovementPathPoints(participant.pathPoints);
                const { path, skidPath } = getParticipantPathGeometry(participant.pathPoints);
                const activeAction = pathPoints.find((point) => point.id === state.activePointId)?.action;
                const vectorLength = Math.min(14, 3 + state.speedKmh / 8);
                const vectorRadians = (state.rotation * Math.PI) / 180;
                const vectorEnd = {
                  x: clamp(
                    state.position.x + Math.cos(vectorRadians) * vectorLength,
                    0,
                    100,
                  ),
                  y: clamp(
                    state.position.y + Math.sin(vectorRadians) * vectorLength,
                    0,
                    100,
                  ),
                };
                const nearImpact =
                  Math.hypot(
                    state.position.x - impactEffect.position.x,
                    state.position.y - impactEffect.position.y,
                  ) <= 12;
                const shakeStrength =
                  impactEffect.active && nearImpact
                    ? (1 - impactEffect.progress) * 5 * impactEffect.intensity
                    : 0;
                const shakePhase =
                  impactEffect.progress * 72 + participantIndex * 2.4;
                const shakeX = Math.sin(shakePhase) * shakeStrength;
                const shakeY = Math.cos(shakePhase * 1.31) * shakeStrength * 0.65;
                const rotationShake = Math.sin(shakePhase * 0.83) * shakeStrength * 0.8;

                return (
                  <div key={participant.id}>
                    <svg
                      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d={path}
                        fill="none"
                        stroke={getParticipantColour(participant.colour)}
                        strokeWidth="0.45"
                        strokeDasharray="1.6 1.1"
                        strokeLinecap="round"
                        opacity={selectedParticipantId === participant.id ? 1 : 0.65}
                        vectorEffect="non-scaling-stroke"
                      />
                      {skidPath && (
                        <path
                          d={skidPath}
                          fill="none"
                          stroke="#111827"
                          strokeWidth="1.15"
                          strokeLinecap="round"
                          opacity="0.72"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>

                    {reconstruction.physicsSettings?.showVelocityVectors && (
                      <svg
                        className="pointer-events-none absolute inset-0 z-[18] h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <line
                          x1={state.position.x}
                          y1={state.position.y}
                          x2={vectorEnd.x}
                          y2={vectorEnd.y}
                          stroke={getParticipantColour(participant.colour)}
                          strokeWidth={0.7}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          cx={vectorEnd.x}
                          cy={vectorEnd.y}
                          r={0.8}
                          fill={getParticipantColour(participant.colour)}
                          stroke="white"
                          strokeWidth={0.25}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}

                    {reconstruction.physicsSettings?.showVelocityVectors && (
                      <span
                        className="pointer-events-none absolute z-[32] -translate-x-1/2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[9px] font-black text-white shadow"
                        style={{
                          left: `${vectorEnd.x}%`,
                          top: `${vectorEnd.y}%`,
                        }}
                      >
                        {state.speedKmh.toFixed(0)} km/h
                      </span>
                    )}

                    {!isPlaying && getVisibleParticipantControlPoints(pathPoints).map((point, index) => (
                      <button
                        key={point.id}
                        type="button"
                        data-scene-interactive="true"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleSelectParticipant(participant.id, point.id);
                          setDragState({
                            kind: "participant-path-point",
                            participantId: participant.id,
                            pointId: point.id,
                          });
                        }}
                        className={`absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[9px] font-black text-white shadow ${
                          selectedPathPointId === point.id
                            ? "ring-4 ring-blue-300/60"
                            : ""
                        }`}
                        style={{
                          left: `${point.position.x}%`,
                          top: `${point.position.y}%`,
                          backgroundColor: getPathPointColour(point),
                        }}
                        title={`${participant.name}: ${point.label} at ${point.timeSeconds.toFixed(1)}s`}
                      >
                        {index + 1}
                      </button>
                    ))}

                    {(activeAction === "Brake" || activeAction === "Slide") && state.speedKmh > 5 && (
                      <div
                        className="pointer-events-none absolute z-[28] -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${state.position.x}%`, top: `${state.position.y}%` }}
                      >
                        <span className="absolute h-8 w-8 -translate-x-5 -translate-y-2 rounded-full bg-slate-200/35" />
                        <span className="absolute h-5 w-5 -translate-x-8 translate-y-1 rounded-full bg-white/35" />
                      </div>
                    )}

                    <button
                      type="button"
                      data-scene-interactive="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSelectParticipant(participant.id, state.activePointId);
                      }}
                      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${state.position.x}%`,
                        top: `${state.position.y}%`,
                        transform: `translate(-50%, -50%) translate(${shakeX}px, ${shakeY}px) rotate(${state.rotation + rotationShake}deg)`,
                      }}
                      title={`${participant.name} — ${state.speedKmh.toFixed(0)} km/h`}
                    >
                      <ParticipantShape
                        participant={participant}
                        selected={selectedParticipantId === participant.id}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            </div>

            <div className="shrink-0 border-t border-gray-200 p-4">
              <input
                type="range"
                min={0}
                max={reconstruction.durationSeconds}
                step={0.01}
                value={currentTime}
                onChange={(event) => {
                  setIsPlaying(false);
                  setCurrentTime(Number(event.target.value));
                }}
                className="w-full"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    disabled={reconstruction.vehicles.length === 0}
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    {currentTime.toFixed(1)}s / {reconstruction.durationSeconds}s
                  </span>
                  <select
                    value={playbackSpeed}
                    onChange={(event) =>
                      setPlaybackSpeed(Number(event.target.value))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value={0.25}>0.25×</option>
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={1.5}>1.5×</option>
                    <option value={2}>2×</option>
                  </select>
                </div>
              </div>
            </div>
          </main>

          <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            {selectedSceneObject ? (
              <SceneObjectSettingsPanel
                object={selectedSceneObject}
                tracing={traceToolObjectId === selectedSceneObject.id}
                onChange={(updates) =>
                  updateSceneObject(selectedSceneObject.id, updates)
                }
                onDelete={handleDeleteSceneObject}
                onDuplicate={handleDuplicateSceneObject}
                onPlaceWithGps={handlePlaceSelectedSceneObjectWithGps}
                onBeginTrace={() => {
                  setTraceToolObjectId(selectedSceneObject.id);
                  setActiveSceneObjectType(null);
                }}
                onCancelTrace={() => setTraceToolObjectId(null)}
                onClearTrace={() =>
                  updateSceneObject(selectedSceneObject.id, {
                    tracePoints: [],
                  })
                }
              />
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900">
                  Participant Settings
                </h2>

                {!selectedParticipant ? (
                  <p className="mt-5 rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                    Select or add a participant to edit movement and route details.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Name</span>
                      <input
                        value={selectedParticipant.name}
                        onChange={(event) =>
                          updateParticipant(selectedParticipant.id, {
                            name: event.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="text-xs font-medium text-gray-700">
                          Type
                        </span>
                        <select
                          value={selectedParticipant.type}
                          onChange={(event) =>
                            handleParticipantTypeChange(
                              selectedParticipant,
                              event.target.value as ReconstructionVehicleType,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          {PARTICIPANT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="text-xs font-medium text-gray-700">
                          Colour
                        </span>
                        <select
                          value={selectedParticipant.colour}
                          onChange={(event) =>
                            updateParticipant(selectedParticipant.id, {
                              colour: event.target
                                .value as ReconstructionVehicleColour,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          {PARTICIPANT_COLOURS.map((colour) => (
                            <option key={colour} value={colour}>
                              {colour}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {isHumanParticipant(selectedParticipant.type) && (
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="text-xs font-medium text-gray-700">
                            Person role
                          </span>
                          <select
                            value={selectedParticipant.role ?? "Pedestrian"}
                            onChange={(event) =>
                              updateParticipant(selectedParticipant.id, {
                                role: event.target
                                  .value as ReconstructionVehicle["role"],
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                          >
                            <option value="Driver">Driver</option>
                            <option value="Passenger">Passenger</option>
                            <option value="Pedestrian">Pedestrian</option>
                            <option value="Cyclist">Cyclist</option>
                            <option value="Officer">Officer</option>
                            <option value="Witness">Witness</option>
                          </select>
                        </label>

                        <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                          <span className="text-xs font-medium text-gray-700">
                            Injured
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedParticipant.injured ?? false}
                            onChange={(event) =>
                              updateParticipant(selectedParticipant.id, {
                                injured: event.target.checked,
                              })
                            }
                            className="h-5 w-5"
                          />
                        </label>
                      </div>
                    )}

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        Default speed: {selectedParticipant.estimatedSpeedKmh} km/h
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={getMaximumSpeed(selectedParticipant.type)}
                        step={isHumanParticipant(selectedParticipant.type) ? 1 : 5}
                        value={selectedParticipant.estimatedSpeedKmh}
                        onChange={(event) =>
                          updateParticipant(selectedParticipant.id, {
                            estimatedSpeedKmh: Number(event.target.value),
                          })
                        }
                        className="mt-2 w-full"
                      />
                    </label>

                    <ParticipantPathPanel
                      participant={selectedParticipant}
                      durationSeconds={reconstruction.durationSeconds}
                      sceneObjects={reconstruction.sceneObjects}
                      selectedPointId={selectedPathPointId}
                      onSelectPoint={setSelectedPathPointId}
                      onParticipantChange={(updates) =>
                        updateParticipant(selectedParticipant.id, updates)
                      }
                      onPointChange={(pointId, updates) =>
                        updatePathPoint(selectedParticipant.id, pointId, updates)
                      }
                      onAddPoint={handleAddPathPoint}
                      onDeletePoint={handleDeletePathPoint}
                      onPlacePointWithGps={handlePlaceParticipantPointWithGps}
                      onJumpToTime={(time) => {
                        setIsPlaying(false);
                        setCurrentTime(time);
                      }}
                      onHeadingChange={handleParticipantHeadingChange}
                    />

                    <button
                      type="button"
                      onClick={handleDeleteParticipant}
                      className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      Delete Participant
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>

        </div>

        <CollisionSetupPanel
          reconstruction={reconstruction}
          placementActive={collisionPlacementActive}
          onChange={handleReconstructionChange}
          onBeginPlacement={() => {
            if (reconstruction.collisionSetup?.locked) return;
            setIsPlaying(false);
            setCollisionPlacementActive(true);
            setMeasurementToolActive(false);
            setMeasurementDraftStart(null);
            setActiveEvidencePlacementId(null);
            setActiveSceneObjectType(null);
            setTraceToolObjectId(null);
          }}
          onCancelPlacement={() => setCollisionPlacementActive(false)}
        />

        <PhysicsControlsPanel
          reconstruction={reconstruction}
          onChange={handleReconstructionChange}
          onRunPhysics={handleRunPhysics}
        />

        <ReconstructionValidationPanel reconstruction={reconstruction} />

        <ReconstructionScenarioWorkspace
          reconstruction={reconstruction}
          onLoadScenario={(scenario) => {
            setIsPlaying(false);
            setCurrentTime(0);
            currentTimeRef.current = 0;
            setReconstruction(structuredClone(scenario.snapshot));
            showSaveMessage(`${scenario.name} loaded into the editor. The saved scenario remains unchanged until you explicitly replace it.`, "info", 4500);
          }}
        />

        <ReconstructionGuide />

<EvidenceWorkspacePanel
  measurements={reconstruction.measurements}
  selectedMeasurementId={selectedMeasurementId}
  measurementToolActive={measurementToolActive}
  measurementDraftStarted={measurementDraftStart !== null}
  evidenceRecords={reconstruction.evidenceRecords}
  selectedEvidenceId={selectedEvidenceId}
  activeEvidencePlacementId={activeEvidencePlacementId}
  photos={reconstruction.photos}
  participants={reconstruction.vehicles}
  sceneObjects={reconstruction.sceneObjects}
  timelineEvents={reconstruction.timelineEvents}
  onSelectMeasurement={setSelectedMeasurementId}
  onBeginMeasurement={() => {
    setMeasurementToolActive(true);
    setCollisionPlacementActive(false);
    setMeasurementDraftStart(null);
    setActiveEvidencePlacementId(null);
    setActiveSceneObjectType(null);
    setTraceToolObjectId(null);
  }}
  onCancelMeasurement={() => {
    setMeasurementToolActive(false);
    setMeasurementDraftStart(null);
  }}
  onMeasurementChange={updateMeasurement}
  onDeleteMeasurement={handleDeleteMeasurement}
  onSelectEvidence={setSelectedEvidenceId}
  onAddEvidence={handleAddEvidence}
  onEvidenceChange={updateEvidenceRecord}
  onDeleteEvidence={handleDeleteEvidence}
  onBeginEvidencePlacement={(evidenceId) => {
    setActiveEvidencePlacementId(evidenceId);
    setCollisionPlacementActive(false);
    setMeasurementToolActive(false);
    setMeasurementDraftStart(null);
    setActiveSceneObjectType(null);
    setTraceToolObjectId(null);
  }}
  onCancelEvidencePlacement={() =>
    setActiveEvidencePlacementId(null)
  }
  onAddPhoto={(photo) =>
    setReconstruction((current) => ({
      ...current,
      photos: [
        ...current.photos,
        photo,
      ],

      evidenceRecords:
        photo.linkedEvidenceId
          ? current.evidenceRecords.map(
              (record) =>
                record.id ===
                photo.linkedEvidenceId
                  ? {
                      ...record,

                      photoIds: Array.from(
                        new Set([
                          ...record.photoIds,
                          photo.id,
                        ]),
                      ),
                    }
                  : record,
            )
          : current.evidenceRecords,
    }))
  }
  onPhotoChange={(photoId, updates) => {
    const linkChanged =
      Object.prototype.hasOwnProperty.call(
        updates,
        "linkedEvidenceId",
      );

    updatePhoto(
      photoId,
      updates,
    );

    if (linkChanged) {
      setReconstruction(
        (current) => ({
          ...current,

          evidenceRecords:
            current.evidenceRecords.map(
              (record) => ({
                ...record,

                photoIds:
                  record.id ===
                  updates.linkedEvidenceId
                    ? Array.from(
                        new Set([
                          ...record.photoIds,
                          photoId,
                        ]),
                      )
                    : record.photoIds.filter(
                        (id) =>
                          id !== photoId,
                      ),
              }),
            ),
        }),
      );
    }
  }}
  onDeletePhoto={(photoId) =>
    setReconstruction((current) => ({
      ...current,

      photos:
        current.photos.filter(
          (photo) =>
            photo.id !== photoId,
        ),

      evidenceRecords:
        current.evidenceRecords.map(
          (record) => ({
            ...record,

            photoIds:
              record.photoIds.filter(
                (id) =>
                  id !== photoId,
              ),
          }),
        ),
    }))
  }
/>

<AccidentTimeline
          durationSeconds={reconstruction.durationSeconds}
          currentTime={currentTime}
          participants={reconstruction.vehicles}
          sceneObjects={reconstruction.sceneObjects}
          events={reconstruction.timelineEvents}
          onEventsChange={(timelineEvents) =>
            setReconstruction((current) => ({
              ...current,
              timelineEvents,
            }))
          }
          onSeek={(time) => {
            setIsPlaying(false);
            setCurrentTime(time);
          }}
          onSelectParticipantPathPoint={(participantId, pointId) =>
            handleSelectParticipant(participantId, pointId)
          }
          onSelectSceneObject={handleSelectSceneObject}
        />

        {fieldPlacementOpen && (
          <FieldPlacementPanel
            open
            reconstruction={reconstruction}
            officerName={caseContext?.recordedBy ?? ""}
            currentTimeSeconds={currentTime}
            initialTarget={fieldPlacementInitialTarget}
            onClose={handleCloseFieldPlacement}
            onPlacementConfirmed={handleFieldPlacementConfirmed}
            onUpdate={(updater) => setReconstruction(updater)}
          />
        )}
      </div>
    </div>
  );
}
