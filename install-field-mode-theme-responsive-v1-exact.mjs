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
    "roadsafe-field-mode-theme-responsive-v1-payload",
  );

const PANEL_REL =
  "src/components/fieldPlacement/FieldPlacementPanel.tsx";

const CSS_REL =
  "src/components/fieldPlacement/FieldPlacementPanel.css";

const EXPECTED_PANEL_BLOB =
  "15d7a40eae5b8c11d050bb66b7da32e01b9394d4";

const EXPECTED_CSS_BLOB =
  "e20852af8d7b33ac8b16ca442eb5fba93900d93c";

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function normalisedLf(
  file,
) {
  return fs
    .readFileSync(
      file,
      "utf8",
    )
    .replace(
      /\r\n/g,
      "\n",
    );
}

function gitBlobSha1(
  file,
) {
  const content =
    Buffer.from(
      normalisedLf(file),
      "utf8",
    );

  const header =
    Buffer.from(
      `blob ${content.length}\0`,
      "utf8",
    );

  return crypto
    .createHash("sha1")
    .update(header)
    .update(content)
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

function replaceOnce(
  source,
  label,
  before,
  after,
) {
  const count =
    source
      .split(before)
      .length -
    1;

  if (
    count !== 1
  ) {
    throw new Error(
      `${label}: expected exactly one anchor, found ${count}.`,
    );
  }

  return source.replace(
    before,
    after,
  );
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

const panelTarget =
  abs(PANEL_REL);

const cssTarget =
  abs(CSS_REL);

const cssPayload =
  path.join(
    PAYLOAD,
    "FieldPlacementPanel.css",
  );

for (
  const file
  of [
    panelTarget,
    cssTarget,
  ]
) {
  if (
    !fs.existsSync(file)
  ) {
    fail(
      `Could not find ${path.relative(ROOT, file)}. Run this installer from the A-R-V1 repository root.`,
    );
  }
}

if (
  !fs.existsSync(
    cssPayload,
  )
) {
  fail(
    "FieldPlacementPanel.css payload is missing. Extract the whole ZIP before running the installer.",
  );
}

const panelBlob =
  gitBlobSha1(
    panelTarget,
  );

const cssBlob =
  gitBlobSha1(
    cssTarget,
  );

if (
  panelBlob !==
  EXPECTED_PANEL_BLOB
) {
  fail(
    [
      `${PANEL_REL} differs from the exact Field Mode source audited for this pass.`,
      "No files were changed.",
      "",
      `Expected Git blob SHA-1: ${EXPECTED_PANEL_BLOB}`,
      `Current Git blob SHA-1:  ${panelBlob}`,
      "",
      "Do not force this installer. Send the fresh local FieldPlacementPanel.tsx if it has been changed.",
    ].join("\n"),
  );
}

if (
  cssBlob !==
  EXPECTED_CSS_BLOB
) {
  fail(
    [
      `${CSS_REL} differs from the exact legacy Field Mode stylesheet audited for this pass.`,
      "No files were changed.",
      "",
      `Expected Git blob SHA-1: ${EXPECTED_CSS_BLOB}`,
      `Current Git blob SHA-1:  ${cssBlob}`,
      "",
      "Do not force this installer. Send the fresh local FieldPlacementPanel.css if it has been changed.",
    ].join("\n"),
  );
}

let patchedPanel =
  normalisedLf(
    panelTarget,
  );

try {
  patchedPanel =
    replaceOnce(
      patchedPanel,
      "createPortal import",
`import {
  useEffect,
  useMemo,
  useState,
} from "react";`,
`import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";`,
    );

  patchedPanel =
    replaceOnce(
      patchedPanel,
      "Field Mode portal return",
`  return (
    <div className="field-mode-backdrop">`,
`  return createPortal(
    <div
      className="field-mode-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="RoadSafe field mode"
    >`,
    );

  const finalAnchor =
`    </div>
  );
}`;

  const finalIndex =
    patchedPanel.lastIndexOf(
      finalAnchor,
    );

  if (
    finalIndex < 0
  ) {
    throw new Error(
      "Field Mode final JSX anchor was not found.",
    );
  }

  patchedPanel =
    patchedPanel.slice(
      0,
      finalIndex,
    ) +
`    </div>,
    document.body,
  );
}` +
    patchedPanel.slice(
      finalIndex +
      finalAnchor.length,
    );
} catch (error) {
  fail(
    `Field Mode portal patch preflight failed: ${error instanceof Error ? error.message : String(error)}`,
  );
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
    `field-mode-theme-responsive-v1-${stamp}`,
  );

const originals =
  new Map();

for (
  const rel
  of [
    PANEL_REL,
    CSS_REL,
  ]
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

function rollback() {
  for (
    const [
      rel,
      content,
    ]
    of originals.entries()
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
      content,
    );
  }
}

fs.writeFileSync(
  panelTarget,
  patchedPanel,
  "utf8",
);

fs.copyFileSync(
  cssPayload,
  cssTarget,
);

console.log("");
console.log(
  "RoadSafe Field Mode Theme + Responsive Containment V1 — EXACT LOCAL",
);
console.log(
  "==================================================================",
);
console.log(
  "[OK] Exact FieldPlacementPanel.tsx and legacy FieldPlacementPanel.css guards matched.",
);
console.log(
  "[OK] Field Mode now renders through document.body using createPortal, so transformed/overflow-hidden reconstruction ancestors cannot crop the overlay.",
);
console.log(
  "[OK] Field Mode is constrained to the actual viewport and horizontal overflow is blocked.",
);
console.log(
  "[OK] Legacy navy/blue dashboard chrome replaced with the accepted RoadSafe neutral Blender-style workspace surfaces.",
);
console.log(
  "[OK] Primary/selected Field Mode actions now use restrained RoadSafe orange-accent interaction instead of bright blue UI states.",
);
console.log(
  "[OK] GPS quality, warning, error and raw/processed map-data colours remain semantic.",
);
console.log(
  "[OK] Header, tabs, controls, cards and inspector use compact RoadSafe sizing and flatter borders/radii.",
);
console.log(
  "[OK] Map and live-preview panels are min-width:0 and can shrink without forcing the page wider.",
);
console.log(
  "[OK] Capture Workflow inspector collapses below the visual workspace at <=1120px instead of being pushed off-screen.",
);
console.log(
  "[OK] Map + calibrated preview become one column at <=760px.",
);
console.log(
  "[OK] Telemetry and capture controls reflow at narrow widths.",
);
console.log(
  "[OK] Field Mode retains vertical scrolling; no functional panel is clipped at the bottom.",
);
console.log(
  "[OK] GPS capture, calibration, history, map interaction and reconstruction update logic were not changed.",
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
    "[RoadSafe] Rolling Field Mode Theme + Responsive Containment V1 back automatically...",
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
  "Field Mode Theme + Responsive Containment V1 is installed.",
);
console.log(
  "Run: npm run dev",
);
console.log("");
console.log(
  "Visual QA: reopen Field Mode at the same browser width/zoom. The title must begin fully on-screen, Capture Workflow must remain reachable, and there must be no page-level horizontal crop.",
);
