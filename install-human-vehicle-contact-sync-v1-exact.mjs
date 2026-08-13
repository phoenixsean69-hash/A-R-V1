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
    "roadsafe-human-vehicle-contact-sync-v1-payload",
  );

const EXPECTED = {
  "src/services/rapierDynamicsService.ts": "f748b588db627cce4386acca1be2b08f436ec900d3b3a28efa081e5f54c5601c",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "e5f5c7da48aaf1ffd7999836ccc2b7749e9ed1f3b205d06bbe0bbb325b23e0a2",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "61f71087e01969c2b35316c64a283a111fdbadf357f824a1f4e42200e2361308",
  "src/utils/reconstructionReactionModel.ts": "ad74d327ca3c091f0ed1ffd4dc6619b0cfedf8bdacf8b9ad5b84051b86f7059c",
  "src/utils/reconstructionHumanKnockdown.ts": "15fc431324c124da469a406057c7da99990e60cc08dc86b90f1700a87349635e",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "841b2851b689e2a14fd5363cf08601089846baa4d284404f33cc5d0eb073a1cc",
  "src/types/reconstruction.ts": "809727df08cfb6fe416576d1872fb901222006189344bc164590367e8655028a"
};

const FILES = {
  "src/types/reconstruction.ts": "reconstruction.ts",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "Reconstruction3DViewer.tsx",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "ARSceneFactory.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "AccidentReconstructionEditor.tsx",
  "src/utils/reconstructionReactionModel.ts": "reconstructionReactionModel.ts",
  "src/utils/reconstructionHumanKnockdown.ts": "reconstructionHumanKnockdown.ts"
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
    ["run", "build"],
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
        `${rel} differs from the exact current RoadSafe state used for Human-Vehicle Contact Sync V1.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this installer. Send the fresh local file if you changed it after the latest installed passes.",
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
    `human-vehicle-contact-sync-v1-${stamp}`,
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
      fs.readFileSync(target);

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
        path.dirname(abs(rel)),
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
  fs.mkdirSync(
    path.dirname(abs(rel)),
    {
      recursive: true,
    },
  );

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
  "RoadSafe Human-Vehicle Contact Sync V1 — EXACT LOCAL",
);
console.log(
  "=====================================================",
);

console.log(
  "[OK] Exact current RoadSafe source hashes matched.",
);

console.log(
  "[OK] Human Rapier collider no longer uses the legacy 0.30 m circular body radius.",
);

console.log(
  "[OK] Human collider outer radius now follows visible head/shoulder dimensions, normally about 0.15-0.20 m depending on the human asset.",
);

console.log(
  "[OK] Rounded-cylinder core radius is reduced by its round-border thickness so the final outer collider does not silently grow.",
);

console.log(
  "[OK] Human Rapier contact skin reduced from 15 mm to 2 mm; vehicle stability skin remains 15 mm.",
);

console.log(
  "[OK] Rapier now stores exact first rigid-body contact time separately for every participant.",
);

console.log(
  "[OK] Main 3D human knockdown starts at that participant's real Rapier contact time.",
);

console.log(
  "[OK] Main 3D generic impact pose starts at real Rapier contact time.",
);

console.log(
  "[OK] Vehicle visual damage activation is synchronized to real Rapier contact time.",
);

console.log(
  "[OK] 3D impact light uses actual Rapier contact time.",
);

console.log(
  "[OK] AR impact/knockdown uses the same per-participant Rapier contact time.",
);

console.log(
  "[OK] Main 2D reaction/walking handoff also uses actual Rapier contact time.",
);

console.log(
  "[OK] Forensic collision estimates are preserved; only dynamics/visual handoff timing is synchronized to confirmed Rapier contact.",
);

console.log(
  "[OK] Human final resting behavior, emergency braking, speed authority and vehicle colliders remain intact.",
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

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Human-Vehicle Contact Sync V1 back automatically...",
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
  "Human-Vehicle Contact Sync V1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "IMPORTANT: re-run physics before replaying the human/vehicle crash. The old bake contains the old oversized human contact envelope.",
);
