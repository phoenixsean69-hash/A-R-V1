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
  "typographyConsistency-medium.css",
);

if (!fs.existsSync(payloadPath)) {
  console.error(
    "typographyConsistency-medium.css is missing beside the installer.",
  );
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  `typography-medium-${timestamp}`,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-medium-typography.json",
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
 * Replace the existing typographyConsistency.css, whether V1 or V2.
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
 * Ensure it stays the final CSS import.
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
  const trimmed = lines[index].trim();

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

/*
 * Chart.js canvas fonts: reduce V2's 12px only where explicit chart font sizes
 * were upgraded from tiny values. Keep them at a readable 11px.
 */
function walk(directory) {
  const output = [];

  if (!fs.existsSync(directory)) {
    return output;
  }

  for (const entry of fs.readdirSync(
    directory,
    { withFileTypes: true },
  )) {
    const absolute = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      output.push(...walk(absolute));
    } else if (
      entry.isFile() &&
      /\.(?:ts|tsx|js|jsx)$/.test(entry.name)
    ) {
      output.push(absolute);
    }
  }

  return output;
}

for (
  const absolutePath of walk(
    path.join(root, "src"),
  )
) {
  const relativePath = path
    .relative(root, absolutePath)
    .replaceAll("\\", "/");

  const original = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  let next = original;

  /*
   * Do not reduce normal app text. Only Chart.js-style literal font objects
   * that currently say size: 12 are reduced to 11.
   */
  if (
    next.includes("ChartJS") ||
    next.includes("react-chartjs-2")
  ) {
    next = next.replace(
      /font:\s*\{\s*size:\s*12\s*\}/g,
      "font: { size: 11 }",
    );

    next = next.replace(
      /font:\s*\{\s*size:\s*12\s*,/g,
      "font: { size: 11,",
    );
  }

  if (next !== original) {
    write(
      relativePath,
      next,
    );

    console.log(
      `CHANGED ${relativePath} (chart font scale)`,
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
  console.log(
    "\nBuild failed. Restoring previous typography...",
  );

  for (const relativePath of changedFiles) {
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
Medium typography installed successfully.

Scale:
- micro: 11px
- metadata: 12px
- controls / labels: 13px
- body: 13px
- section headings: 14px
- panel headings: 15px
- subtitles: 16px
- page headings: 20px
- large page headings: 23px

Start:
  npm run dev

Rollback:
  node revoke-medium-typography.mjs
`);
