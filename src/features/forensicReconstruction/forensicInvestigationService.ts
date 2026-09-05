import type { AccidentCase } from "../../types/accidentCase";
import { ReconstructionService } from "../../services/reconstructionService";
import type {
  ForensicAccidentInvestigation,
  ForensicAnalysisFinding,
  ForensicCrashHypothesis,
  ForensicEvidenceRecord,
  ForensicMeasurementRecord,
  ForensicPersonRecord,
  ForensicVehicleExamination,
  ForensicWitnessRecord,
} from "./forensicInvestigationTypes";

const STORAGE_KEY = "roadsafe-forensic-investigations-v2";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapWizardWeather(value: string | undefined): string {
  switch (value) {
    case "Clear":
      return "Clear";
    case "Rain":
      return "Rain";
    case "Fog":
      return "Fog / mist";
    case "Dust":
      return "Dust / haze";
    default:
      return value ?? "";
  }
}

function mapWizardLighting(value: string | undefined): string {
  switch (value) {
    case "Day":
      return "Daylight";
    case "Dawn":
      return "Dawn";
    case "Dusk":
      return "Dusk";
    case "Night":
      return "Night - street-lighting state not yet verified";
    default:
      return value ?? "";
  }
}

function mapWizardRoadCondition(value: string | undefined): string {
  switch (value) {
    case "Dry":
      return "Dry";
    case "Wet":
      return "Wet";
    case "Damaged":
      return "Uneven / damaged";
    default:
      return value ?? "";
  }
}

function mapWizardTrafficControl(value: string | undefined): string {
  switch (value) {
    case "None":
      return "No traffic control";
    case "Stop Signs":
      return "Stop sign";
    case "Give Way Signs":
      return "Give Way / Yield sign";
    case "Traffic Lights":
      return "Traffic lights present - operating state not yet verified";
    default:
      return value ?? "";
  }
}

function mapWizardRoadGeometry(value: string | undefined): string {
  switch (value) {
    case "Straight Road":
      return "Straight road";
    case "T-Junction":
      return "T-junction";
    case "Four-way Intersection":
      return "Crossroads / 4-way junction";
    case "Roundabout":
      return "Roundabout";
    case "Pedestrian Crossing":
      return "Pedestrian crossing";
    case "Transport Terminus":
      return "Transport Terminus";
    default:
      return value ?? "";
  }
}

function getWizardSceneSeed(accidentCase: AccidentCase): {
  weather: string;
  lighting: string;
  roadCondition: string;
  trafficControlState: string;
  roadGeometry: string;
} {
  const reconstruction =
    accidentCase.reconstructionId
      ? ReconstructionService.getById(accidentCase.reconstructionId)
      : null;

  const sceneSettings =
    reconstruction?.scene ??
    accidentCase.roadLayoutDetection?.suggestedSceneSettings;

  return {
    weather: mapWizardWeather(sceneSettings?.weather),
    lighting: mapWizardLighting(sceneSettings?.timeOfDay),
    roadCondition: mapWizardRoadCondition(sceneSettings?.roadSurface),
    trafficControlState: mapWizardTrafficControl(sceneSettings?.trafficControl),
    roadGeometry: mapWizardRoadGeometry(sceneSettings?.roadLayout),
  };
}

function hydrateFromCaseAndWizard(
  investigation: ForensicAccidentInvestigation,
  accidentCase: AccidentCase,
): ForensicAccidentInvestigation {
  const wizard = getWizardSceneSeed(accidentCase);

  return {
    ...investigation,
    caseNumber:
      investigation.caseNumber.trim() ||
      accidentCase.caseNumber,
    caseTitle:
      investigation.caseTitle.trim() ||
      accidentCase.title,
    investigatingOfficer:
      investigation.investigatingOfficer.trim() ||
      accidentCase.investigatingOfficer,
    policeStation:
      investigation.policeStation.trim() ||
      accidentCase.policeStation,
    scene: {
      ...investigation.scene,
      location:
        investigation.scene.location.trim() ||
        accidentCase.location,
      accidentDate:
        investigation.scene.accidentDate ||
        accidentCase.accidentDate,
      accidentTime:
        investigation.scene.accidentTime ||
        accidentCase.accidentTime,
      weather:
        investigation.scene.weather.trim() ||
        wizard.weather,
      lighting:
        investigation.scene.lighting.trim() ||
        wizard.lighting,
      roadCondition:
        investigation.scene.roadCondition.trim() ||
        wizard.roadCondition,
      trafficControlState:
        investigation.scene.trafficControlState.trim() ||
        wizard.trafficControlState,
      roadGeometry:
        investigation.scene.roadGeometry.trim() ||
        wizard.roadGeometry,
    },
  };
}

