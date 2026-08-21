import type { AccidentCase } from "../../types/accidentCase";
import type {
  ForensicAccidentInvestigation,
  ForensicEvidenceRecord,
  ForensicMeasurementRecord,
  ForensicPersonRecord,
  ForensicVehicleExamination,
} from "./forensicInvestigationTypes";

const STORAGE_KEY = "roadsafe-forensic-investigations-v2";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
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
      weather: "",
      lighting: "",
      roadCondition: "",
      trafficControlState: "",
      roadGeometry: "",
      sceneDatumLabel: "",
      coordinateNotes: "",
      preservationNotes: "",
      lastUpdatedAt: now,
    },
    evidence: [],
    measurements: [],
    vehicles: [],
    persons: [],
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
    if (existing) return existing;
    const created = createFromCase(accidentCase);
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
    });
  },
};
