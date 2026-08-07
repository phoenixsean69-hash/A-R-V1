import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const backupParent = path.join(root, ".roadsafe-ui-backup");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

if (!fs.existsSync(backupParent)) {
  console.error(
    "The .roadsafe-ui-backup directory was not found. Nothing can be restored automatically.",
  );
  process.exit(1);
}

const restoreTargets = [
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
  "src/main.tsx",
];

const generatedCss =
  "src/styles/reconstructionWorkstationV2.css";

const backupFolders = fs
  .readdirSync(backupParent, {
    withFileTypes: true,
  })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .reverse();

const matchingBackup = backupFolders.find(
  (folderName) => {
    const folder = path.join(
      backupParent,
      folderName,
    );

    return restoreTargets.some(
      (relativePath) =>
        fs.existsSync(
          path.join(folder, relativePath),
        ),
    );
  },
);

if (!matchingBackup) {
  console.error(
    "No reconstruction-workstation backup was found.",
  );
  process.exit(1);
}

const backupRoot = path.join(
  backupParent,
  matchingBackup,
);

console.log(
  `Restoring from .roadsafe-ui-backup\\${matchingBackup}`,
);

let restoredCount = 0;

for (const relativePath of restoreTargets) {
  const source = path.join(
    backupRoot,
    relativePath,
  );

  const destination = path.join(
    root,
    relativePath,
  );

  if (!fs.existsSync(source)) {
    console.log(
      `SKIPPED ${relativePath} — not changed by that installer`,
    );
    continue;
  }

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(
    source,
    destination,
  );

  restoredCount += 1;
  console.log(`RESTORED ${relativePath}`);
}

/*
 * The V2 stylesheet was newly created, so it usually has no backup copy.
 * Remove it explicitly.
 */
const generatedCssPath = path.join(
  root,
  generatedCss,
);

if (fs.existsSync(generatedCssPath)) {
  fs.rmSync(generatedCssPath, {
    force: true,
  });

  console.log(`REMOVED ${generatedCss}`);
}

/*
 * Safety cleanup in case main.tsx was not present in the matched backup.
 */
const mainPath = path.join(
  root,
  "src/main.tsx",
);

if (fs.existsSync(mainPath)) {
  const currentMain = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cleanedMain = currentMain
    .replace(
      /^\s*import\s+["']\.\/styles\/reconstructionWorkstationV2\.css["'];?\s*$/gm,
      "",
    )
    .replace(/\n{3,}/g, "\n\n");

  if (cleanedMain !== currentMain) {
    fs.writeFileSync(
      mainPath,
      cleanedMain,
      "utf8",
    );

    console.log(
      "REMOVED reconstructionWorkstationV2.css import from src/main.tsx",
    );
  }
}

if (restoredCount === 0) {
  console.error(
    "The matching backup did not contain any restorable reconstruction files.",
  );
  process.exit(1);
}

console.log(
  "\nReconstruction Workstation V2 has been revoked.",
);

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(`
The rollback completed, but the project build still has another error.

Do not rerun the reconstruction installer.
Paste the new build output so we can fix only the remaining issue.
`);
  process.exit(1);
}

console.log(`
Rollback successful.

Start the app with:
  npm run dev
`);
