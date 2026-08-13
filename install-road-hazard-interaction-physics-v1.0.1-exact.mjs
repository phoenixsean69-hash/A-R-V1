import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const INSTALLER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(
  INSTALLER_DIR,
  "roadsafe-road-hazard-interaction-physics-v1.0.1-payload",
);

const EXPECTED = {
  "src/types/reconstruction.ts": "ae4864e4db03b4e28b3ff284d6cc1b6c3ea63007105c394e6bf69989ec653144",
  "src/services/reconstructionPhysicsService.ts": "fcc6683fb0d4aad2931f9ea2b59b40bb37b2b158b4f647d779542257da46c93a",
  "src/services/rapierDynamicsService.ts": "c720b9a78660897a044712e21d27e2ae0278e5fdf439f79672d2a68381542c7f",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "8e053c76a2d59dd8cba0680ede1a400bdaff7a1a981b8f2f15fe335c5e00cfdd"
};

const FILES = {
  "src/types/reconstruction.ts": "reconstruction.ts",
  "src/services/rapierDynamicsService.ts": "rapierDynamicsService.ts",
  "src/components/reconstruction/Reconstruction3DViewer.tsx": "Reconstruction3DViewer.tsx",
  "src/utils/reconstructionSceneObjectDynamics.ts": "reconstructionSceneObjectDynamics.ts",
  "scripts/verify-road-hazard-object-physics.mjs": "verify-road-hazard-object-physics.mjs"
};

const NEW_FILES = new Set([
  "src/utils/reconstructionSceneObjectDynamics.ts",
  "scripts/verify-road-hazard-object-physics.mjs",
]);

function absolute(rel) {
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

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
}

function runBuild() {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", "npm run build"]);
  }

  return run("npm", ["run", "build"]);
}

for (const [rel, expectedHash] of Object.entries(EXPECTED)) {
  const target = absolute(rel);

  if (!fs.existsSync(target)) {
    fail(`Could not find ${rel}. Run this installer from the A-R-V1 repository root.`);
  }

  const currentHash = sha256(target);

  if (currentHash !== expectedHash) {
    fail([
      `${rel} differs from the exact fresh local physics bundle used for Road Hazard Interaction Physics V1.0.1.`,
      "No files were changed.",
      "",
      `Expected SHA-256: ${expectedHash}`,
      `Current SHA-256:  ${currentHash}`,
      "",
      "Do not force this installer. Send the fresh local file if it changed after the bundle you uploaded.",
    ].join("\n"));
  }
}

for (const [rel, payloadName] of Object.entries(FILES)) {
  const payloadFile = path.join(PAYLOAD, payloadName);

  if (!fs.existsSync(payloadFile)) {
    fail(`Installer payload is missing ${payloadName}. Extract the whole ZIP before running it.`);
  }

  if (NEW_FILES.has(rel) && fs.existsSync(absolute(rel))) {
    fail([
      `${rel} already exists.`,
      "No files were changed.",
      "",
      "I will not overwrite an unverified local utility/verifier. Send that file if it already belongs to a newer local pass.",
    ].join("\n"));
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = `${ROOT}.roadsafe-backups`;
const backupDir = path.join(
  backupRoot,
  `road-hazard-interaction-physics-v1.0.1-${stamp}`,
);

const originals = new Map();

for (const rel of Object.keys(FILES)) {
  const target = absolute(rel);

  if (!fs.existsSync(target)) continue;

  const content = fs.readFileSync(target);
  originals.set(rel, content);

  const backup = path.join(backupDir, ...rel.split("/"));
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, content);
}

function rollback() {
  for (const rel of Object.keys(FILES)) {
    const target = absolute(rel);
    const previous = originals.get(rel);

    if (previous) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, previous);
    } else if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }
}

for (const [rel, payloadName] of Object.entries(FILES)) {
  const target = absolute(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(PAYLOAD, payloadName), target);
}

