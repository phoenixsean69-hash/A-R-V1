import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(HERE, "roadsafe-node-v2-exact-payload");

const EXPECTED_SHA256 = {
  "src/types/reconstruction.ts": "eefd2e17a3c806bcca728ca6e9ec2b8b3fd315ffd37617d20cbde063d96f0612",
  "src/utils/reconstructionPhysicsFoundation.ts": "ec5955272afab42657a5685f06daf4ea04c397f2e207a483f7712a14cf63d16d",
  "src/services/reconstructionPhysicsService.ts": "57dc40906dbd453f26862985833900474a8f110951982b7a6d0f30a2b38b157c",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "ceb06a48d095b51d92ce1262d67f3c04995f8edb6c6ea8e7c58dc253afe717df",
  "src/components/reconstruction/ReconstructionBottomDock.tsx": "3ccc37f7b85f9909d722763c1100dab2092474496a81d97c592ad970ff551797",
  "src/components/reconstruction/ReconstructionNodeEditor.tsx": "7efdcdd430495e4b1bc7f7c0f4437a6b3a6f10da0941259f5bc9a5db6e126355",
  "src/components/reconstruction/reconstructionNodeEditorFunctional.css": "33a7d343de9ea8da221636492108289b5f0205a46306246bf528c9c5b7f8a627",
  "src/components/reconstruction/SceneObjectSettingsPanel.tsx": "483fc427a3414316f8d2390b24cb5af51925bf77ad23b000eef79f842e8cb663"
};
const REPLACEMENTS = {
  "src/types/reconstruction.ts": "reconstruction.ts",
  "src/utils/reconstructionPhysicsFoundation.ts": "reconstructionPhysicsFoundation.ts",
  "src/services/reconstructionPhysicsService.ts": "reconstructionPhysicsService.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx": "AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ReconstructionBottomDock.tsx": "ReconstructionBottomDock.tsx",
  "src/components/reconstruction/ReconstructionNodeEditor.tsx": "ReconstructionNodeEditor.tsx",
  "src/components/reconstruction/reconstructionNodeEditorFunctional.css": "reconstructionNodeEditorFunctional.css",
  "src/components/reconstruction/SceneObjectSettingsPanel.tsx": "SceneObjectSettingsPanel.tsx",
  "src/utils/reconstructionPhysicsDefaults.ts": "reconstructionPhysicsDefaults.ts",
  "src/components/reconstruction/ReconstructionPhysicsContextEditor.tsx": "ReconstructionPhysicsContextEditor.tsx",
  "src/components/reconstruction/reconstructionPhysicsContextEditor.css": "reconstructionPhysicsContextEditor.css"
};

function repoPath(rel) {
  return path.join(ROOT, ...rel.split("/"));
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

console.log("");
console.log("RoadSafe Computational Node + Physics V2 — EXACT LOCAL");
console.log("======================================================");

for (const [rel, expected] of Object.entries(EXPECTED_SHA256)) {
  const target = repoPath(rel);

  if (!fs.existsSync(target)) {
    fail(`Expected local file is missing: ${rel}. No files were changed.`);
  }

  const actual = sha256(target);

  if (actual !== expected) {
    console.error("");
    console.error(`[RoadSafe] Local file changed after the ZIP you uploaded: ${rel}`);
    console.error(`[RoadSafe] Expected SHA-256: ${expected}`);
    console.error(`[RoadSafe] Current  SHA-256: ${actual}`);
    fail("Safety check stopped the installer before changing anything. Export a fresh local ZIP if you changed the repo after uploading it.");
  }
}

for (const payloadName of Object.values(REPLACEMENTS)) {
  const source = path.join(PAYLOAD, payloadName);

  if (!fs.existsSync(source)) {
    fail(`Installer payload is incomplete: ${payloadName} is missing. Extract the entire ZIP before running it.`);
  }
}

console.log("[OK] Exact-local SHA-256 checks passed.");

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  ".roadsafe-backups",
  `computational-node-physics-v2-exact-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

const written = [];

function backupRelative(rel) {
  const source = repoPath(rel);

  if (!fs.existsSync(source)) return;

  const target = path.join(
    backupDir,
    ...rel.split("/"),
  );

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.copyFileSync(source, target);
}

function restoreBackup() {
  for (const rel of written) {
    const backup = path.join(
      backupDir,
      ...rel.split("/"),
    );

    const target = repoPath(rel);

    if (fs.existsSync(backup)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backup, target);
    } else if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  }
}

for (const rel of Object.keys(REPLACEMENTS)) {
  backupRelative(rel);
}

try {
  for (const [rel, payloadName] of Object.entries(REPLACEMENTS)) {
    const source = path.join(PAYLOAD, payloadName);
    const target = repoPath(rel);

    fs.mkdirSync(
      path.dirname(target),
      { recursive: true },
    );

    fs.copyFileSync(source, target);
    written.push(rel);
  }
} catch (error) {
  restoreBackup();
  fail(
    `Copy failed and files were restored: ${error instanceof Error ? error.message : String(error)}`,
    2,
  );
}

console.log("[OK] Installed exact full-file replacements.");
console.log(`[OK] Backup: ${backupDir}`);
console.log("");
console.log("Installed behavior:");
console.log("  • participant simulation speed + mass + body physics editable in Nodes");
console.log("  • the same participant physics editable in the right Physics context");
console.log("  • selected scene-object mass/contact physics editable in its context panel");
console.log("  • scene-object mass/contact physics editable in the Objects node");
console.log("  • global solver settings editable in the Physics node and context");
console.log("  • participant Speed in normal Motion Properties stays synced with solver speed");
console.log("  • physics-affecting edits invalidate the old bake");
console.log("  • Physics → Output becomes DIRTY until Run Physics");
console.log("  • scene-object effective mass participates in participant/object impulses");
console.log("  • typed analyst sockets reject incompatible link types");
console.log("");
console.log("Verifying production build...");

const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

const result = spawnSync(
  npmCommand,
  ["run", "build"],
  {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32",
  },
);

const output = [
  result.stdout ?? "",
  result.stderr ?? "",
]
  .filter(Boolean)
  .join("\n")
  .trim();

if (result.error || result.status !== 0) {
  console.error("");
  console.error("[RoadSafe] Production build failed.");
  if (output) {
    console.error("");
    console.error(output);
  }
  console.error("");
  console.error("[RoadSafe] Rolling the exact replacement back automatically...");

  restoreBackup();

  console.error("[RoadSafe] Rollback complete. Your pre-install local files were restored.");
  console.error(`[RoadSafe] Backup retained at: ${backupDir}`);
  process.exit(3);
}

console.log("[OK] Production build passed.");
console.log("");
console.log("Run:");
console.log("  npm run dev");
