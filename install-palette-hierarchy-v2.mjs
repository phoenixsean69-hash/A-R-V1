import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const scriptDir =
  path.dirname(
    new URL(import.meta.url)
      .pathname
      .replace(/^\/([A-Za-z]:)/, "$1"),
  );

const packagePath =
  path.join(root, "package.json");

const mainPath =
  path.join(root, "src/main.tsx");

const palettePath =
  path.join(root, "src/styles/roadsafePalette.css");

const payloadPath =
  path.join(scriptDir, "roadsafePalette.css");

const viewerPath =
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

const backupRoot =
  path.join(root, ".roadsafe-ui-backup");

const statePath =
  path.join(
    backupRoot,
    "last-palette-hierarchy-v2.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "palette-hierarchy-v2-build.log",
  );

const auditPath =
  path.join(
    backupRoot,
    "palette-hierarchy-v2-audit.txt",
  );

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Required file missing: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function detectEol(source) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function normalize(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function restoreEol(source, original) {
  return detectEol(original) === "\r\n"
    ? source.replace(/\n/g, "\r\n")
    : source;
}

if (!fs.existsSync(packagePath)) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg =
  JSON.parse(
    fs.readFileSync(packagePath, "utf8"),
  );

if (pkg.name !== "roadsafe-ar") {
  fail(
    `Expected roadsafe-ar, found ${pkg.name ?? "unknown"}.`,
  );
}

const originalMain =
  readRequired(mainPath);

const originalPalette =
  fs.existsSync(palettePath)
    ? fs.readFileSync(palettePath, "utf8")
    : null;

const originalViewer =
  fs.existsSync(viewerPath)
    ? fs.readFileSync(viewerPath, "utf8")
    : null;

const payload =
  readRequired(payloadPath);

let main =
  normalize(originalMain);

const paletteImport =
  'import "./styles/roadsafePalette.css";';

/*
 * Keep one canonical palette import and guarantee that it is the final CSS
 * import. V1 already created this import; this also works on a repo where V1
 * was not installed.
 */
main =
  main
    .split("\n")
    .filter(
      (line) =>
        line.trim() !== paletteImport,
    )
    .join("\n");

const lines =
  main.split("\n");

let lastCssImport = -1;

for (
  let index = 0;
  index < lines.length;
  index += 1
) {
  if (
    /^import\s+["'][^"']+\.css["'];?$/.test(
      lines[index].trim(),
    )
  ) {
    lastCssImport = index;
  }
}

if (lastCssImport < 0) {
  fail(
    "Could not locate the CSS import stack in src/main.tsx. No files changed.",
  );
}

lines.splice(
  lastCssImport + 1,
  0,
  paletteImport,
);

main =
  lines.join("\n");

const importPosition =
  main.indexOf(paletteImport);

const laterCss =
  main
    .slice(importPosition + paletteImport.length)
    .match(
      /import\s+["'][^"']+\.css["'];?/,
    );

if (laterCss) {
  fail(
    "Palette import audit failed: another stylesheet still loads after roadsafePalette.css. No files changed.",
  );
}

/* Required palette values. */
for (
  const colour of [
    "#181818",
    "#3C3C3C",
    "#555555",
    "#C1C1C1",
    "#C69D56",
    "#8FD1AB",
    "#4874CB",
  ]
) {
  if (!payload.includes(colour)) {
    fail(
      `Palette payload is missing ${colour}. No files changed.`,
    );
  }
}

/* Brace audit before touching the repo. */
let depth = 0;
let inComment = false;

for (
  let index = 0;
  index < payload.length;
  index += 1
) {
  if (
    !inComment &&
    payload.startsWith("/*", index)
  ) {
    inComment = true;
    index += 1;
    continue;
  }

  if (
    inComment &&
    payload.startsWith("*/", index)
  ) {
    inComment = false;
    index += 1;
    continue;
  }

  if (inComment) {
    continue;
  }

  if (payload[index] === "{") {
    depth += 1;
  } else if (payload[index] === "}") {
    depth -= 1;

    if (depth < 0) {
      fail(
        "Palette CSS brace audit failed. No files changed.",
      );
    }
  }
}

if (depth !== 0) {
  fail(
    "Palette CSS brace audit failed. No files changed.",
  );
}

/* The WebGL background cannot be controlled by CSS. V1 should already have
 * changed it, but patch the common old values if necessary.
 */
let viewer =
  originalViewer === null
    ? null
    : normalize(originalViewer);

if (viewer) {
  viewer =
    viewer.replace(
      /scene\.background\s*=\s*new THREE\.Color\(\s*(?:0x202020|0x181818|0x292929|0x303030|["']#(?:202020|181818|292929|303030)["'])\s*,?\s*\);/g,
      `scene.background =
    new THREE.Color(
      0x555555,
    );`,
    );

  if (
    viewer.includes("scene.background") &&
    !viewer.includes("0x555555")
  ) {
    console.warn(
      "WARNING: Three.js scene.background exists but did not match the known form. CSS viewport fallback will still be #555555.",
    );
  }
}

/* Parse changed TSX before write if TypeScript is installed. */
try {
  const require =
    createRequire(import.meta.url);

  const ts =
    require("typescript");

  const sourceFile =
    ts.createSourceFile(
      "main.tsx",
      main,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

  if (sourceFile.parseDiagnostics.length) {
    const errors =
      sourceFile.parseDiagnostics
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n",
          ),
        )
        .join("\n");

    fail(
      `main.tsx parse audit failed:\n${errors}`,
    );
  }

  if (viewer) {
    const viewerFile =
      ts.createSourceFile(
        "Reconstruction3DViewer.tsx",
        viewer,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

    if (viewerFile.parseDiagnostics.length) {
      const errors =
        viewerFile.parseDiagnostics
          .map((diagnostic) =>
            ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n",
            ),
          )
          .join("\n");

      fail(
        `Reconstruction3DViewer.tsx parse audit failed:\n${errors}`,
      );
    }
  }

  console.log(
    "TypeScript parse audit: PASS",
  );
} catch (error) {
  if (
    String(error).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; continuing to full npm build.",
    );
  } else {
    throw error;
  }
}

fs.mkdirSync(
  backupRoot,
  { recursive: true },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),

      originalMain,
      originalPalette,
      originalViewer,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    mainPath,
    originalMain,
    "utf8",
  );

  if (originalPalette === null) {
    fs.rmSync(
      palettePath,
      { force: true },
    );
  } else {
    fs.writeFileSync(
      palettePath,
      originalPalette,
      "utf8",
    );
  }

  if (originalViewer !== null) {
    fs.writeFileSync(
      viewerPath,
      originalViewer,
      "utf8",
    );
  }

  fs.rmSync(
    statePath,
    { force: true },
  );
}

