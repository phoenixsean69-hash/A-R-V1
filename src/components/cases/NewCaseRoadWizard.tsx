import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Crosshair,
  Database,
  FileText,
  Gauge,
  LocateFixed,
  Map,
  MapPinned,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Waypoints,
} from "lucide-react";

import {
  getOfficerDisplayName,
  getPoliceStationByName,
  ZIMBABWE_POLICE_STATIONS,
} from "../../data/stations";
import { useLiveGeolocation } from "../../hooks/useLiveGeolocation";
import { useSpeechDictation } from "../../hooks/useSpeechDictation";
import { AccidentCaseService } from "../../services/accidentCaseService";
import { RealSceneExtractionService } from "../../services/realSceneExtractionService";
import {
  preciseCoordinateToScenePosition,
  RealSceneRoadDetectionService,
} from "../../services/realSceneRoadDetectionService";
import { ReconstructionService } from "../../services/reconstructionService";
import { RoadLayoutDetectionService } from "../../services/roadLayoutDetectionService";
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
import { averageGeoCoordinates } from "../../utils/locationAveraging";

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
  policeStation?: string;
  investigatingOfficer?: string;
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

const SCENE_ENVIRONMENTS: Array<{
  value: SceneEnvironmentType;
  title: string;
  description: string;
}> = [
  {
    value: "Road / Junction",
    title: "Road / Junction",
    description:
      "Use the exact extracted roads, lanes, structures and selected accident anchor.",
  },
  {
    value: "Mixed Site",
    title: "Mixed Site",
    description:
      "Keep the mapped road while preserving surrounding verge, yard or open ground.",
  },
  {
    value: "Open Ground",
    title: "Open Ground",
    description:
      "Preserve the selected location and terrain without generating a road.",
  },
  {
    value: "Custom Site",
    title: "Custom Site",
    description:
      "Use the verified boundary as a blank measured scene for manual placement.",
  },
];

const SUMMARY_TEMPLATE = `INITIAL INCIDENT ACCOUNT
Reported collision type:
Vehicles / road users involved:
Direction of travel:
Approximate impact position:
Observed final positions:

SCENE AND ROAD CONDITIONS
Road layout:
Surface condition:
Weather and visibility:
Traffic controls:
Lighting:
Known hazards or obstructions:

CASUALTIES AND DAMAGE
Reported injuries:
Fatalities:
Visible vehicle damage:
Property or infrastructure damage:

INITIAL EVIDENCE
Witnesses:
CCTV / dashcam:
Tyre marks / debris:
Measurements already taken:
Photographs available:

OFFICER'S PRELIMINARY OBSERVATIONS
`;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) =>
    window.setTimeout(resolve, milliseconds),
  );
}

function coordinateLabel(
  coordinate: RoadDetectionCoordinate,
): string {
  return `${coordinate.latitude.toFixed(7)}, ${coordinate.longitude.toFixed(7)}`;
}

function coordinateInsideArea(
  coordinate: RoadDetectionCoordinate | null,
  area: RealSceneAreaSelection | null,
): boolean {
  if (!coordinate || !area) return false;

  return (
    coordinate.latitude <= area.bounds.north &&
    coordinate.latitude >= area.bounds.south &&
    coordinate.longitude <= area.bounds.east &&
    coordinate.longitude >= area.bounds.west
  );
}

function selectionDimensions(
  area: RealSceneAreaSelection | null,
): {
  widthMetres: number;
  heightMetres: number;
} {
  if (!area) {
    return {
      widthMetres: 0,
      heightMetres: 0,
    };
  }

  const latitude =
    (area.bounds.north + area.bounds.south) / 2;

  return {
    widthMetres:
      (area.bounds.east - area.bounds.west) *
      111_320 *
      Math.cos((latitude * Math.PI) / 180),
    heightMetres:
      (area.bounds.north - area.bounds.south) *
      110_540,
  };
}

function getAccuracyClass(
  accuracyMetres: number,
): string {
  if (accuracyMetres <= 5) return "is-good";
  if (accuracyMetres <= 10) return "is-warning";
  return "is-danger";
}

function getConfidenceClass(
  confidence: number,
): string {
  if (confidence >= 0.8) return "is-good";
  if (confidence >= 0.6) return "is-warning";
  return "is-danger";
}

