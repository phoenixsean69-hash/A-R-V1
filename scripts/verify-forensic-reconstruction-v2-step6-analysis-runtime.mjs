import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function compile(file) {
  const source = fs.readFileSync(file, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
}

function runCommonJs(js, file, extra = {}) {
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    ...extra,
  };
  context.exports = context.module.exports;
  vm.createContext(context);
  vm.runInContext(js, context, { filename: file });
  return context.module.exports;
}

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};

const serviceFile = "src/features/forensicReconstruction/forensicInvestigationService.ts";
const serviceExports = runCommonJs(
  compile(serviceFile),
  serviceFile,
  { localStorage },
);
const service = serviceExports.ForensicInvestigationService;
if (!service) throw new Error("ForensicInvestigationService export unavailable.");

const base = {
  version: 2,
  id: "investigation-1",
  caseId: "case-1",
  caseNumber: "RSA-TEST",
  caseTitle: "Runtime test",
  investigatingOfficer: "Officer Test",
  policeStation: "Test Station",
  scene: {
    location: "Test road",
    accidentDate: "2026-08-21",
    accidentTime: "10:00",
    weather: "Clear",
    lighting: "Daylight",
    roadCondition: "Dry",
    trafficControlState: "No traffic control",
    roadGeometry: "Straight road",
    sceneDatumLabel: "Pole",
    coordinateNotes: "Forward / across",
    preservationNotes: "",
    lastUpdatedAt: new Date().toISOString(),
  },
  evidence: [{
    id: "e1", code: "E-001", source: "Crime Scene", type: "Skid Mark",
    description: "Visible tyre mark", locationDescription: "Lane one",
    provenance: "Observed", confidence: "High", collected: false,
    notes: "", createdAt: "x", updatedAt: "x",
  }],
  measurements: [{
    id: "m1", code: "M-001", category: "Distance", label: "Skid length",
    value: 20, unit: "m", method: "Tape measure", locationDescription: "Lane one",
    sourceEvidenceIds: ["e1"], provenance: "Measured", confidence: "High",
    notes: "", createdAt: "x", updatedAt: "x",
  }],
  vehicles: [],
  persons: [],
  witnesses: [],
  analysisFindings: [],
  createdAt: "x",
  updatedAt: "x",
};

let current = service.save(base);
current = service.addAnalysisFinding(current, {
  category: "Speed / braking",
  method: "Evidence correlation",
  finding: "Current evidence supports braking before impact.",
  status: "Partly supported",
  usesSceneIntake: true,
  sourceEvidenceIds: ["e1"],
  sourceMeasurementIds: ["m1"],
  sourceVehicleIds: [],
  sourcePersonIds: [],
  sourceWitnessIds: [],
  limitations: ["Measurement uncertainty"],
  limitationNotes: "Surface drag not yet calculated.",
  followUpAction: "Obtain additional measurements",
  origin: "Investigator analysis",
  confidence: "Moderate",
});

if (current.analysisFindings.length !== 1) {
  throw new Error("Analysis finding add failed.");
}

const persisted = service.getByCaseId("case-1");
if (!persisted || persisted.analysisFindings.length !== 1) {
  throw new Error("Analysis finding persistence failed.");
}

const findingId = persisted.analysisFindings[0].id;
current = service.deleteAnalysisFinding(persisted, findingId);
if (current.analysisFindings.length !== 0) {
  throw new Error("Analysis finding delete failed.");
}

const legacy = { ...base };
delete legacy.analysisFindings;
const migrated = service.save(legacy);
if (!Array.isArray(migrated.analysisFindings)) {
  throw new Error("Legacy record analysisFindings migration failed.");
}

const rulesFile = "src/features/forensicReconstruction/forensicAnalysisRules.ts";
const rulesExports = runCommonJs(compile(rulesFile), rulesFile);
const scan = rulesExports.buildForensicAnalysisSignals;
if (!scan) throw new Error("Analysis scanner export unavailable.");

const scanInput = {
  ...base,
  persons: [{
    id: "p1", code: "P-001", label: "Possible Driver", identityStatus: "Identity not yet confirmed",
    fullName: "", identityNumber: "", licenceNumber: "", involvement: "Driver",
    driverCandidateStatus: "Possible driver — not confirmed",
    foundLocation: "", bodyPosition: "", observedCondition: "", injurySeriousness: "",
    injuryAreas: [], protectionObserved: "", nextAction: "", sourceEvidenceIds: [],
    provenance: "Observed", confidence: "Low", notes: "", createdAt: "x", updatedAt: "x",
  }],
  witnesses: [{
    id: "w1", code: "W-001", label: "Witness A", identityStatus: "Identified",
    fullName: "Witness", contactDetails: "", relationshipToCrash: "Independent bystander",
    statementDate: "2026-08-21", statementTime: "10:10", statementMethod: "Written and signed statement",
    observationCoverage: "Saw impact only", observationLocation: "Roadside", viewCondition: "Clear / unobstructed view",
    observationTopics: [], statementSummary: "", sourceEvidenceIds: [],
    assessmentStatus: "Conflicts with physical evidence", assessmentNotes: "", provenance: "Witness Reported",
    confidence: "Moderate", createdAt: "x", updatedAt: "x",
  }],
};

const signals = scan(scanInput);
if (!signals.some((item) => item.id === "driver-identity-unresolved")) {
  throw new Error("Driver identity warning was not generated.");
}
if (!signals.some((item) => item.id === "witness-conflict" && item.level === "conflict")) {
  throw new Error("Witness conflict signal was not generated.");
}

console.log("[OK] Analysis persistence + migration + consistency scan runtime tests passed.");
