import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT =
  process.cwd();

const INSTALLER_DIR =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const PAYLOAD =
  path.join(
    INSTALLER_DIR,
    "roadsafe-road-hazard-interaction-physics-v1.0.2-payload",
  );

const SERVICE_REL =
  "src/services/rapierDynamicsService.ts";

const EXPECTED_SERVICE_SHA256 =
  "2aece5d4e13e5bacafae63fa64f13395d8669cbe45a04236f5affd973b1aa93a";

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

function fail(
  message,
  code = 1,
) {
  console.error("");
  console.error(
    `[RoadSafe] ${message}`,
  );
  process.exit(code);
}

function run(command, args) {
  return spawnSync(
    command,
    args,
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
    },
  );
}

function runBuild() {
  if (
    process.platform ===
    "win32"
  ) {
    return run(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "npm run build",
      ],
    );
  }

  return run(
    "npm",
    [
      "run",
      "build",
    ],
  );
}

const target =
  abs(
    SERVICE_REL,
  );

const payloadService =
  path.join(
    PAYLOAD,
    "rapierDynamicsService.ts",
  );

const preRollVerifier =
  path.join(
    PAYLOAD,
    "verify-road-hazard-preroll-window.mjs",
  );

if (
  !fs.existsSync(
    target,
  )
) {
  fail(
    `Could not find ${SERVICE_REL}. Run this installer from the A-R-V1 repository root.`,
  );
}

const currentHash =
  sha256(
    target,
  );

if (
  currentHash !==
  EXPECTED_SERVICE_SHA256
) {
  fail(
    [
      "rapierDynamicsService.ts differs from the exact installed Road Hazard Interaction Physics V1.0.1 state.",
      "No files were changed.",
      "",
      `Expected SHA-256: ${EXPECTED_SERVICE_SHA256}`,
      `Current SHA-256:  ${currentHash}`,
      "",
      "Do not force this installer. Send the fresh local rapierDynamicsService.ts if you edited physics after V1.0.1.",
    ].join("\n"),
  );
}

for (
  const file
  of [
    payloadService,
    preRollVerifier,
  ]
) {
  if (
    !fs.existsSync(file)
  ) {
    fail(
      `Installer payload is incomplete: ${path.basename(file)} is missing.`,
    );
  }
}

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backup =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `road-hazard-interaction-physics-v1.0.2-${stamp}`,
    ...SERVICE_REL.split("/"),
  );

fs.mkdirSync(
  path.dirname(
    backup,
  ),
  {
    recursive: true,
  },
);

const original =
  fs.readFileSync(
    target,
  );

fs.writeFileSync(
  backup,
  original,
);

fs.copyFileSync(
  payloadService,
  target,
);

console.log("");
console.log(
  "RoadSafe Road Hazard Interaction Physics V1.0.2 — HAZARD WINDOW",
);
console.log(
  "===============================================================",
);
console.log(
  "[OK] Exact installed V1.0.1 Rapier service hash matched.",
);
console.log(
  "[FIX] Rapier no longer waits until primaryImpactTime - 0.4 s when a Road Hazard exists earlier on the approach.",
);
console.log(
  "[OK] RoadSafe now scans the authored participant route for the earliest likely Pothole/Road Crack/Puddle/Oil Spill/Loose Gravel/Debris/Fallen Branch interaction.",
);
console.log(
  "[OK] Rapier begins 0.55 s before that predicted hazard interaction, or keeps the original 0.4 s crash pre-roll when no earlier hazard exists.",
);
console.log(
  "[OK] Surface probes use the participant's physical footprint, not visualScale.",
);
console.log(
  "[OK] Dynamic Debris/Fallen Branch prediction uses both participant and object physical envelopes.",
);
console.log(
  "[OK] Runtime overlap/collision remains authoritative; the pre-scan only decides when Rapier must start.",
);
console.log(
  "[OK] Existing surface physics, dynamic object physics, damage filtering, object trajectories and scene effects remain unchanged.",
);
console.log(
  `[OK] Backup: ${path.dirname(path.dirname(path.dirname(backup)))}`,
);

console.log("");
console.log(
  "Verifying Road Hazard pre-roll policy...",
);

const verify =
  run(
    process.execPath,
    [
      preRollVerifier,
    ],
  );

const verifyOutput =
  [
    verify.stdout ??
      "",
    verify.stderr ??
      "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  verify.error ||
  verify.status !==
    0
) {
  console.error(
    verifyOutput,
  );

  fs.writeFileSync(
    target,
    original,
  );

  fail(
    "Road Hazard pre-roll verification failed. V1.0.2 was rolled back automatically.",
    2,
  );
}

console.log(
  verifyOutput,
);
console.log(
  "[OK] Road Hazard pre-roll verification passed.",
);

console.log("");
console.log(
  "Verifying production build...",
);

const build =
  runBuild();

const buildOutput =
  [
    build.stdout ??
      "",
    build.stderr ??
      "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  build.error ||
  build.status !==
    0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed.",
  );

  if (
    buildOutput
  ) {
    console.error("");
    console.error(
      buildOutput,
    );
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling V1.0.2 back automatically...",
  );

  fs.writeFileSync(
    target,
    original,
  );

  console.error(
    "[RoadSafe] Rollback complete.",
  );

  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);

console.log("");
console.log(
  "Road Hazard Interaction Physics V1.0.2 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log("");
console.log(
  "IMPORTANT: rerun/bake physics after installation. Existing baked trajectories were created with the old crash-only 0.4 s Rapier window.",
);
