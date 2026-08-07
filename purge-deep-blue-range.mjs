import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this script from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

let packageJson;

try {
  packageJson = JSON.parse(
    fs.readFileSync(packagePath, "utf8"),
  );
} catch (error) {
  console.error("Could not read package.json:", error);
  process.exit(1);
}

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe repo (roadsafe-ar), but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const ROLLBACK = process.argv.includes("--rollback");

if (ROLLBACK) {
  const statePath = path.join(
    root,
    ".roadsafe-ui-backup",
    "last-deep-blue-range-purge.json",
  );

  if (!fs.existsSync(statePath)) {
    console.error(
      "No successful deep-blue range purge record was found.",
    );
    process.exit(1);
  }

  const state = JSON.parse(
    fs.readFileSync(statePath, "utf8"),
  );

  for (const relativePath of state.changedFiles) {
    const backupPath = path.join(
      state.backupRoot,
      relativePath,
    );

    const destinationPath = path.join(
      root,
      relativePath,
    );

    if (!fs.existsSync(backupPath)) {
      console.error(
        `Missing backup: ${backupPath}`,
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
  }

  console.log(
    "Deep-blue range purge rolled back successfully.",
  );

  process.exit(0);
}
const SHOW_ALL = process.argv.includes("--show-all");

const sourceRoots = [
  path.join(root, "src"),
  path.join(root, "index.html"),
];

const allowedExtensions = new Set([
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".html",
]);

const ignoredDirectoryNames = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".roadsafe-ui-backup",
  ".roadsafe-ui-audit",
  "payload",
  "replacements",
]);

const ignoredDirectorySuffixes = [
  "-replacements",
  "-backup",
  "-backups",
];

/*
 * Deep-blue detector.
 *
 * Intended family:
 *   #050C1A
 *   #061020
 *   #071326
 *   #07142A
 *   #0B1B38
 *   #10182D
 *   etc.
 *
 * It deliberately does NOT match normal grays because blue must be
 * substantially stronger than red and green.
 */
const DEEP_BLUE_RANGE = {
  maxRed: 36,
  maxGreen: 58,
  minBlue: 16,
  maxBlue: 100,
  minBlueOverRed: 8,
  minBlueOverGreen: 4,
};

const exactGrayOverrides = new Map([
  ["050c1a", "202020"],
  ["061020", "292929"],
  ["07101d", "202020"],
  ["071326", "292929"],
  ["07142a", "292929"],
  ["0b1b38", "303030"],
  ["10182d", "383838"],
]);

function isIgnoredDirectory(name) {
  if (ignoredDirectoryNames.has(name)) {
    return true;
  }

  return ignoredDirectorySuffixes.some(
    (suffix) => name.endsWith(suffix),
  );
}

