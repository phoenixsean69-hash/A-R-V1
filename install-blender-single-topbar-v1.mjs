import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CSS_REL = "src/index.css";
const EDITOR_REL =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";

const CSS = path.join(ROOT, ...CSS_REL.split("/"));
const EDITOR = path.join(ROOT, ...EDITOR_REL.split("/"));

const START =
  "/* [RoadSafe:BlenderSingleTopbarV1:start] */";
const END =
  "/* [RoadSafe:BlenderSingleTopbarV1:end] */";

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

if (!fs.existsSync(CSS)) {
  fail(
    `Could not find ${CSS_REL}. Run this installer from the A-R-V1 repository root.`,
  );
}

if (!fs.existsSync(EDITOR)) {
  fail(
    `Could not find ${EDITOR_REL}. Run this installer from the A-R-V1 repository root.`,
  );
}

const editor =
  fs.readFileSync(
    EDITOR,
    "utf8",
  );

if (
  !editor.includes(
    'className="reconstruction-workspace__header"',
  )
) {
  fail(
    "Could not find the reconstruction workspace header. No files were changed.",
  );
}

if (
  !editor.includes(
    'className="reconstruction-workspace__view-switch"',
  )
) {
  fail(
    "Could not find the 2D / 3D view switch. No files were changed.",
  );
}

if (
  !editor.includes(
    "Objects & Evidence",
  ) ||
  !editor.includes(
    "Panels",
  ) ||
  !editor.includes(
    "Nodes",
  )
) {
  fail(
    "The current reconstruction toolbar no longer matches the expected workspace controls. No files were changed.",
  );
}

const cssOverride = `
${START}
/*
 * RoadSafe reconstruction header — Blender-style single strip.
 *
 * The editor already renders every command inside one header. The previous
 * appearance of two bars was caused by the right-hand flex container wrapping.
 * These rules keep one dense horizontal strip while preserving every existing
 * action and event handler.
 */

.reconstruction-workspace__header {
  height: 38px !important;
  min-height: 38px !important;
  max-height: 38px !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  gap: 5px !important;
  overflow: hidden !important;
  padding: 3px 6px !important;
  border-bottom: 1px solid #171717 !important;
  background: #292929 !important;
  backdrop-filter: none !important;
}

/* Compact case identity at the left, like Blender's file/scene identity area. */
.reconstruction-workspace__header > div:first-child {
  width: 220px !important;
  min-width: 150px !important;
  max-width: 220px !important;
  flex: 0 1 220px !important;
  gap: 5px !important;
  overflow: hidden !important;
}

.reconstruction-workspace__header > div:first-child > .reconstruction-workspace__icon-button {
  width: 28px !important;
  min-width: 28px !important;
  height: 28px !important;
  min-height: 28px !important;
  flex: 0 0 28px !important;
  padding: 0 !important;
  border-radius: 3px !important;
}

.reconstruction-workspace__header > div:first-child > div {
  min-width: 0 !important;
  overflow: hidden !important;
}

/* One compact identity line only — remove the redundant workspace subtitle. */
.reconstruction-workspace__header > div:first-child > div > p:first-child {
  margin: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  font-size: 10px !important;
  line-height: 28px !important;
  letter-spacing: .045em !important;
}

.reconstruction-workspace__header > div:first-child > div > p:nth-child(2) {
  display: none !important;
}

/*
 * This is the important part: the command group can no longer create a
 * second row. It owns the remaining width and stays on one line.
 */
.reconstruction-workspace__header > div:last-child {
  display: flex !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  flex: 1 1 auto !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 3px !important;
  margin-left: auto !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scrollbar-width: none !important;
  white-space: nowrap !important;
}

.reconstruction-workspace__header > div:last-child::-webkit-scrollbar {
  display: none !important;
}

/* Flatten and compact the 2D / 3D / AR workspace selector. */
.reconstruction-workspace__header .reconstruction-workspace__view-switch {
  display: inline-flex !important;
  min-width: 0 !important;
  height: 30px !important;
  flex: 0 0 auto !important;
  align-items: stretch !important;
  overflow: hidden !important;
  border-radius: 3px !important;
  white-space: nowrap !important;
}

.reconstruction-workspace__header .reconstruction-workspace__view-switch button {
  height: 30px !important;
  min-height: 30px !important;
  min-width: 0 !important;
  flex: 0 0 auto !important;
  gap: 4px !important;
  padding: 0 8px !important;
  border-radius: 0 !important;
  font-size: 10px !important;
  line-height: 1 !important;
  letter-spacing: 0 !important;
  white-space: nowrap !important;
}

/* All remaining commands become Blender-like compact header controls. */
.reconstruction-workspace__header .reconstruction-workspace__button,
.reconstruction-workspace__header .bg-rose-600 {
  height: 30px !important;
  min-height: 30px !important;
  min-width: 0 !important;
  flex: 0 0 auto !important;
  gap: 4px !important;
  padding: 0 7px !important;
  border-radius: 3px !important;
  font-size: 9.5px !important;
  line-height: 1 !important;
  letter-spacing: 0 !important;
  white-space: nowrap !important;
  box-shadow: none !important;
}

.reconstruction-workspace__header .reconstruction-workspace__button svg,
.reconstruction-workspace__header .bg-rose-600 svg,
.reconstruction-workspace__header .reconstruction-workspace__view-switch svg {
  width: 13px !important;
  height: 13px !important;
  flex: 0 0 13px !important;
}

/*
 * Existing responsive CSS previously changed the header to a vertical stack
 * below 980 px. Keep the Blender model instead: still one row, with discreet
 * horizontal scrolling only when the browser becomes genuinely too narrow.
 */
@media (max-width: 1180px) {
  .reconstruction-workspace__header {
    flex-direction: row !important;
    align-items: center !important;
  }

  .reconstruction-workspace__header > div:first-child {
    width: 180px !important;
    max-width: 180px !important;
    flex-basis: 180px !important;
  }

  .reconstruction-workspace__header > div:last-child {
    width: auto !important;
    justify-content: flex-start !important;
  }

  .reconstruction-workspace__header .reconstruction-workspace__button,
  .reconstruction-workspace__header .bg-rose-600,
  .reconstruction-workspace__header .reconstruction-workspace__view-switch button {
    padding-left: 6px !important;
    padding-right: 6px !important;
    font-size: 9px !important;
  }
}

@media (max-width: 760px) {
  .reconstruction-workspace__header > div:first-child {
    width: 132px !important;
    min-width: 132px !important;
    max-width: 132px !important;
    flex-basis: 132px !important;
  }
}
${END}
`;

