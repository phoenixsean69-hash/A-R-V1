import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AccidentReconstruction } from "../../types/reconstruction";
import type {
  AveragedLocationResult,
  FieldPlacementTarget,
  FieldSceneCalibration,
  FieldWalkingTrackTargetType,
  GeoCoordinate,
} from "../../types/fieldPlacement";

import { useLiveGeolocation } from "../../hooks/useLiveGeolocation";
import { useScreenWakeLock } from "../../hooks/useScreenWakeLock";
import {
  FieldPlacementService,
} from "../../services/fieldPlacementService";
import {
  calculateTrackDistanceMetres,
  coordinateToScenePosition,
  getDistanceAndBearing,
  haversineDistanceMetres,
} from "../../utils/geographicCoordinates";
import { averageGeoCoordinates } from "../../utils/locationAveraging";
import { isTraceableSceneObjectType } from "../../utils/reconstructionGeometry";

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

type FieldTab = "Calibration" | "Place Item" | "Walk Trace" | "History";
type CalibrationPointKind = "origin" | "direction" | "width";

interface TraceTargetOption {
  key: string;
  targetType: FieldWalkingTrackTargetType;
  targetId: string;
  label: string;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function getTimestampMilliseconds(): number {
  return Date.now();
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
  const currentLocation = geolocation.current;
  const startLocation = geolocation.start;
  const stopLocation = geolocation.stop;
  const locationSupported = geolocation.supported;
  const getLocationSamplesSince = geolocation.getSamplesSince;

  const [tab, setTab] = useState<FieldTab>(() =>
    initialTarget && reconstruction.fieldCalibration
      ? "Place Item"
      : "Calibration",
  );
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

  const targets = useMemo(
    () => FieldPlacementService.getTargets(reconstruction),
    [reconstruction],
  );
  const [targetKey, setTargetKey] = useState(() =>
    initialTarget ? getTargetKey(initialTarget) : "",
  );

  const traceTargets = useMemo<TraceTargetOption[]>(() => {
    const participantTargets = reconstruction.vehicles.map((participant) => ({
      key: `ParticipantPath:${participant.id}`,
      targetType: "ParticipantPath" as const,
      targetId: participant.id,
      label: `Participant route — ${participant.name}`,
    }));

    const objectTargets = reconstruction.sceneObjects
      .filter((object) => isTraceableSceneObjectType(object.type))
      .map((object) => ({
        key: `${object.type.replaceAll(" ", "")}:${object.id}`,
        targetType:
          object.type === "Skid Mark"
            ? ("SkidMark" as const)
            : object.type === "Tyre Mark"
              ? ("TyreMark" as const)
              : ("RoadCrack" as const),
        targetId: object.id,
        label: `Walking trace — ${object.label}`,
      }));

    return [...participantTargets, ...objectTargets];
  }, [reconstruction.sceneObjects, reconstruction.vehicles]);

  const [traceTargetKey, setTraceTargetKey] = useState("");
  const [isTracing, setIsTracing] = useState(false);
  const [traceStartedAt, setTraceStartedAt] = useState("");
  const [traceCoordinates, setTraceCoordinates] = useState<GeoCoordinate[]>([]);
  const [guidancePlacementId, setGuidancePlacementId] = useState<string | null>(
    null,
  );

  const wakeLock = useScreenWakeLock(isAveraging || isTracing);

  const selectedTarget = useMemo<FieldPlacementTarget | null>(
    () =>
      targets.find((target) => getTargetKey(target) === targetKey) ?? null,
    [targetKey, targets],
  );

  const selectedTraceTarget = useMemo(
    () => traceTargets.find((target) => target.key === traceTargetKey) ?? null,
    [traceTargetKey, traceTargets],
  );

  const liveScenePosition = useMemo(() => {
    if (!currentLocation || !reconstruction.fieldCalibration) return null;
    return coordinateToScenePosition(
      currentLocation,
      reconstruction.fieldCalibration,
      false,
    );
  }, [currentLocation, reconstruction.fieldCalibration]);

  const traceScenePoints = useMemo(() => {
    if (!reconstruction.fieldCalibration) return [];
    return traceCoordinates.map((coordinate) =>
      coordinateToScenePosition(
        coordinate,
        reconstruction.fieldCalibration!,
        false,
      ),
    );
  }, [reconstruction.fieldCalibration, traceCoordinates]);

  const guidance = useMemo(() => {
    if (!currentLocation || !guidancePlacementId) return null;
    const placement = reconstruction.fieldPlacements.find(
      (item) => item.id === guidancePlacementId,
    );
    if (!placement) return null;
    return {
      placement,
      ...getDistanceAndBearing(currentLocation, placement.coordinate),
    };
  }, [
    currentLocation,
    guidancePlacementId,
    reconstruction.fieldPlacements,
  ]);

  useEffect(() => {
    if (!open) return;
    startLocation();
    return () => stopLocation();
  }, [open, startLocation, stopLocation]);

  useEffect(() => {
    if (!isTracing || !currentLocation || currentLocation.accuracyMetres > 25) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTraceCoordinates((current) => {
        const previous = current[current.length - 1];
        if (
          previous &&
          haversineDistanceMetres(previous, currentLocation) < 0.4
        ) {
          return current;
        }
        return [...current, currentLocation];
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentLocation, isTracing]);

  useEffect(() => {
    if (open) return;

    const timer = window.setTimeout(() => {
      setIsTracing(false);
      setTraceCoordinates([]);
      setPendingCapture(null);
      setMessage("");
      setError("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  const captureAverage = async (): Promise<AveragedLocationResult> => {
    if (!locationSupported) {
      throw new Error("This device or browser does not support geolocation.");
    }

    startLocation();
    const startedAt = getTimestampMilliseconds();
    setIsAveraging(true);
    setAverageProgress(0);

    try {
      for (let index = 1; index <= 20; index += 1) {
        await wait(250);
        setAverageProgress(index / 20);
      }

      const samples = getLocationSamplesSince(startedAt);
      if (samples.length === 0) {
        if (!currentLocation) {
          throw new Error(
            "No GPS samples were received. Move outdoors and keep the device still.",
          );
        }
        return createSingleCapture(currentLocation);
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
        `${kind === "origin" ? "Origin" : kind === "direction" ? "Road direction" : "Width reference"} captured using ${result.sampleCount} GPS sample(s).`,
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
      setMessage("Field scene calibration saved successfully.");
      setError("");
      setTab("Place Item");
    } catch (calibrationError) {
      setError(
        calibrationError instanceof Error
          ? calibrationError.message
          : "The field calibration could not be saved.",
      );
    }
  };

  const prepareCurrentCapture = (): void => {
    if (!geolocation.current) {
      setError("Wait until the device has a current GPS reading.");
      return;
    }
    setPendingCapture(createSingleCapture(geolocation.current));
    setAllowPoorAccuracy(false);
    setMessage("Current GPS reading prepared. Review it before confirming.");
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
        `Averaged location prepared from ${result.sampleCount} accepted sample(s).`,
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
    if (!selectedTarget) {
      setError("Select the participant point, object or evidence item to place.");
      return;
    }
    if (!pendingCapture) {
      setError("Prepare a current or averaged GPS reading first.");
      return;
    }
    if (
      pendingCapture.averageAccuracyMetres > 15 &&
      !allowPoorAccuracy
    ) {
      setError(
        "This reading has poor accuracy. Wait for a better signal, average again, or explicitly allow the reading with a warning.",
      );
      return;
    }

    try {
      onUpdate((current) =>
        FieldPlacementService.applyPlacement({
          reconstruction: current,
          target: selectedTarget,
          capture: pendingCapture,
          method:
            pendingCapture.sampleCount > 1 ? "Averaged GPS" : "Single GPS",
          confirmedBy: officerName,
          acceptedPoorAccuracy: allowPoorAccuracy,
        }),
      );
      onPlacementConfirmed?.(selectedTarget);
      setMessage(`${selectedTarget.label} was placed from the field GPS reading.`);
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
      setError("Calibrate the field scene before recording a walking trace.");
      setTab("Calibration");
      return;
    }
    if (!selectedTraceTarget) {
      setError("Select a participant route or traceable scene object.");
      return;
    }
    if (!geolocation.current) {
      setError("Wait until the device has a current GPS reading.");
      return;
    }

    setTraceCoordinates([geolocation.current]);
    setTraceStartedAt(new Date().toISOString());
    setIsTracing(true);
    setError("");
    setMessage("Walking trace started. Walk slowly along the required route.");
  };

  const stopWalkingTrace = (): void => {
    setIsTracing(false);
    setMessage(
      `Walking trace stopped with ${traceCoordinates.length} usable point(s).`,
    );
  };

  const saveWalkingTrace = (): void => {
    if (!selectedTraceTarget || traceCoordinates.length < 2) {
      setError("Record at least two usable GPS points before saving the trace.");
      return;
    }

    try {
      onUpdate((current) =>
        FieldPlacementService.applyWalkingTrack({
          reconstruction: current,
          targetType: selectedTraceTarget.targetType,
          targetId: selectedTraceTarget.targetId,
          targetLabel: selectedTraceTarget.label,
          coordinates: traceCoordinates,
          startedAt: traceStartedAt || new Date().toISOString(),
          recordedBy: officerName,
        }),
      );
      setMessage(`${selectedTraceTarget.label} was updated from the walking trace.`);
      setError("");
      setTraceCoordinates([]);
      setTraceStartedAt("");
    } catch (traceError) {
      setError(
        traceError instanceof Error
          ? traceError.message
          : "The walking trace could not be saved.",
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

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-[1500px] overflow-hidden rounded-3xl bg-gray-100 shadow-2xl sm:min-h-[calc(100vh-2rem)]">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
              RoadSafe AR Field Mode
            </p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">
              GPS Scene Placement
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Walk to a real scene position, stabilise the GPS reading, then confirm it in the 2D reconstruction.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LocationAccuracyBadge
              accuracyMetres={geolocation.current?.accuracyMetres ?? null}
            />
            <button
              type="button"
              onClick={geolocation.isWatching ? geolocation.stop : geolocation.start}
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-800 hover:bg-sky-100"
            >
              {geolocation.isWatching ? "Pause GPS" : "Start GPS"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-black"
            >
              Close Field Mode
            </button>
          </div>
        </header>

        <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <section className="space-y-4">
            <div className="grid gap-4 2xl:grid-cols-2">
              <FieldPlacementMap
                current={geolocation.current}
                calibration={calibrationForMap}
                placements={reconstruction.fieldPlacements}
                traceCoordinates={traceCoordinates}
                guidancePlacementId={guidancePlacementId}
              />

              <FieldSceneLivePreview
                reconstruction={reconstruction}
                currentTimeSeconds={currentTimeSeconds}
                liveScenePosition={liveScenePosition}
                selectedTarget={selectedTarget}
                traceScenePoints={traceScenePoints}
              />
            </div>

            <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                  Permission
                </p>
                <p className="mt-1 text-sm font-bold capitalize text-gray-900">
                  {geolocation.permission}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                  Samples
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {geolocation.sampleCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                  Current coordinates
                </p>
                <p className="mt-1 break-all text-xs font-bold text-gray-900">
                  {formatCoordinate(geolocation.current)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                  Converted 2D position
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {liveScenePosition
                    ? `X ${liveScenePosition.x.toFixed(1)}% · Y ${liveScenePosition.y.toFixed(1)}%`
                    : "Calibrate first"}
                </p>
              </div>
            </div>

            {guidance && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                      Return-to-point guidance
                    </p>
                    <h3 className="mt-1 font-black text-amber-950">
                      {guidance.placement.targetLabel}
                    </h3>
                    <p className="mt-2 text-sm text-amber-900">
                      Approximately <strong>{guidance.distanceMetres.toFixed(1)} metres</strong> to the {guidance.directionLabel} ({guidance.bearingDegrees.toFixed(0)}°).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuidancePlacementId(null)}
                    className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800"
                  >
                    Stop guidance
                  </button>
                </div>
              </div>
            )}

            {(geolocation.error || error || message || wakeLock.error) && (
              <div className="space-y-2">
                {(geolocation.error || error) && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                    {error || geolocation.error}
                  </div>
                )}
                {message && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    {message}
                  </div>
                )}
                {wakeLock.error && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    Wake lock unavailable: {wakeLock.error}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-2 border-b border-gray-200 sm:grid-cols-4">
              {(["Calibration", "Place Item", "Walk Trace", "History"] as FieldTab[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setTab(item);
                      setError("");
                      setMessage("");
                    }}
                    className={`px-3 py-3 text-xs font-black transition ${
                      tab === item
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>

            <div className="max-h-[760px] overflow-y-auto p-4 sm:p-5">
              {tab === "Calibration" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                    Stand at the virtual scene’s <strong>lower-left origin</strong>, then walk along the scene’s horizontal road direction and capture the second point. The optional width point tells the system which side of the road should face upward in the 2D editor.
                  </div>

                  {[
                    {
                      kind: "origin" as const,
                      title: "1. Scene origin",
                      coordinate: calibrationOrigin,
                      help: "Stand at the lower-left reference corner of the scene.",
                    },
                    {
                      kind: "direction" as const,
                      title: "2. Road direction",
                      coordinate: calibrationDirection,
                      help: "Walk at least 3 metres along the positive horizontal road direction.",
                    },
                    {
                      kind: "width" as const,
                      title: "3. Width direction (optional)",
                      coordinate: calibrationWidth,
                      help: "Stand on the side that should appear toward the top of the 2D scene.",
                    },
                  ].map((item) => (
                    <div key={item.kind} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-gray-950">{item.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-gray-500">{item.help}</p>
                          <p className="mt-2 break-all text-xs font-bold text-gray-800">
                            {formatCoordinate(item.coordinate)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isAveraging}
                          onClick={() => void captureCalibrationPoint(item.kind)}
                          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:bg-gray-400"
                        >
                          {item.coordinate ? "Recapture" : "Capture"}
                        </button>
                      </div>
                    </div>
                  ))}

                  {isAveraging && (
                    <div className="rounded-xl bg-purple-50 p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-800">
                        <span>Averaging GPS while the device remains still…</span>
                        <span>{Math.round(averageProgress * 100)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-purple-100">
                        <div
                          className="h-full rounded-full bg-purple-600 transition-all"
                          style={{ width: `${averageProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-xs">
                    <div>
                      <span className="font-bold text-gray-500">Scene width</span>
                      <p className="mt-1 text-lg font-black text-gray-950">
                        {reconstruction.scene.sceneWidthMetres}m
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-gray-500">Scene height</span>
                      <p className="mt-1 text-lg font-black text-gray-950">
                        {reconstruction.scene.sceneHeightMetres}m
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveCalibration}
                    disabled={!calibrationOrigin || !calibrationDirection || isAveraging}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    Save Field Calibration
                  </button>

                  {reconstruction.fieldCalibration && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
                      <p className="font-black">Active calibration</p>
                      <p>Road bearing: {reconstruction.fieldCalibration.rotationDegrees.toFixed(1)}°</p>
                      <p>Direction reference: {reconstruction.fieldCalibration.directionReferenceDistanceMetres.toFixed(1)}m</p>
                      <p>Y-axis side: {reconstruction.fieldCalibration.yAxisSide}</p>
                      <p>Captured by: {reconstruction.fieldCalibration.createdBy || "Not recorded"}</p>
                    </div>
                  )}
                </div>
              )}

              {tab === "Place Item" && (
                <div className="space-y-5">
                  {!reconstruction.fieldCalibration && (
                    <button
                      type="button"
                      onClick={() => setTab("Calibration")}
                      className="w-full rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm font-bold text-amber-900"
                    >
                      Calibration is required. Open the Calibration tab →
                    </button>
                  )}

                  <label className="block">
                    <span className="text-sm font-black text-gray-900">Placement target</span>
                    <select
                      value={targetKey}
                      onChange={(event) => {
                        setTargetKey(event.target.value);
                        setPendingCapture(null);
                      }}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                    >
                      <option value="">Select an item…</option>
                      {targets.map((target) => {
                        const key = getTargetKey(target);
                        return (
                          <option key={key} value={key}>
                            {target.label}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={prepareCurrentCapture}
                      disabled={!geolocation.current || !reconstruction.fieldCalibration}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-800 hover:bg-sky-100 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Use Current Reading
                    </button>
                    <button
                      type="button"
                      onClick={() => void prepareAverageCapture()}
                      disabled={isAveraging || !reconstruction.fieldCalibration}
                      className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-black text-white hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      Average for 5 Seconds
                    </button>
                  </div>

                  {isAveraging && (
                    <div className="rounded-xl bg-purple-50 p-4">
                      <p className="text-xs font-bold text-purple-800">
                        Keep the device still while readings are averaged.
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-purple-100">
                        <div
                          className="h-full bg-purple-600"
                          style={{ width: `${averageProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {pendingCapture && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-black text-gray-950">Prepared location</h3>
                        <LocationAccuracyBadge
                          accuracyMetres={pendingCapture.averageAccuracyMetres}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700">
                        <p><strong>Samples:</strong> {pendingCapture.sampleCount}</p>
                        <p><strong>Best accuracy:</strong> ±{pendingCapture.bestAccuracyMetres.toFixed(1)}m</p>
                        <p className="col-span-2 break-all"><strong>Coordinate:</strong> {formatCoordinate(pendingCapture.coordinate)}</p>
                        {reconstruction.fieldCalibration && (
                          <p className="col-span-2">
                            <strong>2D position:</strong>{" "}
                            {(() => {
                              const position = coordinateToScenePosition(
                                pendingCapture.coordinate,
                                reconstruction.fieldCalibration,
                                false,
                              );
                              return `X ${position.x.toFixed(1)}% · Y ${position.y.toFixed(1)}%`;
                            })()}
                          </p>
                        )}
                      </div>

                      {pendingCapture.averageAccuracyMetres > 15 && (
                        <label className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-900">
                          <input
                            type="checkbox"
                            checked={allowPoorAccuracy}
                            onChange={(event) => setAllowPoorAccuracy(event.target.checked)}
                            className="mt-0.5 h-4 w-4"
                          />
                          Allow this poor-accuracy reading and preserve the warning in the field audit record.
                        </label>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={confirmPlacement}
                    disabled={!selectedTarget || !pendingCapture || !reconstruction.fieldCalibration}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    Confirm Current Position
                  </button>
                </div>
              )}

              {tab === "Walk Trace" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm leading-6 text-purple-900">
                    Walk slowly along a skid mark, tyre mark, road crack or estimated participant route. GPS samples with worse than ±25m accuracy are excluded automatically.
                  </div>

                  <label className="block">
                    <span className="text-sm font-black text-gray-900">Trace target</span>
                    <select
                      value={traceTargetKey}
                      onChange={(event) => setTraceTargetKey(event.target.value)}
                      disabled={isTracing}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select a route or trace…</option>
                      {traceTargets.map((target) => (
                        <option key={target.key} value={target.key}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4 text-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500">Points</p>
                      <p className="mt-1 text-xl font-black text-gray-950">{traceCoordinates.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500">Distance</p>
                      <p className="mt-1 text-xl font-black text-gray-950">
                        {calculateTrackDistanceMetres(traceCoordinates).toFixed(1)}m
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500">Screen</p>
                      <p className="mt-1 text-sm font-black text-gray-950">
                        {wakeLock.locked ? "Kept awake" : wakeLock.supported ? "Ready" : "Manual"}
                      </p>
                    </div>
                  </div>

                  {!isTracing ? (
                    <button
                      type="button"
                      onClick={startWalkingTrace}
                      disabled={!selectedTraceTarget || !reconstruction.fieldCalibration}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700 disabled:bg-gray-400"
                    >
                      ● Start Walking Trace
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopWalkingTrace}
                      className="w-full animate-pulse rounded-xl bg-red-700 px-4 py-3 font-black text-white"
                    >
                      ■ Stop Trace Recording
                    </button>
                  )}

                  {!isTracing && traceCoordinates.length >= 2 && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={saveWalkingTrace}
                        className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
                      >
                        Save Trace to Reconstruction
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTraceCoordinates([]);
                          setTraceStartedAt("");
                        }}
                        className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
                      >
                        Discard Trace
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === "History" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs font-black uppercase text-blue-600">Captured points</p>
                      <p className="mt-1 text-3xl font-black text-blue-950">
                        {reconstruction.fieldPlacements.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-purple-50 p-4">
                      <p className="text-xs font-black uppercase text-purple-600">Walking traces</p>
                      <p className="mt-1 text-3xl font-black text-purple-950">
                        {reconstruction.fieldWalkingTracks.length}
                      </p>
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
                    className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-800 hover:bg-indigo-100"
                  >
                    Export Field Audit JSON
                  </button>

                  <div className="space-y-3">
                    {reconstruction.fieldPlacements.length === 0 && (
                      <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                        No field points have been confirmed yet.
                      </p>
                    )}

                    {[...reconstruction.fieldPlacements]
                      .sort(
                        (left, right) =>
                          new Date(right.confirmedAt).getTime() -
                          new Date(left.confirmedAt).getTime(),
                      )
                      .map((placement) => (
                        <article key={placement.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-black text-gray-950">{placement.targetLabel}</h3>
                              <p className="mt-1 text-xs font-semibold text-gray-500">
                                {placement.method} · {placement.sampleCount} sample(s) · ±{placement.averageAccuracyMetres.toFixed(1)}m
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setGuidancePlacementId(placement.id)}
                              className="rounded-lg bg-amber-100 px-3 py-2 text-[11px] font-black text-amber-800 hover:bg-amber-200"
                            >
                              Guide me there
                            </button>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700">
                            <div><dt className="font-bold text-gray-500">Coordinate</dt><dd className="break-all">{formatCoordinate(placement.coordinate)}</dd></div>
                            <div><dt className="font-bold text-gray-500">2D position</dt><dd>X {placement.scenePosition.x.toFixed(1)}% · Y {placement.scenePosition.y.toFixed(1)}%</dd></div>
                            <div><dt className="font-bold text-gray-500">Captured by</dt><dd>{placement.confirmedBy || "Not recorded"}</dd></div>
                            <div><dt className="font-bold text-gray-500">Time</dt><dd>{new Date(placement.confirmedAt).toLocaleString()}</dd></div>
                          </dl>
                          {placement.acceptedPoorAccuracy && (
                            <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">
                              This position was explicitly accepted despite poor reported GPS accuracy.
                            </p>
                          )}
                          {placement.manuallyAdjusted && (
                            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                              This item was manually adjusted in the 2D editor after GPS capture. The original GPS position remains preserved here.
                            </p>
                          )}
                        </article>
                      ))}
                  </div>

                  {reconstruction.fieldWalkingTracks.length > 0 && (
                    <div className="space-y-3 border-t border-gray-200 pt-5">
                      <h3 className="font-black text-gray-950">Saved walking traces</h3>
                      {reconstruction.fieldWalkingTracks.map((track) => (
                        <article key={track.id} className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-950">
                          <p className="font-black">{track.targetLabel}</p>
                          <p className="mt-1 text-xs">
                            {track.coordinates.length} GPS points · {track.distanceMetres.toFixed(1)}m · average accuracy ±{track.averageAccuracyMetres.toFixed(1)}m
                          </p>
                          <p className="mt-1 text-xs text-purple-700">
                            {new Date(track.completedAt).toLocaleString()} · {track.recordedBy || "Officer not recorded"}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="border-t border-gray-200 bg-white px-4 py-3 text-xs leading-5 text-gray-600 sm:px-6">
          Field GPS accuracy is device- and environment-dependent. The recorded accuracy radius, raw coordinate, sample count and placement method are preserved for every confirmed point. Use dedicated surveying or GNSS equipment where forensic precision is required.
        </footer>
      </div>
    </div>
  );
}
