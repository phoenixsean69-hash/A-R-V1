import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";
import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import type { DragEvent as ReactDragEvent } from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronUp,
  ClipboardList,
  Crosshair,
  Expand,
  FileSearch,
  Image as ImageIcon,
  Layers3,
  Move,
  RotateCw,
  Ruler,
  Save,
  ScanLine,
  X,
} from "../icons/materialIcons";

import {
  useWorkspaceRightPanelHost,
} from "../layout/WorkspaceRightPanelContext";

import { ReconstructionService } from "../../services/reconstructionService";
import { FieldPlacementService } from "../../services/fieldPlacementService";
import {
  DEFAULT_PHYSICS_SETTINGS,
  applyPhysicsSimulation,
  derivePrimaryCollisionPoint,
  getDefaultParticipantPhysics,
  preparePhysicsForPlayback,
} from "../../services/reconstructionPhysicsService";
import {
  getSuggestedFrictionCoefficient,
  validateReconstruction as runAuditValidation,
} from "../../services/reconstructionValidationService";
import {
  ReconstructionScenarioService,
  type ReconstructionScenario,
} from "../../services/reconstructionScenarioService";
import { getSceneObjectCatalogItem } from "../../data/sceneObjectCatalog";
import {
  PARTICIPANT_ASSET_CATALOG,
  getDefaultParticipantAssetId,
  getParticipantAssetsForType,
} from "../../engine/assets/participantAssetCatalog";

import ReconstructionBottomDock from "./ReconstructionBottomDock";
import {
  hasRoadSafeSceneAssetDrag,
  readRoadSafeSceneAssetDrag,
} from "../../engine/assets/sceneAssetDragData";
import ReconstructionRecorder from "../footage/ReconstructionRecorder";
import FieldPlacementPanel from "../fieldPlacement/FieldPlacementPanel";
import EvidenceMarkerLayer from "./EvidenceMarkerLayer";
import { EvidenceWorkspacePanel } from "./EvidenceWorkspace";
import MeasurementOverlay from "./MeasurementLayer";
import ParticipantPathPanel from "./ParticipantPathPanel";
import ParticipantPlacementOverlay from "./ParticipantPlacementOverlay";
import RoadSceneEnvironment from "./RoadSceneEnvironment";
import ReconstructionBasemap from "./ReconstructionBasemap";
import type { ReconstructionBasemapMode } from "./ReconstructionBasemap";
import SceneObjectPalette from "./SceneObjectPalette";
import SceneObjectRenderer from "./SceneObjectRenderer";
import SceneObjectSettingsPanel from "./SceneObjectSettingsPanel";
import SceneSettingsPanel from "./SceneSettingsPanel";
import ReconstructionPhysicsContextEditor from "./ReconstructionPhysicsContextEditor";
import SceneCollectionAssetBrowser from "./SceneCollectionAssetBrowser";
import Participant2DModel from "./Participant2DModel";
import ReconstructionGuide from "./ReconstructionGuide";
import TransformGizmo2D from "./TransformGizmo2D";
import ReconstructionValidationPanel from "./ReconstructionValidationPanel";
import ReconstructionScenarioWorkspace from "./ReconstructionScenarioWorkspace";

