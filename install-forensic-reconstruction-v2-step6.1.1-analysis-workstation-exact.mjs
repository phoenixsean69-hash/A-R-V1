import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(
  HERE,
  "roadsafe-forensic-reconstruction-v2-step6.1-payload",
);

const TARGETS = [
  [
    "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
    "611c74a466d72ed9fad331385154980e400e4f73",
  ],
  [
    "src/features/forensicReconstruction/forensicInvestigationService.ts",
    "aee86cb2efa3dfd2f4759e81e951db41c7bd4f6f",
  ],
  [
    "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
    "bdeda0625ded3e9426bfd1d31e9c21e0a38a51df",
  ],
  [
    "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
    "5cb7f1114d25ad2cb7cd1265a8414cc7907a55d5",
  ],
];

const NEW_FILE =
  "src/features/forensicReconstruction/forensicAnalysisRules.ts";
const VERIFIER =
  "scripts/verify-forensic-reconstruction-v2-step6-analysis.mjs";
const RUNTIME_VERIFIER =
  "scripts/verify-forensic-reconstruction-v2-step6-analysis-runtime.mjs";

const FILES = [
  ...TARGETS.map(([file]) => file),
  NEW_FILE,
  VERIFIER,
  RUNTIME_VERIFIER,
];

function abs(relative) {
  return path.join(ROOT, ...relative.split("/"));
}

function payloadFile(relative) {
  return path.join(PAYLOAD, ...relative.split("/"));
}

function blob(content) {
  return crypto
    .createHash("sha1")
    .update(Buffer.from(`blob ${content.length}\0`, "utf8"))
    .update(content)
    .digest("hex");
}

function inspect(file) {
  const raw = fs.readFileSync(file);
  const normalised = Buffer.from(
    raw
      .toString("utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n"),
    "utf8",
  );

  return {
    raw: blob(raw),
    normalised: blob(normalised),
  };
}

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
}

if (!fs.existsSync(abs("package.json"))) {
  fail("Run this installer from the A-R-V1 repository root.");
}

for (const [relative, expected] of TARGETS) {
  const file = abs(relative);

  if (!fs.existsSync(file)) {
    fail(
      `${relative} is missing. Install the accepted Step 6 Analysis state first.`,
    );
  }

  const current = inspect(file);

  if (
    current.raw !== expected &&
    current.normalised !== expected
  ) {
    fail([
      `${relative} differs from the exact accepted Step 6 Analysis state.`,
      "No files were changed.",
      "",
      `Expected canonical blob: ${expected}`,
      `Current raw blob:        ${current.raw}`,
      `Current LF-normalised:   ${current.normalised}`,
      "",
      "Do not force this installer. Send the fresh local file so Step 6.1 Analysis Workstation can be adapted safely.",
    ].join("\n"));
  }
}

for (const relative of FILES) {
  if (!fs.existsSync(payloadFile(relative))) {
    fail(`Installer payload is incomplete: ${relative}`);
  }
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot = path.join(
  ROOT,
  ".roadsafe-backups",
  `forensic-reconstruction-v2-step6.1.1-analysis-workstation-${stamp}`,
);

const originals = new Map();

for (const relative of FILES) {
  const target = abs(relative);

  if (fs.existsSync(target)) {
    originals.set(
      relative,
      fs.readFileSync(target),
    );

    const backup = path.join(
      backupRoot,
      ...relative.split("/"),
    );

    fs.mkdirSync(
      path.dirname(backup),
      { recursive: true },
    );

    fs.copyFileSync(
      target,
      backup,
    );
  } else {
    originals.set(
      relative,
      null,
    );
  }
}

function rollback() {
  for (const relative of FILES) {
    const target = abs(relative);
    const original = originals.get(relative);

    if (original === null) {
      fs.rmSync(
        target,
        { force: true },
      );
    } else if (original) {
      fs.mkdirSync(
        path.dirname(target),
        { recursive: true },
      );

      fs.writeFileSync(
        target,
        original,
      );
    }
  }
}

for (const relative of FILES) {
  const target = abs(relative);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.copyFileSync(
    payloadFile(relative),
    target,
  );
}

console.log("");
console.log(
  "RoadSafe Forensic Reconstruction V2 — STEP 6.1.1 ANALYSIS WORKSTATION",
);
console.log(
  "=================================================================",
);
console.log(
  "[OK] Exact accepted Step 6 Analysis source state matched.",
);
console.log(
  "[OK] Analysis workstation layout layered onto the accepted Step 6 analysis foundation.",
);
console.log(
  "[OK] Evidence relationship map, matrix and timeline workstation added.",
);
console.log(
  "[OK] Visual analytical finding register and current-finding summary added.",
);
console.log(
  "[OK] Scene, evidence, measurements, vehicles, persons and witnesses can be cited as analysis sources.",
);
console.log(
  "[OK] Limitations, follow-up, origin and confidence are recorded explicitly.",
);
console.log(
  "[OK] Analysis does not declare legal guilt or silently convert assumptions into facts.",
);
console.log(
  `[OK] Backup: ${backupRoot}`,
);

for (const verifier of [
  VERIFIER,
  RUNTIME_VERIFIER,
]) {
  const result = run(
    process.execPath,
    [abs(verifier)],
  );

  if (
    result.status !== 0 ||
    result.error
  ) {
    console.error(
      result.stdout ?? "",
    );
    console.error(
      result.stderr ?? "",
    );

    rollback();

    fail(
      `Step 6.1 verifier failed (${verifier}) and the patch was rolled back.`,
      2,
    );
  }

  console.log(
    result.stdout,
  );
}

console.log(
  "Running production build...",
);

const build =
  process.platform === "win32"
    ? run(
        "cmd.exe",
        [
          "/d",
          "/s",
          "/c",
          "npm run build",
        ],
      )
    : run(
        "npm",
        ["run", "build"],
      );

if (
  build.status !== 0 ||
  build.error
) {
  console.error(
    build.stdout ?? "",
  );
  console.error(
    build.stderr ?? "",
  );

  rollback();

  fail(
    "Production build failed and Step 6.1 was rolled back.",
    3,
  );
}

console.log(
  "[OK] Production build passed.",
);
console.log("");
console.log(
  "Step 6.1.1 Analysis Workstation installed successfully.",
);
