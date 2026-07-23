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
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  ScanLine,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";

import { ReconstructionService } from "../../services/reconstructionService";
import { FieldPlacementService } from "../../services/fieldPlacementService";
import {
  DEFAULT_PHYSICS_SETTINGS,
  applyPhysicsSimulation,
  derivePrimaryCollisionPoint,
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

import "./reconstructionPlaybackFixes.css";

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
const THREE_D_REACT_PAINT_INTERVAL_MS = 80;

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
  const glow = selected ? "drop-shadow-[0_0_8px_rgba(96,165,250,0.95)]" : "drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)]";
  const label = (
    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-[#23395d] bg-[#050914]/90 px-1.5 py-0.5 text-[7px] font-semibold text-slate-200 shadow-lg">
      {participant.name}
    </span>
  );

  if (isHumanParticipant(participant.type)) {
    return (
      <div className={`relative h-12 w-8 ${glow}`}>
        <svg viewBox="0 0 32 48" className="h-full w-full overflow-visible" aria-hidden="true">
          <ellipse cx="16" cy="8" rx="6.5" ry="7" fill="#b97850" stroke="#e2e8f0" strokeWidth="1.4" />
          <path d="M10 16 C10 13 22 13 22 16 L24 30 C22 34 10 34 8 30 Z" fill={colour} stroke="#e2e8f0" strokeWidth="1.2" />
          <path d="M9 19 L3.8 31 M23 19 L28.2 31" stroke="#b97850" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M12.5 32 L10 45 M19.5 32 L22 45" stroke="#273244" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M7.6 45 H12.2 M19.8 45 H24.4" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          {participant.type === "Officer" && <path d="M9 18 L23 18" stroke="#cbd5e1" strokeWidth="2.2" />}
          {participant.type === "Officer" && <path d="M10 5 Q16 0 22 5 L22 8 H10 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />}
          {participant.type === "Witness" && <rect x="22" y="20" width="4" height="7" rx="1" fill="#dbeafe" stroke="#64748b" />}
        </svg>
        {participant.injured && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-[#fda4af] bg-[#7f1d2d] text-[8px] font-black text-white">!</span>}
        {label}
      </div>
    );
  }

  if (participant.type === "Bicycle" || participant.type === "Motorcycle") {
    const motorcycle = participant.type === "Motorcycle";
    return (
      <div className={`relative ${motorcycle ? "h-8 w-14" : "h-8 w-12"} ${glow}`}>
        <svg viewBox="0 0 56 32" className="h-full w-full overflow-visible" aria-hidden="true">
          <ellipse cx="10" cy="23" rx="8" ry="6.5" fill="#070b12" stroke="#d9e2ec" strokeWidth="2.2" />
          <ellipse cx="46" cy="23" rx="8" ry="6.5" fill="#070b12" stroke="#d9e2ec" strokeWidth="2.2" />
          <circle cx="10" cy="23" r="2" fill="#94a3b8" />
          <circle cx="46" cy="23" r="2" fill="#94a3b8" />
          {motorcycle ? (
            <>
              <path d="M12 21 L22 11 L38 12 L45 21 L29 22 Z" fill={colour} stroke="#f1f5f9" strokeWidth="1.2" />
              <ellipse cx="29" cy="12" rx="8" ry="5" fill={colour} stroke="#dbeafe" strokeWidth="1" />
              <path d="M34 9 L42 5 L47 7" stroke="#aab7c8" strokeWidth="2" strokeLinecap="round" />
              <rect x="19" y="7" width="10" height="4" rx="2" fill="#202a37" />
              <path d="M22 22 L18 28" stroke="#aab7c8" strokeWidth="2" />
              <circle cx="47" cy="8" r="2.5" fill="#fff7cf" stroke="#cbd5e1" />
            </>
          ) : (
            <>
              <path d="M10 23 L22 10 L30 23 Z M22 10 L39 10 L30 23 M39 10 L46 23" fill="none" stroke={colour} strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M18 8 H27 M38 7 L44 5" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
              <circle cx="30" cy="23" r="2.3" fill="#94a3b8" />
            </>
          )}
          <circle cx="27" cy="5.8" r="4.2" fill="#b97850" stroke="#e2e8f0" strokeWidth="1" />
          <path d="M24 10 L21 17 L31 19 L36 11" fill="#273244" stroke="#dbe4ee" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        {label}
      </div>
    );
  }

  const dimensions = getVehicleDimensions(participant.type);
  const width = Math.max(dimensions.width, participant.type === "Car" ? 50 : dimensions.width);
  const height = Math.max(dimensions.height, 25);
  const bodyStroke = participant.colour === "White" ? "#64748b" : "#dbe4ee";

  return (
    <div className={`relative ${glow}`} style={{ width, height }}>
      <svg viewBox="0 0 100 52" className="h-full w-full overflow-visible" aria-hidden="true">
        <rect x="7" y="4" width="86" height="44" rx={participant.type === "Bus" ? 8 : 14} fill={colour} stroke={bodyStroke} strokeWidth="2" />
        <rect x="2" y="9" width="8" height="11" rx="2" fill="#111827" />
        <rect x="2" y="32" width="8" height="11" rx="2" fill="#111827" />
        <rect x="90" y="9" width="8" height="11" rx="2" fill="#111827" />
        <rect x="90" y="32" width="8" height="11" rx="2" fill="#111827" />
        {participant.type === "Truck" ? (
          <>
            <rect x="12" y="8" width="51" height="36" rx="5" fill="#66717f" stroke="#cbd5e1" />
            <rect x="65" y="8" width="23" height="36" rx="7" fill={colour} stroke={bodyStroke} />
            <path d="M70 11 H85 V41 H70 Z" fill="#7ea1b8" opacity=".85" />
            <path d="M18 13 H57 M18 20 H57 M18 27 H57 M18 34 H57" stroke="#8793a0" strokeWidth="1" />
          </>
        ) : participant.type === "Bus" ? (
          <>
            <path d="M17 9 H83 Q88 9 88 14 V38 Q88 43 83 43 H17 Q12 43 12 38 V14 Q12 9 17 9 Z" fill={colour} stroke={bodyStroke} />
            {[19,31,43,55,67].map((x) => <rect key={x} x={x} y="11" width="9" height="30" rx="2" fill="#7295ad" opacity=".84" />)}
            <rect x="78" y="11" width="8" height="30" rx="2" fill="#8bb2ca" />
          </>
        ) : (
          <>
            <path d="M22 8 Q30 4 50 4 Q70 4 78 8 L88 18 V34 L78 44 Q69 48 50 48 Q31 48 22 44 L12 34 V18 Z" fill={colour} stroke={bodyStroke} strokeWidth="1.4" />
            <path d="M31 9 Q50 4 69 9 L75 17 H25 Z" fill="#7da0b8" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M25 35 H75 L69 44 Q50 49 31 44 Z" fill="#66899f" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M23 26 H77" stroke="#dbe4ee" strokeWidth="1" opacity=".7" />
            <rect x="9" y="21" width="5" height="10" rx="2" fill="#263442" stroke="#94a3b8" />
            <rect x="86" y="21" width="5" height="10" rx="2" fill="#263442" stroke="#94a3b8" />
          </>
        )}
        <rect x="86" y="12" width="4" height="8" rx="1" fill="#fff2b3" />
        <rect x="86" y="32" width="4" height="8" rx="1" fill="#fff2b3" />
        <rect x="9" y="12" width="4" height="8" rx="1" fill="#9f2431" />
        <rect x="9" y="32" width="4" height="8" rx="1" fill="#9f2431" />
      </svg>
      {label}
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
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);
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
  const [activeWorkspaceTool, setActiveWorkspaceTool] =
    useState<WorkspaceTool>("Select");
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspacePropertiesOpen, setWorkspacePropertiesOpen] = useState(true);
  const [cameraCycleToken, setCameraCycleToken] = useState(0);
  const [workspaceCameraMode, setWorkspaceCameraMode] =
    useState<WorkspaceCameraMode>("Orbit");
  const [workspaceLayers, setWorkspaceLayers] = useState<WorkspaceLayerState>({
    paths: true,
    objects: true,
    evidence: true,
    physics: true,
  });
  const [activeInvestigationDetail, setActiveInvestigationDetail] =
    useState<InvestigationDetailView>(null);
  const [sceneView, setSceneView] = useState({ zoom: 0.92, panX: 0, panY: 0 });
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

  const zoomSceneAtClientPoint = useCallback(
    (clientX: number, clientY: number, zoomDelta: number) => {
      const rectangle = sceneViewportRef.current?.getBoundingClientRect();
      if (!rectangle) return;

      setSceneView((view) => {
        const nextZoom = clamp(view.zoom + zoomDelta, 0.4, 3);
        if (nextZoom === view.zoom) return view;

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
      const next = caseNumber
        ? {
            ...created,
            accidentId: caseNumber,
          }
        : created;

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
        ? getParticipantStateAtTime(selectedParticipant, currentTime)
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
        gesture.startZoom + (gesture.startClientY - event.clientY) / 220,
        0.4,
        3,
      );
      setSceneView((view) => ({ ...view, zoom: nextZoom }));
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
      if (!sceneRef.current || (event.button !== 0 && event.button !== 1)) return;

      const target = event.target as HTMLElement;
      const isInteractive = Boolean(
        target.closest('[data-scene-interactive="true"]'),
      );

      if (
        !isInteractive &&
        (event.button === 1 || activeWorkspaceTool === "Move")
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

      if (!isInteractive && activeWorkspaceTool === "Rotate") {
        if (!selectedParticipant || !selectedParticipantState) {
          showSaveMessage(
            "Select a participant before using Rotate.",
            "info",
            2600,
          );
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        sceneGestureRef.current = {
          kind: "rotate",
          pointerId: event.pointerId,
          startClientX: event.clientX,
          participantId: selectedParticipant.id,
          pointId: selectedParticipantState.activePointId,
          startRotation: selectedParticipantState.rotation,
        };
        return;
      }

      if (!isInteractive && activeWorkspaceTool === "Scale") {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        sceneGestureRef.current = {
          kind: "scale",
          pointerId: event.pointerId,
          startClientY: event.clientY,
          startZoom: sceneView.zoom,
        };
        return;
      }

      if (event.button !== 0) return;

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
      activeWorkspaceTool,
      clientToScenePosition,
      collisionPlacementActive,
      measurementDraftStart,
      measurementToolActive,
      reconstruction.measurements.length,
      reconstruction.scene,
      reconstruction.sceneObjects.length,
      routeDrawingParticipantId,
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
        const nextPercent = clamp((metres / Math.max(0.1, sceneSize)) * 100, 0, 100);
        return {
          ...current,
          collisionPoint: {
            ...current.collisionPoint,
            [axis]: nextPercent,
          },
          collisionSetup: {
            confirmed: false,
            locked: false,
            toleranceMetres: 2,
            notes: "",
            confidence: "Medium",
            ...(current.collisionSetup ?? {}),
            source: "Manual",
            lastCalculatedAt: new Date().toISOString(),
          },
        };
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
      ...current,
      collisionPoint: derived,
      collisionSetup: {
        confirmed: false,
        locked: false,
        toleranceMetres: 2,
        notes: "",
        ...(current.collisionSetup ?? {}),
        source: "Derived",
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
      "Physics paths generated. Both 2D and 3D now use this shared collision timeline.",
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

      // This ref is the authoritative clock shared by 2D and 3D.
      currentTimeRef.current = nextTime;

      // 2D needs a React paint every animation frame. The Three.js view reads the
      // shared ref directly, so its surrounding React UI can update less often.
      const reactPaintInterval =
        activeReconstructionView === "2D"
          ? 0
          : THREE_D_REACT_PAINT_INTERVAL_MS;

      if (
        reactPaintInterval === 0 ||
        lastPlaybackPaintRef.current === null ||
        timestamp - lastPlaybackPaintRef.current >= reactPaintInterval ||
        nextTime >= reconstruction.durationSeconds
      ) {
        lastPlaybackPaintRef.current = timestamp;
        setCurrentTime(nextTime);
      }

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
  }, [
    activeReconstructionView,
    isPlaying,
    playbackSpeed,
    reconstruction.durationSeconds,
  ]);

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
      : activeWorkspaceTool === "Move"
        ? "reconstruction-workspace__2d-viewport--pan"
        : activeWorkspaceTool === "Rotate"
          ? "reconstruction-workspace__2d-viewport--rotate"
          : activeWorkspaceTool === "Scale"
            ? "reconstruction-workspace__2d-viewport--scale"
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
      document
        .getElementById("reconstruction-timeline-workspace")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  }> = [
    { label: "Select", icon: Crosshair },
    { label: "Move", icon: Move },
    { label: "Rotate", icon: RotateCw },
    { label: "Scale", icon: Expand },
    { label: "Timeline", icon: ScanLine },
    { label: "Measure", icon: Ruler },
    { label: "Camera", icon: Camera },
  ];

  const workspaceToolGuidance: Record<
    WorkspaceTool,
    { title: string; twoD: string; threeD: string }
  > = {
    Select: {
      title: "Select and inspect",
      twoD: "Click a participant, route point, object, evidence marker or measurement.",
      threeD: "Click a participant to select it; drag the scene normally to orbit.",
    },
    Move: {
      title: "Move / pan",
      twoD: "Drag empty map space to pan. Drag editable route points and scene handles to reposition them.",
      threeD: "Drag the 3D scene to pan the camera target.",
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
      twoD: "Jumps to the synchronized event timeline below the map.",
      threeD: "Jumps to the synchronized event timeline below the 3D scene.",
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

  const activeToolGuidance = workspaceToolGuidance[activeWorkspaceTool];

  const renderWorkspaceTools = () => (
    <nav
      className="reconstruction-workspace__tools"
      aria-label="Reconstruction tools"
      data-scene-interactive="true"
    >
      {workspaceTools.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          onClick={() => handleWorkspaceTool(label)}
          className={activeWorkspaceTool === label ? "is-active" : ""}
          aria-pressed={activeWorkspaceTool === label}
          title={`${workspaceToolGuidance[label].title}: ${
            activeReconstructionView === "2D"
              ? workspaceToolGuidance[label].twoD
              : workspaceToolGuidance[label].threeD
          }`}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  const renderWorkspaceToolHint = () => (
    <div
      className="reconstruction-workspace__tool-hint"
      data-scene-interactive="true"
      role="status"
    >
      <strong>{activeToolGuidance.title}</strong>
      <span>
        {activeReconstructionView === "2D"
          ? activeToolGuidance.twoD
          : activeToolGuidance.threeD}
      </span>
    </div>
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
    <div className="reconstruction-editor reconstruction-workspace">
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
            onClick={() => {
              setActiveReconstructionView("2D");
              setWorkspaceSettingsOpen((value) => !value);
            }}
            className="reconstruction-workspace__button"
          >
            Panels
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
              {renderWorkspaceToolHint()}
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
                  cameraCycleToken={cameraCycleToken}
                  workspaceTimeSeconds={currentTime}
                  workspaceTimeSourceRef={currentTimeRef}
                  workspacePlaying={isPlaying}
                  workspacePlaybackSpeed={playbackSpeed}
                  workspaceCameraMode={workspaceCameraMode}
                  workspaceLayers={workspaceLayers}
                  workspaceTool={activeWorkspaceTool}
                />
              </Suspense>
            </div>

            {workspacePropertiesOpen ? (
              <aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel">
                <div className="reconstruction-workspace__panel-header">
                  <div>
                    <p>3D Context Inspector</p>
                    <span>
                      {selectedParticipant
                        ? selectedParticipant.name
                        : "Scene and simulation controls"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkspacePropertiesOpen(false)}
                    aria-label="Close context inspector"
                  >
                    ×
                  </button>
                </div>

                <div className="reconstruction-workspace__context-scroll">
                {selectedParticipant && selectedParticipantState ? (
                  <div className="reconstruction-workspace__property-list">
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
                    <div>
                      <span>Speed</span>
                      <strong>{selectedParticipantState.speedKmh.toFixed(1)} km/h</strong>
                    </div>
                    <div>
                      <span>Mass</span>
                      <strong>{selectedParticipant.physics?.massKg ?? "—"} kg</strong>
                    </div>
                    <div>
                      <span>Position</span>
                      <strong>
                        X {selectedParticipantState.position.x.toFixed(2)} · Y {selectedParticipantState.position.y.toFixed(2)}
                      </strong>
                    </div>
                    <label>
                      <span>Heading</span>
                      <input
                        type="number"
                        value={Math.round(selectedParticipantState.rotation)}
                        onChange={(event) =>
                          updatePathPoint(
                            selectedParticipant.id,
                            selectedParticipantState.activePointId,
                            { rotation: Number(event.target.value) },
                          )
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="reconstruction-workspace__empty-properties">
                    Select a participant in the 3D scene to inspect its motion,
                    mass, heading and collision response.
                  </div>
                )}

                <div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Camera size={13} />
                    Camera
                  </div>
                  <div className="reconstruction-workspace__segmented-grid">
                    {(["Orbit", "Overhead", "Roadside", "Driver"] as WorkspaceCameraMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWorkspaceCameraMode(mode)}
                        className={workspaceCameraMode === mode ? "is-active" : ""}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Layers3 size={13} />
                    Layers and overlays
                  </div>
                  <div className="reconstruction-workspace__layer-list">
                    {(
                      [
                        ["paths", "Participant paths"],
                        ["objects", "Scene objects"],
                        ["evidence", "Evidence and measurements"],
                        ["physics", "Physics effects"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        <span>{label}</span>
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
                      </label>
                    ))}
                  </div>
                </div>

                <div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Activity size={13} />
                    Physics telemetry
                  </div>
                  <div className="reconstruction-workspace__telemetry-grid">
                    <div>
                      <span>Impact speed</span>
                      <strong>{selectedPhysicsEvent?.relativeSpeedKmh.toFixed(1) ?? "—"} km/h</strong>
                    </div>
                    <div>
                      <span>Normal impulse</span>
                      <strong>{selectedPhysicsEvent ? `${selectedPhysicsEvent.normalImpulseNs.toFixed(0)} N·s` : "—"}</strong>
                    </div>
                    <div>
                      <span>Energy</span>
                      <strong>{selectedPhysicsEvent ? `${selectedPhysicsEvent.estimatedEnergyKj.toFixed(1)} kJ` : "—"}</strong>
                    </div>
                    <div>
                      <span>Collisions</span>
                      <strong>{reconstruction.lastPhysicsSimulation?.participantCollisions ?? 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">Scene environment</div>
                  <div className="reconstruction-workspace__property-list reconstruction-workspace__property-list--compact">
                    <div><span>Weather</span><strong>{reconstruction.scene.weather}</strong></div>
                    <div><span>Surface</span><strong>{reconstruction.scene.roadSurface}</strong></div>
                    <div><span>Visibility</span><strong>{reconstruction.scene.visibility}</strong></div>
                    <div><span>Terrain</span><strong>{reconstruction.scene.useRealTerrain ? `${reconstruction.scene.terrainAreaMetres}m DEM` : "Flat"}</strong></div>
                  </div>
                </div>
                </div>
              </aside>
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

        <div className={`${activeReconstructionView === "3D" ? "hidden" : "grid"} reconstruction-workspace__2d-grid`}>
          <aside className={`ui-panel reconstruction-workspace__settings ${workspaceSettingsOpen ? "is-open" : ""}`}>
            <div className="reconstruction-workspace__panel-header">
              <div>
                <p>Workspace panels</p>
                <span>Case and scene controls</span>
              </div>
              <button
                type="button"
                onClick={() => setWorkspaceSettingsOpen(false)}
                aria-label="Close workspace panels"
              >
                ×
              </button>
            </div>

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

          </aside>

          <main
            className={`ui-panel reconstruction-workspace__canvas min-w-0 overflow-hidden ${
              sceneExpanded
                ? "fixed inset-2 z-[100] flex flex-col shadow-2xl sm:inset-4"
                : ""
            }`}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#182743] bg-[#080e1c] px-4 py-3">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-200">
                  Reconstruction Scene
                </h2>
                <p className="mt-1 text-[9px] text-slate-600">
                  Full calibrated area: {reconstruction.scene.sceneWidthMetres}m × {reconstruction.scene.sceneHeightMetres}m. Drag movement points or expand for detailed placement.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
                <div className="flex rounded-md border border-[#1d2c4b] bg-[#070c18] p-1">
                  {(["Diagram", "Street", "Satellite"] as ReconstructionBasemapMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBasemapMode(mode)}
                      className={`rounded px-2.5 py-1.5 text-[9px] font-bold ${basemapMode === mode ? "bg-[#173c78] text-white" : "text-slate-500 hover:bg-[#10182d] hover:text-slate-200"}`}
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
                  className="ui-button-primary ml-1 py-1.5"
                  aria-pressed={sceneExpanded}
                  title={sceneExpanded ? "Return to the editor layout" : "Use the largest available scene viewport"}
                >
                  {sceneExpanded ? "Exit Expanded View" : "Expand Map View"}
                </button>
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
              className={`reconstruction-workspace__2d-viewport relative isolate touch-none overflow-hidden bg-slate-600 ${
                sceneExpanded
                  ? "min-h-[320px] flex-1"
                  : ""
              } ${sceneCursorClass}`}
            >
              {renderWorkspaceTools()}
              {renderWorkspaceToolHint()}
              <div data-scene-interactive="true" className="reconstruction-workspace__map-controls absolute right-3 top-3 z-[90] grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-2 text-white shadow-xl backdrop-blur" aria-label="2D map navigation controls">
                <span />
                <button type="button" title="Pan map north" aria-label="Pan map north" onClick={() => setSceneView((view) => ({ ...view, panY: view.panY + 40 }))} className="rounded bg-white/15 p-2 font-black">↑</button>
                <button type="button" title="Zoom map in" aria-label="Zoom map in" onClick={() => setSceneView((view) => ({ ...view, zoom: Math.min(3, view.zoom + 0.1) }))} className="rounded bg-white/15 p-2 font-black">+</button>
                <button type="button" title="Pan map west" aria-label="Pan map west" onClick={() => setSceneView((view) => ({ ...view, panX: view.panX + 40 }))} className="rounded bg-white/15 p-2 font-black">←</button>
                <button type="button" title="Fit the complete map" aria-label="Fit the complete map" onClick={() => setSceneView({ zoom: 0.92, panX: 0, panY: 0 })} className="rounded bg-white/15 p-2 text-[9px] font-black">FIT</button>
                <button type="button" title="Pan map east" aria-label="Pan map east" onClick={() => setSceneView((view) => ({ ...view, panX: view.panX - 40 }))} className="rounded bg-white/15 p-2 font-black">→</button>
                <button type="button" title="Zoom map out" aria-label="Zoom map out" onClick={() => setSceneView((view) => ({ ...view, zoom: Math.max(0.4, view.zoom - 0.1) }))} className="rounded bg-white/15 p-2 font-black">−</button>
                <button type="button" title="Pan map south" aria-label="Pan map south" onClick={() => setSceneView((view) => ({ ...view, panY: view.panY - 40 }))} className="rounded bg-white/15 p-2 font-black">↓</button>
                <span className="self-center text-center text-[9px] font-black" title="Current map zoom">{Math.round(sceneView.zoom * 100)}%</span>
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
                        if (activeWorkspaceTool === "Move") {
                          setDragState({
                            kind: "scene-object-trace-point",
                            objectId: selectedSceneObject.id,
                            pointIndex,
                          });
                        }
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
                          if (activeWorkspaceTool === "Move") {
                            setDragState({
                              kind: "participant-path-point",
                              participantId: participant.id,
                              pointId: point.id,
                            });
                          }
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
                        title={`${participant.name}: ${point.label} at ${point.timeSeconds.toFixed(1)}s — use Move to reposition`}
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

          </main>

          <aside className="ui-panel reconstruction-workspace__properties reconstruction-workspace__properties--2d reconstruction-workspace__context-panel is-open">
            <div className="reconstruction-workspace__context-scroll">
            <div className="reconstruction-workspace__2d-inspector-sticky">
              <div className="reconstruction-workspace__panel-header">
                <div>
                  <p>2D Context Inspector</p>
                  <span>
                    {selectedSceneObject
                      ? selectedSceneObject.label
                      : selectedParticipant?.name ?? "Participants and scene controls"}
                  </span>
                </div>
                <span className="reconstruction-workspace__inspector-count">
                  {reconstruction.vehicles.length}
                </span>
              </div>

              <div className="reconstruction-workspace__participant-roster">
                <div className="reconstruction-workspace__context-title">
                  <Activity size={13} />
                  Participants
                </div>

                <div className="reconstruction-workspace__participant-add">
                  <select
                    value={newParticipantType}
                    onChange={(event) =>
                      setNewParticipantType(
                        event.target.value as ReconstructionVehicleType,
                      )
                    }
                    aria-label="Participant type"
                  >
                    {PARTICIPANT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={handleAddParticipant}>
                    Add
                  </button>
                </div>

                <div className="reconstruction-workspace__participant-list">
                  {reconstruction.vehicles.length === 0 ? (
                    <div className="reconstruction-workspace__empty-properties">
                      Add the first participant to begin plotting the reconstruction.
                    </div>
                  ) : (
                    reconstruction.vehicles.map((participant) => {
                      const participantState = getParticipantStateAtTime(
                        participant,
                        currentTime,
                      );

                      return (
                        <button
                          key={participant.id}
                          type="button"
                          onClick={() => handleSelectParticipant(participant.id)}
                          className={
                            selectedParticipantId === participant.id
                              ? "is-active"
                              : ""
                          }
                        >
                          <span
                            className="reconstruction-workspace__participant-swatch"
                            style={{
                              backgroundColor: getParticipantColour(
                                participant.colour,
                              ),
                            }}
                          />
                          <span className="reconstruction-workspace__participant-copy">
                            <strong>{participant.name}</strong>
                            <small>
                              {participant.type} · {participantState.speedKmh.toFixed(1)} km/h
                            </small>
                          </span>
                          <span className="reconstruction-workspace__participant-points">
                            {participant.pathPoints.length} pts
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {selectedSceneObject ? (
              <div className="reconstruction-workspace__context-section">
                <div className="reconstruction-workspace__context-title">
                  <Layers3 size={13} />
                  Selected scene object
                </div>
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
              </div>
            ) : (
              <>
                <div className="reconstruction-workspace__context-section">
                  <div className="reconstruction-workspace__context-title">
                    <Crosshair size={13} />
                    Selected participant
                  </div>

                  {!selectedParticipant || !selectedParticipantState ? (
                    <div className="reconstruction-workspace__empty-properties">
                      Select a participant above or directly on the map to inspect and edit it.
                    </div>
                  ) : (
                    <div className="reconstruction-workspace__property-list">
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
                      <label>
                        <span>Type</span>
                        <select
                          value={selectedParticipant.type}
                          onChange={(event) =>
                            handleParticipantTypeChange(
                              selectedParticipant,
                              event.target.value as ReconstructionVehicleType,
                            )
                          }
                        >
                          {PARTICIPANT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Colour</span>
                        <select
                          value={selectedParticipant.colour}
                          onChange={(event) =>
                            updateParticipant(selectedParticipant.id, {
                              colour: event.target
                                .value as ReconstructionVehicleColour,
                            })
                          }
                        >
                          {PARTICIPANT_COLOURS.map((colour) => (
                            <option key={colour} value={colour}>
                              {colour}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <span>Speed</span>
                        <strong>{selectedParticipantState.speedKmh.toFixed(1)} km/h</strong>
                      </div>
                      <div>
                        <span>Position</span>
                        <strong>
                          X {selectedParticipantState.position.x.toFixed(2)} · Y {selectedParticipantState.position.y.toFixed(2)}
                        </strong>
                      </div>
                      <label>
                        <span>Heading</span>
                        <input
                          type="number"
                          value={Math.round(selectedParticipantState.rotation)}
                          onChange={(event) =>
                            updatePathPoint(
                              selectedParticipant.id,
                              selectedParticipantState.activePointId,
                              { rotation: Number(event.target.value) },
                            )
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>

                {selectedParticipant && (
                  <>
                    <div className="reconstruction-workspace__context-section">
                      <div className="reconstruction-workspace__context-title">
                        <Activity size={13} />
                        Default motion
                      </div>
                      <label className="reconstruction-workspace__speed-control">
                        <span>
                          Default speed
                          <strong>{selectedParticipant.estimatedSpeedKmh} km/h</strong>
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
                        />
                      </label>
                    </div>

                    <details className="reconstruction-workspace__context-section reconstruction-workspace__route-details">
                      <summary className="reconstruction-workspace__context-title">
                        <Move size={13} />
                        Route and movement controls
                        <ChevronUp size={13} />
                      </summary>
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
                    </details>

                    <button
                      type="button"
                      onClick={handleDeleteParticipant}
                      className="reconstruction-workspace__delete-participant"
                    >
                      Delete participant
                    </button>
                  </>
                )}
              </>
            )}
            </div>
          </aside>

        </div>

        <section className="reconstruction-playback" aria-label="Reconstruction playback controls">
          <div className="reconstruction-playback__scrubber">
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
              aria-label="Playback position"
            />
            <div
              className="reconstruction-playback__progress"
              style={{
                width: `${(currentTime / Math.max(0.1, reconstruction.durationSeconds)) * 100}%`,
              }}
            />
          </div>

          <div className="reconstruction-playback__controls">
            <div className="reconstruction-playback__transport">
              <button
                type="button"
                onClick={handleReset}
                title="Reset playback"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime((time) => Math.max(0, time - 0.1));
                }}
                title="Step backward 0.1 seconds"
              >
                <SkipBack size={15} />
              </button>
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={reconstruction.vehicles.length === 0}
                className="reconstruction-playback__play"
                title={isPlaying ? "Pause playback" : "Start playback"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? "Pause" : "Play"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime((time) =>
                    Math.min(reconstruction.durationSeconds, time + 0.1),
                  );
                }}
                title="Step forward 0.1 seconds"
              >
                <SkipForward size={15} />
              </button>
            </div>

            <div className="reconstruction-playback__clock">
              <strong>{currentTime.toFixed(2)}s</strong>
              <span>/ {reconstruction.durationSeconds.toFixed(1)}s</span>
            </div>

            <div className="reconstruction-playback__summary">
              <span>
                <Activity size={13} />
                {reconstruction.lastPhysicsSimulation?.participantCollisions ?? 0} collision(s)
              </span>
              <span>
                {reconstruction.lastPhysicsSimulation
                  ? `${reconstruction.lastPhysicsSimulation.estimatedImpactEnergyKj.toFixed(1)} kJ`
                  : "Physics not baked"}
              </span>
            </div>

            <label className="reconstruction-playback__speed">
              <span>Playback speed</span>
              <select
                value={playbackSpeed}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              >
                <option value={0.25}>0.25×</option>
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            </label>
          </div>
        </section>

        <div id="reconstruction-timeline-workspace" className="reconstruction-workspace__timeline-wrap">
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
        </div>

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
            onClose={handleCloseFieldPlacement}
            onPlacementConfirmed={handleFieldPlacementConfirmed}
            onUpdate={(updater) => setReconstruction(updater)}
          />
        )}
      </div>
    </div>
  );
}
