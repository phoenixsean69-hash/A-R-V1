import { useEffect, useMemo, useRef, useState } from "react";
import type { AccidentCase } from "../../types/accidentCase";
import {
  ANALYSIS_CATEGORY_OPTIONS,
  ANALYSIS_FOLLOW_UP_OPTIONS,
  ANALYSIS_LIMITATION_OPTIONS,
  ANALYSIS_METHOD_OPTIONS,
  ANALYSIS_ORIGIN_OPTIONS,
  ANALYSIS_STATUS_OPTIONS,
  EVIDENCE_SOURCE_OPTIONS,
  FORENSIC_CONFIDENCE_OPTIONS,
  FORENSIC_PROVENANCE_OPTIONS,
  MEASUREMENT_CATEGORY_OPTIONS,
  MEASUREMENT_UNIT_OPTIONS,
  PHYSICAL_EVIDENCE_TYPE_OPTIONS,
  PERSON_BODY_POSITION_OPTIONS,
  PERSON_FOUND_LOCATION_OPTIONS,
  PERSON_IDENTITY_STATUS_OPTIONS,
  PERSON_INJURY_AREA_OPTIONS,
  PERSON_INJURY_SERIOUSNESS_OPTIONS,
  PERSON_INVOLVEMENT_OPTIONS,
  PERSON_NEXT_ACTION_OPTIONS,
  PERSON_OBSERVED_CONDITION_OPTIONS,
  PERSON_PROTECTION_OPTIONS,
  WITNESS_ASSESSMENT_STATUS_OPTIONS,
  WITNESS_IDENTITY_STATUS_OPTIONS,
  WITNESS_OBSERVATION_COVERAGE_OPTIONS,
  WITNESS_OBSERVATION_TOPIC_OPTIONS,
  WITNESS_RELATIONSHIP_OPTIONS,
  WITNESS_STATEMENT_METHOD_OPTIONS,
  WITNESS_VIEW_CONDITION_OPTIONS,
  VEHICLE_DAMAGE_AREA_OPTIONS,
  VEHICLE_DAMAGE_SEVERITY_OPTIONS,
  VEHICLE_INSPECTION_STATUS_OPTIONS,
  VEHICLE_MECHANICAL_FINDING_OPTIONS,
  VEHICLE_SCENE_POSITION_OPTIONS,
  VEHICLE_TRACE_TYPE_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  type AnalysisFindingStatus,
  type AnalysisLimitation,
  type AnalysisOrigin,
  type EvidenceSource,
  type ForensicAccidentInvestigation,
  type ForensicConfidence,
  type ForensicDriverRegistryCheck,
  type ForensicProvenance,
  type ForensicVehicleRegistryCheck,
  type ForensicVehicleDamagePhotoRef,
  type MeasurementCategory,
  type PersonIdentityStatus,
  type PersonInjuryArea,
  type PhysicalEvidenceType,
  type WitnessIdentityStatus,
  type WitnessObservationTopic,
  type VehicleDamageArea,
  type VehicleInspectionStatus,
  type VehicleTraceType,
} from "./forensicInvestigationTypes";
import { ForensicInvestigationService } from "./forensicInvestigationService";
import {
  ForensicDamagePhotoService,
} from "./forensicDamagePhotoService";
import {
  DriverRegistryService,
} from "./driverRegistryService";
import {
  VehicleRegistryService,
} from "./vehicleRegistryService";
import {
  buildForensicAnalysisSignals,
} from "./forensicAnalysisRules";
import HypothesesWorkspace from "./HypothesesWorkspace";
import SimulationWorkspace from "./SimulationWorkspace";
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
  "Persons",
  "Witnesses",
  "Analysis",
  "Hypotheses",
  "Simulation",
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

type PersonChoiceKey =
  | "involvement"
  | "foundLocation"
  | "bodyPosition"
  | "condition"
  | "protection"
  | "nextAction";

type WitnessChoiceKey =
  | "relationship"
  | "statementMethod"
  | "coverage"
  | "viewCondition"
  | "assessment";