function normalise(
  record: ForensicAccidentInvestigation,
): ForensicAccidentInvestigation {
  return {
    ...record,
    scene: {
      ...record.scene,
      sceneDatumLabel: record.scene?.sceneDatumLabel ?? "",
      coordinateNotes: record.scene?.coordinateNotes ?? "",
    },
    evidence: Array.isArray(record.evidence) ? record.evidence : [],
    measurements: Array.isArray(record.measurements)
      ? record.measurements
      : [],
    vehicles: Array.isArray(record.vehicles)
      ? record.vehicles.map((vehicle) => ({
          ...vehicle,
          damagePhotos: Array.isArray(vehicle.damagePhotos)
            ? vehicle.damagePhotos
            : [],
        }))
      : [],
    persons: Array.isArray(record.persons)
      ? record.persons.map((person) => ({
          ...person,
          vehicleRegistryCheck:
            person.vehicleRegistryCheck &&
            typeof person.vehicleRegistryCheck === "object"
              ? { ...person.vehicleRegistryCheck }
              : undefined,
          driverRegistryCheck:
            person.driverRegistryCheck &&
            typeof person.driverRegistryCheck === "object"
              ? {
                  ...person.driverRegistryCheck,
                  licenceCodes: Array.isArray(
                    person.driverRegistryCheck.licenceCodes,
                  )
                    ? person.driverRegistryCheck.licenceCodes
                    : [],
                }
              : undefined,
        }))
      : [],
    witnesses: Array.isArray(record.witnesses)
      ? record.witnesses.map((witness) => ({
          ...witness,
          observationTopics: Array.isArray(witness.observationTopics)
            ? witness.observationTopics
            : [],
          sourceEvidenceIds: Array.isArray(witness.sourceEvidenceIds)
            ? witness.sourceEvidenceIds
            : [],
          provenance: "Witness Reported" as const,
        }))
      : [],
    analysisFindings: Array.isArray(record.analysisFindings)
      ? record.analysisFindings.map((finding) => ({
          ...finding,
          sourceEvidenceIds: Array.isArray(finding.sourceEvidenceIds) ? finding.sourceEvidenceIds : [],
          sourceMeasurementIds: Array.isArray(finding.sourceMeasurementIds) ? finding.sourceMeasurementIds : [],
          sourceVehicleIds: Array.isArray(finding.sourceVehicleIds) ? finding.sourceVehicleIds : [],
          sourcePersonIds: Array.isArray(finding.sourcePersonIds) ? finding.sourcePersonIds : [],
          sourceWitnessIds: Array.isArray(finding.sourceWitnessIds) ? finding.sourceWitnessIds : [],
          limitations: Array.isArray(finding.limitations) ? finding.limitations : [],
          usesSceneIntake: Boolean(finding.usesSceneIntake),
        }))
      : [],
    hypotheses: Array.isArray(record.hypotheses)
      ? record.hypotheses.map((hypothesis) => ({
          ...hypothesis,
          provenance: "Investigator Assumption" as const,
          supportingFindingIds: Array.isArray(hypothesis.supportingFindingIds) ? hypothesis.supportingFindingIds : [],
          conflictingFindingIds: Array.isArray(hypothesis.conflictingFindingIds) ? hypothesis.conflictingFindingIds : [],
          supportingEvidenceIds: Array.isArray(hypothesis.supportingEvidenceIds) ? hypothesis.supportingEvidenceIds : [],
          conflictingEvidenceIds: Array.isArray(hypothesis.conflictingEvidenceIds) ? hypothesis.conflictingEvidenceIds : [],
          sourceMeasurementIds: Array.isArray(hypothesis.sourceMeasurementIds) ? hypothesis.sourceMeasurementIds : [],
          sourceVehicleIds: Array.isArray(hypothesis.sourceVehicleIds) ? hypothesis.sourceVehicleIds : [],
          sourcePersonIds: Array.isArray(hypothesis.sourcePersonIds) ? hypothesis.sourcePersonIds : [],
          sourceWitnessIds: Array.isArray(hypothesis.sourceWitnessIds) ? hypothesis.sourceWitnessIds : [],
          assumptions: Array.isArray(hypothesis.assumptions) ? hypothesis.assumptions : [],
          missingEvidence: Array.isArray(hypothesis.missingEvidence) ? hypothesis.missingEvidence : [],
          eventSequence: Array.isArray(hypothesis.eventSequence) ? hypothesis.eventSequence : [],
          selectedForSimulation: Boolean(hypothesis.selectedForSimulation),
          notes: typeof hypothesis.notes === "string" ? hypothesis.notes : "",
        }))
      : [],
  };
}

