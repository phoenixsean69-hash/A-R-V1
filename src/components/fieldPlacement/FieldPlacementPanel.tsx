import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  FileClock,
  MapPin,
  Pause,
  Pentagon,
  Play,
  Radio,
  Route,
  Save,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import type {
  AccidentReconstruction,
  SceneObjectType,
} from "../../types/reconstruction";
import type {
  AveragedLocationResult,
  FieldCaptureMode,
  FieldPlacementTarget,
  FieldSceneCalibration,
  FieldWalkingTrackTargetType,
  GeoCoordinate,
  ProcessedWalkingTrace,
} from "../../types/fieldPlacement";

import { useLiveGeolocation } from "../../hooks/useLiveGeolocation";
import { useScreenWakeLock } from "../../hooks/useScreenWakeLock";
import { FieldCaptureProcessingService } from "../../services/fieldCaptureProcessingService";
import { FieldPlacementService } from "../../services/fieldPlacementService";
import {
  assessCoordinateAgainstScene,
  calculateTrackDistanceMetres,
  coordinateToScenePosition,
  getDistanceAndBearing,
  haversineDistanceMetres,
} from "../../utils/geographicCoordinates";
import { averageGeoCoordinates } from "../../utils/locationAveraging";

import FieldPlacementMap from "./FieldPlacementMap";
import FieldSceneLivePreview from "./FieldSceneLivePreview";
import LocationAccuracyBadge from "./LocationAccuracyBadge";

interface FieldPlacementPanelProps {
  open: boolean;
  reconstruction: AccidentReconstruction;
  officerName?: string;
  currentTimeSeconds?: number;
  initialTarget?: FieldPlacementTarget | null;
  onClose: () => void;
  onPlacementConfirmed?: (target: FieldPlacementTarget) => void;
  onUpdate: (
    updater: (current: AccidentReconstruction) => AccidentReconstruction,
  ) => void;
}

type FieldTab = "Capture" | "Calibration" | "History";
type CalibrationPointKind = "origin" | "direction" | "width";

interface CaptureTargetOption {
  key: string;
  label: string;
  detail: string;
  modes: FieldCaptureMode[];
  pointTarget?: FieldPlacementTarget;
  traceTargetType?: FieldWalkingTrackTargetType;
  targetId: string;
}

const LINE_OBJECT_TYPES = new Set<SceneObjectType>([
  "Skid Mark",
  "Tyre Mark",
  "Road Crack",
  "Guardrail",
  "Wall",
  "Fence",
  "Road Barrier",
]);

