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
    "roadsafe-stable-inputs-v1-payload",
  );

const EXPECTED = {
  "src/components/reconstruction/SceneCollectionAssetBrowser.tsx": "ce73987fb2abcf57e5cf1e5c28e03cf40cc0374789cc60aef0f7740cb7d4a71d",
  "src/components/reconstruction/ReconstructionPhysicsContextEditor.tsx": "9fd6a0dc62e38150da24b85c0c49d18566506a47dc221f546496344755e59d6a",
  "src/components/reconstruction/ReconstructionNodeEditor.tsx": "a2ed8945d9bbd33ee196c01b01b6011fa1b11a43387ad9b6c6fff6f241249e6d",
  "src/components/reconstruction/PhysicsControlsPanel.tsx": "6b84fa2ee060183f1f3791f5b64465852e1e6b104df69b08d215aedce14f69b9",
  "src/components/reconstruction/SceneObjectSettingsPanel.tsx": "c8d9f28487f043b109ed6be495e052080a37dc9e6b9a0c8673db6d9483de3c77"
};

const FILES = {
  "src/components/reconstruction/SceneCollectionAssetBrowser.tsx": "SceneCollectionAssetBrowser.tsx",
  "src/components/reconstruction/ReconstructionPhysicsContextEditor.tsx": "ReconstructionPhysicsContextEditor.tsx",
  "src/components/reconstruction/ReconstructionNodeEditor.tsx": "ReconstructionNodeEditor.tsx",
  "src/components/reconstruction/PhysicsControlsPanel.tsx": "PhysicsControlsPanel.tsx",
  "src/components/reconstruction/SceneObjectSettingsPanel.tsx": "SceneObjectSettingsPanel.tsx",
  "src/components/reconstruction/BufferedCommitInput.tsx": "BufferedCommitInput.tsx"
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
        `${rel} differs from the exact local input/editor version audited for this fix.`,
        "No files were changed.",
        "",
        `Expected SHA-256: ${expectedHash}`,
        `Current SHA-256:  ${actual}`,
        "",
        "Do not force it. If this component was edited after the current local snapshot, send the fresh file and I will rebase the input fix.",
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
      `Installer payload is missing ${payloadName}. Extract the entire ZIP first.`,
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
    `stable-live-property-inputs-v1-${stamp}`,
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

for (
  const [
    rel,
    payloadName,
  ]
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
  "RoadSafe Stable Property Inputs V1 — EXACT LOCAL",
);
console.log(
  "================================================",
);
console.log(
  "[OK] Canonical reconstruction is no longer updated on every numeric keystroke.",
);
console.log(
  "[OK] Numeric fields keep a local raw draft while the investigator is typing.",
);
console.log(
  "[OK] Empty/partial numeric strings no longer collapse immediately to 0.",
);
console.log(
  "[OK] Blur commits the final valid value once.",
);
console.log(
  "[OK] Enter commits once and exits the field.",
);
console.log(
  "[OK] Escape discards the uncommitted draft.",
);
console.log(
  "[OK] Unchanged final values do not trigger reconstruction updates.",
);
console.log(
  "[OK] Scene Collection participant Name is also buffered.",
);
console.log(
  "[OK] Scene Collection speed/mass/dimensions/physics fields are buffered.",
);
console.log(
  "[OK] Physics Context numeric fields are buffered.",
);
console.log(
  "[OK] Node Editor numeric fields are buffered.",
);
console.log(
  "[OK] Legacy Physics Controls numeric fields are buffered.",
);
console.log(
  "[OK] Scene Object numeric fields are buffered.",
);
console.log(
  "[OK] Existing classes/styles were preserved.",
);
console.log(
  "[OK] Rapier, 2D, 3D, AR and forensic calculations were not modified.",
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
    "[RoadSafe] Rolling Stable Property Inputs V1 back automatically...",
  );

  for (
    const rel
    of Object.keys(FILES)
  ) {
    const previous =
      originals.get(rel);

    if (previous) {
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
  "Stable Property Inputs V1 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log("");
console.log(
  "While a participant/physics number field is being typed, 2D/3D/AR should stay stable. Blur or press Enter to commit the edit once.",
);
