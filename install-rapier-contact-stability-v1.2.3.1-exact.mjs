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
    "roadsafe-rapier-contact-stability-v1.2.3.1-payload",
  );

const DEPENDENCY =
  "@dimforge/rapier3d-deterministic-compat@0.19.3";

const EXPECTED = {
  "src/types/reconstruction.ts": "809727df08cfb6fe416576d1872fb901222006189344bc164590367e8655028a",
  "src/services/rapierDynamicsService.ts": "2bdb4ad9b3ab2cff40371618d08c3ddcb1a2d00dd01b52df261f0d6387d52dd4",
  "src/utils/reconstructionDamageModel.ts": "58d49cd0da336a025cbbda402d3e1a5baad7d31fe0645b3d093fc7558bcf75fb",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "48daa6c9274a62d0c86a556f20d07fe0a718c355ee44eee79b2e670c94ce312a",
  "scripts/verify-rapier-foundation.mjs": "26f64ef20461946fc536c163bef3e9c71b55a7e2716fb083f07dc6ea09e269d1"
};

const FILES = {
  "src/types/reconstruction.ts": "reconstruction.ts",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts",
  "src/utils/reconstructionDamageModel.ts": "reconstructionDamageModel.ts",
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
/* Exact V1.1 preflight                                                       */
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
        `${rel} differs from the exact successfully-installed Rapier V1.2.2 state used for this contact-stability pass.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this installer. If you changed the file after Rapier V1.2.2, send the fresh local file.",
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
      `Installer payload is missing ${payloadName}. Extract the whole ZIP before running it.`,
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
    `rapier-contact-stability-v1.2.3.1-${stamp}`,
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
    fs.existsSync(
      target,
    )
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
/* Verify exact Rapier dependency                                             */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "RoadSafe Rapier Contact Stability + Attached Damage V1.2.3.1 — EXACT LOCAL",
);
console.log(
  "==========================================================",
);
console.log(
  "[OK] Exact successfully-installed Rapier V1.2.2 source hashes matched.",
);
console.log(
  "[FIX] Unified DamageDerivationOptions and Rapier service on participantIdsWithRigidBodyContact.",
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
    commandOutput(
      install,
    );

  console.error("");
  console.error(
    "[RoadSafe] Rapier dependency verification failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  restoreEverything();

  console.error(
    "[RoadSafe] Rollback complete.",
  );
  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(2);
}

/* -------------------------------------------------------------------------- */
/* Install V1.2                                                               */
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
  "[OK] Vehicle collision-radius envelope removed from Rapier body contact.",
);
console.log(
  "[OK] Collision stepping tightened to 120 Hz or faster.",
);
console.log(
  "[OK] Participant bodies receive 4 additional local solver iterations.",
);
console.log(
  "[OK] CCD substeps increased from 4 to 8.",
);
console.log(
  "[OK] 15 mm participant contact skin added inside the visual body shell for stable separation.",
);
console.log(
  "[OK] Exact first-contact frame is now forced into the canonical Rapier trajectory.",
);
console.log(
  "[OK] Impact neighbourhood is sampled at approximately 60 fps for 0.75 s after first contact.",
);
console.log(
  "[OK] Detached visual damage shards removed.",
);
console.log(
  "[OK] Damage no longer scales/translates the whole vehicle model.",
);
console.log(
  "[OK] Damage remains localized and attached to the impacted body surface.",
);
console.log(
  "[OK] Cars, buses, trucks, motorcycles and bicycles now use asset-matched rounded-body Rapier colliders.",
);
console.log(
  "[OK] Default type dimensions no longer make a compact hatchback collide like a generic 4.5 m sedan when its asset is smaller.",
);
console.log(
  "[OK] Explicit investigator-entered length/width overrides still take precedence.",
);
console.log(
  "[OK] Collision-radius remains available to the legacy forensic/fallback layer but no longer acts as a Rapier vehicle force-field.",
);
console.log(
  "[OK] Vehicle crash restitution is capped to a low inelastic value to reduce unrealistic bounce while preserving lower investigator-entered values.",
);
console.log(
  "[OK] Point-Z red torus reduced to a small marker so it cannot be mistaken for the physical collider.",
);
console.log(
  "[OK] Visual participant damage is generated only after a real Rapier participant/solid-object contact.",
);
console.log(
  "[OK] Damage uses the existing RoadSafe contact zone + impulse + delta-V + energy response.",
);
console.log(
  "[OK] Front / rear / left-side / right-side damage is rendered on the corresponding participant body region.",
);
console.log(
  "[OK] Participant model receives a restrained persistent crush cue after impact.",
);
console.log(
  "[OK] Damage is explicitly stored as visualOnly and is NOT treated as validated structural crashworthiness analysis.",
);
console.log(
  "[OK] 2D/3D/Timeline/Nodes/Photo Assist continue sharing the same canonical reconstruction.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Runtime verification: rounded body collider                                */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "Verifying Rapier stabilized rounded-body contact + CCD collision...",
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
    "[RoadSafe] Rounded-body Rapier runtime verification failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling V1.2.3.1 back automatically...",
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
  console.log(
    verifyOutput,
  );
}

console.log(
  "[OK] Stabilized rounded-body Rapier runtime verification passed.",
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
    "[RoadSafe] Rolling V1.2.3.1 back automatically...",
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
  "Rapier Contact Stability + Attached Damage V1.2.3.1 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log("");
console.log(
  "Re-run the same vehicle collision and watch the actual vehicle bodies meet before the post-impact response begins.",
);
