import fs from "node:fs";

const file =
  "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx";

if (!fs.existsSync(file)) {
  throw new Error(
    `Missing forensic workspace: ${file}`,
  );
}

const source =
  fs.readFileSync(
    file,
    "utf8",
  );

const checks = [
  [
    "Weather uses dropdown choices",
    source.includes(
      '"Weather",\\n                  "weather"',
    ),
  ],
  [
    "Lighting uses dropdown choices",
    source.includes(
      '"Lighting",\\n                  "lighting"',
    ),
  ],
  [
    "Road condition uses dropdown choices",
    source.includes(
      '"Road condition",\\n                  "roadCondition"',
    ),
  ],
  [
    "Traffic-control state uses dropdown choices",
    source.includes(
      '"Traffic-control state",\\n                  "trafficControlState"',
    ),
  ],
  [
    "Road geometry uses dropdown choices",
    source.includes(
      '"Road geometry",\\n                  "roadGeometry"',
    ),
  ],
  [
    "Manual Other option exists",
    source.includes(
      "Other / specify manually",
    ),
  ],
  [
    "Custom/manual values are preserved in investigation scene fields",
    source.includes(
      "[key]: event.target.value",
    ),
  ],
  [
    "Existing free-text accident location remains available",
    source.includes(
      'field("Accident location", "location")',
    ),
  ],
];

for (const [label, passed] of checks) {
  if (!passed) {
    throw new Error(
      `FAILED: ${label}`,
    );
  }

  console.log(
    `[OK] ${label}`,
  );
}

console.log("");
console.log(
  "[RoadSafe] Forensic Reconstruction V2 Step 1.1 scene dropdown verification passed.",
);
