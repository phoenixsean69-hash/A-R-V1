import type { AccidentCase } from "../../types/accidentCase";
import type {
  ForensicAccidentInvestigation,
  ForensicEvidenceRecord,
  ForensicMeasurementRecord,
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
    createdAt: now,
    updatedAt: now,
  };
}

export const ForensicInvestigationService = {
  getOrCreate(accidentCase: AccidentCase): ForensicAccidentInvestigation {
    const existing = readAll().find((item) => item.caseId === accidentCase.id);
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
    return updated;
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
};
