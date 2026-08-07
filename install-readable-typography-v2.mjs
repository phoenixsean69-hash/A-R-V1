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

const verifyRelative =
  "scripts/verify-typography-consistency.mjs";

const payloadCss = path.join(
  root,
  "typographyConsistency-v2.css",
);

if (!fs.existsSync(payloadCss)) {
  console.error(
    "typographyConsistency-v2.css is missing beside the installer.",
  );
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  `typography-v2-${timestamp}`,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-readable-typography-v2.json",
);

const changedFiles = [];
const existedBefore = {};

function backup(relativePath) {
  if (relativePath in existedBefore) {
    return;
  }

  const target = path.join(root, relativePath);
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

  const target = path.join(root, relativePath);

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
 * Replace the old typography consistency layer if V1 is already present.
 */
backup(cssRelative);

fs.mkdirSync(
  path.dirname(
    path.join(root, cssRelative),
  ),
  { recursive: true },
);

fs.copyFileSync(
  payloadCss,
  path.join(root, cssRelative),
);

changedFiles.push(cssRelative);

console.log(
  `WROTE ${cssRelative}`,
);

/*
 * Make it the final CSS import.
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
 * Upgrade static Chart.js font sizes as well.
 * CSS cannot affect text rendered into canvas.
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
      continue;
    }

    if (
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

  next = next.replace(
    /font:\s*\{\s*size:\s*(8|9|10|11)\s*\}/g,
    "font: { size: 12 }",
  );

  next = next.replace(
    /font:\s*\{\s*size:\s*(8|9|10|11)\s*,/g,
    "font: { size: 12,",
  );

  if (next !== original) {
    write(
      relativePath,
      next,
    );

    console.log(
      `CHANGED ${relativePath} (canvas/chart typography)`,
    );
  }
}

/*
 * Verifier.
 */
const verifier = `import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const cssPath = path.join(
  root,
  "src/styles/typographyConsistency.css",
);

const mainPath = path.join(
  root,
  "src/main.tsx",
);

if (!fs.existsSync(cssPath)) {
  failures.push(
    "typographyConsistency.css is missing.",
  );
} else {
  const css = fs.readFileSync(
    cssPath,
    "utf8",
  );

  for (const required of [
    ".roadsafe-workstation",
    "--rs-type-micro: 12px",
    "--rs-type-meta: 13px",
    "--rs-type-control: 14px",
    "--rs-type-body: 14px",
    "--rs-type-panel: 16px",
    ".text-slate-600",
  ]) {
    if (!css.includes(required)) {
      failures.push(
        "Missing typography V2 rule: " +
          required,
      );
    }
  }
}

if (fs.existsSync(mainPath)) {
  const source = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cssImports = source
    .split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("import ") &&
        line.includes(".css"),
    );

  const expected =
    'import "./styles/typographyConsistency.css";';

  if (
    cssImports.filter(
      (line) => line === expected,
    ).length !== 1
  ) {
    failures.push(
      "typographyConsistency.css must be imported exactly once.",
    );
  }

  if (
    cssImports.at(-1) !== expected
  ) {
    failures.push(
      "typographyConsistency.css must be the final CSS import.",
    );
  }
}

console.log(
  "Typography V2 audit: actual RoadSafe workstation scope.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      "FAIL: " + failure,
    );
  }

  process.exit(1);
}

console.log(
  "PASS: readable typography is scoped to .roadsafe-workstation and imported last.",
);
`;

write(
  verifyRelative,
  verifier,
);

backup("package.json");

const nextPackage = JSON.parse(
  fs.readFileSync(
    packagePath,
    "utf8",
  ),
);

nextPackage.scripts =
  nextPackage.scripts ?? {};

nextPackage.scripts["typography:verify"] =
  "node scripts/verify-typography-consistency.mjs";

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(
    nextPackage,
    null,
    2,
  )}\n`,
  "utf8",
);

if (!changedFiles.includes("package.json")) {
  changedFiles.push("package.json");
}

function restoreAll() {
  console.log(
    "\nRestoring pre-V2 typography files...",
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
      if (!fs.existsSync(backupPath)) {
        continue;
      }

      fs.mkdirSync(
        path.dirname(target),
        { recursive: true },
      );

      fs.copyFileSync(
        backupPath,
        target,
      );

      console.log(
        `RESTORED ${relativePath}`,
      );
    } else if (fs.existsSync(target)) {
      fs.rmSync(
        target,
        { force: true },
      );

      console.log(
        `REMOVED ${relativePath}`,
      );
    }
  }
}

try {
  execSync(
    "node --check scripts/verify-typography-consistency.mjs",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );

  execSync(
    "npm run typography:verify",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );

  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  restoreAll();

  console.error(
    "\nReadable Typography V2 failed verification/build. All changes were restored.",
  );

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
Readable Typography V2 installed successfully.

Actual scale:
- minimum UI text: 12px
- metadata/helper text: 13px
- buttons/inputs/labels: 14px
- body: 14px
- section titles: 15px
- panel titles: 16px
- page headings: 21px
- large page headings: 25px

Muted slate text has also been brightened for charcoal backgrounds.

Start:
  npm run dev

Rollback:
  node revoke-readable-typography-v2.mjs
`);
