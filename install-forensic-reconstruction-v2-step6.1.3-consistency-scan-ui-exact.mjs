import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(HERE, "roadsafe-forensic-reconstruction-v2-step6.1.3-payload");

const TARGETS = [
  [
    "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
    "c4b02a4c37502a3794e1e48c8a6094045da9431a",
  ],
  [
    "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
    "6b78cad22f675071ad714e311db88a7867384ed8",
  ],
];

const VERIFIER = "scripts/verify-forensic-reconstruction-v2-step6.1.3-consistency-scan-ui.mjs";
const FILES = [...TARGETS.map(([file]) => file), VERIFIER];

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
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    "utf8",
  );

  return { raw: blob(raw), normalised: blob(normalised) };
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
    fail(`${relative} is missing. Install Step 6.1.2 first.`);
  }

  const current = inspect(file);

  if (current.raw !== expected && current.normalised !== expected) {
    fail([
      `${relative} differs from the exact Step 6.1.2 state.`,
      "No files were changed.",
      "",
      `Expected canonical blob: ${expected}`,
      `Current raw blob:        ${current.raw}`,
      `Current LF-normalised:   ${current.normalised}`,
      "",
      "Do not force this installer. Send the fresh local file so this UI repair can be adapted safely.",
    ].join("\n"));
  }
}

for (const relative of FILES) {
  if (!fs.existsSync(payloadFile(relative))) {
    fail(`Installer payload is incomplete: ${relative}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  ROOT,
  ".roadsafe-backups",
  `forensic-reconstruction-v2-step6.1.3-consistency-scan-ui-${stamp}`,
);

const originals = new Map();

for (const relative of FILES) {
  const target = abs(relative);

  if (fs.existsSync(target)) {
    originals.set(relative, fs.readFileSync(target));
    const backup = path.join(backupRoot, ...relative.split("/"));
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(target, backup);
  } else {
    originals.set(relative, null);
  }
}

function rollback() {
  for (const relative of FILES) {
    const target = abs(relative);
    const original = originals.get(relative);

    if (original === null) {
      fs.rmSync(target, { force: true });
    } else if (original) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, original);
    }
  }
}

for (const relative of FILES) {
  const target = abs(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(payloadFile(relative), target);
}

console.log("");
console.log("RoadSafe Forensic Reconstruction V2 — STEP 6.1.3 CONSISTENCY SCAN UI");
console.log("=======================================================================");
console.log("[OK] Exact Step 6.1.2 source state matched.");
console.log("[OK] Automatic Consistency Scan moved out of the cramped split layout.");
console.log("[OK] Warning cards now use a readable full-width evidence-review layout.");
console.log("[OK] Existing analysis data, rules and persistence are unchanged.");
console.log(`[OK] Backup: ${backupRoot}`);

const verify = run(process.execPath, [abs(VERIFIER)]);

if (verify.status !== 0 || verify.error) {
  console.error(verify.stdout ?? "");
  console.error(verify.stderr ?? "");
  rollback();
  fail("Step 6.1.3 verifier failed and the patch was rolled back.", 2);
}

console.log(verify.stdout);
console.log("Running production build...");

const build =
  process.platform === "win32"
    ? run("cmd.exe", ["/d", "/s", "/c", "npm run build"])
    : run("npm", ["run", "build"]);

if (build.status !== 0 || build.error) {
  console.error(build.stdout ?? "");
  console.error(build.stderr ?? "");
  rollback();
  fail("Production build failed and Step 6.1.3 was rolled back.", 3);
}

console.log("[OK] Production build passed.");
console.log("");
console.log("Step 6.1.3 Consistency Scan UI installed successfully.");
