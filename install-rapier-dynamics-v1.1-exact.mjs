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
    "roadsafe-rapier-dynamics-v1.1-payload",
  );

const DEPENDENCY =
  "@dimforge/rapier3d-deterministic-compat@0.19.3";

const EXPECTED = {
  "src/types/reconstruction.ts": "5314e6e6b6cb724cfb555e6debd7b07d7468ce6b7e6f1c89cb11e4f4334f76d9",
  "src/services/reconstructionPhysicsService.ts": "381ad42b732429aed78e27553d44092f8a600ac8df660641996adda1b5629fdf",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "c73d225499872408b186bd5ec941ba66a3c99ae6cf3de1cf38633b910d96dde6",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "c70e9e82691a9146c304c0f84c331ae7c3a4015a324c8a70fce28c500fbc346b"
};

const FILES = {
  "src/types/reconstruction.ts": "reconstruction.ts",
  "src/services/reconstructionPhysicsService.ts": "reconstructionPhysicsService.ts",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "Reconstruction3DViewer.tsx",
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

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function runCommand(command, args) {
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
  if (process.platform === "win32") {
    return runCommand(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        ["npm", ...args].join(" "),
      ],
    );
  }

  return runCommand("npm", args);
}

function commandOutput(result) {
  return [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

/* Exact rolled-back source preflight. */
for (
  const [rel, expectedHash]
  of Object.entries(EXPECTED)
) {
  const target = abs(rel);

  if (!fs.existsSync(target)) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }

  const actual = sha256(target);

  if (actual !== expectedHash) {
    fail(
      [
        `${rel} differs from the exact rolled-back RoadSafe state used for Rapier V1.1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "The previous V1 installer rolled back successfully. If you edited files since then, send the fresh local file instead of forcing this installer.",
      ].join("\n"),
    );
  }
}

for (
  const payloadName
  of Object.values(FILES)
) {
  if (
    !fs.existsSync(
      path.join(PAYLOAD, payloadName),
    )
  ) {
    fail(
      `Installer payload is missing ${payloadName}. Extract the entire ZIP before running it.`,
    );
  }
}

if (!fs.existsSync(abs("package.json"))) {
  fail(
    "Could not find package.json. Run this installer from the A-R-V1 repository root.",
  );
}

/* Backup. */
const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `rapier-dynamics-v1.1-${stamp}`,
  );

const originals = new Map();

for (
  const rel
  of [
    ...Object.keys(FILES),
    ...PACKAGE_FILES,
  ]
) {
  const target = abs(rel);

  if (fs.existsSync(target)) {
    const content =
      fs.readFileSync(target);

    originals.set(rel, content);

    const backup =
      path.join(
        backupDir,
        ...rel.split("/"),
      );

    fs.mkdirSync(
      path.dirname(backup),
      { recursive: true },
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
        path.dirname(abs(rel)),
        { recursive: true },
      );
      fs.writeFileSync(
        abs(rel),
        previous,
      );
    } else if (fs.existsSync(abs(rel))) {
      fs.unlinkSync(abs(rel));
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
    } else if (fs.existsSync(abs(rel))) {
      fs.unlinkSync(abs(rel));
    }
  }
}

console.log("");
console.log(
  "RoadSafe Rapier Dynamics V1.1 — EXACT LOCAL",
);
console.log(
  "============================================",
);
console.log(
  "[OK] Exact rolled-back RoadSafe source hashes matched.",
);
console.log(
  "[FIX] Reconstruction3DViewer no longer requires the physics callback to synchronously return an AccidentReconstruction.",
);
console.log(
  "[FIX] Async Rapier physics callback is now accepted by the 3D viewer.",
);
console.log(
  "[FIX] Unused lastSample variable removed from the Rapier service.",
);
console.log(
  `[INFO] Installing/verifying ${DEPENDENCY}...`,
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
    commandOutput(install);

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
    "[RoadSafe] Rollback complete.",
  );
  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(2);
}

console.log(
  "[OK] Rapier deterministic 3D dependency is installed.",
);

/* Install integration. */
for (
  const [rel, payloadName]
  of Object.entries(FILES)
) {
  const target = abs(rel);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.copyFileSync(
    path.join(PAYLOAD, payloadName),
    target,
  );
}

console.log(
  "[OK] Rapier V1.1 integration files installed.",
);
console.log(
  "[OK] RoadSafe forensic solver remains intact.",
);
console.log(
  "[OK] Rapier remains the rigid-body post-impact dynamics layer.",
);
console.log(
  "[OK] Existing Photo Assist, Nodes, Dope Sheet, 2D/3D and canonical state remain shared.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* Runtime verification. */
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
    commandOutput(verify);

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
    "[RoadSafe] Rolling V1.1 back automatically...",
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
  commandOutput(verify);

if (verifyOutput) {
  console.log(verifyOutput);
}

console.log(
  "[OK] Rapier runtime verification passed.",
);

/* Production build. */
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
    commandOutput(build);

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
    "[RoadSafe] Rolling V1.1 back automatically...",
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
  "Rapier Dynamics V1.1 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log("");
console.log(
  "Then open Reconstruction -> Physics and click 'Run Rapier + Forensic Simulation'.",
);
