import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const INSTALLER_DIR =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const PAYLOAD =
  path.join(
    INSTALLER_DIR,
    "roadsafe-rapier-dynamics-v1-payload",
  );

const DEPENDENCY =
  "@dimforge/rapier3d-deterministic-compat@0.19.3";

const EXPECTED = {
  "src/types/reconstruction.ts": "5314e6e6b6cb724cfb555e6debd7b07d7468ce6b7e6f1c89cb11e4f4334f76d9",
  "src/services/reconstructionPhysicsService.ts": "381ad42b732429aed78e27553d44092f8a600ac8df660641996adda1b5629fdf",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "c73d225499872408b186bd5ec941ba66a3c99ae6cf3de1cf38633b910d96dde6"
};

const FILES = {
  "src/types/reconstruction.ts": "reconstruction.ts",
  "src/services/reconstructionPhysicsService.ts": "reconstructionPhysicsService.ts",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "AccidentReconstructionEditor.tsx",
  "scripts/verify-rapier-foundation.mjs": "verify-rapier-foundation.mjs"
};

const PACKAGE_FILES = [
  "package.json",
  "package-lock.json",
];

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
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

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

function runCommand(
  command,
  args,
) {
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

function runNpm(args) {
  if (
    process.platform ===
    "win32"
  ) {
    return runCommand(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        [
          "npm",
          ...args,
        ].join(" "),
      ],
    );
  }

  return runCommand(
    "npm",
    args,
  );
}

