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
    "roadsafe-blender-dopesheet-v1-payload",
  );

const TARGETS = {
  "src/components/reconstruction/AccidentTimeline.tsx": {
    payload: "AccidentTimeline.tsx",
    sha256:
      "31c9ec85f0ad65feb88673aac7c54c9d8b4ac547e284015a7fd1d9ed8515a610",
  },

  "src/components/reconstruction/ReconstructionBottomDock.tsx": {
    payload: "ReconstructionBottomDock.tsx",
    sha256:
      "1f176e7e15a75356ea853759572d830400fabd9036173b78e14a416e57d93ffd",
  },

  "src/components/reconstruction/reconstructionBottomDock.css": {
    payload: "reconstructionBottomDock.css",
    sha256:
      "9c202599d4344ff7988f42d870e0d7e87a0bb57e018046e2f8bfdb4694c02e82",
  },
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

/* -------------------------------------------------------------------------- */
/* Exact-local preflight                                                      */
/* -------------------------------------------------------------------------- */

for (
  const [
    rel,
    config,
  ]
  of Object.entries(TARGETS)
) {
  const target =
    abs(rel);

  if (!fs.existsSync(target)) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }

  const payloadFile =
    path.join(
      PAYLOAD,
      config.payload,
    );

  if (
    !fs.existsSync(
      payloadFile,
    )
  ) {
    fail(
      `Installer payload is missing ${config.payload}. Extract the entire ZIP first.`,
    );
  }

  const actual =
    sha256(target);

  if (
    actual !==
    config.sha256
  ) {
    fail(
      [
        `${rel} differs from the exact local snapshot used for this timeline redesign.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${config.sha256}`,
        `Current SHA-256:  ${actual}`,
        "",
        "If you edited reconstruction/timeline files after zip1.zip was created, send a fresh local snapshot instead of forcing this installer.",
      ].join("\n"),
    );
  }
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
    `blender-dopesheet-timeline-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of Object.keys(TARGETS)
) {
  const target =
    abs(rel);

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

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

for (
  const [
    rel,
    config,
  ]
  of Object.entries(TARGETS)
) {
  fs.copyFileSync(
    path.join(
      PAYLOAD,
      config.payload,
    ),
    abs(rel),
  );
}

console.log("");
console.log(
  "RoadSafe Blender-Style Dope Sheet Timeline V1",
);
console.log(
  "==============================================",
);
console.log(
  "[OK] Exact local timeline file hashes matched.",
);
console.log(
  "[OK] Timeline changed from card tracks to a Blender-style Dope Sheet.",
);
console.log(
  "[OK] Fixed collapsible channel tree added on the left.",
);
console.log(
  "[OK] Participant rows expand into Object Transforms.",
);
console.log(
  "[OK] X Location, Y Location, Rotation, Speed and Action/Event channels added.",
);
console.log(
  "[OK] Scene Objects, Impacts, Evidence and Scene Notes remain visible as timeline channels.",
);
console.log(
  "[OK] Existing movement/path points remain the authoritative keyframe source.",
);
console.log(
  "[OK] Keyframes are selectable Blender-style diamonds.",
);
console.log(
  "[OK] Selected keyframes use the existing RoadSafe orange accent.",
);
console.log(
  "[OK] Current playback time is shown as a green vertical playhead.",
);
console.log(
  "[OK] Click/drag on the timeline still seeks shared 2D/3D playback.",
);
console.log(
  "[OK] Generated and manual events can still be toggled.",
);
console.log(
  "[OK] Manual investigator markers can still be added/edited/deleted.",
);
console.log(
  "[OK] Existing playback, event callbacks and forensic data model were preserved.",
);
console.log(
  "[OK] Timeline default dock height increased to 248px for the channel tree.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Build verification + rollback                                              */
/* -------------------------------------------------------------------------- */

console.log("");
console.log(
  "Verifying production build...",
);

const build =
  process.platform === "win32"
    ? spawnSync(
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
      )
    : spawnSync(
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
    "[RoadSafe] Rolling Dope Sheet redesign back automatically...",
  );

  for (
    const [
      rel,
      content,
    ]
    of originals.entries()
  ) {
    fs.writeFileSync(
      abs(rel),
      content,
    );
  }

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
  "Now run:",
);

console.log(
  "  npm run dev",
);

console.log("");
console.log(
  "Open Reconstruction -> Timeline and visually verify the new Dope Sheet.",
);
