import fs from "node:fs";

const WORKSPACE =
  "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx";

if (!fs.existsSync(WORKSPACE)) {
  throw new Error(
    `Missing forensic workspace: ${WORKSPACE}`,
  );
}

const source =
  fs.readFileSync(
    WORKSPACE,
    "utf8",
  );

function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function hasSceneChoiceField(
  label,
  key,
) {
  const pattern =
    new RegExp(
      [
        "sceneChoiceField",
        "\\s*\\(",
        "\\s*[\"']",
        escapeRegExp(label),
        "[\"']",
        "\\s*,",
        "\\s*[\"']",
        escapeRegExp(key),
        "[\"']",
        "\\s*,",
      ].join(""),
      "m",
    );

  return pattern.test(
    source,
  );
}

function hasChoiceOption(
  key,
  option,
) {
  const blockPattern =
    new RegExp(
      [
        escapeRegExp(key),
        "\\s*:\\s*\\[",
        "([\\s\\S]*?)",
        "\\]",
      ].join(""),
      "m",
    );

  const match =
    source.match(
      blockPattern,
    );

  if (!match) {
    return false;
  }

  return new RegExp(
    `[\"']${escapeRegExp(option)}[\"']`,
  ).test(
    match[1],
  );
}

const checks = [
  [
    "Weather uses sceneChoiceField",
    hasSceneChoiceField(
      "Weather",
      "weather",
    ),
  ],
  [
    "Lighting uses sceneChoiceField",
    hasSceneChoiceField(
      "Lighting",
      "lighting",
    ),
  ],
  [
    "Road condition uses sceneChoiceField",
    hasSceneChoiceField(
      "Road condition",
      "roadCondition",
    ),
  ],
  [
    "Traffic-control state uses sceneChoiceField",
    hasSceneChoiceField(
      "Traffic-control state",
      "trafficControlState",
    ),
  ],
  [
    "Road geometry uses sceneChoiceField",
    hasSceneChoiceField(
      "Road geometry",
      "roadGeometry",
    ),
  ],

  [
    "Weather presets include Clear",
    hasChoiceOption(
      "weather",
      "Clear",
    ),
  ],
  [
    "Weather presets include Heavy rain",
    hasChoiceOption(
      "weather",
      "Heavy rain",
    ),
  ],
  [
    "Lighting presets include Dark - street-lit",
    hasChoiceOption(
      "lighting",
      "Dark - street-lit",
    ),
  ],
  [
    "Road condition presets include Loose gravel / loose surface",
    hasChoiceOption(
      "roadCondition",
      "Loose gravel / loose surface",
    ),
  ],
  [
    "Traffic-control presets include Traffic signals operating",
    hasChoiceOption(
      "trafficControlState",
      "Traffic signals operating",
    ),
  ],
  [
    "Road geometry presets include Roundabout",
    hasChoiceOption(
      "roadGeometry",
      "Roundabout",
    ),
  ],

  [
    "Other/manual option exists",
    source.includes(
      "Other / specify manually",
    ),
  ],
  [
    "Other/manual option has stable sentinel",
    source.includes(
      'const OTHER_CHOICE = "__other__"',
    ),
  ],
  [
    "Manual entry input is conditionally rendered",
    /manual\s*&&\s*\(\s*<input/m.test(
      source,
    ),
  ],
  [
    "Custom scene choice values are written back to scene state",
    /\[key\]\s*:\s*event\.target\.value/m.test(
      source,
    ),
  ],
  [
    "Existing custom values are detected as manual choices",
    source.includes(
      "!findPresetChoice(key, value)",
    ),
  ],

  [
    "Accident location remains direct entry",
    /field\s*\(\s*["']Accident location["']\s*,\s*["']location["']/m.test(
      source,
    ),
  ],
  [
    "Date remains direct date input",
    source.includes(
      'type="date"',
    ),
  ],
  [
    "Time remains direct time input",
    source.includes(
      'type="time"',
    ),
  ],
  [
    "Preservation notes remain direct textarea entry",
    source.includes(
      "Preservation / scene notes",
    ) &&
      source.includes(
        "<textarea",
      ),
  ],
];

let failures = 0;

for (
  const [
    label,
    passed,
  ]
  of checks
) {
  if (!passed) {
    failures += 1;

    console.error(
      `[FAIL] ${label}`,
    );
  } else {
    console.log(
      `[OK] ${label}`,
    );
  }
}

if (failures > 0) {
  throw new Error(
    `Forensic scene-dropdown verification failed: ${failures} check(s) failed.`,
  );
}

console.log("");
console.log(
  `[RoadSafe] Forensic Reconstruction V2 Step 1.1.1 verification passed (${checks.length}/${checks.length} checks).`,
);
