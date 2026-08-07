import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(
  root,
  "package.json",
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-2d-shell-right-panel.json",
);

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this rollback from the RoadSafe repository root.",
  );
  process.exit(1);
}

if (!fs.existsSync(statePath)) {
  console.error(
    "No successful 2D shell-right-panel installation record was found.",
  );
  process.exit(1);
}

const state = JSON.parse(
  fs.readFileSync(statePath, "utf8"),
);

for (const relativePath of state.trackedPaths) {
  const destinationPath = path.join(
    root,
    relativePath,
  );

  const backupPath = path.join(
    state.backupRoot,
    relativePath,
  );

  if (state.existedBefore[relativePath]) {
    if (!fs.existsSync(backupPath)) {
      console.error(
        `Backup file is missing: ${backupPath}`,
      );
      process.exit(1);
    }

    fs.mkdirSync(
      path.dirname(destinationPath),
      { recursive: true },
    );

    fs.copyFileSync(
      backupPath,
      destinationPath,
    );

    console.log(
      `RESTORED ${relativePath}`,
    );

    continue;
  }

  if (fs.existsSync(destinationPath)) {
    fs.rmSync(
      destinationPath,
      { force: true },
    );

    console.log(
      `REMOVED ${relativePath}`,
    );
  }
}

try {
  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  console.error(
    "The rollback files were restored, but another existing project build error remains.",
  );
  process.exit(1);
}

console.log(
  "The RoadSafe 2D shell-right-panel restart has been revoked successfully.",
);
