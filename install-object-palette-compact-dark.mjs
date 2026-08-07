import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const replacementRoot = path.join(
  root,
  "roadsafe-object-palette-compact-dark-replacements",
);

if (!fs.existsSync(packagePath)) {
  console.error("Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

if (packageJson.name !== "roadsafe-ar") {
  console.error(`Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`);
  process.exit(1);
}

const files = [
  "src/components/reconstruction/SceneObjectPalette.tsx",
  "src/components/reconstruction/SceneObjectPalette.css",
];

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".roadsafe-ui-backup", timestamp);
const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-object-palette-compact-dark.json",
);
const existedBefore = {};

for (const relativePath of files) {
  const replacement = path.join(replacementRoot, relativePath);
  if (!fs.existsSync(replacement)) {
    console.error(`Missing replacement: ${replacement}`);
    process.exit(1);
  }

  const current = path.join(root, relativePath);
  const exists = fs.existsSync(current);
  existedBefore[relativePath] = exists;

  if (exists) {
    const backup = path.join(backupRoot, relativePath);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(current, backup);
  }
}

function restore() {
  for (const relativePath of files) {
    const target = path.join(root, relativePath);
    const backup = path.join(backupRoot, relativePath);

    if (existedBefore[relativePath]) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backup, target);
    } else if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  }
}

for (const relativePath of files) {
  const source = path.join(replacementRoot, relativePath);
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`WROTE ${relativePath}`);
}

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error("\\nBuild failed. Restoring previous object-palette files...");
  restore();
  process.exit(1);
}

fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(
  statePath,
  JSON.stringify(
    { backupRoot, files, existedBefore, installedAt: new Date().toISOString() },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Installed.

Wide: 3 equal columns
Medium: 2 columns
Narrow: 1 column
Theme: dark charcoal, no navy category surfaces.

Start:
  npm run dev

Rollback:
  node revoke-object-palette-compact-dark.mjs
`);
