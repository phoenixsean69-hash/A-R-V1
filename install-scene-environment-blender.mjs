import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const replacementRoot = path.join(root, "roadsafe-scene-environment-blender-replacements");

if (!fs.existsSync(packagePath)) {
  console.error("package.json was not found. Run this from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (packageJson.name !== "roadsafe-ar") {
  console.error(`Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`);
  process.exit(1);
}

const files = [
  "src/components/reconstruction/SceneSettingsPanel.tsx",
  "src/components/reconstruction/SceneSettingsPanel.css",
];

for (const relativePath of files) {
  const replacement = path.join(replacementRoot, relativePath);
  if (!fs.existsSync(replacement)) {
    console.error(`Missing replacement: ${replacement}`);
    process.exit(1);
  }
}

const currentPanelPath = path.join(root, "src/components/reconstruction/SceneSettingsPanel.tsx");
if (!fs.existsSync(currentPanelPath)) {
  console.error("Current SceneSettingsPanel.tsx was not found.");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".roadsafe-ui-backup", timestamp);
const statePath = path.join(root, ".roadsafe-ui-backup", "last-scene-environment-blender.json");
const existedBefore = {};

for (const relativePath of files) {
  const source = path.join(root, relativePath);
  const exists = fs.existsSync(source);
  existedBefore[relativePath] = exists;
  if (!exists) continue;
  const backup = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(source, backup);
}

function restore() {
  for (const relativePath of files) {
    const destination = path.join(root, relativePath);
    const backup = path.join(backupRoot, relativePath);
    if (existedBefore[relativePath]) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(backup, destination);
      console.log(`RESTORED ${relativePath}`);
    } else if (fs.existsSync(destination)) {
      fs.rmSync(destination, { force: true });
      console.log(`REMOVED ${relativePath}`);
    }
  }
}

for (const relativePath of files) {
  const source = path.join(replacementRoot, relativePath);
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`WROTE ${relativePath}`);
}

try {
  execSync("npm run build", { cwd: root, stdio: "inherit", shell: true });
} catch {
  console.error("\nBuild failed. Restoring the previous Scene Environment files...");
  restore();
  process.exit(1);
}

fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(statePath, JSON.stringify({ backupRoot, files, existedBefore, installedAt: new Date().toISOString() }, null, 2), "utf8");

console.log(`
Scene Environment Blender replacement installed successfully.

Changed:
  src/components/reconstruction/SceneSettingsPanel.tsx
  src/components/reconstruction/SceneSettingsPanel.css

Start:
  npm run dev

Rollback:
  node revoke-scene-environment-blender.mjs
`);