const original =
  fs.readFileSync(
    CSS,
    "utf8",
  );

let next =
  original;

const startIndex =
  next.indexOf(
    START,
  );

if (
  startIndex >= 0
) {
  const endIndex =
    next.indexOf(
      END,
      startIndex,
    );

  if (
    endIndex < 0
  ) {
    fail(
      "Found an incomplete previous Blender Single Topbar marker. No file was changed.",
    );
  }

  next =
    next.slice(
      0,
      startIndex,
    ) +
    next.slice(
      endIndex +
        END.length,
    );
}

next =
  next.trimEnd() +
  "\n\n" +
  cssOverride.trim() +
  "\n";

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `blender-single-topbar-v1-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  path.join(
    backupDir,
    "index.css",
  ),
  original,
  "utf8",
);

fs.writeFileSync(
  CSS,
  next,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Blender Single Topbar V1",
);
console.log(
  "================================",
);
console.log(
  "[OK] Reconstruction command header locked to one row.",
);
console.log(
  "[OK] Header height reduced to 38 px.",
);
console.log(
  "[OK] Case identity compressed and ellipsized.",
);
console.log(
  "[OK] Redundant workspace subtitle hidden.",
);
console.log(
  "[OK] 2D / 3D / AR controls kept together.",
);
console.log(
  "[OK] Panels / Nodes / Objects & Evidence / Export / Record / Save kept on the same strip.",
);
console.log(
  "[OK] Existing click handlers and reconstruction logic untouched.",
);
console.log(
  "[OK] Restored RoadSafe theme colours preserved.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/*
 * Run the production build rather than TypeScript alone because this patch is
 * CSS-only and we want Vite/Tailwind to parse the new stylesheet too.
 */
const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log(
  "Verifying production build...",
);

const result =
  spawnSync(
    npmCommand,
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell:
        process.platform === "win32",
    },
  );

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  result.error
) {
  console.error("");
  console.error(
    `[RoadSafe] Could not launch npm build: ${result.error.message}`,
  );
  console.error(
    `[RoadSafe] CSS is installed. Backup: ${backupDir}`,
  );
  process.exit(2);
}

if (
  result.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed:",
  );
  console.error("");
  console.error(
    output ||
      `(npm run build exited with status ${String(result.status)}.)`,
  );
  console.error("");
  console.error(
    `[RoadSafe] Backup: ${backupDir}`,
  );
  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run dev",
);
