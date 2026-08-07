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

const relativeCss =
  "src/styles/typographyConsistency.css";

const relativeMain =
  "src/main.tsx";

const relativeVerifier =
  "scripts/verify-typography-consistency.mjs";

const files = [
  relativeCss,
  relativeMain,
  relativeVerifier,
  "package.json",
];

const payloadCss = path.join(
  root,
  "typographyConsistency.css",
);

if (!fs.existsSync(payloadCss)) {
  console.error(
    "typographyConsistency.css is missing beside this installer.",
  );
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  `typography-${timestamp}`,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-global-readable-typography.json",
);

const existedBefore = {};
const changedFiles = [];

function backup(relativePath) {
  if (relativePath in existedBefore) {
    return;
  }

  const target = path.join(
    root,
    relativePath,
  );

  const exists = fs.existsSync(target);

  existedBefore[relativePath] = exists;

  if (!exists) {
    return;
  }

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

backup(relativeCss);

fs.mkdirSync(
  path.dirname(
    path.join(root, relativeCss),
  ),
  { recursive: true },
);

fs.copyFileSync(
  payloadCss,
  path.join(root, relativeCss),
);

changedFiles.push(relativeCss);

console.log(
  `WROTE ${relativeCss}`,
);

/*
 * Import the typography consistency stylesheet after EVERY existing CSS
 * import, including mapWorkstation.css if that map pass is already installed.
 */
const mainPath = path.join(
  root,
  relativeMain,
);

if (!fs.existsSync(mainPath)) {
  console.error(
    "src/main.tsx was not found.",
  );
  process.exit(1);
}

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const typographyImport =
  'import "./styles/typographyConsistency.css";';

const mainLines = mainSource
  .split(/\r?\n/)
  .filter(
    (line) =>
      !line.includes(
        './styles/typographyConsistency.css',
      ),
  );

let lastCssImportIndex = -1;

for (
  let index = 0;
  index < mainLines.length;
  index += 1
) {
  const trimmed =
    mainLines[index].trim();

  if (
    trimmed.startsWith("import ") &&
    trimmed.includes(".css")
  ) {
    lastCssImportIndex = index;
  }
}

if (lastCssImportIndex >= 0) {
  mainLines.splice(
    lastCssImportIndex + 1,
    0,
    typographyImport,
  );
} else {
  mainLines.unshift(
    typographyImport,
  );
}

mainSource =
  `${mainLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;

write(
  relativeMain,
  mainSource,
);

console.log(
  `CHANGED ${relativeMain}`,
);

/*
 * Verifier:
 * - typography stylesheet must be final CSS import
 * - no arbitrary Tailwind text utility below 10px may escape the final guard
 * - canonical CSS variables must exist
 */
const verifier = `import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const mainPath = path.join(
  root,
  "src/main.tsx",
);

const cssPath = path.join(
  root,
  "src/styles/typographyConsistency.css",
);

if (!fs.existsSync(cssPath)) {
  failures.push(
    "typographyConsistency.css is missing.",
  );
}

if (fs.existsSync(mainPath)) {
  const source = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cssImports =
    source
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

if (fs.existsSync(cssPath)) {
  const source = fs.readFileSync(
    cssPath,
    "utf8",
  );

  for (const token of [
    "--roadsafe-type-micro: 11px",
    "--roadsafe-type-meta: 12px",
    "--roadsafe-type-control: 13px",
    "--roadsafe-type-body: 14px",
    "--roadsafe-type-panel: 15px",
    "--roadsafe-type-page: 20px",
  ]) {
    if (!source.includes(token)) {
      failures.push(
        "Missing canonical typography token: " +
          token,
      );
    }
  }
}

console.log(
  "Typography audit: canonical readable scale.",
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
  "PASS: Global typography consistency layer is installed last.",
);
`;

write(
  relativeVerifier,
  verifier,
);

console.log(
  `WROTE ${relativeVerifier}`,
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

console.log(
  "CHANGED package.json",
);

function restoreAll() {
  console.log(
    "\nRestoring pre-typography files...",
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
    "\nGlobal typography installation failed. All changes were restored.",
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
Global readable typography installed successfully.

Canonical scale:
- micro / smallest metadata: 11px
- metadata / helper text: 12px
- buttons / inputs / labels: 13px
- normal body text: 14px
- section titles: 14px
- panel titles: 15px
- subtitles: 16px
- page headings: 20px
- large page headings: 24px

The typography stylesheet is imported LAST so later component CSS cannot
shrink the interface again.

Verify:
  npm run typography:verify

Start:
  npm run dev

Rollback:
  node revoke-global-readable-typography.mjs
`);
