import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "forensicInvestigationService.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("forensicInvestigationService.ts was not found.");
}

let source = fs.readFileSync(TARGET, "utf8");

const required = [
  'import type { AccidentCase } from "../../types/accidentCase";',
  "function createFromCase(accidentCase: AccidentCase): ForensicAccidentInvestigation",
  "getOrCreate(accidentCase: AccidentCase): ForensicAccidentInvestigation",
];

for (const signal of required) {
  if (!source.includes(signal)) {
    fail(`Expected source anchor missing: ${signal}. No file changed.`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `wizard-forensic-recall-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "forensicInvestigationService.ts"),
);

// -----------------------------------------------------------------------------
// 1. Import ReconstructionService so the forensic workflow can read the
//    scene/environment already created by the 4-step case wizard.
// -----------------------------------------------------------------------------

const accidentCaseImport =
  'import type { AccidentCase } from "../../types/accidentCase";';

const reconstructionImport =
  'import { ReconstructionService } from "../../services/reconstructionService";';

if (!source.includes(reconstructionImport)) {
  source = source.replace(
    accidentCaseImport,
    `${accidentCaseImport}\n${reconstructionImport}`,
  );
}

// -----------------------------------------------------------------------------
// 2. Add conservative mapping helpers.
//    Rule: preserve known wizard facts, never invent a more specific fact.
// -----------------------------------------------------------------------------

const helperAnchor = `function nowIso(): string {
  return new Date().toISOString();
}
`;

if (!source.includes("function getWizardSceneSeed(")) {
  if (!source.includes(helperAnchor)) {
    fail("Could not locate nowIso helper. No file changed.");
  }

  const helpers = `${helperAnchor}
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
`;

  source = source.replace(helperAnchor, helpers);
}

// -----------------------------------------------------------------------------
// 3. Seed NEW investigations from wizard data.
// -----------------------------------------------------------------------------

const createStart =
  "function createFromCase(accidentCase: AccidentCase): ForensicAccidentInvestigation {";

const createEnd =
  "\n}\n\nexport const ForensicInvestigationService = {";

const createStartIndex = source.indexOf(createStart);
const createEndIndex =
  createStartIndex >= 0
    ? source.indexOf(createEnd, createStartIndex)
    : -1;

if (createStartIndex < 0 || createEndIndex < 0) {
  fail("Could not locate createFromCase function. No file changed.");
}

const currentCreateBlock = source.slice(
  createStartIndex,
  createEndIndex + 2,
);

if (!currentCreateBlock.includes("getWizardSceneSeed")) {
  const newCreateBlock = `function createFromCase(accidentCase: AccidentCase): ForensicAccidentInvestigation {
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
}`;

  source =
    source.slice(0, createStartIndex) +
    newCreateBlock +
    source.slice(createEndIndex + 2);
}

// -----------------------------------------------------------------------------
// 4. Hydrate EXISTING investigations too.
//    This matters for the user's current case, whose forensic record already
//    exists at 38% Scene Intake.
// -----------------------------------------------------------------------------

const oldGetOrCreate = `  getOrCreate(accidentCase: AccidentCase): ForensicAccidentInvestigation {
    const existing =
      this.getByCaseId(
        accidentCase.id,
      );
    if (existing) return existing;
    const created = createFromCase(accidentCase);
    return this.save(created);
  },`;

const newGetOrCreate = `  getOrCreate(accidentCase: AccidentCase): ForensicAccidentInvestigation {
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
  },`;

if (!source.includes(newGetOrCreate)) {
  if (!source.includes(oldGetOrCreate)) {
    fail(
      "Could not locate getOrCreate implementation. No file changed.",
    );
  }

  source = source.replace(
    oldGetOrCreate,
    newGetOrCreate,
  );
}

fs.writeFileSync(TARGET, source, "utf8");

console.log("\n[RoadSafe] Wizard -> Forensic Recall V1 installed.");
console.log("[RoadSafe] Existing case metadata -> recalled when forensic fields are blank.");
console.log("[RoadSafe] Wizard weather -> Scene Intake weather.");
console.log("[RoadSafe] Wizard time-of-day -> Scene Intake lighting.");
console.log("[RoadSafe] Wizard road surface -> Scene Intake road condition.");
console.log("[RoadSafe] Wizard traffic control -> Scene Intake traffic-control state.");
console.log("[RoadSafe] Wizard road layout -> Scene Intake road geometry.");
console.log("[RoadSafe] Investigator-entered forensic values -> NEVER overwritten.");
console.log("[RoadSafe] Fixed reference point / measurement directions -> intentionally NOT invented.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
console.log("\nThen reopen:");
console.log("  /cases/<case-id>/reconstruction");
