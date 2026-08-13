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
    "roadsafe-speed-authority-v1-payload",
  );

const EDITOR_REL =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";

const SPEED_UTILITY_REL =
  "src/utils/reconstructionSpeedAuthoring.ts";

const EXPECTED_EDITOR_SHA256 =
  "1a6b673bd50dfe4850f0f22577e214147e3853f2827233d7af2c96e7f394a52a";

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

const editorTarget =
  abs(EDITOR_REL);

const utilityTarget =
  abs(SPEED_UTILITY_REL);

const editorPayload =
  path.join(
    PAYLOAD,
    "AccidentReconstructionEditor.tsx",
  );

const utilityPayload =
  path.join(
    PAYLOAD,
    "reconstructionSpeedAuthoring.ts",
  );

if (
  !fs.existsSync(
    editorTarget,
  )
) {
  fail(
    `Could not find ${EDITOR_REL}. Run this installer from the A-R-V1 repository root.`,
  );
}

if (
  !fs.existsSync(
    editorPayload,
  ) ||
  !fs.existsSync(
    utilityPayload,
  )
) {
  fail(
    "Installer payload is incomplete. Extract the whole ZIP before running it.",
  );
}

const currentEditorHash =
  sha256(
    editorTarget,
  );

if (
  currentEditorHash !==
  EXPECTED_EDITOR_SHA256
) {
  fail(
    [
      "AccidentReconstructionEditor.tsx differs from the exact Motion Realism V1 state used for this speed fix.",
      "No files were changed.",
      "",
      `Expected SHA-256: ${EXPECTED_EDITOR_SHA256}`,
      `Current SHA-256:  ${currentEditorHash}`,
      "",
      "Do not force this installer. If you edited the reconstruction editor after Motion Realism V1, send the fresh local file and I will rebase the speed-authority pass.",
    ].join("\n"),
  );
}

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
    `speed-authority-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of [
    EDITOR_REL,
    SPEED_UTILITY_REL,
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
      path.dirname(
        backup,
      ),
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
    of [
      EDITOR_REL,
      SPEED_UTILITY_REL,
    ]
  ) {
    const previous =
      originals.get(
        rel,
      );

    if (
      previous
    ) {
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

fs.mkdirSync(
  path.dirname(
    utilityTarget,
  ),
  {
    recursive: true,
  },
);

fs.copyFileSync(
  editorPayload,
  editorTarget,
);

fs.copyFileSync(
  utilityPayload,
  utilityTarget,
);

console.log("");
console.log(
  "RoadSafe Participant Speed Authority V1 — EXACT LOCAL",
);

console.log(
  "=====================================================",
);

console.log(
  "[OK] Exact Motion Realism V1 reconstruction editor hash matched.",
);

console.log(
  "[OK] Speed edits are now authoritative for participant approach motion.",
);

console.log(
  "[OK] estimatedSpeedKmh and physics.inputSpeedKmh remain synchronized.",
);

console.log(
  "[OK] Authored pre-impact point speeds are scaled with the investigator-entered participant speed.",
);

console.log(
  "[OK] Old physics-generated trajectory points are removed immediately when speed changes.",
);

console.log(
  "[OK] Metric route segment lengths are used when recalculating travel time.",
);

console.log(
  "[OK] Faster participants enter their route later while preserving the shared Point Z collision instant.",
);

console.log(
  "[OK] Slower participants enter earlier while preserving the shared Point Z collision instant.",
);

console.log(
  "[OK] If a new slower speed cannot reach Point Z from t=0, the shared collision instant moves later for all participants instead of silently rescaling the entered speed.",
);

console.log(
  "[OK] Reconstruction duration automatically extends only when required to preserve post-impact playback time.",
);

console.log(
  "[OK] Main participant controls now use the speed-authority pipeline.",
);

console.log(
  "[OK] Physics Context and Node Editor speed changes now use the same speed-authority pipeline through onReconstructionChange.",
);

console.log(
  "[OK] 2D / 3D / AR continue reading the same canonical participant route.",
);

console.log(
  "[OK] Rapier still receives the same authoritative participant speed through physics.inputSpeedKmh.",
);

console.log(
  "[OK] Emergency braking now starts from the newly entered approach speed.",
);

console.log(
  `[OK] Backup: ${backupDir}`,
);

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

  if (
    output
  ) {
    console.error("");
    console.error(
      output,
    );
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Participant Speed Authority V1 back automatically...",
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
  "Participant Speed Authority V1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "Change one participant from e.g. 40 km/h to 80 km/h, commit the field, then replay: its actual approach motion should now be visibly faster while Point Z remains synchronized.",
);
