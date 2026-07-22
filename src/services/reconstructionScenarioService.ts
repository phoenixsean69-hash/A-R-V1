import type { AccidentReconstruction } from "../types/reconstruction";

const STORAGE_KEY = "roadsafe-ar-reconstruction-scenarios";

export type ScenarioStatus = "Under Review" | "Accepted" | "Rejected";
export type AssumptionClassification = "Observed" | "Measured" | "Reported" | "Estimated" | "Assumed";

export interface ScenarioAssumption {
  id: string;
  label: string;
  value: string;
  classification: AssumptionClassification;
  evidenceRecordIds: string[];
  notes: string;
}

export interface ReconstructionScenario {
  id: string;
  baseReconstructionId: string;
  name: string;
  status: ScenarioStatus;
  preferred: boolean;
  conclusion: string;
  assumptions: ScenarioAssumption[];
  snapshot: AccidentReconstruction;
  createdAt: string;
  updatedAt: string;
}

function readAll(): ReconstructionScenario[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as ReconstructionScenario[] : [];
  } catch {
    return [];
  }
}

function writeAll(scenarios: ReconstructionScenario[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ReconstructionScenarioService = {
  list(baseReconstructionId: string): ReconstructionScenario[] {
    return readAll()
      .filter((scenario) => scenario.baseReconstructionId === baseReconstructionId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  create(reconstruction: AccidentReconstruction, name: string): ReconstructionScenario {
    const now = new Date().toISOString();
    const scenario: ReconstructionScenario = {
      id: createId("scenario"),
      baseReconstructionId: reconstruction.id,
      name: name.trim() || "Alternative scenario",
      status: "Under Review",
      preferred: false,
      conclusion: "",
      assumptions: [],
      snapshot: structuredClone(reconstruction),
      createdAt: now,
      updatedAt: now,
    };
    writeAll([...readAll(), scenario]);
    return scenario;
  },

  update(scenarioId: string, updates: Partial<Omit<ReconstructionScenario, "id" | "baseReconstructionId" | "createdAt">>): ReconstructionScenario | null {
    const all = readAll();
    let updated: ReconstructionScenario | null = null;
    const next = all.map((scenario) => {
      if (scenario.id !== scenarioId) return scenario;
      updated = { ...scenario, ...updates, updatedAt: new Date().toISOString() };
      return updated;
    });
    writeAll(next);
    return updated;
  },

  capture(scenarioId: string, reconstruction: AccidentReconstruction): ReconstructionScenario | null {
    return this.update(scenarioId, { snapshot: structuredClone(reconstruction) });
  },

  setPreferred(baseReconstructionId: string, scenarioId: string): void {
    writeAll(readAll().map((scenario) => scenario.baseReconstructionId === baseReconstructionId
      ? { ...scenario, preferred: scenario.id === scenarioId, updatedAt: scenario.id === scenarioId ? new Date().toISOString() : scenario.updatedAt }
      : scenario));
  },

  remove(scenarioId: string): void {
    writeAll(readAll().filter((scenario) => scenario.id !== scenarioId));
  },
};
