import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-blender-total-ui.json",
);

if (!fs.existsSync(statePath)) {
  console.error("No successful Total Blender UI installation record was found.");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

for (const relativePath of [...state.trackedPaths].reverse()) {
  const destinationPath = path.join(root, relativePath);
  const backupPath = path.join(state.backupRoot, relativePath);

  if (state.existedBefore[relativePath]) {
    if (!fs.existsSync(backupPath)) {
      console.error(`Backup file is missing: ${backupPath}`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(backupPath, destinationPath);
    console.log(`RESTORED ${relativePath}`);
  } else if (fs.existsSync(destinationPath)) {
    fs.rmSync(destinationPath, { force: true, recursive: true });
    console.log(`REMOVED ${relativePath}`);
  }
}

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(
    "The rollback files were restored, but another pre-existing build error remains.",
  );
  process.exit(1);
}

console.log("RoadSafe Total Blender UI migration has been revoked successfully.");
