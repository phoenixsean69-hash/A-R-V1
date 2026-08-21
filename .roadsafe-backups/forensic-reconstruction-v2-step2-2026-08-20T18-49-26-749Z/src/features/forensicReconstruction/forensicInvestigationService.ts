import type { AccidentCase } from "../../types/accidentCase";
import type {
  ForensicAccidentInvestigation,
  ForensicEvidenceRecord,
} from "./forensicInvestigationTypes";

const STORAGE_KEY = "roadsafe-forensic-investigations-v2";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readAll(): ForensicAccidentInvestigation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForensicAccidentInvestigation[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.version === 2 && typeof item.caseId === "string")
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
      preservationNotes: "",
      lastUpdatedAt: now,
    },
    evidence: [],
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
    const updated = { ...investigation, updatedAt: nowIso() };
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
    });
  },
};
