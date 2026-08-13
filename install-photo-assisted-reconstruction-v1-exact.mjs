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
    "roadsafe-photo-assisted-v1-payload",
  );

const EXPECTED = {
  "src/types/reconstruction.ts": "7daea3ff6a338f1eb62749bf0ee1929c14c7aa567ebcceebfaca7e467dbba47f",
  "src/services/reconstructionService.ts": "03502a8000719a7f9f12bfecfd57ae18e6260997f7c1fa114e94ad09f7f263d8",
  "src/components/reconstruction/EvidenceWorkspace.tsx": "45153487617f10bdd29ed2915898716dbfe0e498881a764105adb148b49760ea",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "7ae959489d89b679dc8b88a09d37399c7ddbd998fa5684e5d98cc3af3883d049"
};

const FILES = {
  "src/types/reconstruction.ts": "src__types__reconstruction.ts",
  "src/services/reconstructionService.ts": "src__services__reconstructionService.ts",
  "src/services/photoConstraintService.ts": "src__services__photoConstraintService.ts",
  "src/components/reconstruction/EvidenceWorkspace.tsx": "src__components__reconstruction__EvidenceWorkspace.tsx",
  "src/components/reconstruction/PhotoConstraintWorkspace.tsx": "src__components__reconstruction__PhotoConstraintWorkspace.tsx",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "src__components__reconstruction__AccidentReconstructionEditor.tsx"
};

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function fail(message, code = 1) {
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

/* -------------------------------------------------------------------------- */
/* Exact-local safety check                                                   */
/* -------------------------------------------------------------------------- */

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

  const actual =
    sha256(target);

  if (actual !== expectedHash) {
    fail(
      [
        `${rel} differs from the exact local RoadSafe snapshot used for Photo-Assisted V1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force the install. If that file was edited after the current snapshot, send the fresh local file.",
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
    `photo-assisted-reconstruction-v1-${stamp}`,
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
      { recursive: true },
    );

    fs.writeFileSync(
      backup,
      content,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Install exact replacements                                                 */
/* -------------------------------------------------------------------------- */

for (
  const [rel, payloadName]
  of Object.entries(FILES)
) {
  const target =
    abs(rel);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
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
  "RoadSafe Photo-Assisted Reconstruction V1 — EXACT LOCAL",
);
console.log(
  "========================================================",
);
console.log(
  "[OK] Exact local reconstruction files matched before installation.",
);
console.log(
  "[OK] Existing multi-photo upload remains intact.",
);
console.log(
  "[OK] Each photo can now open a Photo Analysis workspace.",
);
console.log(
  "[OK] Investigator can click a visible image feature and preserve its image-space source point.",
);
console.log(
  "[OK] Photo observations are stored separately from immutable source-photo evidence.",
);
console.log(
  "[OK] Observation workflow is Draft -> Confirmed -> Applied.",
);
console.log(
  "[OK] Primary Impact Point constraints update the canonical collision marker and participant Impact anchors.",
);
console.log(
  "[OK] Participant Path Point constraints update authored routes.",
);
console.log(
  "[OK] Participant Heading constraints update authored point rotation.",
);
console.log(
  "[OK] Scene Object Position constraints update canonical collision geometry.",
);
console.log(
  "[OK] Evidence Position constraints update documented evidence placement without pretending to alter physics.",
);
console.log(
  "[OK] Physics-affecting photo constraints invalidate the previous physics bake.",
);
console.log(
  "[OK] Applying a constraint records an audit summary and timestamp.",
);
console.log(
  "[OK] Deleting a source photo also removes its derived photo constraints.",
);
console.log(
  "[OK] No AI or hidden computer-vision inference was introduced.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Build + rollback                                                           */
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
    "[RoadSafe] Rolling Photo-Assisted V1 back automatically...",
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
        { recursive: true },
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
  "Open Reconstruction -> Investigation Documentation -> Scene Photos.",
);
