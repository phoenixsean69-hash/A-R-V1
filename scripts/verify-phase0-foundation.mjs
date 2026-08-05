import fs from "node:fs";

const checks = [
  {
    file:
      "src/utils/reconstructionPhysicsFoundation.ts",
    marker:
      "[RoadSafe:PhysicsFoundationV1]",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "[RoadSafe:CleanPhysicsInputV1]",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "normaliseParticipantPhysicsProfile",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "ceilSimulationTime(",
  },
  {
    file:
      "src/services/reconstructionPhysicsService.ts",
    marker:
      "quantiseSimulationTime(timeSeconds)",
  },
  {
    file:
      "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    marker:
      "reconstruction.durationSeconds +",
  },
];

let failed = false;

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(
      "MISSING FILE:",
      check.file,
    );

    failed = true;
    continue;
  }

  const content =
    fs.readFileSync(
      check.file,
      "utf8",
    );

  if (!content.includes(check.marker)) {
    console.error(
      "MISSING MARKER:",
      check.file,
      check.marker,
    );

    failed = true;
  }
  else {
    console.log(
      "OK:",
      check.file,
      "→",
      check.marker,
    );
  }
}

const editor =
  fs.readFileSync(
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    "utf8",
  );

if (
  /point\.timeSeconds\s*>\s*reconstruction\.durationSeconds(?!\s*\+)/.test(
    editor,
  )
) {
  console.error(
    "STRICT DURATION CHECK STILL EXISTS.",
  );

  failed = true;
}

const physics =
  fs.readFileSync(
    "src/services/reconstructionPhysicsService.ts",
    "utf8",
  );

if (
  /Math\.max\(source\.durationSeconds,\s*simulatedDurationSeconds\)\.toFixed\(2\)/.test(
    physics,
  )
) {
  console.error(
    "OLD DOWNWARD DURATION ROUNDING STILL EXISTS.",
  );

  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  "\nPhase 0 foundation verification passed.",
);
