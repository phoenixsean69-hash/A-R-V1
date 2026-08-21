import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromRepo = createRequire(path.join(process.cwd(), "package.json"));
const ts = requireFromRepo("typescript");

const file = "src/features/forensicReconstruction/forensicInvestigationService.ts";
const source = fs.readFileSync(file, "utf8");
const transpiled = ts.transpileModule(source, {
  fileName: file,
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  },
  reportDiagnostics: true,
});

const errors = (transpiled.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
if (errors.length) {
  throw new Error(
    errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"),
  );
}

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};

const module = { exports: {} };
const context = vm.createContext({
  console,
  localStorage,
  module,
  exports: module.exports,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Object,
  Error,
});

vm.runInContext(transpiled.outputText, context, { filename: "forensicInvestigationService.js" });
const service = module.exports.ForensicInvestigationService;
if (!service) throw new Error("ForensicInvestigationService was not exported.");

const investigation = {
  version: 2,
  id: "investigation-runtime-test",
  caseId: "case-runtime-test",
  caseNumber: "RSA-TEST-001",
  caseTitle: "Witness runtime test",
  investigatingOfficer: "Test Officer",
  policeStation: "Test Station",
  scene: {
    location: "Test junction",
    accidentDate: "2026-08-21",
    accidentTime: "10:00",
    weather: "Clear",
    lighting: "Daylight",
    roadCondition: "Dry",
    trafficControlState: "No traffic control",
    roadGeometry: "Straight road",
    sceneDatumLabel: "Lamp post",
    coordinateNotes: "Along / across road",
    preservationNotes: "",
    lastUpdatedAt: new Date().toISOString(),
  },
  evidence: [],
  measurements: [],
  vehicles: [],
  persons: [],
  witnesses: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const saved = service.save(investigation);
const withWitness = service.addWitness(saved, {
  label: "Witness A",
  identityStatus: "Identified",
  fullName: "Runtime Witness",
  contactDetails: "0770000000",
  linkedPersonId: undefined,
  relationshipToCrash: "Independent bystander",
  statementDate: "2026-08-21",
  statementTime: "10:30",
  statementMethod: "Written and signed statement",
  observationCoverage: "Saw impact only",
  observationLocation: "North-east corner",
  spatialPosition: { xMetres: 12, yMetres: 5, datumLabel: "Lamp post" },
  viewCondition: "Clear / unobstructed view",
  approximateDistanceMetres: 18,
  observationTopics: ["Direction of travel", "Collision point / area"],
  statementSummary: "Witness reported seeing the two vehicles make contact at the junction.",
  sourceEvidenceIds: [],
  assessmentStatus: "Not yet assessed",
  assessmentNotes: "",
  provenance: "Witness Reported",
  confidence: "Unverified",
});

if (withWitness.witnesses.length !== 1) throw new Error("Witness was not added.");
if (withWitness.witnesses[0].code !== "W-001") throw new Error("Witness code was not generated correctly.");
if (withWitness.witnesses[0].provenance !== "Witness Reported") throw new Error("Witness provenance changed unexpectedly.");
if (withWitness.witnesses[0].spatialPosition?.xMetres !== 12) throw new Error("Witness spatial position did not persist.");

const readBack = service.getByCaseId(investigation.caseId);
if (!readBack || readBack.witnesses.length !== 1) throw new Error("Witness did not survive localStorage read-back.");
if (readBack.witnesses[0].observationTopics.length !== 2) throw new Error("Witness observation topics did not survive read-back.");

const deleted = service.deleteWitness(readBack, readBack.witnesses[0].id);
if (deleted.witnesses.length !== 0) throw new Error("Witness delete did not persist.");

console.log("[OK] Created forensic investigation");
console.log("[OK] Added W-001 witness statement");
console.log("[OK] Witness position persisted");
console.log("[OK] Witness observation topics persisted");
console.log("[OK] Witness provenance remained Witness Reported");
console.log("[OK] localStorage read-back passed");
console.log("[OK] Witness delete passed");
console.log("[RoadSafe] Step 5 witness runtime verification passed.");
