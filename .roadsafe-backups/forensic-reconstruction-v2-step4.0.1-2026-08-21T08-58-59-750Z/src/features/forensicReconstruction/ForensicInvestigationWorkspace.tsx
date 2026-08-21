import { useEffect, useMemo, useRef, useState } from "react";
import type { AccidentCase } from "../../types/accidentCase";
import {
  EVIDENCE_SOURCE_OPTIONS,
  FORENSIC_CONFIDENCE_OPTIONS,
  FORENSIC_PROVENANCE_OPTIONS,
  MEASUREMENT_CATEGORY_OPTIONS,
  MEASUREMENT_UNIT_OPTIONS,
  PHYSICAL_EVIDENCE_TYPE_OPTIONS,
  VEHICLE_DAMAGE_AREA_OPTIONS,
  VEHICLE_DAMAGE_SEVERITY_OPTIONS,
  VEHICLE_INSPECTION_STATUS_OPTIONS,
  VEHICLE_MECHANICAL_FINDING_OPTIONS,
  VEHICLE_SCENE_POSITION_OPTIONS,
  VEHICLE_TRACE_TYPE_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  type EvidenceSource,
  type ForensicAccidentInvestigation,
  type ForensicConfidence,
  type ForensicProvenance,
  type ForensicVehicleDamagePhotoRef,
  type MeasurementCategory,
  type PhysicalEvidenceType,
  type VehicleDamageArea,
  type VehicleInspectionStatus,
  type VehicleTraceType,
} from "./forensicInvestigationTypes";
import { ForensicInvestigationService } from "./forensicInvestigationService";
import {
  ForensicDamagePhotoService,
} from "./forensicDamagePhotoService";
import "./ForensicInvestigationWorkspace.css";

interface Props {
  accidentCase: AccidentCase;
  initialInvestigation: ForensicAccidentInvestigation;
  onExit(): void;
}

type Section =
  | "Overview"
  | "Scene Intake"
  | "Evidence Registry"
  | "Measurements"
  | "Vehicles"
  | "Persons"
  | "Witnesses"
  | "Analysis"
  | "Hypotheses"
  | "Simulation"
  | "2D / 3D / AR"
  | "Findings"
  | "Report";

const SECTIONS: Section[] = [
  "Overview",
  "Scene Intake",
  "Evidence Registry",
  "Measurements",
  "Vehicles",
  "Persons",
  "Witnesses",
  "Analysis",
  "Hypotheses",
  "Simulation",
  "2D / 3D / AR",
  "Findings",
  "Report",
];

const ACTIVE = new Set<Section>([
  "Overview",
  "Scene Intake",
  "Evidence Registry",
  "Measurements",
  "Vehicles",
]);
const isDerived = (value: ForensicProvenance) =>
  ["Calculated", "AI Derived", "Investigator Assumption", "Simulated"].includes(value);

type SceneChoiceKey =
  | "weather"
  | "lighting"
  | "roadCondition"
  | "trafficControlState"
  | "roadGeometry";

const OTHER_CHOICE = "__other__";

const SCENE_CHOICE_OPTIONS: Record<SceneChoiceKey, readonly string[]> = {
  weather: [
    "Clear",
    "Partly cloudy",
    "Overcast",
    "Light rain",
    "Heavy rain",
    "Thunderstorm",
    "Fog / mist",
    "Dust / haze",
    "Windy",
  ],
  lighting: [
    "Daylight",
    "Dawn",
    "Dusk",
    "Dark - street-lit",
    "Dark - no street lighting",
    "Artificial / temporary lighting",
    "Glare / low sun",
  ],
  roadCondition: [
    "Dry",
    "Wet",
    "Flooded / standing water",
    "Muddy",
    "Loose gravel / loose surface",
    "Oily / contaminated",
    "Uneven / damaged",
    "Potholes present",
  ],
  trafficControlState: [
    "No traffic control",
    "Traffic signals operating",
    "Traffic signals not operating",
    "Stop sign",
    "Give Way / Yield sign",
    "Speed-control signage",
    "Police / manual control",
    "Roadworks / temporary control",
    "Pedestrian crossing control",
  ],
  roadGeometry: [
    "Straight road",
    "Curve / bend",
    "T-junction",
    "Crossroads / 4-way junction",
    "Roundabout",
    "Y-junction / fork",
    "Pedestrian crossing",
    "Bridge / culvert",
    "Incline / downgrade",
    "Multi-lane / divided road",
    "Complex / multiple features",
  ],
};

type MeasurementChoiceKey =
  | "method"
  | "location";

const MEASUREMENT_METHOD_OPTIONS = [
  "Tape measure",
  "Laser distance meter",
  "Survey wheel",
  "Scene total station / survey",
  "Photogrammetry",
  "CCTV calibration",
  "Video analysis",
  "Calculation / derived",
  "Witness-indicated estimate",
] as const;

const MEASUREMENT_LOCATION_OPTIONS = [
  "Skid onset to final visible tyre mark",
  "First debris to last debris",
  "Point of impact to vehicle final rest position",
  "Point of impact to person final rest position",
  "Road edge / curb to evidence item",
  "Centre line to evidence item",
  "Lane edge to tyre mark",
  "Reference point to evidence item",
  "Vehicle final rest position to reference point",
] as const;

function findMeasurementChoice(
  options: readonly string[],
  value: string,
): string | undefined {
  const normalised = value.trim().toLowerCase();

  return options.find(
    (option) =>
      option.toLowerCase() === normalised,
  );
}

type VehicleChoiceKey =
  | "type"
  | "scenePosition"
  | "mechanicalFinding";

function findOption(
  options: readonly string[],
  value: string,
): string | undefined {
  const normalised = value.trim().toLowerCase();

  return options.find(
    (option) => option.toLowerCase() === normalised,
  );
}

function findPresetChoice(
  key: SceneChoiceKey,
  value: string,
): string | undefined {
  const normalised = value.trim().toLowerCase();

  return SCENE_CHOICE_OPTIONS[key].find(
    (option) =>
      option.toLowerCase() === normalised,
  );
}

function DamagePhotoThumbnail({
  photo,
}: {
  photo: ForensicVehicleDamagePhotoRef;
}) {
  const [src, setSrc] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled =
      false;

    let objectUrl:
      string | null =
      null;

    void ForensicDamagePhotoService
      .getObjectUrl(photo.id)
      .then((url) => {
        objectUrl =
          url;

        if (!cancelled) {
          setSrc(url);
        } else if (url) {
          URL.revokeObjectURL(url);
        }
      })
      .catch((error) => {
        console.error(
          "Failed to load damage photograph:",
          error,
        );
      });

    return () => {
      cancelled =
        true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );
      }
    };
  }, [photo.id]);

  return (
    <div className="fv2-damage-photo-thumb">
      {src ? (
        <img
          src={src}
          alt={photo.fileName}
        />
      ) : (
        <div className="fv2-damage-photo-loading">
          Loading photo...
        </div>
      )}
    </div>
  );
}

