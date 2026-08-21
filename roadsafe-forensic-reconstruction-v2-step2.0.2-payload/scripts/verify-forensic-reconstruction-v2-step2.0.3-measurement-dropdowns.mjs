import fs from "node:fs";

const file =
  "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx";

if (!fs.existsSync(file)) {
  throw new Error(`Missing workspace: ${file}`);
}

const source =
  fs.readFileSync(file, "utf8");

const checks = [
  [
    "Measurement method options exist",
    source.includes("const MEASUREMENT_METHOD_OPTIONS = ["),
  ],
  [
    "Measurement location options exist",
    source.includes("const MEASUREMENT_LOCATION_OPTIONS = ["),
  ],
  [
    "Measurement choice helper exists",
    source.includes("const measurementChoiceField = ("),
  ],
  [
    "Method field uses dropdown/manual helper",
    source.includes('\"Measurement method / source\"') &&
      source.includes('\"method\"') &&
      source.includes("MEASUREMENT_METHOD_OPTIONS,"),
  ],
  [
    "Location field uses dropdown/manual helper",
    source.includes('\"Location / reference description\"') &&
      source.includes('\"location\"') &&
      source.includes("MEASUREMENT_LOCATION_OPTIONS,"),
  ],
  [
    "Measurement helper is used twice",
    (source.match(/measurementChoiceField\(/g) ?? []).length >= 2,
  ],
  [
    "Manual option wording exists in measurement helper",
    source.includes("const measurementChoiceField = (") &&
      source.includes("Other / specify manually"),
  ],
  [
    "Measurement form still stores free text method",
    source.includes("method: measurementMethod.trim()"),
  ],
  [
    "Measurement form still stores free text location",
    source.includes("locationDescription: measurementLocation.trim()"),
  ],
  [
    "Measurement manual state resets after add",
    source.includes("setManualMeasurementChoices(new Set());"),
  ],
];

let failed = 0;

for (const [label, passed] of checks) {
  if (passed) console.log(`[OK] ${label}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failed) {
  throw new Error(
    `Step 2.0.3 measurement dropdown verification failed: ${failed} check(s) failed.`,
  );
}

console.log("");
console.log(
  `[RoadSafe] Step 2.0.3 measurement dropdown verification passed (${checks.length}/${checks.length}).`,
);
