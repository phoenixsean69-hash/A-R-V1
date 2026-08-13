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
    "roadsafe-photo-top-tab-v1.1-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "cc5a48e7c44eb901f70f1f92f2399ad0cf2ec1f633e0f922ffb7a4a3f4bf09e2",
  "src/components/reconstruction/EvidenceWorkspace.tsx": "1f0ff83874bd1bcf607006582fc81f06d0d3f7669194990744357b2d4addfb92"
};

const FILES = {
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "src__components__reconstruction__AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/EvidenceWorkspace.tsx": "src__components__reconstruction__EvidenceWorkspace.tsx"
};

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
        `${rel} does not match Photo-Assisted Reconstruction V1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Install/verify Photo-Assisted Reconstruction V1 first, or send the latest local file if it changed afterwards.",
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
      `Installer payload is missing ${payloadName}. Extract the whole ZIP first.`,
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
    `photo-analysis-top-tab-v1.1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of Object.keys(FILES)
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

for (
  const [rel, payloadName]
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
  "RoadSafe Photo Analysis Top Tab V1.1 — EXACT LOCAL",
);
console.log(
  "===================================================",
);
console.log(
  "[OK] Photo-Assisted V1 source hashes matched.",
);
console.log(
  "[OK] Added Photos as a top-level reconstruction workspace tab.",
);
console.log(
  "[OK] Top switch now offers 2D View, 3D View and Photos.",
);
console.log(
  "[OK] Selecting Photos stops playback and opens Photo-Assisted Reconstruction directly.",
);
console.log(
  "[OK] Standalone Photos mode hides Evidence/Measurements sub-tabs.",
);
console.log(
  "[OK] Photo upload, analysis, constraints and Apply workflow use the same canonical reconstruction data.",
);
console.log(
  "[OK] Reconstruction bottom dock/Dope Sheet is hidden only while Photos is selected.",
);
console.log(
  "[OK] Returning to 2D/3D restores the normal reconstruction workspace.",
);
console.log(
  "[OK] Nodes and Objects & Evidence automatically return to the Scene workspace.",
);
console.log(
  "[OK] No physics, photo constraints, evidence or storage models changed.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

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
    "[RoadSafe] Rolling Photo Analysis top-tab change back automatically...",
  );

  for (
    const [rel, content]
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
  "Open a reconstruction and use the new Photos tab in the top view switch.",
);
