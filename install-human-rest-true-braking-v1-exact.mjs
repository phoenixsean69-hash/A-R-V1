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
    "roadsafe-human-rest-true-braking-v1-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "dd19c61d6f7fe41ba2a802a7690eab0f90466def3a4f0c3f4884e782a34be48d",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "3f42ae4bf7ef2814229fa7fba61233698a58ecafa171b401dadd4c87c6e42372",
  "src/utils/reconstructionHumanKnockdown.ts": "598bcfd159b0c2118a4ad1d006babbd668c1bc7cbcb73cb25732a970f9c8c022",
  "src/utils/reconstructionReactionModel.ts": "71a7b65774707cf96065c335a308faa67f4821167b57bc555ae673a2d559ee61",
  "src/services/rapierDynamicsService.ts": "de4a2f22ac5f42694516b2d89febdee4db4fb14c7405ebbfcbf0e0e240a78211"
};

const FILES = {
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "Reconstruction3DViewer.tsx",
  "src/components/reconstruction/ar/ARSceneFactory.ts": "ARSceneFactory.ts",
  "src/utils/reconstructionHumanKnockdown.ts": "reconstructionHumanKnockdown.ts",
  "src/utils/reconstructionReactionModel.ts": "reconstructionReactionModel.ts",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts"
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
        `${rel} differs from the exact current Motion Realism / Grounded Human state used for this pass.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force this installer. Send the fresh local file if that component was edited separately.",
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
    `human-rest-true-braking-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of Object.keys(FILES)
) {
  const target = abs(rel);

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
  "RoadSafe Human Rest + True Emergency Braking V1 — EXACT LOCAL",
);
console.log(
  "==============================================================",
);

console.log(
  "[OK] Exact current Motion Realism / Grounded Human source hashes matched.",
);

console.log(
  "[OK] Settled human total body tilt is now normalized to ~88-90 degrees so the body lies down instead of reclining in mid-air.",
);

console.log(
  "[OK] Human final X/Z position remains the canonical Rapier/rest trajectory position.",
);

console.log(
  "[OK] Vehicle split-second reaction no longer rotates/yaws the whole vehicle toward Point Z.",
);

console.log(
  "[OK] Cars, buses, trucks, motorcycles and bicycles react through braking rather than pre-impact steering.",
);

console.log(
  "[OK] Human participants retain head/upper-body attention toward the accident spot.",
);

console.log(
  "[OK] Emergency-braking timing now targets RoadSafe's predicted first swept-body contact time when available, not the later centre-point Point Z time.",
);

console.log(
  "[OK] Rapier records the exact first emergency-brake step per participant.",
);

console.log(
  "[OK] Rapier braking samples are now exported into the shared canonical trajectory BEFORE contact.",
);

console.log(
  "[OK] Pre-contact Rapier samples are labelled/actioned as Brake.",
);

console.log(
  "[OK] First real body-contact sample is labelled/actioned as Impact.",
);

console.log(
  "[OK] Post-contact samples remain Slide and the final settled sample remains Stop.",
);

console.log(
  "[OK] 2D, 3D and AR can therefore show actual deceleration and displacement during braking instead of only brake-light/nose-dive decoration.",
);

console.log(
  "[OK] Brake lights and nose dive in Main 3D/AR use the same first-body-contact timing after a physics bake.",
);

console.log(
  "[OK] Vehicle damage, collision response, speed-authority logic and human walking were not removed.",
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
    "[RoadSafe] Rolling Human Rest + True Emergency Braking V1 back automatically...",
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
  "Human Rest + True Emergency Braking V1 is installed.",
);

console.log(
  "Run: npm run dev",
);

console.log("");
console.log(
  "Re-run physics, then replay the same car/pedestrian collision. The car should brake straight before first body contact, and the pedestrian should finish lying flat at the canonical final rest position.",
);
