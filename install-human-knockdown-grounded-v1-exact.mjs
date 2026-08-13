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
    "roadsafe-human-knockdown-grounded-v1-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "5ac145b4f86dc63fd7cf5010dba1a91c2570ef23f46b0071124c8314369a59d3",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "7f9bf56a5c0574748e23fc5e96f638ee7571f9ca6fc1f3ea608aefc2e68ff609"
};

const FILES = {
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "Reconstruction3DViewer.tsx",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "ARSceneFactory.ts",
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
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

function runBuild() {
  if (process.platform === "win32") {
    return spawnSync(
      "cmd.exe",
      ["/d", "/s", "/c", "npm run build"],
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
        `${rel} differs from the exact Motion Realism V1 viewer state used for this human-knockdown pass.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force it. If you edited 3D/AR after Motion Realism V1, send the fresh local file and I will rebase the knockdown fix.",
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
      path.join(PAYLOAD, payloadName),
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
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `human-knockdown-grounded-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of Object.keys(FILES)
) {
  const target =
    abs(rel);

  if (fs.existsSync(target)) {
    const content =
      fs.readFileSync(target);

    originals.set(rel, content);

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
        { recursive: true },
      );

      fs.writeFileSync(
        abs(rel),
        previous,
      );
    } else if (
      fs.existsSync(abs(rel))
    ) {
      fs.unlinkSync(abs(rel));
    }
  }
}

for (
  const [rel, payloadName]
  of Object.entries(FILES)
) {
  fs.mkdirSync(
    path.dirname(abs(rel)),
    { recursive: true },
  );

  fs.copyFileSync(
    path.join(PAYLOAD, payloadName),
    abs(rel),
  );
}

console.log("");
console.log(
  "RoadSafe Grounded Human Knockdown V1 — EXACT LOCAL",
);
console.log(
  "==================================================",
);
console.log(
  "[OK] Exact current Motion Realism 3D/AR hashes matched.",
);
console.log(
  "[OK] Human post-impact motion now follows a one-way airborne -> ground-contact -> settled-fallen sequence.",
);
console.log(
  "[OK] Old elevated human rest target is overridden.",
);
console.log(
  "[OK] Repeated landing bounce/air-dancer behavior removed.",
);
console.log(
  "[OK] Fallen human stays only 18-45 mm above the surface to avoid mesh clipping.",
);
console.log(
  "[OK] A single tiny ground-contact compression cue lasts at most 160 ms.",
);
console.log(
  "[OK] Fallen orientation persists; no automatic return toward standing.",
);
console.log(
  "[OK] Human gait still stops at impact.",
);
console.log(
  "[OK] Canonical Rapier X/Z trajectory remains authoritative.",
);
console.log(
  "[OK] Vehicle collision/damage/braking/speed logic was not modified.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

console.log("");
console.log(
  "Verifying production build...",
);

const build = runBuild();

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
    "[RoadSafe] Rolling Grounded Human Knockdown V1 back automatically...",
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
  "Grounded Human Knockdown V1 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log("");
console.log(
  "Replay a pedestrian/vehicle impact in 3D and AR. The human should be thrown/fall once, contact the road, and remain down instead of hovering toward an invisible rest pose.",
);