type AnalysisChoiceKey =
  | "category"
  | "method"
  | "followUp";

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

  const [personLabel, setPersonLabel] = useState("");
  const [personIdentityStatus, setPersonIdentityStatus] =
    useState<PersonIdentityStatus>("Identity not yet confirmed");
  const [personFullName, setPersonFullName] = useState("");
  const [personIdentityNumber, setPersonIdentityNumber] = useState("");
  const [personLicenceNumber, setPersonLicenceNumber] = useState("");
  const [personInvolvement, setPersonInvolvement] = useState("");
  const [personLinkedVehicleId, setPersonLinkedVehicleId] = useState("");
  const [personFoundLocation, setPersonFoundLocation] = useState("");
  const [personBodyPosition, setPersonBodyPosition] = useState("");
  const [personAlongRoad, setPersonAlongRoad] = useState("");
  const [personAcrossRoad, setPersonAcrossRoad] = useState("");
  const [personPositionAccuracy, setPersonPositionAccuracy] = useState("");
  const [personObservedCondition, setPersonObservedCondition] = useState("");
  const [personInjurySeriousness, setPersonInjurySeriousness] =
    useState("Not yet established");
  const [personInjuryAreas, setPersonInjuryAreas] =
    useState<Set<PersonInjuryArea>>(new Set());
  const [personProtectionObserved, setPersonProtectionObserved] = useState("");
  const [personNextAction, setPersonNextAction] = useState("");
  const [personEvidenceIds, setPersonEvidenceIds] =
    useState<Set<string>>(new Set());
  const [personProvenance, setPersonProvenance] =
    useState<ForensicProvenance>("Observed");
  const [personConfidence, setPersonConfidence] =
    useState<ForensicConfidence>("Unverified");
  const [personNotes, setPersonNotes] = useState("");
  const [personDriverRegistryCheck, setPersonDriverRegistryCheck] =
    useState<ForensicDriverRegistryCheck | null>(null);
  const [personDriverRegistryBusy, setPersonDriverRegistryBusy] =
    useState(false);
  const [personVehicleSearchRegistration, setPersonVehicleSearchRegistration] =
    useState("");
  const [personVehicleRegistryCheck, setPersonVehicleRegistryCheck] =
    useState<ForensicVehicleRegistryCheck | null>(null);
  const [personVehicleRegistryBusy, setPersonVehicleRegistryBusy] =
    useState(false);
  const [personDriverCandidateAdopted, setPersonDriverCandidateAdopted] =
    useState(false);
  const [manualPersonChoices, setManualPersonChoices] =
    useState<Set<PersonChoiceKey>>(new Set());

  const [witnessLabel, setWitnessLabel] = useState("");
  const [witnessIdentityStatus, setWitnessIdentityStatus] =
    useState<WitnessIdentityStatus>("Identity not yet confirmed");
  const [witnessFullName, setWitnessFullName] = useState("");
  const [witnessContactDetails, setWitnessContactDetails] = useState("");
  const [witnessLinkedPersonId, setWitnessLinkedPersonId] = useState("");
  const [witnessRelationship, setWitnessRelationship] = useState("");
  const [witnessStatementDate, setWitnessStatementDate] =
    useState(investigation.scene.accidentDate || "");
  const [witnessStatementTime, setWitnessStatementTime] = useState("");
  const [witnessStatementMethod, setWitnessStatementMethod] = useState("");
  const [witnessObservationCoverage, setWitnessObservationCoverage] = useState("");
  const [witnessObservationLocation, setWitnessObservationLocation] = useState("");
  const [witnessAlongRoad, setWitnessAlongRoad] = useState("");
  const [witnessAcrossRoad, setWitnessAcrossRoad] = useState("");
  const [witnessPositionAccuracy, setWitnessPositionAccuracy] = useState("");
  const [witnessViewCondition, setWitnessViewCondition] = useState("");
  const [witnessApproxDistance, setWitnessApproxDistance] = useState("");
  const [witnessObservationTopics, setWitnessObservationTopics] =
    useState<Set<WitnessObservationTopic>>(new Set());
  const [witnessStatementSummary, setWitnessStatementSummary] = useState("");
  const [witnessEvidenceIds, setWitnessEvidenceIds] =
    useState<Set<string>>(new Set());
  const [witnessAssessmentStatus, setWitnessAssessmentStatus] =
    useState("Not yet assessed");
  const [witnessAssessmentNotes, setWitnessAssessmentNotes] = useState("");
  const [witnessConfidence, setWitnessConfidence] =
    useState<ForensicConfidence>("Unverified");
  const [manualWitnessChoices, setManualWitnessChoices] =
    useState<Set<WitnessChoiceKey>>(new Set());


  const [analysisCategory, setAnalysisCategory] = useState("");
  const [analysisMethod, setAnalysisMethod] = useState("");
  const [analysisFinding, setAnalysisFinding] = useState("");
  const [analysisStatus, setAnalysisStatus] =
    useState<AnalysisFindingStatus>("Not yet assessed");
  const [analysisUsesSceneIntake, setAnalysisUsesSceneIntake] = useState(true);
  const [analysisEvidenceIds, setAnalysisEvidenceIds] = useState<Set<string>>(new Set());
  const [analysisMeasurementIds, setAnalysisMeasurementIds] = useState<Set<string>>(new Set());
  const [analysisVehicleIds, setAnalysisVehicleIds] = useState<Set<string>>(new Set());
  const [analysisPersonIds, setAnalysisPersonIds] = useState<Set<string>>(new Set());
  const [analysisWitnessIds, setAnalysisWitnessIds] = useState<Set<string>>(new Set());
  const [analysisLimitations, setAnalysisLimitations] = useState<Set<AnalysisLimitation>>(new Set());
  const [analysisLimitationNotes, setAnalysisLimitationNotes] = useState("");
  const [analysisFollowUp, setAnalysisFollowUp] = useState("");
  const [analysisOrigin, setAnalysisOrigin] = useState<AnalysisOrigin>("Investigator analysis");
  const [analysisConfidence, setAnalysisConfidence] = useState<ForensicConfidence>("Unverified");
  const [manualAnalysisChoices, setManualAnalysisChoices] = useState<Set<AnalysisChoiceKey>>(new Set());

  useEffect(() => {
    setPersonDriverRegistryCheck(null);
    setPersonVehicleRegistryCheck(null);
    setPersonDriverCandidateAdopted(false);
  }, [personInvolvement]);

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


  const analysisSignals = useMemo(
    () => buildForensicAnalysisSignals(investigation),
    [investigation],
  );

  const analysisConflictCount = analysisSignals.filter(
    (signal) => signal.level === "conflict",
  ).length;

  const analysisAttentionCount = analysisSignals.filter(
    (signal) => signal.level === "attention",
  ).length;
  const analysisLinkedSourceCount =
    Number(analysisUsesSceneIntake) +
    analysisEvidenceIds.size +
    analysisMeasurementIds.size +
    analysisVehicleIds.size +
    analysisPersonIds.size +
    analysisWitnessIds.size;

  const analysisSourceGroups = useMemo(
    () => [
      {
        area: "Scene",
        label: "Scene intake",
        totalCount: Number(
          [
            investigation.scene.location,
            investigation.scene.accidentDate,
            investigation.scene.accidentTime,
            investigation.scene.weather,
            investigation.scene.lighting,
            investigation.scene.roadCondition,
            investigation.scene.trafficControlState,
            investigation.scene.roadGeometry,
          ].some((value) => String(value ?? "").trim().length > 0),
        ),
        selectedCount: Number(analysisUsesSceneIntake),
      },
      {
        area: "Evidence",
        label: "Physical evidence",
        totalCount: investigation.evidence.length,
        selectedCount: analysisEvidenceIds.size,
      },
      {
        area: "Measurements",
        label: "Measurements",
        totalCount: investigation.measurements.length,
        selectedCount: analysisMeasurementIds.size,
      },
      {
        area: "Vehicles",
        label: "Vehicles",
        totalCount: investigation.vehicles.length,
        selectedCount: analysisVehicleIds.size,
      },
      {
        area: "Persons",
        label: "Persons / drivers",
        totalCount: investigation.persons.length,
        selectedCount: analysisPersonIds.size,
      },
      {
        area: "Witnesses",
        label: "Witnesses",
        totalCount: investigation.witnesses.length,
        selectedCount: analysisWitnessIds.size,
      },
    ],
    [
      analysisEvidenceIds,
      analysisMeasurementIds,
      analysisPersonIds,
      analysisUsesSceneIntake,
      analysisVehicleIds,
      analysisWitnessIds,
      investigation.evidence,
      investigation.measurements,
      investigation.persons,
      investigation.scene,
      investigation.vehicles,
      investigation.witnesses,
    ],
  );

  const analysisAreaCards = useMemo(
    () =>
      analysisSourceGroups.map((group) => {
        const relevantSignals = analysisSignals.filter(
          (signal) => signal.area === group.area,
        );

        return {
          ...group,
          conflictCount: relevantSignals.filter(
            (signal) => signal.level === "conflict",
          ).length,
          attentionCount: relevantSignals.filter(
            (signal) => signal.level === "attention",
          ).length,
          clearCount: relevantSignals.filter(
            (signal) => signal.level === "clear",
          ).length,
        };
      }),
    [analysisSignals, analysisSourceGroups],
  );

  const analysisSelectedSourceLabels = useMemo(() => {
    const labels: string[] = [];

    if (analysisUsesSceneIntake) {
      labels.push("Scene intake / recorded scene conditions");
    }

    investigation.evidence.forEach((record) => {
      if (analysisEvidenceIds.has(record.id)) {
        labels.push(`${record.code} · ${record.type}`);
      }
    });

    investigation.measurements.forEach((record) => {
      if (analysisMeasurementIds.has(record.id)) {
        labels.push(`${record.code} · ${record.label}`);
      }
    });

    investigation.vehicles.forEach((record) => {
      if (analysisVehicleIds.has(record.id)) {
        labels.push(`${record.code} · ${record.label}`);
      }
    });

    investigation.persons.forEach((record) => {
      if (analysisPersonIds.has(record.id)) {
        labels.push(`${record.code} · ${record.label}`);
      }
    });

    investigation.witnesses.forEach((record) => {
      if (analysisWitnessIds.has(record.id)) {
        labels.push(`${record.code} · ${record.label}`);
      }
    });

    return labels;
  }, [
    analysisEvidenceIds,
    analysisMeasurementIds,
    analysisPersonIds,
    analysisUsesSceneIntake,
    analysisVehicleIds,
    analysisWitnessIds,
    investigation.evidence,
    investigation.measurements,
    investigation.persons,
    investigation.vehicles,
    investigation.witnesses,
  ]);

  const analysisTimelineEvents = useMemo(() => {
    const events: Array<{
      key: string;
      stamp: string;
      title: string;
      detail: string;
      type: string;
    }> = [];

    const sceneStamp = `${investigation.scene.accidentDate || ""}T${investigation.scene.accidentTime || "00:00"}`;
    if (investigation.scene.accidentDate || investigation.scene.accidentTime) {
      events.push({
        key: "scene-event",
        stamp: sceneStamp,
        type: "scene",
        title: "Recorded crash scene time",
        detail: `${investigation.scene.accidentDate || "Date not entered"} ${investigation.scene.accidentTime || "Time not entered"}`.trim(),
      });
    }

    investigation.witnesses.forEach((witness) => {
      events.push({
        key: witness.id,
        stamp: `${witness.statementDate || "9999-12-31"}T${witness.statementTime || "23:59"}`,
        type: "witness",
        title: `${witness.code} · witness statement`,
        detail: witness.statementSummary || witness.observationCoverage || "Witness statement recorded.",
      });
    });

    investigation.measurements.forEach((measurement) => {
      events.push({
        key: measurement.id,
        stamp: measurement.createdAt,
        type: "measurement",
        title: `${measurement.code} · ${measurement.label}`,
        detail: `${measurement.value} ${measurement.unit} · ${measurement.method}`,
      });
    });

    investigation.analysisFindings.forEach((finding) => {
      events.push({
        key: finding.id,
        stamp: finding.createdAt,
        type: "analysis",
        title: `${finding.code} · ${finding.category}`,
        detail: finding.finding,
      });
    });

    return events
      .filter((event) => event.stamp.trim().length > 0)
      .sort((a, b) => a.stamp.localeCompare(b.stamp))
      .slice(0, 12);
  }, [
    investigation.analysisFindings,
    investigation.measurements,
    investigation.scene.accidentDate,
    investigation.scene.accidentTime,
    investigation.witnesses,
  ]);

  const analysisOpenQuestions = useMemo(
    () =>
      analysisSignals.filter(
        (signal) => signal.level === "conflict" || signal.level === "attention",
      ),
    [analysisSignals],
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

  const togglePersonInjuryArea = (
    area: PersonInjuryArea,
  ) => {
    setPersonInjuryAreas((current) => {
      const next = new Set(current);

      if (next.has(area)) next.delete(area);
      else next.add(area);

      return next;
    });
  };

  const togglePersonEvidence = (
    evidenceId: string,
  ) => {
    setPersonEvidenceIds((current) => {
      const next = new Set(current);

      if (next.has(evidenceId)) next.delete(evidenceId);
      else next.add(evidenceId);

      return next;
    });
  };

  const clearPersonIdentityLead = () => {
    setPersonDriverRegistryCheck(null);
    setPersonDriverCandidateAdopted(false);
  };

  const handlePersonLinkedVehicleChange = (
    vehicleId: string,
  ) => {
    setPersonLinkedVehicleId(vehicleId);
    setPersonVehicleRegistryCheck(null);
    setPersonDriverRegistryCheck(null);
    setPersonDriverCandidateAdopted(false);

    const vehicle =
      investigation.vehicles.find(
        (item) => item.id === vehicleId,
      );

    setPersonVehicleSearchRegistration(
      vehicle?.registration ?? "",
    );
  };

  const searchPersonVehicleRegistry = async () => {
    if (
      personInvolvement.trim().toLowerCase() !==
      "driver"
    ) {
      setMessage(
        "Vehicle-registry driver identification is only available for people recorded as drivers.",
      );
      return;
    }

    const linkedVehicle =
      personLinkedVehicleId
        ? investigation.vehicles.find(
            (vehicle) =>
              vehicle.id === personLinkedVehicleId,
          )
        : undefined;

    const registration =
      personVehicleSearchRegistration.trim() ||
      linkedVehicle?.registration.trim() ||
      "";

    if (!registration) {
      setMessage(
        "Enter a vehicle registration number or choose an examined vehicle with a registration number.",
      );
      return;
    }

    setPersonVehicleRegistryBusy(true);
    setPersonDriverRegistryCheck(null);
    setPersonDriverCandidateAdopted(false);

    try {
      const result =
        await VehicleRegistryService.checkVehicle({
          caseId:
            investigation.caseId,
          caseNumber:
            investigation.caseNumber,
          investigatingOfficer:
            investigation.investigatingOfficer,
          policeStation:
            investigation.policeStation,
          personLabel:
            personLabel.trim() ||
            "Unknown driver",
          registration,
        });

      setPersonVehicleRegistryCheck(result);
      setPersonVehicleSearchRegistration(
        result.matchedRegistration ||
          result.queriedRegistration,
      );
      setMessage(
        result.source === "Demo registry"
          ? `Demo vehicle-registry search: ${result.status}.`
          : `Vehicle-registry search: ${result.status}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The vehicle registry search could not be completed.",
      );
    } finally {
      setPersonVehicleRegistryBusy(false);
    }
  };

  const checkVehicleOwnerDriverRegistry = async () => {
    const owner =
      personVehicleRegistryCheck;

    if (!owner) {
      setMessage(
        "Search the vehicle registration first.",
      );
      return;
    }

    if (
      owner.registeredOwnerType ===
      "Organisation"
    ) {
      setMessage(
        "The registered keeper is an organisation, so RoadSafe cannot treat it as an individual driver candidate.",
      );
      return;
    }

    if (
      !owner.registeredOwnerIdentityNumber?.trim()
    ) {
      setMessage(
        "The vehicle registry did not return an owner identity number that can be checked against the Driver Registry.",
      );
      return;
    }

    setPersonDriverRegistryBusy(true);

    try {
      const result =
        await DriverRegistryService.checkDriver({
          caseId:
            investigation.caseId,
          caseNumber:
            investigation.caseNumber,
          investigatingOfficer:
            investigation.investigatingOfficer,
          policeStation:
            investigation.policeStation,
          personLabel:
            personLabel.trim() ||
            "Possible driver",
          fullName:
            owner.registeredOwnerName ??
            "",
          identityNumber:
            owner.registeredOwnerIdentityNumber,
          licenceNumber:
            "",
        });

      setPersonDriverRegistryCheck(result);
      setPersonDriverCandidateAdopted(false);
      setMessage(
        result.source === "Demo registry"
          ? `Demo owner-to-driver check: ${result.status}.`
          : `Owner-to-driver registry check: ${result.status}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The registered owner could not be checked in the Driver Registry.",
      );
    } finally {
      setPersonDriverRegistryBusy(false);
    }
  };

  const useVehicleOwnerAsPossibleDriver = () => {
    const owner =
      personVehicleRegistryCheck;

    if (!owner) {
      setMessage(
        "Search the vehicle registration first.",
      );
      return;
    }

    if (!personDriverRegistryCheck) {
      setMessage(
        "Check the registered owner in the Driver Registry before using the owner as a possible driver.",
      );
      return;
    }

    if (
      owner.registeredOwnerType ===
      "Organisation"
    ) {
      setMessage(
        "An organisation cannot be used as a person/driver candidate. Continue the investigation using company records, witnesses or other evidence.",
      );
      return;
    }

    setPersonFullName(
      owner.registeredOwnerName ??
        personDriverRegistryCheck.matchedFullName ??
        "",
    );
    setPersonIdentityNumber(
      owner.registeredOwnerIdentityNumber ??
        "",
    );
    setPersonLicenceNumber(
      personDriverRegistryCheck.matchedLicenceNumber ??
        "",
    );
    setPersonIdentityStatus(
      "Identity not yet confirmed",
    );
    setPersonDriverCandidateAdopted(true);

    if (!personLabel.trim()) {
      setPersonLabel(
        "Possible Driver A",
      );
    }

    if (!personLinkedVehicleId) {
      const registration =
        (
          owner.matchedRegistration ||
          owner.queriedRegistration
        )
          .replace(/\s+/g, "")
          .toUpperCase();

      const matchingVehicle =
        investigation.vehicles.find(
          (vehicle) =>
            vehicle.registration
              .replace(/\s+/g, "")
              .toUpperCase() ===
            registration,
        );

      if (matchingVehicle) {
        setPersonLinkedVehicleId(
          matchingVehicle.id,
        );
      }
    }

    setMessage(
      "Registered owner copied in as a possible driver candidate. This does not confirm who was driving.",
    );
  };

  const checkPersonDriverRegistry = async () => {
    if (
      personInvolvement.trim().toLowerCase() !==
      "driver"
    ) {
      setMessage(
        "National driver registry checks are only available for people recorded as drivers.",
      );
      return;
    }

    if (
      !personLicenceNumber.trim() &&
      !personIdentityNumber.trim()
    ) {
      setMessage(
        "Enter the driver's licence number or National ID before checking the registry.",
      );
      return;
    }

    setPersonDriverRegistryBusy(true);

    try {
      const result =
        await DriverRegistryService.checkDriver({
          caseId:
            investigation.caseId,
          caseNumber:
            investigation.caseNumber,
          investigatingOfficer:
            investigation.investigatingOfficer,
          policeStation:
            investigation.policeStation,
          personLabel:
            personLabel.trim() ||
            "Driver",
          fullName:
            personFullName.trim(),
          identityNumber:
            personIdentityNumber.trim(),
          licenceNumber:
            personLicenceNumber.trim(),
        });

      setPersonDriverRegistryCheck(result);
      setMessage(
        result.source === "Demo registry"
          ? `Demo driver-registry check: ${result.status}.`
          : `Driver-registry check: ${result.status}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The driver registry check could not be completed.",
      );
    } finally {
      setPersonDriverRegistryBusy(false);
    }
  };

  const toggleWitnessObservationTopic = (
    topic: WitnessObservationTopic,
  ) => {
    setWitnessObservationTopics((current) => {
      const next = new Set(current);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const toggleWitnessEvidence = (
    evidenceId: string,
  ) => {
    setWitnessEvidenceIds((current) => {
      const next = new Set(current);
      if (next.has(evidenceId)) next.delete(evidenceId);
      else next.add(evidenceId);
      return next;
    });
  };

  const addWitness = () => {
    if (!witnessLabel.trim()) {
      setMessage(
        "Give the witness a case label, for example Witness A.",
      );
      return;
    }

    if (!witnessRelationship.trim()) {
      setMessage(
        "Select or enter the witness's relationship to the crash.",
      );
      return;
    }

    if (!witnessStatementMethod.trim()) {
      setMessage(
        "Record how the witness statement was captured.",
      );
      return;
    }

    if (!witnessObservationCoverage.trim()) {
      setMessage(
        "Record what part of the crash sequence the witness says they observed.",
      );
      return;
    }

    if (!witnessStatementSummary.trim()) {
      setMessage(
        "Record a concise summary of what the witness reported.",
      );
      return;
    }

    const along =
      witnessAlongRoad.trim()
        ? Number(witnessAlongRoad)
        : undefined;
    const across =
      witnessAcrossRoad.trim()
        ? Number(witnessAcrossRoad)
        : undefined;

    if ((along === undefined) !== (across === undefined)) {
      setMessage(
        "For a witness position, enter both along-road and across-road distances, or leave both blank.",
      );
      return;
    }

    if (
      (along !== undefined && !Number.isFinite(along)) ||
      (across !== undefined && !Number.isFinite(across))
    ) {
      setMessage("Witness position distances must be valid numbers.");
      return;
    }

    const accuracy =
      witnessPositionAccuracy.trim()
        ? Number(witnessPositionAccuracy)
        : undefined;

    if (accuracy !== undefined && !Number.isFinite(accuracy)) {
      setMessage("Witness position accuracy must be a valid number.");
      return;
    }

    const distance =
      witnessApproxDistance.trim()
        ? Number(witnessApproxDistance)
        : undefined;

    if (distance !== undefined && (!Number.isFinite(distance) || distance < 0)) {
      setMessage("Witness viewing distance must be a valid non-negative number.");
      return;
    }

    const saved =
      ForensicInvestigationService.addWitness(
        investigation,
        {
          label: witnessLabel.trim(),
          identityStatus: witnessIdentityStatus,
          fullName: witnessFullName.trim(),
          contactDetails: witnessContactDetails.trim(),
          linkedPersonId: witnessLinkedPersonId || undefined,
          relationshipToCrash: witnessRelationship.trim(),
          statementDate: witnessStatementDate,
          statementTime: witnessStatementTime,
          statementMethod: witnessStatementMethod.trim(),
          observationCoverage: witnessObservationCoverage.trim(),
          observationLocation: witnessObservationLocation.trim(),
          spatialPosition:
            along !== undefined && across !== undefined
              ? {
                  xMetres: along,
                  yMetres: across,
                  accuracyMetres:
                    accuracy !== undefined && Number.isFinite(accuracy)
                      ? accuracy
                      : undefined,
                  datumLabel:
                    investigation.scene.sceneDatumLabel || undefined,
                }
              : undefined,
          viewCondition: witnessViewCondition.trim(),
          approximateDistanceMetres:
            distance !== undefined && Number.isFinite(distance)
              ? distance
              : undefined,
          observationTopics: [...witnessObservationTopics],
          statementSummary: witnessStatementSummary.trim(),
          sourceEvidenceIds: [...witnessEvidenceIds],
          assessmentStatus: witnessAssessmentStatus.trim(),
          assessmentNotes: witnessAssessmentNotes.trim(),
          provenance: "Witness Reported",
          confidence: witnessConfidence,
        },
      );

    setInvestigation(saved);
    setWitnessLabel("");
    setWitnessIdentityStatus("Identity not yet confirmed");
    setWitnessFullName("");
    setWitnessContactDetails("");
    setWitnessLinkedPersonId("");
    setWitnessRelationship("");
    setWitnessStatementDate(investigation.scene.accidentDate || "");
    setWitnessStatementTime("");
    setWitnessStatementMethod("");
    setWitnessObservationCoverage("");
    setWitnessObservationLocation("");
    setWitnessAlongRoad("");
    setWitnessAcrossRoad("");
    setWitnessPositionAccuracy("");
    setWitnessViewCondition("");
    setWitnessApproxDistance("");
    setWitnessObservationTopics(new Set());
    setWitnessStatementSummary("");
    setWitnessEvidenceIds(new Set());
    setWitnessAssessmentStatus("Not yet assessed");
    setWitnessAssessmentNotes("");
    setWitnessConfidence("Unverified");
    setManualWitnessChoices(new Set());
    setMessage("Witness statement record added.");
  };

  const addPerson = () => {
    if (!personLabel.trim()) {
      setMessage(
        "Give the person a case label, for example Driver A or Pedestrian A.",
      );
      return;
    }

    if (!personInvolvement.trim()) {
      setMessage(
        "Select or enter how this person was involved in the crash.",
      );
      return;
    }

    if (
      personInvolvement.trim().toLowerCase() ===
        "driver" &&
      !personVehicleRegistryCheck &&
      !personDriverRegistryCheck
    ) {
      setMessage(
        "Before adding this driver, either search the vehicle registration or check a known driver directly in the National Driver Registry.",
      );
      return;
    }

    if (
      personInvolvement.trim().toLowerCase() ===
        "driver" &&
      personVehicleRegistryCheck?.registeredOwnerType ===
        "Individual" &&
      personVehicleRegistryCheck.registeredOwnerIdentityNumber &&
      !personDriverRegistryCheck
    ) {
      setMessage(
        "The vehicle registry returned an individual owner. Check that owner in the National Driver Registry before adding the driver record.",
      );
      return;
    }

    const along =
      personAlongRoad.trim()
        ? Number(personAlongRoad)
        : undefined;

    const across =
      personAcrossRoad.trim()
        ? Number(personAcrossRoad)
        : undefined;

    if (
      (along === undefined) !==
      (across === undefined)
    ) {
      setMessage(
        "For a scene position, enter both along-road and across-road distances, or leave both blank.",
      );
      return;
    }

    if (
      (along !== undefined && !Number.isFinite(along)) ||
      (across !== undefined && !Number.isFinite(across))
    ) {
      setMessage(
        "Person position distances must be valid numbers.",
      );
      return;
    }

    const accuracy =
      personPositionAccuracy.trim()
        ? Number(personPositionAccuracy)
        : undefined;

    if (
      accuracy !== undefined &&
      !Number.isFinite(accuracy)
    ) {
      setMessage(
        "Position accuracy must be a valid number.",
      );
      return;
    }

    const saved =
      ForensicInvestigationService.addPerson(
        investigation,
        {
          label: personLabel.trim(),
          identityStatus: personIdentityStatus,
          fullName: personFullName.trim(),
          identityNumber: personIdentityNumber.trim(),
          licenceNumber: personLicenceNumber.trim(),
          vehicleRegistryCheck:
            personVehicleRegistryCheck ||
            undefined,
          driverRegistryCheck:
            personDriverRegistryCheck ||
            undefined,
          driverCandidateStatus:
            personDriverCandidateAdopted
              ? "Possible driver — not confirmed"
              : undefined,
          driverCandidateSource:
            personDriverCandidateAdopted
              ? "Registered vehicle owner"
              : undefined,
          involvement: personInvolvement.trim(),
          linkedVehicleId:
            personLinkedVehicleId ||
            undefined,
          foundLocation: personFoundLocation.trim(),
          bodyPosition: personBodyPosition.trim(),
          spatialPosition:
            along !== undefined &&
            across !== undefined
              ? {
                  xMetres: along,
                  yMetres: across,
                  accuracyMetres:
                    accuracy !== undefined &&
                    Number.isFinite(accuracy)
                      ? accuracy
                      : undefined,
                  datumLabel:
                    investigation.scene.sceneDatumLabel ||
                    undefined,
                }
              : undefined,
          observedCondition:
            personObservedCondition.trim(),
          injurySeriousness:
            personInjurySeriousness,
          injuryAreas: [...personInjuryAreas],
          protectionObserved:
            personProtectionObserved.trim(),
          nextAction: personNextAction.trim(),
          sourceEvidenceIds: [...personEvidenceIds],
          provenance: personProvenance,
          confidence: personConfidence,
          notes: personNotes.trim(),
        },
      );

    setInvestigation(saved);
    setPersonLabel("");
    setPersonIdentityStatus("Identity not yet confirmed");
    setPersonFullName("");
    setPersonIdentityNumber("");
    setPersonLicenceNumber("");
    setPersonVehicleSearchRegistration("");
    setPersonVehicleRegistryCheck(null);
    setPersonDriverRegistryCheck(null);
    setPersonDriverCandidateAdopted(false);
    setPersonInvolvement("");
    setPersonLinkedVehicleId("");
    setPersonFoundLocation("");
    setPersonBodyPosition("");
    setPersonAlongRoad("");
    setPersonAcrossRoad("");
    setPersonPositionAccuracy("");
    setPersonObservedCondition("");
    setPersonInjurySeriousness("Not yet established");
    setPersonInjuryAreas(new Set());
    setPersonProtectionObserved("");
    setPersonNextAction("");
    setPersonEvidenceIds(new Set());
    setPersonProvenance("Observed");
    setPersonConfidence("Unverified");
    setPersonNotes("");
    setManualPersonChoices(new Set());
    setMessage("Person record added.");
  };

  const toggleAnalysisSource = (
    setter: (updater: (current: Set<string>) => Set<string>) => void,
    id: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAnalysisLimitation = (limitation: AnalysisLimitation) => {
    setAnalysisLimitations((current) => {
      const next = new Set(current);
      if (next.has(limitation)) next.delete(limitation);
      else next.add(limitation);
      return next;
    });
  };

  const addAnalysisFinding = () => {
    if (!analysisCategory.trim()) {
      setMessage("Select or enter an analysis category.");
      return;
    }

    if (!analysisMethod.trim()) {
      setMessage("Select or enter the analysis method.");
      return;
    }

    if (!analysisFinding.trim()) {
      setMessage("Record the analytical finding or unresolved conclusion.");
      return;
    }

    const sourceCount =
      Number(analysisUsesSceneIntake) +
      analysisEvidenceIds.size +
      analysisMeasurementIds.size +
      analysisVehicleIds.size +
      analysisPersonIds.size +
      analysisWitnessIds.size;

    if (sourceCount === 0) {
      setMessage("Link at least one source or include the scene intake as the analysis basis.");
      return;
    }

    const saved = ForensicInvestigationService.addAnalysisFinding(
      investigation,
      {
        category: analysisCategory.trim(),
        method: analysisMethod.trim(),
        finding: analysisFinding.trim(),
        status: analysisStatus,
        usesSceneIntake: analysisUsesSceneIntake,
        sourceEvidenceIds: [...analysisEvidenceIds],
        sourceMeasurementIds: [...analysisMeasurementIds],
        sourceVehicleIds: [...analysisVehicleIds],
        sourcePersonIds: [...analysisPersonIds],
        sourceWitnessIds: [...analysisWitnessIds],
        limitations: [...analysisLimitations],
        limitationNotes: analysisLimitationNotes.trim(),
        followUpAction: analysisFollowUp.trim(),
        origin: analysisOrigin,
        confidence: analysisConfidence,
      },
    );

    setInvestigation(saved);
    setAnalysisCategory("");
    setAnalysisMethod("");
    setAnalysisFinding("");
    setAnalysisStatus("Not yet assessed");
    setAnalysisUsesSceneIntake(true);
    setAnalysisEvidenceIds(new Set());
    setAnalysisMeasurementIds(new Set());
    setAnalysisVehicleIds(new Set());
    setAnalysisPersonIds(new Set());
    setAnalysisWitnessIds(new Set());
    setAnalysisLimitations(new Set());
    setAnalysisLimitationNotes("");
    setAnalysisFollowUp("");
    setAnalysisOrigin("Investigator analysis");
    setAnalysisConfidence("Unverified");
    setManualAnalysisChoices(new Set());
    setMessage("Analysis finding recorded.");
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

  const personChoiceField = (
    label: string,
    key: PersonChoiceKey,
    value: string,
    setValue: (value: string) => void,
    options: readonly string[],
    manualPlaceholder: string,
  ) => {
    const preset = findOption(options, value);
    const manual =
      manualPersonChoices.has(key) ||
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
              setManualPersonChoices((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
              });
              setValue("");
              return;
            }

            setManualPersonChoices((current) => {
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
              setManualPersonChoices((current) => {
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

  const witnessChoiceField = (
    label: string,
    key: WitnessChoiceKey,
    value: string,
    setValue: (value: string) => void,
    options: readonly string[],
    manualPlaceholder: string,
  ) => {
    const preset = findOption(options, value);
    const manual =
      manualWitnessChoices.has(key) ||
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
              setManualWitnessChoices((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
              });
              setValue("");
              return;
            }

            setManualWitnessChoices((current) => {
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
              setManualWitnessChoices((current) => {
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

  const analysisChoiceField = (
    label: string,
    key: AnalysisChoiceKey,
    value: string,
    setValue: (value: string) => void,
    options: readonly string[],
    manualPlaceholder: string,
  ) => {
    const preset = findOption(options, value);
    const manual = manualAnalysisChoices.has(key) || (value.trim().length > 0 && !preset);
    const selectedValue = manual ? OTHER_CHOICE : preset ?? "";

    return (
      <label className="fv2-field full">
        <span>{label}</span>
        <select
          value={selectedValue}
          onChange={(event) => {
            const nextValue = event.target.value;

            if (nextValue === OTHER_CHOICE) {
              setManualAnalysisChoices((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
              });
              setValue("");
              return;
            }

            setManualAnalysisChoices((current) => {
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
              setManualAnalysisChoices((current) => {
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
              <small>
                {ACTIVE.has(item)
                  ? item === "Analysis"
                    ? "Step 6"
                    : item === "Witnesses"
                      ? "Step 5"
                      : item === "Persons"
                        ? "Step 4"
                        : "Ready"
                  : "Later"}
              </small>
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
                <strong>STEP 6<br /><span>ANALYSIS</span></strong>
              </section>

              <div className="fv2-stats">
                <article><span>Scene intake</span><strong>{completion}%</strong><small>core scene fields</small></article>
                <article><span>Evidence</span><strong>{investigation.evidence.length}</strong><small>registered items</small></article>
                <article><span>Witnesses</span><strong>{investigation.witnesses.length}</strong><small>preserved accounts</small></article>
                <article><span>Analysis</span><strong>{investigation.analysisFindings.length}</strong><small>recorded findings</small></article>
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

          {section === "Persons" && (
            <div className="fv2-stack">
              <section className="fv2-panel">
                <header>
                  <div>
                    <span>People involved in the crash</span>
                    <strong>Record people separately from witness statements</strong>
                  </div>
                </header>

                <div className="fv2-person-note">
                  Use this section for drivers, passengers, pedestrians, cyclists and other people physically involved in the crash. A person who only witnessed the crash belongs in Witnesses instead.
                </div>

                <div className="fv2-grid">
                  <label className="fv2-field">
                    <span>Person case label</span>
                    <input
                      value={personLabel}
                      onChange={(e) => setPersonLabel(e.target.value)}
                      placeholder="e.g. Driver A, Passenger B, Pedestrian A"
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Identity status</span>
                    <select
                      value={personIdentityStatus}
                      onChange={(e) =>
                        setPersonIdentityStatus(
                          e.target.value as PersonIdentityStatus,
                        )
                      }
                    >
                      {PERSON_IDENTITY_STATUS_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field">
                    <span>Name (if known)</span>
                    <input
                      value={personFullName}
                      onChange={(e) => {
                        setPersonFullName(e.target.value);
                        clearPersonIdentityLead();
                      }}
                      placeholder="Full name"
                    />
                  </label>

                  <label className="fv2-field">
                    <span>National ID / passport (if recorded)</span>
                    <input
                      value={personIdentityNumber}
                      onChange={(e) => {
                        setPersonIdentityNumber(e.target.value);
                        clearPersonIdentityLead();
                      }}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="fv2-field full">
                    <span>Driver licence / permit number (if applicable)</span>
                    <input
                      value={personLicenceNumber}
                      onChange={(e) => {
                        setPersonLicenceNumber(e.target.value);
                        clearPersonIdentityLead();
                      }}
                      placeholder="Leave blank when not applicable"
                    />
                  </label>

                  {personChoiceField(
                    "How this person was involved",
                    "involvement",
                    personInvolvement,
                    setPersonInvolvement,
                    PERSON_INVOLVEMENT_OPTIONS,
                    "Describe another involvement...",
                  )}

                  {personInvolvement.trim().toLowerCase() === "driver" && (
                    <section className="fv2-driver-identification-card full">
                      <div className="fv2-driver-registry-head">
                        <div>
                          <span>Unknown-driver identification</span>
                          <strong>Start with the vehicle registration</strong>
                          <small>
                            Search the vehicle registry first, then check the registered owner in the Driver Registry. A registered owner is only an investigative lead — not proof of who was driving.
                          </small>
                        </div>
                      </div>

                      <div className="fv2-driver-identification-grid">
                        <label className="fv2-field">
                          <span>Vehicle from this case</span>
                          <select
                            value={personLinkedVehicleId}
                            onChange={(e) =>
                              handlePersonLinkedVehicleChange(
                                e.target.value,
                              )
                            }
                          >
                            <option value="">
                              Choose examined vehicle or enter registration manually
                            </option>
                            {investigation.vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.code} · {vehicle.label}
                                {vehicle.registration ? ` · ${vehicle.registration}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="fv2-field">
                          <span>Vehicle registration number</span>
                          <input
                            value={personVehicleSearchRegistration}
                            onChange={(e) => {
                              setPersonVehicleSearchRegistration(
                                e.target.value,
                              );
                              setPersonVehicleRegistryCheck(null);
                              setPersonDriverRegistryCheck(null);
                              setPersonDriverCandidateAdopted(false);
                            }}
                            placeholder="e.g. ABC 1234"
                          />
                        </label>
                      </div>

                      <div className="fv2-registry-search-actions">
                        <button
                          type="button"
                          className="fv2-action-button"
                          disabled={personVehicleRegistryBusy}
                          onClick={() => {
                            void searchPersonVehicleRegistry();
                          }}
                        >
                          {personVehicleRegistryBusy
                            ? "Searching vehicle registry..."
                            : "Search Vehicle Registry"}
                        </button>

                        <div className="fv2-driver-registry-connection">
                          Vehicle registry: {VehicleRegistryService.getConnectionMode() === "official"
                            ? "Authorised gateway configured"
                            : VehicleRegistryService.getConnectionMode() === "demo"
                              ? "DEMO MODE — not an official lookup"
                              : "Gateway not configured"}
                        </div>
                      </div>

                      {personVehicleRegistryCheck ? (
                        <div className={`fv2-driver-registry-result ${
                          personVehicleRegistryCheck.status === "Vehicle found / active"
                            ? "is-valid"
                            : personVehicleRegistryCheck.status === "Registry unavailable" ||
                                personVehicleRegistryCheck.status === "Check failed"
                              ? "is-unavailable"
                              : "is-warning"
                        }`}>
                          <div className="fv2-driver-registry-status">
                            <span>{personVehicleRegistryCheck.source}</span>
                            <strong>{personVehicleRegistryCheck.status}</strong>
                          </div>

                          <div className="fv2-driver-registry-grid">
                            <div>
                              <span>Registration</span>
                              <strong>{personVehicleRegistryCheck.matchedRegistration || personVehicleRegistryCheck.queriedRegistration}</strong>
                            </div>
                            <div>
                              <span>Vehicle</span>
                              <strong>{personVehicleRegistryCheck.makeModel || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Vehicle class</span>
                              <strong>{personVehicleRegistryCheck.vehicleClass || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Registered owner / keeper</span>
                              <strong>{personVehicleRegistryCheck.registeredOwnerName || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Owner ID</span>
                              <strong>{personVehicleRegistryCheck.registeredOwnerIdentityMasked || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Registry reference</span>
                              <strong>{personVehicleRegistryCheck.registryReference || "Not returned"}</strong>
                            </div>
                          </div>

                          <div className="fv2-driver-candidate-warning">
                            Registered owner / keeper ≠ confirmed driver. RoadSafe treats this person only as a possible driver lead until other evidence confirms who was driving.
                          </div>

                          <p>{personVehicleRegistryCheck.message}</p>

                          {personVehicleRegistryCheck.registeredOwnerType === "Individual" &&
                            personVehicleRegistryCheck.registeredOwnerIdentityNumber ? (
                            <div className="fv2-registry-search-actions">
                              <button
                                type="button"
                                className="fv2-action-button"
                                disabled={personDriverRegistryBusy}
                                onClick={() => {
                                  void checkVehicleOwnerDriverRegistry();
                                }}
                              >
                                {personDriverRegistryBusy
                                  ? "Checking owner in Driver Registry..."
                                  : "Check owner in Driver Registry"}
                              </button>

                              <div className="fv2-driver-registry-connection">
                                Driver registry: {DriverRegistryService.getConnectionMode() === "official"
                                  ? "Authorised gateway configured"
                                  : DriverRegistryService.getConnectionMode() === "demo"
                                    ? "DEMO MODE — not an official lookup"
                                    : "Gateway not configured"}
                              </div>
                            </div>
                          ) : (
                            <div className="fv2-driver-registry-empty">
                              {personVehicleRegistryCheck.registeredOwnerType === "Organisation"
                                ? "The registered keeper is an organisation. Continue with company records, assigned-driver records, witnesses, CCTV or other evidence."
                                : "No individual owner identity was returned for a Driver Registry query."}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="fv2-driver-registry-empty">
                          Search the registration to identify the registered vehicle/keeper before trying to identify an unknown driver.
                        </div>
                      )}

                      {personDriverRegistryCheck && (
                        <div className={`fv2-driver-registry-result ${
                          personDriverRegistryCheck.status === "Registered / valid"
                            ? "is-valid"
                            : personDriverRegistryCheck.status === "Registry unavailable" ||
                                personDriverRegistryCheck.status === "Check failed"
                              ? "is-unavailable"
                              : "is-warning"
                        }`}>
                          <div className="fv2-driver-registry-status">
                            <span>{personDriverRegistryCheck.source}</span>
                            <strong>{personDriverRegistryCheck.status}</strong>
                          </div>

                          <div className="fv2-driver-registry-grid">
                            <div>
                              <span>Matched driver</span>
                              <strong>{personDriverRegistryCheck.matchedFullName || personVehicleRegistryCheck?.registeredOwnerName || personFullName || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Licence number</span>
                              <strong>{personDriverRegistryCheck.matchedLicenceNumber || personLicenceNumber || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Licence codes</span>
                              <strong>{personDriverRegistryCheck.licenceCodes.length ? personDriverRegistryCheck.licenceCodes.join(", ") : "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Expiry</span>
                              <strong>{personDriverRegistryCheck.expiryDate || "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Penalty points</span>
                              <strong>{typeof personDriverRegistryCheck.penaltyPoints === "number" ? personDriverRegistryCheck.penaltyPoints : "Not returned"}</strong>
                            </div>
                            <div>
                              <span>Registry reference</span>
                              <strong>{personDriverRegistryCheck.registryReference || "Not returned"}</strong>
                            </div>
                          </div>

                          {personDriverRegistryCheck.restrictionSummary && (
                            <div className="fv2-driver-registry-restriction">
                              {personDriverRegistryCheck.restrictionSummary}
                            </div>
                          )}

                          <p>{personDriverRegistryCheck.message}</p>
                          <small>
                            Checked {new Date(personDriverRegistryCheck.checkedAt).toLocaleString()} · {personDriverRegistryCheck.checkedBy}
                          </small>

                          {personVehicleRegistryCheck?.registeredOwnerType === "Individual" && (
                            <div className="fv2-driver-candidate-actions">
                              <button
                                type="button"
                                className="fv2-action-button"
                                onClick={useVehicleOwnerAsPossibleDriver}
                              >
                                Use owner as possible driver
                              </button>

                              {personDriverCandidateAdopted && (
                                <strong className="fv2-driver-candidate-status">
                                  Possible driver — not confirmed
                                </strong>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="fv2-known-driver-check">
                        <div>
                          <strong>Already know who the driver may be?</strong>
                          <small>
                            Enter the person's National ID or licence number above and check that person directly. This does not confirm crash involvement by itself.
                          </small>
                        </div>

                        <button
                          type="button"
                          className="fv2-action-button"
                          disabled={personDriverRegistryBusy}
                          onClick={() => {
                            void checkPersonDriverRegistry();
                          }}
                        >
                          {personDriverRegistryBusy
                            ? "Checking registry..."
                            : "Check entered person in Driver Registry"}
                        </button>
                      </div>
                    </section>
                  )}

                  {personInvolvement.trim().toLowerCase() !== "driver" && (
                    <label className="fv2-field full">
                      <span>Linked vehicle</span>
                      <select
                        value={personLinkedVehicleId}
                        onChange={(e) => setPersonLinkedVehicleId(e.target.value)}
                      >
                        <option value="">No vehicle linked / not applicable</option>
                        {investigation.vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.code} · {vehicle.label}
                            {vehicle.registration ? ` · ${vehicle.registration}` : ""}
                          </option>
                        ))}
                      </select>
                      <small className="fv2-help">
                        Link occupants to an examined vehicle. Pedestrians and others can remain unlinked.
                      </small>
                    </label>
                  )}

                  {personChoiceField(
                    "Where the person was found after the crash",
                    "foundLocation",
                    personFoundLocation,
                    setPersonFoundLocation,
                    PERSON_FOUND_LOCATION_OPTIONS,
                    "Describe where the person was found...",
                  )}

                  {personChoiceField(
                    "Body position when recorded",
                    "bodyPosition",
                    personBodyPosition,
                    setPersonBodyPosition,
                    PERSON_BODY_POSITION_OPTIONS,
                    "Describe another recorded position...",
                  )}

                  <div className="fv2-field full">
                    <span>Final / recorded position from fixed reference (optional)</span>
                    <div className="fv2-coordinates">
                      <label>
                        <span>Along road (m)</span>
                        <input
                          inputMode="decimal"
                          value={personAlongRoad}
                          onChange={(e) => setPersonAlongRoad(e.target.value)}
                        />
                      </label>

                      <label>
                        <span>Across road (m)</span>
                        <input
                          inputMode="decimal"
                          value={personAcrossRoad}
                          onChange={(e) => setPersonAcrossRoad(e.target.value)}
                        />
                      </label>

                      <label>
                        <span>Accuracy ± m</span>
                        <input
                          inputMode="decimal"
                          value={personPositionAccuracy}
                          onChange={(e) => setPersonPositionAccuracy(e.target.value)}
                        />
                      </label>
                    </div>

                    <small className="fv2-help">
                      Measured from: {investigation.scene.sceneDatumLabel || "reference point not set yet"}
                    </small>
                  </div>

                  {personChoiceField(
                    "Condition when first recorded",
                    "condition",
                    personObservedCondition,
                    setPersonObservedCondition,
                    PERSON_OBSERVED_CONDITION_OPTIONS,
                    "Describe another observed condition...",
                  )}

                  <label className="fv2-field full">
                    <span>Observed injury seriousness</span>
                    <select
                      value={personInjurySeriousness}
                      onChange={(e) => setPersonInjurySeriousness(e.target.value)}
                    >
                      {PERSON_INJURY_SERIOUSNESS_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <small className="fv2-help">
                      This records the investigation status; it is not a medical diagnosis. Use authorised medical information when available.
                    </small>
                  </label>

                  <div className="fv2-field full">
                    <span>Visible / reported injury areas</span>
                    <div className="fv2-check-grid fv2-person-injury-grid">
                      {PERSON_INJURY_AREA_OPTIONS.map((area) => (
                        <label
                          key={area}
                          className={personInjuryAreas.has(area) ? "selected" : ""}
                        >
                          <input
                            type="checkbox"
                            checked={personInjuryAreas.has(area)}
                            onChange={() => togglePersonInjuryArea(area)}
                          />
                          <span>{area}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {personChoiceField(
                    "Protection / restraint observed",
                    "protection",
                    personProtectionObserved,
                    setPersonProtectionObserved,
                    PERSON_PROTECTION_OPTIONS,
                    "Describe another restraint or protection finding...",
                  )}

                  {personChoiceField(
                    "What happened next",
                    "nextAction",
                    personNextAction,
                    setPersonNextAction,
                    PERSON_NEXT_ACTION_OPTIONS,
                    "Describe another next action / disposition...",
                  )}

                  <div className="fv2-field full">
                    <span>Link supporting evidence</span>
                    {investigation.evidence.length === 0 ? (
                      <div className="fv2-empty-select">
                        Add evidence first if physical or documentary evidence supports this person record.
                      </div>
                    ) : (
                      <div className="fv2-evidence-select">
                        {investigation.evidence.map((record) => (
                          <label key={record.id}>
                            <input
                              type="checkbox"
                              checked={personEvidenceIds.has(record.id)}
                              onChange={() => togglePersonEvidence(record.id)}
                            />
                            <span>
                              <b>{record.code}</b> {record.type} · {record.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="fv2-field">
                    <span>Provenance</span>
                    <select
                      value={personProvenance}
                      onChange={(e) =>
                        setPersonProvenance(
                          e.target.value as ForensicProvenance,
                        )
                      }
                    >
                      {FORENSIC_PROVENANCE_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field">
                    <span>Confidence</span>
                    <select
                      value={personConfidence}
                      onChange={(e) =>
                        setPersonConfidence(
                          e.target.value as ForensicConfidence,
                        )
                      }
                    >
                      {FORENSIC_CONFIDENCE_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field full">
                    <span>Officer notes</span>
                    <textarea
                      rows={4}
                      value={personNotes}
                      onChange={(e) => setPersonNotes(e.target.value)}
                      placeholder="Record only details that are not captured by the structured fields above."
                    />
                  </label>
                </div>

                <footer>
                  <button className="primary" onClick={addPerson}>
                    Add person
                  </button>
                </footer>
              </section>

              <section className="fv2-panel">
                <header>
                  <span>Person register</span>
                  <strong>{investigation.persons.length} person(s)</strong>
                </header>

                {investigation.persons.length === 0 ? (
                  <div className="fv2-empty">
                    No people have been recorded in the forensic investigation yet.
                  </div>
                ) : (
                  <div className="fv2-tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Person</th>
                          <th>Involvement</th>
                          <th>Vehicle lead</th>
                          <th>Driver registry</th>
                          <th>Vehicle</th>
                          <th>Recorded position</th>
                          <th>Condition / injury</th>
                          <th>Evidence</th>
                          <th>Confidence</th>
                          <th />
                        </tr>
                      </thead>

                      <tbody>
                        {investigation.persons.map((person) => {
                          const linkedVehicle =
                            person.linkedVehicleId
                              ? investigation.vehicles.find(
                                  (vehicle) => vehicle.id === person.linkedVehicleId,
                                )
                              : undefined;

                          return (
                            <tr key={person.id}>
                              <td><b>{person.code}</b></td>
                              <td>
                                <b>{person.label}</b>
                                <small>
                                  {person.fullName || person.identityStatus}
                                </small>
                                {person.driverCandidateStatus && (
                                  <small className="fv2-driver-candidate-table">
                                    {person.driverCandidateStatus}
                                  </small>
                                )}
                              </td>
                              <td>{person.involvement || "—"}</td>
                              <td>
                                {person.involvement.trim().toLowerCase() === "driver"
                                  ? person.vehicleRegistryCheck
                                    ? (
                                      <>
                                        <span className={`fv2-registry-table-status ${person.vehicleRegistryCheck.status === "Vehicle found / active" ? "is-valid" : ""}`}>
                                          {person.vehicleRegistryCheck.status}
                                        </span>
                                        <small>
                                          {person.vehicleRegistryCheck.matchedRegistration || person.vehicleRegistryCheck.queriedRegistration}
                                          {person.vehicleRegistryCheck.registeredOwnerName
                                            ? ` · Owner lead: ${person.vehicleRegistryCheck.registeredOwnerName}`
                                            : ""}
                                        </small>
                                      </>
                                    )
                                    : "Not searched"
                                  : "Not applicable"}
                              </td>
                              <td>
                                {person.involvement.trim().toLowerCase() === "driver"
                                  ? person.driverRegistryCheck
                                    ? (
                                      <>
                                        <span className={`fv2-registry-table-status ${person.driverRegistryCheck.status === "Registered / valid" ? "is-valid" : ""}`}>
                                          {person.driverRegistryCheck.status}
                                        </span>
                                        <small>{person.driverRegistryCheck.licenceCodes.length ? `Codes: ${person.driverRegistryCheck.licenceCodes.join(", ")}` : person.driverRegistryCheck.message}</small>
                                      </>
                                    )
                                    : "Not checked"
                                  : "Not applicable"}
                              </td>
                              <td>
                                {linkedVehicle
                                  ? `${linkedVehicle.code} · ${linkedVehicle.label}`
                                  : "—"}
                              </td>
                              <td>
                                {person.foundLocation || "—"}
                                <small>{person.bodyPosition || "Position not established"}</small>
                                {person.spatialPosition && (
                                  <small>
                                    {person.spatialPosition.xMetres.toFixed(2)}, {person.spatialPosition.yMetres.toFixed(2)} m
                                  </small>
                                )}
                              </td>
                              <td>
                                {person.observedCondition || "—"}
                                <small>{person.injurySeriousness}</small>
                                <small>
                                  {person.injuryAreas.length
                                    ? person.injuryAreas.join(", ")
                                    : "No injury areas selected"}
                                </small>
                              </td>
                              <td>
                                {person.sourceEvidenceIds.length
                                  ? person.sourceEvidenceIds
                                      .map((id) =>
                                        investigation.evidence.find(
                                          (record) => record.id === id,
                                        )?.code ?? id,
                                      )
                                      .join(", ")
                                  : "—"}
                              </td>
                              <td>
                                <span className={`tag ${isDerived(person.provenance) ? "derived" : ""}`}>
                                  {person.confidence}
                                </span>
                                <small>{person.provenance}</small>
                              </td>
                              <td>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    setInvestigation(
                                      ForensicInvestigationService.deletePerson(
                                        investigation,
                                        person.id,
                                      ),
                                    );
                                  }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {section === "Witnesses" && (
            <div className="fv2-stack">
              <section className="fv2-panel">
                <header>
                  <div>
                    <span>Witness statements</span>
                    <strong>Record what was reported, then test it against evidence</strong>
                  </div>
                </header>

                <div className="fv2-witness-note">
                  A witness account is evidence, but it is not automatically established fact. Preserve what the witness reported, where they were, what they could see, and later compare the account with physical evidence and other statements.
                </div>

                <div className="fv2-grid">
                  <label className="fv2-field">
                    <span>Witness case label</span>
                    <input
                      value={witnessLabel}
                      onChange={(e) => setWitnessLabel(e.target.value)}
                      placeholder="e.g. Witness A"
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Identity status</span>
                    <select
                      value={witnessIdentityStatus}
                      onChange={(e) =>
                        setWitnessIdentityStatus(
                          e.target.value as WitnessIdentityStatus,
                        )
                      }
                    >
                      {WITNESS_IDENTITY_STATUS_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="fv2-field">
                    <span>Full name</span>
                    <input
                      value={witnessFullName}
                      onChange={(e) => setWitnessFullName(e.target.value)}
                      placeholder="Leave blank if not yet identified"
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Contact details</span>
                    <input
                      value={witnessContactDetails}
                      onChange={(e) => setWitnessContactDetails(e.target.value)}
                      placeholder="Phone / address / other contact reference"
                    />
                  </label>

                  <label className="fv2-field full">
                    <span>Link to involved person (optional)</span>
                    <select
                      value={witnessLinkedPersonId}
                      onChange={(e) => setWitnessLinkedPersonId(e.target.value)}
                    >
                      <option value="">Independent witness / no person link</option>
                      {investigation.persons.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.code} · {person.label}
                          {person.fullName ? ` · ${person.fullName}` : ""}
                        </option>
                      ))}
                    </select>
                    <small className="fv2-help">
                      Use this when a driver, passenger, pedestrian or other involved person also provides a witness statement.
                    </small>
                  </label>

                  {witnessChoiceField(
                    "Relationship to the crash",
                    "relationship",
                    witnessRelationship,
                    setWitnessRelationship,
                    WITNESS_RELATIONSHIP_OPTIONS,
                    "Describe another witness relationship...",
                  )}

                  <label className="fv2-field">
                    <span>Statement date</span>
                    <input
                      type="date"
                      value={witnessStatementDate}
                      onChange={(e) => setWitnessStatementDate(e.target.value)}
                    />
                  </label>

                  <label className="fv2-field">
                    <span>Statement time</span>
                    <input
                      type="time"
                      value={witnessStatementTime}
                      onChange={(e) => setWitnessStatementTime(e.target.value)}
                    />
                  </label>

                  {witnessChoiceField(
                    "How the statement was captured",
                    "statementMethod",
                    witnessStatementMethod,
                    setWitnessStatementMethod,
                    WITNESS_STATEMENT_METHOD_OPTIONS,
                    "Describe another statement method...",
                  )}

                  {witnessChoiceField(
                    "What part of the event did the witness observe?",
                    "coverage",
                    witnessObservationCoverage,
                    setWitnessObservationCoverage,
                    WITNESS_OBSERVATION_COVERAGE_OPTIONS,
                    "Describe the part of the sequence the witness says they observed...",
                  )}

                  <label className="fv2-field full">
                    <span>Where was the witness when observing the event?</span>
                    <input
                      value={witnessObservationLocation}
                      onChange={(e) => setWitnessObservationLocation(e.target.value)}
                      placeholder="e.g. Outside shop on north-east corner facing the junction"
                    />
                  </label>

                  <div className="fv2-field full">
                    <span>Witness position from fixed reference (optional)</span>
                    <div className="fv2-coordinates">
                      <label>
                        <span>Along road (m)</span>
                        <input
                          inputMode="decimal"
                          value={witnessAlongRoad}
                          onChange={(e) => setWitnessAlongRoad(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Across road (m)</span>
                        <input
                          inputMode="decimal"
                          value={witnessAcrossRoad}
                          onChange={(e) => setWitnessAcrossRoad(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Accuracy ± m</span>
                        <input
                          inputMode="decimal"
                          value={witnessPositionAccuracy}
                          onChange={(e) => setWitnessPositionAccuracy(e.target.value)}
                        />
                      </label>
                    </div>
                    <small className="fv2-help">
                      Measured from: {investigation.scene.sceneDatumLabel || "reference point not set yet"}
                    </small>
                  </div>

                  {witnessChoiceField(
                    "Viewing conditions",
                    "viewCondition",
                    witnessViewCondition,
                    setWitnessViewCondition,
                    WITNESS_VIEW_CONDITION_OPTIONS,
                    "Describe another viewing condition...",
                  )}

                  <label className="fv2-field full">
                    <span>Approximate viewing distance (m, optional)</span>
                    <input
                      inputMode="decimal"
                      value={witnessApproxDistance}
                      onChange={(e) => setWitnessApproxDistance(e.target.value)}
                      placeholder="e.g. 25"
                    />
                  </label>

                  <div className="fv2-field full">
                    <span>What did the witness report observing?</span>
                    <div className="fv2-check-grid fv2-witness-topic-grid">
                      {WITNESS_OBSERVATION_TOPIC_OPTIONS.map((topic) => (
                        <label
                          key={topic}
                          className={witnessObservationTopics.has(topic) ? "selected" : ""}
                        >
                          <input
                            type="checkbox"
                            checked={witnessObservationTopics.has(topic)}
                            onChange={() => toggleWitnessObservationTopic(topic)}
                          />
                          <span>{topic}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="fv2-field full">
                    <span>Witness statement summary</span>
                    <textarea
                      rows={7}
                      value={witnessStatementSummary}
                      onChange={(e) => setWitnessStatementSummary(e.target.value)}
                      placeholder="Summarise the witness's own account without converting it into an investigator conclusion."
                    />
                  </label>

                  <div className="fv2-field full">
                    <span>Link supporting / conflicting physical evidence</span>
                    {investigation.evidence.length === 0 ? (
                      <div className="fv2-empty-select">
                        No physical evidence records are available to link yet.
                      </div>
                    ) : (
                      <div className="fv2-evidence-select">
                        {investigation.evidence.map((record) => (
                          <label key={record.id}>
                            <input
                              type="checkbox"
                              checked={witnessEvidenceIds.has(record.id)}
                              onChange={() => toggleWitnessEvidence(record.id)}
                            />
                            <span><b>{record.code}</b> {record.type} · {record.description}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {witnessChoiceField(
                    "Initial evidence-consistency assessment",
                    "assessment",
                    witnessAssessmentStatus,
                    setWitnessAssessmentStatus,
                    WITNESS_ASSESSMENT_STATUS_OPTIONS,
                    "Describe another assessment status...",
                  )}

                  <label className="fv2-field full">
                    <span>Assessment / follow-up notes</span>
                    <textarea
                      rows={4}
                      value={witnessAssessmentNotes}
                      onChange={(e) => setWitnessAssessmentNotes(e.target.value)}
                      placeholder="Record contradictions, missing details or follow-up questions. Do not label the witness truthful or untruthful here."
                    />
                  </label>

                  <label className="fv2-field full">
                    <span>Record confidence</span>
                    <select
                      value={witnessConfidence}
                      onChange={(e) =>
                        setWitnessConfidence(
                          e.target.value as ForensicConfidence,
                        )
                      }
                    >
                      {FORENSIC_CONFIDENCE_OPTIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <small className="fv2-help">
                      This is confidence in the investigation record and its support, not a declaration that the witness is truthful.
                    </small>
                  </label>
                </div>

                <footer>
                  <button className="primary" onClick={addWitness}>
                    Add witness statement
                  </button>
                </footer>
              </section>

              <section className="fv2-panel">
                <header>
                  <span>Witness statement register</span>
                  <strong>{investigation.witnesses.length} witness record(s)</strong>
                </header>

                {investigation.witnesses.length === 0 ? (
                  <div className="fv2-empty">No witness statements registered yet.</div>
                ) : (
                  <div className="fv2-tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Witness</th>
                          <th>Relationship</th>
                          <th>Coverage / view</th>
                          <th>Reported observations</th>
                          <th>Evidence links</th>
                          <th>Assessment</th>
                          <th>Confidence</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {investigation.witnesses.map((witness) => {
                          const linkedPerson =
                            witness.linkedPersonId
                              ? investigation.persons.find(
                                  (person) => person.id === witness.linkedPersonId,
                                )
                              : undefined;

                          return (
                            <tr key={witness.id}>
                              <td><b>{witness.code}</b></td>
                              <td>
                                <b>{witness.label}</b>
                                <small>{witness.fullName || witness.identityStatus}</small>
                                {linkedPerson && (
                                  <small>Linked: {linkedPerson.code} · {linkedPerson.label}</small>
                                )}
                              </td>
                              <td>
                                {witness.relationshipToCrash || "—"}
                                <small>{witness.statementMethod || "Statement method not recorded"}</small>
                              </td>
                              <td>
                                {witness.observationCoverage || "—"}
                                <small>{witness.viewCondition || "View condition not recorded"}</small>
                                {typeof witness.approximateDistanceMetres === "number" && (
                                  <small>Approx. {witness.approximateDistanceMetres} m away</small>
                                )}
                              </td>
                              <td>
                                {witness.observationTopics.length
                                  ? witness.observationTopics.join(", ")
                                  : "No observation topics selected"}
                                <small>{witness.statementSummary}</small>
                              </td>
                              <td>
                                {witness.sourceEvidenceIds.length
                                  ? witness.sourceEvidenceIds
                                      .map((id) =>
                                        investigation.evidence.find(
                                          (record) => record.id === id,
                                        )?.code ?? id,
                                      )
                                      .join(", ")
                                  : "—"}
                              </td>
                              <td>
                                {witness.assessmentStatus || "Not yet assessed"}
                                <small>{witness.assessmentNotes || "No assessment notes"}</small>
                              </td>
                              <td>
                                <span className="tag">{witness.confidence}</span>
                                <small>Witness Reported</small>
                              </td>
                              <td>
                                <button
                                  className="danger"
                                  onClick={() =>
                                    setInvestigation(
                                      ForensicInvestigationService.deleteWitness(
                                        investigation,
                                        witness.id,
                                      ),
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="fv2-panel fv2-notice">
                <b>Forensic rule</b>
                <p>
                  Witness statements must be preserved as reported accounts and checked against scene evidence, vehicle/person findings and other statements. Agreement strengthens a hypothesis; conflict must be shown rather than hidden.
                </p>
              </section>
            </div>
          )}

          {section === "Analysis" && (
            <div className="fv2-stack fv2-analysis-workstation">
              <section className="fv2-panel fv2-analysis-hero">
                <header>
                  <div>
                    <span>Forensic analysis workstation</span>
                    <strong>Evidence relationships before hypothesis building</strong>
                  </div>
                  <div className="fv2-analysis-summary fv2-analysis-summary-wide">
                    <span>{investigation.analysisFindings.length} finding(s)</span>
                    <span>{analysisLinkedSourceCount} linked source(s)</span>
                    <span className="conflict">{analysisConflictCount} conflict</span>
                    <span className="attention">{analysisAttentionCount} attention</span>
                  </div>
                </header>

                <div className="fv2-analysis-rule">
                  Analysis is now treated as a workstation: relate scene, evidence, measurements, vehicles, persons and witness accounts visually, expose unresolved issues, and only then record a finding. RoadSafe still does not decide legal fault here.
                </div>

                <div className="fv2-analysis-metric-grid">
                  {analysisAreaCards.map((card) => (
                    <article key={card.area} className="fv2-analysis-metric-card">
                      <span>{card.label}</span>
                      <strong>{card.totalCount} record{card.totalCount === 1 ? "" : "s"}</strong>
                      <div className="fv2-analysis-metric-meta">
                        <small>{card.selectedCount} selected</small>
                        <small>{card.conflictCount} conflict</small>
                        <small>{card.attentionCount} attention</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="fv2-analysis-layout">
                <div className="fv2-analysis-main">
                  <div className="fv2-analysis-row fv2-analysis-row-split">
                    <section className="fv2-panel">
                      <header>
                        <div>
                          <span>Evidence relationship map</span>
                          <strong>Current source network</strong>
                        </div>
                      </header>

                      <div className="fv2-analysis-linkmap">
                        {analysisAreaCards.map((card) => (
                          <article key={card.area} className={`fv2-analysis-linknode ${card.conflictCount > 0 ? "conflict" : card.attentionCount > 0 ? "attention" : "clear"}`}>
                            <span>{card.area}</span>
                            <strong>{card.totalCount}</strong>
                            <small>{card.selectedCount} linked to the current finding</small>
                          </article>
                        ))}
                      </div>

                      <div className="fv2-analysis-flow">
                        <div className="fv2-analysis-flow-node">Observed / measured</div>
                        <div className="fv2-analysis-flow-arrow">→</div>
                        <div className="fv2-analysis-flow-node active">Analysis</div>
                        <div className="fv2-analysis-flow-arrow">→</div>
                        <div className="fv2-analysis-flow-node">Hypothesis testing</div>
                      </div>
                    </section>

                    <section className="fv2-panel">
                      <header>
                        <div>
                          <span>Current analytical position</span>
                          <strong>What the next finding is being built from</strong>
                        </div>
                      </header>

                      <div className="fv2-analysis-current-grid">
                        <div className="fv2-analysis-current-card">
                          <span>Category</span>
                          <strong>{analysisCategory.trim() || "Not selected"}</strong>
                        </div>
                        <div className="fv2-analysis-current-card">
                          <span>Method</span>
                          <strong>{analysisMethod.trim() || "Not selected"}</strong>
                        </div>
                        <div className="fv2-analysis-current-card">
                          <span>Status</span>
                          <strong>{analysisStatus}</strong>
                        </div>
                        <div className="fv2-analysis-current-card">
                          <span>Confidence</span>
                          <strong>{analysisConfidence}</strong>
                        </div>
                      </div>

                      <label className="fv2-field full fv2-analysis-focus-field">
                        <span>Working analytical conclusion</span>
                        <textarea
                          rows={5}
                          value={analysisFinding}
                          onChange={(e) => setAnalysisFinding(e.target.value)}
                          placeholder="State what the evidence currently supports, contradicts, or leaves unresolved."
                        />
                      </label>

                      <div className="fv2-analysis-chipbox">
                        {analysisSelectedSourceLabels.length === 0 ? (
                          <div className="fv2-empty-select">No current source links yet.</div>
                        ) : (
                          analysisSelectedSourceLabels.map((label) => (
                            <span key={label} className="tag">{label}</span>
                          ))
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="fv2-analysis-row fv2-analysis-row-split">
                    <section className="fv2-panel">
                      <header>
                        <div>
                          <span>Consistency matrix</span>
                          <strong>Availability, selection and flagged issues</strong>
                        </div>
                      </header>

                      <div className="fv2-tablewrap">
                        <table className="fv2-analysis-matrix">
                          <thead>
                            <tr>
                              <th>Area</th>
                              <th>Available</th>
                              <th>Selected now</th>
                              <th>Auto conflicts</th>
                              <th>Auto attention</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisAreaCards.map((card) => (
                              <tr key={card.area}>
                                <td><b>{card.area}</b><small>{card.label}</small></td>
                                <td>{card.totalCount}</td>
                                <td>{card.selectedCount}</td>
                                <td>{card.conflictCount}</td>
                                <td>{card.attentionCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="fv2-panel">
                      <header>
                        <div>
                          <span>Event & evidence timeline</span>
                          <strong>Chronology of recorded analytical inputs</strong>
                        </div>
                      </header>

                      <div className="fv2-analysis-timeline">
                        {analysisTimelineEvents.length === 0 ? (
                          <div className="fv2-empty">No dated analytical events are available yet.</div>
                        ) : (
                          analysisTimelineEvents.map((event) => (
                            <article key={event.key} className={`fv2-analysis-timeline-item ${event.type}`}>
                              <small>{event.stamp.replace("T", " ")}</small>
                              <strong>{event.title}</strong>
                              <p>{event.detail}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="fv2-analysis-row fv2-analysis-row-scan">
                    <section className="fv2-panel fv2-analysis-scan-panel">
                      <header>
                        <div>
                          <span>Automatic consistency scan</span>
                          <strong>Open questions, conflicts and missing foundations</strong>
                        </div>
                      </header>

                      <div className="fv2-analysis-signal-grid">
                        {analysisOpenQuestions.length === 0 ? (
                          <article className="fv2-analysis-signal clear">
                            <span>Automated scan</span>
                            <strong>No automatic warning is currently raised</strong>
                            <p>The limited consistency scan has not found a conflict or missing-foundation warning at this stage.</p>
                          </article>
                        ) : (
                          analysisOpenQuestions.map((signal) => (
                            <article key={signal.id} className={`fv2-analysis-signal ${signal.level}`}>
                              <span>{signal.area}</span>
                              <strong>{signal.title}</strong>
                              <p>{signal.detail}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="fv2-panel">
                      <header>
                        <div>
                          <span>Analysis register</span>
                          <strong>{investigation.analysisFindings.length} recorded finding(s)</strong>
                        </div>
                      </header>

                      {investigation.analysisFindings.length === 0 ? (
                        <div className="fv2-empty">No analytical findings recorded yet.</div>
                      ) : (
                        <div className="fv2-analysis-finding-cards">
                          {investigation.analysisFindings.map((finding) => {
                            const sourceCount = Number(finding.usesSceneIntake) + finding.sourceEvidenceIds.length + finding.sourceMeasurementIds.length + finding.sourceVehicleIds.length + finding.sourcePersonIds.length + finding.sourceWitnessIds.length;
                            return (
                              <article key={finding.id} className="fv2-analysis-finding-card">
                                <div className="fv2-analysis-finding-head">
                                  <div>
                                    <span>{finding.code}</span>
                                    <strong>{finding.category}</strong>
                                  </div>
                                  <span className={`tag ${finding.status === "Conflicting evidence" ? "derived" : ""}`}>{finding.status}</span>
                                </div>
                                <p>{finding.finding}</p>
                                <div className="fv2-analysis-finding-meta">
                                  <small>{finding.method}</small>
                                  <small>{sourceCount} source{sourceCount === 1 ? "" : "s"}</small>
                                  <small>{finding.confidence}</small>
                                </div>
                                <div className="fv2-analysis-finding-meta">
                                  <small>{finding.origin}</small>
                                  <small>{finding.followUpAction || "No follow-up recorded"}</small>
                                </div>
                                <button className="danger" onClick={() => setInvestigation(ForensicInvestigationService.deleteAnalysisFinding(investigation, finding.id))}>Remove</button>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                <aside className="fv2-analysis-sidebar">
                  <section className="fv2-panel fv2-analysis-composer">
                    <header>
                      <div>
                        <span>Finding composer</span>
                        <strong>Build an evidence-based analysis record</strong>
                      </div>
                    </header>

                    <div className="fv2-grid">
                      {analysisChoiceField(
                        "Analysis category",
                        "category",
                        analysisCategory,
                        setAnalysisCategory,
                        ANALYSIS_CATEGORY_OPTIONS,
                        "Describe another analysis category...",
                      )}

                      {analysisChoiceField(
                        "Analysis method",
                        "method",
                        analysisMethod,
                        setAnalysisMethod,
                        ANALYSIS_METHOD_OPTIONS,
                        "Describe another analysis method...",
                      )}

                      <label className="fv2-field">
                        <span>Finding status</span>
                        <select value={analysisStatus} onChange={(e) => setAnalysisStatus(e.target.value as AnalysisFindingStatus)}>
                          {ANALYSIS_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </label>

                      <label className="fv2-field">
                        <span>Analysis origin</span>
                        <select value={analysisOrigin} onChange={(e) => setAnalysisOrigin(e.target.value as AnalysisOrigin)}>
                          {ANALYSIS_ORIGIN_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </label>

                      <label className="fv2-field">
                        <span>Confidence</span>
                        <select value={analysisConfidence} onChange={(e) => setAnalysisConfidence(e.target.value as ForensicConfidence)}>
                          {FORENSIC_CONFIDENCE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </label>

                      <label className="fv2-field fv2-analysis-scene-basis">
                        <span>Scene intake as source</span>
                        <span className="fv2-toggle-row">
                          <input type="checkbox" checked={analysisUsesSceneIntake} onChange={(e) => setAnalysisUsesSceneIntake(e.target.checked)} />
                          Include recorded scene conditions / layout
                        </span>
                      </label>

                      <div className="fv2-field full">
                        <span>Support sets</span>
                        <div className="fv2-analysis-source-groups">
                          <article className="fv2-analysis-source-group">
                            <header><strong>Physical evidence</strong><small>{analysisEvidenceIds.size}/{investigation.evidence.length}</small></header>
                            {investigation.evidence.length === 0 ? (
                              <div className="fv2-empty-select">No evidence records are available.</div>
                            ) : (
                              <div className="fv2-evidence-select">
                                {investigation.evidence.map((record) => (
                                  <label key={record.id}>
                                    <input type="checkbox" checked={analysisEvidenceIds.has(record.id)} onChange={() => toggleAnalysisSource(setAnalysisEvidenceIds, record.id)} />
                                    <span><b>{record.code}</b> {record.type} · {record.description}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </article>

                          <article className="fv2-analysis-source-group">
                            <header><strong>Measurements</strong><small>{analysisMeasurementIds.size}/{investigation.measurements.length}</small></header>
                            {investigation.measurements.length === 0 ? (
                              <div className="fv2-empty-select">No measurement records are available.</div>
                            ) : (
                              <div className="fv2-evidence-select">
                                {investigation.measurements.map((record) => (
                                  <label key={record.id}>
                                    <input type="checkbox" checked={analysisMeasurementIds.has(record.id)} onChange={() => toggleAnalysisSource(setAnalysisMeasurementIds, record.id)} />
                                    <span><b>{record.code}</b> {record.label} · {record.value} {record.unit}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </article>

                          <article className="fv2-analysis-source-group">
                            <header><strong>Vehicles</strong><small>{analysisVehicleIds.size}/{investigation.vehicles.length}</small></header>
                            {investigation.vehicles.length === 0 ? (
                              <div className="fv2-empty-select">No vehicle examination records are available.</div>
                            ) : (
                              <div className="fv2-evidence-select">
                                {investigation.vehicles.map((record) => (
                                  <label key={record.id}>
                                    <input type="checkbox" checked={analysisVehicleIds.has(record.id)} onChange={() => toggleAnalysisSource(setAnalysisVehicleIds, record.id)} />
                                    <span><b>{record.code}</b> {record.label} · {record.makeModel || record.vehicleType}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </article>

                          <article className="fv2-analysis-source-group">
                            <header><strong>Persons / drivers</strong><small>{analysisPersonIds.size}/{investigation.persons.length}</small></header>
                            {investigation.persons.length === 0 ? (
                              <div className="fv2-empty-select">No person records are available.</div>
                            ) : (
                              <div className="fv2-evidence-select">
                                {investigation.persons.map((record) => (
                                  <label key={record.id}>
                                    <input type="checkbox" checked={analysisPersonIds.has(record.id)} onChange={() => toggleAnalysisSource(setAnalysisPersonIds, record.id)} />
                                    <span><b>{record.code}</b> {record.label} · {record.involvement}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </article>

                          <article className="fv2-analysis-source-group">
                            <header><strong>Witnesses</strong><small>{analysisWitnessIds.size}/{investigation.witnesses.length}</small></header>
                            {investigation.witnesses.length === 0 ? (
                              <div className="fv2-empty-select">No witness statements are available.</div>
                            ) : (
                              <div className="fv2-evidence-select">
                                {investigation.witnesses.map((record) => (
                                  <label key={record.id}>
                                    <input type="checkbox" checked={analysisWitnessIds.has(record.id)} onChange={() => toggleAnalysisSource(setAnalysisWitnessIds, record.id)} />
                                    <span><b>{record.code}</b> {record.label} · {record.assessmentStatus}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </article>
                        </div>
                      </div>

                      <div className="fv2-field full">
                        <span>Known limitations / uncertainty</span>
                        <div className="fv2-check-grid fv2-analysis-limitations">
                          {ANALYSIS_LIMITATION_OPTIONS.map((item) => (
                            <label key={item}>
                              <input type="checkbox" checked={analysisLimitations.has(item)} onChange={() => toggleAnalysisLimitation(item)} />
                              <span>{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="fv2-field full">
                        <span>Limitation / uncertainty notes</span>
                        <textarea rows={3} value={analysisLimitationNotes} onChange={(e) => setAnalysisLimitationNotes(e.target.value)} placeholder="Explain how missing, uncertain or conflicting inputs affect this finding." />
                      </label>

                      {analysisChoiceField(
                        "Recommended follow-up",
                        "followUp",
                        analysisFollowUp,
                        setAnalysisFollowUp,
                        ANALYSIS_FOLLOW_UP_OPTIONS,
                        "Describe another follow-up action...",
                      )}
                    </div>

                    <footer>
                      <button className="primary" onClick={addAnalysisFinding}>Add analysis finding</button>
                    </footer>
                  </section>

                  <section className="fv2-panel fv2-notice">
                    <b>Forensic rule</b>
                    <p>Analysis must expose its source records, uncertainty and conflicts. This section can support or weaken later hypotheses, but it does not declare legal guilt and does not turn an assumption into an observed fact.</p>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {section === "Hypotheses" && (
            <HypothesesWorkspace
              investigation={investigation}
              onInvestigationChange={setInvestigation}
              onMessage={setMessage}
            />
          )}

          {section === "Simulation" && (
            <SimulationWorkspace
              investigation={investigation}
              onMessage={setMessage}
            />
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
