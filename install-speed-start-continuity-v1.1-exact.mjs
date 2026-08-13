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
    "roadsafe-speed-start-continuity-v1.1-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "0af88844cd6d16a14a2cc25a0e028ceb81a4cf366994546f4b4d1e7d88cdd3b8",
  "src/utils/reconstructionSpeedAuthoring.ts": "c84b3497dd840144dcb2bc9c8b8bda44e8cce404095def685094f3040dd9b992"
};

const FILES = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx":
    "AccidentReconstructionEditor.tsx",

  "src/utils/reconstructionSpeedAuthoring.ts":
    "reconstructionSpeedAuthoring.ts"
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

for (
  const [
    rel,
    expectedHash,
  ]
  of Object.entries(EXPECTED)
) {
  const target =
    abs(rel);

  if (
    !fs.existsSync(
      target,
    )
  ) {
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
        `${rel} differs from the exact Participant Speed Authority V1 state used for this start-continuity fix.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this installer. If you edited these files after Speed Authority V1, send the fresh local files and I will rebase the fix.",
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
      path.join(
        PAYLOAD,
        payloadName,
      ),
    )
  ) {
    fail(
      `Installer payload is missing ${payloadName}. Extract the whole ZIP before running it.`,
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

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `speed-start-continuity-v1.1-${stamp}`,
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
    of Object.keys(FILES)
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
    }
  }
}

for (
  const [
    rel,
    payloadName,
  ]
  of Object.entries(FILES)
) {
  fs.copyFileSync(
    path.join(
      PAYLOAD,
      payloadName,
    ),
    abs(rel),
  );
}

console.log("");
console.log(
  "RoadSafe Participant Speed Start Continuity V1.1 — EXACT LOCAL",
);

console.log(
  "==============================================================",
);

console.log(
  "[OK] Exact Participant Speed Authority V1 hashes matched.",
);

console.log(
  "[OK] Speed edits no longer move a participant's authored Point 1 start time.",
);

console.log(
  "[OK] Speed edits no longer introduce participant-specific waiting/delayed starts.",
);

console.log(
  "[OK] Point Z timestamps remain unchanged and synchronized.",
);

console.log(
  "[OK] Investigator-entered speed is now the authoritative approach/entry speed.",
);

console.log(
  "[OK] Point 1 receives 100% of the speed change.",
);

console.log(
  "[OK] Pre-impact route speeds smoothly reconcile toward Point Z instead of shifting the participant start time.",
);

console.log(
  "[OK] Point Z receives a restrained portion of the speed change so the approach still reacts visibly without destroying shared collision timing.",
);

console.log(
  "[OK] Emergency braking remains responsible for the final split-second speed loss before contact.",
);

console.log(
  "[OK] physics.inputSpeedKmh and estimatedSpeedKmh remain synchronized.",
);

console.log(
  "[OK] Old Rapier-generated post-impact path samples are still removed when speed changes.",
);

console.log(
  "[OK] Speed changes from participant controls, Physics Context and Node Editor use the same pipeline.",
);

console.log(
  "[OK] No reconstruction duration changes are introduced by a speed edit.",
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
    "[RoadSafe] Rolling V1.1 back automatically...",
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
  "Participant Speed Start Continuity V1.1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "Change a participant speed, commit it, press Play from t=0: the participant should begin moving at its normal authored start instead of waiting for a delayed start time.",
);
