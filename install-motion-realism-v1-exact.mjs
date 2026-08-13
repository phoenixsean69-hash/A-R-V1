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
    "roadsafe-motion-realism-v1-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "bde2430ad7977b497e810d55e87db5cec032afc9b3df03f78c8d53d772eeff86",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "0ba09806f0f46603c0d9d0f07575b671479b68670117ae1670fc0094c4ad702b",
  "src/services/rapierDynamicsService.ts": "73ebfd4479f89479b43ce691670b85c1b71d97ed74e28b0b26cb04480add4074",
  "src/components/reconstruction/Participant2DModel.tsx": "5b39977595e0e5c86aa775e4e4d74f40d1ee31e19d33906b0cf7d83c1ab7a400",
  "src/components/reconstruction/ForensicScenePreview.tsx": "1e4d48daebbdc4b27b81281a0fa5c89fad79e3ecb37f1af2858909e4db9fdf26",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "bcd8b4ac6c8755016e5c16bfbac115ca6e53bcc95d9d6ba03d48707cbaad6958"
};

const FILES = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "Reconstruction3DViewer.tsx",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts",
  "src/components/reconstruction/Participant2DModel.tsx": "Participant2DModel.tsx",
  "src/components/reconstruction/ForensicScenePreview.tsx": "ForensicScenePreview.tsx",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "ARSceneFactory.ts",
  "src/utils/reconstructionReactionModel.ts": "reconstructionReactionModel.ts",
  "src/engine/assets/participantHumanMotionModel.ts": "participantHumanMotionModel.ts"
};

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

function runBuild() {
  if (
    process.platform ===
    "win32"
  ) {
    return spawnSync(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "npm run build",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        windowsHide: true,
      },
    );
  }

  return spawnSync(
    "npm",
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Exact-current-state preflight                                               */
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
        `${rel} differs from the exact RoadSafe state used for Motion Realism V1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this installer. If you changed that file after the current Rapier/contact/playback work, send the fresh local file and I will rebase this pass.",
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

/* -------------------------------------------------------------------------- */
/* Backup                                                                      */
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
    `motion-realism-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of Object.keys(FILES)
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

function rollback() {
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
}

/* -------------------------------------------------------------------------- */
/* Install                                                                     */
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

console.log("");
console.log(
  "RoadSafe Motion Realism V1 — EXACT LOCAL",
);
console.log(
  "=========================================",
);

console.log(
  "[OK] Exact current RoadSafe source hashes matched.",
);

console.log(
  "[OK] Shared deterministic pre-impact reaction model added.",
);

console.log(
  "[OK] Every participant receives a split-second attention reaction toward its authored Impact point.",
);

console.log(
  "[OK] Human attention is expressed mainly through head/upper-body response; vehicle heading adjustment is deliberately tiny.",
);

console.log(
  "[OK] Cars, buses, trucks, motorcycles and bicycles can enter emergency braking before first contact.",
);

console.log(
  "[OK] An authored Brake point takes priority as the emergency-brake start.",
);

console.log(
  "[OK] If no Brake point is authored, a short deterministic pre-impact emergency-brake window is used.",
);

console.log(
  "[OK] Rapier now removes actual horizontal velocity each fixed step using brakingDecelerationMps2 before first contact.",
);

console.log(
  "[OK] Emergency braking stops affecting motion immediately after a real Rapier contact begins.",
);

console.log(
  "[OK] Rapier records a warning when emergency braking was applied.",
);

console.log(
  "[OK] 3D vehicles show brake lights and a restrained nose-dive during emergency braking.",
);

console.log(
  "[OK] 2D vehicles show the emergency-braking cue and adjusted approach speed.",
);

console.log(
  "[OK] New articulated procedural human model added for pre-impact walking.",
);

console.log(
  "[OK] Human legs and arms now swing with speed-based cadence instead of the whole person sliding rigidly.",
);

console.log(
  "[OK] Human gait is time-driven, so Pause/Scrub freezes at the correct pose instead of running independently.",
);

console.log(
  "[OK] Human gait is active in Main 2D, Main 3D, forensic 2D previews and AR.",
);

console.log(
  "[OK] Human walk animation stops at impact so Rapier/impact response owns post-impact motion.",
);

console.log(
  "[OK] Premium/realistic human replacement is skipped for now so the articulated walking rig remains functional.",
);

console.log(
  "[OK] Non-human premium vehicle models remain unchanged.",
);

console.log(
  "[OK] Existing Rapier body collision, contact stability, damage, Dope Sheet, Nodes and Photo Assist remain intact.",
);

console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Production build + rollback                                                 */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "Verifying production build...",
);

const build =
  runBuild();

const output =
  [
    build.stdout ?? "",
    build.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  build.error ||
  build.status !== 0
) {
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
    "[RoadSafe] Rolling Motion Realism V1 back automatically...",
  );

  rollback();

  console.error(
    "[RoadSafe] Rollback complete.",
  );

  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);

console.log("");
console.log(
  "Motion Realism V1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "Test one pedestrian approach and one vehicle collision in 2D, 3D and AR before adding further behavior.",
);
