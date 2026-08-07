import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const failures = [];
const matches = [];

function walk(directory) {
  const output = [];

  if (!fs.existsSync(directory)) {
    return output;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      output.push(...walk(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(?:ts|tsx|js|jsx|css)$/.test(entry.name)
    ) {
      output.push(absolutePath);
    }
  }

  return output;
}

/*
 * Known legacy RoadSafe UI chrome colours.
 * Participant data colours such as #2563eb are intentionally excluded.
 */
const forbiddenHexes = [
  "#050817",
  "#050914",
  "#060b17",
  "#050b17",
  "#090f20",
  "#0b111c",
  "#0d1420",
  "#10141b",
  "#111722",
  "#020611",
  "#02050c",
  "#030711",
  "#030714",
  "#040918",
  "#040a16",
  "#050a16",
  "#070b13",
  "#070d1a",
  "#07101d",
  "#071124",
  "#071326",
  "#07142a",
  "#080e1c",
  "#0a1223",
  "#0a1830",
  "#0b1122",
  "#0b1b38",
  "#0c1426",
  "#0c1730",
  "#0d1529",
  "#0e1930",
  "#10182d",
  "#102a36",
  "#102a53",
  "#111b35",
  "#112241",
  "#123d7e",
  "#143565",
  "#152445",
  "#163a73",
  "#173c78",
  "#1b4789",
  "#1c4789",
  "#162f52",
  "#172944",
  "#172a48",
  "#18243f",
  "#182849",
  "#1a2942",
  "#1a2946",
  "#1b3153",
  "#1d2c4b",
  "#1d3153",
  "#203554",
  "#203f67",
  "#223656",
  "#22385d",
  "#294261",
  "#29446f",
  "#294567",
  "#29496f",
  "#29548d",
  "#315b91",
  "#315d9d",
  "#315f9e",
  "#345374",
  "#365d86",
  "#3d6da9",
  "#3f6daa",
  "#536178",
  "#6b98e0",
  "#79b8d0",
  "#7e8ba0",
  "#80acff",
  "#8594aa",
  "#8bb9fa",
  "#8ebcff",
  "#aab8cc",
  "#b9c7db",
  "#bcc8d8",
  "#c1ccdc",
  "#cbd5e1",
  "#d7deeb",
  "#d9e7fb",
  "#dbe4f0",
  "#dce7f7",
  "#edf4ff",
  "#eef3fb",
];

const forbiddenRuntimeColours = [
  "0x07101d",
  "0x050a16",
  "0x071326",
  "0x030711",
  "0x020611",
];

const coolUtilityPattern =
  /\b(?:[a-z0-9-]+:)*(?:bg|text|border|ring|outline|divide|fill|stroke|accent|from|via|to)-(?:blue|indigo|sky|cyan|purple|violet)-\d{2,3}(?:\/\d+)?/gi;

const sourceFiles = walk(srcRoot);
let linesScanned = 0;

for (const absolutePath of sourceFiles) {
  const relativePath = path
    .relative(root, absolutePath)
    .replaceAll("\\", "/");

  const source = fs.readFileSync(absolutePath, "utf8");
  const lines = source.split(/\r?\n/);

  linesScanned += lines.length;

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();

    for (const value of forbiddenHexes) {
      if (lowerLine.includes(value)) {
        matches.push({
          file: relativePath,
          line: index + 1,
          value,
          kind: "legacy-ui-hex",
          text: line.trim().slice(0, 180),
        });
      }
    }

    for (const value of forbiddenRuntimeColours) {
      if (lowerLine.includes(value)) {
        matches.push({
          file: relativePath,
          line: index + 1,
          value,
          kind: "legacy-runtime-navy",
          text: line.trim().slice(0, 180),
        });
      }
    }

    const utilityMatches = line.match(coolUtilityPattern) ?? [];

    for (const value of utilityMatches) {
      matches.push({
        file: relativePath,
        line: index + 1,
        value,
        kind: "legacy-cool-utility",
        text: line.trim().slice(0, 180),
      });
    }
  });
}

const mainPath = path.join(root, "src/main.tsx");

if (!fs.existsSync(mainPath)) {
  failures.push("src/main.tsx is missing.");
} else {
  const mainSource = fs.readFileSync(mainPath, "utf8");

  const cssImports = Array.from(
    mainSource.matchAll(
      /^import\s+["']([^"']+\.css)["'];?$/gm,
    ),
    (match) => match[1],
  );

  if (cssImports.at(-1) !== "./styles/blenderColorGuard.css") {
    failures.push(
      "src/styles/blenderColorGuard.css must be the final CSS import in src/main.tsx.",
    );
  }
}

if (matches.length > 0) {
  failures.push(
    `${matches.length} legacy deep-blue/cool UI trace(s) remain.`,
  );
}

const reportDirectory = path.join(
  root,
  ".roadsafe-ui-audit",
);

fs.mkdirSync(reportDirectory, {
  recursive: true,
});

const report = {
  filesScanned: sourceFiles.length,
  linesScanned,
  legacyTraceCount: matches.length,
  matches,
  failures,
};

fs.writeFileSync(
  path.join(
    reportDirectory,
    "blender-color-audit.json",
  ),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

console.log(
  `Blender color audit: ${sourceFiles.length} files, ${linesScanned} lines, ${matches.length} legacy trace(s).`,
);

if (matches.length > 0) {
  for (const item of matches.slice(0, 80)) {
    console.error(
      `FAIL: ${item.file}:${item.line} ${item.value} [${item.kind}]`,
    );
  }

  if (matches.length > 80) {
    console.error(
      `...and ${matches.length - 80} more. See .roadsafe-ui-audit/blender-color-audit.json`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }

  process.exit(1);
}

console.log(
  "PASS: No known legacy RoadSafe deep-blue UI chrome remains.",
);
