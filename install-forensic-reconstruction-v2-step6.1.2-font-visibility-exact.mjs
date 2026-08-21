import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(HERE, "roadsafe-forensic-reconstruction-v2-step6.1.2-font-visibility-payload");

const CSS = "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css";
const VERIFIER = "scripts/verify-forensic-reconstruction-v2-step6.1.2-font-visibility.mjs";
const EXPECTED_CSS_BLOB = "78266effcc5267b22a2f62093880bf4a08207d2c";
const FILES = [CSS, VERIFIER];

const abs = (relative) => path.join(ROOT, ...relative.split("/"));
const payloadFile = (relative) => path.join(PAYLOAD, ...relative.split("/"));

function blob(content) {
  return crypto
    .createHash("sha1")
    .update(Buffer.from(`blob ${content.length}\0`, "utf8"))
    .update(content)
    .digest("hex");
}

function inspect(file) {
  const raw = fs.readFileSync(file);
  const normalised = Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
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

if (!fs.existsSync(abs(CSS))) {
  fail(`${CSS} is missing. No files were changed.`);
}

const current = inspect(abs(CSS));
if (current.raw !== EXPECTED_CSS_BLOB && current.normalised !== EXPECTED_CSS_BLOB) {
  fail([
    `${CSS} differs from the exact Step 6.1.1 Analysis Workstation state.`,
    "No files were changed.",
    "",
    `Expected canonical blob: ${EXPECTED_CSS_BLOB}`,
    `Current raw blob:        ${current.raw}`,
    `Current LF-normalised:   ${current.normalised}`,
    "",
    "Do not force this installer. Send the fresh local CSS file and I will adapt the readability patch to it.",
  ].join("\n"));
}

for (const relative of FILES) {
  if (!fs.existsSync(payloadFile(relative))) {
    fail(`Installer payload is incomplete: ${relative}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(ROOT, ".roadsafe-backups", `forensic-reconstruction-v2-step6.1.2-font-visibility-${stamp}`);
const originals = new Map();

for (const relative of FILES) {
  const target = abs(relative);
  const original = fs.existsSync(target) ? fs.readFileSync(target) : null;
  originals.set(relative, original);
  if (original) {
    const backup = path.join(backupRoot, ...relative.split("/"));
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, original);
  }
}

function rollback() {
  for (const relative of FILES) {
    const target = abs(relative);
    const original = originals.get(relative);
    if (original === null) fs.rmSync(target, { force: true });
    else {
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
console.log("RoadSafe Forensic Reconstruction V2 — STEP 6.1.2 FONT VISIBILITY");
console.log("==================================================================");
console.log("[OK] Exact Step 6.1.1 CSS source state matched.");
console.log("[OK] Reconstruction typography increased across all workflow sections.");
console.log("[OK] Inputs, labels, tables, buttons, sidebar and Analysis workstation enlarged.");
console.log("[OK] Existing neutral RoadSafe theme preserved.");
console.log(`[OK] Backup: ${backupRoot}`);

const verify = run(process.execPath, [abs(VERIFIER)]);
if (verify.status !== 0 || verify.error) {
  console.error(verify.stdout ?? "");
  console.error(verify.stderr ?? "");
  rollback();
  fail("Font visibility verifier failed and the patch was rolled back.", 2);
}
console.log(verify.stdout);

console.log("Running production build...");
const build = process.platform === "win32"
  ? run("cmd.exe", ["/d", "/s", "/c", "npm run build"])
  : run("npm", ["run", "build"]);

if (build.status !== 0 || build.error) {
  console.error(build.stdout ?? "");
  console.error(build.stderr ?? "");
  rollback();
  fail("Production build failed and the font patch was rolled back.", 3);
}

console.log("[OK] Production build passed.");
console.log("");
console.log("Step 6.1.2 Font Visibility installed successfully.");