const BOUNDARY_OBJECT_TYPES = new Set<SceneObjectType>([
  "Pothole",
  "Puddle",
  "Oil Spill",
  "Loose Gravel",
  "Debris",
  "Broken Glass",
  "Bush",
]);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function createSingleCapture(
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

function formatCoordinate(coordinate?: GeoCoordinate | null): string {
  if (!coordinate) return "Not captured";
  return `${coordinate.latitude.toFixed(7)}, ${coordinate.longitude.toFixed(7)}`;
}

function getTargetKey(target: FieldPlacementTarget): string {
  return `${target.type}:${target.targetId}:${target.subTargetId ?? ""}`;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function captureModeCopy(mode: FieldCaptureMode): {
  title: string;
  description: string;
} {
  if (mode === "Point") {
    return {
      title: "Place Point",
      description:
        "Walk to the item, stand at its centre and collect a stabilised GPS position.",
    };
  }
  if (mode === "Line") {
    return {
      title: "Walk Line",
      description:
        "Start at one end and physically follow the mark, wall, barrier or route.",
    };
  }
  return {
    title: "Walk Boundary",
    description:
      "Walk around the outside edge. The system closes the boundary and calculates its area.",
  };
}

function traceTargetTypeForObject(type: SceneObjectType): FieldWalkingTrackTargetType {
  if (type === "Skid Mark") return "SkidMark";
  if (type === "Tyre Mark") return "TyreMark";
  if (type === "Road Crack") return "RoadCrack";
  return "SceneObjectLine";
}

function buildCaptureTargets(
  reconstruction: AccidentReconstruction,
): CaptureTargetOption[] {
  const pointTargets = FieldPlacementService.getTargets(reconstruction);
  const options: CaptureTargetOption[] = [];

  pointTargets.forEach((target) => {
    if (target.type === "SceneObject") {
      const object = reconstruction.sceneObjects.find(
        (item) => item.id === target.targetId,
      );
      if (!object) return;
      const modes: FieldCaptureMode[] = ["Point"];
      if (LINE_OBJECT_TYPES.has(object.type)) modes.push("Line");
      if (BOUNDARY_OBJECT_TYPES.has(object.type)) modes.push("Boundary");
      options.push({
        key: `scene-object:${object.id}`,
        label: object.label,
        detail: `${object.type} · scene object`,
        modes,
        pointTarget: target,
        traceTargetType: traceTargetTypeForObject(object.type),
        targetId: object.id,
      });
      return;
    }

    options.push({
      key: `point:${getTargetKey(target)}`,
      label: target.label,
      detail:
        target.type === "CollisionPoint"
          ? "Primary collision location"
          : target.type === "ParticipantPathPoint"
            ? "Participant route control point"
            : target.type === "EvidenceRecord"
              ? "Evidence location"
              : "Measured scene point",
      modes: ["Point"],
      pointTarget: target,
      targetId: target.targetId,
    });
  });

  reconstruction.vehicles.forEach((participant) => {
    options.push({
      key: `participant-route:${participant.id}`,
      label: participant.name,
      detail: `${participant.type} · complete walked route`,
      modes: ["Line"],
      traceTargetType: "ParticipantPath",
      targetId: participant.id,
    });
  });

  return options;
}

function modeIcon(mode: FieldCaptureMode) {
  if (mode === "Point") return <CircleDot size={18} />;
  if (mode === "Line") return <Route size={18} />;
  return <Pentagon size={18} />;
}

export default function FieldPlacementPanel({
  open,
  reconstruction,
  officerName = "",
  currentTimeSeconds = 0,
  initialTarget = null,
  onClose,
  onPlacementConfirmed,
  onUpdate,
}: FieldPlacementPanelProps) {
  const geolocation = useLiveGeolocation();
  const {
    current: currentCoordinate,
    supported: geolocationSupported,
    permission: geolocationPermission,
    isWatching: geolocationIsWatching,
    error: geolocationError,
    sampleCount: geolocationSampleCount,
    start: startGeolocation,
    stop: stopGeolocation,
    clearSamples: clearGeolocationSamples,
    getSamplesSince,
  } = geolocation;
  const [tab, setTab] = useState<FieldTab>(() =>
    reconstruction.fieldCalibration ? "Capture" : "Calibration",
  );
  const [captureMode, setCaptureMode] = useState<FieldCaptureMode>("Point");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isAveraging, setIsAveraging] = useState(false);
  const [averageProgress, setAverageProgress] = useState(0);
  const [pendingCapture, setPendingCapture] =
    useState<AveragedLocationResult | null>(null);
  const [allowPoorAccuracy, setAllowPoorAccuracy] = useState(false);

  const [calibrationOrigin, setCalibrationOrigin] =
    useState<GeoCoordinate | null>(reconstruction.fieldCalibration?.origin ?? null);
  const [calibrationDirection, setCalibrationDirection] =
    useState<GeoCoordinate | null>(
      reconstruction.fieldCalibration?.directionReference ?? null,
    );
  const [calibrationWidth, setCalibrationWidth] =
    useState<GeoCoordinate | null>(
      reconstruction.fieldCalibration?.widthReference ?? null,
    );

  const captureTargets = useMemo(
    () => buildCaptureTargets(reconstruction),
    [reconstruction],
  );
  const initialTargetKey = useMemo(() => {
    if (!initialTarget) return "";
    return (
      captureTargets.find(
        (option) =>
          option.pointTarget &&
          getTargetKey(option.pointTarget) === getTargetKey(initialTarget),
      )?.key ?? ""
    );
  }, [captureTargets, initialTarget]);
  const [targetKey, setTargetKey] = useState(initialTargetKey);

  const [isTracing, setIsTracing] = useState(false);
  const [tracePaused, setTracePaused] = useState(false);
  const [traceStartedAt, setTraceStartedAt] = useState("");
  const [rawTraceCoordinates, setRawTraceCoordinates] = useState<GeoCoordinate[]>([]);
  const [traceReview, setTraceReview] = useState<ProcessedWalkingTrace | null>(null);
  const [guidancePlacementId, setGuidancePlacementId] = useState<string | null>(
    null,
  );

  const wakeLock = useScreenWakeLock(isAveraging || isTracing);

  const availableTargets = useMemo(
    () => captureTargets.filter((target) => target.modes.includes(captureMode)),
    [captureMode, captureTargets],
  );
  const effectiveTargetKey = availableTargets.some(
    (target) => target.key === targetKey,
  )
    ? targetKey
    : availableTargets[0]?.key ?? "";
  const selectedTargetOption = useMemo(
    () =>
      availableTargets.find((target) => target.key === effectiveTargetKey) ??
      null,
    [availableTargets, effectiveTargetKey],
  );
  const selectedPointTarget =
    captureMode === "Point" ? selectedTargetOption?.pointTarget ?? null : null;

  useEffect(() => {
    if (!open || !initialTargetKey) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCaptureMode("Point");
      setTargetKey(initialTargetKey);
      setTab(reconstruction.fieldCalibration ? "Capture" : "Calibration");
    });
    return () => {
      active = false;
    };
  }, [initialTargetKey, open, reconstruction.fieldCalibration]);

  const liveScenePosition = useMemo(() => {
    if (!currentCoordinate || !reconstruction.fieldCalibration) return null;
    return coordinateToScenePosition(
      currentCoordinate,
      reconstruction.fieldCalibration,
      false,
    );
  }, [currentCoordinate, reconstruction.fieldCalibration]);

  const pendingScenePosition = useMemo(() => {
    if (!pendingCapture || !reconstruction.fieldCalibration) return null;
    return coordinateToScenePosition(
      pendingCapture.coordinate,
      reconstruction.fieldCalibration,
      false,
    );
  }, [pendingCapture, reconstruction.fieldCalibration]);

  const pendingBounds = useMemo(() => {
    if (!pendingCapture || !reconstruction.fieldCalibration) return null;
    return assessCoordinateAgainstScene(
      pendingCapture.coordinate,
      reconstruction.fieldCalibration,
    );
  }, [pendingCapture, reconstruction.fieldCalibration]);

  const rawTraceScenePoints = useMemo(() => {
    if (!reconstruction.fieldCalibration) return [];
    return rawTraceCoordinates.map((coordinate) =>
      coordinateToScenePosition(
        coordinate,
        reconstruction.fieldCalibration!,
        false,
      ),
    );
  }, [rawTraceCoordinates, reconstruction.fieldCalibration]);

  const processedTraceScenePoints = useMemo(() => {
    if (!reconstruction.fieldCalibration || !traceReview) return [];
    return traceReview.processedCoordinates.map((coordinate) =>
      coordinateToScenePosition(
        coordinate,
        reconstruction.fieldCalibration!,
        false,
      ),
    );
  }, [reconstruction.fieldCalibration, traceReview]);

  const guidance = useMemo(() => {
    if (!currentCoordinate || !guidancePlacementId) return null;
    const placement = reconstruction.fieldPlacements.find(
      (item) => item.id === guidancePlacementId,
    );
    if (!placement) return null;
    return {
      placement,
      ...getDistanceAndBearing(currentCoordinate, placement.coordinate),
    };
  }, [
    currentCoordinate,
    guidancePlacementId,
    reconstruction.fieldPlacements,
  ]);

  useEffect(() => {
    if (!open) return;
    startGeolocation();
    return () => stopGeolocation();
  }, [open, startGeolocation, stopGeolocation]);

  useEffect(() => {
    if (!isTracing || tracePaused || !currentCoordinate) return;
    const coordinate = currentCoordinate;
    queueMicrotask(() => {
      setRawTraceCoordinates((current) => {
        const previous = current[current.length - 1];
        if (!previous) return [coordinate];
        if (previous.capturedAt === coordinate.capturedAt) return current;
        const distance = haversineDistanceMetres(previous, coordinate);
        if (distance < 0.05) return current;
        return [...current, coordinate];
      });
    });
  }, [currentCoordinate, isTracing, tracePaused]);

  const captureAverage = async (): Promise<AveragedLocationResult> => {
    if (!geolocationSupported) {
      throw new Error("This device or browser does not support geolocation.");
    }

    startGeolocation();
    clearGeolocationSamples();
    setIsAveraging(true);
    setAverageProgress(0);

    try {
      for (let index = 1; index <= 20; index += 1) {
        await wait(250);
        setAverageProgress(index / 20);
      }

      const samples = getSamplesSince(0);
      if (samples.length === 0) {
        if (!currentCoordinate) {
          throw new Error(
            "No GPS samples were received. Move outdoors and keep the device still.",
          );
        }
        return createSingleCapture(currentCoordinate);
      }

      return averageGeoCoordinates(samples);
    } finally {
      setIsAveraging(false);
      setAverageProgress(0);
    }
  };

  const captureCalibrationPoint = async (
    kind: CalibrationPointKind,
  ): Promise<void> => {
    setError("");
    setMessage("");

    try {
      const result = await captureAverage();
      if (kind === "origin") setCalibrationOrigin(result.coordinate);
      else if (kind === "direction") setCalibrationDirection(result.coordinate);
      else setCalibrationWidth(result.coordinate);
      setMessage(
        `${kind === "origin" ? "Origin" : kind === "direction" ? "Road direction" : "Width reference"} captured from ${result.sampleCount} accepted GPS sample(s).`,
      );
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "The calibration point could not be captured.",
      );
    }
  };

  const saveCalibration = (): void => {
    if (!calibrationOrigin || !calibrationDirection) {
      setError("Capture the origin and road-direction reference first.");
      return;
    }

    try {
      const calibration = FieldPlacementService.createCalibration({
        origin: calibrationOrigin,
        directionReference: calibrationDirection,
        widthReference: calibrationWidth ?? undefined,
        sceneWidthMetres: reconstruction.scene.sceneWidthMetres,
        sceneHeightMetres: reconstruction.scene.sceneHeightMetres,
        createdBy: officerName,
      });
      onUpdate((current) => ({ ...current, fieldCalibration: calibration }));
      setMessage("Field scene calibration saved. Capture tools are ready.");
      setError("");
      setTab("Capture");
    } catch (calibrationError) {
      setError(
        calibrationError instanceof Error
          ? calibrationError.message
          : "The field calibration could not be saved.",
      );
    }
  };

  const prepareCurrentCapture = (): void => {
    if (!currentCoordinate) {
      setError("Wait until the device has a current GPS reading.");
      return;
    }
    setPendingCapture(createSingleCapture(currentCoordinate));
    setAllowPoorAccuracy(false);
    setMessage("Current reading prepared. Review it before confirming.");
    setError("");
  };

  const prepareAverageCapture = async (): Promise<void> => {
    setError("");
    setMessage("");
    try {
      const result = await captureAverage();
      setPendingCapture(result);
      setAllowPoorAccuracy(false);
      setMessage(
        `Position prepared from ${result.sampleCount} accepted sample(s).`,
      );
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "The averaged location could not be prepared.",
      );
    }
  };

  const confirmPlacement = (): void => {
    if (!selectedPointTarget) {
      setError("Select an item that supports point placement.");
      return;
    }
    if (!pendingCapture) {
      setError("Capture the current position first.");
      return;
    }
    if (!pendingBounds?.insideScene) {
      setError(
        "This position lies outside the calibrated scene. Expand or recalibrate the scene before confirming it.",
      );
      return;
    }
    if (pendingCapture.averageAccuracyMetres > 10 && !allowPoorAccuracy) {
      setError(
        "GPS accuracy is currently poor. Wait for a better signal or explicitly accept the warning.",
      );
      return;
    }

    try {
      onUpdate((current) =>
        FieldPlacementService.applyPlacement({
          reconstruction: current,
          target: selectedPointTarget,
          capture: pendingCapture,
          method:
            pendingCapture.sampleCount > 1 ? "Averaged GPS" : "Single GPS",
          confirmedBy: officerName,
          acceptedPoorAccuracy: allowPoorAccuracy,
        }),
      );
      onPlacementConfirmed?.(selectedPointTarget);
      setMessage(`${selectedPointTarget.label} was placed from field GPS.`);
      setError("");
      setPendingCapture(null);
    } catch (placementError) {
      setError(
        placementError instanceof Error
          ? placementError.message
          : "The field placement could not be applied.",
      );
    }
  };

  const startWalkingTrace = (): void => {
    if (!reconstruction.fieldCalibration) {
      setError("Calibrate the scene before recording a walking capture.");
      setTab("Calibration");
      return;
    }
    if (!selectedTargetOption?.traceTargetType) {
      setError("Select an item that supports this walking capture method.");
      return;
    }
    if (!currentCoordinate) {
      setError("Wait until the device has a current GPS reading.");
      return;
    }

    setRawTraceCoordinates([currentCoordinate]);
    setTraceReview(null);
    setTraceStartedAt(new Date().toISOString());
    setTracePaused(false);
    setIsTracing(true);
    setError("");
    setMessage(
      captureMode === "Boundary"
        ? "Boundary recording started. Walk around the outside edge and return near the start."
        : "Line recording started. Walk slowly along the physical feature.",
    );
  };

  const finishWalkingTrace = (): void => {
    setIsTracing(false);
    setTracePaused(false);
    try {
      const review = FieldCaptureProcessingService.processWalkingTrace({
        coordinates: rawTraceCoordinates,
        captureMode: captureMode === "Boundary" ? "Boundary" : "Line",
      });
      setTraceReview(review);
      setMessage(
        `Capture processed: ${review.acceptedCoordinates.length} accepted and ${review.rejectedCoordinates.length} rejected sample(s).`,
      );
      setError("");
    } catch (traceError) {
      setError(
        traceError instanceof Error
          ? traceError.message
          : "The walking capture could not be processed.",
      );
    }
  };

  const saveWalkingTrace = (): void => {
    if (!selectedTargetOption?.traceTargetType || !traceReview) {
      setError("Finish and review the walking capture before saving it.");
      return;
    }

    try {
      onUpdate((current) =>
        FieldPlacementService.applyWalkingTrack({
          reconstruction: current,
          targetType:
            captureMode === "Boundary"
              ? "SceneObjectBoundary"
              : selectedTargetOption.traceTargetType!,
          targetId: selectedTargetOption.targetId,
          targetLabel: selectedTargetOption.label,
          processedTrace: traceReview,
          startedAt: traceStartedAt || new Date().toISOString(),
          recordedBy: officerName,
        }),
      );
      if (selectedTargetOption.pointTarget) {
        onPlacementConfirmed?.(selectedTargetOption.pointTarget);
      }
      setMessage(`${selectedTargetOption.label} was updated from field walking data.`);
      setError("");
      setRawTraceCoordinates([]);
      setTraceReview(null);
      setTraceStartedAt("");
    } catch (traceError) {
      setError(
        traceError instanceof Error
          ? traceError.message
          : "The walking capture could not be saved.",
      );
    }
  };

  if (!open) return null;

  const calibrationForMap: FieldSceneCalibration | undefined =
    reconstruction.fieldCalibration ??
    (calibrationOrigin && calibrationDirection
      ? {
          id: "calibration-preview",
          origin: calibrationOrigin,
          directionReference: calibrationDirection,
          widthReference: calibrationWidth ?? undefined,
          sceneWidthMetres: reconstruction.scene.sceneWidthMetres,
          sceneHeightMetres: reconstruction.scene.sceneHeightMetres,
          rotationDegrees: 0,
          directionReferenceDistanceMetres: 0,
          widthReferenceDistanceMetres: undefined,
          yAxisSide: "Left",
          createdAt: "",
          createdBy: officerName,
        }
      : undefined);

  const modeCopy = captureModeCopy(captureMode);

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/90 p-2 backdrop-blur-sm sm:p-4">
      <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-[1600px] overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl sm:min-h-[calc(100vh-2rem)]">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950/95 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-400">
              RoadSafe AR · Field Capture V2
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Real-world scene capture
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Select an item, physically walk to or along it, review the GPS geometry, then confirm it into the reconstruction.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LocationAccuracyBadge
              accuracyMetres={currentCoordinate?.accuracyMetres ?? null}
            />
            <button
              type="button"
              onClick={geolocationIsWatching ? geolocation.stop : geolocation.start}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-black text-slate-100 hover:bg-slate-700"
            >
              <Radio size={16} />
              {geolocationIsWatching ? "Pause GPS" : "Start GPS"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsTracing(false);
                setTracePaused(false);
                setRawTraceCoordinates([]);
                setTraceReview(null);
                setPendingCapture(null);
                setMessage("");
                setError("");
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-sky-400"
            >
              <X size={16} /> Close Field Mode
            </button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-slate-800 bg-slate-900 px-4 py-3 sm:px-6">
          {(["Capture", "Calibration", "History"] as FieldTab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-lg px-4 py-2 text-xs font-black ${
                tab === item
                  ? "bg-sky-500 text-slate-950"
                  : "border border-slate-700 bg-slate-800 text-slate-300"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {(message || error || geolocationError) && (
          <div className="space-y-2 px-4 pt-4 sm:px-6">
            {message && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-700/60 bg-emerald-950/50 p-3 text-sm font-semibold text-emerald-200">
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                {message}
              </div>
            )}
            {(error || geolocationError) && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-800/70 bg-rose-950/50 p-3 text-sm font-semibold text-rose-200">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                {error || geolocationError}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <section className="space-y-4">
            <div className="grid gap-4 2xl:grid-cols-2">
              <FieldPlacementMap
                current={currentCoordinate}
                calibration={calibrationForMap}
                placements={reconstruction.fieldPlacements}
                rawTraceCoordinates={rawTraceCoordinates}
                processedTraceCoordinates={traceReview?.processedCoordinates ?? []}
                rejectedTraceCoordinates={traceReview?.rejectedCoordinates ?? []}
                pendingCoordinate={pendingCapture?.coordinate ?? null}
                captureMode={captureMode}
                guidancePlacementId={guidancePlacementId}
              />

              <FieldSceneLivePreview
                reconstruction={reconstruction}
                currentTimeSeconds={currentTimeSeconds}
                liveScenePosition={liveScenePosition}
                pendingScenePosition={pendingScenePosition}
                selectedTarget={selectedPointTarget}
                rawTraceScenePoints={rawTraceScenePoints}
                processedTraceScenePoints={processedTraceScenePoints}
                captureMode={captureMode}
              />
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Permission</p>
                <p className="mt-1 text-sm font-black text-white">{geolocationPermission}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Live samples</p>
                <p className="mt-1 text-sm font-black text-white">{geolocationSampleCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Coordinate</p>
                <p className="mt-1 break-all text-xs font-bold text-slate-300">{formatCoordinate(currentCoordinate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Screen awake</p>
                <p className="mt-1 text-sm font-black text-white">{wakeLock.locked ? "Locked" : wakeLock.supported ? "Ready" : "Unsupported"}</p>
              </div>
            </div>
          </section>

          <aside className="self-start rounded-2xl border border-slate-700 bg-slate-900 shadow-xl xl:sticky xl:top-28">
            {tab === "Capture" && (
              <div>
                <div className="border-b border-slate-700 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">Capture workflow</p>
                  <h3 className="mt-1 text-lg font-black text-white">Choose, capture, review, confirm</h3>
                </div>

                <div className="space-y-5 p-5">
                  {!reconstruction.fieldCalibration && (
                    <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-4 text-sm font-semibold text-amber-200">
                      Calibrate the scene before placing field items.
                      <button
                        type="button"
                        onClick={() => setTab("Calibration")}
                        className="mt-3 w-full rounded-lg bg-amber-400 px-3 py-2 font-black text-slate-950"
                      >
                        Open Calibration
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-400">1. Select item or participant</label>
                    <select
                      value={effectiveTargetKey}
                      onChange={(event) => {
                        setTargetKey(event.target.value);
                        setPendingCapture(null);
                        setRawTraceCoordinates([]);
                        setTraceReview(null);
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-sky-400"
                    >
                      {availableTargets.length === 0 && <option value="">No compatible targets</option>}
                      {availableTargets.map((target) => (
                        <option key={target.key} value={target.key}>{target.label} — {target.detail}</option>
                      ))}
                    </select>
                    {selectedTargetOption && (
                      <p className="mt-2 text-xs text-slate-400">{selectedTargetOption.detail}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">2. Choose capture method</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["Point", "Line", "Boundary"] as FieldCaptureMode[]).map((mode) => {
                        const compatible = captureTargets.some((target) => target.modes.includes(mode));
                        return (
                          <button
                            key={mode}
                            type="button"
                            disabled={!compatible || isTracing}
                            onClick={() => {
                              setCaptureMode(mode);
                              setPendingCapture(null);
                              setRawTraceCoordinates([]);
                              setTraceReview(null);
                            }}
                            className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-[11px] font-black ${
                              captureMode === mode
                                ? "border-sky-400 bg-sky-500 text-slate-950"
                                : "border-slate-600 bg-slate-800 text-slate-300"
                            } disabled:opacity-30`}
                          >
                            {modeIcon(mode)}
                            {mode}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                    <p className="text-sm font-black text-white">{modeCopy.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{modeCopy.description}</p>
                  </div>

                  {captureMode === "Point" ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={prepareCurrentCapture}
                          disabled={!currentCoordinate || !reconstruction.fieldCalibration || isAveraging}
                          className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-xs font-black text-slate-200 disabled:opacity-40"
                        >
                          Use Current Reading
                        </button>
                        <button
                          type="button"
                          onClick={() => void prepareAverageCapture()}
                          disabled={!reconstruction.fieldCalibration || isAveraging}
                          className="rounded-xl bg-sky-500 px-3 py-3 text-xs font-black text-slate-950 disabled:opacity-40"
                        >
                          {isAveraging ? `Stabilising ${Math.round(averageProgress * 100)}%` : "Capture Here · 5 sec"}
                        </button>
                      </div>

                      {isAveraging && (
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full bg-sky-500" style={{ width: `${averageProgress * 100}%` }} />
                        </div>
                      )}

                      {pendingCapture && (
                        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-white">Point review</p>
                            <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-300">{pendingCapture.sampleCount} samples</span>
                          </div>
                          <dl className="grid grid-cols-2 gap-3 text-xs">
                            <div><dt className="text-slate-500">Average accuracy</dt><dd className="font-black text-white">±{pendingCapture.averageAccuracyMetres.toFixed(1)}m</dd></div>
                            <div><dt className="text-slate-500">Estimated uncertainty</dt><dd className="font-black text-white">±{(pendingCapture.estimatedUncertaintyMetres ?? pendingCapture.averageAccuracyMetres).toFixed(1)}m</dd></div>
                            <div><dt className="text-slate-500">Observed spread</dt><dd className="font-black text-white">{(pendingCapture.observedSpreadMetres ?? 0).toFixed(1)}m</dd></div>
                            <div><dt className="text-slate-500">Rejected samples</dt><dd className="font-black text-white">{pendingCapture.rejectedSampleCount}</dd></div>
                          </dl>
                          <p className="break-all text-[11px] font-semibold text-slate-400">{formatCoordinate(pendingCapture.coordinate)}</p>

                          {pendingBounds && !pendingBounds.insideScene && (
                            <div className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs font-semibold text-rose-200">
                              Outside calibrated scene. Recalibrate or expand the scene before confirming. No silent edge-clamping will be applied.
                            </div>
                          )}

                          {pendingCapture.averageAccuracyMetres > 10 && (
                            <label className="flex items-start gap-3 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-xs font-semibold text-amber-200">
                              <input
                                type="checkbox"
                                checked={allowPoorAccuracy}
                                onChange={(event) => setAllowPoorAccuracy(event.target.checked)}
                                className="mt-0.5 h-4 w-4"
                              />
                              Accept this poor-accuracy position and preserve the warning in the audit record.
                            </label>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={confirmPlacement}
                        disabled={!selectedPointTarget || !pendingCapture || !pendingBounds?.insideScene}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-35"
                      >
                        <MapPin size={17} /> Confirm Point Placement
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-center">
                        <div><p className="text-[9px] font-black uppercase text-slate-500">Raw points</p><p className="mt-1 text-lg font-black text-white">{rawTraceCoordinates.length}</p></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-500">Raw distance</p><p className="mt-1 text-lg font-black text-white">{calculateTrackDistanceMetres(rawTraceCoordinates).toFixed(1)}m</p></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-500">Status</p><p className="mt-1 text-xs font-black text-white">{isTracing ? tracePaused ? "Paused" : "Recording" : traceReview ? "Review" : "Ready"}</p></div>
                      </div>

                      {!isTracing && !traceReview && (
                        <button
                          type="button"
                          onClick={startWalkingTrace}
                          disabled={!selectedTargetOption?.traceTargetType || !reconstruction.fieldCalibration}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-35"
                        >
                          <Play size={17} /> Start {captureMode === "Boundary" ? "Boundary" : "Line"} Capture
                        </button>
                      )}

                      {isTracing && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTracePaused((value) => !value)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-xs font-black text-slate-200"
                          >
                            {tracePaused ? <Play size={16} /> : <Pause size={16} />}
                            {tracePaused ? "Resume" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={finishWalkingTrace}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-3 text-xs font-black text-slate-950"
                          >
                            <Square size={15} /> Finish and Review
                          </button>
                          <button
                            type="button"
                            onClick={() => setRawTraceCoordinates((current) => current.slice(0, -1))}
                            disabled={rawTraceCoordinates.length <= 1}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-xs font-black text-slate-200 disabled:opacity-35"
                          >
                            <Undo2 size={16} /> Undo Last
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsTracing(false);
                              setTracePaused(false);
                              setRawTraceCoordinates([]);
                              setTraceReview(null);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-3 text-xs font-black text-rose-200"
                          >
                            <Trash2 size={16} /> Discard
                          </button>
                        </div>
                      )}

                      {traceReview && (
                        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-white">Geometry review</p>
                            <span className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-black text-slate-950">{traceReview.captureMode}</span>
                          </div>
                          <dl className="grid grid-cols-2 gap-3 text-xs">
                            <div><dt className="text-slate-500">Raw distance</dt><dd className="font-black text-white">{traceReview.rawDistanceMetres.toFixed(1)}m</dd></div>
                            <div><dt className="text-slate-500">Processed distance</dt><dd className="font-black text-white">{traceReview.processedDistanceMetres.toFixed(1)}m</dd></div>
                            <div><dt className="text-slate-500">Accepted / rejected</dt><dd className="font-black text-white">{traceReview.acceptedCoordinates.length} / {traceReview.rejectedCoordinates.length}</dd></div>
                            <div><dt className="text-slate-500">Uncertainty</dt><dd className="font-black text-white">±{traceReview.estimatedUncertaintyMetres.toFixed(1)}m</dd></div>
                            {traceReview.areaSquareMetres !== undefined && (
                              <div className="col-span-2"><dt className="text-slate-500">Boundary area</dt><dd className="font-black text-white">{traceReview.areaSquareMetres.toFixed(1)}m²</dd></div>
                            )}
                          </dl>
                          <p className="text-[10px] leading-4 text-slate-500">{traceReview.processingMethod}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRawTraceCoordinates([]);
                                setTraceReview(null);
                                setTraceStartedAt("");
                              }}
                              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-xs font-black text-slate-200"
                            >
                              Retry Capture
                            </button>
                            <button
                              type="button"
                              onClick={saveWalkingTrace}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-3 text-xs font-black text-slate-950"
                            >
                              <Save size={16} /> Confirm Geometry
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "Calibration" && (
              <div>
                <div className="border-b border-slate-700 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">Scene reference</p>
                  <h3 className="mt-1 text-lg font-black text-white">GPS calibration</h3>
                </div>
                <div className="space-y-4 p-5">
                  <p className="text-xs leading-5 text-slate-400">
                    Capture the scene origin, then walk at least 3 metres along the road direction. A longer baseline gives a more reliable orientation.
                  </p>
                  {([
                    ["origin", "1. Scene origin", calibrationOrigin],
                    ["direction", "2. Road direction reference", calibrationDirection],
                    ["width", "3. Width-side reference (optional)", calibrationWidth],
                  ] as const).map(([kind, label, coordinate]) => (
                    <div key={kind} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{label}</p>
                          <p className="mt-1 break-all text-[10px] font-semibold text-slate-500">{formatCoordinate(coordinate)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void captureCalibrationPoint(kind)}
                          disabled={isAveraging}
                          className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
                        >
                          Capture
                        </button>
                      </div>
                    </div>
                  ))}

                  {reconstruction.fieldCalibration && (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
                      <p>Road bearing: <b className="text-white">{reconstruction.fieldCalibration.rotationDegrees.toFixed(1)}°</b></p>
                      <p className="mt-1">Direction baseline: <b className="text-white">{reconstruction.fieldCalibration.directionReferenceDistanceMetres.toFixed(1)}m</b></p>
                      {reconstruction.fieldCalibration.directionReferenceDistanceMetres < 10 && (
                        <p className="mt-3 rounded-lg border border-amber-700 bg-amber-950/40 p-2 font-semibold text-amber-200">A baseline below 10m can produce unstable road orientation. Use a longer reference when practical.</p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={saveCalibration}
                    disabled={!calibrationOrigin || !calibrationDirection}
                    className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-35"
                  >
                    Save Calibration
                  </button>
                </div>
              </div>
            )}

            {tab === "History" && (
              <div>
                <div className="border-b border-slate-700 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">Forensic audit</p>
                  <h3 className="mt-1 text-lg font-black text-white">Captured field data</h3>
                </div>
                <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5 overscroll-contain">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Points</p><p className="mt-1 text-2xl font-black text-white">{reconstruction.fieldPlacements.length}</p></div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Walked geometry</p><p className="mt-1 text-2xl font-black text-white">{reconstruction.fieldWalkingTracks.length}</p></div>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadJson(`${reconstruction.accidentId || "roadsafe"}-field-data.json`, {
                      calibration: reconstruction.fieldCalibration,
                      placements: reconstruction.fieldPlacements,
                      walkingTracks: reconstruction.fieldWalkingTracks,
                    })}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-xs font-black text-slate-200"
                  >
                    <FileClock size={16} /> Export Field Audit JSON
                  </button>

                  {guidance && (
                    <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-xs text-amber-200">
                      <p className="font-black">Guidance to {guidance.placement.targetLabel}</p>
                      <p className="mt-1">{guidance.distanceMetres.toFixed(1)}m {guidance.directionLabel} · bearing {guidance.bearingDegrees.toFixed(0)}°</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {[...reconstruction.fieldPlacements].reverse().map((placement) => (
                      <article key={placement.id} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div><h4 className="text-sm font-black text-white">{placement.targetLabel}</h4><p className="mt-1 text-[10px] font-semibold text-slate-500">{placement.method} · {placement.sampleCount} sample(s) · ±{(placement.estimatedUncertaintyMetres ?? placement.averageAccuracyMetres).toFixed(1)}m</p></div>
                          <button type="button" onClick={() => setGuidancePlacementId(placement.id)} className="rounded-lg border border-amber-700 bg-amber-950/40 px-2 py-1.5 text-[10px] font-black text-amber-200">Guide</button>
                        </div>
                        <p className="mt-2 break-all text-[10px] text-slate-500">{formatCoordinate(placement.coordinate)}</p>
                      </article>
                    ))}

                    {[...reconstruction.fieldWalkingTracks].reverse().map((track) => (
                      <article key={track.id} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                        <h4 className="text-sm font-black text-white">{track.targetLabel}</h4>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">{track.captureMode ?? "Line"} · {track.distanceMetres.toFixed(1)}m · ±{(track.estimatedUncertaintyMetres ?? track.averageAccuracyMetres).toFixed(1)}m</p>
                        {track.areaSquareMetres !== undefined && <p className="mt-2 text-xs font-black text-sky-300">Area {track.areaSquareMetres.toFixed(1)}m²</p>}
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