import type {
  AccidentReconstruction,
  EvidenceRecord,
  MovementPathPoint,
  ReconstructionPosition,
  ReconstructionParticipantAssetId,
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
import type {
  AveragedLocationResult,
  FieldCaptureMode,
  FieldPlacementTarget,
  FieldSceneCalibration,
  GeoCoordinate,
} from "../../types/fieldPlacement";

import { createDefaultRoadSceneSettings } from "../../types/reconstruction";

import {
  buildSmoothSvgPath,
  clamp,  getParticipantPlaybackPathPoints,

  getParticipantStateAtTime,
  getPointsCentroid,
  getReconstructionImpactEffectState,
  isPhysicsGeneratedPathPoint,
  isTraceableSceneObjectType,
  shiftSceneObjectTrace,
  sortMovementPathPoints,
  syncLegacyParticipantFields,
} from "../../utils/reconstructionGeometry";

import {
  isPointZ,
  normalisePointZRoute,
} from "../../utils/participantRouteAuthoring";

import {
  canBeginRoutePointDrag,
  changeParticipantApproachHeading,
  createParticipantAtConfirmedPosition,
  deleteParticipantIntermediatePoint,
  insertParticipantIntermediatePoint,
  normaliseAllPointZRoutes,
  replaceParticipantRouteFromDrawing,
  updateParticipantAuthoredPoint,
  updateReconstructionCollisionPoint,
  type PendingParticipantPlacement,
} from "../../utils/reconstructionPointZIntegration";

import {
  updateMeasurementDistance,
} from "../../utils/evidenceGeometry";

import {
  coordinateToScenePosition,
  localOffsetToCoordinate,
} from "../../utils/geographicCoordinates";

import { paintReconstructionPlaybackDomFrame } from "../../utils/reconstructionPlaybackDom";

import "./reconstructionPlaybackFixes.css";
import "./participantPlacement.css";
import "./orthographic2D.css";

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

type WorkspaceCameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";

type Workspace2DPropertiesTab =
  | "participants"
  | "selection"
  | "motion"
  | "scene";

type WorkspacePropertiesTab =
  | "participant"
  | "camera"
  | "layers"
  | "physics"
  | "scene";

type WorkspaceLayerState = {
  paths: boolean;
  objects: boolean;
  evidence: boolean;
  physics: boolean;
};

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

type WorkspaceTool =
  | "Select"
  | "Move"
  | "Rotate"
  | "Scale"
  | "Timeline"
  | "Measure"
  | "Camera";

type SceneGestureState =
  | {
      kind: "pan";
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      kind: "rotate";
      pointerId: number;
      startClientX: number;
      participantId: string;
      pointId: string;
      startRotation: number;
    }
  | {
      kind: "scale";
      pointerId: number;
      startClientY: number;
      startZoom: number;
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
const MAX_PLAYBACK_FRAME_DELTA_SECONDS = 0.05;
const MIN_SCENE_ZOOM = 0.92;
const MAX_SCENE_ZOOM = 3;
const SCENE_ZOOM_STEP = 0.1;

type SaveMessageType = "success" | "error" | "info";

type InvestigationDetailView =
  | "audit"
  | "hypotheses"
  | "documentation-evidence"
  | "documentation-photos"
  | null;

function CompactAuditSparkline({
  values,
  colour,
}: {
  values: number[];
  colour: string;
}) {
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 30 - clamp(value, 0, 30);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="premium-audit-metric__sparkline"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={colour} strokeWidth="2.2" />
    </svg>
  );
}

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
        point.timeSeconds >
          reconstruction.durationSeconds +
            0.0001,
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

const GPS_BOUNDARY_OBJECT_TYPES = new Set<SceneObjectType>([
  "Pothole",
  "Puddle",
  "Oil Spill",
  "Loose Gravel",
  "Debris",
  "Broken Glass",
  "Bush",
]);

function getSceneObjectGpsCaptureMode(
  type: SceneObjectType,
): FieldCaptureMode {
  if (isTraceableSceneObjectType(type)) {
    return "Line";
  }

  if (GPS_BOUNDARY_OBJECT_TYPES.has(type)) {
    return "Boundary";
  }

  return "Point";
}

function createQuickNorthUpCalibration(
  coordinate: GeoCoordinate,
  scene: RoadSceneSettings,
  createdBy: string,
): FieldSceneCalibration {
  const sceneWidthMetres = Math.max(10, scene.sceneWidthMetres);
  const sceneHeightMetres = Math.max(10, scene.sceneHeightMetres);
  const origin = localOffsetToCoordinate(
    coordinate,
    -sceneWidthMetres / 2,
    -sceneHeightMetres / 2,
  );
  const directionReference = localOffsetToCoordinate(
    origin,
    Math.max(5, Math.min(20, sceneWidthMetres / 3)),
    0,
  );
  const widthReference = localOffsetToCoordinate(
    origin,
    0,
    Math.max(5, Math.min(20, sceneHeightMetres / 3)),
  );

  return FieldPlacementService.createCalibration({
    origin: {
      ...origin,
      accuracyMetres: coordinate.accuracyMetres,
    },
    directionReference: {
      ...directionReference,
      accuracyMetres: coordinate.accuracyMetres,
    },
    widthReference: {
      ...widthReference,
      accuracyMetres: coordinate.accuracyMetres,
    },
    sceneWidthMetres,
    sceneHeightMetres,
    createdBy: createdBy || "RoadSafe field user",
  });
}

function singleGpsCapture(
  coordinate: GeoCoordinate,
): AveragedLocationResult {
  return {
    coordinate,
    sampleCount: 1,
    averageAccuracyMetres: coordinate.accuracyMetres,
    bestAccuracyMetres: coordinate.accuracyMetres,
    rejectedSampleCount: 0,
    observedSpreadMetres: 0,
    estimatedUncertaintyMetres: coordinate.accuracyMetres,
    rawSamples: [coordinate],
    rejectedSamples: [],
  };
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
      return "#292929";
    case "White":
      return "#f9fafb";
    case "Orange":
      return "#ea580c";
    case "Purple":
      return "#9333ea";
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

function ParticipantShape({
  participant,
  selected,
}: ParticipantShapeProps) {
  return (
    <Participant2DModel
      participant={participant}
      selected={selected}
      showLabel
    />
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

const participantPathGeometryCache = new WeakMap<
  MovementPathPoint[],
  { path: string; skidPath: string }
>();

function getParticipantPathGeometry(
  participant: ReconstructionVehicle,
) {
  const cacheKey = participant.pathPoints;
  const cached =
    participantPathGeometryCache.get(
      cacheKey,
    );

  if (cached) return cached;

  const authoredPathPoints =
    getParticipantPlaybackPathPoints(
      participant,
    ).filter(
      (point) =>
        !isPhysicsGeneratedPathPoint(point),
    );

  const path = buildSmoothSvgPath(
    authoredPathPoints.map(
      (point) => point.position,
    ),
    isHumanParticipant(participant.type)
      ? 0.82
      : 0.58,
  );

  const skidPoints =
    authoredPathPoints.filter(
      (point, index) =>
        point.action === "Brake" ||
        (
          index > 0 &&
          authoredPathPoints[index - 1]
            .action === "Brake"
        ),
    );

  const geometry = {
    path,
    skidPath:
      skidPoints.length > 1
        ? buildSmoothSvgPath(
            skidPoints.map(
              (point) => point.position,
            ),
            0.55,
          )
        : "",
  };

  participantPathGeometryCache.set(
    cacheKey,
    geometry,
  );

  return geometry;
}

function getVisibleParticipantControlPoints(
  pathPoints: MovementPathPoint[],
): MovementPathPoint[] {
  return sortMovementPathPoints(pathPoints).filter(
    (point) =>
      !isPhysicsGeneratedPathPoint(point) &&
      !isPointZ(point),
  );
}

export default function AccidentReconstructionEditor({
  reconstructionId,
  caseContext,
  onReconstructionSaved,
  onFootageSaved,
}: AccidentReconstructionEditorProps) {
  const workspaceRightPanelHost =
    useWorkspaceRightPanelHost();

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);

  /**
   * The actual metric 2D sheet. Unlike sceneRef/sceneViewportRef (the browser
   * workspace), this element preserves the real scene aspect ratio.
   */
  const sceneMetricPlaneRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const sceneGestureRef = useRef<SceneGestureState | null>(null);
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
  const sceneObjectPaletteRef = useRef<HTMLDivElement | null>(null);

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
  const [pendingParticipantPlacement, setPendingParticipantPlacement] =
    useState<PendingParticipantPlacement | null>(null);
  const [participantPlacementMessage, setParticipantPlacementMessage] =
    useState("");
  const [participantGpsBusy, setParticipantGpsBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sceneExpanded, setSceneExpanded] = useState(false);
  const [sceneAssetDragActive, setSceneAssetDragActive] = useState(false);
  const [activeReconstructionView, setActiveReconstructionView] = useState<"2D" | "3D">("2D");
  const [activeWorkspaceTool, setActiveWorkspaceTool] =
    useState<WorkspaceTool>("Select");
  const [workspaceToolbarVisible, setWorkspaceToolbarVisible] =
    useState(true);
  const [shortcutHelpVisible, setShortcutHelpVisible] =
    useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceInvestigationTab, setWorkspaceInvestigationTab] =
    useState("case");
  const [workspacePropertiesOpen, setWorkspacePropertiesOpen] = useState(true);
  const [cameraCycleToken, setCameraCycleToken] = useState(0);
  const [workspaceCameraMode, setWorkspaceCameraMode] =
    useState<WorkspaceCameraMode>("Orbit");
  const [workspace2DPropertiesTab, setWorkspace2DPropertiesTab] =
    useState<Workspace2DPropertiesTab>("participants");
  const [workspacePropertiesTab, setWorkspacePropertiesTab] =
    useState<WorkspacePropertiesTab>("participant");
  const [workspaceLayers, setWorkspaceLayers] = useState<WorkspaceLayerState>({
    paths: true,
    objects: true,
    evidence: true,
    physics: true,
  });
  const [activeInvestigationDetail, setActiveInvestigationDetail] =
    useState<InvestigationDetailView>(null);
  const [sceneView, setSceneView] = useState({ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 });

  const [
    sceneMetricFrame,
    setSceneMetricFrame,
  ] = useState({
    widthPx: 1,
    heightPx: 1,
    pixelsPerMetre: 1,
  });
  const [basemapMode, setBasemapMode] = useState<ReconstructionBasemapMode>(reconstruction.fieldCalibration ? "Satellite" : "Diagram");
  const [routeDrawingParticipantId, setRouteDrawingParticipantId] = useState<string | null>(null);
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
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
  const [fieldPlacementInitialMode, setFieldPlacementInitialMode] =
    useState<FieldCaptureMode>("Point");
  const [pendingGpsSceneObjectId, setPendingGpsSceneObjectId] = useState<
    string | null
  >(null);
  const [collisionPlacementActive, setCollisionPlacementActive] = useState(false);

  const sceneWorldDimensions2D =
    getReconstructionWorldDimensions(
      reconstruction,
    );

  useEffect(() => {
    if (
      activeReconstructionView !==
      "2D"
    ) {
      return;
    }

    const viewport =
      sceneViewportRef.current;

    if (!viewport) {
      return;
    }

    const updateOrthographicMetricFrame =
      () => {
        const rectangle =
          viewport.getBoundingClientRect();

        const availableWidth =
          Math.max(
            1,
            rectangle.width,
          );

        const availableHeight =
          Math.max(
            1,
            rectangle.height,
          );

        /*
         * ONE scale for both axes. This is the defining property of an
         * orthographic plan view and eliminates the old wide-screen stretch.
         */
        const pixelsPerMetre =
          Math.max(
            0.0001,
            Math.min(
              availableWidth /
                sceneWorldDimensions2D.widthMetres,
              availableHeight /
                sceneWorldDimensions2D.heightMetres,
            ),
          );

        const widthPx =
          sceneWorldDimensions2D.widthMetres *
          pixelsPerMetre;

        const heightPx =
          sceneWorldDimensions2D.heightMetres *
          pixelsPerMetre;

        setSceneMetricFrame(
          (
            current,
          ) => {
            if (
              Math.abs(
                current.widthPx -
                  widthPx,
              ) <
                0.5 &&
              Math.abs(
                current.heightPx -
                  heightPx,
              ) <
                0.5 &&
              Math.abs(
                current.pixelsPerMetre -
                  pixelsPerMetre,
              ) <
                0.0001
            ) {
              return current;
            }

            return {
              widthPx,
              heightPx,
              pixelsPerMetre,
            };
          },
        );
      };

    updateOrthographicMetricFrame();

    const observer =
      typeof ResizeObserver !==
      "undefined"
        ? new ResizeObserver(
            updateOrthographicMetricFrame,
          )
        : null;

    observer?.observe(
      viewport,
    );

    window.addEventListener(
      "resize",
      updateOrthographicMetricFrame,
    );

    return () => {
      observer?.disconnect();

      window.removeEventListener(
        "resize",
        updateOrthographicMetricFrame,
      );
    };
  }, [
    activeReconstructionView,
    sceneWorldDimensions2D.heightMetres,
    sceneWorldDimensions2D.widthMetres,
  ]);

  const clientToScenePosition = useCallback(
    (
      clientX: number,
      clientY: number,
    ) => {
      /*
       * getBoundingClientRect() includes the current pan + uniform zoom.
       * Mapping directly through this transformed rectangle keeps pointer
       * placement exactly aligned with the orthographic metric sheet.
       */
      const rectangle =
        sceneMetricPlaneRef.current
          ?.getBoundingClientRect();

      if (
        !rectangle ||
        rectangle.width <= 0 ||
        rectangle.height <= 0
      ) {
        return null;
      }

      const xProgress =
        (
          clientX -
          rectangle.left
        ) /
        rectangle.width;

      const yProgress =
        (
          clientY -
          rectangle.top
        ) /
        rectangle.height;

      /*
       * Letterboxed viewport space is NOT forensic scene space. Ignore
       * placement/drawing clicks outside the metric sheet instead of clamping
       * them onto a fake scene edge.
       */
      if (
        xProgress < 0 ||
        xProgress > 1 ||
        yProgress < 0 ||
        yProgress > 1
      ) {
        return null;
      }

      return {
        x:
          xProgress *
          100,

        y:
          yProgress *
          100,
      };
    },
    [],
  );

  const zoomSceneAtClientPoint = useCallback(
    (clientX: number, clientY: number, zoomDelta: number) => {
      const rectangle = sceneViewportRef.current?.getBoundingClientRect();
      if (!rectangle) return;

      setSceneView((view) => {
        const nextZoom = clamp(
          view.zoom + zoomDelta,
          MIN_SCENE_ZOOM,
          MAX_SCENE_ZOOM,
        );

        if (nextZoom === view.zoom) {
          return view;
        }

        if (nextZoom <= MIN_SCENE_ZOOM + 0.0001) {
          return {
            zoom: MIN_SCENE_ZOOM,
            panX: 0,
            panY: 0,
          };
        }

        const pointerX = clientX - rectangle.left - rectangle.width / 2;
        const pointerY = clientY - rectangle.top - rectangle.height / 2;
        const contentX = (pointerX - view.panX) / view.zoom;
        const contentY = (pointerY - view.panY) / view.zoom;

        return {
          zoom: nextZoom,
          panX: pointerX - contentX * nextZoom,
          panY: pointerY - contentY * nextZoom,
        };
      });
    },
    [],
  );

  useEffect(() => {
    const viewport = sceneViewportRef.current;
    if (!viewport || activeReconstructionView !== "2D") return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY > 0 ? -1 : 1;
      const intensity = event.ctrlKey ? 0.06 : 0.1;
      zoomSceneAtClientPoint(
        event.clientX,
        event.clientY,
        direction * intensity,
      );
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [activeReconstructionView, zoomSceneAtClientPoint]);

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

  const caseNumber = caseContext?.caseNumber;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = reconstructionId
        ? ReconstructionService.getById(reconstructionId)
        : null;
      const created = loaded ?? createDefaultReconstruction();
      const nextCandidate = caseNumber
        ? {
            ...created,
            accidentId: caseNumber,
          }
        : created;

      const next: AccidentReconstruction = {
        ...nextCandidate,
        lastPhysicsSimulation: undefined,
        vehicles: nextCandidate.vehicles.map((participant) =>
          syncLegacyParticipantFields({
            ...participant,
            pathPoints: normalisePointZRoute({
              pathPoints: participant.pathPoints,
              collisionPosition: nextCandidate.collisionPoint,
              durationSeconds: nextCandidate.durationSeconds,
              speedKmh: participant.estimatedSpeedKmh,
              participantType: participant.type,
              createId,
              worldDimensions:
                getReconstructionWorldDimensions(
                  nextCandidate,
                ),
            }),
          }),
        ),
      };

      setReconstruction(next);
      setSelectedParticipantId(next.vehicles[0]?.id ?? null);
      setSelectedPathPointId(next.vehicles[0]?.pathPoints[0]?.id ?? null);
      setSelectedSceneObjectId(next.sceneObjects[0]?.id ?? null);
      setSelectedMeasurementId(next.measurements[0]?.id ?? null);
      setSelectedEvidenceId(next.evidenceRecords[0]?.id ?? null);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setIsPlaying(false);
      setActiveReconstructionView("2D");
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
      setPendingParticipantPlacement(null);
      setParticipantPlacementMessage("");
      setParticipantGpsBusy(false);

      undoStackRef.current = [];
      redoStackRef.current = [];
      historySnapshotRef.current = next;
      applyingHistoryRef.current = false;
      setHistoryAvailability({ canUndo: false, canRedo: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [caseNumber, reconstructionId]);

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
      setHistoryAvailability({
        canUndo: undoStackRef.current.length > 0,
        canRedo: false,
      });
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

  const livePhysicsEnabled = Boolean(
    reconstruction.physicsSettings?.enabled ?? DEFAULT_PHYSICS_SETTINGS.enabled,
  ) && Boolean(
    reconstruction.physicsSettings?.liveSimulation ??
      DEFAULT_PHYSICS_SETTINGS.liveSimulation,
  );
  const physicsParticipantCount = reconstruction.vehicles.length;

  useEffect(() => {
    if (isPlaying || !livePhysicsEnabled || physicsParticipantCount < 1) return;
    if (livePhysicsTimerRef.current !== null) {
      window.clearTimeout(livePhysicsTimerRef.current);
    }
    livePhysicsTimerRef.current = window.setTimeout(() => {
      setReconstruction((current) => applyPhysicsSimulation(current));
      livePhysicsTimerRef.current = null;
    }, 500);
    return () => {
      if (livePhysicsTimerRef.current !== null) {
        window.clearTimeout(livePhysicsTimerRef.current);
      }
    };
  }, [isPlaying, livePhysicsEnabled, physicsInputSignature, physicsParticipantCount]);

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

  const selectedParticipantState = useMemo(
    () =>
      selectedParticipant
        ? getParticipantStateAtTime(
            selectedParticipant,
            currentTime,
            getReconstructionWorldDimensions(reconstruction),
          )
        : null,
    [currentTime, selectedParticipant],
  );

  const selectedPhysicsEvent = useMemo(() => {
    const events = reconstruction.lastPhysicsSimulation?.collisionEvents ?? [];
    if (selectedParticipantId) {
      return [...events]
        .reverse()
        .find((event) => event.participantIds.includes(selectedParticipantId)) ?? null;
    }
    return events[events.length - 1] ?? null;
  }, [reconstruction.lastPhysicsSimulation, selectedParticipantId]);

  const selectedParticipantKinematics = useMemo(() => {
    const participants = selectedPhysicsEvent?.kinematics?.participants ?? [];

    if (selectedParticipantId) {
      return (
        participants.find(
          (participant) => participant.participantId === selectedParticipantId,
        ) ?? null
      );
    }

    return participants[0] ?? null;
  }, [selectedParticipantId, selectedPhysicsEvent]);

  const compactCollisionSetup = useMemo(
    () => ({
      source: "Manual" as const,
      confirmed: false,
      locked: false,
      toleranceMetres: 2,
      notes: "",
      confidence: "Medium" as const,
      ...(reconstruction.collisionSetup ?? {}),
    }),
    [reconstruction.collisionSetup],
  );

  const compactPhysicsSettings = useMemo(
    () => ({
      ...DEFAULT_PHYSICS_SETTINGS,
      ...(reconstruction.physicsSettings ?? {}),
    }),
    [reconstruction.physicsSettings],
  );

  const compactAudit = useMemo(() => {
    const result = runAuditValidation(reconstruction, {
      reactionTimeSeconds: 1.5,
      frictionCoefficient: getSuggestedFrictionCoefficient(reconstruction),
    });
    const critical = result.issues.filter((issue) => issue.severity === "Critical").length;
    const warnings = result.issues.filter((issue) => issue.severity === "Warning").length;
    const dataIntegrity = result.totalChecks > 0
      ? (result.passedChecks / result.totalChecks) * 100
      : 100;
    const simulationWarnings = reconstruction.lastPhysicsSimulation?.warnings.length ?? 0;

    return {
      result,
      momentumBalance: clamp(100 - critical * 5.2 - warnings * 1.15, 0, 100),
      energyBalance: clamp(
        dataIntegrity - simulationWarnings * 1.1 - (reconstruction.lastPhysicsSimulation?.solidObjectImpacts ?? 0) * 0.18,
        0,
        100,
      ),
      dataIntegrity: clamp(dataIntegrity, 0, 100),
    };
  }, [reconstruction]);

  const compactScenarios = useMemo(
    () => ReconstructionScenarioService.list(reconstruction.id),
    [reconstruction.id],
  );

  const compactHypothesisRows = useMemo(() => {
    if (compactScenarios.length === 0) {
      return [
        { id: "case", name: "Hypothesis A (Case Version)", primary: true, confidence: 78 },
        { id: "b", name: "Hypothesis B", primary: false, confidence: 42 },
        { id: "c", name: "Hypothesis C", primary: false, confidence: 18 },
      ];
    }

    return compactScenarios.slice(0, 3).map((scenario, index) => ({
      id: scenario.id,
      name: scenario.name,
      primary: scenario.preferred,
      confidence:
        scenario.status === "Accepted"
          ? 78
          : scenario.status === "Rejected"
            ? 18
            : index === 0
              ? 62
              : 42,
    }));
  }, [compactScenarios]);

  const collisionPointMetres = useMemo(
    () => ({
      x: (reconstruction.collisionPoint.x / 100) * reconstruction.scene.sceneWidthMetres,
      y: (reconstruction.collisionPoint.y / 100) * reconstruction.scene.sceneHeightMetres,
    }),
    [reconstruction.collisionPoint, reconstruction.scene.sceneHeightMetres, reconstruction.scene.sceneWidthMetres],
  );

  const impactEffect = useMemo(
    () => getReconstructionImpactEffectState(reconstruction, currentTime),
    [currentTime, reconstruction],
  );

  const openFieldPlacementForTarget = useCallback(
    (
      target: FieldPlacementTarget | null,
      captureMode: FieldCaptureMode = "Point",
    ) => {
      setIsPlaying(false);
      setCollisionPlacementActive(false);
      setMeasurementToolActive(false);
      setMeasurementDraftStart(null);
      setActiveEvidencePlacementId(null);
      setActiveSceneObjectType(null);
      setTraceToolObjectId(null);
      setFieldPlacementInitialTarget(target);
      setFieldPlacementInitialMode(captureMode);
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

    openFieldPlacementForTarget(
      {
        type: "SceneObject",
        targetId: object.id,
        label: `Scene object — ${object.label}`,
      },
      getSceneObjectGpsCaptureMode(object.type),
    );
  }, [
    activeSceneObjectType,
    openFieldPlacementForTarget,
    reconstruction.sceneObjects.length,
  ]);

  const handlePlaceSelectedSceneObjectWithGps = useCallback(() => {
    if (!selectedSceneObject) return;

    openFieldPlacementForTarget(
      {
        type: "SceneObject",
        targetId: selectedSceneObject.id,
        label: `Scene object — ${selectedSceneObject.label}`,
      },
      getSceneObjectGpsCaptureMode(selectedSceneObject.type),
    );
  }, [openFieldPlacementForTarget, selectedSceneObject]);

  const handlePlaceParticipantPointWithGps = useCallback(
    (pointId: string) => {
      if (!selectedParticipant) return;

      const point = selectedParticipant.pathPoints.find(
        (item) => item.id === pointId,
      );
      if (!point) return;

      if (isPointZ(point)) {
        showSaveMessage(
          "Point Z is locked to the primary collision marker. Move the collision marker instead.",
          "info",
          3200,
        );
        return;
      }

      setSelectedPathPointId(point.id);
      openFieldPlacementForTarget({
        type: "ParticipantPathPoint",
        targetId: selectedParticipant.id,
        subTargetId: point.id,
        label: `${selectedParticipant.name} — ${point.label} (${point.action})`,
      });
    },
    [openFieldPlacementForTarget, selectedParticipant, showSaveMessage],
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
    setFieldPlacementInitialMode("Point");
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

  const handleFieldPlacementUpdate = useCallback(
    (
      updater: (
        current: AccidentReconstruction,
      ) => AccidentReconstruction,
    ) => {
      setReconstruction((current) => {
        const next = updater(current);

        const collisionChanged =
          next.collisionPoint.x !== current.collisionPoint.x ||
          next.collisionPoint.y !== current.collisionPoint.y;

        if (collisionChanged) {
          return updateReconstructionCollisionPoint({
            reconstruction: next,
            collisionPosition: next.collisionPoint,
            source: next.collisionSetup?.source ?? "Manual",
            confirmed: next.collisionSetup?.confirmed ?? false,
            locked: next.collisionSetup?.locked ?? false,
          });
        }

        const participantRoutesChanged = next.vehicles.some(
          (participant) =>
            participant.pathPoints !==
            current.vehicles.find(
              (item) => item.id === participant.id,
            )?.pathPoints,
        );

        return participantRoutesChanged
          ? normaliseAllPointZRoutes(next, createId)
          : next;
      });
    },
    [],
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
      setReconstruction((current) => {
        const affectsPhysics = Boolean(
          updates.pathPoints ||
          updates.estimatedSpeedKmh !== undefined ||
          updates.type !== undefined ||
          updates.physics !== undefined,
        );

        return {
          ...current,
          lastPhysicsSimulation: affectsPhysics
            ? undefined
            : current.lastPhysicsSimulation,
          vehicles: current.vehicles.map((participant) => {
            if (participant.id !== participantId) return participant;

            const updated: ReconstructionVehicle = {
              ...participant,
              ...updates,
              ...(updates.estimatedSpeedKmh !== undefined
                ? {
                    physics: {
                      ...getDefaultParticipantPhysics({
                        type:
                          updates.type ??
                          participant.type,
                      }),
                      ...(participant.physics ?? {}),
                      ...(updates.physics ?? {}),
                      inputSpeedKmh:
                        updates.estimatedSpeedKmh,
                    },
                  }
                : {}),
            };

            if (
              updates.pathPoints ||
              updates.estimatedSpeedKmh !== undefined ||
              updates.type !== undefined
            ) {
              const pathPoints = normalisePointZRoute({
                pathPoints: updates.pathPoints ?? participant.pathPoints,
                collisionPosition: current.collisionPoint,
                durationSeconds: current.durationSeconds,
                speedKmh: updated.estimatedSpeedKmh,
                participantType: updated.type,
                createId,
                worldDimensions:
                  getReconstructionWorldDimensions(
                    current,
                  ),
              });

              return syncLegacyParticipantFields({
                ...updated,
                pathPoints,
              });
            }

            return updated;
          }),
        };
      });
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
        const updated = updateParticipantAuthoredPoint({
          reconstruction: current,
          participantId,
          pointId,
          updates,
        });

        return updates.position
          ? FieldPlacementService.markManuallyAdjusted({
              reconstruction: updated,
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
      if (!selectedParticipantId) return;

      setReconstruction((current) =>
        changeParticipantApproachHeading({
          reconstruction: current,
          participantId: selectedParticipantId,
          headingLabel: heading,
          degrees,
        }),
      );
    },
    [selectedParticipantId],
  );

  const updateSceneObject = useCallback(
    (
      objectId: string,
      updates: Partial<ReconstructionSceneObject>,
    ) => {
      setReconstruction((current) => {
        const affectsPhysics = Boolean(
          updates.physics !== undefined ||
          updates.position !== undefined ||
          updates.rotation !== undefined ||
          updates.scale !== undefined ||
          updates.severity !== undefined ||
          updates.widthMetres !== undefined ||
          updates.lengthMetres !== undefined,
        );

        const updated: AccidentReconstruction = {
          ...current,
          lastPhysicsSimulation: affectsPhysics
            ? undefined
            : current.lastPhysicsSimulation,
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

  const confirmPendingParticipantAt = useCallback(
    (startPosition: ReconstructionPosition) => {
      if (!pendingParticipantPlacement) return;

      const participantBase = createParticipantAtConfirmedPosition({
        type: pendingParticipantPlacement.type,
        index: pendingParticipantPlacement.index,
        startPosition,
        collisionPosition: reconstruction.collisionPoint,
        durationSeconds: reconstruction.durationSeconds,
        createId,
        getDefaultSpeed,
        getDefaultRole,
        isHumanParticipant,
        worldDimensions:
          getReconstructionWorldDimensions(
            reconstruction,
          ),
      });

      const participant: ReconstructionVehicle = {
        ...participantBase,
        assetId:
          pendingParticipantPlacement.assetId ??
          getDefaultParticipantAssetId(
            pendingParticipantPlacement.type,
          ),
      };

      setReconstruction((current) => ({
        ...current,
        lastPhysicsSimulation: undefined,
        vehicles: [...current.vehicles, participant],
      }));

      setSelectedParticipantId(participant.id);
      setSelectedPathPointId(participant.pathPoints[0]?.id ?? null);
      setSelectedSceneObjectId(null);
      setPendingParticipantPlacement(null);
      setParticipantPlacementMessage("");
      setParticipantGpsBusy(false);
      setActiveWorkspaceTool("Select");
    },
    [
      pendingParticipantPlacement,
      reconstruction.collisionPoint,
      reconstruction.durationSeconds,
    ],
  );

  const handleUseParticipantGps = useCallback(() => {
    if (!pendingParticipantPlacement) return;

    if (!navigator.geolocation) {
      setParticipantPlacementMessage(
        "This browser does not provide geolocation.",
      );
      return;
    }

    setParticipantGpsBusy(true);
    setParticipantPlacementMessage("Reading a high-accuracy live GPS position…");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const coordinate: GeoCoordinate = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracyMetres: result.coords.accuracy,
          altitudeMetres: result.coords.altitude,
          headingDegrees: result.coords.heading,
          speedMetresPerSecond: result.coords.speed,
          capturedAt: new Date().toISOString(),
        };

        const calibration =
          reconstruction.fieldCalibration ??
          createQuickNorthUpCalibration(
            coordinate,
            reconstruction.scene,
            caseContext?.recordedBy ?? "",
          );
        const scenePosition = coordinateToScenePosition(
          coordinate,
          calibration,
        );
        const participantBase = createParticipantAtConfirmedPosition({
          type: pendingParticipantPlacement.type,
          index: pendingParticipantPlacement.index,
          startPosition: scenePosition,
          collisionPosition: reconstruction.collisionPoint,
          durationSeconds: reconstruction.durationSeconds,
          createId,
          getDefaultSpeed,
          getDefaultRole,
          isHumanParticipant,
          worldDimensions:
            getReconstructionWorldDimensions(
              reconstruction,
            ),
        });
        const participant: ReconstructionVehicle = {
          ...participantBase,
          assetId:
            pendingParticipantPlacement.assetId ??
            getDefaultParticipantAssetId(
              pendingParticipantPlacement.type,
            ),
        };

        const pointOne = participant.pathPoints[0];

        let next: AccidentReconstruction = {
          ...reconstruction,
          fieldCalibration: calibration,
          lastPhysicsSimulation: undefined,
          vehicles: [...reconstruction.vehicles, participant],
        };

        if (pointOne) {
          next = FieldPlacementService.applyPlacement({
            reconstruction: next,
            target: {
              type: "ParticipantPathPoint",
              targetId: participant.id,
              subTargetId: pointOne.id,
              label: `${participant.name} — Point 1`,
            },
            capture: singleGpsCapture(coordinate),
            method: "Single GPS",
            confirmedBy: caseContext?.recordedBy ?? "",
            acceptedPoorAccuracy: coordinate.accuracyMetres > 10,
          });
        }

        setReconstruction(next);
        setSelectedParticipantId(participant.id);
        setSelectedPathPointId(pointOne?.id ?? null);
        setSelectedSceneObjectId(null);
        setPendingParticipantPlacement(null);
        setParticipantPlacementMessage("");
        setParticipantGpsBusy(false);
        setActiveWorkspaceTool("Select");
        setBasemapMode("Satellite");

        if (!reconstruction.fieldCalibration) {
          showSaveMessage(
            "Participant placed from live GPS. A provisional north-up field calibration was created and can be refined later.",
            "info",
            4200,
          );
        }
      },
      (error) => {
        setParticipantGpsBusy(false);
        setParticipantPlacementMessage(
          error.message || "The live GPS position could not be read.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      },
    );
  }, [
    caseContext?.recordedBy,
    pendingParticipantPlacement,
    reconstruction,
    showSaveMessage,
  ]);

  const handleArmLibraryParticipantPlacement = useCallback(
    (
      assetId: ReconstructionParticipantAssetId,
      type: ReconstructionVehicleType,
    ) => {
      setIsPlaying(false);
      setActiveReconstructionView("2D");
      setActiveWorkspaceTool("Select");

      setPendingParticipantPlacement({
        type,
        index: reconstruction.vehicles.length + 1,
        assetId,
      });

      setParticipantPlacementMessage(
        `Click the exact starting position for ${PARTICIPANT_ASSET_CATALOG[assetId].shortLabel}, or drag it directly onto the scene.`,
      );

      setParticipantGpsBusy(false);
      setActiveSceneObjectType(null);
      setTraceToolObjectId(null);
      setRouteDrawingParticipantId(null);
      setMeasurementToolActive(false);
      setMeasurementDraftStart(null);
      setCollisionPlacementActive(false);
      setActiveEvidencePlacementId(null);
    },
    [reconstruction.vehicles.length],
  );

  const createLibraryParticipantAt = useCallback(
    (
      assetId: ReconstructionParticipantAssetId,
      type: ReconstructionVehicleType,
      startPosition: ReconstructionPosition,
    ) => {
      let createdParticipantId: string | null = null;
      let createdPointId: string | null = null;

      setIsPlaying(false);

      setReconstruction((current) => {
        const asset =
          PARTICIPANT_ASSET_CATALOG[assetId];

        const participant =
          createParticipantAtConfirmedPosition({
            type,
            index: current.vehicles.length + 1,
            startPosition,
            collisionPosition: current.collisionPoint,
            durationSeconds: current.durationSeconds,
            createId,
            getDefaultSpeed,
            getDefaultRole,
            isHumanParticipant,
            worldDimensions:
              getReconstructionWorldDimensions(current),
          });

        const withAsset: ReconstructionVehicle = {
          ...participant,
          assetId,
          name:
            `${asset.shortLabel} ${current.vehicles.length + 1}`,
        };

        createdParticipantId = withAsset.id;
        createdPointId =
          withAsset.pathPoints[0]?.id ?? null;

        return {
          ...current,
          lastPhysicsSimulation: undefined,
          vehicles: [
            ...current.vehicles,
            withAsset,
          ],
        };
      });

      window.requestAnimationFrame(() => {
        if (!createdParticipantId) return;

        setSelectedParticipantId(createdParticipantId);
        setSelectedPathPointId(createdPointId);
        setSelectedSceneObjectId(null);
        setActiveWorkspaceTool("Select");
      });
    },
    [],
  );

  const createLibrarySceneObjectAt = useCallback(
    (
      type: SceneObjectType,
      position: ReconstructionPosition,
    ) => {
      let objectId: string | null = null;

      setReconstruction((current) => {
        const object = createSceneObject(
          type,
          position,
          current.sceneObjects.length + 1,
        );

        objectId = object.id;

        return {
          ...current,
          sceneObjects: [
            ...current.sceneObjects,
            object,
          ],
        };
      });

      window.requestAnimationFrame(() => {
        if (!objectId) return;

        setSelectedSceneObjectId(objectId);
        setSelectedParticipantId(null);
        setSelectedPathPointId(null);
        setActiveWorkspaceTool("Select");
      });
    },
    [],
  );

  const handleLibrarySceneDragOver = useCallback(
    (
      event: ReactDragEvent<HTMLDivElement>,
    ) => {
      if (
        !event.dataTransfer ||
        !hasRoadSafeSceneAssetDrag(
          event.dataTransfer,
        )
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setSceneAssetDragActive(true);
    },
    [],
  );

  const handleLibrarySceneDrop = useCallback(
    (
      event: ReactDragEvent<HTMLDivElement>,
    ) => {
      if (!event.dataTransfer) return;

      const payload =
        readRoadSafeSceneAssetDrag(
          event.dataTransfer,
        );

      if (!payload) return;

      event.preventDefault();
      event.stopPropagation();

      setSceneAssetDragActive(false);

      const position =
        clientToScenePosition(
          event.clientX,
          event.clientY,
        );

      if (!position) return;

      if (payload.kind === "participant") {
        createLibraryParticipantAt(
          payload.assetId,
          payload.type,
          position,
        );
        return;
      }

      createLibrarySceneObjectAt(
        payload.type,
        position,
      );
    },
    [
      clientToScenePosition,
      createLibraryParticipantAt,
      createLibrarySceneObjectAt,
    ],
  );

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
        assetId:
          getDefaultParticipantAssetId(
            type,
          ),
        estimatedSpeedKmh: getDefaultSpeed(type),
        role: getDefaultRole(type),
        injured: isHumanParticipant(type) ? participant.injured ?? false : false,
      });
    },
    [updateParticipant],
  );

  const handleAddPathPoint = useCallback(() => {
    if (!selectedParticipantId) return;

    let insertedPointId: string | null = null;

    setReconstruction((current) => {
      const result = insertParticipantIntermediatePoint({
        reconstruction: current,
        participantId: selectedParticipantId,
        selectedPointId: selectedPathPointId,
        createId,
      });

      insertedPointId = result.insertedPointId;
      return result.reconstruction;
    });

    window.requestAnimationFrame(() => {
      if (insertedPointId) {
        setSelectedPathPointId(insertedPointId);
      }
    });
  }, [selectedParticipantId, selectedPathPointId]);

  const handleDeletePathPoint = useCallback(
    (pointId: string) => {
      if (!selectedParticipantId) return;

      setReconstruction((current) =>
        deleteParticipantIntermediatePoint({
          reconstruction: current,
          participantId: selectedParticipantId,
          pointId,
        }),
      );

      setSelectedPathPointId(null);
    },
    [selectedParticipantId],
  );

  const handleSceneGesturePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = sceneGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();

      if (gesture.kind === "pan") {
        setSceneView((view) => ({
          ...view,
          panX: gesture.startPanX + event.clientX - gesture.startClientX,
          panY: gesture.startPanY + event.clientY - gesture.startClientY,
        }));
        return;
      }

      if (gesture.kind === "rotate") {
        const nextRotation =
          (gesture.startRotation + (event.clientX - gesture.startClientX) * 0.65 + 360) %
          360;
        updatePathPoint(gesture.participantId, gesture.pointId, {
          rotation: nextRotation,
        });
        return;
      }

      const nextZoom = clamp(
        gesture.startZoom +
          (gesture.startClientY - event.clientY) / 220,
        MIN_SCENE_ZOOM,
        MAX_SCENE_ZOOM,
      );

      setSceneView((view) =>
        nextZoom <= MIN_SCENE_ZOOM + 0.0001
          ? {
              zoom: MIN_SCENE_ZOOM,
              panX: 0,
              panY: 0,
            }
          : {
              ...view,
              zoom: nextZoom,
            },
      );
    },
    [updatePathPoint],
  );

  const handleSceneGesturePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = sceneGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      sceneGestureRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const handleScenePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      /*
       * [RoadSafe:EasyViewportMouseNavigationV2:2D]
       *
       * Natural viewport navigation:
       * - left-drag empty space = pan
       * - middle-drag = pan
       * - right-drag = pan
       * - interactive handles keep their normal editing behaviour
       */
      if (
        !sceneRef.current ||
        (
          event.button !== 0 &&
          event.button !== 1 &&
          event.button !== 2
        )
      ) {
        return;
      }

      const target = event.target as HTMLElement;
      const isInteractive = Boolean(
        target.closest('[data-scene-interactive="true"]'),
      );

      const wantsViewportPan =
        event.button === 1 ||
        event.button === 2 ||
        (
          event.button === 0 &&
          !isInteractive
        );

      if (
        wantsViewportPan
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        sceneGestureRef.current = {
          kind: "pan",
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startPanX: sceneView.panX,
          startPanY: sceneView.panY,
        };
        return;
      }

      /*
       * G / R / S are entity transform modes.
       * Empty viewport drags no longer pan/rotate/zoom the camera.
       * Middle mouse and map controls remain navigation controls.
       */
      if (event.button !== 0) return;

      const position = clientToScenePosition(event.clientX, event.clientY);
      if (!position) return;

      if (pendingParticipantPlacement) {
        if (target.closest('[data-scene-interactive="true"]')) return;
        event.preventDefault();
        event.stopPropagation();
        confirmPendingParticipantAt(position);
        return;
      }

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
            reconstruction: updateReconstructionCollisionPoint({
              reconstruction: current,
              collisionPosition: position,
              source: "Manual",
              confirmed: true,
              locked: false,
            }),
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
      activeWorkspaceTool,
      clientToScenePosition,
      collisionPlacementActive,
      confirmPendingParticipantAt,
      measurementDraftStart,
      measurementToolActive,
      reconstruction.measurements.length,
      reconstruction.scene,
      reconstruction.sceneObjects.length,
      routeDrawingParticipantId,
      pendingParticipantPlacement,
      sceneView.panX,
      sceneView.panY,
      sceneView.zoom,
      selectedParticipant,
      selectedParticipantState,
      showSaveMessage,
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
      if (activeWorkspaceTool === "Move") {
        setDragState({
          kind: "measurement-point",
          measurementId,
          endpoint,
        });
      }
    },
    [activeWorkspaceTool],
  );

  const handleEvidencePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, evidenceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedEvidenceId(evidenceId);
      setSelectedMeasurementId(null);
      setSelectedParticipantId(null);
      setSelectedSceneObjectId(null);
      if (activeWorkspaceTool === "Move") {
        setDragState({ kind: "evidence-record", evidenceId });
      }
    },
    [activeWorkspaceTool],
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

      if (
        activeWorkspaceTool === "Move" &&
        !object.locked &&
        traceToolObjectId !== object.id
      ) {
        setDragState({ kind: "scene-object", objectId: object.id });
      }
    },
    [activeWorkspaceTool, handleSelectSceneObject, traceToolObjectId],
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

  const updateCollisionCoordinateMetres = useCallback(
    (axis: "x" | "y", metres: number) => {
      setReconstruction((current) => {
        const sceneSize = axis === "x"
          ? current.scene.sceneWidthMetres
          : current.scene.sceneHeightMetres;
        const nextPercent = clamp(
          (metres / Math.max(0.1, sceneSize)) * 100,
          0,
          100,
        );

        return updateReconstructionCollisionPoint({
          reconstruction: current,
          collisionPosition: {
            ...current.collisionPoint,
            [axis]: nextPercent,
          },
          source: "Manual",
          confirmed: false,
          locked: false,
        });
      });
    },
    [],
  );

  const handleRecalculateCollisionPoint = useCallback(() => {
    const derived = derivePrimaryCollisionPoint(reconstruction);
    if (!derived) {
      showSaveMessage(
        "Add at least one participant Impact point before recalculating the collision position.",
        "error",
        4200,
      );
      return;
    }

    setReconstruction((current) => ({
      ...updateReconstructionCollisionPoint({
        reconstruction: current,
        collisionPosition: derived,
        source: "Derived",
        confirmed: false,
        locked: false,
      }),
      collisionSetup: {
        ...(current.collisionSetup ?? {}),
        source: "Derived",
        confirmed: false,
        locked: false,
        toleranceMetres: current.collisionSetup?.toleranceMetres ?? 2,
        notes: current.collisionSetup?.notes ?? "",
        confidence: "High",
        lastCalculatedAt: new Date().toISOString(),
      },
    }));
    showSaveMessage("Collision point recalculated from participant Impact points.", "info");
  }, [reconstruction, showSaveMessage]);

  const handleRunPhysics = useCallback((): AccidentReconstruction => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    const simulated = applyPhysicsSimulation(reconstruction);
    setReconstruction(simulated);
    showSaveMessage(
      "Physics and kinematics calculated. Both 2D and 3D now use the same hidden post-impact trajectory and collision timeline.",
      "info",
      4000,
    );
    return simulated;
  }, [reconstruction, showSaveMessage]);

  const handlePreparePlayback = useCallback((): AccidentReconstruction => {
    const prepared = preparePhysicsForPlayback(reconstruction);
    if (prepared !== reconstruction) {
      setReconstruction(prepared);
      if ((prepared.lastPhysicsSimulation?.participantCollisions ?? 0) > 0) {
        showSaveMessage(
          "Fresh collision physics prepared for synchronized 2D and 3D playback.",
          "info",
          3200,
        );
      }
    }
    return prepared;
  }, [reconstruction, showSaveMessage]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      const pausedTime = currentTimeRef.current;
      setCurrentTime(pausedTime);
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

    if (startsFromBeginning) {
      const prepared = handlePreparePlayback();
      if (
        prepared !== reconstruction &&
        (prepared.lastPhysicsSimulation?.participantCollisions ?? 0) === 0 &&
        reconstruction.vehicles.length > 1
      ) {
        showSaveMessage(
          "No closing participant contact was found. Review approach directions, paths and speeds.",
          "info",
          4500,
        );
      }
    }

    setIsPlaying(true);
  }, [handlePreparePlayback, isPlaying, reconstruction, showSaveMessage]);

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

      const stoppedTime = currentTimeRef.current;
      setCurrentTime((displayedTime) =>
        Math.abs(displayedTime - stoppedTime) < 0.0005
          ? displayedTime
          : stoppedTime,
      );
      return;
    }

    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameTimeRef.current ?? timestamp;
      const elapsedSeconds = clamp(
        (timestamp - previousTimestamp) / 1000,
        0,
        MAX_PLAYBACK_FRAME_DELTA_SECONDS,
      );
      lastFrameTimeRef.current = timestamp;

      const nextTime = Math.min(
        reconstruction.durationSeconds,
        currentTimeRef.current + elapsedSeconds * playbackSpeed,
      );

      currentTimeRef.current = nextTime;

      // Native-frame DOM playback keeps participant movement at the browser's
      // refresh rate without rerendering the entire reconstruction editor.
      paintReconstructionPlaybackDomFrame({
        sceneRoot: sceneRef.current,
        editorRoot:
          sceneRef.current?.closest<HTMLElement>(".reconstruction-editor") ??
          document.querySelector<HTMLElement>(".reconstruction-editor"),
        reconstruction,
        timeSeconds: nextTime,
        timestamp,
      });

      if (nextTime >= reconstruction.durationSeconds) {
        setCurrentTime(reconstruction.durationSeconds);
        setIsPlaying(false);
        animationFrameRef.current = null;
        return;
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
  }, [isPlaying, playbackSpeed, reconstruction]);

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
            reconstruction: updateReconstructionCollisionPoint({
              reconstruction: current,
              collisionPosition: position,
              source: "Manual",
              confirmed: current.collisionSetup?.confirmed ?? false,
              locked: current.collisionSetup?.locked ?? false,
            }),
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
        setReconstruction((current) =>
          replaceParticipantRouteFromDrawing({
            reconstruction: current,
            participantId: routeParticipantId,
            routePoints,
            createId,
          }),
        );
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
    setHistoryAvailability({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, [reconstruction]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(reconstruction);
    applyingHistoryRef.current = true;
    historySnapshotRef.current = next;
    setReconstruction(next);
    setHistoryAvailability({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
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

  const handleWorkspaceInvestigationTab = (
    tab: string,
    heading: string,
  ) => {
    setWorkspaceInvestigationTab(tab);

    requestAnimationFrame(() => {
      const container =
        document.querySelector<HTMLElement>(
          ".reconstruction-workspace__aux-inspector-content",
        );

      if (!container) return;

      const candidates =
        Array.from(
          container.querySelectorAll<HTMLElement>(
            "h1, h2, h3, h4, strong, .premium-investigation-card__title, .reconstruction-workspace__workspace-card-title",
          ),
        );

      const normalizedHeading =
        heading
          .trim()
          .toLowerCase();

      const headingElement =
        candidates.find((element) =>
          element.textContent
            ?.trim()
            .toLowerCase()
            .includes(
              normalizedHeading,
            ),
        );

      const target =
        headingElement?.closest<HTMLElement>(
          ".premium-investigation-card, .reconstruction-workspace__workspace-card, section, article",
        ) ??
        headingElement;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    if (!workspaceSettingsOpen) return;

    const applySpeedLimitWidth = () => {
      const inspector = document.querySelector<HTMLElement>(
        ".reconstruction-workspace__aux-inspector",
      );

      if (!inspector) return;

      const labelCandidates = Array.from(
        inspector.querySelectorAll<HTMLElement>(
          "label, span, div, p, strong",
        ),
      );

      const label = labelCandidates.find((element) =>
        element.textContent?.trim().toLowerCase() === "speed limit",
      );

      if (!label) return;

      let row = label.closest<HTMLElement>(
        ".premium-investigation-card__field, .reconstruction-workspace__workspace-field, .grid, .flex, [class*='field'], [class*='row']",
      );

      if (!row) {
        let current = label.parentElement;

        while (current && current !== inspector) {
          if (current.querySelector("input, select, textarea")) {
            row = current;
            break;
          }

          current = current.parentElement;
        }
      }

      if (!row) return;

      row.dataset.roadsafeSpeedLimitWidthApplied = "true";

      const control =
        row.querySelector<HTMLElement>(
          "input[type='number'], input[inputmode='numeric'], input[inputmode='decimal'], input",
        ) ?? null;

      if (!control) return;

      control.dataset.roadsafeSpeedLimitInput = "true";

      const controlWrapper = control.parentElement as HTMLElement | null;

      if (controlWrapper) {
        controlWrapper.dataset.roadsafeSpeedLimitControl = "true";
      }

      const siblings = Array.from(row.children) as HTMLElement[];

      siblings.forEach((child) => {
        if (child === control || child.contains(control)) return;

        const text = child.textContent?.trim().toLowerCase() ?? "";

        if (text === "km/h" || text === "kmh") {
          child.dataset.roadsafeSpeedLimitUnit = "true";
        }
      });
    };

    applySpeedLimitWidth();

    const timer = window.setTimeout(
      applySpeedLimitWidth,
      120,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [workspaceSettingsOpen, workspaceInvestigationTab, activeReconstructionView]);

  const handleDurationChange = (durationSeconds: number) => {
    setReconstruction((current) => ({
      ...current,
      lastPhysicsSimulation: undefined,
      durationSeconds,
      vehicles: current.vehicles.map((participant) => {
        const adjustedPoints = participant.pathPoints.map((point) => ({
          ...point,
          timeSeconds: clamp(point.timeSeconds, 0, durationSeconds),
        }));

        const pathPoints = normalisePointZRoute({
          pathPoints: adjustedPoints,
          collisionPosition: current.collisionPoint,
          durationSeconds,
          speedKmh: participant.estimatedSpeedKmh,
          participantType: participant.type,
          createId,
          worldDimensions:
            getReconstructionWorldDimensions(
              current,
            ),
        });

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
    pendingParticipantPlacement ||
    activeSceneObjectType ||
    traceToolObjectId ||
    collisionPlacementActive ||
    measurementToolActive ||
    activeEvidencePlacementId
      ? "cursor-crosshair"
      : "";


  const resetPlacementTools = () => {
    setMeasurementToolActive(false);
    setMeasurementDraftStart(null);
    setCollisionPlacementActive(false);
    setActiveEvidencePlacementId(null);
    setActiveSceneObjectType(null);
    setTraceToolObjectId(null);
    setRouteDrawingParticipantId(null);
  };

  const handleWorkspaceTool = (tool: WorkspaceTool) => {
    setActiveWorkspaceTool(tool);

    if (tool === "Select") {
      resetPlacementTools();
      return;
    }

    if (tool === "Measure") {
      resetPlacementTools();
      setActiveReconstructionView("2D");
      setMeasurementToolActive(true);
      return;
    }

    if (tool === "Timeline") {
      resetPlacementTools();

      window.dispatchEvent(
        new Event(
          "roadsafe:timeline-open",
        ),
      );

      return;
    }

    if (tool === "Camera") {
      resetPlacementTools();
      setActiveReconstructionView("3D");
      setCameraCycleToken((value) => value + 1);
      return;
    }

    resetPlacementTools();
    setWorkspacePropertiesOpen(true);
  };

  const workspaceTools: Array<{
    label: WorkspaceTool;
    icon: typeof Crosshair;
    shortcut: string;
  }> = [
    { label: "Select", icon: Crosshair, shortcut: "W" },
    { label: "Move", icon: Move, shortcut: "G" },
    { label: "Rotate", icon: RotateCw, shortcut: "R" },
    { label: "Scale", icon: Expand, shortcut: "S" },
    { label: "Timeline", icon: ScanLine, shortcut: "⇧T" },
    { label: "Measure", icon: Ruler, shortcut: "M" },
    { label: "Camera", icon: Camera, shortcut: "C" },
  ];

  const workspaceToolGuidance: Record<
    WorkspaceTool,
    { title: string; twoD: string; threeD: string }
  > = {
    Select: {
      title: "Select and inspect",
      twoD: "Click a participant, route point, object, evidence marker or measurement.",
      threeD: "Left-drag to orbit. Middle/right-drag to pan. Use the wheel to zoom.",
    },
    Move: {
      title: "Move / pan",
      twoD: "Left-drag empty space to pan. Middle/right-drag also pan. Drag editable route points and scene handles normally to reposition them.",
      threeD: "Middle/right-drag pans the camera target. Left-drag continues to orbit.",
    },
    Rotate: {
      title: "Rotate",
      twoD: "Select a participant, then drag left or right on empty map space to change its heading.",
      threeD: "Drag the 3D scene to orbit around the reconstruction.",
    },
    Scale: {
      title: "Scale / zoom",
      twoD: "Drag up or down to zoom, or use the mouse wheel while the pointer is over the map.",
      threeD: "Drag the 3D scene vertically to dolly the camera in or out.",
    },
    Timeline: {
      title: "Interactive timeline",
      twoD: "Opens the synchronized screen Timeline editor.",
      threeD: "Opens the synchronized screen Timeline editor.",
    },
    Measure: {
      title: "Measure",
      twoD: "Click a start point, then click an end point to create a calibrated distance.",
      threeD: "Switches to 2D and starts a calibrated two-point measurement.",
    },
    Camera: {
      title: "Camera",
      twoD: "Switches to 3D and cycles Orbit, Overhead, Roadside and Driver camera views.",
      threeD: "Cycles Orbit, Overhead, Roadside and Driver camera views.",
    },
  };

  useEffect(() => {
    const handleViewportShortcut = (
      event: KeyboardEvent,
    ) => {
      if (
        event.defaultPrevented ||
        event.repeat
      ) {
        return;
      }

      if (
        activeInvestigationDetail ||
        fieldPlacementOpen
      ) {
        return;
      }

      const target =
        event.target as
          HTMLElement | null;

      if (
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='textbox']",
        )
      ) {
        return;
      }

      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const key =
        event.key.toLowerCase();

      if (
        event.shiftKey &&
        key === "t"
      ) {
        event.preventDefault();
        handleWorkspaceTool(
          "Timeline",
        );
        return;
      }

      if (
        event.key === "?"
      ) {
        event.preventDefault();
        setShortcutHelpVisible(
          (current) => !current,
        );
        return;
      }

      if (
        event.code === "Space"
      ) {
        event.preventDefault();
        handlePlayPause();
        return;
      }

      switch (key) {
        case "t":
          event.preventDefault();
          setWorkspaceToolbarVisible(
            (current) => !current,
          );
          return;

        case "n":
          event.preventDefault();

          if (
            workspaceSettingsOpen
          ) {
            setWorkspaceSettingsOpen(
              false,
            );
          } else {
            setWorkspacePropertiesOpen(
              (current) => !current,
            );
          }

          return;

        case "w":
          event.preventDefault();
          handleWorkspaceTool(
            "Select",
          );
          return;

        case "g":
          event.preventDefault();
          handleWorkspaceTool(
            "Move",
          );
          return;

        case "r":
          event.preventDefault();
          handleWorkspaceTool(
            "Rotate",
          );
          return;

        case "s":
          event.preventDefault();
          handleWorkspaceTool(
            "Scale",
          );
          return;

        case "m":
          event.preventDefault();
          handleWorkspaceTool(
            "Measure",
          );
          return;

        case "c":
          event.preventDefault();
          handleWorkspaceTool(
            "Camera",
          );
          return;

        case "1":
          event.preventDefault();
          setIsPlaying(
            false,
          );
          setActiveReconstructionView(
            "2D",
          );
          return;

        case "3":
          event.preventDefault();
          setIsPlaying(
            false,
          );
          setActiveReconstructionView(
            "3D",
          );
          return;

        case "home":
          if (
            activeReconstructionView ===
            "2D"
          ) {
            event.preventDefault();
            setSceneView({
              zoom:
                MIN_SCENE_ZOOM,
              panX: 0,
              panY: 0,
            });
          }

          return;

        default:
          return;
      }
    };

    window.addEventListener(
      "keydown",
      handleViewportShortcut,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleViewportShortcut,
      );
  }, [
    activeInvestigationDetail,
    activeReconstructionView,
    fieldPlacementOpen,
    handlePlayPause,
    workspaceSettingsOpen,
  ]);

  const renderWorkspaceTools = () => (
    <>
      {workspaceToolbarVisible && (
        <nav
          className="reconstruction-workspace__tools reconstruction-workspace__blender-toolbar"
          aria-label="Viewport tools"
          data-scene-interactive="true"
        >
          {workspaceTools.map(
            ({
              label,
              icon: Icon,
              shortcut,
            }) => {
              const guidance =
                workspaceToolGuidance[
                  label
                ];

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    handleWorkspaceTool(
                      label,
                    )
                  }
                  className={
                    activeWorkspaceTool ===
                    label
                      ? "is-active"
                      : ""
                  }
                  aria-label={`${label} tool (${shortcut})`}
                  aria-pressed={
                    activeWorkspaceTool ===
                    label
                  }
                  data-tool={
                    label
                  }
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                  />

                  <span className="reconstruction-workspace__blender-tool-tooltip">
                    <span className="reconstruction-workspace__blender-tool-tooltip-title">
                      <strong>
                        {guidance.title}
                      </strong>

                      <kbd>
                        {shortcut}
                      </kbd>
                    </span>

                    <small>
                      {activeReconstructionView ===
                      "2D"
                        ? guidance.twoD
                        : guidance.threeD}
                    </small>
                  </span>
                </button>
              );
            },
          )}
        </nav>
      )}

      {shortcutHelpVisible && (
        <aside
          className="reconstruction-workspace__shortcut-sheet"
          data-scene-interactive="true"
          aria-label="Reconstruction keyboard shortcuts"
        >
          <header>
            <div>
              <span>
                Viewport
              </span>
              <strong>
                Keyboard Shortcuts
              </strong>
            </div>

            <button
              type="button"
              onClick={() =>
                setShortcutHelpVisible(
                  false,
                )
              }
              aria-label="Close keyboard shortcuts"
            >
              ×
            </button>
          </header>

          <div className="reconstruction-workspace__shortcut-groups">
            <section>
              <strong>
                Tools
              </strong>

              <div>
                <span>
                  <kbd>W</kbd>
                  Select
                </span>
                <span>
                  <kbd>G</kbd>
                  Move / Grab
                </span>
                <span>
                  <kbd>R</kbd>
                  Rotate
                </span>
                <span>
                  <kbd>S</kbd>
                  Scale
                </span>
                <span>
                  <kbd>M</kbd>
                  Measure
                </span>
                <span>
                  <kbd>C</kbd>
                  Camera
                </span>
                <span>
                  <kbd>Shift</kbd>
                  <kbd>T</kbd>
                  Timeline
                </span>
              </div>
            </section>

            <section>
              <strong>
                Viewport
              </strong>

              <div>
                <span>
                  <kbd>T</kbd>
                  Toolbar
                </span>
                <span>
                  <kbd>N</kbd>
                  Properties
                </span>
                <span>
                  <kbd>1</kbd>
                  2D View
                </span>
                <span>
                  <kbd>3</kbd>
                  3D View
                </span>
                <span>
                  <kbd>Home</kbd>
                  Fit 2D
                </span>
                <span>
                  <kbd>?</kbd>
                  Shortcut sheet
                </span>
              </div>
            </section>

            <section>
              <strong>
                Playback & History
              </strong>

              <div>
                <span>
                  <kbd>Space</kbd>
                  Play / Pause
                </span>
                <span>
                  <kbd>Ctrl</kbd>
                  <kbd>Z</kbd>
                  Undo
                </span>
                <span>
                  <kbd>Ctrl</kbd>
                  <kbd>Shift</kbd>
                  <kbd>Z</kbd>
                  Redo
                </span>
              </div>
            </section>
          </div>
        </aside>
      )}
    </>
  );

  const handleLoadScenario = (scenario: ReconstructionScenario) => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setReconstruction(structuredClone(scenario.snapshot));
    showSaveMessage(
      `${scenario.name} loaded into the editor. The saved scenario remains unchanged until you explicitly replace it.`,
      "info",
      4500,
    );
  };

  const renderEvidenceWorkspace = (
    initialTab: "evidence" | "measurements" | "photos",
  ) => (
    <EvidenceWorkspacePanel
      key={initialTab}
      initialTab={initialTab}
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
      onCancelEvidencePlacement={() => setActiveEvidencePlacementId(null)}
      onAddPhoto={(photo) =>
        setReconstruction((current) => ({
          ...current,
          photos: [...current.photos, photo],
          evidenceRecords: photo.linkedEvidenceId
            ? current.evidenceRecords.map((record) =>
                record.id === photo.linkedEvidenceId
                  ? {
                      ...record,
                      photoIds: Array.from(new Set([...record.photoIds, photo.id])),
                    }
                  : record,
              )
            : current.evidenceRecords,
        }))
      }
      onPhotoChange={(photoId, updates) => {
        const linkChanged = Object.prototype.hasOwnProperty.call(
          updates,
          "linkedEvidenceId",
        );
        updatePhoto(photoId, updates);

        if (linkChanged) {
          setReconstruction((current) => ({
            ...current,
            evidenceRecords: current.evidenceRecords.map((record) => ({
              ...record,
              photoIds:
                record.id === updates.linkedEvidenceId
                  ? Array.from(new Set([...record.photoIds, photoId]))
                  : record.photoIds.filter((id) => id !== photoId),
            })),
          }));
        }
      }}
      onDeletePhoto={(photoId) =>
        setReconstruction((current) => ({
          ...current,
          photos: current.photos.filter((photo) => photo.id !== photoId),
          evidenceRecords: current.evidenceRecords.map((record) => ({
            ...record,
            photoIds: record.photoIds.filter((id) => id !== photoId),
          })),
        }))
      }
    />
  );

  return (
    <div
      className={`reconstruction-editor reconstruction-workspace reconstruction-workspace--${activeReconstructionView.toLowerCase()}`}
      data-reconstruction-view={
        activeReconstructionView.toLowerCase()
      }
    >
      <div className="reconstruction-workspace__header">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={caseContext?.casePath ?? "/"}
            className="reconstruction-workspace__icon-button"
            aria-label={caseContext ? "Back to case" : "Back to dashboard"}
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-200">
              {(caseContext?.caseNumber ?? reconstruction.accidentId) || "RoadSafe AR"}
              <span className="mx-2 text-slate-600">·</span>
              {caseContext?.caseTitle ?? reconstruction.title}
            </p>
            <p className="mt-1 truncate text-[8px] uppercase tracking-[0.12em] text-slate-600">
              Accident reconstruction workspace
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <div className="reconstruction-workspace__view-switch">
            {(["2D", "3D"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveReconstructionView(view);
                }}
                className={activeReconstructionView === view ? "is-active" : ""}
              >
                {view} View
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setWorkspaceSettingsOpen(
                (value) => !value,
              )
            }
            className={`reconstruction-workspace__button ${
              workspaceSettingsOpen ? "is-active" : ""
            }`}
            aria-pressed={workspaceSettingsOpen}
          >
            Panels
          </button>

                    <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new Event(
                  "roadsafe:nodes-open",
                ),
              )
            }
            className="reconstruction-workspace__button"
            aria-label="Open reconstruction nodes"
          >
            <Layers3 size={14} />
            Nodes
          </button>

<button
            type="button"
            onClick={() => {
              setWorkspaceSettingsOpen(true);
              window.requestAnimationFrame(() => {
                sceneObjectPaletteRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              });
            }}
            className="reconstruction-workspace__button"
          >
            Objects & Evidence
          </button>

          {caseContext && (
            <>
              <Link to={caseContext.reportPath} className="reconstruction-workspace__button">
                Export
              </Link>
              <ReconstructionRecorder
                reconstruction={reconstruction}
                caseId={caseContext.caseId}
                caseNumber={caseContext.caseNumber}
                recordedBy={caseContext.recordedBy}
                onBeforeRecord={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                  currentTimeRef.current = 0;
                  const prepared = preparePhysicsForPlayback(reconstruction);
                  const saved = ReconstructionService.save({
                    ...prepared,
                    accidentId: caseContext.caseNumber,
                  });
                  setReconstruction(saved);
                  onReconstructionSaved?.(saved);
                  return saved;
                }}
                onSaved={(footage) => {
                  onFootageSaved?.(footage);
                  showSaveMessage("Reconstruction footage saved to the case.");
                }}
              />
            </>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="reconstruction-workspace__button reconstruction-workspace__button--primary"
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      {saveMessage && (
        <div
          role={saveMessageType === "error" ? "alert" : "status"}
          className={`reconstruction-workspace__toast ${saveMessageType === "error" ? "is-error" : ""}`}
        >
          {saveMessage}
        </div>
      )}

      <div className="reconstruction-workspace__body">
        {activeReconstructionView === "3D" && (
          <div className="reconstruction-workspace__stage-grid reconstruction-workspace__stage-grid--3d">
            <div className="reconstruction-workspace__stage-main">
              {renderWorkspaceTools()}
              <Suspense
                fallback={
                  <div className="reconstruction-workspace__loading">
                    Loading interactive 3D reconstruction…
                  </div>
                }
              >
                <Reconstruction3DViewer
                  reconstruction={reconstruction}
                  onSwitchTo2D={() => setActiveReconstructionView("2D")}
                  onRunPhysics={handleRunPhysics}
                  onPreparePlayback={handlePreparePlayback}
                  workspaceMode
                  selectedParticipantId={selectedParticipantId}
                  onSelectParticipant={(participantId) =>
                    handleSelectParticipant(participantId)
                  }
                  selectedSceneObjectId={selectedSceneObjectId}
                  onSelectSceneObject={(objectId) =>
                    handleSelectSceneObject(objectId)
                  }
                  onTransformSceneObject={(objectId, next) => {
                    setIsPlaying(false);

                    const object =
                      reconstruction.sceneObjects.find(
                        (item) =>
                          item.id ===
                          objectId,
                      );

                    if (!object) {
                      return;
                    }

                    if (activeWorkspaceTool === "Move") {
                      updateSceneObject(
                        objectId,
                        {
                          position:
                            next.position,
                        },
                      );

                      return;
                    }

                    if (activeWorkspaceTool === "Rotate") {
                      updateSceneObject(
                        objectId,
                        {
                          rotation:
                            next.rotationDegrees,
                        },
                      );

                      return;
                    }

                    if (activeWorkspaceTool === "Scale") {
                      updateSceneObject(
                        objectId,
                        {
                          scale:
                            clamp(
                              object.scale *
                                next.scaleMultiplier,
                              0.2,
                              5,
                            ),
                        },
                      );
                    }
                  }}
                  onTransformParticipant={(participantId, next) => {
                    setIsPlaying(false);

                    const participant =
                      reconstruction.vehicles.find(
                        (item) =>
                          item.id ===
                          participantId,
                      );

                    if (!participant) {
                      return;
                    }

                    if (activeWorkspaceTool === "Scale") {
                      updateParticipant(
                        participantId,
                        {
                          visualScale:
                            clamp(
                              next.visualScale,
                              0.2,
                              5,
                            ),
                        },
                      );

                      return;
                    }

                    const state =
                      getParticipantStateAtTime(
                        participant,
                        currentTime,
                        getReconstructionWorldDimensions(
                          reconstruction,
                        ),
                      );

                    const activePoint =
                      participant.pathPoints.find(
                        (point) =>
                          point.id ===
                          state.activePointId,
                      );

                    if (
                      !activePoint ||
                      !canBeginRoutePointDrag(
                        activePoint,
                      )
                    ) {
                      showSaveMessage(
                        "Point Z and physics-generated points cannot be transformed independently.",
                        "info",
                        3000,
                      );

                      return;
                    }

                    updatePathPoint(
                      participantId,
                      activePoint.id,
                      activeWorkspaceTool === "Move"
                        ? {
                            position:
                              next.position,
                          }
                        : {
                            rotation:
                              next.rotationDegrees,
                          },
                    );
                  }}
                  cameraCycleToken={cameraCycleToken}
                  workspaceTimeSeconds={currentTime}
                  workspaceTimeSourceRef={currentTimeRef}
                  workspacePlaying={isPlaying}
                  workspacePlaybackSpeed={playbackSpeed}
                  workspaceCameraMode={workspaceCameraMode}
                  workspaceLayers={workspaceLayers}
                  workspaceTool={activeWorkspaceTool}
                  onDropParticipantAsset={createLibraryParticipantAt}
                  onDropSceneObject={createLibrarySceneObjectAt}
                />
              </Suspense>
            </div>

            {workspaceRightPanelHost && workspacePropertiesOpen ? createPortal(
              <aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel reconstruction-workspace__blender-properties">
                <nav
                  className="reconstruction-workspace__blender-properties-tabs"
                  aria-label="Reconstruction properties"
                >
                  {(
                    [
                      ["participant", "Participant", Crosshair],
                      ["camera", "Camera", Camera],
                      ["layers", "Layers", Layers3],
                      ["physics", "Physics", Activity],
                      ["scene", "Scene", ClipboardList],
                    ] as const
                  ).map(([tab, label, Icon]) => (
                    <button
                      key={tab}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={workspacePropertiesTab === tab}
                      className={
                        workspacePropertiesTab === tab
                          ? "is-active"
                          : ""
                      }
                      onClick={() => {
                        setWorkspaceSettingsOpen(false);
                        setWorkspacePropertiesTab(tab);
                      }}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                
                  <button
                    type="button"
                    data-workspace-inspector-tab="true"
                    title="Workspace & Investigation"
                    aria-label="Workspace & Investigation"
                    aria-pressed={workspaceSettingsOpen}
                    className={
                      workspaceSettingsOpen
                        ? "is-active"
                        : ""
                    }
                    onClick={() =>
                      setWorkspaceSettingsOpen(true)
                    }
                  >
                    <Layers3 size={15} />
                  </button>
</nav>

                <div className="reconstruction-workspace__blender-properties-editor">
                  <header className="reconstruction-workspace__blender-properties-header">
                    <div>
                      <span>Properties</span>
                      <strong>
                        {workspacePropertiesTab === "participant"
                          ? selectedParticipant?.name ?? "Participant"
                          : workspacePropertiesTab === "camera"
                            ? "Camera"
                            : workspacePropertiesTab === "layers"
                              ? "Layers and overlays"
                              : workspacePropertiesTab === "physics"
                                ? "Physics telemetry"
                                : "Scene environment"}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWorkspacePropertiesOpen(false)}
                      aria-label="Close properties"
                      title="Close properties"
                    >
                      ×
                    </button>
                  </header>

                  <div className="reconstruction-workspace__blender-properties-content">
                    {workspacePropertiesTab === "participant" && (
                      <>
                        <div className="roadsafe-3d-scene-collection-browser">
                          <SceneCollectionAssetBrowser
                            reconstruction={reconstruction}
                            selectedParticipantId={selectedParticipantId}
                            selectedSceneObjectId={selectedSceneObjectId}
                            onSelectParticipant={handleSelectParticipant}
                            onSelectSceneObject={handleSelectSceneObject}
                            onUpdateParticipant={updateParticipant}
                            onArmParticipantPlacement={
                              handleArmLibraryParticipantPlacement
                            }
                          />
                        </div>
                        {!selectedParticipant || !selectedParticipantState ? (
                          <div className="reconstruction-workspace__blender-properties-empty">
                            Select a participant in the 3D scene to inspect it.
                          </div>
                        ) : (
                          <>
                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Participant</summary>
                              <div className="reconstruction-workspace__blender-properties-rows">
                                <label>
                                  <span>Name</span>
                                  <input
                                    value={selectedParticipant.name}
                                    onChange={(event) =>
                                      updateParticipant(selectedParticipant.id, {
                                        name: event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <div>
                                  <span>Type</span>
                                  <strong>{selectedParticipant.type}</strong>
                                </div>

                                <label>
                                  <span>Model</span>
                                  <select
                                    value={
                                      selectedParticipant.assetId ??
                                      getDefaultParticipantAssetId(
                                        selectedParticipant.type,
                                      )
                                    }
                                    onChange={(event) =>
                                      updateParticipant(selectedParticipant.id, {
                                        assetId:
                                          event.target
                                            .value as ReconstructionParticipantAssetId,
                                      })
                                    }
                                  >
                                    {getParticipantAssetsForType(
                                      selectedParticipant.type,
                                    ).map((asset) => (
                                      <option
                                        key={asset.id}
                                        value={asset.id}
                                      >
                                        {asset.shortLabel}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </details>

                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Transform</summary>
                              <div className="reconstruction-workspace__blender-properties-rows">
                                <div>
                                  <span>Position X</span>
                                  <strong>
                                    {selectedParticipantState.position.x.toFixed(
                                      2,
                                    )}
                                  </strong>
                                </div>

                                <div>
                                  <span>Position Y</span>
                                  <strong>
                                    {selectedParticipantState.position.y.toFixed(
                                      2,
                                    )}
                                  </strong>
                                </div>

                                <label>
                                  <span>Heading</span>
                                  <input
                                    type="number"
                                    value={Math.round(
                                      selectedParticipantState.rotation,
                                    )}
                                    onChange={(event) =>
                                      updatePathPoint(
                                        selectedParticipant.id,
                                        selectedParticipantState.activePointId,
                                        {
                                          rotation: Number(
                                            event.target.value,
                                          ),
                                        },
                                      )
                                    }
                                  />
                                </label>
                                <div>
                                  <span>Model Scale</span>
                                  <strong>
                                    {(selectedParticipant.visualScale ?? 1).toFixed(2)}×
                                  </strong>
                                </div>
                              </div>
                            </details>

                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Motion</summary>
                              <div className="reconstruction-workspace__blender-properties-rows">
                                <div>
                                  <span>Speed</span>
                                  <strong>
                                    {selectedParticipantState.speedKmh.toFixed(
                                      1,
                                    )}{" "}
                                    km/h
                                  </strong>
                                </div>

                                <div>
                                  <span>Mass</span>
                                  <strong>
                                    {selectedParticipant.physics?.massKg ?? "—"}{" "}
                                    kg
                                  </strong>
                                </div>
                              </div>
                            </details>
                          </>
                        )}
                      </>
                    )}

                    {workspacePropertiesTab === "camera" && (
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>View</summary>
                        <div className="reconstruction-workspace__blender-properties-rows">
                          <label>
                            <span>Mode</span>
                            <select
                              value={workspaceCameraMode}
                              onChange={(event) =>
                                setWorkspaceCameraMode(
                                  event.target.value as WorkspaceCameraMode,
                                )
                              }
                            >
                              <option value="Orbit">Orbit</option>
                              <option value="Overhead">Overhead</option>
                              <option value="Roadside">Roadside</option>
                              <option value="Driver">Driver</option>
                            </select>
                          </label>
                        </div>
                      </details>
                    )}

                    {workspacePropertiesTab === "layers" && (
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Viewport Overlays</summary>
                        <div className="reconstruction-workspace__blender-properties-checks">
                          {(
                            [
                              ["paths", "Participant paths"],
                              ["objects", "Scene objects"],
                              ["evidence", "Evidence and measurements"],
                              ["physics", "Physics effects"],
                            ] as const
                          ).map(([key, label]) => (
                            <label key={key}>
                              <input
                                type="checkbox"
                                checked={workspaceLayers[key]}
                                onChange={(event) =>
                                  setWorkspaceLayers((current) => ({
                                    ...current,
                                    [key]: event.target.checked,
                                  }))
                                }
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    )}

                    {workspacePropertiesTab === "physics" && (
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Collision Telemetry</summary>
                        <div className="reconstruction-workspace__blender-properties-rows">
                          <div>
                            <span>Impact speed</span>
                            <strong>
                              {selectedPhysicsEvent?.relativeSpeedKmh.toFixed(
                                1,
                              ) ?? "—"}{" "}
                              km/h
                            </strong>
                          </div>

                          <div>
                            <span>Total impulse</span>
                            <strong>
                              {selectedPhysicsEvent
                                ? `${selectedPhysicsEvent.totalImpulseNs.toFixed(
                                    0,
                                  )} N·s`
                                : "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Average force</span>
                            <strong>
                              {selectedPhysicsEvent
                                ? `${selectedPhysicsEvent.estimatedAverageForceRangeKn.minimum.toFixed(
                                    1,
                                  )}–${selectedPhysicsEvent.estimatedAverageForceRangeKn.maximum.toFixed(
                                    1,
                                  )} kN`
                                : "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Post-impact travel</span>
                            <strong>
                              {selectedParticipantKinematics
                                ? `${selectedParticipantKinematics.postImpactTravelDistanceMetres.toFixed(
                                    2,
                                  )} m`
                                : "—"}
                            </strong>
                          </div>
                        </div>
                      </details>
                    )}

                    {workspacePropertiesTab === "scene" && (
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Environment</summary>
                        <div className="reconstruction-workspace__blender-properties-rows">
                          <div>
                            <span>Weather</span>
                            <strong>{reconstruction.scene.weather}</strong>
                          </div>

                          <div>
                            <span>Surface</span>
                            <strong>{reconstruction.scene.roadSurface}</strong>
                          </div>

                          <div>
                            <span>Visibility</span>
                            <strong>{reconstruction.scene.visibility}</strong>
                          </div>

                          <div>
                            <span>Terrain</span>
                            <strong>
                              {reconstruction.scene.useRealTerrain
                                ? `${reconstruction.scene.terrainAreaMetres}m DEM`
                                : "Flat"}
                            </strong>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </aside>,
                workspaceRightPanelHost,
              ) : (
              <button
                type="button"
                className="reconstruction-workspace__inspector-tab"
                onClick={() => setWorkspacePropertiesOpen(true)}
              >
                <Layers3 size={14} />
                Inspector
              </button>
            )}
          </div>
        )}

        <div className={`${activeReconstructionView === "3D" ? "hidden" : "grid"} reconstruction-workspace__2d-grid reconstruction-workspace__2d-grid--scene-only`}>
          <main
            className={`ui-panel reconstruction-workspace__canvas min-w-0 overflow-hidden ${
              sceneExpanded
                ? "fixed inset-2 z-[100] flex flex-col shadow-2xl sm:inset-4"
                : ""
            }`}
          >
            <div className="reconstruction-workspace__legacy-scene-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#494949] bg-[#292929] px-4 py-3">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-200">
                  Reconstruction Scene
                </h2>
                <p className="mt-1 text-[9px] text-slate-600">
                  Full calibrated area: {reconstruction.scene.sceneWidthMetres}m × {reconstruction.scene.sceneHeightMetres}m. Drag movement points for detailed placement.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
                <div className="flex rounded-md border border-[#494949] bg-[#303030] p-1">
                  {(["Diagram", "Street", "Satellite"] as ReconstructionBasemapMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBasemapMode(mode)}
                      aria-pressed={basemapMode === mode}
                      className={`relative rounded-sm border-b-2 px-3 py-1.5 text-[9px] font-bold transition-colors ${basemapMode === mode ? "border-[#E8872D] bg-[#383838] text-white" : "border-transparent bg-[#292929] text-[#B8B8B8] hover:bg-[#383838] hover:text-white"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={handleUndo} disabled={!historyAvailability.canUndo} className="ui-button py-1.5 disabled:opacity-40">Undo</button>
                <button type="button" onClick={handleRedo} disabled={!historyAvailability.canRedo} className="ui-button py-1.5 disabled:opacity-40">Redo</button>
                <button
                  type="button"
                  disabled={!selectedParticipantId}
                  onClick={() => setRouteDrawingParticipantId((current) => current ? null : selectedParticipantId)}
                  className={`ui-button py-1.5 text-white disabled:opacity-40 ${routeDrawingParticipantId ? "border-[#87414f] bg-[#562635]" : ""}`}
                >
                  {routeDrawingParticipantId ? "Cancel Route" : "Draw Route"}
                </button>
                <span className=" bg-green-100 px-2 py-1 font-bold text-green-700">
                  Start
                </span>
                <span className=" bg-amber-100 px-2 py-1 font-bold text-amber-700">
                  Brake
                </span>
                <span className=" bg-[#303030] px-2 py-1 font-bold text-[#c4c4c4]">
                  Turn / Swerve
                </span>
                <span className=" bg-red-100 px-2 py-1 font-bold text-red-700">
                  Impact
                </span>
              </div>
            </div>

            <div
              ref={(element) => {
                sceneRef.current = element;
                sceneViewportRef.current = element;
              }}
              onPointerDown={handleScenePointerDown}
              onPointerMove={handleSceneGesturePointerMove}
              onPointerUp={handleSceneGesturePointerEnd}
              onPointerCancel={handleSceneGesturePointerEnd}
              onContextMenu={(event) => event.preventDefault()}
              onDragOver={handleLibrarySceneDragOver}
              onDragEnter={handleLibrarySceneDragOver}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                  setSceneAssetDragActive(false);
                }
              }}
              onDrop={handleLibrarySceneDrop}
              className={`reconstruction-workspace__2d-viewport relative isolate touch-none overflow-hidden bg-slate-600 ${
                sceneExpanded
                  ? "min-h-[320px] flex-1"
                  : ""
              } ${sceneCursorClass} ${
                sceneAssetDragActive
                  ? "is-library-drop-target"
                  : ""
              }`}
            >
              {renderWorkspaceTools()}

              <button
                type="button"
                data-scene-interactive="true"
                className="reconstruction-workspace__map-expand-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setSceneExpanded((current) => !current);
                }}
                aria-label={sceneExpanded ? "Exit expanded map view" : "Expand map view"}
                aria-pressed={sceneExpanded}
                title={sceneExpanded ? "Exit expanded map view" : "Expand map view"}
              >
                {sceneExpanded ? <X size={17} /> : <Expand size={17} />}
              </button>

              {pendingParticipantPlacement && (
                <ParticipantPlacementOverlay
                  participantType={pendingParticipantPlacement.type}
                  gpsBusy={participantGpsBusy}
                  gpsAvailable={Boolean(reconstruction.fieldCalibration)}
                  message={participantPlacementMessage}
                  onUseGps={handleUseParticipantGps}
                  onCancel={() => {
                    setPendingParticipantPlacement(null);
                    setParticipantGpsBusy(false);
                    setParticipantPlacementMessage("");
                  }}
                />
              )}

              <div data-scene-interactive="true" className="reconstruction-workspace__map-controls absolute right-3 top-3 z-[90] grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-2 text-white shadow-xl backdrop-blur" aria-label="2D map navigation controls">
                <span />
                <button type="button" title="Pan map north" aria-label="Pan map north" onClick={() => setSceneView((view) => ({ ...view, panY: view.panY + 40 }))} className="rounded bg-white/15 p-2 font-black">↑</button>
                <button type="button" title="Zoom map in" aria-label="Zoom map in" onClick={() => setSceneView((view) => ({ ...view, zoom: Math.min(MAX_SCENE_ZOOM, view.zoom + SCENE_ZOOM_STEP) }))} className="rounded bg-white/15 p-2 font-black">+</button>
                <button type="button" title="Pan map west" aria-label="Pan map west" onClick={() => setSceneView((view) => ({ ...view, panX: view.panX + 40 }))} className="rounded bg-white/15 p-2 font-black">←</button>
                <button type="button" title="Fit the complete map" aria-label="Fit the complete map" onClick={() => setSceneView({ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 })} className="rounded bg-white/15 p-2 text-[9px] font-black">FIT</button>
                <button type="button" title="Pan map east" aria-label="Pan map east" onClick={() => setSceneView((view) => ({ ...view, panX: view.panX - 40 }))} className="rounded bg-white/15 p-2 font-black">→</button>
                <button
                  type="button"
                  title={
                    sceneView.zoom <= MIN_SCENE_ZOOM + 0.0001
                      ? "Selected workspace is already fully fitted"
                      : "Zoom map out"
                  }
                  aria-label="Zoom map out"
                  disabled={
                    sceneView.zoom <= MIN_SCENE_ZOOM + 0.0001
                  }
                  onClick={() =>
                    setSceneView((view) => {
                      const nextZoom = Math.max(
                        MIN_SCENE_ZOOM,
                        view.zoom - SCENE_ZOOM_STEP,
                      );

                      if (
                        nextZoom <=
                        MIN_SCENE_ZOOM + 0.0001
                      ) {
                        return {
                          zoom: MIN_SCENE_ZOOM,
                          panX: 0,
                          panY: 0,
                        };
                      }

                      return {
                        ...view,
                        zoom: nextZoom,
                      };
                    })
                  }
                  className="rounded bg-white/15 p-2 font-black"
                >
                  −
                </button>
                <button type="button" title="Pan map south" aria-label="Pan map south" onClick={() => setSceneView((view) => ({ ...view, panY: view.panY - 40 }))} className="rounded bg-white/15 p-2 font-black">↓</button>
                <span
                  data-roadsafe-orthographic-scale="true"
                  className="self-center text-center text-[8px] font-black"
                  title={`Orthographic fit · ${(
                    sceneMetricFrame.pixelsPerMetre *
                    sceneView.zoom
                  ).toFixed(2)} px/m`}
                >
                  {Math.round(
                    sceneView.zoom *
                    100,
                  )}%
                </span>
              </div>

              {routeDrawingParticipantId && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[95] -translate-x-1/2 rounded-full bg-[#303030] px-4 py-2 text-xs font-black text-white shadow-lg">
                  Hold and draw the complete route; release to create editable points through the collision
                </div>
              )}

              <div
                ref={
                  sceneMetricPlaneRef
                }
                data-roadsafe-2d-projection="true-orthographic-metric"
                className="roadsafe-2d-orthographic-plane origin-center"
                style={{
                  width:
                    `${sceneMetricFrame.widthPx}px`,

                  height:
                    `${sceneMetricFrame.heightPx}px`,

                  /*
                   * The base sheet is centred in the viewport. Pan is applied
                   * in screen pixels; zoom remains uniform on both axes.
                   */
                  transform:
                    `translate(calc(-50% + ${sceneView.panX}px), calc(-50% + ${sceneView.panY}px)) scale(${sceneView.zoom})`,
                }}
              
                data-roadsafe-gizmo-plane="true">
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
                  if (
                    activeWorkspaceTool === "Move" &&
                    !reconstruction.collisionSetup?.locked
                  ) {
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
                title="Primary collision point — select it, then use Move to reposition when unlocked"
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
            {!isPlaying &&
              (
                activeWorkspaceTool === "Move" ||
                activeWorkspaceTool === "Rotate" ||
                activeWorkspaceTool === "Scale"
              ) &&
              (() => {
                if (selectedSceneObject) {
                  return (
                    <TransformGizmo2D
                      mode={activeWorkspaceTool}
                      label={selectedSceneObject.label}
                      disabled={selectedSceneObject.locked}
                      value={{
                        position: selectedSceneObject.position,
                        rotationDegrees: selectedSceneObject.rotation,
                        scale: selectedSceneObject.scale,
                      }}
                      onChange={(next) => {
                        if (activeWorkspaceTool === "Move") {
                          updateSceneObject(
                            selectedSceneObject.id,
                            { position: next.position },
                          );
                          return;
                        }
            
                        if (activeWorkspaceTool === "Rotate") {
                          updateSceneObject(
                            selectedSceneObject.id,
                            { rotation: next.rotationDegrees },
                          );
                          return;
                        }
            
                        updateSceneObject(
                          selectedSceneObject.id,
                          { scale: next.scale },
                        );
                      }}
                    />
                  );
                }
            
                if (
                  selectedParticipant &&
                  selectedParticipantState
                ) {
                  const activePoint =
                    selectedParticipant.pathPoints.find(
                      (point) =>
                        point.id ===
                        selectedParticipantState.activePointId,
                    );
            
                  const routeTransformLocked =
                    !activePoint ||
                    !canBeginRoutePointDrag(activePoint);
            
                  return (
                    <TransformGizmo2D
                      mode={activeWorkspaceTool}
                      label={selectedParticipant.name}
                      disabled={
                        activeWorkspaceTool !== "Scale" &&
                        routeTransformLocked
                      }
                      value={{
                        position: selectedParticipantState.position,
                        rotationDegrees: selectedParticipantState.rotation,
                        scale: selectedParticipant.visualScale ?? 1,
                      }}
                      onChange={(next) => {
                        if (activeWorkspaceTool === "Scale") {
                          updateParticipant(
                            selectedParticipant.id,
                            { visualScale: next.scale },
                          );
                          return;
                        }
            
                        if (
                          !activePoint ||
                          routeTransformLocked
                        ) {
                          return;
                        }
            
                        updatePathPoint(
                          selectedParticipant.id,
                          activePoint.id,
                          activeWorkspaceTool === "Move"
                            ? { position: next.position }
                            : { rotation: next.rotationDegrees },
                        );
                      }}
                    />
                  );
                }
            
                return null;
              })()}


              {measurementToolActive && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-[#303030] px-4 py-2 text-xs font-bold text-white shadow-lg">
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
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-[#303030] px-4 py-2 text-xs font-bold text-white shadow-lg">
                  Click to place: {activeSceneObjectType}
                </div>
              )}

              {traceToolObjectId && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-[#303030] px-4 py-2 text-xs font-bold text-white shadow-lg">
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
                        if (activeWorkspaceTool === "Move") {
                          setDragState({
                            kind: "scene-object-trace-point",
                            objectId: selectedSceneObject.id,
                            pointIndex,
                          });
                        }
                      }}
                      className="absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#303030] shadow"
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      title={`Curve point ${pointIndex + 1}`}
                    />
                  );
                })}

              {reconstruction.vehicles.map((participant, participantIndex) => {
                const state = getParticipantStateAtTime(
                                participant,
                                currentTime,
                                getReconstructionWorldDimensions(reconstruction),
                              );
                const pathPoints = sortMovementPathPoints(participant.pathPoints);
                const { path, skidPath } = getParticipantPathGeometry(participant);
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
                const participantWasInImpact =
                  impactEffect.participantIds.includes(
                    participant.id,
                  );

                const impactEnvelope =
                  impactEffect.active &&
                  participantWasInImpact
                    ? Math.max(
                        0,
                        1 -
                          impactEffect.progress /
                            0.34,
                      ) *
                      impactEffect.intensity
                    : 0;

                const rotationShake =
                  Math.sin(
                    impactEffect.progress *
                      Math.PI *
                      3 +
                      participantIndex *
                        0.18,
                  ) *
                  impactEnvelope *
                  1.25;

                /*
                 * Position is controlled only by the reconstruction path.
                 * Collision emphasis is rotational plus the independent impact
                 * overlay, so React rerenders cannot overwrite the native-frame
                 * DOM path with a second translated body position.
                 */
                const shakeX = 0;
                const shakeY = 0;

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
                          stroke="#292929"
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
                          data-playback-vector-line-id={participant.id}
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
                          data-playback-vector-tip-id={participant.id}
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
                        data-playback-speed-label-id={participant.id}
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
                          if (
                            activeWorkspaceTool === "Move" &&
                            canBeginRoutePointDrag(point)
                          ) {
                            setDragState({
                              kind: "participant-path-point",
                              participantId: participant.id,
                              pointId: point.id,
                            });
                          }
                        }}
                        className={`absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[9px] font-black text-white shadow ${
                          selectedPathPointId === point.id
                            ? "ring-4 ring-[#e8872d]"
                            : ""
                        }`}
                        style={{
                          left: `${point.position.x}%`,
                          top: `${point.position.y}%`,
                          backgroundColor: getPathPointColour(point),
                        }}
                        title={
                          isPointZ(point)
                            ? `${participant.name}: Point Z is locked to the primary collision marker`
                            : `${participant.name}: ${point.label} at ${point.timeSeconds.toFixed(1)}s — use Move to reposition`
                        }
                      >
                        {isPointZ(point) ? "Z" : index + 1}
                      </button>
                    ))}

                    <div
                      data-playback-smoke-id={participant.id}
                      className="pointer-events-none absolute z-[28] -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${state.position.x}%`,
                        top: `${state.position.y}%`,
                        display:
                          (activeAction === "Brake" || activeAction === "Slide") &&
                          state.speedKmh > 5
                            ? "block"
                            : "none",
                      }}
                    >
                      <span className="absolute h-8 w-8 -translate-x-5 -translate-y-2 rounded-full bg-slate-200/35" />
                      <span className="absolute h-5 w-5 -translate-x-8 translate-y-1 rounded-full bg-white/35" />
                    </div>

                    <button
                      type="button"
                      data-scene-interactive="true"
                      data-playback-participant-id={participant.id}
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

          </main>

          

        </div>

        {activeReconstructionView === "2D" &&
          workspaceRightPanelHost &&
          createPortal(
            (
              <aside
                className="roadsafe-inspector workstation-panel workstation-panel--right roadsafe-reconstruction-inspector reconstruction-workspace__properties reconstruction-workspace__properties--2d reconstruction-workspace__context-panel reconstruction-workspace__shell-inspector reconstruction-workspace__blender-properties reconstruction-workspace__blender-properties--2d-v5 is-docked is-open"
                aria-label="2D reconstruction properties"
              >
                <nav
                  className="reconstruction-workspace__blender-properties-tabs"
                  aria-label="2D reconstruction property categories"
                >
                  {(
                    [
                      ["participants", "Participants", Activity],
                      ["selection", "Selection", Crosshair],
                      ["motion", "Motion", Move],
                      ["scene", "Scene", ClipboardList],
                    ] as const
                  ).map(([tab, label, Icon]) => (
                    <button
                      key={tab}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={workspace2DPropertiesTab === tab}
                      className={
                        workspace2DPropertiesTab === tab
                          ? "is-active"
                          : ""
                      }
                      onClick={() => {
                        setWorkspaceSettingsOpen(false);
                        setWorkspace2DPropertiesTab(tab);
                      }}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                
                  <button
                    type="button"
                    data-workspace-inspector-tab="true"
                    title="Workspace & Investigation"
                    aria-label="Workspace & Investigation"
                    aria-pressed={workspaceSettingsOpen}
                    className={
                      workspaceSettingsOpen
                        ? "is-active"
                        : ""
                    }
                    onClick={() =>
                      setWorkspaceSettingsOpen(true)
                    }
                  >
                    <Layers3 size={15} />
                  </button>
</nav>

                <div className="reconstruction-workspace__blender-properties-editor">
                  <header className="reconstruction-workspace__blender-properties-header">
                    <div>
                      <span>2D Properties</span>
                      <strong>
                        {workspace2DPropertiesTab === "participants"
                          ? `${reconstruction.vehicles.length} participant(s)`
                          : workspace2DPropertiesTab === "selection"
                            ? selectedSceneObject?.label ??
                              selectedParticipant?.name ??
                              "No selection"
                            : workspace2DPropertiesTab === "motion"
                              ? selectedParticipant?.name ?? "Motion"
                              : "Scene and basemap"}
                      </strong>
                    </div>

                    <span className="reconstruction-workspace__blender-properties-header-count">
                      {reconstruction.vehicles.length}
                    </span>
                  </header>

                  <div className="reconstruction-workspace__blender-properties-content">
                    {workspace2DPropertiesTab === "participants" && (
                      <SceneCollectionAssetBrowser
                        reconstruction={reconstruction}
                        selectedParticipantId={selectedParticipantId}
                        selectedSceneObjectId={selectedSceneObjectId}
                        onSelectParticipant={handleSelectParticipant}
                        onSelectSceneObject={handleSelectSceneObject}
                            onUpdateParticipant={updateParticipant}
                        onArmParticipantPlacement={
                          handleArmLibraryParticipantPlacement
                        }
                      />
                    )}

                    {workspace2DPropertiesTab === "selection" && (
                      <>
                        {selectedSceneObject ? (
                          <details
                            open
                            className="reconstruction-workspace__blender-properties-section"
                          >
                            <summary>Scene Object</summary>

                            <div className="reconstruction-workspace__blender-properties-embedded">
                              <SceneObjectSettingsPanel
                                object={selectedSceneObject}
                                tracing={
                                  traceToolObjectId ===
                                  selectedSceneObject.id
                                }
                                onChange={(updates) =>
                                  updateSceneObject(
                                    selectedSceneObject.id,
                                    updates,
                                  )
                                }
                                onDelete={handleDeleteSceneObject}
                                onDuplicate={handleDuplicateSceneObject}
                                onPlaceWithGps={
                                  handlePlaceSelectedSceneObjectWithGps
                                }
                                onBeginTrace={() => {
                                  setTraceToolObjectId(
                                    selectedSceneObject.id,
                                  );
                                  setActiveSceneObjectType(
                                    null,
                                  );
                                }}
                                onCancelTrace={() =>
                                  setTraceToolObjectId(
                                    null,
                                  )
                                }
                                onClearTrace={() =>
                                  updateSceneObject(
                                    selectedSceneObject.id,
                                    {
                                      tracePoints: [],
                                    },
                                  )
                                }
                              />
                            </div>
                          </details>
                        ) : !selectedParticipant ||
                          !selectedParticipantState ? (
                          <div className="reconstruction-workspace__blender-properties-empty">
                            Select a participant or scene object on the 2D reconstruction.
                          </div>
                        ) : (
                          <>
                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Participant</summary>

                              <div className="reconstruction-workspace__blender-properties-rows">
                                <label>
                                  <span>Name</span>
                                  <input
                                    value={selectedParticipant.name}
                                    onChange={(event) =>
                                      updateParticipant(
                                        selectedParticipant.id,
                                        {
                                          name:
                                            event.target.value,
                                        },
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  <span>Type</span>
                                  <select
                                    value={selectedParticipant.type}
                                    onChange={(event) =>
                                      handleParticipantTypeChange(
                                        selectedParticipant,
                                        event.target
                                          .value as ReconstructionVehicleType,
                                      )
                                    }
                                  >
                                    {PARTICIPANT_TYPES.map(
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
                                  <span>Model</span>
                                  <select
                                    value={
                                      selectedParticipant.assetId ??
                                      getDefaultParticipantAssetId(
                                        selectedParticipant.type,
                                      )
                                    }
                                    onChange={(event) =>
                                      updateParticipant(
                                        selectedParticipant.id,
                                        {
                                          assetId:
                                            event.target
                                              .value as ReconstructionParticipantAssetId,
                                        },
                                      )
                                    }
                                  >
                                    {getParticipantAssetsForType(
                                      selectedParticipant.type,
                                    ).map((asset) => (
                                      <option
                                        key={asset.id}
                                        value={asset.id}
                                      >
                                        {asset.shortLabel}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  <span>Colour</span>
                                  <select
                                    value={
                                      selectedParticipant.colour
                                    }
                                    onChange={(event) =>
                                      updateParticipant(
                                        selectedParticipant.id,
                                        {
                                          colour:
                                            event.target
                                              .value as ReconstructionVehicleColour,
                                        },
                                      )
                                    }
                                  >
                                    {PARTICIPANT_COLOURS.map(
                                      (colour) => (
                                        <option
                                          key={colour}
                                          value={colour}
                                        >
                                          {colour}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </label>
                              </div>
                            </details>

                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Transform</summary>

                              <div className="reconstruction-workspace__blender-properties-rows">
                                <div>
                                  <span>Position X</span>
                                  <strong>
                                    {selectedParticipantState.position.x.toFixed(
                                      2,
                                    )}
                                  </strong>
                                </div>

                                <div>
                                  <span>Position Y</span>
                                  <strong>
                                    {selectedParticipantState.position.y.toFixed(
                                      2,
                                    )}
                                  </strong>
                                </div>

                                <label>
                                  <span>Heading</span>
                                  <input
                                    type="number"
                                    value={Math.round(
                                      selectedParticipantState.rotation,
                                    )}
                                    onChange={(event) =>
                                      updatePathPoint(
                                        selectedParticipant.id,
                                        selectedParticipantState.activePointId,
                                        {
                                          rotation: Number(
                                            event.target.value,
                                          ),
                                        },
                                      )
                                    }
                                  />
                                </label>

                                <div>
                                  <span>Speed</span>
                                  <strong>
                                    {selectedParticipantState.speedKmh.toFixed(
                                      1,
                                    )}{" "}
                                    km/h
                                  </strong>
                                </div>
                              </div>
                            </details>
                          </>
                        )}
                      </>
                    )}

                    {workspace2DPropertiesTab === "motion" && (
                      <>
                        {!selectedParticipant ? (
                          <div className="reconstruction-workspace__blender-properties-empty">
                            Select a participant to edit motion and route controls.
                          </div>
                        ) : (
                          <>
                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Default Motion</summary>

                              <div className="reconstruction-workspace__blender-properties-rows">
                                <label className="reconstruction-workspace__blender-properties-range-row">
                                  <span>Speed</span>
                                  <div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={getMaximumSpeed(
                                        selectedParticipant.type,
                                      )}
                                      step={
                                        isHumanParticipant(
                                          selectedParticipant.type,
                                        )
                                          ? 1
                                          : 5
                                      }
                                      value={
                                        selectedParticipant.estimatedSpeedKmh
                                      }
                                      onChange={(event) =>
                                        updateParticipant(
                                          selectedParticipant.id,
                                          {
                                            estimatedSpeedKmh:
                                              Number(
                                                event.target.value,
                                              ),
                                          },
                                        )
                                      }
                                    />
                                    <strong>
                                      {
                                        selectedParticipant.estimatedSpeedKmh
                                      }{" "}
                                      km/h
                                    </strong>
                                  </div>
                                </label>
                              </div>
                            </details>

                            <details
                              open
                              className="reconstruction-workspace__blender-properties-section"
                            >
                              <summary>Route and Movement</summary>

                              <div className="reconstruction-workspace__blender-properties-embedded reconstruction-workspace__blender-properties-route">
                                <ParticipantPathPanel
                                  participant={selectedParticipant}
                                  durationSeconds={
                                    reconstruction.durationSeconds
                                  }
                                  worldDimensions={getReconstructionWorldDimensions(
                                    reconstruction,
                                  )}
                                  sceneObjects={
                                    reconstruction.sceneObjects
                                  }
                                  selectedPointId={
                                    selectedPathPointId
                                  }
                                  onSelectPoint={
                                    setSelectedPathPointId
                                  }
                                  onApplySpeedPlan={({
                                    estimatedSpeedKmh,
                                    pathPoints,
                                    requiredDurationSeconds,
                                  }) => {
                                    setReconstruction(
                                      (current) => ({
                                        ...current,
                                        durationSeconds:
                                          Math.max(
                                            current.durationSeconds,
                                            requiredDurationSeconds,
                                          ),
                                        lastPhysicsSimulation:
                                          undefined,
                                        vehicles:
                                          current.vehicles.map(
                                            (candidate) =>
                                              candidate.id ===
                                              selectedParticipant.id
                                                ? syncLegacyParticipantFields(
                                                    {
                                                      ...candidate,
                                                      estimatedSpeedKmh,
                                                      pathPoints,
                                                    },
                                                  )
                                                : candidate,
                                          ),
                                      }),
                                    );
                                  }}
                                  onParticipantChange={(
                                    updates,
                                  ) =>
                                    updateParticipant(
                                      selectedParticipant.id,
                                      updates,
                                    )
                                  }
                                  onPointChange={(
                                    pointId,
                                    updates,
                                  ) =>
                                    updatePathPoint(
                                      selectedParticipant.id,
                                      pointId,
                                      updates,
                                    )
                                  }
                                  onAddPoint={
                                    handleAddPathPoint
                                  }
                                  onDeletePoint={
                                    handleDeletePathPoint
                                  }
                                  onPlacePointWithGps={
                                    handlePlaceParticipantPointWithGps
                                  }
                                  onJumpToTime={(time) => {
                                    setIsPlaying(false);
                                    setCurrentTime(time);
                                  }}
                                  onHeadingChange={
                                    handleParticipantHeadingChange
                                  }
                                />
                              </div>
                            </details>

                            <button
                              type="button"
                              onClick={handleDeleteParticipant}
                              className="reconstruction-workspace__blender-properties-delete"
                            >
                              <X size={13} />
                              Delete participant
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {workspace2DPropertiesTab === "scene" && (
                      <>
                        <details
                          open
                          className="reconstruction-workspace__blender-properties-section"
                        >
                          <summary>2D View</summary>

                          <div className="reconstruction-workspace__blender-properties-rows">
                            <label>
                              <span>Basemap</span>
                              <select
                                value={basemapMode}
                                onChange={(event) =>
                                  setBasemapMode(
                                    event.target
                                      .value as ReconstructionBasemapMode,
                                  )
                                }
                              >
                                <option value="Diagram">
                                  Diagram
                                </option>
                                <option value="Street">
                                  Street
                                </option>
                                <option value="Satellite">
                                  Satellite
                                </option>
                              </select>
                            </label>

                            <div>
                              <span>Width</span>
                              <strong>
                                {
                                  reconstruction.scene
                                    .sceneWidthMetres
                                }{" "}
                                m
                              </strong>
                            </div>

                            <div>
                              <span>Height</span>
                              <strong>
                                {
                                  reconstruction.scene
                                    .sceneHeightMetres
                                }{" "}
                                m
                              </strong>
                            </div>

                            <div>
                              <span>Calibration</span>
                              <strong>
                                {reconstruction.fieldCalibration
                                  ? "Field calibrated"
                                  : "Local diagram"}
                              </strong>
                            </div>
                          </div>
                        </details>

                        <details
                          open
                          className="reconstruction-workspace__blender-properties-section"
                        >
                          <summary>Environment</summary>

                          <div className="reconstruction-workspace__blender-properties-rows">
                            <div>
                              <span>Weather</span>
                              <strong>
                                {reconstruction.scene.weather}
                              </strong>
                            </div>

                            <div>
                              <span>Surface</span>
                              <strong>
                                {
                                  reconstruction.scene
                                    .roadSurface
                                }
                              </strong>
                            </div>

                            <div>
                              <span>Visibility</span>
                              <strong>
                                {
                                  reconstruction.scene
                                    .visibility
                                }
                              </strong>
                            </div>

                            <div>
                              <span>Objects</span>
                              <strong>
                                {
                                  reconstruction.sceneObjects
                                    .length
                                }
                              </strong>
                            </div>

                            <div>
                              <span>Evidence</span>
                              <strong>
                                {
                                  reconstruction.evidenceRecords
                                    .length
                                }
                              </strong>
                            </div>

                            <div>
                              <span>Measurements</span>
                              <strong>
                                {
                                  reconstruction.measurements
                                    .length
                                }
                              </strong>
                            </div>
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              </aside>
            ),
            workspaceRightPanelHost,
          )}
{workspaceRightPanelHost &&
          workspaceSettingsOpen &&
          createPortal(
            <aside
              className="reconstruction-workspace__aux-inspector"
              aria-label="Workspace and investigation properties"
            >
              <header className="reconstruction-workspace__aux-inspector-header">
                <div>
                  <span>Properties</span>
                  <strong>Workspace, Evidence & Investigation</strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setWorkspaceSettingsOpen(false)
                  }
                  aria-label="Close workspace properties"
                  title="Close workspace properties"
                >
                  <X size={14} />
                </button>
              </header>

              <nav
                className="reconstruction-workspace__aux-horizontal-tabs"
                aria-label="Workspace and investigation sections"
              >
                {(
                  [
                    ["case", "Case", "Case Setup"],
                    ["scene", "Scene", "Scene Environment"],
                    ["objects", "Objects", "Objects"],
                    ["impact", "Impact", "Primary Impact"],
                    ["physics", "Physics", "Deterministic Simulation"],
                    ["audit", "Audit", "Non-Destructive Audit"],
                    ["hypotheses", "Hypotheses", "Alternative Hypotheses"],
                    ["evidence", "Evidence", "Evidence"],
                    ["notes", "Notes", "Photos"],
                  ] as const
                ).map(([tab, label, heading]) => (
                  <button
                    key={tab}
                    type="button"
                    className={
                      workspaceInvestigationTab === tab
                        ? "is-active"
                        : ""
                    }
                    aria-pressed={
                      workspaceInvestigationTab === tab
                    }
                    onClick={() =>
                      handleWorkspaceInvestigationTab(
                        tab,
                        heading,
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="reconstruction-workspace__aux-inspector-tools">
                <div
                  className="reconstruction-workspace__aux-basemap"
                  aria-label="2D basemap"
                >
                  {(
                    [
                      "Diagram",
                      "Street",
                      "Satellite",
                    ] as ReconstructionBasemapMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        basemapMode === mode
                          ? "is-active"
                          : ""
                      }
                      aria-pressed={
                        basemapMode === mode
                      }
                      onClick={() =>
                        setBasemapMode(mode)
                      }
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="reconstruction-workspace__aux-actions">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!historyAvailability.canUndo}
                  >
                    Undo
                  </button>

                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!historyAvailability.canRedo}
                  >
                    Redo
                  </button>

                  <button
                    type="button"
                    disabled={!selectedParticipantId}
                    onClick={() => {
                      setActiveReconstructionView("2D");

                      setRouteDrawingParticipantId(
                        (current) =>
                          current
                            ? null
                            : selectedParticipantId,
                      );
                    }}
                  >
                    {routeDrawingParticipantId
                      ? "Cancel Route"
                      : "Draw Route"}
                  </button>
                </div>

                <div className="reconstruction-workspace__aux-legend">
                  <span>Start</span>
                  <span>Brake</span>
                  <span>Turn / Swerve</span>
                  <span>Impact</span>
                </div>
              </div>

              <div className="reconstruction-workspace__aux-inspector-content">
<section
          className={`reconstruction-workspace__workspace-panels ${
            workspaceSettingsOpen ? "is-open" : ""
          }`}
          aria-label="Workspace panels"
        >
          <button
            type="button"
            className="reconstruction-workspace__workspace-panels-toggle"
            onClick={() => setWorkspaceSettingsOpen((current) => !current)}
            aria-expanded={workspaceSettingsOpen}
            aria-controls="reconstruction-workspace-panels-content"
          >
            <span className="reconstruction-workspace__workspace-panels-heading">
              <span className="reconstruction-workspace__workspace-panels-icon">
                <Layers3 size={17} />
              </span>
              <span>
                <strong>Workspace Panels</strong>
                <small>Case, scene and object controls</small>
              </span>
            </span>

            <span className="reconstruction-workspace__workspace-panels-summary">
              <span>{reconstruction.scene.sceneEnvironment}</span>
              <span>{reconstruction.sceneObjects.length} object(s)</span>
              <span>{reconstruction.durationSeconds.toFixed(0)}s scene</span>
              <ChevronUp
                size={17}
                className={workspaceSettingsOpen ? "" : "is-collapsed"}
              />
            </span>
          </button>

          {workspaceSettingsOpen && (
            <div
              id="reconstruction-workspace-panels-content"
              className="reconstruction-workspace__workspace-panels-content"
            >
              <section className="reconstruction-workspace__workspace-card reconstruction-workspace__workspace-card--case">
                <div className="reconstruction-workspace__workspace-card-header">
                  <span className="reconstruction-workspace__workspace-card-icon">
                    <ClipboardList size={15} />
                  </span>
                  <div>
                    <h3>Case Setup</h3>
                    <p>Core reconstruction identity and playback duration.</p>
                  </div>
                </div>

                <div className="reconstruction-workspace__workspace-form">
                  <label className="reconstruction-workspace__workspace-field reconstruction-workspace__workspace-field--wide">
                    <span>Reconstruction title</span>
                    <input
                      value={reconstruction.title}
                      onChange={(event) =>
                        setReconstruction((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="reconstruction-workspace__workspace-field">
                    <span>Accident ID</span>
                    <input
                      value={caseContext?.caseNumber ?? reconstruction.accidentId}
                      disabled={Boolean(caseContext)}
                      onChange={(event) =>
                        setReconstruction((current) => ({
                          ...current,
                          accidentId: event.target.value,
                        }))
                      }
                    />
                    {caseContext && (
                      <small>Locked to the current accident case.</small>
                    )}
                  </label>

                  <label className="reconstruction-workspace__workspace-field">
                    <span>Junction ID</span>
                    <input
                      value={reconstruction.junctionId}
                      onChange={(event) =>
                        setReconstruction((current) => ({
                          ...current,
                          junctionId: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="reconstruction-workspace__workspace-field reconstruction-workspace__workspace-field--wide">
                    <span>Description</span>
                    <textarea
                      value={reconstruction.description}
                      onChange={(event) =>
                        setReconstruction((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                    />
                  </label>

                  <label className="reconstruction-workspace__workspace-field reconstruction-workspace__workspace-field--wide reconstruction-workspace__workspace-field--range">
                    <span>
                      <span>Reconstruction duration</span>
                      <strong>{reconstruction.durationSeconds}s</strong>
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
                    />
                  </label>
                </div>
              </section>

              <section className="reconstruction-workspace__workspace-card reconstruction-workspace__workspace-card--scene">
                <div className="reconstruction-workspace__workspace-card-header">
                  <span className="reconstruction-workspace__workspace-card-icon">
                    <Ruler size={15} />
                  </span>
                  <div>
                    <h3>Scene Environment</h3>
                    <p>Road geometry, ground, visibility and site conditions.</p>
                  </div>
                </div>

                <div className="reconstruction-workspace__workspace-card-scroll reconstruction-workspace__embedded-panel">
                  <SceneSettingsPanel
                    settings={reconstruction.scene}
                    onChange={updateSceneSettings}
                  />
                </div>
              </section>

              <section
                ref={sceneObjectPaletteRef}
                className="reconstruction-workspace__workspace-card reconstruction-workspace__workspace-card--objects"
              >
                <div className="reconstruction-workspace__workspace-card-header">
                  <span className="reconstruction-workspace__workspace-card-icon">
                    <Layers3 size={15} />
                  </span>
                  <div>
                    <h3>Objects, Hazards & Evidence</h3>
                    <p>Place props manually or capture their real GPS positions.</p>
                  </div>
                </div>

                <div className="reconstruction-workspace__workspace-card-scroll reconstruction-workspace__embedded-panel">
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
                </div>
              </section>
            </div>
          )}
        </section>

        <div className="reconstruction-workspace__modules">
          <details className="premium-investigation-card premium-investigation-card--impact" open>
            <summary className="premium-investigation-card__header">
              <span className="premium-investigation-card__number">1</span>
              <span>Primary Impact Setup</span>
              <ChevronUp size={15} />
            </summary>
            <div className="premium-investigation-card__body premium-impact-card">
              <div className="premium-impact-card__form">
                <h3>Collision Point</h3>
                <div className="premium-impact-card__coordinates">
                  <label>
                    <span>X (m)</span>
                    <input
                      type="number"
                      step={0.01}
                      value={Number(collisionPointMetres.x.toFixed(2))}
                      disabled={compactCollisionSetup.locked}
                      onChange={(event) =>
                        updateCollisionCoordinateMetres("x", Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    <span>Y (m)</span>
                    <input
                      type="number"
                      step={0.01}
                      value={Number(collisionPointMetres.y.toFixed(2))}
                      disabled={compactCollisionSetup.locked}
                      onChange={(event) =>
                        updateCollisionCoordinateMetres("y", Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    <span>Z (m)</span>
                    <input type="number" value={0} readOnly />
                  </label>
                </div>
                <div className="premium-impact-card__selectors">
                  <label>
                    <span>Method</span>
                    <select
                      value={compactCollisionSetup.source}
                      disabled={compactCollisionSetup.locked}
                      onChange={(event) =>
                        handleReconstructionChange({
                          collisionSetup: {
                            ...compactCollisionSetup,
                            source: event.target.value as "Manual" | "Derived",
                          },
                        })
                      }
                    >
                      <option value="Manual">Manual</option>
                      <option value="Derived">Derived</option>
                    </select>
                  </label>
                  <label>
                    <span>Confidence</span>
                    <select
                      value={compactCollisionSetup.confidence ?? "Medium"}
                      onChange={(event) =>
                        handleReconstructionChange({
                          collisionSetup: {
                            ...compactCollisionSetup,
                            confidence: event.target.value as "High" | "Medium" | "Low",
                          },
                        })
                      }
                    >
                      <option value="High">● High</option>
                      <option value="Medium">● Medium</option>
                      <option value="Low">● Low</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="premium-impact-card__preview-column">
                <button
                  type="button"
                  className="premium-impact-card__preview"
                  onClick={() => {
                    if (compactCollisionSetup.locked) return;
                    setActiveReconstructionView("2D");
                    setIsPlaying(false);
                    setCollisionPlacementActive(true);
                    setMeasurementToolActive(false);
                    setMeasurementDraftStart(null);
                    setActiveEvidencePlacementId(null);
                    setActiveSceneObjectType(null);
                    setTraceToolObjectId(null);
                  }}
                  title="Place the collision point on the map"
                >
                  <span className="premium-impact-card__preview-road premium-impact-card__preview-road--horizontal" />
                  <span className="premium-impact-card__preview-road premium-impact-card__preview-road--vertical" />
                  <span
                    className="premium-impact-card__preview-target"
                    style={{
                      left: `${reconstruction.collisionPoint.x}%`,
                      top: `${reconstruction.collisionPoint.y}%`,
                    }}
                  >
                    <Crosshair size={19} />
                  </span>
                </button>
                <button
                  type="button"
                  className="premium-investigation-card__action"
                  onClick={handleRecalculateCollisionPoint}
                >
                  Recalculate
                </button>
              </div>
            </div>
          </details>

          <details className="premium-investigation-card premium-investigation-card--physics" open>
            <summary className="premium-investigation-card__header">
              <span className="premium-investigation-card__number">2</span>
              <span>Premium Deterministic Simulation</span>
              <ChevronUp size={15} />
            </summary>
            <div className="premium-investigation-card__body premium-physics-card">
              <div className="premium-physics-card__metrics">
                <div><span>Engine</span><strong>RoadSafe Physics V2</strong></div>
                <div><span>Status</span><strong className="is-ready">{compactPhysicsSettings.enabled && reconstruction.vehicles.length > 0 ? "Ready" : "Needs setup"}</strong></div>
                <div><span>Time Step</span><strong>{compactPhysicsSettings.timeStepSeconds.toFixed(2)} s</strong></div>
                <div><span>Gravity</span><strong>9.81 m/s²</strong></div>
                <div><span>Friction Model</span><strong>Advanced</strong></div>
              </div>
              <ReconstructionPhysicsContextEditor
                reconstruction={reconstruction}
                onChange={handleReconstructionChange}
              />

              <button
                type="button"
                className="premium-investigation-card__action"
                onClick={handleRunPhysics}
                disabled={!compactPhysicsSettings.enabled || reconstruction.vehicles.length === 0}
              >
                Run Deterministic Simulation
              </button>
            </div>
          </details>

          <details className="premium-investigation-card premium-investigation-card--audit" open>
            <summary className="premium-investigation-card__header">
              <span className="premium-investigation-card__number">3</span>
              <span>Phase 2 · Non-Destructive Audit</span>
              <ChevronUp size={15} />
            </summary>
            <div className="premium-investigation-card__body premium-audit-card">
              <div className="premium-audit-card__metrics">
                <article className="premium-audit-metric">
                  <span>Momentum Balance</span>
                  <strong>{compactAudit.momentumBalance.toFixed(2)}%</strong>
                  <small>Excellent</small>
                  <CompactAuditSparkline values={[10, 19, 13, 12, 18, 17, 20, 17, 22]} colour="#55c76a" />
                </article>
                <article className="premium-audit-metric">
                  <span>Energy Balance</span>
                  <strong>{compactAudit.energyBalance.toFixed(2)}%</strong>
                  <small>Very Good</small>
                  <CompactAuditSparkline values={[8, 15, 9, 16, 10, 18, 13, 25, 12]} colour="#4da3ff" />
                </article>
                <article className="premium-audit-metric">
                  <span>Data Integrity</span>
                  <strong>{compactAudit.dataIntegrity.toFixed(0)}%</strong>
                  <small>Perfect</small>
                  <CompactAuditSparkline values={[11, 17, 8, 20, 9, 24, 12, 27, 15]} colour="#b85de4" />
                </article>
              </div>
              <button
                type="button"
                className="premium-investigation-card__action"
                onClick={() => setActiveInvestigationDetail("audit")}
              >
                View Full Audit Report
              </button>
            </div>
          </details>

          <details className="premium-investigation-card premium-investigation-card--hypotheses" open>
            <summary className="premium-investigation-card__header">
              <span className="premium-investigation-card__number">4</span>
              <span>Alternative Hypotheses</span>
              <ChevronUp size={15} />
            </summary>
            <div className="premium-investigation-card__body premium-hypotheses-card">
              <div className="premium-hypotheses-card__rows">
                {compactHypothesisRows.map((row) => (
                  <div key={row.id} className="premium-hypotheses-card__row">
                    <span>{row.name}</span>
                    <span className="premium-hypotheses-card__status">
                      {row.primary ? <em>Primary</em> : <small>Confidence</small>}
                      <strong className={row.confidence >= 70 ? "is-high" : row.confidence >= 35 ? "is-medium" : "is-low"}>{row.confidence}%</strong>
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="premium-investigation-card__action"
                onClick={() => setActiveInvestigationDetail("hypotheses")}
              >
                Manage Hypotheses
              </button>
            </div>
          </details>

          <details className="premium-investigation-card premium-investigation-card--documentation" open>
            <summary className="premium-investigation-card__header">
              <span className="premium-investigation-card__number">5</span>
              <span>Investigation Documentation · Evidence & Measurements</span>
              <ChevronUp size={15} />
            </summary>
            <div className="premium-investigation-card__body premium-documentation-card">
              <div className="premium-documentation-card__rows">
                <div><FileSearch size={14} /><span>Evidence register</span><strong>{reconstruction.evidenceRecords.length} items</strong></div>
                <div><Ruler size={14} /><span>Scene measurements</span><strong>{reconstruction.measurements.length} items</strong></div>
                <div><ClipboardList size={14} /><span>Timeline links</span><strong>{reconstruction.timelineEvents.length} events</strong></div>
              </div>
              <button
                type="button"
                className="premium-investigation-card__action"
                onClick={() => setActiveInvestigationDetail("documentation-evidence")}
              >
                Open Evidence Workspace
              </button>
            </div>
          </details>

          <details className="premium-investigation-card premium-investigation-card--documentation" open>
            <summary className="premium-investigation-card__header">
              <span className="premium-investigation-card__number">6</span>
              <span>Investigation Documentation · Photos & Officer Notes</span>
              <ChevronUp size={15} />
            </summary>
            <div className="premium-investigation-card__body premium-documentation-card">
              <div className="premium-documentation-card__rows">
                <div><ImageIcon size={14} /><span>Scene photos</span><strong>{reconstruction.photos.length} files</strong></div>
                <div><ClipboardList size={14} /><span>Officer notes</span><strong>{compactCollisionSetup.notes.trim() ? "Recorded" : "Not recorded"}</strong></div>
                <div><BookOpen size={14} /><span>Investigation README</span><strong>Attached</strong></div>
              </div>
              <button
                type="button"
                className="premium-investigation-card__action"
                onClick={() => setActiveInvestigationDetail("documentation-photos")}
              >
                Open Documentation
              </button>
            </div>
          </details>
        </div>


              </div>
            </aside>,
            workspaceRightPanelHost,
          )}

        {activeInvestigationDetail && (
          <div
            className="reconstruction-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Reconstruction investigation details"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setActiveInvestigationDetail(null);
            }}
          >
            <div className="reconstruction-detail-modal__panel">
              <header className="reconstruction-detail-modal__header">
                <div>
                  <p>RoadSafe investigation workspace</p>
                  <h2>
                    {activeInvestigationDetail === "audit"
                      ? "Full Non-Destructive Audit"
                      : activeInvestigationDetail === "hypotheses"
                        ? "Alternative Hypotheses"
                        : activeInvestigationDetail === "documentation-evidence"
                          ? "Evidence & Measurements"
                          : "Scene Photos, Officer Notes & Guide"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInvestigationDetail(null)}
                  aria-label="Close investigation details"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="reconstruction-detail-modal__body">
                {activeInvestigationDetail === "audit" && (
                  <ReconstructionValidationPanel reconstruction={reconstruction} />
                )}

                {activeInvestigationDetail === "hypotheses" && (
                  <ReconstructionScenarioWorkspace
                    reconstruction={reconstruction}
                    onLoadScenario={handleLoadScenario}
                  />
                )}

                {activeInvestigationDetail === "documentation-evidence" && (
                  renderEvidenceWorkspace("evidence")
                )}

                {activeInvestigationDetail === "documentation-photos" && (
                  <>
                    <section className="attached-officer-notes">
                      <div className="attached-officer-notes__header">
                        <div>
                          <p>Officer notes</p>
                          <span>Attached to the primary collision setup and saved with the reconstruction.</span>
                        </div>
                        <div className="attached-officer-notes__toggles">
                          <label>
                            <span>Confirmed</span>
                            <input
                              type="checkbox"
                              checked={compactCollisionSetup.confirmed}
                              onChange={(event) =>
                                handleReconstructionChange({
                                  collisionSetup: {
                                    ...compactCollisionSetup,
                                    confirmed: event.target.checked,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>Locked</span>
                            <input
                              type="checkbox"
                              checked={compactCollisionSetup.locked}
                              onChange={(event) =>
                                handleReconstructionChange({
                                  collisionSetup: {
                                    ...compactCollisionSetup,
                                    locked: event.target.checked,
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={compactCollisionSetup.notes}
                        onChange={(event) =>
                          handleReconstructionChange({
                            collisionSetup: {
                              ...compactCollisionSetup,
                              notes: event.target.value,
                            },
                          })
                        }
                        placeholder="How the collision point was established: debris centre, vehicle damage, witness statement, CCTV, GPS or scene measurements."
                      />
                    </section>
                    {renderEvidenceWorkspace("photos")}
                    <div className="attached-reconstruction-guide">
                      <ReconstructionGuide />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}


        {fieldPlacementOpen && (
          <FieldPlacementPanel
            open
            reconstruction={reconstruction}
            officerName={caseContext?.recordedBy ?? ""}
            currentTimeSeconds={currentTime}
            initialTarget={fieldPlacementInitialTarget}
            initialCaptureMode={fieldPlacementInitialMode}
            onClose={handleCloseFieldPlacement}
            onPlacementConfirmed={handleFieldPlacementConfirmed}
            onUpdate={handleFieldPlacementUpdate}
          />
        )}
      </div>
      <ReconstructionBottomDock
        reconstruction={reconstruction}
        currentTime={currentTime}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        activeView={activeReconstructionView}
        selectedParticipantId={selectedParticipantId}
        selectedSceneObjectId={selectedSceneObjectId}
        onSelectParticipant={(participantId) =>
          handleSelectParticipant(participantId)
        }
        onReset={handleReset}
        onPlayPause={handlePlayPause}
        onStepBackward={() => {
          setIsPlaying(false);

          setCurrentTime(
            (time) =>
              Math.max(
                0,
                time - 0.1,
              ),
          );
        }}
        onStepForward={() => {
          setIsPlaying(false);

          setCurrentTime(
            (time) =>
              Math.min(
                reconstruction.durationSeconds,
                time + 0.1,
              ),
          );
        }}
        onSeek={(time) => {
          setIsPlaying(false);
          setCurrentTime(time);
        }}
        onPlaybackSpeedChange={
          setPlaybackSpeed
        }
        onEventsChange={(timelineEvents) =>
          setReconstruction(
            (current) => ({
              ...current,
              timelineEvents,
            }),
          )
        }
        onSelectParticipantPathPoint={(
          participantId,
          pointId,
        ) =>
          handleSelectParticipant(
            participantId,
            pointId,
          )
        }
        onSelectSceneObject={
          handleSelectSceneObject
        }
        onReconstructionChange={
          handleReconstructionChange
        }
        onRunPhysics={() => {
          handleRunPhysics();
        }}
        onSwitchView={(view) => {
          setIsPlaying(false);
          setActiveReconstructionView(view);
        }}
        onOpenNodeTarget={(target) => {
          setIsPlaying(false);
          setWorkspaceSettingsOpen(true);

          const targetMap = {
            case: [
              "case",
              "Case Setup",
            ],
            scene: [
              "scene",
              "Scene Environment",
            ],
            objects: [
              "objects",
              "Objects",
            ],
            evidence: [
              "evidence",
              "Evidence",
            ],
            collision: [
              "impact",
              "Primary Impact",
            ],
            physics: [
              "physics",
              "Deterministic Simulation",
            ],
          } as const;

          const [
            tab,
            heading,
          ] =
            targetMap[
              target
            ];

          window.requestAnimationFrame(
            () =>
              handleWorkspaceInvestigationTab(
                tab,
                heading,
              ),
          );
        }}
      />

    </div>
  );
}