function commandOutput(
  result,
) {
  return [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Exact-local preflight                                                      */
/* -------------------------------------------------------------------------- */

for (
  const [
    rel,
    expectedHash,
  ]
  of Object.entries(EXPECTED)
) {
  const target =
    abs(rel);

  if (!fs.existsSync(target)) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }

  const actual =
    sha256(target);

  if (
    actual !==
    expectedHash
  ) {
    fail(
      [
        `${rel} differs from the exact local RoadSafe state used for Rapier Dynamics V1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this install. If you edited the file after the current Photo-Assisted/Main-Reconstruction work, send the fresh local file.",
      ].join("\n"),
    );
  }
}

for (
  const payloadName
  of Object.values(FILES)
) {
  const source =
    path.join(
      PAYLOAD,
      payloadName,
    );

  if (!fs.existsSync(source)) {
    fail(
      `Installer payload is missing ${payloadName}. Extract the entire ZIP before running it.`,
    );
  }
}

if (
  !fs.existsSync(
    abs("package.json"),
  )
) {
  fail(
    "Could not find package.json. Run this installer from the A-R-V1 repository root.",
  );
}

/* -------------------------------------------------------------------------- */
/* Backup                                                                     */
/* -------------------------------------------------------------------------- */

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `rapier-dynamics-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of [
    ...Object.keys(FILES),
    ...PACKAGE_FILES,
  ]
) {
  const target =
    abs(rel);

  if (
    fs.existsSync(target)
  ) {
    const content =
      fs.readFileSync(
        target,
      );

    originals.set(
      rel,
      content,
    );

    const backup =
      path.join(
        backupDir,
        ...rel.split("/"),
      );

    fs.mkdirSync(
      path.dirname(backup),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      backup,
      content,
    );
  }
}

function restoreEverything() {
  for (
    const rel
    of Object.keys(FILES)
  ) {
    const previous =
      originals.get(rel);

    if (previous) {
      fs.mkdirSync(
        path.dirname(
          abs(rel),
        ),
        {
          recursive: true,
        },
      );

      fs.writeFileSync(
        abs(rel),
        previous,
      );
    } else if (
      fs.existsSync(
        abs(rel),
      )
    ) {
      fs.unlinkSync(
        abs(rel),
      );
    }
  }

  for (
    const rel
    of PACKAGE_FILES
  ) {
    const previous =
      originals.get(rel);

    if (previous) {
      fs.writeFileSync(
        abs(rel),
        previous,
      );
    } else if (
      fs.existsSync(
        abs(rel),
      )
    ) {
      fs.unlinkSync(
        abs(rel),
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Install exact Rapier dependency                                            */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "RoadSafe Rapier Dynamics V1 — EXACT LOCAL",
);
console.log(
  "==========================================",
);
console.log(
  "[OK] Exact local RoadSafe source hashes matched.",
);
console.log(
  `[INFO] Installing ${DEPENDENCY}...`,
);

const install =
  runNpm([
    "install",
    "--save-exact",
    DEPENDENCY,
  ]);

if (
  install.error ||
  install.status !== 0
) {
  const output =
    commandOutput(
      install,
    );

  console.error("");
  console.error(
    "[RoadSafe] Rapier dependency installation failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  restoreEverything();

  console.error("");
  console.error(
    "[RoadSafe] package.json/package-lock.json were restored.",
  );

  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(2);
}

console.log(
  "[OK] Rapier deterministic 3D WASM dependency installed.",
);

/* -------------------------------------------------------------------------- */
/* Install RoadSafe integration                                               */
/* -------------------------------------------------------------------------- */

for (
  const [
    rel,
    payloadName,
  ]
  of Object.entries(FILES)
) {
  const target =
    abs(rel);

  fs.mkdirSync(
    path.dirname(target),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    path.join(
      PAYLOAD,
      payloadName,
    ),
    target,
  );
}

console.log(
  "[OK] Rapier rigid-body dynamics service installed.",
);
console.log(
  "[OK] RoadSafe Physics V2 forensic calculation layer preserved.",
);
console.log(
  "[OK] Rapier is now the post-impact trajectory dynamics layer.",
);
console.log(
  "[OK] Rapier world uses real metres, 3D gravity, a physical ground plane and contact friction.",
);
console.log(
  "[OK] Participant mass, collider dimensions, restitution and collision friction feed Rapier.",
);
console.log(
  "[OK] Continuous Collision Detection enabled for every physics participant.",
);
console.log(
  "[OK] Maximum CCD substeps set to 4.",
);
console.log(
  "[OK] Participant rigid bodies remain upright in V1 but can yaw/spin after impact.",
);
console.log(
  "[OK] Solid visible scene objects become fixed Rapier collision geometry.",
);
console.log(
  "[OK] Participant-participant and participant-object contact pairs are captured.",
);
console.log(
  "[OK] Rapier contact-force events are sampled for diagnostics.",
);
console.log(
  "[OK] Rapier hidden post-impact samples drive both 2D and 3D playback after a real rigid-body contact.",
);
console.log(
  "[OK] If Rapier finds no contact, RoadSafe retains the legacy path and emits an explicit warning.",
);
console.log(
  "[OK] Live physics and Auto Run on Play now use Rapier asynchronously.",
);
console.log(
  "[OK] Physics-affecting edits still invalidate the old bake.",
);
console.log(
  "[OK] Existing Node Editor, Photo Assist, Dope Sheet, evidence and canonical state remain shared.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Runtime verification                                                       */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "Verifying Rapier WASM initialization + CCD collision...",
);

const verify =
  runCommand(
    process.execPath,
    [
      abs(
        "scripts/verify-rapier-foundation.mjs",
      ),
    ],
  );

if (
  verify.error ||
  verify.status !== 0
) {
  const output =
    commandOutput(
      verify,
    );

  console.error("");
  console.error(
    "[RoadSafe] Rapier runtime verification failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Rapier Dynamics V1 back automatically...",
  );

  restoreEverything();

  console.error(
    "[RoadSafe] Rollback complete.",
  );

  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(3);
}

const verifyOutput =
  commandOutput(
    verify,
  );

if (verifyOutput) {
  console.log(verifyOutput);
}

console.log(
  "[OK] Rapier runtime verification passed.",
);

/* -------------------------------------------------------------------------- */
/* Production build                                                           */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "Verifying production build...",
);

const build =
  runNpm([
    "run",
    "build",
  ]);

if (
  build.error ||
  build.status !== 0
) {
  const output =
    commandOutput(
      build,
    );

  console.error("");
  console.error(
    "[RoadSafe] Production build failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Rapier Dynamics V1 back automatically...",
  );

  restoreEverything();

  console.error(
    "[RoadSafe] Rollback complete.",
  );

  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(4);
}

console.log(
  "[OK] Production build passed.",
);

console.log("");
console.log(
  "Rapier Dynamics V1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "Then open Reconstruction -> Physics and click 'Run Rapier + Forensic Simulation'.",
);
