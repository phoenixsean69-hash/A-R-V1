import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const srcRoot = path.join(root, "src");
const payloadRoot = path.join(root, "payload");

if (!fs.existsSync(packagePath) || !fs.existsSync(srcRoot)) {
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

for (const required of [
  "payload/scripts/verify-blender-ui.mjs",
  "payload/src/styles/blenderColorGuard.css",
]) {
  if (!fs.existsSync(path.join(root, required))) {
    console.error(`Missing installer payload: ${required}`);
    process.exit(1);
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-blender-color-purge-v2.json",
);

const existedBefore = {};
const changedFiles = [];

function walk(directory) {
  const output = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      output.push(...walk(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(?:css|tsx|jsx)$/.test(entry.name)
    ) {
      output.push(absolutePath);
    }
  }

  return output;
}

function backup(relativePath) {
  if (relativePath in existedBefore) {
    return;
  }

  const sourcePath = path.join(root, relativePath);
  const exists = fs.existsSync(sourcePath);

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
    sourcePath,
    backupPath,
  );
}

function write(relativePath, content) {
  backup(relativePath);

  const targetPath = path.join(
    root,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(targetPath),
    { recursive: true },
  );

  fs.writeFileSync(
    targetPath,
    content,
    "utf8",
  );

  if (!changedFiles.includes(relativePath)) {
    changedFiles.push(relativePath);
  }
}

function copyPayload(payloadRelativePath, destinationRelativePath) {
  const sourcePath = path.join(
    root,
    payloadRelativePath,
  );

  backup(destinationRelativePath);

  const destinationPath = path.join(
    root,
    destinationRelativePath,
  );

  fs.mkdirSync(
    path.dirname(destinationPath),
    { recursive: true },
  );

  fs.copyFileSync(
    sourcePath,
    destinationPath,
  );

  if (!changedFiles.includes(destinationRelativePath)) {
    changedFiles.push(destinationRelativePath);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceInsensitive(source, from, to) {
  return source.replace(
    new RegExp(escapeRegExp(from), "gi"),
    to,
  );
}

const palette = new Map([
  ["#050817", "#1b1b1b"],
  ["#050914", "#202020"],
  ["#060b17", "#242424"],
  ["#050b17", "#202020"],
  ["#090f20", "#292929"],
  ["#0b111c", "#303030"],
  ["#0d1420", "#303030"],
  ["#10141b", "#303030"],
  ["#111722", "#383838"],
  ["#020611", "#1b1b1b"],
  ["#02050c", "#181818"],
  ["#030711", "#181818"],
  ["#030714", "#1b1b1b"],
  ["#040918", "#202020"],
  ["#040a16", "#292929"],
  ["#050a16", "#202020"],
  ["#070b13", "#181818"],
  ["#070d1a", "#202020"],
  ["#07101d", "#202020"],
  ["#071124", "#383838"],
  ["#071326", "#292929"],
  ["#07142a", "#303030"],
  ["#080e1c", "#202020"],
  ["#0a1223", "#292929"],
  ["#0a1830", "#414141"],
  ["#0b1122", "#202020"],
  ["#0b1b38", "#303030"],
  ["#0c1426", "#292929"],
  ["#0c1730", "#292929"],
  ["#0d1529", "#252525"],
  ["#0e1930", "#292929"],
  ["#10182d", "#383838"],
  ["#102a36", "#303030"],
  ["#102a53", "#35312e"],
  ["#111b35", "#383838"],
  ["#112241", "#303030"],
  ["#123d7e", "#39332f"],
  ["#143565", "#39332f"],
  ["#152445", "#414141"],
  ["#163a73", "#39332f"],
  ["#173c78", "#39332f"],
  ["#1b4789", "#46413d"],
  ["#1c4789", "#46413d"],
  ["#162f52", "#494949"],
  ["#172944", "#171717"],
  ["#172a48", "#171717"],
  ["#18243f", "#171717"],
  ["#182849", "#171717"],
  ["#1a2942", "#171717"],
  ["#1a2946", "#3c3c3c"],
  ["#1b3153", "#494949"],
  ["#1d2c4b", "#494949"],
  ["#1d3153", "#494949"],
  ["#203554", "#555555"],
  ["#203f67", "#5c5c5c"],
  ["#223656", "#555555"],
  ["#22385d", "#555555"],
  ["#294261", "#494949"],
  ["#29446f", "#494949"],
  ["#294567", "#494949"],
  ["#29496f", "#5c5c5c"],
  ["#29548d", "#5c5c5c"],
  ["#315b91", "#5c5c5c"],
  ["#315d9d", "#e8872d"],
  ["#315f9e", "#e8872d"],
  ["#345374", "#e8872d"],
  ["#3d6da9", "#e8872d"],
  ["#3f6daa", "#e8872d"],
  ["#365d86", "#e8872d"],
  ["#536178", "#6f6f6f"],
  ["#6b98e0", "#c4c4c4"],
  ["#79b8d0", "#c4c4c4"],
  ["#7e8ba0", "#969696"],
  ["#80acff", "#e8872d"],
  ["#8594aa", "#969696"],
  ["#8bb9fa", "#c4c4c4"],
  ["#8ebcff", "#c4c4c4"],
  ["#aab8cc", "#c4c4c4"],
  ["#b9c7db", "#c4c4c4"],
  ["#bcc8d8", "#c4c4c4"],
  ["#c1ccdc", "#c4c4c4"],
  ["#cbd5e1", "#cfcfcf"],
  ["#d7deeb", "#dedede"],
  ["#d9e7fb", "#dedede"],
  ["#dbe4f0", "#dedede"],
  ["#dce7f7", "#dedede"],
  ["#edf4ff", "#ffffff"],
  ["#eef3fb", "#eeeeee"],
]);

const runtimePalette = new Map([
  ["0x07101d", "0x202020"],
  ["0x050a16", "0x202020"],
  ["0x071326", "0x292929"],
  ["0x030711", "0x181818"],
  ["0x020611", "0x1b1b1b"],
]);

const rgbaPalette = new Map([
  ["rgba(61,109,169,.18)", "rgba(232,135,45,.18)"],
  ["rgba(61, 109, 169, .18)", "rgba(232, 135, 45, .18)"],
  ["rgba(4,9,24,.97)", "rgba(41,41,41,.97)"],
  ["rgba(4, 9, 24, .97)", "rgba(41, 41, 41, .97)"],
  ["rgba(4,10,23,.93)", "rgba(41,41,41,.93)"],
  ["rgba(4, 10, 23, .93)", "rgba(41, 41, 41, .93)"],
  ["rgba(5,12,26,.95)", "rgba(41,41,41,.95)"],
  ["rgba(5, 12, 26, .95)", "rgba(41, 41, 41, .95)"],
  ["rgba(5,10,22,.88)", "rgba(32,32,32,.88)"],
  ["rgba(5, 10, 22, .88)", "rgba(32, 32, 32, .88)"],
  ["rgba(8,17,34,.98)", "rgba(41,41,41,.98)"],
  ["rgba(8, 17, 34, .98)", "rgba(41, 41, 41, .98)"],
  ["rgba(5,12,25,.98)", "rgba(32,32,32,.98)"],
  ["rgba(5, 12, 25, .98)", "rgba(32, 32, 32, .98)"],
]);

const coolUtilityPattern =
  /\b((?:[a-z0-9-]+:)*)(bg|text|border|ring|outline|divide|fill|stroke|accent|from|via|to)-(blue|indigo|sky|cyan|purple|violet)-(\d{2,3})(?:\/(\d+))?/gi;

function neutralUtility(
  _full,
  prefixes = "",
  property = "bg",
) {
  if (property === "bg") {
    return `${prefixes}bg-[#303030]`;
  }

  if (
    property === "text" ||
    property === "fill" ||
    property === "stroke"
  ) {
    return `${prefixes}${property}-[#c4c4c4]`;
  }

  if (
    property === "border" ||
    property === "divide" ||
    property === "outline"
  ) {
    return `${prefixes}${property}-[#494949]`;
  }

  if (
    property === "ring" ||
    property === "accent"
  ) {
    return `${prefixes}${property}-[#e8872d]`;
  }

  if (property === "from") {
    return `${prefixes}from-[#383838]`;
  }

  if (property === "via") {
    return `${prefixes}via-[#303030]`;
  }

  if (property === "to") {
    return `${prefixes}to-[#292929]`;
  }

  return `${prefixes}${property}-[#303030]`;
}

let replacementCount = 0;

for (const absolutePath of walk(srcRoot)) {
  const relativePath = path
    .relative(root, absolutePath)
    .replaceAll("\\", "/");

  const original = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  let next = original;

  for (const [from, to] of palette) {
    const before = next;
    next = replaceInsensitive(next, from, to);

    if (next !== before) {
      replacementCount += 1;
    }
  }

  for (const [from, to] of runtimePalette) {
    const before = next;
    next = replaceInsensitive(next, from, to);

    if (next !== before) {
      replacementCount += 1;
    }
  }

  for (const [from, to] of rgbaPalette) {
    const before = next;
    next = replaceInsensitive(next, from, to);

    if (next !== before) {
      replacementCount += 1;
    }
  }

  if (/\.(tsx|jsx)$/.test(relativePath)) {
    const before = next;

    next = next.replace(
      coolUtilityPattern,
      neutralUtility,
    );

    if (next !== before) {
      replacementCount += 1;
    }
  }

  if (next !== original) {
    write(relativePath, next);
  }
}

copyPayload(
  "payload/scripts/verify-blender-ui.mjs",
  "scripts/verify-blender-ui.mjs",
);

copyPayload(
  "payload/src/styles/blenderColorGuard.css",
  "src/styles/blenderColorGuard.css",
);

/*
 * Import guard last.
 */
let mainSource = fs.readFileSync(
  path.join(root, "src/main.tsx"),
  "utf8",
);

const guardImport =
  'import "./styles/blenderColorGuard.css";';

mainSource = mainSource
  .replace(
    /^\s*import\s+["']\.\/styles\/blenderColorGuard\.css["'];?\s*$/gm,
    "",
  )
  .replace(/\n{3,}/g, "\n\n");

const cssImports = mainSource.match(
  /^import\s+["'][^"']+\.css["'];?$/gm,
) ?? [];

if (cssImports.length > 0) {
  const lastImport =
    cssImports[cssImports.length - 1];

  mainSource = mainSource.replace(
    lastImport,
    `${lastImport}\n${guardImport}`,
  );
} else {
  mainSource =
    `${guardImport}\n${mainSource}`;
}

write("src/main.tsx", mainSource);

/*
 * Ensure ui:verify is correct.
 */
backup("package.json");

const nextPackageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

nextPackageJson.scripts =
  nextPackageJson.scripts ?? {};

nextPackageJson.scripts["ui:verify"] =
  "node scripts/verify-blender-ui.mjs";

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(nextPackageJson, null, 2)}\n`,
  "utf8",
);

if (!changedFiles.includes("package.json")) {
  changedFiles.push("package.json");
}

/*
 * Validate the verifier syntax BEFORE running it.
 */
try {
  execSync(
    "node --check scripts/verify-blender-ui.mjs",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  console.error(
    "\nVerifier syntax validation failed before audit.",
  );
  restoreAndExit();
}

function restoreAll() {
  console.log(
    "\nRestoring pre-purge files...",
  );

  for (const relativePath of changedFiles) {
    const targetPath = path.join(
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
        path.dirname(targetPath),
        { recursive: true },
      );

      fs.copyFileSync(
        backupPath,
        targetPath,
      );

      console.log(
        `RESTORED ${relativePath}`,
      );
    } else if (fs.existsSync(targetPath)) {
      fs.rmSync(
        targetPath,
        { force: true },
      );

      console.log(
        `REMOVED ${relativePath}`,
      );
    }
  }
}

function restoreAndExit() {
  restoreAll();
  process.exit(1);
}

try {
  execSync(
    "npm run ui:verify",
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
    "\nBlender color purge V2 failed verification/build. All changes were restored.",
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
      replacementCount,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Blender color purge V2 complete.

Changed files:
  ${changedFiles.length}

Replacement groups applied:
  ${replacementCount}

The verifier passed syntax validation, UI audit and production build.

Start:
  npm run dev

Audit:
  npm run ui:verify

Report:
  Get-Content .\\.roadsafe-ui-audit\\blender-color-audit.json

Rollback:
  node revoke-blender-color-purge-v2.mjs
`);