export default function NewCaseRoadWizard({
  initialValues,
}: NewCaseRoadWizardProps) {
  const navigate = useNavigate();
  const geolocation = useLiveGeolocation();

  const [step, setStep] = useState<WizardStep>(1);
  const [values, setValues] =
    useState<AccidentCaseFormValues>(initialValues);
  const [errors, setErrors] =
    useState<BasicCaseErrors>({});

  const [selectedCoordinate, setSelectedCoordinate] =
    useState<RoadDetectionCoordinate | null>(null);
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [averaging, setAveraging] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  const [sceneArea, setSceneArea] =
    useState<RealSceneAreaSelection | null>(null);
  const [realSceneGeometry, setRealSceneGeometry] =
    useState<RealSceneGeometry | null>(null);
  const [extractingScene, setExtractingScene] = useState(false);
  const [sceneGeometryConfirmed, setSceneGeometryConfirmed] =
    useState(false);
  const [sceneExtractionMessage, setSceneExtractionMessage] =
    useState("");

  const [selectedEnvironment, setSelectedEnvironment] =
    useState<SceneEnvironmentType | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<RoadDetectionResult | null>(null);
  const [sceneSettings, setSceneSettings] =
    useState<RoadSceneSettings | null>(null);
  const [creating, setCreating] = useState(false);

  const locationMapRef =
    useRef<RoadLocationMapHandle | null>(null);
  const wizardRootRef = useRef<HTMLDivElement | null>(null);
  const previousSceneAnchorRef = useRef<string | null>(null);

  const station =
    getPoliceStationByName(values.policeStation);

  const liveCoordinate = geolocation.current;

  const appendSummaryText = (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    setValues((current) => ({
      ...current,
      summary: current.summary.trim()
        ? `${current.summary.trim()} ${clean}`
        : clean,
    }));
  };

  const dictation = useSpeechDictation({
    onFinalText: appendSummaryText,
  });

  useEffect(() => {
    if (selectedCoordinate || !liveCoordinate) return;

    const nextCoordinate: RoadDetectionCoordinate = {
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
      setSceneArea(null);
      setRealSceneGeometry(null);
      setSceneGeometryConfirmed(false);
      setSelectedEnvironment(null);
      setDetectionResult(null);
      setSceneSettings(null);
      setSceneExtractionMessage(
        "The exact accident marker changed. Select and extract the scene boundary again.",
      );
    }

    previousSceneAnchorRef.current = identity;
  }, [selectedCoordinate]);

  useEffect(() => {
    const rootElement = wizardRootRef.current;
    const pageElement = rootElement?.parentElement ?? null;

    document.body.classList.add("roadsafe-case-wizard-open");
    pageElement?.classList.add("roadsafe-case-page-shell");

    return () => {
      document.body.classList.remove("roadsafe-case-wizard-open");
      pageElement?.classList.remove("roadsafe-case-page-shell");
      dictation.stop();
    };
  }, []);

  const locationDisplay = useMemo(() => {
    if (!selectedCoordinate) {
      return "No exact accident marker has been confirmed.";
    }

    return `${coordinateLabel(selectedCoordinate)} · reported ±${selectedCoordinate.accuracyMetres.toFixed(
      1,
    )} m`;
  }, [selectedCoordinate]);

  const areaContainsAnchor = coordinateInsideArea(
    selectedCoordinate,
    sceneArea,
  );

  const areaDimensions = useMemo(
    () => selectionDimensions(sceneArea),
    [sceneArea],
  );

  const preciseAnchorPosition = useMemo(() => {
    if (!selectedCoordinate || !realSceneGeometry) {
      return null;
    }

    return preciseCoordinateToScenePosition(
      selectedCoordinate,
      realSceneGeometry,
    );
  }, [selectedCoordinate, realSceneGeometry]);

  const updateValue = <
    Key extends keyof AccidentCaseFormValues,
  >(
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
    if (!values.policeStation.trim()) {
      nextErrors.policeStation = "Select the responsible police station.";
    }
    if (!values.investigatingOfficer.trim()) {
      nextErrors.investigatingOfficer =
        "Select an investigating officer from the station.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const changeStation = (stationName: string) => {
    const selected = getPoliceStationByName(stationName);
    const firstOfficer = selected?.officers[0];

    setValues((current) => ({
      ...current,
      policeStation: stationName,
      investigatingOfficer: firstOfficer
        ? getOfficerDisplayName(firstOfficer)
        : "",
    }));

    setErrors((current) => ({
      ...current,
      policeStation: undefined,
      investigatingOfficer: undefined,
    }));
  };

  const startLocationTracking = () => {
    geolocation.clearSamples();
    geolocation.start();
    setLocationMessage(
      "Location tracking started. Remain outdoors and still while the reading settles.",
    );
  };

  const averageLocation = async () => {
    setAveraging(true);
    setLocationMessage(
      "Collecting and filtering high-accuracy location samples for 5 seconds…",
    );

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
          "No GPS samples were received. Check location permission and device location services.",
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
        `Averaged ${result.sampleCount} sample(s). Best device reading: ±${result.bestAccuracyMetres.toFixed(
          1,
        )} m. Confirm the red marker against the satellite image.`,
      );
    } catch (error) {
      setLocationMessage(
        error instanceof Error
          ? error.message
          : "Location averaging failed.",
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

    const coordinate: RoadDetectionCoordinate = {
      latitude,
      longitude,
      accuracyMetres: 5,
      capturedAt: new Date().toISOString(),
    };

    setSelectedCoordinate(coordinate);
    locationMapRef.current?.focusCoordinate(coordinate, 18.5);
    setLocationMessage(
      "Manual coordinate applied. Confirm the red marker against visible road details.",
    );
  };

  const extractSelectedScene = async () => {
    if (!sceneArea || !selectedCoordinate) {
      setSceneExtractionMessage(
        "Confirm the exact accident marker and draw the scene boundary first.",
      );
      return;
    }

    if (!coordinateInsideArea(selectedCoordinate, sceneArea)) {
      setSceneExtractionMessage(
        "The red accident marker is outside the blue boundary. Redraw the boundary so it contains the exact impact location.",
      );
      return;
    }

    if (
      areaDimensions.widthMetres < 8 ||
      areaDimensions.heightMetres < 8
    ) {
      setSceneExtractionMessage(
        "The selected boundary is too small. Each side must be at least 8 metres.",
      );
      return;
    }

    setExtractingScene(true);
    setSceneGeometryConfirmed(false);
    setSceneExtractionMessage(
      "Downloading the exact selected-area geometry and map snapshot in parallel…",
    );

    try {
      const geometryPromise = RealSceneExtractionService.extract(sceneArea);
      const snapshotPromise =
        locationMapRef.current?.captureSelectedAreaSnapshot() ??
        Promise.resolve(null);

      const [result, snapshot] = await Promise.all([
        geometryPromise,
        snapshotPromise,
      ]);

      const geometry: RealSceneGeometry = {
        ...result.geometry,
        snapshot: snapshot ?? result.geometry.snapshot,
        warnings: snapshot
          ? result.geometry.warnings.filter(
              (warning) =>
                !warning.toLowerCase().includes("snapshot"),
            )
          : result.geometry.warnings,
      };

      const roadDetection = RealSceneRoadDetectionService.detect(
        geometry,
        selectedCoordinate,
        values.location,
      );

      setRealSceneGeometry(geometry);
      setDetectionResult(roadDetection);
      setSelectedEnvironment(null);
      setSceneSettings(null);

      const anchor = preciseCoordinateToScenePosition(
        selectedCoordinate,
        geometry,
      );

      setSceneExtractionMessage(
        `Exact scene extracted: ${geometry.roads.length} road section(s), ${geometry.buildings.length} building(s), ${geometry.paths.length} path(s), ${geometry.vegetation?.length ?? 0} vegetation item(s). Accident anchor preserved at X ${anchor.x.toFixed(
          3,
        )}% · Y ${anchor.y.toFixed(3)}% inside the generated scene.`,
      );
    } catch (error) {
      setRealSceneGeometry(null);
      setDetectionResult(null);
      setSelectedEnvironment(null);
      setSceneSettings(null);
      setSceneExtractionMessage(
        error instanceof Error
          ? error.message
          : "The exact selected scene could not be extracted.",
      );
    } finally {
      setExtractingScene(false);
    }
  };

  const reanalyseVerifiedGeometry = () => {
    if (!realSceneGeometry || !selectedCoordinate) return;

    const result = RealSceneRoadDetectionService.detect(
      realSceneGeometry,
      selectedCoordinate,
      values.location,
    );

    setDetectionResult(result);

    if (selectedEnvironment && usesGeneratedRoad({
      ...createDefaultRoadSceneSettings(),
      sceneEnvironment: selectedEnvironment,
    })) {
      setSceneSettings({
        ...result.detection.suggestedSceneSettings,
        sceneEnvironment: selectedEnvironment,
        groundSurface:
          sceneSettings?.groundSurface ?? "Unclassified Ground",
        realSceneGeometry,
        sceneWidthMetres: realSceneGeometry.sceneWidthMetres,
        sceneHeightMetres: realSceneGeometry.sceneHeightMetres,
      });
    }
  };

  const selectEnvironment = (
    environment: SceneEnvironmentType,
  ) => {
    if (!realSceneGeometry || !selectedCoordinate) return;

    setSelectedEnvironment(environment);

    if (environment === "Open Ground" || environment === "Custom Site") {
      setSceneSettings({
        ...createDefaultGroundSceneSettings(environment),
        sceneWidthMetres: realSceneGeometry.sceneWidthMetres,
        sceneHeightMetres: realSceneGeometry.sceneHeightMetres,
        realSceneGeometry,
      });
      return;
    }

    const result =
      detectionResult ??
      RealSceneRoadDetectionService.detect(
        realSceneGeometry,
        selectedCoordinate,
        values.location,
      );

    setDetectionResult(result);
    setSceneSettings({
      ...result.detection.suggestedSceneSettings,
      sceneEnvironment: environment,
      groundSurface: "Unclassified Ground",
      sceneWidthMetres: realSceneGeometry.sceneWidthMetres,
      sceneHeightMetres: realSceneGeometry.sceneHeightMetres,
      realSceneGeometry,
    });
  };

  const createCaseAndScene = () => {
    if (
      !selectedCoordinate ||
      !sceneSettings ||
      !realSceneGeometry ||
      !sceneGeometryConfirmed ||
      !coordinateInsideArea(selectedCoordinate, sceneArea)
    ) {
      return;
    }

    setCreating(true);

    try {
      const exactCollisionPoint = preciseCoordinateToScenePosition(
        selectedCoordinate,
        realSceneGeometry,
      );

      let confirmedDetection = undefined;

      if (usesGeneratedRoad(sceneSettings)) {
        const baseDetection =
          detectionResult?.detection ??
          RealSceneRoadDetectionService.detect(
            realSceneGeometry,
            selectedCoordinate,
            values.location,
          ).detection;

        confirmedDetection = {
          ...RoadLayoutDetectionService.applyOfficerCorrections(
            baseDetection,
            sceneSettings,
            values.investigatingOfficer,
          ),
          coordinate: selectedCoordinate,
          junctionCentre: exactCollisionPoint,
        };
      }

      const finalLocation =
        values.location.trim() ||
        confirmedDetection?.address.displayName ||
        coordinateLabel(selectedCoordinate);

      const finalSceneSettings: RoadSceneSettings = {
        ...sceneSettings,
        realSceneGeometry,
        sceneWidthMetres: realSceneGeometry.sceneWidthMetres,
        sceneHeightMetres: realSceneGeometry.sceneHeightMetres,
      };

      const savedCase =
        AccidentCaseService.createWithSceneEnvironment(
          {
            ...values,
            caseNumber: values.caseNumber.trim(),
            title: values.title.trim(),
            location: finalLocation,
            junctionId: values.junctionId.trim(),
            investigatingOfficer:
              values.investigatingOfficer.trim(),
            policeStation: values.policeStation.trim(),
            summary: values.summary.trim(),
            status: "Open",
          },
          selectedCoordinate,
          finalSceneSettings,
          confirmedDetection,
        );

      const linkedReconstruction =
        AccidentCaseService.getLinkedReconstruction(savedCase);

      if (linkedReconstruction) {
        const preciseReconstruction = ReconstructionService.save({
          ...linkedReconstruction,
          siteCoordinate: selectedCoordinate,
          collisionPoint: exactCollisionPoint,
          scene: finalSceneSettings,
          roadLayoutDetection: confirmedDetection,
        });

        AccidentCaseService.registerReconstructionSave(
          savedCase.id,
          preciseReconstruction,
        );
      }

      navigate(`/cases/${savedCase.id}/reconstruction`);
    } catch (error) {
      console.error("Failed to create the precise scene:", error);
      setSceneExtractionMessage(
        error instanceof Error
          ? error.message
          : "The case and scene could not be created.",
      );
      setStep(4);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={wizardRootRef} className="roadsafe-case-wizard">
      <WizardProgress step={step} />

      {step === 1 && (
        <section className="roadsafe-wizard-panel">
          <SectionHeading
            eyebrow="Step 1 of 4"
            title="Record the accident-case details"
            description="Assign the responsible Zimbabwe police station and officer, then capture a complete initial incident account."
            icon={<FileText size={18} />}
          />

          <div className="roadsafe-wizard-form-grid">
            <Field label="Case number" error={errors.caseNumber}>
              <input
                value={values.caseNumber}
                onChange={(event) =>
                  updateValue("caseNumber", event.target.value)
                }
              />
            </Field>

            <Field label="Initial status">
              <input value="Open" readOnly />
            </Field>

            <Field
              label="Case title"
              error={errors.title}
              wide
            >
              <input
                value={values.title}
                onChange={(event) =>
                  updateValue("title", event.target.value)
                }
                placeholder="Example: Two-vehicle collision at a Bindura junction"
              />
            </Field>

            <Field label="Accident date" error={errors.accidentDate}>
              <input
                type="date"
                value={values.accidentDate}
                onChange={(event) =>
                  updateValue("accidentDate", event.target.value)
                }
              />
            </Field>

            <Field label="Accident time" error={errors.accidentTime}>
              <input
                type="time"
                value={values.accidentTime}
                onChange={(event) =>
                  updateValue("accidentTime", event.target.value)
                }
              />
            </Field>

            <Field
              label="Responsible police station"
              error={errors.policeStation}
            >
              <select
                value={values.policeStation}
                onChange={(event) => changeStation(event.target.value)}
              >
                <option value="">Select a Zimbabwe police station</option>
                {ZIMBABWE_POLICE_STATIONS.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name} · {item.province}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Investigating officer"
              error={errors.investigatingOfficer}
            >
              <select
                value={values.investigatingOfficer}
                disabled={!station}
                onChange={(event) =>
                  updateValue(
                    "investigatingOfficer",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  {station
                    ? "Select an officer from this station"
                    : "Select the police station first"}
                </option>
                {station?.officers.map((officer) => {
                  const name = getOfficerDisplayName(officer);
                  return (
                    <option key={officer.id} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>

          <div className="roadsafe-summary-workspace">
            <div className="roadsafe-summary-workspace__header">
              <div>
                <p>Initial case summary</p>
                <span>
                  Capture the reported sequence, scene conditions,
                  casualties, evidence and first officer observations.
                </span>
              </div>

              <div className="roadsafe-summary-workspace__actions">
                <button
                  type="button"
                  onClick={() =>
                    updateValue(
                      "summary",
                      values.summary.trim()
                        ? `${values.summary.trim()}\n\n${SUMMARY_TEMPLATE}`
                        : SUMMARY_TEMPLATE,
                    )
                  }
                >
                  <Sparkles size={13} />
                  Add structured template
                </button>

                <button
                  type="button"
                  disabled={!dictation.supported}
                  onClick={
                    dictation.listening
                      ? dictation.stop
                      : dictation.start
                  }
                  className={dictation.listening ? "is-recording" : ""}
                >
                  {dictation.listening ? (
                    <>
                      <Square size={11} fill="currentColor" />
                      Stop dictation
                    </>
                  ) : (
                    <>
                      <Mic size={13} />
                      Voice dictation
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              rows={13}
              value={values.summary}
              onChange={(event) =>
                updateValue("summary", event.target.value)
              }
              placeholder="Describe the complete initial accident account or use voice dictation…"
            />

            <div className="roadsafe-summary-workspace__footer">
              <span>
                {values.summary.trim()
                  ? `${values.summary.trim().split(/\s+/).length} words · ${values.summary.length} characters`
                  : "No initial summary recorded yet"}
              </span>

              {dictation.listening && (
                <span className="is-listening">
                  <span />
                  Listening
                  {dictation.interimText
                    ? `: ${dictation.interimText}`
                    : "…"}
                </span>
              )}

              {!dictation.supported && (
                <span>
                  <MicOff size={11} />
                  Voice dictation requires Chrome or Edge
                </span>
              )}
            </div>

            {dictation.error && (
              <div className="roadsafe-inline-alert is-danger">
                {dictation.error}
              </div>
            )}
          </div>

          <WizardActions>
            <button
              type="button"
              className="ui-button"
              onClick={() => navigate("/cases")}
            >
              Cancel
            </button>

            <button
              type="button"
              className="ui-button-primary"
              onClick={() => {
                dictation.stop();
                if (validateBasicDetails()) setStep(2);
              }}
            >
              Continue to exact location
              <ChevronRight size={14} />
            </button>
          </WizardActions>
        </section>
      )}

      {step === 2 && (
        <section className="roadsafe-wizard-panel">
          <SectionHeading
            eyebrow="Step 2 of 4"
            title="Mark the exact accident point and scene boundary"
            description="Search Zimbabwe, use GPS or click the map. The red marker is the exact accident anchor; the blue boundary is the only area RoadSafe will extract."
            icon={<Map size={18} />}
          />

          <div className="roadsafe-location-layout">
            <aside className="roadsafe-location-sidebar">
              <InfoCard
                icon={<LocateFixed size={15} />}
                title="Device location"
                badge={
                  geolocation.current
                    ? `±${geolocation.current.accuracyMetres.toFixed(1)} m`
                    : geolocation.permission
                }
                badgeClass={
                  geolocation.current
                    ? getAccuracyClass(
                        geolocation.current.accuracyMetres,
                      )
                    : ""
                }
              >
                <DataRow
                  label="Live coordinate"
                  value={
                    geolocation.current
                      ? `${geolocation.current.latitude.toFixed(
                          7,
                        )}, ${geolocation.current.longitude.toFixed(7)}`
                      : "Waiting for permission"
                  }
                  mono
                />
                <DataRow
                  label="Samples"
                  value={String(geolocation.sampleCount)}
                />

                <div className="roadsafe-stacked-actions">
                  <button
                    type="button"
                    className="ui-button-primary"
                    onClick={startLocationTracking}
                  >
                    <LocateFixed size={13} />
                    {geolocation.isWatching
                      ? "Tracking active"
                      : "Allow location access"}
                  </button>

                  <button
                    type="button"
                    className="ui-button"
                    disabled={averaging}
                    onClick={() => void averageLocation()}
                  >
                    <Gauge size={13} />
                    {averaging
                      ? "Averaging for 5 seconds…"
                      : "Average GPS for 5 seconds"}
                  </button>

                  {geolocation.current && (
                    <button
                      type="button"
                      className="ui-button"
                      onClick={() => {
                        const coordinate = {
                          latitude: geolocation.current!.latitude,
                          longitude: geolocation.current!.longitude,
                          accuracyMetres:
                            geolocation.current!.accuracyMetres,
                          capturedAt:
                            geolocation.current!.capturedAt,
                        };

                        setSelectedCoordinate(coordinate);
                        locationMapRef.current?.focusCoordinate(
                          coordinate,
                          18.5,
                        );
                        setLocationMessage(
                          "The current device reading is now the red accident marker.",
                        );
                      }}
                    >
                      <Crosshair size={13} />
                      Use current reading
                    </button>
                  )}
                </div>
              </InfoCard>

              <InfoCard
                icon={<MapPinned size={15} />}
                title="Exact coordinate"
              >
                <div className="roadsafe-coordinate-grid">
                  <label>
                    <span>Latitude</span>
                    <input
                      inputMode="decimal"
                      value={manualLatitude}
                      onChange={(event) =>
                        setManualLatitude(event.target.value)
                      }
                      placeholder="-17.825166"
                    />
                  </label>
                  <label>
                    <span>Longitude</span>
                    <input
                      inputMode="decimal"
                      value={manualLongitude}
                      onChange={(event) =>
                        setManualLongitude(event.target.value)
                      }
                      placeholder="31.033510"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="ui-button w-full"
                  onClick={useManualCoordinate}
                >
                  Apply exact coordinate
                </button>
              </InfoCard>

              <InfoCard
                icon={<Crosshair size={15} />}
                title="Confirmed accident anchor"
                badge={
                  selectedCoordinate
                    ? `${selectedCoordinate.accuracyMetres.toFixed(1)} m`
                    : "Not set"
                }
                badgeClass={
                  selectedCoordinate
                    ? getAccuracyClass(
                        selectedCoordinate.accuracyMetres,
                      )
                    : ""
                }
              >
                <p className="roadsafe-coordinate-value">
                  {locationDisplay}
                </p>
                <p className="roadsafe-card-note">
                  Search results only position the map. Confirm the
                  red marker against the visible road, lane or
                  collision feature.
                </p>
              </InfoCard>

              {(locationMessage || geolocation.error) && (
                <div className="roadsafe-inline-alert">
                  {locationMessage || geolocation.error}
                </div>
              )}
            </aside>

            <main className="roadsafe-location-main">
              <RoadLocationMap
                ref={locationMapRef}
                coordinate={selectedCoordinate}
                currentCoordinate={
                  liveCoordinate
                    ? {
                        latitude: liveCoordinate.latitude,
                        longitude: liveCoordinate.longitude,
                        accuracyMetres:
                          liveCoordinate.accuracyMetres,
                        capturedAt: liveCoordinate.capturedAt,
                      }
                    : null
                }
                roads={
                  detectionResult?.detection.roads ?? []
                }
                features={
                  detectionResult?.detection.features ?? []
                }
                editable
                areaSelection={sceneArea}
                realSceneGeometry={realSceneGeometry}
                onSearchedLocationChange={(displayName) =>
                  updateValue("location", displayName)
                }
                onCoordinateChange={(coordinate) => {
                  setSelectedCoordinate(coordinate);
                  setLocationMessage(
                    "The exact accident marker was updated. Verify it against the map imagery.",
                  );
                }}
                onAreaSelectionChange={(selection) => {
                  setSceneArea(selection);
                  setRealSceneGeometry(null);
                  setSceneGeometryConfirmed(false);
                  setSelectedEnvironment(null);
                  setDetectionResult(null);
                  setSceneSettings(null);

                  if (
                    selection &&
                    selectedCoordinate &&
                    !coordinateInsideArea(
                      selectedCoordinate,
                      selection,
                    )
                  ) {
                    setSceneExtractionMessage(
                      "The blue boundary does not contain the red accident marker. Redraw the scene boundary.",
                    );
                  } else {
                    setSceneExtractionMessage(
                      selection
                        ? "Exact boundary selected. Extract its mapped geometry for verification."
                        : "Select the complete accident-scene boundary.",
                    );
                  }
                }}
              />

              <div className="roadsafe-extraction-grid">
                <InfoCard
                  icon={<Database size={15} />}
                  title="Exact selected-area extraction"
                  badge={
                    realSceneGeometry
                      ? sceneGeometryConfirmed
                        ? "Confirmed"
                        : "Review"
                      : "Waiting"
                  }
                  badgeClass={
                    realSceneGeometry
                      ? sceneGeometryConfirmed
                        ? "is-good"
                        : "is-warning"
                      : ""
                  }
                >
                  <div className="roadsafe-scene-dimensions">
                    <DataRow
                      label="Boundary size"
                      value={
                        sceneArea
                          ? `${areaDimensions.widthMetres.toFixed(
                              2,
                            )} × ${areaDimensions.heightMetres.toFixed(
                              2,
                            )} m`
                          : "Not selected"
                      }
                    />
                    <DataRow
                      label="Anchor inside boundary"
                      value={
                        sceneArea
                          ? areaContainsAnchor
                            ? "Yes"
                            : "No"
                          : "Waiting"
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="ui-button-primary w-full"
                    disabled={
                      !sceneArea ||
                      !selectedCoordinate ||
                      !areaContainsAnchor ||
                      extractingScene
                    }
                    onClick={() => void extractSelectedScene()}
                  >
                    <Database size={13} />
                    {extractingScene
                      ? "Extracting exact geometry…"
                      : realSceneGeometry
                        ? "Re-extract selected scene"
                        : "Extract selected scene"}
                  </button>

                  {realSceneGeometry && (
                    <button
                      type="button"
                      className={
                        sceneGeometryConfirmed
                          ? "ui-button roadsafe-confirm-button is-confirmed"
                          : "ui-button roadsafe-confirm-button"
                      }
                      onClick={() => {
                        setSceneGeometryConfirmed(true);
                        setSceneExtractionMessage(
                          "The investigating officer confirmed the exact extracted map overlay.",
                        );
                      }}
                    >
                      <ShieldCheck size={13} />
                      {sceneGeometryConfirmed
                        ? "Geometry confirmed"
                        : "Confirm extracted geometry"}
                    </button>
                  )}
                </InfoCard>

                <InfoCard
                  icon={<Waypoints size={15} />}
                  title="Extraction result"
                >
                  {realSceneGeometry ? (
                    <div className="roadsafe-metric-grid">
                      <Metric
                        label="Roads"
                        value={realSceneGeometry.roads.length}
                      />
                      <Metric
                        label="Buildings"
                        value={realSceneGeometry.buildings.length}
                      />
                      <Metric
                        label="Paths"
                        value={realSceneGeometry.paths.length}
                      />
                      <Metric
                        label="Vegetation"
                        value={
                          realSceneGeometry.vegetation?.length ?? 0
                        }
                      />
                    </div>
                  ) : (
                    <p className="roadsafe-card-note">
                      Geometry will appear here immediately after
                      extraction.
                    </p>
                  )}

                  {preciseAnchorPosition && (
                    <div className="roadsafe-anchor-readout">
                      <span>Generated-scene anchor</span>
                      <strong>
                        X {preciseAnchorPosition.x.toFixed(4)}% · Y{" "}
                        {preciseAnchorPosition.y.toFixed(4)}%
                      </strong>
                    </div>
                  )}
                </InfoCard>
              </div>

              {sceneExtractionMessage && (
                <div
                  className={`roadsafe-inline-alert ${
                    sceneArea && !areaContainsAnchor
                      ? "is-danger"
                      : ""
                  }`}
                >
                  {sceneExtractionMessage}
                </div>
              )}
            </main>
          </div>

          <WizardActions>
            <button
              type="button"
              className="ui-button"
              onClick={() => setStep(1)}
            >
              Back to details
            </button>

            <button
              type="button"
              className="ui-button-primary"
              disabled={
                !selectedCoordinate ||
                !realSceneGeometry ||
                !sceneGeometryConfirmed ||
                !areaContainsAnchor
              }
              onClick={() => setStep(3)}
            >
              Verify scene environment
              <ChevronRight size={14} />
            </button>
          </WizardActions>
        </section>
      )}

      {step === 3 &&
        selectedCoordinate &&
        realSceneGeometry && (
          <section className="roadsafe-wizard-panel">
            <SectionHeading
              eyebrow="Step 3 of 4"
              title="Verify the generated scene geometry"
              description="RoadSafe now analyses the already-extracted boundary. There is no second road-data download and no change of coordinates."
              icon={<Waypoints size={18} />}
            />

            <div className="roadsafe-geometry-source-banner">
              <Database size={16} />
              <div>
                <strong>
                  Verified scene data is ready locally
                </strong>
                <span>
                  {realSceneGeometry.roads.length} road(s),{" "}
                  {realSceneGeometry.buildings.length} building(s),{" "}
                  {realSceneGeometry.paths.length} path(s) · extracted{" "}
                  {new Date(
                    realSceneGeometry.extractedAt,
                  ).toLocaleTimeString()}
                </span>
              </div>
              <button
                type="button"
                className="ui-button"
                onClick={reanalyseVerifiedGeometry}
              >
                <RotateCcw size={12} />
                Re-analyse
              </button>
            </div>

            <div className="roadsafe-environment-grid">
              {SCENE_ENVIRONMENTS.map((environment) => {
                const selected =
                  selectedEnvironment === environment.value;

                return (
                  <button
                    key={environment.value}
                    type="button"
                    className={selected ? "is-selected" : ""}
                    onClick={() =>
                      selectEnvironment(environment.value)
                    }
                  >
                    <span className="roadsafe-environment-grid__check">
                      {selected ? <Check size={13} /> : null}
                    </span>
                    <strong>{environment.title}</strong>
                    <small>{environment.description}</small>
                  </button>
                );
              })}
            </div>

            {sceneSettings && selectedEnvironment && (
              <div className="roadsafe-geometry-workspace">
                <div className="roadsafe-geometry-summary">
                  <Metric
                    label="Exact anchor X"
                    value={`${preciseAnchorPosition?.x.toFixed(3) ?? "—"}%`}
                  />
                  <Metric
                    label="Exact anchor Y"
                    value={`${preciseAnchorPosition?.y.toFixed(3) ?? "—"}%`}
                  />
                  <Metric
                    label="Scene width"
                    value={`${realSceneGeometry.sceneWidthMetres.toFixed(
                      2,
                    )} m`}
                  />
                  <Metric
                    label="Scene height"
                    value={`${realSceneGeometry.sceneHeightMetres.toFixed(
                      2,
                    )} m`}
                  />
                </div>

                <div className="roadsafe-settings-row">
                  <SelectField<GroundSurfaceType>
                    label="Ground classification"
                    value={sceneSettings.groundSurface}
                    options={GROUND_SURFACES}
                    onChange={(groundSurface) =>
                      setSceneSettings((current) =>
                        current
                          ? { ...current, groundSurface }
                          : current,
                      )
                    }
                  />
                </div>

                {usesGeneratedRoad(sceneSettings) &&
                  detectionResult && (
                    <>
                      <div className="roadsafe-detection-metrics">
                        <StatusMetric
                          label="Detected layout"
                          value={
                            detectionResult.detection.detectedLayout
                          }
                        />
                        <StatusMetric
                          label="Confidence"
                          value={`${Math.round(
                            detectionResult.detection.confidence * 100,
                          )}% · ${
                            detectionResult.detection.confidenceLabel
                          }`}
                          className={getConfidenceClass(
                            detectionResult.detection.confidence,
                          )}
                        />
                        <StatusMetric
                          label="Road branches"
                          value={String(
                            detectionResult.detection.branchCount,
                          )}
                        />
                        <StatusMetric
                          label="Mapped road sections"
                          value={String(
                            detectionResult.detection.roads.length,
                          )}
                          className={
                            detectionResult.detection.roads.length > 0
                              ? "is-good"
                              : "is-warning"
                          }
                        />
                      </div>

                      <div className="roadsafe-preview-grid">
                        <RoadDetectionPreview
                          detection={detectionResult.detection}
                          sceneSettings={sceneSettings}
                        />

                        <div className="roadsafe-road-settings">
                          <div>
                            <p>Confirm or correct the road</p>
                            <span>
                              All values remain tied to the same verified
                              scene bounds and exact accident anchor.
                            </span>
                          </div>

                          <div className="roadsafe-road-settings__grid">
                            <SelectField<RoadLayoutType>
                              label="Road layout"
                              value={sceneSettings.roadLayout}
                              options={ROAD_LAYOUTS}
                              onChange={(roadLayout) =>
                                setSceneSettings((current) =>
                                  current
                                    ? {
                                        ...current,
                                        roadLayout,
                                      }
                                    : current,
                                )
                              }
                            />

                            <SelectField<DrivingSide>
                              label="Driving side"
                              value={sceneSettings.drivingSide}
                              options={["Left", "Right"]}
                              onChange={(drivingSide) =>
                                setSceneSettings((current) =>
                                  current
                                    ? {
                                        ...current,
                                        drivingSide,
                                      }
                                    : current,
                                )
                              }
                            />

                            <SelectField<TrafficControlType>
                              label="Traffic control"
                              value={sceneSettings.trafficControl}
                              options={TRAFFIC_CONTROLS}
                              onChange={(trafficControl) =>
                                setSceneSettings((current) =>
                                  current
                                    ? {
                                        ...current,
                                        trafficControl,
                                      }
                                    : current,
                                )
                              }
                            />

                            <NumberField
                              label="Lane count"
                              value={sceneSettings.laneCount}
                              minimum={1}
                              maximum={8}
                              onChange={(laneCount) =>
                                setSceneSettings((current) =>
                                  current
                                    ? {
                                        ...current,
                                        laneCount,
                                      }
                                    : current,
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
                                  current
                                    ? {
                                        ...current,
                                        roadRotation,
                                      }
                                    : current,
                                )
                              }
                            />

                            <NumberField
                              label="Speed limit"
                              value={sceneSettings.speedLimitKmh}
                              minimum={10}
                              maximum={160}
                              suffix="km/h"
                              onChange={(speedLimitKmh) =>
                                setSceneSettings((current) =>
                                  current
                                    ? {
                                        ...current,
                                        speedLimitKmh,
                                      }
                                    : current,
                                )
                              }
                            />
                          </div>

                          {detectionResult.warnings.length > 0 && (
                            <div className="roadsafe-inline-alert is-warning">
                              {detectionResult.warnings.join(" ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                {!usesGeneratedRoad(sceneSettings) && (
                  <div className="roadsafe-preview-grid">
                    <NeutralScenePreview
                      settings={sceneSettings}
                      coordinate={selectedCoordinate}
                      anchor={preciseAnchorPosition}
                    />

                    <InfoCard
                      icon={<ShieldCheck size={15} />}
                      title="Ground-only scene"
                      badge="Exact boundary"
                      badgeClass="is-good"
                    >
                      <p className="roadsafe-card-note">
                        The selected coordinate, north orientation,
                        metre scale, extracted structures and terrain
                        remain unchanged. Road generation is disabled.
                      </p>
                    </InfoCard>
                  </div>
                )}
              </div>
            )}

            <WizardActions>
              <button
                type="button"
                className="ui-button"
                onClick={() => setStep(2)}
              >
                Back to exact map
              </button>

              <button
                type="button"
                className="ui-button-primary"
                disabled={!sceneSettings || !selectedEnvironment}
                onClick={() => setStep(4)}
              >
                Review and create
                <ChevronRight size={14} />
              </button>
            </WizardActions>
          </section>
        )}

      {step === 4 &&
        selectedCoordinate &&
        realSceneGeometry &&
        sceneSettings && (
          <section className="roadsafe-wizard-panel">
            <SectionHeading
              eyebrow="Step 4 of 4"
              title="Create the precise reconstruction scene"
              description="The same exact marker, selected boundary and extracted geometry will be saved into the case and reconstruction."
              icon={<ShieldCheck size={18} />}
            />

            <div className="roadsafe-review-grid">
              <div className="roadsafe-review-column">
                <SummaryCard title="Case assignment">
                  <SummaryRow
                    label="Case number"
                    value={values.caseNumber}
                  />
                  <SummaryRow label="Title" value={values.title} />
                  <SummaryRow
                    label="Police station"
                    value={values.policeStation}
                  />
                  <SummaryRow
                    label="Investigating officer"
                    value={values.investigatingOfficer}
                  />
                  <SummaryRow
                    label="Accident time"
                    value={`${values.accidentDate} · ${values.accidentTime}`}
                  />
                </SummaryCard>

                <SummaryCard title="Exact spatial handoff">
                  <SummaryRow
                    label="Location"
                    value={
                      values.location ||
                      coordinateLabel(selectedCoordinate)
                    }
                  />
                  <SummaryRow
                    label="Accident coordinate"
                    value={coordinateLabel(selectedCoordinate)}
                  />
                  <SummaryRow
                    label="Generated scene position"
                    value={`X ${
                      preciseAnchorPosition?.x.toFixed(5) ?? "—"
                    }% · Y ${
                      preciseAnchorPosition?.y.toFixed(5) ?? "—"
                    }%`}
                  />
                  <SummaryRow
                    label="Scene size"
                    value={`${realSceneGeometry.sceneWidthMetres.toFixed(
                      2,
                    )} × ${realSceneGeometry.sceneHeightMetres.toFixed(
                      2,
                    )} m`}
                  />
                  <SummaryRow
                    label="Environment"
                    value={sceneSettings.sceneEnvironment}
                  />
                  <SummaryRow
                    label="Extracted geometry"
                    value={`${realSceneGeometry.roads.length} roads · ${realSceneGeometry.buildings.length} buildings · ${realSceneGeometry.paths.length} paths · ${realSceneGeometry.vegetation?.length ?? 0} vegetation`}
                  />
                </SummaryCard>

                <SummaryCard title="Initial account">
                  <p className="roadsafe-review-summary">
                    {values.summary.trim() ||
                      "No initial case summary was recorded."}
                  </p>
                </SummaryCard>
              </div>

              <div className="roadsafe-review-preview">
                {usesGeneratedRoad(sceneSettings) &&
                detectionResult ? (
                  <RoadDetectionPreview
                    detection={detectionResult.detection}
                    sceneSettings={sceneSettings}
                  />
                ) : (
                  <NeutralScenePreview
                    settings={sceneSettings}
                    coordinate={selectedCoordinate}
                    anchor={preciseAnchorPosition}
                  />
                )}

                <div className="roadsafe-precision-checklist">
                  {[
                    "Red accident marker is inside the verified blue boundary",
                    "Map geometry was extracted once and reused for road analysis",
                    "Collision point is calculated from the exact latitude and longitude",
                    "The same scene dimensions are saved for 2D and 3D",
                  ].map((item) => (
                    <div key={item}>
                      <Check size={13} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {sceneExtractionMessage && (
              <div className="roadsafe-inline-alert">
                {sceneExtractionMessage}
              </div>
            )}

            <WizardActions>
              <button
                type="button"
                className="ui-button"
                onClick={() => setStep(3)}
              >
                Back to geometry
              </button>

              <button
                type="button"
                className="ui-button-primary"
                disabled={creating}
                onClick={createCaseAndScene}
              >
                <ShieldCheck size={14} />
                {creating
                  ? "Creating precise scene…"
                  : "Create case and open reconstruction"}
              </button>
            </WizardActions>
          </section>
        )}
    </div>
  );
}

function WizardProgress({ step }: { step: WizardStep }) {
  const steps = [
    ["Case details", FileText],
    ["Exact map", Map],
    ["Geometry", Waypoints],
    ["Create", ShieldCheck],
  ] as const;

  return (
    <nav className="roadsafe-wizard-progress">
      {steps.map(([label, Icon], index) => {
        const number = (index + 1) as WizardStep;
        const active = number === step;
        const complete = number < step;

        return (
          <div
            key={label}
            className={`${active ? "is-active" : ""} ${
              complete ? "is-complete" : ""
            }`}
          >
            <span>
              {complete ? <Check size={13} /> : <Icon size={13} />}
            </span>
            <div>
              <small>Step {number} of 4</small>
              <strong>{label}</strong>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <header className="roadsafe-wizard-heading">
      <span className="roadsafe-wizard-heading__icon">
        {icon}
      </span>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
    </header>
  );
}

function Field({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`roadsafe-wizard-field ${
        wide ? "is-wide" : ""
      }`}
    >
      <span>{label}</span>
      {children}
      {error && <small className="is-error">{error}</small>}
    </label>
  );
}

function InfoCard({
  icon,
  title,
  badge,
  badgeClass = "",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="roadsafe-info-card">
      <header>
        <span>{icon}</span>
        <strong>{title}</strong>
        {badge && (
          <em className={badgeClass}>{badge}</em>
        )}
      </header>
      <div className="roadsafe-info-card__body">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="roadsafe-data-row">
      <span>{label}</span>
      <strong className={mono ? "is-mono" : ""}>{value}</strong>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="roadsafe-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`roadsafe-status-metric ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
    <label className="roadsafe-wizard-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as Value)
        }
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
    <label className="roadsafe-wizard-field">
      <span>{label}</span>
      <div className="roadsafe-number-field">
        <input
          type="number"
          min={minimum}
          max={maximum}
          value={value}
          onChange={(event) =>
            onChange(
              Math.min(
                maximum,
                Math.max(minimum, Number(event.target.value)),
              ),
            )
          }
        />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
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
    <section className="roadsafe-summary-card">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="roadsafe-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WizardActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return <footer className="roadsafe-wizard-actions">{children}</footer>;
}

function NeutralScenePreview({
  settings,
  coordinate,
  anchor,
}: {
  settings: RoadSceneSettings;
  coordinate: RoadDetectionCoordinate;
  anchor: { x: number; y: number } | null;
}) {
  return (
    <div className="roadsafe-neutral-preview">
      <div className="roadsafe-neutral-preview__scene">
        <RoadSceneEnvironment settings={settings} />

        <div
          className="roadsafe-neutral-preview__anchor"
          style={{
            left: `${anchor?.x ?? 50}%`,
            top: `${anchor?.y ?? 50}%`,
          }}
        >
          <span />
          <small>Exact accident anchor</small>
        </div>
      </div>

      <footer>
        <DataRow label="Environment" value={settings.sceneEnvironment} />
        <DataRow label="Ground" value={settings.groundSurface} />
        <DataRow
          label="Coordinate"
          value={`${coordinate.latitude.toFixed(
            6,
          )}, ${coordinate.longitude.toFixed(6)}`}
          mono
        />
      </footer>
    </div>
  );
}