fs.writeFileSync(
  mainPath,
  restoreEol(main, originalMain),
  "utf8",
);

fs.writeFileSync(
  palettePath,
  payload,
  "utf8",
);

if (
  viewer !== null &&
  originalViewer !== null
) {
  fs.writeFileSync(
    viewerPath,
    restoreEol(viewer, originalViewer),
    "utf8",
  );
}

const audit = [
  "RoadSafe Palette Hierarchy V2",
  "==============================",
  "",
  "SURFACE ROLES",
  "-------------",
  "#181818 deep chrome",
  "#3C3C3C main workspace + large content cards",
  "#555555 2D / 3D / AR + restrained raised dark surfaces",
  "#C1C1C1 compact controls / buttons / form fields",
  "#C69D56 active / selected / attention",
  "#8FD1AB success / verified / ready",
  "#4874CB primary / info / focus / links",
  "",
  "EXPLICIT V1 CORRECTIONS",
  "-----------------------",
  "Station Overview stat cards: DARK",
  "Reports panels/register/table: DARK",
  "Report content text: LIGHT",
  "Object/model browser rows: DARK",
  "Selected object/model row: GOLD",
  "Buttons/controls: LIGHT",
  "2D/3D/AR viewport: #555555",
  "",
  `Final palette import: ${
    main.includes(paletteImport)
      ? "PASS"
      : "FAIL"
  }`,
  `No later CSS import: ${
    !laterCss
      ? "PASS"
      : "FAIL"
  }`,
  `WebGL #555555 seen: ${
    viewer?.includes("0x555555")
      ? "PASS"
      : "N/A"
  }`,
].join("\n");

fs.writeFileSync(
  auditPath,
  audit,
  "utf8",
);

console.log(
  "Palette hierarchy V2 written.",
);

console.log(
  "Audit: .roadsafe-ui-backup\\palette-hierarchy-v2-audit.txt",
);

console.log("");
console.log(
  "Running full project build...",
);

const command =
  process.platform === "win32"
    ? {
        executable:
          process.env.ComSpec ||
          "C:\\Windows\\System32\\cmd.exe",
        args: [
          "/d",
          "/s",
          "/c",
          "npm run build",
        ],
      }
    : {
        executable: "npm",
        args: ["run", "build"],
      };

const build =
  spawnSync(
    command.executable,
    command.args,
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      env: process.env,
    },
  );

const log = [
  "RoadSafe Palette Hierarchy V2",
  "==============================",
  `status: ${String(build.status)}`,
  `error: ${
    build.error
      ? `${build.error.name}: ${build.error.message}`
      : "none"
  }`,
  "",
  "STDOUT",
  "------",
  build.stdout ?? "",
  "",
  "STDERR",
  "------",
  build.stderr ?? "",
].join("\n");

fs.writeFileSync(
  buildLogPath,
  log,
  "utf8",
);

if (build.stdout) {
  process.stdout.write(build.stdout);
}

if (build.stderr) {
  process.stderr.write(build.stderr);
}

if (
  build.status === null ||
  build.status !== 0
) {
  console.error("");
  console.error(
    "Build failed. Restoring the exact pre-V2 theme files...",
  );

  restore();

  console.error(
    `Build log preserved at ${path.relative(
      root,
      buildLogPath,
    )}`,
  );

  process.exit(
    build.status ?? 1,
  );
}

console.log("");
console.log(
  "RoadSafe Palette Hierarchy V2 installed successfully.",
);

console.log("");
console.log(
  "The palette did NOT change. The hierarchy did:",
);

console.log(
  "  content = dark",
);

console.log(
  "  controls = light",
);

console.log(
  "  selected = gold",
);

console.log(
  "  primary = blue",
);

console.log(
  "  success = mint",
);

console.log(
  "  viewports = #555555",
);

console.log("");
console.log(
  "Now run: npm run dev",
);

console.log(
  "Then hard-refresh with Ctrl+Shift+R.",
);

console.log("");
console.log(
  "Rollback: node .\\revoke-palette-hierarchy-v2.mjs",
);