function walk(target) {
  if (!fs.existsSync(target)) {
    return [];
  }

  const stat = fs.statSync(target);

  if (stat.isFile()) {
    return [target];
  }

  const output = [];

  for (const entry of fs.readdirSync(
    target,
    { withFileTypes: true },
  )) {
    if (
      entry.isDirectory() &&
      isIgnoredDirectory(entry.name)
    ) {
      continue;
    }

    const absolutePath = path.join(
      target,
      entry.name,
    );

    if (entry.isDirectory()) {
      output.push(...walk(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      allowedExtensions.has(
        path.extname(entry.name).toLowerCase(),
      )
    ) {
      output.push(absolutePath);
    }
  }

  return output;
}

function parseHex6(hex) {
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function isDeepBlue(hex) {
  const { r, g, b } = parseHex6(hex);

  return (
    r <= DEEP_BLUE_RANGE.maxRed &&
    g <= DEEP_BLUE_RANGE.maxGreen &&
    b >= DEEP_BLUE_RANGE.minBlue &&
    b <= DEEP_BLUE_RANGE.maxBlue &&
    b - r >= DEEP_BLUE_RANGE.minBlueOverRed &&
    b - g >= DEEP_BLUE_RANGE.minBlueOverGreen
  );
}

/*
 * Blender gray tier mapping.
 *
 * Very deep navy  -> recessed workspace #202020
 * Deep navy       -> panel             #292929
 * Raised navy     -> section           #303030
 * Brighter navy   -> raised control    #383838
 */
function grayForDeepBlue(hex) {
  const normalized = hex.toLowerCase();

  if (exactGrayOverrides.has(normalized)) {
    return exactGrayOverrides.get(normalized);
  }

  const { r, g, b } = parseHex6(normalized);

  const luminance =
    0.2126 * r +
    0.7152 * g +
    0.0722 * b;

  if (
    b <= 30 ||
    luminance <= 13
  ) {
    return "202020";
  }

  if (
    b <= 43 ||
    luminance <= 20
  ) {
    return "292929";
  }

  if (
    b <= 64 ||
    luminance <= 29
  ) {
    return "303030";
  }

  return "383838";
}

const cssHexPattern =
  /#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?\b/g;

const jsHexPattern =
  /\b0x([0-9a-fA-F]{6})\b/g;

const candidateFiles = Array.from(
  new Set(
    sourceRoots.flatMap((sourceRoot) =>
      walk(sourceRoot),
    ),
  ),
);

const changes = [];
const uniqueMappings = new Map();
let scannedColours = 0;

function replaceCssHexes(
  source,
  relativePath,
) {
  return source.replace(
    cssHexPattern,
    (
      fullMatch,
      hex,
      alpha = "",
      offset,
    ) => {
      scannedColours += 1;

      if (!isDeepBlue(hex)) {
        return fullMatch;
      }

      const replacementHex =
        grayForDeepBlue(hex);

      const oldValue =
        `#${hex}${alpha}`;

      const newValue =
        `#${replacementHex}${alpha}`;

      changes.push({
        file: relativePath,
        offset,
        oldValue,
        newValue,
        rgb: parseHex6(hex),
        kind: "css-hex",
      });

      uniqueMappings.set(
        `#${hex.toUpperCase()}`,
        `#${replacementHex.toUpperCase()}`,
      );

      return newValue;
    },
  );
}

function replaceJsHexes(
  source,
  relativePath,
) {
  return source.replace(
    jsHexPattern,
    (
      fullMatch,
      hex,
      offset,
    ) => {
      scannedColours += 1;

      if (!isDeepBlue(hex)) {
        return fullMatch;
      }

      const replacementHex =
        grayForDeepBlue(hex);

      const oldValue =
        `0x${hex}`;

      const newValue =
        `0x${replacementHex}`;

      changes.push({
        file: relativePath,
        offset,
        oldValue,
        newValue,
        rgb: parseHex6(hex),
        kind: "js-hex",
      });

      uniqueMappings.set(
        `0x${hex.toUpperCase()}`,
        `0x${replacementHex.toUpperCase()}`,
      );

      return newValue;
    },
  );
}

const rewrittenFiles = new Map();

for (const absolutePath of candidateFiles) {
  const relativePath = path
    .relative(root, absolutePath)
    .replaceAll("\\", "/");

  const original = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  let next = replaceCssHexes(
    original,
    relativePath,
  );

  next = replaceJsHexes(
    next,
    relativePath,
  );

  if (next !== original) {
    rewrittenFiles.set(
      relativePath,
      next,
    );
  }
}

const reportDirectory = path.join(
  root,
  ".roadsafe-ui-audit",
);

fs.mkdirSync(
  reportDirectory,
  { recursive: true },
);

const reportPath = path.join(
  reportDirectory,
  "deep-blue-range-report.json",
);

const report = {
  mode: APPLY ? "apply" : "dry-run",
  generatedAt: new Date().toISOString(),
  range: DEEP_BLUE_RANGE,
  filesScanned: candidateFiles.length,
  coloursScanned: scannedColours,
  filesWithDeepBlue: rewrittenFiles.size,
  replacements: changes.length,
  mappings: Object.fromEntries(
    Array.from(uniqueMappings.entries()).sort(),
  ),
  changes,
};

fs.writeFileSync(
  reportPath,
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

console.log("");
console.log("RoadSafe deep-blue range audit");
console.log("------------------------------");
console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
console.log(`Files scanned: ${candidateFiles.length}`);
console.log(`Hex colours scanned: ${scannedColours}`);
console.log(`Files containing deep blue: ${rewrittenFiles.size}`);
console.log(`Deep-blue replacements: ${changes.length}`);
console.log("");

if (uniqueMappings.size > 0) {
  console.log("Detected mappings:");

  for (const [from, to] of Array.from(
    uniqueMappings.entries(),
  ).sort()) {
    console.log(`  ${from}  ->  ${to}`);
  }

  console.log("");
}

if (
  SHOW_ALL &&
  changes.length > 0
) {
  console.log("All matches:");

  for (const item of changes) {
    console.log(
      `  ${item.file}: ${item.oldValue} -> ${item.newValue}`,
    );
  }

  console.log("");
}

console.log(
  `Report: ${path.relative(root, reportPath)}`,
);

if (!APPLY) {
  console.log("");
  console.log(
    "No files were changed. Review the report, then apply with:",
  );
  console.log(
    "  node purge-deep-blue-range.mjs --apply",
  );
  process.exit(0);
}

if (rewrittenFiles.size === 0) {
  console.log("");
  console.log(
    "No matching deep-blue colours were found. Nothing to change.",
  );
  process.exit(0);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  `deep-blue-purge-${timestamp}`,
);

for (const [
  relativePath,
  nextSource,
] of rewrittenFiles.entries()) {
  const sourcePath = path.join(
    root,
    relativePath,
  );

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

  fs.writeFileSync(
    sourcePath,
    nextSource,
    "utf8",
  );

  console.log(
    `CHANGED ${relativePath}`,
  );
}

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-deep-blue-range-purge.json",
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      backupRoot,
      changedFiles: Array.from(
        rewrittenFiles.keys(),
      ),
    },
    null,
    2,
  ),
  "utf8",
);

console.log("");
console.log(
  `Backups: ${path.relative(root, backupRoot)}`,
);
console.log(
  "Deep-blue range purge applied.",
);
console.log("");
console.log(
  "Recommended verification:",
);
console.log(
  "  npm run ui:verify",
);
console.log(
  "  npm run build",
);
console.log("");
console.log(
  "Rollback:",
);
console.log(
  "  node purge-deep-blue-range.mjs --rollback",
);
