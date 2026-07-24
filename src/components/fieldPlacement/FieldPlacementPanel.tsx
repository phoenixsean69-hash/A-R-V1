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
  localOffsetToCoordinate,
  haversineDistanceMetres,
} from "../../utils/geographicCoordinates";
import { averageGeoCoordinates } from "../../utils/locationAveraging";

import FieldPlacementMap from "./FieldPlacementMap";
import FieldSceneLivePreview from "./FieldSceneLivePreview";
import LocationAccuracyBadge from "./LocationAccuracyBadge";
import "./FieldPlacementPanel.css";

interface FieldPlacementPanelProps {
  open: boolean;
  reconstruction: AccidentReconstruction;
  officerName?: string;
  currentTimeSeconds?: number;
  initialTarget?: FieldPlacementTarget | null;
  initialCaptureMode?: FieldCaptureMode;
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
      title: "Place point",
      description:
        "Walk to the item, stand at its centre and collect a stabilised GPS position.",
    };
  }

  if (mode === "Line") {
    return {
      title: "Walk line",
      description:
        "Start at one end and physically follow the mark, wall, barrier or participant route.",
    };
  }

  return {
    title: "Walk boundary",
    description:
      "Walk around the outside edge. The system closes the boundary and calculates its area.",
  };
}

function traceTargetTypeForObject(
  type: SceneObjectType,
): FieldWalkingTrackTargetType {
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
  if (mode === "Point") return <CircleDot size={14} />;
  if (mode === "Line") return <Route size={14} />;
  return <Pentagon size={14} />;
}