export default function ForensicInvestigationWorkspace({
  accidentCase,
  initialInvestigation,
  onExit,
}: Props) {
  const [investigation, setInvestigation] = useState(initialInvestigation);
  const [section, setSection] = useState<Section>("Overview");
  const [message, setMessage] = useState("");
  const [persistenceStatus, setPersistenceStatus] =
    useState<"saving" | "saved" | "error">("saved");
  const [persistenceError, setPersistenceError] =
    useState("");
  const hasMountedRef = useRef(false);
  const [source, setSource] = useState<EvidenceSource>("Crime Scene");
  const [type, setType] = useState<PhysicalEvidenceType>("Skid Mark");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [provenance, setProvenance] = useState<ForensicProvenance>("Observed");
  const [confidence, setConfidence] = useState<ForensicConfidence>("Unverified");
  const [notes, setNotes] = useState("");
  const [evidenceX, setEvidenceX] = useState("");
  const [evidenceY, setEvidenceY] = useState("");
  const [evidenceZ, setEvidenceZ] = useState("");
  const [evidenceAccuracy, setEvidenceAccuracy] = useState("");

  const [measurementCategory, setMeasurementCategory] =
    useState<MeasurementCategory>("Distance");
  const [measurementLabel, setMeasurementLabel] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("m");
  const [measurementMethod, setMeasurementMethod] = useState("");
  const [measurementLocation, setMeasurementLocation] = useState("");
  const [measurementProvenance, setMeasurementProvenance] =
    useState<"Measured" | "Imported" | "Calculated">("Measured");
  const [measurementConfidence, setMeasurementConfidence] =
    useState<ForensicConfidence>("Unverified");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [linkedEvidenceIds, setLinkedEvidenceIds] =
    useState<Set<string>>(new Set());

  const [manualSceneChoices, setManualSceneChoices] =
    useState<Set<SceneChoiceKey>>(() => {
      const manual = new Set<SceneChoiceKey>();

      for (const key of Object.keys(SCENE_CHOICE_OPTIONS) as SceneChoiceKey[]) {
        const value = String(initialInvestigation.scene[key] ?? "");

        if (
          value.trim() &&
          !findPresetChoice(key, value)
        ) {
          manual.add(key);
        }
      }

      return manual;
    });

  const [manualMeasurementChoices, setManualMeasurementChoices] =
    useState<Set<MeasurementChoiceKey>>(new Set());

  const [vehicleLabel, setVehicleLabel] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleMakeModel, setVehicleMakeModel] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleInspectionStatus, setVehicleInspectionStatus] =
    useState<VehicleInspectionStatus>("Not examined");
  const [vehicleScenePosition, setVehicleScenePosition] = useState("");
  const [vehicleMechanicalFinding, setVehicleMechanicalFinding] = useState("");
  const [vehicleDamageSeverity, setVehicleDamageSeverity] = useState("Not yet assessed");
  const [vehicleDamageDescription, setVehicleDamageDescription] = useState("");
  const [vehicleDamagePhotos, setVehicleDamagePhotos] =
    useState<ForensicVehicleDamagePhotoRef[]>([]);
  const [vehicleDamagePhotoBusy, setVehicleDamagePhotoBusy] =
    useState(false);
  const [vehicleTraceNotes, setVehicleTraceNotes] = useState("");
  const [vehicleDamageAreas, setVehicleDamageAreas] =
    useState<Set<VehicleDamageArea>>(new Set());
  const [vehicleTraceTypes, setVehicleTraceTypes] =
    useState<Set<VehicleTraceType>>(new Set());
  const [vehicleEvidenceIds, setVehicleEvidenceIds] =
    useState<Set<string>>(new Set());
  const [vehicleProvenance, setVehicleProvenance] =
    useState<ForensicProvenance>("Observed");
  const [vehicleConfidence, setVehicleConfidence] =
    useState<ForensicConfidence>("Unverified");
  const [manualVehicleChoices, setManualVehicleChoices] =
    useState<Set<VehicleChoiceKey>>(new Set());

  const selectedVehicleDamageAreas =
    VEHICLE_DAMAGE_AREA_OPTIONS.filter(
      (area) =>
        vehicleDamageAreas.has(area),
    );

  const getDamagePhotosForArea = (
    area: VehicleDamageArea,
  ) =>
    vehicleDamagePhotos.filter(
      (photo) =>
        photo.damageArea === area,
    );

  const generalVehicleDamagePhotos =
    vehicleDamagePhotos.filter(
      (photo) => !photo.damageArea,
    );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;

      if (
        !ForensicInvestigationService.isLocalPersistenceAvailable()
      ) {
        setPersistenceStatus("error");
        setPersistenceError(
          "Browser local storage is unavailable. Changes cannot survive a refresh.",
        );
      }

      return;
    }

    setPersistenceStatus("saving");
    setPersistenceError("");

    const timer =
      window.setTimeout(
        () => {
          try {
            const saved =
              ForensicInvestigationService.save(
                investigation,
              );

            const readBack =
              ForensicInvestigationService.getByCaseId(
                saved.caseId,
              );

            if (!readBack) {
              throw new Error(
                "Saved investigation could not be read back.",
              );
            }

            setPersistenceStatus("saved");
          } catch (error) {
            console.error(
              "Forensic investigation auto-save failed:",
              error,
            );

            setPersistenceStatus("error");
            setPersistenceError(
              error instanceof Error
                ? error.message
                : "The forensic investigation could not be saved.",
            );
          }
        },
        350,
      );

    return () =>
      window.clearTimeout(timer);
  }, [investigation]);

  const completion = useMemo(() => {
    const fields = [
      investigation.scene.location,
      investigation.scene.accidentDate,
      investigation.scene.accidentTime,
      investigation.scene.weather,
      investigation.scene.lighting,
      investigation.scene.roadCondition,
      investigation.scene.trafficControlState,
      investigation.scene.roadGeometry,
    ];
    const done = fields.filter((value) => value.trim()).length;
    return Math.round((done / fields.length) * 100);
  }, [investigation.scene]);

  const positionedEvidence = useMemo(
    () => investigation.evidence.filter((record) => record.spatialPosition),
    [investigation.evidence],
  );

  const planBounds = useMemo(() => {
    if (positionedEvidence.length === 0) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }

    const xs = positionedEvidence.map((record) => record.spatialPosition!.xMetres);
    const ys = positionedEvidence.map((record) => record.spatialPosition!.yMetres);

    let minX = Math.min(0, ...xs);
    let maxX = Math.max(0, ...xs);
    let minY = Math.min(0, ...ys);
    let maxY = Math.max(0, ...ys);

    const padX = Math.max(3, (maxX - minX) * 0.15);
    const padY = Math.max(3, (maxY - minY) * 0.15);

    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;

    return { minX, maxX, minY, maxY };
  }, [positionedEvidence]);

  const saveScene = () => {
    try {
      setPersistenceStatus("saving");
      setPersistenceError("");

      const saved =
        ForensicInvestigationService.save({
          ...investigation,
          scene: {
            ...investigation.scene,
            lastUpdatedAt:
              new Date().toISOString(),
          },
        });

      setInvestigation(saved);
      setPersistenceStatus("saved");
      setMessage("Scene intake saved locally.");
    } catch (error) {
      console.error(
        "Scene intake save failed:",
        error,
      );

      setPersistenceStatus("error");
      setPersistenceError(
        error instanceof Error
          ? error.message
          : "Scene intake could not be saved.",
      );
      setMessage(
        "Scene intake could not be saved.",
      );
    }
  };

  const addEvidence = () => {
    if (!description.trim() || !location.trim()) {
      setMessage("Evidence needs both a description and exact location/reference.");
      return;
    }
    const parsedX = evidenceX.trim() ? Number(evidenceX) : undefined;
    const parsedY = evidenceY.trim() ? Number(evidenceY) : undefined;

    if ((parsedX === undefined) !== (parsedY === undefined)) {
      setMessage("Enter both X and Y coordinates, or leave both blank.");
      return;
    }

    if (
      (parsedX !== undefined && !Number.isFinite(parsedX)) ||
      (parsedY !== undefined && !Number.isFinite(parsedY))
    ) {
      setMessage("Evidence X/Y coordinates must be valid numbers.");
      return;
    }

    const parsedZ = evidenceZ.trim() ? Number(evidenceZ) : undefined;
    const parsedAccuracy = evidenceAccuracy.trim()
      ? Number(evidenceAccuracy)
      : undefined;

    const saved = ForensicInvestigationService.addEvidence(investigation, {
      source,
      type,
      description: description.trim(),
      locationDescription: location.trim(),
      spatialPosition:
        parsedX !== undefined && parsedY !== undefined
          ? {
              xMetres: parsedX,
              yMetres: parsedY,
              zMetres:
                parsedZ !== undefined && Number.isFinite(parsedZ)
                  ? parsedZ
                  : undefined,
              accuracyMetres:
                parsedAccuracy !== undefined && Number.isFinite(parsedAccuracy)
                  ? parsedAccuracy
                  : undefined,
              datumLabel: investigation.scene.sceneDatumLabel || undefined,
            }
          : undefined,
      provenance,
      confidence,
      collected: false,
      notes: notes.trim(),
    });
    setInvestigation(saved);
    setDescription("");
    setLocation("");
    setNotes("");
    setEvidenceX("");
    setEvidenceY("");
    setEvidenceZ("");
    setEvidenceAccuracy("");
    setMessage("Evidence registered.");
  };

  const addMeasurement = () => {
    if (!measurementLabel.trim()) {
      setMessage("Measurement needs a label.");
      return;
    }

    const value = Number(measurementValue);
    if (!measurementValue.trim() || !Number.isFinite(value)) {
      setMessage("Measurement value must be numeric.");
      return;
    }

    if (!measurementMethod.trim()) {
      setMessage("Record the measurement method or source.");
      return;
    }

    const saved = ForensicInvestigationService.addMeasurement(
      investigation,
      {
        category: measurementCategory,
        label: measurementLabel.trim(),
        value,
        unit: measurementUnit,
        method: measurementMethod.trim(),
        locationDescription: measurementLocation.trim(),
        sourceEvidenceIds: [...linkedEvidenceIds],
        provenance: measurementProvenance,
        confidence: measurementConfidence,
        notes: measurementNotes.trim(),
      },
    );

    setInvestigation(saved);
    setMeasurementLabel("");
    setMeasurementValue("");
    setMeasurementMethod("");
    setMeasurementLocation("");
    setMeasurementNotes("");
    setLinkedEvidenceIds(new Set());
    setManualMeasurementChoices(new Set());
    setMessage("Measurement registered.");
  };

  const toggleLinkedEvidence = (evidenceId: string) => {
    setLinkedEvidenceIds((current) => {
      const next = new Set(current);
      if (next.has(evidenceId)) next.delete(evidenceId);
      else next.add(evidenceId);
      return next;
    });
  };

  const toggleVehicleDamageArea = (area: VehicleDamageArea) => {
    setVehicleDamageAreas((current) => {
      const next = new Set(current);

      if (next.has(area)) {
        next.delete(area);
        setVehicleDamagePhotos((photos) =>
          photos.map((photo) =>
            photo.damageArea === area
              ? { ...photo, damageArea: undefined }
              : photo,
          ),
        );
      } else {
        next.add(area);
      }

      return next;
    });
  };

  const toggleVehicleTraceType = (trace: VehicleTraceType) => {
    setVehicleTraceTypes((current) => {
      const next = new Set(current);
      if (next.has(trace)) next.delete(trace);
      else next.add(trace);
      return next;
    });
  };

  const toggleVehicleEvidence = (evidenceId: string) => {
    setVehicleEvidenceIds((current) => {
      const next = new Set(current);
      if (next.has(evidenceId)) next.delete(evidenceId);
      else next.add(evidenceId);
      return next;
    });
  };

  const addVehicleDamagePhotos = async (
    files: FileList | null,
    damageArea?: VehicleDamageArea,
  ) => {
    if (!files?.length) {
      return;
    }

    const selected =
      Array.from(files);

    if (
      vehicleDamagePhotos.length +
        selected.length >
      12
    ) {
      setMessage(
        "You can attach up to 12 damage photographs to one vehicle examination.",
      );
      return;
    }

    setVehicleDamagePhotoBusy(
      true,
    );

    try {
      const stored =
        await ForensicDamagePhotoService.storeFiles(
          selected,
        );

      const tagged =
        stored.map((photo) => ({
          ...photo,
          damageArea,
        }));

      setVehicleDamagePhotos(
        (current) => [
          ...current,
          ...tagged,
        ],
      );

      if (damageArea) {
        setVehicleDamageAreas((current) => {
          const next = new Set(current);
          next.add(damageArea);
          return next;
        });
      }

      setMessage(
        `${tagged.length} damage photograph${tagged.length === 1 ? "" : "s"} attached${damageArea ? ` to ${damageArea}` : ""}.`,
      );
    } catch (error) {
      console.error(
        "Failed to store vehicle damage photograph:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "The damage photograph could not be stored.",
      );
    } finally {
      setVehicleDamagePhotoBusy(
        false,
      );
    }
  };

  const removeDraftVehicleDamagePhoto = async (
    photoId: string,
  ) => {
    setVehicleDamagePhotoBusy(
      true,
    );

    try {
      await ForensicDamagePhotoService.deletePhoto(
        photoId,
      );

      setVehicleDamagePhotos(
        (current) =>
          current.filter(
            (photo) =>
              photo.id !==
              photoId,
          ),
      );
    } catch (error) {
      console.error(
        "Failed to remove vehicle damage photograph:",
        error,
      );

      setMessage(
        "The damage photograph could not be removed.",
      );
    } finally {
      setVehicleDamagePhotoBusy(
        false,
      );
    }
  };

  const addVehicle = () => {
    if (!vehicleLabel.trim()) {
      setMessage("Give the vehicle a case label, for example Vehicle A.");
      return;
    }

    if (!vehicleType.trim()) {
      setMessage("Select or enter the vehicle type.");
      return;
    }

    const damageAreasWithoutPhoto =
      [...vehicleDamageAreas].filter(
        (area) =>
          getDamagePhotosForArea(area)
            .length === 0,
      );

    if (
      damageAreasWithoutPhoto.length > 0
    ) {
      setMessage(
        `Attach at least one photograph for: ${damageAreasWithoutPhoto.join(", ")}.`,
      );
      return;
    }

    const saved = ForensicInvestigationService.addVehicle(
      investigation,
      {
        label: vehicleLabel.trim(),
        registration: vehicleRegistration.trim(),
        makeModel: vehicleMakeModel.trim(),
        vehicleType: vehicleType.trim(),
        inspectionStatus: vehicleInspectionStatus,
        scenePositionSummary: vehicleScenePosition.trim(),
        mechanicalFinding: vehicleMechanicalFinding.trim(),
        damageAreas: [...vehicleDamageAreas],
        damageSeverity: vehicleDamageSeverity,
        damageDescription: vehicleDamageDescription.trim(),
        damagePhotos: [...vehicleDamagePhotos],
        traceTypes: [...vehicleTraceTypes],
        traceNotes: vehicleTraceNotes.trim(),
        sourceEvidenceIds: [...vehicleEvidenceIds],
        provenance: vehicleProvenance,
        confidence: vehicleConfidence,
      },
    );

    setInvestigation(saved);
    setVehicleLabel("");
    setVehicleRegistration("");
    setVehicleMakeModel("");
    setVehicleType("");
    setVehicleInspectionStatus("Not examined");
    setVehicleScenePosition("");
    setVehicleMechanicalFinding("");
    setVehicleDamageSeverity("Not yet assessed");
    setVehicleDamageDescription("");
    setVehicleDamagePhotos([]);
    setVehicleTraceNotes("");
    setVehicleDamageAreas(new Set());
    setVehicleTraceTypes(new Set());
    setVehicleEvidenceIds(new Set());
    setVehicleProvenance("Observed");
    setVehicleConfidence("Unverified");
    setManualVehicleChoices(new Set());
    setMessage("Vehicle examination record added.");
  };

  const field = (
    label: string,
    key: keyof typeof investigation.scene,
    placeholder = "",
  ) => (
    <label className="fv2-field">
      <span>{label}</span>
      <input
        value={String(investigation.scene[key] ?? "")}
        placeholder={placeholder}
        onChange={(event) =>
          setInvestigation((current) => ({
            ...current,
            scene: { ...current.scene, [key]: event.target.value },
          }))
        }
      />
    </label>
  );

  const sceneChoiceField = (
    label: string,
    key: SceneChoiceKey,
    manualPlaceholder: string,
  ) => {
    const currentValue =
      String(investigation.scene[key] ?? "");

    const preset =
      findPresetChoice(
        key,
        currentValue,
      );

    const manual =
      manualSceneChoices.has(key) ||
      (
        currentValue.trim().length > 0 &&
        !preset
      );

    const selectedValue =
      manual
        ? OTHER_CHOICE
        : preset ?? "";

    return (
      <label className="fv2-field">
        <span>{label}</span>

        <select
          value={selectedValue}
          onChange={(event) => {
            const value =
              event.target.value;

            if (value === OTHER_CHOICE) {
              setManualSceneChoices((current) => {
                const next =
                  new Set(current);

                next.add(key);

                return next;
              });

              setInvestigation((current) => ({
                ...current,
                scene: {
                  ...current.scene,
                  [key]: "",
                },
              }));

              return;
            }

            setManualSceneChoices((current) => {
              const next =
                new Set(current);

              next.delete(key);

              return next;
            });

            setInvestigation((current) => ({
              ...current,
              scene: {
                ...current.scene,
                [key]: value,
              },
            }));
          }}
        >
          <option value="">
            Select...
          </option>

          {SCENE_CHOICE_OPTIONS[key].map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ),
          )}

          <option value={OTHER_CHOICE}>
            Other / specify manually
          </option>
        </select>

        {manual && (
          <input
            value={currentValue}
            placeholder={manualPlaceholder}
            onChange={(event) => {
              setManualSceneChoices((current) => {
                const next =
                  new Set(current);

                next.add(key);

                return next;
              });

              setInvestigation((current) => ({
                ...current,
                scene: {
                  ...current.scene,
                  [key]: event.target.value,
                },
              }));
            }}
          />
        )}
      </label>
    );
  };

  const vehicleChoiceField = (
    label: string,
    key: VehicleChoiceKey,
    value: string,
    setValue: (value: string) => void,
    options: readonly string[],
    manualPlaceholder: string,
  ) => {
    const preset = findOption(options, value);
    const manual =
      manualVehicleChoices.has(key) ||
      (value.trim().length > 0 && !preset);
    const selectedValue = manual ? OTHER_CHOICE : preset ?? "";

    return (
      <label className="fv2-field full">
        <span>{label}</span>
        <select
          value={selectedValue}
          onChange={(event) => {
            const nextValue = event.target.value;

            if (nextValue === OTHER_CHOICE) {
              setManualVehicleChoices((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
              });
              setValue("");
              return;
            }

            setManualVehicleChoices((current) => {
              const next = new Set(current);
              next.delete(key);
              return next;
            });
            setValue(nextValue);
          }}
        >
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
          <option value={OTHER_CHOICE}>Other / specify manually</option>
        </select>

        {manual && (
          <input
            value={value}
            placeholder={manualPlaceholder}
            onChange={(event) => {
              setManualVehicleChoices((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
              });
              setValue(event.target.value);
            }}
          />
        )}
      </label>
    );
  };

  const measurementChoiceField = (
    label: string,
    key: MeasurementChoiceKey,
    value: string,
    setValue: (value: string) => void,
    options: readonly string[],
    manualPlaceholder: string,
    className = "fv2-field full",
  ) => {
    const preset =
      findMeasurementChoice(
        options,
        value,
      );

    const manual =
      manualMeasurementChoices.has(key) ||
      (
        value.trim().length > 0 &&
        !preset
      );

    const selectedValue =
      manual
        ? OTHER_CHOICE
        : preset ?? "";

    return (
      <label className={className}>
        <span>{label}</span>

        <select
          value={selectedValue}
          onChange={(event) => {
            const nextValue =
              event.target.value;

            if (nextValue === OTHER_CHOICE) {
              setManualMeasurementChoices((current) => {
                const next =
                  new Set(current);

                next.add(key);

                return next;
              });

              setValue("");
              return;
            }

            setManualMeasurementChoices((current) => {
              const next =
                new Set(current);

              next.delete(key);

              return next;
            });

            setValue(nextValue);
          }}
        >
          <option value="">
            Select...
          </option>

          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}

          <option value={OTHER_CHOICE}>
            Other / specify manually
          </option>
        </select>

        {manual && (
          <input
            value={value}
            placeholder={manualPlaceholder}
            onChange={(event) => {
              setManualMeasurementChoices((current) => {
                const next =
                  new Set(current);

                next.add(key);

                return next;
              });

              setValue(event.target.value);
            }}
          />
        )}
      </label>
    );
  };

  return (
    <div className="fv2-root">
      <header className="fv2-topbar">
        <div>
          <b>ROADSAFE</b>
          <span>Forensic Accident Workspace</span>
          <small>{accidentCase.caseNumber} · {accidentCase.title}</small>
        </div>
        <div className="fv2-topbar-actions">
          <div
            className={`fv2-save-status ${persistenceStatus}`}
            title={persistenceError || "Forensic investigation local-save status"}
          >
            <span />
            {persistenceStatus === "saving"
              ? "Saving..."
              : persistenceStatus === "error"
                ? "Save failed"
                : "Saved locally"}
          </div>

          <button onClick={onExit}>Return to case</button>
        </div>
      </header>

      <div className="fv2-layout">
        <aside className="fv2-sidebar">
          <div className="fv2-sidebar-title">Investigation <small>V2 evidence-first workflow</small></div>
          {SECTIONS.map((item) => (
            <button
              key={item}
              className={`${section === item ? "is-active" : ""} ${ACTIVE.has(item) ? "" : "is-future"}`}
              onClick={() => setSection(item)}
            >
              <span>{item}</span>
              <small>{ACTIVE.has(item) ? (item === "Vehicles" ? "Step 3" : "Ready") : "Later"}</small>
            </button>
          ))}
        </aside>

        <main className="fv2-main">
          {persistenceStatus === "error" && (
            <div className="fv2-persistence-error" role="alert">
              <strong>Local save failed.</strong>
              <span>
                {persistenceError ||
                  "Changes may be lost after refresh. Check browser storage settings."}
              </span>
            </div>
          )}

          {message && <div className="fv2-message">{message}<button onClick={() => setMessage("")}>×</button></div>}

          {section === "Overview" && (
            <div className="fv2-stack">
              <section className="fv2-hero">
                <div>
                  <small>RoadSafe Forensic Reconstruction V2</small>
                  <h1>Evidence before reconstruction</h1>
                  <p>Scene preservation and physical evidence now come first. Physics, 2D, 3D and AR will be generated later as analytical outputs, not treated as the starting truth.</p>
                </div>
                <strong>STEP 2<br /><span>MEASURE + POSITION</span></strong>
              </section>

              <div className="fv2-stats">
                <article><span>Scene intake</span><strong>{completion}%</strong><small>core scene fields</small></article>
                <article><span>Evidence</span><strong>{investigation.evidence.length}</strong><small>registered items</small></article>
                <article><span>Positioned evidence</span><strong>{positionedEvidence.length}</strong><small>items with X/Y scene coordinates</small></article>
                <article><span>Measurements</span><strong>{investigation.measurements.length}</strong><small>quantitative records</small></article>
              </div>

              <section className="fv2-panel">
                <header><span>Forensic provenance</span><strong>Every fact must say where it came from</strong></header>
                <div className="fv2-tags">
                  {FORENSIC_PROVENANCE_OPTIONS.map((item) => <span key={item} className={isDerived(item) ? "derived" : ""}>{item}</span>)}
                </div>
              </section>
            </div>
          )}

          {section === "Scene Intake" && (
            <section className="fv2-panel">
              <header><div><span>Scene preservation</span><strong>Initial scene intake</strong></div><button className="primary" onClick={saveScene}>Save scene intake</button></header>
              <div className="fv2-grid">
                {field("Accident location", "location")}
                <label className="fv2-field"><span>Date</span><input type="date" value={investigation.scene.accidentDate} onChange={(e) => setInvestigation((c) => ({...c, scene:{...c.scene, accidentDate:e.target.value}}))} /></label>
                <label className="fv2-field"><span>Time</span><input type="time" value={investigation.scene.accidentTime} onChange={(e) => setInvestigation((c) => ({...c, scene:{...c.scene, accidentTime:e.target.value}}))} /></label>
                {sceneChoiceField(
                  "Weather",
                  "weather",
                  "Enter another weather condition...",
                )}
                {sceneChoiceField(
                  "Lighting",
                  "lighting",
                  "Enter another lighting condition...",
                )}
                {sceneChoiceField(
                  "Road condition",
                  "roadCondition",
                  "Enter another road condition...",
                )}
                {sceneChoiceField(
                  "Traffic-control state",
                  "trafficControlState",
                  "Enter another traffic-control state...",
                )}
                {sceneChoiceField(
                  "Road geometry",
                  "roadGeometry",
                  "Describe the road geometry...",
                )}
                <div className="fv2-field">
                  <span>Fixed reference point</span>
                  <input
                    value={String(investigation.scene.sceneDatumLabel ?? "")}
                    placeholder="e.g. Base of lamp post beside the junction"
                    onChange={(event) =>
                      setInvestigation((current) => ({
                        ...current,
                        scene: {
                          ...current.scene,
                          sceneDatumLabel: event.target.value,
                        },
                      }))
                    }
                  />
                  <small className="fv2-help">
                    Choose one permanent object at the scene that all distances will be measured from.
                  </small>
                </div>

                <div className="fv2-field">
                  <span>Measurement directions</span>
                  <input
                    value={String(investigation.scene.coordinateNotes ?? "")}
                    placeholder="e.g. Along the road toward Bindura = forward; across the road = left/right"
                    onChange={(event) =>
                      setInvestigation((current) => ({
                        ...current,
                        scene: {
                          ...current.scene,
                          coordinateNotes: event.target.value,
                        },
                      }))
                    }
                  />
                  <small className="fv2-help">
                    Explain which way you will measure along and across the road.
                  </small>
                </div>
                <label className="fv2-field full"><span>Preservation / scene notes</span><textarea rows={7} value={investigation.scene.preservationNotes} onChange={(e) => setInvestigation((c) => ({...c, scene:{...c.scene, preservationNotes:e.target.value}}))} placeholder="Record what was present before anything was moved, collected or towed." /></label>
              </div>
            </section>
          )}

          {section === "Evidence Registry" && (
            <div className="fv2-stack">
              <section className="fv2-panel">
                <header><span>Physical evidence</span><strong>Add evidence record</strong></header>
                <div className="fv2-grid">
                  <label className="fv2-field"><span>Source</span><select value={source} onChange={(e) => setSource(e.target.value as EvidenceSource)}>{EVIDENCE_SOURCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field"><span>Evidence type</span><select value={type} onChange={(e) => setType(e.target.value as PhysicalEvidenceType)}>{PHYSICAL_EVIDENCE_TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field full"><span>Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was observed?" /></label>
                  <label className="fv2-field full"><span>Exact location / reference</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where was it found? Include fixed reference points where possible." /></label>
                  <div className="fv2-field full">
                    <span>Spatial position relative to scene datum (optional)</span>
                    <div className="fv2-coordinates">
                      <label><span>Along road (m)</span><input inputMode="decimal" value={evidenceX} onChange={(e) => setEvidenceX(e.target.value)} /></label>
                      <label><span>Across road (m)</span><input inputMode="decimal" value={evidenceY} onChange={(e) => setEvidenceY(e.target.value)} /></label>
                      <label><span>Z (m)</span><input inputMode="decimal" value={evidenceZ} onChange={(e) => setEvidenceZ(e.target.value)} /></label>
                      <label><span>Accuracy ± m</span><input inputMode="decimal" value={evidenceAccuracy} onChange={(e) => setEvidenceAccuracy(e.target.value)} /></label>
                    </div>
                    <small className="fv2-help">
                      Measured from: {investigation.scene.sceneDatumLabel || "reference point not set yet"}
                    </small>
                  </div>
                  <label className="fv2-field"><span>Provenance</span><select value={provenance} onChange={(e) => setProvenance(e.target.value as ForensicProvenance)}>{FORENSIC_PROVENANCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field"><span>Confidence</span><select value={confidence} onChange={(e) => setConfidence(e.target.value as ForensicConfidence)}>{FORENSIC_CONFIDENCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field full"><span>Notes</span><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
                </div>
                <footer><button className="primary" onClick={addEvidence}>Add evidence</button></footer>
              </section>

              <section className="fv2-panel">
                <header><span>Evidence register</span><strong>{investigation.evidence.length} item(s)</strong></header>
                {investigation.evidence.length === 0 ? <div className="fv2-empty">No evidence registered yet.</div> : (
                  <div className="fv2-tablewrap"><table><thead><tr><th>ID</th><th>Type</th><th>Description</th><th>Location</th><th>X / Y</th><th>Provenance</th><th>Confidence</th><th /></tr></thead><tbody>
                    {investigation.evidence.map((record) => <tr key={record.id}>
                      <td><b>{record.code}</b></td><td>{record.type}<small>{record.source}</small></td><td>{record.description}</td><td>{record.locationDescription}</td><td>{record.spatialPosition ? `${record.spatialPosition.xMetres.toFixed(2)}, ${record.spatialPosition.yMetres.toFixed(2)} m` : "—"}</td><td><span className={`tag ${isDerived(record.provenance) ? "derived" : ""}`}>{record.provenance}</span></td><td>{record.confidence}</td><td><button className="danger" onClick={() => setInvestigation(ForensicInvestigationService.deleteEvidence(investigation, record.id))}>Remove</button></td>
                    </tr>)}
                  </tbody></table></div>
                )}
              </section>
            </div>
          )}

          {section === "Measurements" && (
            <div className="fv2-stack">
              <section className="fv2-panel">
                <header>
                  <div>
                    <span>Forensic measurements</span>
                    <strong>Add quantitative measurement</strong>
                  </div>
                </header>

                <div className="fv2-grid">
                  <label className="fv2-field">
                    <span>Category</span>
                    <select
                      value={measurementCategory}
                      onChange={(e) =>
                        setMeasurementCategory(
                          e.target.value as MeasurementCategory,
                        )
                      }
                    >
                      {MEASUREMENT_CATEGORY_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field">
                    <span>Label</span>
                    <input
                      value={measurementLabel}
                      onChange={(e) => setMeasurementLabel(e.target.value)}
                      placeholder="e.g. Vehicle A skid mark length"
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Value</span>
                    <input
                      inputMode="decimal"
                      value={measurementValue}
                      onChange={(e) => setMeasurementValue(e.target.value)}
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Unit</span>
                    <select
                      value={measurementUnit}
                      onChange={(e) => setMeasurementUnit(e.target.value)}
                    >
                      {MEASUREMENT_UNIT_OPTIONS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  {measurementChoiceField(
                    "Measurement method / source",
                    "method",
                    measurementMethod,
                    setMeasurementMethod,
                    MEASUREMENT_METHOD_OPTIONS,
                    "e.g. drone photogrammetry, CAD back-calculation, officer estimate...",
                  )}

                  {measurementChoiceField(
                    "Location / reference description",
                    "location",
                    measurementLocation,
                    setMeasurementLocation,
                    MEASUREMENT_LOCATION_OPTIONS,
                    "e.g. skid onset to final visible tyre mark on southbound lane",
                  )}

                  <label className="fv2-field">
                    <span>Provenance</span>
                    <select
                      value={measurementProvenance}
                      onChange={(e) =>
                        setMeasurementProvenance(
                          e.target.value as "Measured" | "Imported" | "Calculated",
                        )
                      }
                    >
                      <option>Measured</option>
                      <option>Imported</option>
                      <option>Calculated</option>
                    </select>
                  </label>

                  <label className="fv2-field">
                    <span>Confidence</span>
                    <select
                      value={measurementConfidence}
                      onChange={(e) =>
                        setMeasurementConfidence(
                          e.target.value as ForensicConfidence,
                        )
                      }
                    >
                      {FORENSIC_CONFIDENCE_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <div className="fv2-field full">
                    <span>Link supporting evidence</span>
                    {investigation.evidence.length === 0 ? (
                      <div className="fv2-empty-select">
                        Add evidence first if this measurement comes from physical evidence.
                      </div>
                    ) : (
                      <div className="fv2-evidence-select">
                        {investigation.evidence.map((record) => (
                          <label key={record.id}>
                            <input
                              type="checkbox"
                              checked={linkedEvidenceIds.has(record.id)}
                              onChange={() => toggleLinkedEvidence(record.id)}
                            />
                            <span><b>{record.code}</b> {record.type} · {record.description}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="fv2-field full">
                    <span>Notes</span>
                    <textarea
                      rows={4}
                      value={measurementNotes}
                      onChange={(e) => setMeasurementNotes(e.target.value)}
                    />
                  </label>
                </div>

                <footer>
                  <button className="primary" onClick={addMeasurement}>
                    Add measurement
                  </button>
                </footer>
              </section>

              <section className="fv2-panel">
                <header>
                  <span>Measurement register</span>
                  <strong>{investigation.measurements.length} record(s)</strong>
                </header>

                {investigation.measurements.length === 0 ? (
                  <div className="fv2-empty">No measurements registered yet.</div>
                ) : (
                  <div className="fv2-tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Category</th>
                          <th>Measurement</th>
                          <th>Method</th>
                          <th>Evidence</th>
                          <th>Provenance</th>
                          <th>Confidence</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {investigation.measurements.map((record) => (
                          <tr key={record.id}>
                            <td><b>{record.code}</b></td>
                            <td>{record.category}</td>
                            <td><b>{record.value} {record.unit}</b><small>{record.label}</small></td>
                            <td>{record.method}<small>{record.locationDescription}</small></td>
                            <td>
                              {record.sourceEvidenceIds.length
                                ? record.sourceEvidenceIds
                                    .map((id) =>
                                      investigation.evidence.find(
                                        (evidence) => evidence.id === id,
                                      )?.code ?? id,
                                    )
                                    .join(", ")
                                : "—"}
                            </td>
                            <td><span className={`tag ${record.provenance === "Calculated" ? "derived" : ""}`}>{record.provenance}</span></td>
                            <td>{record.confidence}</td>
                            <td>
                              <button
                                className="danger"
                                onClick={() =>
                                  setInvestigation(
                                    ForensicInvestigationService.deleteMeasurement(
                                      investigation,
                                      record.id,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="fv2-panel">
                <header>
                  <div>
                    <span>Spatial evidence plan</span>
                    <strong>Local scene datum + positioned evidence</strong>
                  </div>
                  <small className="fv2-plan-datum">
                    Reference point: {investigation.scene.sceneDatumLabel || "not set"}
                  </small>
                </header>

                <div className="fv2-plan-wrap">
                  <svg
                    className="fv2-plan"
                    viewBox="0 0 900 460"
                    role="img"
                    aria-label="Local forensic evidence position plan"
                  >
                    <defs>
                      <pattern id="fv2-grid" width="45" height="45" patternUnits="userSpaceOnUse">
                        <path d="M 45 0 L 0 0 0 45" fill="none" stroke="#3d3d3d" strokeWidth="1" />
                      </pattern>
                    </defs>

                    <rect width="900" height="460" fill="#252525" />
                    <rect width="900" height="460" fill="url(#fv2-grid)" />

                    {(() => {
                      const rangeX = Math.max(1, planBounds.maxX - planBounds.minX);
                      const rangeY = Math.max(1, planBounds.maxY - planBounds.minY);
                      const sx = (x: number) => ((x - planBounds.minX) / rangeX) * 900;
                      const sy = (y: number) => 460 - ((y - planBounds.minY) / rangeY) * 460;
                      const datumX = sx(0);
                      const datumY = sy(0);

                      return (
                        <>
                          <line x1={datumX} y1="0" x2={datumX} y2="460" stroke="#656565" strokeDasharray="4 5" />
                          <line x1="0" y1={datumY} x2="900" y2={datumY} stroke="#656565" strokeDasharray="4 5" />
                          <circle cx={datumX} cy={datumY} r="6" fill="#202020" stroke="#e8872d" strokeWidth="2" />
                          <text x={datumX + 10} y={datumY - 10} fill="#e7b783" fontSize="12" fontWeight="700">
                            START 0,0
                          </text>

                          {positionedEvidence.map((record, index) => {
                            const position = record.spatialPosition!;
                            const x = sx(position.xMetres);
                            const y = sy(position.yMetres);
                            const colours = ["#e8872d", "#6f9f96", "#d6b46b", "#b68ac4", "#89a7c2"];
                            const colour = colours[index % colours.length];

                            return (
                              <g key={record.id}>
                                <line x1={x - 8} y1={y} x2={x + 8} y2={y} stroke={colour} strokeWidth="2" />
                                <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke={colour} strokeWidth="2" />
                                <circle cx={x} cy={y} r="4" fill={colour} />
                                <text x={x + 10} y={y - 8} fill="#ededed" fontSize="12" fontWeight="700">{record.code}</text>
                                <text x={x + 10} y={y + 8} fill="#8e8e8e" fontSize="10">
                                  {position.xMetres.toFixed(2)}, {position.yMetres.toFixed(2)} m
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>

                  {positionedEvidence.length === 0 && (
                    <div className="fv2-plan-empty">
                      Add X/Y coordinates to evidence records to populate the scene plan.
                    </div>
                  )}
                </div>

                <div className="fv2-plan-footer">
                  <span>X {planBounds.minX.toFixed(1)}…{planBounds.maxX.toFixed(1)} m</span>
                  <span>Y {planBounds.minY.toFixed(1)}…{planBounds.maxY.toFixed(1)} m</span>
                  <span>{investigation.scene.coordinateNotes || "Measurement directions not recorded"}</span>
                </div>
              </section>
            </div>
          )}

          {section === "Vehicles" && (
            <div className="fv2-stack">
              <section className="fv2-panel">
                <header>
                  <div>
                    <span>Vehicle examination</span>
                    <strong>Record the vehicle before reconstruction assumptions</strong>
                  </div>
                </header>

                <div className="fv2-grid">
                  <label className="fv2-field">
                    <span>Case vehicle label</span>
                    <input
                      value={vehicleLabel}
                      onChange={(e) => setVehicleLabel(e.target.value)}
                      placeholder="e.g. Vehicle A"
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Registration number</span>
                    <input
                      value={vehicleRegistration}
                      onChange={(e) => setVehicleRegistration(e.target.value)}
                      placeholder="e.g. ABC 1234"
                    />
                  </label>

                  <label className="fv2-field full">
                    <span>Make / model</span>
                    <input
                      value={vehicleMakeModel}
                      onChange={(e) => setVehicleMakeModel(e.target.value)}
                      placeholder="e.g. Toyota Corolla"
                    />
                  </label>

                  {vehicleChoiceField(
                    "Vehicle type",
                    "type",
                    vehicleType,
                    setVehicleType,
                    VEHICLE_TYPE_OPTIONS,
                    "Enter another vehicle type...",
                  )}

                  <label className="fv2-field full">
                    <span>Inspection stage</span>
                    <select
                      value={vehicleInspectionStatus}
                      onChange={(e) =>
                        setVehicleInspectionStatus(
                          e.target.value as VehicleInspectionStatus,
                        )
                      }
                    >
                      {VEHICLE_INSPECTION_STATUS_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  {vehicleChoiceField(
                    "Where the vehicle was found / resting",
                    "scenePosition",
                    vehicleScenePosition,
                    setVehicleScenePosition,
                    VEHICLE_SCENE_POSITION_OPTIONS,
                    "Describe where the vehicle was found...",
                  )}

                  {vehicleChoiceField(
                    "Main mechanical finding",
                    "mechanicalFinding",
                    vehicleMechanicalFinding,
                    setVehicleMechanicalFinding,
                    VEHICLE_MECHANICAL_FINDING_OPTIONS,
                    "Describe another mechanical finding...",
                  )}

                  <div className="fv2-field full">
                    <span>Visible damage areas</span>
                    <div className="fv2-check-grid fv2-damage-area-grid">
                      {VEHICLE_DAMAGE_AREA_OPTIONS.map((area) => {
                        const photoCount =
                          getDamagePhotosForArea(area).length;

                        const selected =
                          vehicleDamageAreas.has(area);

                        return (
                          <label
                            key={area}
                            className={selected ? "selected" : ""}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleVehicleDamageArea(area)}
                            />

                            <div className="fv2-damage-area-text">
                              <span>{area}</span>
                              <small>
                                {photoCount} photo{photoCount === 1 ? "" : "s"}
                              </small>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {selectedVehicleDamageAreas.length > 0 && (
                    <div className="fv2-field full fv2-damage-area-panel-wrap">
                      <span>Damage-area photographs</span>

                      <div className="fv2-damage-area-panel-grid">
                        {selectedVehicleDamageAreas.map((area) => {
                          const areaPhotos =
                            getDamagePhotosForArea(area);

                          return (
                            <section
                              key={area}
                              className="fv2-damage-area-panel"
                            >
                              <div className="fv2-damage-area-panel-header">
                                <div>
                                  <strong>{area}</strong>
                                  <small>
                                    {areaPhotos.length > 0
                                      ? `${areaPhotos.length} attached photo${areaPhotos.length === 1 ? "" : "s"}`
                                      : "Attach at least one photo for this damage area."}
                                  </small>
                                </div>

                                <label className="fv2-action-button fv2-photo-action-button">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    disabled={vehicleDamagePhotoBusy}
                                    onChange={(event) => {
                                      void addVehicleDamagePhotos(
                                        event.target.files,
                                        area,
                                      );

                                      event.currentTarget.value = "";
                                    }}
                                  />

                                  <span>
                                    {vehicleDamagePhotoBusy
                                      ? "Saving photos..."
                                      : areaPhotos.length > 0
                                        ? `Add more ${area} photos`
                                        : `Add ${area} photo`}
                                  </span>
                                </label>
                              </div>

                              {areaPhotos.length > 0 ? (
                                <div className="fv2-damage-photo-grid fv2-damage-photo-grid-single">
                                  {areaPhotos.map((photo) => (
                                    <article
                                      key={photo.id}
                                      className="fv2-damage-photo-card"
                                    >
                                      <DamagePhotoThumbnail
                                        photo={photo}
                                      />

                                      <div>
                                        <strong title={photo.fileName}>
                                          {photo.fileName}
                                        </strong>

                                        <small>
                                          {(photo.sizeBytes / 1024 / 1024).toFixed(2)} MB
                                        </small>
                                      </div>

                                      <button
                                        type="button"
                                        className="danger"
                                        disabled={vehicleDamagePhotoBusy}
                                        onClick={() => {
                                          void removeDraftVehicleDamagePhoto(
                                            photo.id,
                                          );
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <div className="fv2-inline-hint">
                                  No photo attached yet.
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="fv2-field full fv2-damage-photo-section">
                    <span>General / overview damage photographs (optional)</span>

                    <div className="fv2-damage-photo-upload">
                      <label className="fv2-action-button fv2-photo-action-button">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={vehicleDamagePhotoBusy}
                          onChange={(event) => {
                            void addVehicleDamagePhotos(
                              event.target.files,
                            );

                            event.currentTarget.value = "";
                          }}
                        />

                        <span>
                          {vehicleDamagePhotoBusy
                            ? "Saving photos..."
                            : "Choose photos"}
                        </span>
                      </label>

                      <small>
                        Use this for wide shots or overall damage views that are not tied to just one damage area. Up to 12 photos total per vehicle, 15 MB each.
                      </small>
                    </div>

                    {generalVehicleDamagePhotos.length > 0 && (
                      <div className="fv2-damage-photo-grid">
                        {generalVehicleDamagePhotos.map((photo) => (
                          <article
                            key={photo.id}
                            className="fv2-damage-photo-card"
                          >
                            <DamagePhotoThumbnail
                              photo={photo}
                            />

                            <div>
                              <strong title={photo.fileName}>
                                {photo.fileName}
                              </strong>

                              <small>
                                {(photo.sizeBytes / 1024 / 1024).toFixed(2)} MB
                              </small>
                            </div>

                            <button
                              type="button"
                              className="danger"
                              disabled={vehicleDamagePhotoBusy}
                              onClick={() => {
                                void removeDraftVehicleDamagePhoto(
                                  photo.id,
                                );
                              }}
                            >
                              Remove
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="fv2-field full">
                    <span>Damage severity</span>
                    <select
                      value={vehicleDamageSeverity}
                      onChange={(e) => setVehicleDamageSeverity(e.target.value)}
                    >
                      {VEHICLE_DAMAGE_SEVERITY_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field full">
                    <span>Damage notes</span>
                    <textarea
                      rows={4}
                      value={vehicleDamageDescription}
                      onChange={(e) => setVehicleDamageDescription(e.target.value)}
                      placeholder="Record shape, direction, height or unusual damage that photographs alone may not explain."
                    />
                  </label>

                  <div className="fv2-field full">
                    <span>Transferred / trace material found on vehicle</span>
                    <div className="fv2-check-grid">
                      {VEHICLE_TRACE_TYPE_OPTIONS.map((trace) => (
                        <label key={trace}>
                          <input
                            type="checkbox"
                            checked={vehicleTraceTypes.has(trace)}
                            onChange={() => toggleVehicleTraceType(trace)}
                          />
                          <span>{trace}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="fv2-field full">
                    <span>Trace evidence notes</span>
                    <textarea
                      rows={3}
                      value={vehicleTraceNotes}
                      onChange={(e) => setVehicleTraceNotes(e.target.value)}
                      placeholder="Only add details that cannot be captured by the selections above."
                    />
                  </label>

                  <div className="fv2-field full">
                    <span>Link supporting evidence</span>
                    {investigation.evidence.length === 0 ? (
                      <div className="fv2-empty-select">
                        Add evidence records first if photographs, fragments, paint, glass or other evidence support this examination.
                      </div>
                    ) : (
                      <div className="fv2-evidence-select">
                        {investigation.evidence.map((record) => (
                          <label key={record.id}>
                            <input
                              type="checkbox"
                              checked={vehicleEvidenceIds.has(record.id)}
                              onChange={() => toggleVehicleEvidence(record.id)}
                            />
                            <span><b>{record.code}</b> {record.type} · {record.description}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="fv2-field">
                    <span>Provenance</span>
                    <select
                      value={vehicleProvenance}
                      onChange={(e) => setVehicleProvenance(e.target.value as ForensicProvenance)}
                    >
                      {FORENSIC_PROVENANCE_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field">
                    <span>Confidence</span>
                    <select
                      value={vehicleConfidence}
                      onChange={(e) => setVehicleConfidence(e.target.value as ForensicConfidence)}
                    >
                      {FORENSIC_CONFIDENCE_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <footer>
                  <button className="primary" onClick={addVehicle}>
                    Add vehicle examination
                  </button>
                </footer>
              </section>

              <section className="fv2-panel">
                <header>
                  <span>Vehicle examination register</span>
                  <strong>{investigation.vehicles.length} vehicle(s)</strong>
                </header>

                {investigation.vehicles.length === 0 ? (
                  <div className="fv2-empty">No vehicles examined yet.</div>
                ) : (
                  <div className="fv2-tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Vehicle</th>
                          <th>Inspection</th>
                          <th>Damage</th>
                          <th>Trace evidence</th>
                          <th>Evidence links</th>
                          <th>Confidence</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {investigation.vehicles.map((record) => (
                          <tr key={record.id}>
                            <td><b>{record.code}</b></td>
                            <td>
                              <b>{record.label}</b>
                              <small>{record.vehicleType}</small>
                              <small>{record.registration || "No registration recorded"}</small>
                              <small>{record.makeModel || "Make/model not recorded"}</small>
                            </td>
                            <td>
                              {record.inspectionStatus}
                              <small>{record.scenePositionSummary || "Position not recorded"}</small>
                              <small>{record.mechanicalFinding || "Mechanical finding not recorded"}</small>
                            </td>
                            <td>
                              {record.damageSeverity}
                              <small>
                                {record.damageAreas.length
                                  ? record.damageAreas
                                      .map((area) => {
                                        const count =
                                          (record.damagePhotos ?? []).filter(
                                            (photo) => photo.damageArea === area,
                                          ).length;

                                        return count > 0
                                          ? `${area} (${count} photo${count === 1 ? "" : "s"})`
                                          : `${area} (no photo)`;
                                      })
                                      .join(", ")
                                  : "No areas selected"}
                              </small>
                              <small>
                                {record.damagePhotos?.length
                                  ? `${record.damagePhotos.length} damage photo${record.damagePhotos.length === 1 ? "" : "s"}`
                                  : "No damage photos"}
                              </small>

                              {record.damagePhotos?.length > 0 && (
                                <div className="fv2-damage-photo-mini-grid">
                                  {record.damagePhotos.slice(0, 3).map((photo) => (
                                    <DamagePhotoThumbnail
                                      key={photo.id}
                                      photo={photo}
                                    />
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {record.traceTypes.length ? record.traceTypes.join(", ") : "—"}
                            </td>
                            <td>
                              {record.sourceEvidenceIds.length
                                ? record.sourceEvidenceIds
                                    .map((id) =>
                                      investigation.evidence.find((e) => e.id === id)?.code ?? id,
                                    )
                                    .join(", ")
                                : "—"}
                            </td>
                            <td>{record.confidence}</td>
                            <td>
                              <button
                                className="danger"
                                onClick={() => {
                                  void Promise.all(
                                    (record.damagePhotos ?? []).map(
                                      (photo) =>
                                        ForensicDamagePhotoService
                                          .deletePhoto(photo.id)
                                          .catch((error) => {
                                            console.error(
                                              "Failed to remove stored damage photograph:",
                                              error,
                                            );
                                          }),
                                    ),
                                  );

                                  setInvestigation(
                                    ForensicInvestigationService.deleteVehicle(
                                      investigation,
                                      record.id,
                                    ),
                                  );
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="fv2-panel fv2-notice">
                <b>Forensic rule</b>
                <p>
                  A vehicle examination record describes what was found on the real vehicle. It does not yet create a 2D/3D participant, assign a crash speed or decide who was at fault.
                </p>
              </section>
            </div>
          )}

          {!ACTIVE.has(section) && (
            <section className="fv2-panel fv2-coming">
              <small>Forensic Reconstruction V2</small>
              <h1>{section}</h1>
              <p>This module belongs to the new workflow, but it is deliberately not active yet. We are rebuilding in forensic order instead of carrying V1 assumptions forward.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
