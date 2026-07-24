import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { useLiveGeolocation } from "../../hooks/useLiveGeolocation";
import { averageGeoCoordinates } from "../../utils/locationAveraging";

import { AccidentCaseService } from "../../services/accidentCaseService";
import { RoadLayoutDetectionService } from "../../services/roadLayoutDetectionService";
import { RealSceneExtractionService } from "../../services/realSceneExtractionService";

import type { AccidentCaseFormValues } from "../../types/accidentCase";
import type {
  RealSceneAreaSelection,
  RealSceneGeometry,
} from "../../types/realSceneGeometry";
import type {
  RoadDetectionCoordinate,
  RoadDetectionResult,
} from "../../types/roadLayoutDetection";
import {
  createDefaultGroundSceneSettings,
  createDefaultRoadSceneSettings,
  usesGeneratedRoad,
  type DrivingSide,
  type GroundSurfaceType,
  type RoadLayoutType,
  type RoadSceneSettings,
  type SceneEnvironmentType,
  type TrafficControlType,
} from "../../types/reconstruction";

import RoadSceneEnvironment from "../reconstruction/RoadSceneEnvironment";
import RoadDetectionPreview from "./RoadDetectionPreview";
import RoadLocationMap, {
  type RoadLocationMapHandle,
} from "./RoadLocationMap";

import "./NewCaseRoadWizard.css";

interface NewCaseRoadWizardProps {
  initialValues: AccidentCaseFormValues;
}

type WizardStep = 1 | 2 | 3 | 4;

interface BasicCaseErrors {
  caseNumber?: string;
  title?: string;
  accidentDate?: string;
  accidentTime?: string;
}

const ROAD_LAYOUTS: RoadLayoutType[] = [
  "Straight Road",
  "T-Junction",
  "Four-way Intersection",
  "Roundabout",
  "Pedestrian Crossing",
  "Transport Terminus",
];

const TRAFFIC_CONTROLS: TrafficControlType[] = [
  "None",
  "Traffic Lights",
  "Stop Signs",
  "Give Way Signs",
];

const SCENE_ENVIRONMENTS: Array<{
  value: SceneEnvironmentType;
  title: string;
  description: string;
}> = [
  {
    value: "Road / Junction",
    title: "Road / Junction",
    description: "Detect and generate road, lane, kerb and traffic-control geometry.",
  },
  {
    value: "Open Ground",
    title: "Open Ground",
    description: "Keep the real location and terrain, but generate no road or junction.",
  },
  {
    value: "Mixed Site",
    title: "Mixed Site",
    description: "Use a road plus surrounding field, verge, yard or other open ground.",
  },
  {
    value: "Custom Site",
    title: "Custom Site",
    description: "Start with real-location ground and add every structure manually or by GPS.",
  },
];

