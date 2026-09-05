import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(
  fileURLToPath(import.meta.url),
);

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

const CAPTURE_COMPONENT = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicDatumPicker.tsx",
);

const PAYLOAD = path.join(
  HERE,
  "payload",
  "ForensicDatumPicker.tsx",
);

function fail(message) {
  console.error(
    `\n[RoadSafe] ${message}`,
  );
  process.exit(1);
}

if (
  !fs.existsSync(
    path.join(ROOT, "package.json"),
  )
) {
  fail(
    "Run this installer from the A-R-V1 project root.",
  );
}

for (const file of [
  WORKSPACE,
  TYPES,
  CAPTURE_COMPONENT,
]) {
  if (
    !fs.existsSync(file)
  ) {
    fail(
      `Required file missing: ${path.relative(ROOT, file)}`,
    );
  }
}

if (
  !fs.existsSync(PAYLOAD)
) {
  fail(
    "GNSS capture component payload is missing.",
  );
}

let workspace =
  fs.readFileSync(
    WORKSPACE,
    "utf8",
  );

let types =
  fs.readFileSync(
    TYPES,
    "utf8",
  );

const fixedLabel =
  "<span>Fixed reference point</span>";

const fixedLabelIndex =
  workspace.indexOf(
    fixedLabel,
  );

if (
  fixedLabelIndex < 0
) {
  fail(
    "Could not locate the Fixed reference point field. No file changed.",
  );
}

const fieldStart =
  workspace.lastIndexOf(
    '<div className="fv2-field">',
    fixedLabelIndex,
  );

const nextField =
  workspace.indexOf(
    '<div className="fv2-field">',
    fixedLabelIndex +
      fixedLabel.length,
  );

if (
  fieldStart < 0 ||
  nextField < 0
) {
  fail(
    "Could not isolate the Fixed reference point field. No file changed.",
  );
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-ui-backup",
    `forensic-gnss-datum-v2-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

for (const file of [
  WORKSPACE,
  TYPES,
  CAPTURE_COMPONENT,
]) {
  fs.copyFileSync(
    file,
    path.join(
      backupDir,
      path.basename(file),
    ),
  );
}

// -----------------------------------------------------------------------------
// Type model: replace old manual-map datum with field GNSS datum.
// Backward-compat optional scene X/Y fields remain so old local data can load.
// -----------------------------------------------------------------------------

const datumInterface =
`export interface ForensicSceneDatum {
  label: string;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  bestAccuracyMetres?: number;
  worstAccuracyMetres?: number;
  altitudeMetres?: number;
  altitudeAccuracyMetres?: number;
  sampleCount: number;
  captureDurationSeconds: number;
  positionTimestamp: string;
  selectedAt: string;
  capturedBy: string;
  source: "Browser Geolocation API";
  method: "Device GNSS - field captured";
  xPercent?: number;
  yPercent?: number;
  xMetres?: number;
  yMetres?: number;
}`;

const existingDatumPattern =
  /export interface ForensicSceneDatum \{[\s\S]*?\n\}/m;

if (
  existingDatumPattern.test(
    types,
  )
) {
  types =
    types.replace(
      existingDatumPattern,
      datumInterface,
    );
} else {
  const sceneIntakeAnchor =
    "export interface ForensicSceneIntake {";

  if (
    !types.includes(
      sceneIntakeAnchor,
    )
  ) {
    fail(
      "Could not locate ForensicSceneIntake type. No file changed.",
    );
  }

  types =
    types.replace(
      sceneIntakeAnchor,
      `${datumInterface}

${sceneIntakeAnchor}`,
    );
}

if (
  !types.includes(
    "sceneDatum?: ForensicSceneDatum;",
  )
) {
  types =
    types.replace(
      "  sceneDatumLabel: string;",
      `  sceneDatumLabel: string;
  sceneDatum?: ForensicSceneDatum;`,
    );
}

// -----------------------------------------------------------------------------
// Scene Intake control: no map wording. Officer physically walks to datum.
// -----------------------------------------------------------------------------

const fixedField =
`<div className="fv2-field">
                  <span>Fixed reference point</span>

                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={String(investigation.scene.sceneDatumLabel ?? "")}
                      placeholder="No field datum captured"
                      className="min-w-0 flex-1"
                    />

                    <button
                      type="button"
                      onClick={() => setDatumPickerOpen(true)}
                      className="shrink-0 rounded border border-[#8c6039] bg-[#3a2c21] px-3 text-[9px] font-bold text-[#f0c49a]"
                    >
                      {investigation.scene.sceneDatum
                        ? "Recapture at point"
                        : "Set reference point"}
                    </button>
                  </div>

                  {investigation.scene.sceneDatum && (
                    <small className="fv2-help">
                      {investigation.scene.sceneDatum.latitude.toFixed(7)},{" "}
                      {investigation.scene.sceneDatum.longitude.toFixed(7)}
                      {" · "}GNSS accuracy ±
                      {typeof investigation.scene.sceneDatum.accuracyMetres === "number"
                        ? investigation.scene.sceneDatum.accuracyMetres.toFixed(1)
                        : "?"} m
                      {" · "}
                      {investigation.scene.sceneDatum.sampleCount ?? 1} sample(s)
                      {" · "}Device GNSS field capture
                    </small>
                  )}

                  <small className="fv2-help">
                    Officer physically walks to a permanent scene feature, stands
                    at the exact point, then lets RoadSafe capture several live
                    device GNSS fixes. No map clicking is used.
                  </small>
                </div>

                `;

workspace =
  workspace.slice(
    0,
    fieldStart,
  ) +
  fixedField +
  workspace.slice(
    nextField,
  );

// Replace confirmation message wording from the previous map picker if present.
workspace =
  workspace.replace(
    /Fixed reference point saved:[\s\S]*?longitude\.toFixed\(7\)\}\.`/m,
    `Fixed reference point field-captured: \${datum.label} at \${datum.latitude.toFixed(
                7,
              )}, \${datum.longitude.toFixed(7)} with ±\${datum.accuracyMetres.toFixed(
                1,
              )} m reported GNSS accuracy.\``,
  );

// If the exact previous message did not match, safely replace the simple phrase.
workspace =
  workspace.replace(
    "Fixed reference point saved:",
    "Fixed reference point field-captured:",
  );

fs.writeFileSync(
  TYPES,
  types,
  "utf8",
);

fs.writeFileSync(
  WORKSPACE,
  workspace,
  "utf8",
);

fs.copyFileSync(
  PAYLOAD,
  CAPTURE_COMPONENT,
);

console.log(
  "\n[RoadSafe] Forensic GNSS Datum V2 installed.",
);
console.log(
  "[RoadSafe] Manual map picking -> REMOVED.",
);
console.log(
  "[RoadSafe] Officer walk-to-point workflow -> ACTIVE.",
);
console.log(
  "[RoadSafe] Browser/device live GNSS -> ACTIVE.",
);
console.log(
  "[RoadSafe] Multi-sample capture -> up to 8 fresh fixes / 12 seconds.",
);
console.log(
  "[RoadSafe] Median / best / worst reported accuracy -> stored.",
);
console.log(
  "[RoadSafe] Capture officer / time / source / method -> stored.",
);
console.log(
  "[RoadSafe] Fine measurements remain separate from phone GNSS uncertainty.",
);
console.log(
  `[RoadSafe] Backup: ${path.relative(
    ROOT,
    backupDir,
  )}`,
);
console.log("\nRun:");
console.log("  npm run build");
