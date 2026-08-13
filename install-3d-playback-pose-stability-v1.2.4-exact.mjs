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
    "roadsafe-3d-pose-stability-v1.2.4-payload",
  );

const TARGET_REL =
  "src/components/reconstruction/Reconstruction3DViewer.tsx";

const EXPECTED_SHA256 =
  "db8091da732b32318944f10339bf6ca749ea93bcfe1ee0597b214195d5e026ae";

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

function fail(message, code = 1) {
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

const target =
  abs(TARGET_REL);

const source =
  path.join(
    PAYLOAD,
    "Reconstruction3DViewer.tsx",
  );

if (!fs.existsSync(target)) {
  fail(
    `Could not find ${TARGET_REL}. Run this installer from the A-R-V1 repository root.`,
  );
}

if (!fs.existsSync(source)) {
  fail(
    "Installer payload is incomplete. Extract the whole ZIP before running it.",
  );
}

const currentHash =
  sha256(target);

if (
  currentHash !==
  EXPECTED_SHA256
) {
  fail(
    [
      "Reconstruction3DViewer.tsx differs from the exact V1.2.3.1 state used for this playback-stability pass.",
      "No files were changed.",
      "",
      `Expected SHA-256: ${EXPECTED_SHA256}`,
      `Current SHA-256:  ${currentHash}`,
      "",
      "If you edited the 3D viewer after V1.2.3.1, send the fresh local file instead of forcing this installer.",
    ].join("\n"),
  );
}

const original =
  fs.readFileSync(
    target,
  );

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
    `3d-playback-pose-stability-v1.2.4-${stamp}`,
    ...TARGET_REL.split("/"),
  );

fs.mkdirSync(
  path.dirname(backup),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  backup,
  original,
);

fs.copyFileSync(
  source,
  target,
);

console.log("");
console.log(
  "RoadSafe 3D Playback Pose Stability V1.2.4 — EXACT LOCAL",
);
console.log(
  "========================================================",
);
console.log(
  "[OK] Exact V1.2.3.1 Reconstruction3DViewer hash matched.",
);
console.log(
  "[OK] Rapier physics and canonical participant trajectories were NOT modified.",
);
console.log(
  "[OK] 3D participant positions remain exact canonical positions.",
);
console.log(
  "[OK] Heading now uses a short circular time-window to reject high-frequency route/sample noise.",
);
console.log(
  "[OK] 359°/0° heading wrap is handled with circular averaging.",
);
console.log(
  "[OK] Frame-to-frame yaw uses shortest-angle damping with a tiny angular deadband.",
);
console.log(
  "[OK] Physics-generated headings use a smaller smoothing window than authored approach motion.",
);
console.log(
  "[OK] Low-speed/resting bodies preserve canonical heading instead of chasing tiny solver corrections.",
);
console.log(
  "[OK] Post-impact pitch/roll/vertical visual response is damped but still visible.",
);
console.log(
  "[OK] Pause, scrub, rewind and large timeline jumps snap immediately to the exact canonical pose.",
);
console.log(
  "[OK] No smoothing values are saved to the case or physics result.",
);
console.log(
  `[OK] Backup: ${path.dirname(path.dirname(path.dirname(path.dirname(backup))))}`,
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

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling V1.2.4 back automatically...",
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
  "3D Playback Pose Stability V1.2.4 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log(
  "Replay the same collision in 3D and watch the approach heading and post-impact body motion.",
);
