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
    "Fixed reference point uses plain language",
    source.includes("Fixed reference point"),
  ],
  [
    "Reference point includes plain-language guidance",
    source.includes(
      "Choose one permanent object at the scene that all distances will be measured from.",
    ),
  ],
  [
    "Measurement directions replaces coordinate convention wording",
    source.includes("Measurement directions"),
  ],
  [
    "Direction field includes plain-language guidance",
    source.includes(
      "Explain which way you will measure along and across the road.",
    ),
  ],
  [
    "Evidence X is presented as along-road distance",
    source.includes("Along road (m)"),
  ],
  [
    "Evidence Y is presented as across-road distance",
    source.includes("Across road (m)"),
  ],
  [
    "Evidence helper refers to measured-from reference point",
    source.includes("Measured from:"),
  ],
  [
    "Spatial plan header refers to reference point",
    source.includes("Reference point:"),
  ],
  [
    "Old jargon label is gone from visible UI",
    !source.includes(">Scene datum / fixed reference<"),
  ],
  [
    "Old coordinate convention label is gone from visible UI",
    !source.includes(">Coordinate convention<"),
  ],
];

let failed = 0;

for (const [label, passed] of checks) {
  if (passed) {
    console.log(`[OK] ${label}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failed) {
  throw new Error(
    `Step 2.0.1 clear-language verification failed: ${failed} check(s) failed.`,
  );
}

console.log("");
console.log(
  `[RoadSafe] Step 2.0.1 clear-language verification passed (${checks.length}/${checks.length}).`,
);
