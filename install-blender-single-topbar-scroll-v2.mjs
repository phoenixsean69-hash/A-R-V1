import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CSS_REL = "src/index.css";
const CSS = path.join(ROOT, ...CSS_REL.split("/"));

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

const original =
  fs.readFileSync(
    CSS,
    "utf8",
  );

const startIndex =
  original.indexOf(
    START,
  );

if (startIndex < 0) {
  fail(
    "Blender Single Topbar V1 was not found in src/index.css. Install the previous topbar patch first.",
  );
}

const endIndex =
  original.indexOf(
    END,
    startIndex,
  );

if (endIndex < 0) {
  fail(
    "Found the Blender Single Topbar start marker, but not the end marker. No files were changed.",
  );
}

const replacement = `
${START}
/*
 * RoadSafe reconstruction header — Blender-style single strip
 * with explicit horizontal scrolling for the command ribbon.
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

.reconstruction-workspace__header > div:first-child {
  width: 220px !important;
  min-width: 150px !important;
  max-width: 220px !important;
  flex: 0 0 220px !important;
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
 * Make the command area a true horizontal ribbon:
 * - one row only
 * - natural button widths
 * - no squeezing / overlap
 * - horizontal scrolling when space runs out
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
  justify-content: flex-start !important;
  gap: 3px !important;
  margin-left: auto !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scrollbar-width: thin !important;
  scrollbar-color: #5a5a5a #1f1f1f !important;
  white-space: nowrap !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior-x: contain !important;
  padding-bottom: 1px !important;
}

.reconstruction-workspace__header > div:last-child::-webkit-scrollbar {
  height: 6px !important;
}

.reconstruction-workspace__header > div:last-child::-webkit-scrollbar-track {
  background: #1f1f1f !important;
  border-radius: 999px !important;
}

.reconstruction-workspace__header > div:last-child::-webkit-scrollbar-thumb {
  background: #5a5a5a !important;
  border-radius: 999px !important;
}

.reconstruction-workspace__header > div:last-child > * {
  flex: 0 0 auto !important;
  min-width: fit-content !important;
}

.reconstruction-workspace__header .reconstruction-workspace__view-switch {
  display: inline-flex !important;
  min-width: max-content !important;
  width: max-content !important;
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
  min-width: max-content !important;
  flex: 0 0 auto !important;
  gap: 4px !important;
  padding: 0 8px !important;
  border-radius: 0 !important;
  font-size: 10px !important;
  line-height: 1 !important;
  letter-spacing: 0 !important;
  white-space: nowrap !important;
}

.reconstruction-workspace__header .reconstruction-workspace__button,
.reconstruction-workspace__header .bg-rose-600 {
  height: 30px !important;
  min-height: 30px !important;
  min-width: max-content !important;
  flex: 0 0 auto !important;
  gap: 4px !important;
  padding: 0 8px !important;
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

const next =
  original.slice(0, startIndex) +
  replacement.trim() +
  original.slice(endIndex + END.length);

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `blender-single-topbar-scroll-v2-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  { recursive: true },
);

fs.writeFileSync(
  path.join(backupDir, "index.css"),
  original,
  "utf8",
);

fs.writeFileSync(
  CSS,
  next,
  "utf8",
);

console.log("");
console.log("RoadSafe Blender Single Topbar Scroll V2");
console.log("========================================");
console.log("[OK] Top strip remains one row.");
console.log("[OK] Right command ribbon is now horizontally scrollable.");
console.log("[OK] Buttons keep natural widths and no longer collide.");
console.log("[OK] Existing logic and handlers remain untouched.");
console.log(`[OK] Backup: ${backupDir}`);

const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log("Verifying production build...");

const result =
  spawnSync(
    npmCommand,
    ["run", "build"],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell: process.platform === "win32",
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

if (result.error) {
  console.error("");
  console.error(`[RoadSafe] Could not launch npm build: ${result.error.message}`);
  console.error(`[RoadSafe] CSS is installed. Backup: ${backupDir}`);
  process.exit(2);
}

if (result.status !== 0) {
  console.error("");
  console.error("[RoadSafe] Production build failed:");
  console.error("");
  console.error(
    output ||
      `(npm run build exited with status ${String(result.status)}.)`,
  );
  console.error("");
  console.error(`[RoadSafe] Backup: ${backupDir}`);
  process.exit(3);
}

console.log("[OK] Production build passed.");
console.log("");
console.log("Now run:");
console.log("  npm run dev");
