import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  console.error(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const cssRelative =
  "src/styles/typographyConsistency.css";

const mainRelative =
  "src/main.tsx";

const payloadPath = path.join(
  root,
  "typographyConsistency-balanced.css",
);

if (!fs.existsSync(payloadPath)) {
  console.error(
    "typographyConsistency-balanced.css is missing beside the installer.",
  );
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  `typography-balanced-${timestamp}`,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-balanced-typography.json",
);

const changedFiles = [];
const existedBefore = {};

function backup(relativePath) {
  if (relativePath in existedBefore) return;

  const target = path.join(
    root,
    relativePath,
  );

  const exists = fs.existsSync(target);

  existedBefore[relativePath] = exists;

  if (!exists) return;

  const backupPath = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(backupPath),
    { recursive: true },
  );

  fs.copyFileSync(
    target,
    backupPath,
  );
}

function write(relativePath, content) {
  backup(relativePath);

  const target = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );

  if (!changedFiles.includes(relativePath)) {
    changedFiles.push(relativePath);
  }
}

/*
 * Replace whichever typography pass is currently installed.
 */
backup(cssRelative);

fs.mkdirSync(
  path.dirname(
    path.join(root, cssRelative),
  ),
  { recursive: true },
);

fs.copyFileSync(
  payloadPath,
  path.join(root, cssRelative),
);

changedFiles.push(cssRelative);

console.log(
  `WROTE ${cssRelative}`,
);

/*
 * Keep it last.
 */
const mainPath = path.join(
  root,
  mainRelative,
);

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const expectedImport =
  'import "./styles/typographyConsistency.css";';

const lines = mainSource
  .split(/\r?\n/)
  .filter(
    (line) =>
      !line.includes(
        './styles/typographyConsistency.css',
      ),
  );

let lastCssIndex = -1;

for (
  let index = 0;
  index < lines.length;
  index += 1
) {
  const trimmed =
    lines[index].trim();

  if (
    trimmed.startsWith("import ") &&
    trimmed.includes(".css")
  ) {
    lastCssIndex = index;
  }
}

if (lastCssIndex >= 0) {
  lines.splice(
    lastCssIndex + 1,
    0,
    expectedImport,
  );
} else {
  lines.unshift(expectedImport);
}

mainSource =
  `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;

write(
  mainRelative,
  mainSource,
);

console.log(
  `CHANGED ${mainRelative}`,
);

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
  console.log(
    "\nBuild failed. Restoring previous typography...",
  );

  for (
    const relativePath of changedFiles
  ) {
    const target = path.join(
      root,
      relativePath,
    );

    const backupPath = path.join(
      backupRoot,
      relativePath,
    );

    if (existedBefore[relativePath]) {
      fs.mkdirSync(
        path.dirname(target),
        { recursive: true },
      );

      fs.copyFileSync(
        backupPath,
        target,
      );
    } else if (fs.existsSync(target)) {
      fs.rmSync(
        target,
        { force: true },
      );
    }
  }

  process.exit(1);
}

fs.mkdirSync(
  path.dirname(statePath),
  { recursive: true },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      backupRoot,
      changedFiles,
      existedBefore,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Balanced typography installed successfully.

The large/small extremes now meet in the middle:

- micro: 11px
- metadata: 12px
- property labels: 12.5px
- controls/body: 13px
- section headings: 13.5px
- main panel/card titles: 15px
- subtitles: 16px
- page headings: 19px
- large page headings: 22px

Reconstruction-specific normalization:
- CASE SETUP / SCENE ENVIRONMENT reduced
- Site Configuration / Generated Road Geometry reduced
- right-inspector labels increased
- participant metadata increased
- inputs/selects kept at 13px
- slider labels/value readouts aligned

Start:
  npm run dev

Rollback:
  node revoke-balanced-typography.mjs
`);