export default function FieldPlacementPanel({
  open,
  reconstruction,
  officerName = "",
  currentTimeSeconds = 0,
  initialTarget = null,
  initialCaptureMode = "Point",
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
  const [captureMode, setCaptureMode] =
    useState<FieldCaptureMode>(initialCaptureMode);
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
  const [traceReview, setTraceReview] =
    useState<ProcessedWalkingTrace | null>(null);
  const [guidancePlacementId, setGuidancePlacementId] =
    useState<string | null>(null);

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
      setCaptureMode(initialCaptureMode);
      setTargetKey(initialTargetKey);
      setTab(reconstruction.fieldCalibration ? "Capture" : "Calibration");
    });

    return () => {
      active = false;
    };
  }, [
    initialCaptureMode,
    initialTargetKey,
    open,
    reconstruction.fieldCalibration,
  ]);

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

  const saveQuickNorthUpCalibration = () => {
    if (!currentCoordinate) {
      setError("Wait for a live GPS reading before creating the quick calibration.");
      return;
    }

    const sceneWidthMetres = Math.max(10, reconstruction.scene.sceneWidthMetres);
    const sceneHeightMetres = Math.max(10, reconstruction.scene.sceneHeightMetres);
    const origin = localOffsetToCoordinate(
      currentCoordinate,
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

    const calibration = FieldPlacementService.createCalibration({
      origin: {
        ...origin,
        accuracyMetres: currentCoordinate.accuracyMetres,
      },
      directionReference: {
        ...directionReference,
        accuracyMetres: currentCoordinate.accuracyMetres,
      },
      widthReference: {
        ...widthReference,
        accuracyMetres: currentCoordinate.accuracyMetres,
      },
      sceneWidthMetres,
      sceneHeightMetres,
      createdBy: officerName || "RoadSafe field user",
    });

    onUpdate((current) => ({
      ...current,
      fieldCalibration: calibration,
    }));
    setCalibrationOrigin(calibration.origin);
    setCalibrationDirection(calibration.directionReference);
    setCalibrationWidth(calibration.widthReference ?? null);
    setError("");
    setMessage(
      "Provisional north-up calibration created from the live GPS reading. Capture can begin now; refine the calibration later for survey work.",
    );
    setTab("Capture");
  };

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

      onUpdate((current) => ({
        ...current,
        fieldCalibration: calibration,
      }));
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

      setMessage(
        `${selectedTargetOption.label} was updated from field walking data.`,
      );
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

  const closeFieldMode = (): void => {
    setIsTracing(false);
    setTracePaused(false);
    setRawTraceCoordinates([]);
    setTraceReview(null);
    setPendingCapture(null);
    setMessage("");
    setError("");
    onClose();
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
  const traceStatus = isTracing
    ? tracePaused
      ? "Paused"
      : "Recording"
    : traceReview
      ? "Review"
      : "Ready";

  return (
    <div className="field-mode-backdrop">
      <div className="field-mode-shell">
        <header className="field-mode-header">
          <div className="field-mode-heading">
            <p className="field-mode-eyebrow">RoadSafe AR · Field mode</p>
            <h2>Real-world scene capture</h2>
            <p>
              Capture calibrated positions, walked routes and evidence geometry,
              then review the GPS result before applying it to the reconstruction.
            </p>
          </div>

          <div className="field-mode-toolbar">
            <LocationAccuracyBadge
              accuracyMetres={currentCoordinate?.accuracyMetres ?? null}
            />
            <button
              type="button"
              onClick={geolocationIsWatching ? geolocation.stop : geolocation.start}
              className="field-mode-button"
            >
              <Radio size={14} />
              {geolocationIsWatching ? "Pause GPS" : "Start GPS"}
            </button>
            <button
              type="button"
              onClick={closeFieldMode}
              className="field-mode-button field-mode-button--primary"
            >
              <X size={14} /> Close field mode
            </button>
          </div>
        </header>

        <nav className="field-mode-tabs" aria-label="Field mode sections">
          {(["Capture", "Calibration", "History"] as FieldTab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`field-mode-tab ${tab === item ? "is-active" : ""}`}
            >
              {item}
            </button>
          ))}
        </nav>

        {(message || error || geolocationError) && (
          <div className="field-mode-message-stack">
            {message && (
              <div className="field-mode-alert">
                <CheckCircle2 size={15} />
                <span>{message}</span>
              </div>
            )}
            {(error || geolocationError) && (
              <div className="field-mode-alert field-mode-alert--error">
                <AlertTriangle size={15} />
                <span>{error || geolocationError}</span>
              </div>
            )}
          </div>
        )}

        <div className="field-mode-layout">
          <section className="field-mode-visual-column">
            <div className="field-mode-visual-grid">
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

            <div className="field-mode-telemetry">
              <div className="field-mode-metric">
                <span>Permission</span>
                <strong>{geolocationPermission}</strong>
              </div>
              <div className="field-mode-metric">
                <span>Live samples</span>
                <strong>{geolocationSampleCount}</strong>
              </div>
              <div className="field-mode-metric">
                <span>Coordinate</span>
                <strong className="is-coordinate">
                  {formatCoordinate(currentCoordinate)}
                </strong>
              </div>
              <div className="field-mode-metric">
                <span>Screen awake</span>
                <strong>
                  {wakeLock.locked
                    ? "Locked"
                    : wakeLock.supported
                      ? "Ready"
                      : "Unsupported"}
                </strong>
              </div>
            </div>
          </section>

          <aside className="field-mode-inspector">
            {tab === "Capture" && (
              <div>
                <div className="field-mode-panel-header">
                  <p className="field-mode-section-kicker">Capture workflow</p>
                  <h3>Choose, capture, review, confirm</h3>
                </div>

                <div className="field-mode-panel-body">
                  {!reconstruction.fieldCalibration && (
                    <div className="field-mode-alert field-mode-alert--warning">
                      <AlertTriangle size={15} />
                      <div>
                        <span>Calibrate the scene before placing field items.</span>
                        <div className="field-mode-button-row" style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={saveQuickNorthUpCalibration}
                            disabled={!currentCoordinate}
                            className="field-mode-button field-mode-button--primary"
                            style={{ flex: 1 }}
                          >
                            Quick GPS setup
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab("Calibration")}
                            className="field-mode-button"
                            style={{ flex: 1 }}
                          >
                            Full calibration
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="field-mode-control">
                    <span className="field-mode-label">
                      1. Select item or participant
                    </span>
                    <select
                      value={effectiveTargetKey}
                      onChange={(event) => {
                        setTargetKey(event.target.value);
                        setPendingCapture(null);
                        setRawTraceCoordinates([]);
                        setTraceReview(null);
                      }}
                    >
                      {availableTargets.length === 0 && (
                        <option value="">No compatible targets</option>
                      )}
                      {availableTargets.map((target) => (
                        <option key={target.key} value={target.key}>
                          {target.label} — {target.detail}
                        </option>
                      ))}
                    </select>
                    {selectedTargetOption && (
                      <small>{selectedTargetOption.detail}</small>
                    )}
                  </label>

                  <div className="field-mode-control">
                    <span className="field-mode-label">2. Choose capture method</span>
                    <div className="field-mode-method-grid">
                      {(["Point", "Line", "Boundary"] as FieldCaptureMode[]).map(
                        (mode) => {
                          const compatible = captureTargets.some((target) =>
                            target.modes.includes(mode),
                          );

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
                              className={`field-mode-method ${
                                captureMode === mode ? "is-active" : ""
                              }`}
                            >
                              {modeIcon(mode)}
                              {mode}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="field-mode-info-strip">
                    <strong>{modeCopy.title}</strong>
                    <p className="field-mode-copy">{modeCopy.description}</p>
                  </div>

                  {captureMode === "Point" ? (
                    <div className="field-mode-panel-body" style={{ padding: 0 }}>
                      <div className="field-mode-button-row">
                        <button
                          type="button"
                          onClick={prepareCurrentCapture}
                          disabled={
                            !currentCoordinate ||
                            !reconstruction.fieldCalibration ||
                            isAveraging
                          }
                          className="field-mode-button"
                          style={{ flex: 1 }}
                        >
                          Use current reading
                        </button>
                        <button
                          type="button"
                          onClick={() => void prepareAverageCapture()}
                          disabled={!reconstruction.fieldCalibration || isAveraging}
                          className="field-mode-button field-mode-button--primary"
                          style={{ flex: 1 }}
                        >
                          {isAveraging
                            ? `Stabilising ${Math.round(averageProgress * 100)}%`
                            : "Capture here · 5 sec"}
                        </button>
                      </div>

                      {isAveraging && (
                        <div className="field-mode-progress">
                          <div style={{ width: `${averageProgress * 100}%` }} />
                        </div>
                      )}

                      {pendingCapture && (
                        <div className="field-mode-review">
                          <div className="field-mode-review-header">
                            <h4>Point review</h4>
                            <span className="field-mode-badge">
                              {pendingCapture.sampleCount} samples
                            </span>
                          </div>

                          <dl className="field-mode-review-grid">
                            <div>
                              <dt>Average accuracy</dt>
                              <dd>
                                ±{pendingCapture.averageAccuracyMetres.toFixed(1)}m
                              </dd>
                            </div>
                            <div>
                              <dt>Estimated uncertainty</dt>
                              <dd>
                                ±
                                {(
                                  pendingCapture.estimatedUncertaintyMetres ??
                                  pendingCapture.averageAccuracyMetres
                                ).toFixed(1)}
                                m
                              </dd>
                            </div>
                            <div>
                              <dt>Observed spread</dt>
                              <dd>
                                {(pendingCapture.observedSpreadMetres ?? 0).toFixed(1)}m
                              </dd>
                            </div>
                            <div>
                              <dt>Rejected samples</dt>
                              <dd>{pendingCapture.rejectedSampleCount}</dd>
                            </div>
                          </dl>

                          <p className="field-mode-review-note">
                            {formatCoordinate(pendingCapture.coordinate)}
                          </p>

                          {pendingBounds && !pendingBounds.insideScene && (
                            <div className="field-mode-alert field-mode-alert--error">
                              <AlertTriangle size={14} />
                              <span>
                                Outside the calibrated scene. Recalibrate or expand
                                the scene before confirming. No silent edge clamping
                                will be applied.
                              </span>
                            </div>
                          )}

                          {pendingCapture.averageAccuracyMetres > 10 && (
                            <label className="field-mode-checkbox">
                              <input
                                type="checkbox"
                                checked={allowPoorAccuracy}
                                onChange={(event) =>
                                  setAllowPoorAccuracy(event.target.checked)
                                }
                              />
                              <span>
                                Accept this poor-accuracy position and preserve the
                                warning in the audit record.
                              </span>
                            </label>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={confirmPlacement}
                        disabled={
                          !selectedPointTarget ||
                          !pendingCapture ||
                          !pendingBounds?.insideScene
                        }
                        className="field-mode-button field-mode-button--primary field-mode-button--full"
                      >
                        <MapPin size={15} /> Confirm point placement
                      </button>
                    </div>
                  ) : (
                    <div className="field-mode-panel-body" style={{ padding: 0 }}>
                      <div className="field-mode-track-metrics">
                        <div>
                          <span>Raw points</span>
                          <strong>{rawTraceCoordinates.length}</strong>
                        </div>
                        <div>
                          <span>Raw distance</span>
                          <strong>
                            {calculateTrackDistanceMetres(
                              rawTraceCoordinates,
                            ).toFixed(1)}
                            m
                          </strong>
                        </div>
                        <div>
                          <span>Status</span>
                          <strong>{traceStatus}</strong>
                        </div>
                      </div>

                      {!isTracing && !traceReview && (
                        <button
                          type="button"
                          onClick={startWalkingTrace}
                          disabled={
                            !selectedTargetOption?.traceTargetType ||
                            !reconstruction.fieldCalibration
                          }
                          className="field-mode-button field-mode-button--primary field-mode-button--full"
                        >
                          <Play size={15} /> Start {captureMode.toLowerCase()} capture
                        </button>
                      )}

                      {isTracing && (
                        <div className="field-mode-button-row">
                          <button
                            type="button"
                            onClick={() => setTracePaused((value) => !value)}
                            className="field-mode-button"
                            style={{ flex: 1 }}
                          >
                            {tracePaused ? <Play size={14} /> : <Pause size={14} />}
                            {tracePaused ? "Resume" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={finishWalkingTrace}
                            className="field-mode-button field-mode-button--primary"
                            style={{ flex: 1 }}
                          >
                            <Square size={13} /> Finish and review
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRawTraceCoordinates((current) => current.slice(0, -1))
                            }
                            disabled={rawTraceCoordinates.length <= 1}
                            className="field-mode-button"
                            style={{ flex: 1 }}
                          >
                            <Undo2 size={14} /> Undo last
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsTracing(false);
                              setTracePaused(false);
                              setRawTraceCoordinates([]);
                              setTraceReview(null);
                            }}
                            className="field-mode-button field-mode-button--danger"
                            style={{ flex: 1 }}
                          >
                            <Trash2 size={14} /> Discard
                          </button>
                        </div>
                      )}

                      {traceReview && (
                        <div className="field-mode-review">
                          <div className="field-mode-review-header">
                            <h4>Geometry review</h4>
                            <span className="field-mode-badge">
                              {traceReview.captureMode}
                            </span>
                          </div>

                          <dl className="field-mode-review-grid">
                            <div>
                              <dt>Raw distance</dt>
                              <dd>{traceReview.rawDistanceMetres.toFixed(1)}m</dd>
                            </div>
                            <div>
                              <dt>Processed distance</dt>
                              <dd>
                                {traceReview.processedDistanceMetres.toFixed(1)}m
                              </dd>
                            </div>
                            <div>
                              <dt>Accepted / rejected</dt>
                              <dd>
                                {traceReview.acceptedCoordinates.length} / {" "}
                                {traceReview.rejectedCoordinates.length}
                              </dd>
                            </div>
                            <div>
                              <dt>Uncertainty</dt>
                              <dd>
                                ±{traceReview.estimatedUncertaintyMetres.toFixed(1)}m
                              </dd>
                            </div>
                            {traceReview.areaSquareMetres !== undefined && (
                              <div style={{ gridColumn: "1 / -1" }}>
                                <dt>Boundary area</dt>
                                <dd>{traceReview.areaSquareMetres.toFixed(1)}m²</dd>
                              </div>
                            )}
                          </dl>

                          <p className="field-mode-review-note">
                            {traceReview.processingMethod}
                          </p>

                          <div className="field-mode-button-row">
                            <button
                              type="button"
                              onClick={() => {
                                setRawTraceCoordinates([]);
                                setTraceReview(null);
                                setTraceStartedAt("");
                              }}
                              className="field-mode-button"
                              style={{ flex: 1 }}
                            >
                              Retry capture
                            </button>
                            <button
                              type="button"
                              onClick={saveWalkingTrace}
                              className="field-mode-button field-mode-button--primary"
                              style={{ flex: 1 }}
                            >
                              <Save size={14} /> Confirm geometry
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
                <div className="field-mode-panel-header">
                  <p className="field-mode-section-kicker">Scene reference</p>
                  <h3>GPS calibration</h3>
                </div>

                <div className="field-mode-panel-body">
                  <p className="field-mode-copy">
                    Capture the scene origin, then walk at least 3 metres along
                    the road direction. A longer baseline gives a more reliable
                    orientation.
                  </p>

                  <div className="field-mode-calibration-list">
                    {([
                      ["origin", "1. Scene origin", calibrationOrigin],
                      [
                        "direction",
                        "2. Road direction reference",
                        calibrationDirection,
                      ],
                      [
                        "width",
                        "3. Width-side reference (optional)",
                        calibrationWidth,
                      ],
                    ] as const).map(([kind, label, coordinate]) => (
                      <div key={kind} className="field-mode-calibration-item">
                        <div className="field-mode-calibration-row">
                          <div>
                            <h4>{label}</h4>
                            <p>{formatCoordinate(coordinate)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void captureCalibrationPoint(kind)}
                            disabled={isAveraging}
                            className="field-mode-button field-mode-button--primary"
                          >
                            Capture
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {reconstruction.fieldCalibration && (
                    <div className="field-mode-review">
                      <dl className="field-mode-review-grid">
                        <div>
                          <dt>Road bearing</dt>
                          <dd>
                            {reconstruction.fieldCalibration.rotationDegrees.toFixed(1)}°
                          </dd>
                        </div>
                        <div>
                          <dt>Direction baseline</dt>
                          <dd>
                            {reconstruction.fieldCalibration.directionReferenceDistanceMetres.toFixed(
                              1,
                            )}
                            m
                          </dd>
                        </div>
                      </dl>

                      {reconstruction.fieldCalibration
                        .directionReferenceDistanceMetres < 10 && (
                        <div className="field-mode-alert field-mode-alert--warning">
                          <AlertTriangle size={14} />
                          <span>
                            A baseline below 10m can produce unstable road
                            orientation. Use a longer reference when practical.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={saveCalibration}
                    disabled={!calibrationOrigin || !calibrationDirection}
                    className="field-mode-button field-mode-button--primary field-mode-button--full"
                  >
                    Save calibration
                  </button>
                </div>
              </div>
            )}

            {tab === "History" && (
              <div>
                <div className="field-mode-panel-header">
                  <p className="field-mode-section-kicker">Forensic audit</p>
                  <h3>Captured field data</h3>
                </div>

                <div className="field-mode-panel-body">
                  <div className="field-mode-history-stats">
                    <div className="field-mode-history-stat">
                      <span>Points</span>
                      <strong>{reconstruction.fieldPlacements.length}</strong>
                    </div>
                    <div className="field-mode-history-stat">
                      <span>Walked geometry</span>
                      <strong>{reconstruction.fieldWalkingTracks.length}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      downloadJson(
                        `${reconstruction.accidentId || "roadsafe"}-field-data.json`,
                        {
                          calibration: reconstruction.fieldCalibration,
                          placements: reconstruction.fieldPlacements,
                          walkingTracks: reconstruction.fieldWalkingTracks,
                        },
                      )
                    }
                    className="field-mode-button field-mode-button--full"
                  >
                    <FileClock size={14} /> Export field audit JSON
                  </button>

                  {guidance && (
                    <div className="field-mode-guidance">
                      <strong>Guidance to {guidance.placement.targetLabel}</strong>
                      <p>
                        {guidance.distanceMetres.toFixed(1)}m {guidance.directionLabel}
                        {" · "}bearing {guidance.bearingDegrees.toFixed(0)}°
                      </p>
                    </div>
                  )}

                  <div className="field-mode-history-list">
                    {[...reconstruction.fieldPlacements]
                      .reverse()
                      .map((placement) => (
                        <article key={placement.id} className="field-mode-history-card">
                          <div className="field-mode-history-header">
                            <div>
                              <h4>{placement.targetLabel}</h4>
                              <p>
                                {placement.method} · {placement.sampleCount} sample(s)
                                {" · "}±
                                {(
                                  placement.estimatedUncertaintyMetres ??
                                  placement.averageAccuracyMetres
                                ).toFixed(1)}
                                m
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setGuidancePlacementId(placement.id)}
                              className="field-mode-button"
                            >
                              Guide
                            </button>
                          </div>
                          <p>{formatCoordinate(placement.coordinate)}</p>
                        </article>
                      ))}

                    {[...reconstruction.fieldWalkingTracks]
                      .reverse()
                      .map((track) => (
                        <article key={track.id} className="field-mode-history-card">
                          <h4>{track.targetLabel}</h4>
                          <p>
                            {track.captureMode ?? "Line"} · {track.distanceMetres.toFixed(1)}m
                            {" · "}±
                            {(
                              track.estimatedUncertaintyMetres ??
                              track.averageAccuracyMetres
                            ).toFixed(1)}
                            m
                          </p>
                          {track.areaSquareMetres !== undefined && (
                            <p>Area {track.areaSquareMetres.toFixed(1)}m²</p>
                          )}
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