function readAll(): ForensicAccidentInvestigation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForensicAccidentInvestigation[];
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item?.version === 2 && typeof item.caseId === "string")
          .map(normalise)
      : [];
  } catch (error) {
    console.error("Failed to read forensic investigations:", error);
    return [];
  }
}

function writeAll(records: ForensicAccidentInvestigation[]): void {
  const serialised =
    JSON.stringify(records);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      serialised,
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Unable to save forensic investigation locally: ${error.message}`
        : "Unable to save forensic investigation locally.",
    );
  }

  const stored =
    localStorage.getItem(
      STORAGE_KEY,
    );

  if (stored !== serialised) {
    throw new Error(
      "RoadSafe could not verify the forensic investigation after saving it.",
    );
  }
}

function createFromCase(accidentCase: AccidentCase): ForensicAccidentInvestigation {
  const now = nowIso();
  const wizard = getWizardSceneSeed(accidentCase);

  return {
    version: 2,
    id: createId("forensic-investigation"),
    caseId: accidentCase.id,
    caseNumber: accidentCase.caseNumber,
    caseTitle: accidentCase.title,
    investigatingOfficer: accidentCase.investigatingOfficer,
    policeStation: accidentCase.policeStation,
    scene: {
      location: accidentCase.location,
      accidentDate: accidentCase.accidentDate,
      accidentTime: accidentCase.accidentTime,
      weather: wizard.weather,
      lighting: wizard.lighting,
      roadCondition: wizard.roadCondition,
      trafficControlState: wizard.trafficControlState,
      roadGeometry: wizard.roadGeometry,
      sceneDatumLabel: "",
      coordinateNotes: "",
      preservationNotes: "",
      lastUpdatedAt: now,
    },
    evidence: [],
    measurements: [],
    vehicles: [],
    persons: [],
    witnesses: [],
    analysisFindings: [],
    hypotheses: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const ForensicInvestigationService = {
  isLocalPersistenceAvailable(): boolean {
    try {
      const key =
        `${STORAGE_KEY}-test`;

      localStorage.setItem(
        key,
        "ok",
      );

      const available =
        localStorage.getItem(
          key,
        ) ===
        "ok";

      localStorage.removeItem(
        key,
      );

      return available;
    } catch {
      return false;
    }
  },

  getByCaseId(
    caseId: string,
  ): ForensicAccidentInvestigation | null {
    return (
      readAll().find(
        (item) =>
          item.caseId ===
          caseId,
      ) ??
      null
    );
  },

  getOrCreate(accidentCase: AccidentCase): ForensicAccidentInvestigation {
    const existing =
      this.getByCaseId(
        accidentCase.id,
      );

    if (existing) {
      const hydrated =
        hydrateFromCaseAndWizard(
          existing,
          accidentCase,
        );

      const changed =
        JSON.stringify(hydrated) !==
        JSON.stringify(existing);

      return changed
        ? this.save(hydrated)
        : existing;
    }

    const created =
      createFromCase(
        accidentCase,
      );

    return this.save(created);
  },

  save(investigation: ForensicAccidentInvestigation): ForensicAccidentInvestigation {
    const records = readAll();
    const updated = normalise({ ...investigation, updatedAt: nowIso() });
    const index = records.findIndex((item) => item.caseId === updated.caseId);
    if (index >= 0) records[index] = updated;
    else records.push(updated);
    writeAll(records);

    const persisted =
      this.getByCaseId(
        updated.caseId,
      );

    if (!persisted) {
      throw new Error(
        "RoadSafe saved the forensic investigation but could not read it back.",
      );
    }

    return persisted;
  },

  addEvidence(
    investigation: ForensicAccidentInvestigation,
    input: Omit<ForensicEvidenceRecord, "id" | "code" | "createdAt" | "updatedAt">,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicEvidenceRecord = {
      ...input,
      id: createId("evidence"),
      code: `E-${String(investigation.evidence.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };
    return this.save({ ...investigation, evidence: [...investigation.evidence, record] });
  },

  deleteEvidence(
    investigation: ForensicAccidentInvestigation,
    evidenceId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      evidence: investigation.evidence.filter((item) => item.id !== evidenceId),
      measurements: investigation.measurements.map((measurement) => ({
        ...measurement,
        sourceEvidenceIds: measurement.sourceEvidenceIds.filter(
          (id) => id !== evidenceId,
        ),
      })),
      analysisFindings: investigation.analysisFindings.map((finding) => ({
        ...finding,
        sourceEvidenceIds: finding.sourceEvidenceIds.filter((id) => id !== evidenceId),
      })),
    });
  },

  addMeasurement(
    investigation: ForensicAccidentInvestigation,
    input: Omit<
      ForensicMeasurementRecord,
      "id" | "code" | "createdAt" | "updatedAt"
    >,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicMeasurementRecord = {
      ...input,
      id: createId("measurement"),
      code: `M-${String(investigation.measurements.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };

    return this.save({
      ...investigation,
      measurements: [...investigation.measurements, record],
    });
  },

  deleteMeasurement(
    investigation: ForensicAccidentInvestigation,
    measurementId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      measurements: investigation.measurements.filter(
        (item) => item.id !== measurementId,
      ),
      analysisFindings: investigation.analysisFindings.map((finding) => ({
        ...finding,
        sourceMeasurementIds: finding.sourceMeasurementIds.filter((id) => id !== measurementId),
      })),
    });
  },

  addVehicle(
    investigation: ForensicAccidentInvestigation,
    input: Omit<
      ForensicVehicleExamination,
      "id" | "code" | "createdAt" | "updatedAt"
    >,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicVehicleExamination = {
      ...input,
      id: createId("vehicle-examination"),
      code: `V-${String(investigation.vehicles.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };

    return this.save({
      ...investigation,
      vehicles: [...investigation.vehicles, record],
    });
  },

  deleteVehicle(
    investigation: ForensicAccidentInvestigation,
    vehicleId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      vehicles: investigation.vehicles.filter(
        (item) => item.id !== vehicleId,
      ),
      persons: investigation.persons.map((person) =>
        person.linkedVehicleId === vehicleId
          ? { ...person, linkedVehicleId: undefined }
          : person,
      ),
      analysisFindings: investigation.analysisFindings.map((finding) => ({
        ...finding,
        sourceVehicleIds: finding.sourceVehicleIds.filter((id) => id !== vehicleId),
      })),
    });
  },

  addPerson(
    investigation: ForensicAccidentInvestigation,
    input: Omit<
      ForensicPersonRecord,
      "id" | "code" | "createdAt" | "updatedAt"
    >,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicPersonRecord = {
      ...input,
      id: createId("person"),
      code: `P-${String(investigation.persons.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };

    return this.save({
      ...investigation,
      persons: [...investigation.persons, record],
    });
  },

  deletePerson(
    investigation: ForensicAccidentInvestigation,
    personId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      persons: investigation.persons.filter(
        (item) => item.id !== personId,
      ),
      witnesses: investigation.witnesses.map((witness) =>
        witness.linkedPersonId === personId
          ? { ...witness, linkedPersonId: undefined }
          : witness,
      ),
      analysisFindings: investigation.analysisFindings.map((finding) => ({
        ...finding,
        sourcePersonIds: finding.sourcePersonIds.filter((id) => id !== personId),
      })),
    });
  },

  addWitness(
    investigation: ForensicAccidentInvestigation,
    input: Omit<
      ForensicWitnessRecord,
      "id" | "code" | "createdAt" | "updatedAt"
    >,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicWitnessRecord = {
      ...input,
      id: createId("witness"),
      code: `W-${String(investigation.witnesses.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };

    return this.save({
      ...investigation,
      witnesses: [...investigation.witnesses, record],
    });
  },

  deleteWitness(
    investigation: ForensicAccidentInvestigation,
    witnessId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      witnesses: investigation.witnesses.filter(
        (item) => item.id !== witnessId,
      ),
      analysisFindings: investigation.analysisFindings.map((finding) => ({
        ...finding,
        sourceWitnessIds: finding.sourceWitnessIds.filter((id) => id !== witnessId),
      })),
    });
  },

  addAnalysisFinding(
    investigation: ForensicAccidentInvestigation,
    input: Omit<ForensicAnalysisFinding, "id" | "code" | "createdAt" | "updatedAt">,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicAnalysisFinding = {
      ...input,
      id: createId("analysis-finding"),
      code: `A-${String(investigation.analysisFindings.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };

    return this.save({
      ...investigation,
      analysisFindings: [...investigation.analysisFindings, record],
    });
  },

  deleteAnalysisFinding(
    investigation: ForensicAccidentInvestigation,
    findingId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      analysisFindings: investigation.analysisFindings.filter((item) => item.id !== findingId),
      hypotheses: investigation.hypotheses.map((hypothesis) => ({
        ...hypothesis,
        supportingFindingIds: hypothesis.supportingFindingIds.filter((id) => id !== findingId),
        conflictingFindingIds: hypothesis.conflictingFindingIds.filter((id) => id !== findingId),
      })),
    });
  },

  addHypothesis(
    investigation: ForensicAccidentInvestigation,
    input: Omit<ForensicCrashHypothesis, "id" | "code" | "createdAt" | "updatedAt">,
  ): ForensicAccidentInvestigation {
    const now = nowIso();
    const record: ForensicCrashHypothesis = {
      ...input,
      provenance: "Investigator Assumption",
      id: createId("crash-hypothesis"),
      code: `H-${String(investigation.hypotheses.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };
    return this.save({ ...investigation, hypotheses: [...investigation.hypotheses, record] });
  },

  updateHypothesis(
    investigation: ForensicAccidentInvestigation,
    hypothesisId: string,
    patch: Partial<Omit<ForensicCrashHypothesis, "id" | "code" | "createdAt" | "updatedAt" | "provenance">>,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      hypotheses: investigation.hypotheses.map((hypothesis) =>
        hypothesis.id === hypothesisId
          ? { ...hypothesis, ...patch, provenance: "Investigator Assumption", updatedAt: nowIso() }
          : hypothesis,
      ),
    });
  },

  setHypothesisSimulationSelected(
    investigation: ForensicAccidentInvestigation,
    hypothesisId: string,
    selectedForSimulation: boolean,
  ): ForensicAccidentInvestigation {
    const current = investigation.hypotheses.find((item) => item.id === hypothesisId);
    return this.updateHypothesis(investigation, hypothesisId, {
      selectedForSimulation,
      status: selectedForSimulation
        ? "Ready for simulation"
        : current?.status === "Ready for simulation"
          ? "Under review"
          : current?.status,
    });
  },

  deleteHypothesis(
    investigation: ForensicAccidentInvestigation,
    hypothesisId: string,
  ): ForensicAccidentInvestigation {
    return this.save({
      ...investigation,
      hypotheses: investigation.hypotheses.filter((item) => item.id !== hypothesisId),
    });
  },
};
