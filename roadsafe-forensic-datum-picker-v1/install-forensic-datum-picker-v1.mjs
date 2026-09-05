import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const WORKSPACE = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicInvestigationWorkspace.tsx",
);

const TYPES = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "forensicInvestigationTypes.ts",
);

const PICKER = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicDatumPicker.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

for (const file of [WORKSPACE, TYPES]) {
  if (!fs.existsSync(file)) {
    fail(`Required file missing: ${path.relative(ROOT, file)}`);
  }
}

const pickerPayload = path.join(HERE, "payload", "ForensicDatumPicker.tsx");

if (!fs.existsSync(pickerPayload)) {
  fail("ForensicDatumPicker.tsx payload is missing.");
}

let workspace = fs.readFileSync(WORKSPACE, "utf8");
let types = fs.readFileSync(TYPES, "utf8");

// Validate anchors before writing.
if (!workspace.includes('import ReportWorkspace from "./ReportWorkspace";')) {
  fail("Could not locate ReportWorkspace import. No file changed.");
}

if (!workspace.includes('const [message, setMessage] = useState("");')) {
  fail("Could not locate workspace message state. No file changed.");
}

if (!workspace.includes('<div className="fv2-root">')) {
  fail("Could not locate forensic workspace root. No file changed.");
}

const datumFieldPattern =
  /<div className="fv2-field">\s*<span>Fixed reference point<\/span>[\s\S]*?<small className="fv2-help">[\s\S]*?<\/small>\s*<\/div>/m;

if (!datumFieldPattern.test(workspace)) {
  fail("Could not locate the current Fixed reference point field. No file changed.");
}

if (!types.includes("export interface ForensicSceneIntake {")) {
  fail("Could not locate ForensicSceneIntake type. No file changed.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-datum-picker-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [WORKSPACE, TYPES, PICKER]) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  }
}

// Add structured datum type.
if (!types.includes("export interface ForensicSceneDatum {")) {
  types = types.replace(
    "export interface ForensicSceneIntake {",
    `export interface ForensicSceneDatum {
  label: string;
  latitude: number;
  longitude: number;
  xPercent: number;
  yPercent: number;
  xMetres: number;
  yMetres: number;
  selectedAt: string;
  method: "Manual map pick";
}

export interface ForensicSceneIntake {`,
  );

  types = types.replace(
    "  sceneDatumLabel: string;",
    `  sceneDatumLabel: string;
  sceneDatum?: ForensicSceneDatum;`,
  );
}

// Import picker.
const pickerImport = 'import ForensicDatumPicker from "./ForensicDatumPicker";';

if (!workspace.includes(pickerImport)) {
  workspace = workspace.replace(
    'import ReportWorkspace from "./ReportWorkspace";',
    `import ReportWorkspace from "./ReportWorkspace";
${pickerImport}`,
  );
}

// Add picker open state.
if (!workspace.includes("datumPickerOpen")) {
  workspace = workspace.replace(
    '  const [message, setMessage] = useState("");',
    `  const [message, setMessage] = useState("");
  const [datumPickerOpen, setDatumPickerOpen] = useState(false);`,
  );
}

// Replace free-text datum field with map picker control.
const datumField = `<div className="fv2-field">
                  <span>Fixed reference point</span>

                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={String(investigation.scene.sceneDatumLabel ?? "")}
                      placeholder="No fixed reference point selected"
                      className="min-w-0 flex-1"
                    />

                    <button
                      type="button"
                      onClick={() => setDatumPickerOpen(true)}
                      className="shrink-0 rounded border border-[#8c6039] bg-[#3a2c21] px-3 text-[9px] font-bold text-[#f0c49a]"
                    >
                      {investigation.scene.sceneDatum
                        ? "Change on map"
                        : "Pick on map"}
                    </button>
                  </div>

                  {investigation.scene.sceneDatum && (
                    <small className="fv2-help">
                      {investigation.scene.sceneDatum.latitude.toFixed(7)},{" "}
                      {investigation.scene.sceneDatum.longitude.toFixed(7)}
                      {" · "}Scene X{" "}
                      {investigation.scene.sceneDatum.xMetres.toFixed(3)} m
                      {" · "}Y{" "}
                      {investigation.scene.sceneDatum.yMetres.toFixed(3)} m
                      {" · "}Manual map pick
                    </small>
                  )}

                  <small className="fv2-help">
                    Pick one permanent, identifiable point inside the frozen
                    forensic core. All later scene measurements can reference
                    this datum.
                  </small>
                </div>`;

workspace = workspace.replace(datumFieldPattern, datumField);

// Render picker at root level.
if (!workspace.includes("<ForensicDatumPicker")) {
  workspace = workspace.replace(
    '<div className="fv2-root">',
    `<div className="fv2-root">
      {datumPickerOpen && (
        <ForensicDatumPicker
          accidentCase={accidentCase}
          currentDatum={investigation.scene.sceneDatum}
          onCancel={() => setDatumPickerOpen(false)}
          onConfirm={(datum) => {
            setInvestigation((current) => ({
              ...current,
              scene: {
                ...current.scene,
                sceneDatumLabel: datum.label,
                sceneDatum: datum,
                lastUpdatedAt: new Date().toISOString(),
              },
            }));

            setDatumPickerOpen(false);
            setMessage(
              \`Fixed reference point saved: \${datum.label} at \${datum.latitude.toFixed(
                7,
              )}, \${datum.longitude.toFixed(7)}.\`,
            );
          }}
        />
      )}`,
  );
}

fs.writeFileSync(TYPES, types, "utf8");
fs.writeFileSync(WORKSPACE, workspace, "utf8");
fs.copyFileSync(pickerPayload, PICKER);

console.log("\n[RoadSafe] Forensic Datum Picker V1 installed.");
console.log("[RoadSafe] Fixed reference point -> manual map selection.");
console.log("[RoadSafe] Frozen forensic core -> reused from linked reconstruction.");
console.log("[RoadSafe] Accident anchor -> shown in red.");
console.log("[RoadSafe] Datum point -> constrained to frozen core.");
console.log("[RoadSafe] Lat/lon + scene X/Y -> stored with the investigation.");
console.log("[RoadSafe] Free-text-only datum workflow -> removed.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
