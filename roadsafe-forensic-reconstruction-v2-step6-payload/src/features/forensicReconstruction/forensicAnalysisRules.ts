import type {
  ForensicAccidentInvestigation,
} from "./forensicInvestigationTypes";

export type AnalysisSignalLevel =
  | "attention"
  | "conflict"
  | "clear";

export interface ForensicAnalysisSignal {
  id: string;
  level: AnalysisSignalLevel;
  area: string;
  title: string;
  detail: string;
}

export function buildForensicAnalysisSignals(
  investigation: ForensicAccidentInvestigation,
): ForensicAnalysisSignal[] {
  const signals: ForensicAnalysisSignal[] = [];

  const coreSceneFields = [
    investigation.scene.location,
    investigation.scene.accidentDate,
    investigation.scene.accidentTime,
    investigation.scene.weather,
    investigation.scene.lighting,
    investigation.scene.roadCondition,
    investigation.scene.trafficControlState,
    investigation.scene.roadGeometry,
  ];

  const missingScene = coreSceneFields.filter(
    (value) => !String(value ?? "").trim(),
  ).length;

  if (missingScene > 0) {
    signals.push({
      id: "scene-incomplete",
      level: "attention",
      area: "Scene",
      title: "Scene intake is incomplete",
      detail: `${missingScene} core scene field${missingScene === 1 ? " is" : "s are"} still blank.`,
    });
  }

  if (investigation.evidence.length === 0) {
    signals.push({
      id: "no-evidence",
      level: "attention",
      area: "Evidence",
      title: "No physical evidence is registered",
      detail: "Analysis should not progress to a crash conclusion without a documented evidence basis.",
    });
  }

  if (investigation.measurements.length === 0) {
    signals.push({
      id: "no-measurements",
      level: "attention",
      area: "Measurements",
      title: "No quantitative measurements are registered",
      detail: "Speed, distance, position and timing conclusions may remain weak until measured inputs exist.",
    });
  }

  const unlinkedCalculatedMeasurements = investigation.measurements.filter(
    (measurement) =>
      measurement.provenance === "Calculated" &&
      measurement.sourceEvidenceIds.length === 0,
  );

  if (unlinkedCalculatedMeasurements.length > 0) {
    signals.push({
      id: "calculated-unlinked",
      level: "attention",
      area: "Measurements",
      title: "Calculated measurements lack linked evidence",
      detail: `${unlinkedCalculatedMeasurements.length} calculated measurement${unlinkedCalculatedMeasurements.length === 1 ? " has" : "s have"} no supporting evidence link.`,
    });
  }

  const vehiclePhotoGaps = investigation.vehicles.filter((vehicle) =>
    vehicle.damageAreas.some(
      (area) =>
        !(vehicle.damagePhotos ?? []).some(
          (photo) => photo.damageArea === area,
        ),
    ),
  );

  if (vehiclePhotoGaps.length > 0) {
    signals.push({
      id: "vehicle-damage-photo-gap",
      level: "attention",
      area: "Vehicles",
      title: "A recorded damage area has no linked photograph",
      detail: `${vehiclePhotoGaps.length} vehicle examination${vehiclePhotoGaps.length === 1 ? " needs" : "s need"} damage-photo review.`,
    });
  }

  const unresolvedDrivers = investigation.persons.filter(
    (person) =>
      person.involvement === "Driver" &&
      (
        person.identityStatus !== "Identified" ||
        person.driverCandidateStatus === "Possible driver — not confirmed"
      ),
  );

  if (unresolvedDrivers.length > 0) {
    signals.push({
      id: "driver-identity-unresolved",
      level: "attention",
      area: "Persons",
      title: "Driver identity remains unresolved",
      detail: `${unresolvedDrivers.length} driver record${unresolvedDrivers.length === 1 ? " is" : "s are"} not yet confirmed. Registered ownership alone is not treated as driver confirmation.`,
    });
  }

  const witnessConflicts = investigation.witnesses.filter((witness) =>
    witness.assessmentStatus.startsWith("Conflicts"),
  );

  if (witnessConflicts.length > 0) {
    signals.push({
      id: "witness-conflict",
      level: "conflict",
      area: "Witnesses",
      title: "Witness conflict is recorded",
      detail: `${witnessConflicts.length} witness account${witnessConflicts.length === 1 ? " requires" : "s require"} explicit reconciliation against physical evidence or other accounts.`,
    });
  }

  const witnessFollowUps = investigation.witnesses.filter(
    (witness) =>
      witness.assessmentStatus === "Requires follow-up / clarification",
  );

  if (witnessFollowUps.length > 0) {
    signals.push({
      id: "witness-follow-up",
      level: "attention",
      area: "Witnesses",
      title: "Witness follow-up is pending",
      detail: `${witnessFollowUps.length} witness statement${witnessFollowUps.length === 1 ? " needs" : "s need"} clarification before strong reliance.`,
    });
  }

  if (
    signals.length === 0 &&
    investigation.evidence.length > 0 &&
    investigation.measurements.length > 0
  ) {
    signals.push({
      id: "no-auto-conflict",
      level: "clear",
      area: "Automated scan",
      title: "No automatic inconsistency was flagged",
      detail: "This limited consistency scan does not prove a crash sequence. Investigator analysis and hypothesis testing are still required.",
    });
  }

  return signals;
}
