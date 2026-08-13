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
    "roadsafe-photo-assisted-integrated-v1.2-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "6c7295feae89134f58d7b66bc5b01ba9568dd9fd09f7f3f48918017818cac9d0",
  "src/components/reconstruction/EvidenceWorkspace.tsx": "ddedd93668e7bc376239264d1ada3c423cc695cd074a349d9ee2471cb5205ba4",
  "src/components/reconstruction/PhotoConstraintWorkspace.tsx": "3cd42bac2a20997d1a9d018968b5b1f02a27a04ff0b1a89a5a80b795c6fd725e"
};

const FILES = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "src__components__reconstruction__AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/EvidenceWorkspace.tsx": "src__components__reconstruction__EvidenceWorkspace.tsx",
  "src/components/reconstruction/PhotoConstraintWorkspace.tsx": "src__components__reconstruction__PhotoConstraintWorkspace.tsx",
  "src/components/reconstruction/photoAssistedIntegrated.css": "src__components__reconstruction__photoAssistedIntegrated.css"
};

const INTEGRATION_MARKER =
  "[RoadSafe:PhotoAssistedIntegratedV1]";

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
  const [rel, expectedHash]
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

  if (actual !== expectedHash) {
    fail(
      [
        `${rel} differs from the exact local Photo-Assisted/Photo-tab state used for this integration.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "If you edited these reconstruction files after the Photo Assist top-tab install, send the fresh local files instead of forcing this installer.",
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
    `photo-assisted-main-reconstruction-v1.2-${stamp}`,
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

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

for (
  const [rel, payloadName]
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
  "RoadSafe Photo-Assisted Reconstruction -> Main Reconstruction V1.2",
);
console.log(
  "=================================================================",
);
console.log(
  "[OK] Exact local Photo Assist files matched.",
);
console.log(
  "[OK] Photo-Assisted Reconstruction is no longer a replacement workspace.",
);
console.log(
  "[OK] Main 2D/3D Reconstruction remains visible while Photo Assist is open.",
);
console.log(
  "[OK] Photo Assist is now a docked panel aligned beside the Main Reconstruction.",
);
console.log(
  "[OK] Dope Sheet / Timeline remains visible while Photo Assist is open.",
);
console.log(
  "[OK] Nodes remain usable without automatically closing Photo Assist.",
);
console.log(
  "[OK] Switching 2D/3D from the bottom dock keeps Photo Assist open.",
);
console.log(
  "[OK] Participant/path-point target choices in Photo Assist select the same Main Reconstruction participant/path point.",
);
console.log(
  "[OK] Scene-object target choices in Photo Assist select the same Main Reconstruction object.",
);
console.log(
  "[OK] Applying a photo constraint focuses the affected canonical target in Main Reconstruction.",
);
console.log(
  "[OK] Photo panel shows the active Main Reconstruction view and BAKED/DIRTY physics state.",
);
console.log(
  "[OK] Photo upload/constraint UI now follows the dark RoadSafe/Blender workspace styling.",
);
console.log(
  "[OK] Existing canonical photo constraints, evidence data and physics behavior were preserved.",
);
console.log(
  "[OK] No second reconstruction model was introduced.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Production build verification + rollback                                   */
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
    "[RoadSafe] Rolling V1.2 integration back automatically...",
  );

  for (
    const rel
    of Object.keys(FILES)
  ) {
    const previous =
      originals.get(rel);

    if (previous) {
      fs.mkdirSync(
        path.dirname(abs(rel)),
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
  "Open Reconstruction and toggle Photo Assist from the top.",
);