console.log("");
console.log("RoadSafe Road Hazard Interaction Physics V1.0.1 — EXACT LOCAL");
console.log("=========================================================");
console.log("[OK] Exact fresh local reconstruction/Rapier/viewer/forensic physics hashes matched.");
console.log("[FIX] DamageDerivationOptions now receives participantIdsWithRigidBodyContact: participantIdsWithDamageEligibleContact.");
console.log("[FIX] The filtered damage-eligible set is preserved, so lightweight Road Hazard contacts still cannot trigger normal crash-crush visualization.");
console.log("[OK] Road Hazards are no longer treated as decorative scene props only.");
console.log("[OK] Pothole is a true overlap hazard: speed loss, deterministic wheel/body jolt and lateral disturbance are applied to the Rapier participant body.");
console.log("[OK] Road Crack is a low-severity rough-surface interaction with a short jolt instead of a fake solid collision.");
console.log("[OK] Puddle reduces available braking/grip while occupied and adds restrained water-spray scene feedback.");
console.log("[OK] Oil Spill strongly reduces emergency-braking grip and introduces deterministic lateral slip/yaw while the participant remains on the oil.");
console.log("[OK] Loose Gravel reduces grip, extends braking response and creates restrained lateral drift/dust feedback.");
console.log("[OK] Bicycle and motorcycle hazard instability is stronger than car/bus/truck response; participant mass/visual scale are not conflated.");
console.log("[OK] Debris and Fallen Branch are real dynamic Rapier bodies with mass, friction, restitution, gravity, CCD and free 3-axis rotation.");
console.log("[OK] A participant can now push, throw, rotate and displace Debris/Fallen Branch instead of passing through a frozen prop.");
console.log("[OK] Dynamic Road Hazard impacts do not steal the primary crash damage/knockdown timing channel.");
console.log("[OK] Dynamic object trajectories are stored in lastPhysicsSimulation.sceneObjectDynamics for deterministic rewind/playback.");
console.log("[OK] Road Hazard interaction events are stored with participant/object/time/speed/intensity/contact position and effect parameters.");
console.log("[OK] Main 3D now replays dynamic object displacement/rotation from the Rapier samples.");
console.log("[OK] Main 3D now renders restrained pothole/crack dust, puddle spray, oil-slip pulse, gravel kick-up and dynamic-object contact feedback.");
console.log("[OK] Participant canonical X/Z trajectories include the real Rapier surface-slip/jolt consequences, so the altered approach is shared with 2D/3D/AR playback state.");
console.log("[OK] Existing RoadSafe forensic Physics V2 calculations remain the audit layer; reconstructionPhysicsService.ts was verified but not rewritten by this pass.");
console.log(`[OK] Backup: ${backupDir}`);

console.log("");
console.log("Verifying Rapier dynamic Road Hazard runtime...");

const verify = run(process.execPath, [
  absolute("scripts/verify-road-hazard-object-physics.mjs"),
]);

const verifyOutput = [verify.stdout ?? "", verify.stderr ?? ""]
  .filter(Boolean)
  .join("\n")
  .trim();

if (verify.error || verify.status !== 0) {
  console.error("");
  console.error("[RoadSafe] Road Hazard Rapier runtime verification failed.");

  if (verifyOutput) console.error(verifyOutput);

  console.error("");
  console.error("[RoadSafe] Rolling Road Hazard Interaction Physics V1.0.1 back automatically...");
  rollback();
  console.error("[RoadSafe] Rollback complete.");
  console.error(`[RoadSafe] Backup retained at: ${backupDir}`);
  process.exit(2);
}

if (verifyOutput) console.log(verifyOutput);
console.log("[OK] Dynamic Road Hazard runtime verification passed.");

console.log("");
console.log("Verifying production build...");

const build = runBuild();
const buildOutput = [build.stdout ?? "", build.stderr ?? ""]
  .filter(Boolean)
  .join("\n")
  .trim();

if (build.error || build.status !== 0) {
  console.error("");
  console.error("[RoadSafe] Production build failed.");

  if (buildOutput) console.error(buildOutput);

  console.error("");
  console.error("[RoadSafe] Rolling Road Hazard Interaction Physics V1.0.1 back automatically...");
  rollback();
  console.error("[RoadSafe] Rollback complete.");
  console.error(`[RoadSafe] Backup retained at: ${backupDir}`);
  process.exit(3);
}

console.log("[OK] Production build passed.");
console.log("");
console.log("Road Hazard Interaction Physics V1.0.1 is installed.");
console.log("Run: npm run dev");
console.log("");
console.log("IMPORTANT: re-run physics after placing/moving/changing a Road Hazard. Old bakes do not contain the new surface or dynamic-object interaction state.");