const GROUND_SURFACES: GroundSurfaceType[] = [
  "Unclassified Ground",
  "Firm Soil",
  "Loose Soil",
  "Grass",
  "Gravel",
  "Sand",
  "Mud",
  "Concrete",
  "Paved Yard",
  "Mixed Surface",
];

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function coordinateLabel(coordinate: RoadDetectionCoordinate): string {
  return `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
}

function getAccuracyTone(accuracyMetres: number): string {
  if (accuracyMetres <= 5) return "bg-emerald-100 text-emerald-800";
  if (accuracyMetres <= 10) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function getConfidenceTone(confidence: number): string {
  if (confidence >= 0.8) return "bg-emerald-100 text-emerald-800";
  if (confidence >= 0.6) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function NewCaseRoadWizard({
  initialValues,
}: NewCaseRoadWizardProps) {
  const navigate = useNavigate();
  const geolocation = useLiveGeolocation();

  const [step, setStep] = useState<WizardStep>(1);
  const [values, setValues] = useState<AccidentCaseFormValues>(initialValues);
  const [errors, setErrors] = useState<BasicCaseErrors>({});

  const [selectedCoordinate, setSelectedCoordinate] =
    useState<RoadDetectionCoordinate | null>(null);
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [averaging, setAveraging] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const locationMapRef = useRef<RoadLocationMapHandle | null>(null);
  const wizardRootRef = useRef<HTMLDivElement | null>(null);
  const previousSceneAnchorRef = useRef<string | null>(null);
  const [sceneArea, setSceneArea] =
    useState<RealSceneAreaSelection | null>(null);
  const [realSceneGeometry, setRealSceneGeometry] =
    useState<RealSceneGeometry | null>(null);
  const [extractingScene, setExtractingScene] = useState(false);
  const [sceneGeometryConfirmed, setSceneGeometryConfirmed] = useState(false);
  const [sceneExtractionMessage, setSceneExtractionMessage] = useState("");

  const [selectedEnvironment, setSelectedEnvironment] =
    useState<SceneEnvironmentType | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<RoadDetectionResult | null>(null);
  const [sceneSettings, setSceneSettings] =
    useState<RoadSceneSettings | null>(null);
  const [detectingRoad, setDetectingRoad] = useState(false);
  const [roadError, setRoadError] = useState("");
  const [creating, setCreating] = useState(false);

  const liveCoordinate = geolocation.current;

  useEffect(() => {
    if (selectedCoordinate || !liveCoordinate) return;

    const nextCoordinate = {
      latitude: liveCoordinate.latitude,
      longitude: liveCoordinate.longitude,
      accuracyMetres: liveCoordinate.accuracyMetres,
      capturedAt: liveCoordinate.capturedAt,
    };
    const timer = window.setTimeout(() => {
      setSelectedCoordinate((current) => current ?? nextCoordinate);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [liveCoordinate, selectedCoordinate]);

  useEffect(() => {
    const identity = selectedCoordinate
      ? `${selectedCoordinate.latitude.toFixed(7)}:${selectedCoordinate.longitude.toFixed(7)}`
      : null;

    if (
      previousSceneAnchorRef.current &&
      identity &&
      previousSceneAnchorRef.current !== identity
    ) {
      // A changed accident anchor invalidates the selected scene area.
      setSceneArea(null);
      setRealSceneGeometry(null);
      setSceneGeometryConfirmed(false);
      setSelectedEnvironment(null);
      setDetectionResult(null);
      setSceneSettings(null);
      setSceneExtractionMessage(
        "The accident anchor changed. Select and extract the scene area again.",
      );
    }

    previousSceneAnchorRef.current = identity;
  }, [selectedCoordinate]);

  useEffect(() => {
    // RoadSafe case-wizard page shell: theme the route container as one workspace.
    const rootElement = wizardRootRef.current;
    const pageElement = rootElement?.parentElement ?? null;
    document.body.classList.add("roadsafe-case-wizard-open");
    pageElement?.classList.add("roadsafe-case-page-shell");

    return () => {
      document.body.classList.remove("roadsafe-case-wizard-open");
      pageElement?.classList.remove("roadsafe-case-page-shell");
    };
  }, []);

  const locationDisplay = useMemo(() => {
    if (!selectedCoordinate) return "No accident position confirmed yet.";
    return `${coordinateLabel(selectedCoordinate)} · ±${selectedCoordinate.accuracyMetres.toFixed(
      1,
    )} m`;
  }, [selectedCoordinate]);

  const updateValue = <Key extends keyof AccidentCaseFormValues>(
    field: Key,
    value: AccidentCaseFormValues[Key],
  ) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const validateBasicDetails = (): boolean => {
    const nextErrors: BasicCaseErrors = {};

    if (!values.caseNumber.trim()) {
      nextErrors.caseNumber = "Case number is required.";
    }
    if (!values.title.trim()) {
      nextErrors.title = "Case title is required.";
    }
    if (!values.accidentDate) {
      nextErrors.accidentDate = "Accident date is required.";
    }
    if (!values.accidentTime) {
      nextErrors.accidentTime = "Accident time is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const startLocationTracking = () => {
    geolocation.clearSamples();
    geolocation.start();
    setLocationMessage(
      "Location tracking started. Remain outdoors and still for a better reading.",
    );
  };

  const averageLocation = async () => {
    setAveraging(true);
    setLocationMessage("Collecting high-accuracy location samples for 5 seconds...");

    geolocation.clearSamples();
    geolocation.start();
    const startedAt = Date.now();

    try {
      await delay(5_000);
      const samples = geolocation.getSamplesSince(startedAt);
      const usableSamples =
        samples.length > 0
          ? samples
          : geolocation.current
            ? [geolocation.current]
            : [];

      if (usableSamples.length === 0) {
        throw new Error(
          "No location samples were received. Check browser permission and device location services.",
        );
      }

      const result = averageGeoCoordinates(usableSamples);
      setSelectedCoordinate({
        latitude: result.coordinate.latitude,
        longitude: result.coordinate.longitude,
        accuracyMetres: result.averageAccuracyMetres,
        capturedAt: result.coordinate.capturedAt,
      });

      setLocationMessage(
        `Averaged ${result.sampleCount} sample(s). Best accuracy: ±${result.bestAccuracyMetres.toFixed(
          1,
        )} m.`,
      );
    } catch (error) {
      setLocationMessage(
        error instanceof Error ? error.message : "Location averaging failed.",
      );
    } finally {
      setAveraging(false);
    }
  };

  const useManualCoordinate = () => {
    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setLocationMessage("Enter a valid latitude and longitude.");
      return;
    }

    setSelectedCoordinate({
      latitude,
      longitude,
      accuracyMetres: 10,
      capturedAt: new Date().toISOString(),
    });
    setLocationMessage("Manual coordinate applied. Confirm it on the map.");
  };

  const extractSelectedScene = async () => {
    if (!sceneArea) {
      setSceneExtractionMessage(
        "Select the accident-scene area on the map first.",
      );
      return;
    }

    setExtractingScene(true);
    setSceneExtractionMessage(
      "Capturing the selected map area and extracting its real geometry…",
    );

    try {
      const snapshot =
        await locationMapRef.current?.captureSelectedAreaSnapshot();
      const result = await RealSceneExtractionService.extract(
        sceneArea,
        snapshot ?? undefined,
      );
      setRealSceneGeometry(result.geometry);
      setSceneGeometryConfirmed(false);
      setSelectedEnvironment(null);
      setDetectionResult(null);
      setSceneSettings(null);
      setSceneExtractionMessage(
        `Scene ready: ${result.geometry.roads.length} road section(s), ${result.geometry.buildings.length} building footprint(s), ${result.geometry.vegetation?.length ?? 0} vegetation item(s), ${result.geometry.landCover?.length ?? 0} mapped land-cover area(s), ${result.geometry.sceneWidthMetres.toFixed(1)} × ${result.geometry.sceneHeightMetres.toFixed(1)} m.`,
      );
    } catch (error) {
      setRealSceneGeometry(null);
      setSceneGeometryConfirmed(false);
      setSceneExtractionMessage(
        error instanceof Error
          ? error.message
          : "The selected scene could not be extracted.",
      );
    } finally {
      setExtractingScene(false);
    }
  };

  const detectRoadLayout = async (
    forceRefresh: boolean,
    environment: SceneEnvironmentType = selectedEnvironment ?? "Road / Junction",
  ) => {
    if (!selectedCoordinate) return;

    const detectionCoordinate = sceneArea?.centre ?? selectedCoordinate;

    setDetectingRoad(true);
    setRoadError("");

    try {
      const result = await RoadLayoutDetectionService.detectAtCoordinate(
        detectionCoordinate,
        80,
        forceRefresh,
      );
      setDetectionResult(result);
      setSceneSettings({
        ...result.detection.suggestedSceneSettings,
        sceneEnvironment: environment,
        groundSurface: "Unclassified Ground",
        sceneWidthMetres:
          realSceneGeometry?.sceneWidthMetres ??
          result.detection.suggestedSceneSettings.sceneWidthMetres,
        sceneHeightMetres:
          realSceneGeometry?.sceneHeightMetres ??
          result.detection.suggestedSceneSettings.sceneHeightMetres,
        realSceneGeometry: realSceneGeometry ?? undefined,
      });

      const detectedLocation = result.detection.address.displayName.trim();
      if (detectedLocation) {
        setValues((current) => ({
          ...current,
          location: detectedLocation,
        }));
      }
    } catch (error) {
      setRoadError(
        error instanceof Error
          ? error.message
          : "Road-layout detection failed. Select the layout manually.",
      );
    } finally {
      setDetectingRoad(false);
    }
  };

  const selectEnvironment = (sceneEnvironment: SceneEnvironmentType) => {
    setSelectedEnvironment(sceneEnvironment);
    setDetectionResult(null);
    setRoadError("");

    const sharedRealScene = realSceneGeometry
      ? {
          sceneWidthMetres: realSceneGeometry.sceneWidthMetres,
          sceneHeightMetres: realSceneGeometry.sceneHeightMetres,
          realSceneGeometry,
        }
      : {};

    if (sceneEnvironment === "Open Ground" || sceneEnvironment === "Custom Site") {
      setSceneSettings({
        ...createDefaultGroundSceneSettings(sceneEnvironment),
        ...sharedRealScene,
      });
      return;
    }

    setSceneSettings({
      ...createDefaultRoadSceneSettings(),
      ...sharedRealScene,
      sceneEnvironment,
      groundSurface: "Unclassified Ground",
    });
    void detectRoadLayout(false, sceneEnvironment);
  };

  const createCaseAndScene = () => {
    if (!selectedCoordinate || !sceneSettings || !realSceneGeometry || !sceneGeometryConfirmed) return;

    setCreating(true);

    try {
      let confirmedDetection = undefined;
      if (usesGeneratedRoad(sceneSettings)) {
        const baseDetection =
          detectionResult?.detection ??
          RoadLayoutDetectionService.createManualDetection(
            selectedCoordinate,
            {
              roadLayout: sceneSettings.roadLayout,
              laneCount: sceneSettings.laneCount,
              roadRotation: sceneSettings.roadRotation,
              drivingSide: sceneSettings.drivingSide,
              trafficControl: sceneSettings.trafficControl,
              speedLimitKmh: sceneSettings.speedLimitKmh,
              showPedestrianCrossing: sceneSettings.showPedestrianCrossing,
            },
            undefined,
            roadError || "The officer selected the road layout manually.",
          );

        confirmedDetection = RoadLayoutDetectionService.applyOfficerCorrections(
          baseDetection,
          sceneSettings,
          values.investigatingOfficer,
        );
      }

      const finalLocation =
        values.location.trim() ||
        confirmedDetection?.address.displayName ||
        coordinateLabel(selectedCoordinate);

      const saved = AccidentCaseService.createWithSceneEnvironment(
        {
          ...values,
          caseNumber: values.caseNumber.trim(),
          title: values.title.trim(),
          location: finalLocation,
          junctionId: values.junctionId.trim(),
          investigatingOfficer: values.investigatingOfficer.trim(),
          policeStation: values.policeStation.trim(),
          summary: values.summary.trim(),
          status: "Open",
        },
        selectedCoordinate,
        sceneSettings,
        confirmedDetection,
      );

      navigate(`/cases/${saved.id}/reconstruction`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={wizardRootRef} className="roadsafe-case-wizard">
      <WizardProgress step={step} />

      {step === 2 && (
        <div className="roadsafe-wizard-command" role="status">
          <span className="roadsafe-wizard-command__number">1–2</span>
          <div>
            <strong>Mark the accident spot, then select the complete scene area.</strong>
            <p>Place the red accident marker first. Next, draw the blue boundary around everything that must appear in the reconstruction. Only that selected area will be captured, extracted and used in 2D and 3D.</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeading
            eyebrow="Step 1 of 4"
            title="Record the basic accident-case details"
            description="The accident location will be detected from the officer’s device in the next step."
          />

          <div className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Case number" error={errors.caseNumber}>
                <input
                  value={values.caseNumber}
                  onChange={(event) =>
                    updateValue("caseNumber", event.target.value)
                  }
                  className={inputClass(Boolean(errors.caseNumber))}
                />
              </Field>

              <Field label="Initial status">
                <input
                  value="Open"
                  readOnly
                  className={`${inputClass(false)} bg-slate-50 text-slate-500`}
                />
              </Field>
            </div>

            <Field label="Case title" error={errors.title}>
              <input
                value={values.title}
                onChange={(event) => updateValue("title", event.target.value)}
                className={inputClass(Boolean(errors.title))}
                placeholder="Example: Two-vehicle collision near Bindura CBD"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Accident date" error={errors.accidentDate}>
                <input
                  type="date"
                  value={values.accidentDate}
                  onChange={(event) =>
                    updateValue("accidentDate", event.target.value)
                  }
                  className={inputClass(Boolean(errors.accidentDate))}
                />
              </Field>

              <Field label="Accident time" error={errors.accidentTime}>
                <input
                  type="time"
                  value={values.accidentTime}
                  onChange={(event) =>
                    updateValue("accidentTime", event.target.value)
                  }
                  className={inputClass(Boolean(errors.accidentTime))}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Investigating officer">
                <input
                  value={values.investigatingOfficer}
                  onChange={(event) =>
                    updateValue("investigatingOfficer", event.target.value)
                  }
                  className={inputClass(false)}
                  placeholder="Officer name"
                />
              </Field>

              <Field label="Police station">
                <input
                  value={values.policeStation}
                  onChange={(event) =>
                    updateValue("policeStation", event.target.value)
                  }
                  className={inputClass(false)}
                  placeholder="Example: Bindura Central Police Station"
                />
              </Field>
            </div>

            <Field label="Initial case summary">
              <textarea
                rows={5}
                value={values.summary}
                onChange={(event) => updateValue("summary", event.target.value)}
                className={`${inputClass(false)} resize-y`}
                placeholder="Describe the reported accident and initial observations."
              />
            </Field>
          </div>

          <WizardActions>
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (validateBasicDetails()) setStep(2);
              }}
              className={primaryButtonClass}
            >
              Continue to Location Detection
            </button>
          </WizardActions>
        </section>
      )}

      {step === 2 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeading
            eyebrow="Step 2 of 4"
            title="Mark the accident spot and select the complete scene area"
            description="GPS may centre the map, but the officer remains in control: mark the collision spot, then draw the exact boundary that RoadSafe must reproduce."
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-black text-slate-900">Device location</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      geolocation.current
                        ? getAccuracyTone(geolocation.current.accuracyMetres)
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {geolocation.current
                      ? `±${geolocation.current.accuracyMetres.toFixed(1)} m`
                      : geolocation.permission}
                  </span>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-bold text-slate-500">Live coordinate</dt>
                    <dd className="mt-1 font-mono text-slate-900">
                      {geolocation.current
                        ? `${geolocation.current.latitude.toFixed(
                            6,
                          )}, ${geolocation.current.longitude.toFixed(6)}`
                        : "Waiting for location permission"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Samples</dt>
                    <dd className="mt-1 text-slate-900">
                      {geolocation.sampleCount}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={startLocationTracking}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
                  >
                    {geolocation.isWatching
                      ? "Location Tracking Active"
                      : "Allow Location Access"}
                  </button>

                  <button
                    type="button"
                    disabled={averaging}
                    onClick={() => void averageLocation()}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {averaging ? "Averaging for 5 seconds..." : "Average Location for 5 Seconds"}
                  </button>

                  {geolocation.current && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCoordinate({
                          latitude: geolocation.current!.latitude,
                          longitude: geolocation.current!.longitude,
                          accuracyMetres: geolocation.current!.accuracyMetres,
                          capturedAt: geolocation.current!.capturedAt,
                        })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Use Current Reading
                    </button>
                  )}
                </div>

                {(geolocation.error || locationMessage) && (
                  <p
                    className={`mt-4 rounded-xl p-3 text-xs font-semibold ${
                      geolocation.error
                        ? "bg-red-50 text-red-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {geolocation.error || locationMessage}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-black text-slate-900">Manual coordinates</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Use this when browser location is unavailable or when testing on a computer.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <input
                    value={manualLatitude}
                    onChange={(event) => setManualLatitude(event.target.value)}
                    className={inputClass(false)}
                    placeholder="Latitude, e.g. -17.311842"
                  />
                  <input
                    value={manualLongitude}
                    onChange={(event) => setManualLongitude(event.target.value)}
                    className={inputClass(false)}
                    placeholder="Longitude, e.g. 31.345472"
                  />
                </div>

                <button
                  type="button"
                  onClick={useManualCoordinate}
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Apply Manual Coordinate
                </button>
              </div>
            </div>

            <div>
              <RoadLocationMap
                ref={locationMapRef}
                coordinate={selectedCoordinate}
                currentCoordinate={geolocation.current}
                editable
                areaSelection={sceneArea}
                realSceneGeometry={realSceneGeometry}
                onAreaSelectionChange={(selection) => {
                  setSceneArea(selection);
                  setRealSceneGeometry(null);
                  setSceneGeometryConfirmed(false);
                  setSelectedEnvironment(null);
                  setDetectionResult(null);
                  setSceneSettings(null);
                  setSceneExtractionMessage(
                    selection
                      ? "Scene boundary selected. This exact area—not a larger generated map—will become the shared 2D/3D reconstruction scene."
                      : "Select the accident-scene area on the map.",
                  );
                }}
                onCoordinateChange={(coordinate) => {
                  setSelectedCoordinate(coordinate);
                  setLocationMessage(
                    "The accident pin was adjusted manually on the map.",
                  );
                }}
              />

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-black text-blue-950">Accident scene anchor</p>
                  <p className="mt-1 break-all font-mono text-sm text-blue-800">
                    {locationDisplay}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-blue-700">
                    The red pin is a reference point. The blue selected boundary—not the pin—defines the reconstruction scene.
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-sky-950">Selected-area scene engine</p>
                      <p className="mt-1 text-xs leading-5 text-sky-800">
                        Capture this exact area and preserve its real road curves, paths and mapped structures.
                      </p>
                    </div>
                    {realSceneGeometry && (
                      <span
                        className={sceneGeometryConfirmed
                          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800"}
                      >
                        {sceneGeometryConfirmed ? "Confirmed" : "Review"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!sceneArea || extractingScene}
                    onClick={() => void extractSelectedScene()}
                    className="mt-4 w-full rounded-xl bg-blue-800 px-4 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {extractingScene
                      ? "Extracting real scene geometry…"
                      : realSceneGeometry
                        ? "Re-extract Selected Scene"
                        : "Capture and Extract Selected Scene"}
                  </button>

                  {realSceneGeometry && (
                    <button
                      type="button"
                      onClick={() => {
                        setSceneGeometryConfirmed(true);
                        setSceneExtractionMessage(
                          "The officer confirmed the extracted overlay for scene creation.",
                        );
                      }}
                      className={sceneGeometryConfirmed
                        ? "mt-2 w-full rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-800 transition"
                        : "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"}
                    >
                      {sceneGeometryConfirmed
                        ? "Extracted Geometry Confirmed"
                        : "Confirm Extracted Geometry"}
                    </button>
                  )}

                  <p className="mt-3 text-xs font-semibold leading-5 text-sky-800">
                    {sceneExtractionMessage ||
                      "Draw a blue scene boundary on the map before continuing."}
                  </p>

                  {realSceneGeometry && (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div className="rounded-lg bg-white/75 p-2">
                        <dt className="font-bold text-slate-500">Scene size</dt>
                        <dd className="mt-1 font-black">
                          {realSceneGeometry.sceneWidthMetres.toFixed(1)} × {realSceneGeometry.sceneHeightMetres.toFixed(1)} m
                        </dd>
                      </div>
                      <div className="rounded-lg bg-white/75 p-2">
                        <dt className="font-bold text-slate-500">Geometry</dt>
                        <dd className="mt-1 font-black">
                          {realSceneGeometry.roads.length} roads · {realSceneGeometry.buildings.length} buildings · {realSceneGeometry.vegetation?.length ?? 0} vegetation · {realSceneGeometry.landCover?.length ?? 0} land cover
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>
            </div>
          </div>

          <WizardActions>
            <button
              type="button"
              onClick={() => setStep(1)}
              className={secondaryButtonClass}
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!selectedCoordinate || !realSceneGeometry || !sceneGeometryConfirmed}
              onClick={() => {
                setSelectedEnvironment(null);
                setDetectionResult(null);
                setSceneSettings(null);
                setStep(3);
              }}
              className={primaryButtonClass}
            >
              Choose Scene Environment →
            </button>
          </WizardActions>
        </section>
      )}

      {step === 3 && selectedCoordinate && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeading
            eyebrow="Step 3 of 4"
            title="Choose the real-world scene environment"
            description="The selected-area geometry remains the source of truth. Environment choices control how that verified geometry is presented—not which junction template is invented."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SCENE_ENVIRONMENTS.map((environment) => {
              const selected = selectedEnvironment === environment.value;
              return (
                <button
                  key={environment.value}
                  type="button"
                  onClick={() => selectEnvironment(environment.value)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    selected
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white"
                  }`}
                >
                  <span className="block text-sm font-black text-slate-950">
                    {environment.title}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-600">
                    {environment.description}
                  </span>
                  <span
                    className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      selected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {selected ? "Selected" : "Choose"}
                  </span>
                </button>
              );
            })}
          </div>

          {sceneSettings && selectedEnvironment && (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Real scene anchor
                  </p>
                  <p className="mt-2 break-all font-mono text-sm font-bold text-slate-900">
                    {coordinateLabel(selectedCoordinate)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Reported GPS accuracy ±{selectedCoordinate.accuracyMetres.toFixed(1)} m.
                    This coordinate remains the terrain and field-placement anchor even when no road is generated.
                  </p>
                </div>

                <SelectField<GroundSurfaceType>
                  label="Ground classification"
                  value={sceneSettings.groundSurface}
                  options={GROUND_SURFACES}
                  onChange={(groundSurface) =>
                    setSceneSettings((current) =>
                      current ? { ...current, groundSurface } : current,
                    )
                  }
                />
              </div>

              {!usesGeneratedRoad(sceneSettings) && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <NeutralScenePreview
                    settings={sceneSettings}
                    coordinate={selectedCoordinate}
                  />
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <p className="font-black text-blue-950">
                      Ground-only scene confirmed
                    </p>
                    <p className="mt-2 text-sm leading-6 text-blue-800">
                      Road detection and lane snapping are disabled. The scene still uses
                      the real GPS location, north orientation, metre scale and optional
                      elevation terrain.
                    </p>
                    <ul className="mt-4 space-y-2 text-xs leading-5 text-blue-800">
                      <li>• Place objects at real GPS points.</li>
                      <li>• Walk curved lines such as drag marks or trails.</li>
                      <li>• Walk boundaries for debris, spills or damaged areas.</li>
                      <li>• Add roads later only when the officer confirms one.</li>
                    </ul>
                  </div>
                </div>
              )}

              {usesGeneratedRoad(sceneSettings) && detectingRoad && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                  <p className="mt-4 font-black text-blue-950">
                    Fetching nearby road data...
                  </p>
                  <p className="mt-2 text-sm text-blue-700">
                    The selected environment permits a generated road, so RoadSafe is reading nearby geometry for officer review.
                  </p>
                </div>
              )}

              {usesGeneratedRoad(sceneSettings) && roadError && !detectionResult && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                  <p className="font-black text-amber-950">
                    Automatic road detection was unavailable
                  </p>
                  <p className="mt-2 text-sm text-amber-800">{roadError}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void detectRoadLayout(true)}
                      className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-black text-white"
                    >
                      Retry Detection
                    </button>
                    <span className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-900">
                      Manual road settings remain available below
                    </span>
                  </div>
                </div>
              )}

              {usesGeneratedRoad(sceneSettings) && detectionResult && (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <SummaryMetric
                      label="Suggested layout"
                      value={detectionResult.detection.detectedLayout}
                    />
                    <SummaryMetric
                      label="Confidence"
                      value={`${Math.round(
                        detectionResult.detection.confidence * 100,
                      )}% · ${detectionResult.detection.confidenceLabel}`}
                      toneClass={getConfidenceTone(
                        detectionResult.detection.confidence,
                      )}
                    />
                    <SummaryMetric
                      label="Road branches"
                      value={String(detectionResult.detection.branchCount)}
                    />
                    <SummaryMetric
                      label="Mapped roads"
                      value={String(detectionResult.detection.roads.length)}
                    />
                  </div>

                  <RoadDetectionPreview
                    detection={detectionResult.detection}
                    sceneSettings={sceneSettings}
                  />
                </>
              )}

              {usesGeneratedRoad(sceneSettings) && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <div>
                    <h3 className="font-black text-slate-900">
                      Confirm or correct the generated road
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      The selected real coordinate is authoritative. These road values are editable suggestions only.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <SelectField<RoadLayoutType>
                      label="Road layout"
                      value={sceneSettings.roadLayout}
                      options={ROAD_LAYOUTS}
                      onChange={(roadLayout) =>
                        setSceneSettings((current) =>
                          current ? { ...current, roadLayout } : current,
                        )
                      }
                    />
                    <SelectField<DrivingSide>
                      label="Driving side"
                      value={sceneSettings.drivingSide}
                      options={["Left", "Right"]}
                      onChange={(drivingSide) =>
                        setSceneSettings((current) =>
                          current ? { ...current, drivingSide } : current,
                        )
                      }
                    />
                    <SelectField<TrafficControlType>
                      label="Traffic control"
                      value={sceneSettings.trafficControl}
                      options={TRAFFIC_CONTROLS}
                      onChange={(trafficControl) =>
                        setSceneSettings((current) =>
                          current ? { ...current, trafficControl } : current,
                        )
                      }
                    />
                    <NumberField
                      label="Lane count"
                      value={sceneSettings.laneCount}
                      minimum={1}
                      maximum={6}
                      onChange={(laneCount) =>
                        setSceneSettings((current) =>
                          current ? { ...current, laneCount } : current,
                        )
                      }
                    />
                    <NumberField
                      label="Road rotation"
                      value={sceneSettings.roadRotation}
                      minimum={-180}
                      maximum={180}
                      suffix="°"
                      onChange={(roadRotation) =>
                        setSceneSettings((current) =>
                          current ? { ...current, roadRotation } : current,
                        )
                      }
                    />
                    <NumberField
                      label="Speed limit"
                      value={Math.max(10, sceneSettings.speedLimitKmh || 60)}
                      minimum={10}
                      maximum={160}
                      suffix=" km/h"
                      onChange={(speedLimitKmh) =>
                        setSceneSettings((current) =>
                          current ? { ...current, speedLimitKmh } : current,
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <WizardActions>
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setSelectedEnvironment(null);
                setDetectionResult(null);
                setSceneSettings(null);
              }}
              className={secondaryButtonClass}
            >
              ← Change Location
            </button>
            <button
              type="button"
              disabled={!sceneSettings || detectingRoad}
              onClick={() => setStep(4)}
              className={primaryButtonClass}
            >
              Review Scene Creation →
            </button>
          </WizardActions>
        </section>
      )}

      {step === 4 && selectedCoordinate && sceneSettings && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeading
            eyebrow="Step 4 of 4"
            title="Confirm the case and create the reconstruction"
            description="The real coordinate and selected scene environment are saved together."
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <SummaryCard title="Case">
                <SummaryRow label="Case number" value={values.caseNumber} />
                <SummaryRow label="Title" value={values.title} />
                <SummaryRow
                  label="Accident time"
                  value={`${values.accidentDate} · ${values.accidentTime}`}
                />
                <SummaryRow
                  label="Officer"
                  value={values.investigatingOfficer || "Not recorded"}
                />
              </SummaryCard>

              <SummaryCard title="Real location and scene">
                <SummaryRow
                  label="Location"
                  value={
                    detectionResult?.detection.address.displayName ||
                    values.location ||
                    coordinateLabel(selectedCoordinate)
                  }
                />
                <SummaryRow
                  label="Coordinates"
                  value={coordinateLabel(selectedCoordinate)}
                />
                <SummaryRow
                  label="Reported accuracy"
                  value={`±${selectedCoordinate.accuracyMetres.toFixed(1)} m`}
                />
                <SummaryRow
                  label="Selected scene size"
                  value={`${realSceneGeometry?.sceneWidthMetres.toFixed(1) ?? sceneSettings.sceneWidthMetres.toFixed(1)} × ${realSceneGeometry?.sceneHeightMetres.toFixed(1) ?? sceneSettings.sceneHeightMetres.toFixed(1)} m`}
                />
                <SummaryRow
                  label="Mapped content"
                  value={realSceneGeometry
                    ? `${realSceneGeometry.buildings.length} buildings · ${realSceneGeometry.vegetation?.length ?? 0} vegetation · ${realSceneGeometry.landCover?.length ?? 0} land-cover areas`
                    : "No extracted map content"}
                />
                <SummaryRow
                  label="Environment"
                  value={sceneSettings.sceneEnvironment}
                />
                <SummaryRow
                  label="Ground"
                  value={sceneSettings.groundSurface}
                />
                {usesGeneratedRoad(sceneSettings) && (
                  <SummaryRow label="Road layout" value={sceneSettings.roadLayout} />
                )}
                <SummaryRow
                  label="Geometry source"
                  value="Officer-selected exact map area with verified extracted geometry"
                />
              </SummaryCard>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-800">
                Field Capture remains available for GPS point placement, curved walking traces and walked boundaries at this location.
              </div>
            </div>

            {usesGeneratedRoad(sceneSettings) && detectionResult ? (
              <RoadDetectionPreview
                detection={detectionResult.detection}
                sceneSettings={sceneSettings}
              />
            ) : (
              <NeutralScenePreview
                settings={sceneSettings}
                coordinate={selectedCoordinate}
              />
            )}
          </div>

          <WizardActions>
            <button
              type="button"
              onClick={() => setStep(3)}
              className={secondaryButtonClass}
            >
              ← Back to Environment
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={createCaseAndScene}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {creating
                ? "Creating Case and Scene..."
                : "Create Case and Open Reconstruction →"}
            </button>
          </WizardActions>
        </section>
      )}
    </div>
  );
}

function NeutralScenePreview({
  settings,
  coordinate,
}: {
  settings: RoadSceneSettings;
  coordinate: RoadDetectionCoordinate;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="relative aspect-[16/9] min-h-[320px] overflow-hidden">
        <RoadSceneEnvironment settings={settings} />
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-blue-600 shadow-lg" />
          <div className="absolute left-1/2 top-[calc(50%+18px)] -translate-x-1/2 rounded-md border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[10px] font-black text-white backdrop-blur-sm">
            Real scene anchor
          </div>
        </div>
      </div>
      <div className="grid gap-3 border-t border-slate-700 bg-slate-900 p-4 text-xs text-slate-300 sm:grid-cols-3">
        <div>
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
            Environment
          </span>
          <strong className="mt-1 block text-slate-100">
            {settings.sceneEnvironment}
          </strong>
        </div>
        <div>
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
            Ground
          </span>
          <strong className="mt-1 block text-slate-100">
            {settings.groundSurface}
          </strong>
        </div>
        <div>
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
            Coordinate
          </span>
          <strong className="mt-1 block font-mono text-slate-100">
            {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
          </strong>
        </div>
      </div>
    </div>
  );
}

function WizardProgress({ step }: { step: WizardStep }) {
  const steps = [
    "Case Details",
    "Mark Scene",
    "Verify Geometry",
    "Create Case",
  ];

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const completed = number < step;

          return (
            <div
              key={label}
              className={`rounded-xl border px-3 py-3 ${
                active
                  ? "border-blue-500 bg-blue-50"
                  : completed
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                    active
                      ? "bg-blue-600 text-white"
                      : completed
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {completed ? "✓" : number}
                </span>
                <span className="text-xs font-black text-slate-800">{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
    </label>
  );
}

function SelectField<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: Value[];
  onChange: (value: Value) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        className={`${inputClass(false)} mt-2`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  minimum,
  maximum,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-600">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={minimum}
          max={maximum}
          value={value}
          onChange={(event) =>
            onChange(
              Math.min(maximum, Math.max(minimum, Number(event.target.value))),
            )
          }
          className={inputClass(false)}
        />
        {suffix && <span className="shrink-0 text-xs font-bold text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

function SummaryMetric({
  label,
  value,
  toneClass = "bg-slate-100 text-slate-800",
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 font-black">{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <h3 className="font-black text-slate-900">{title}</h3>
      <dl className="mt-4 space-y-3">{children}</dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </dd>
    </div>
  );
}

function WizardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
      {children}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
  }`;
}

const primaryButtonClass =
  "rounded-sm bg-blue-800 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400";

const secondaryButtonClass =
  "rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50";
