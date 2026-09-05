import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "src", "pages", "AccidentCasePage.tsx");

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("src/pages/AccidentCasePage.tsx was not found.");
}

let source = fs.readFileSync(TARGET, "utf8");

const investigationStart = source.indexOf(
  '<h2 className="ui-panel-title">Investigation details</h2>',
);

if (investigationStart < 0) {
  fail("Could not locate the Investigation details panel. No file changed.");
}

const investigationEnd = source.indexOf(
  "</section>",
  investigationStart,
);

if (investigationEnd < 0) {
  fail("Could not locate the end of the Investigation details panel. No file changed.");
}

let block = source.slice(investigationStart, investigationEnd);

const oldCount = (block.match(/text-slate-300/g) ?? []).length;

if (oldCount === 0) {
  console.log("\n[RoadSafe] Investigation detail values are already using dark-theme colours.");
  console.log("[RoadSafe] No file changed.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `investigation-details-theme-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "AccidentCasePage.tsx"),
);

// Human-readable values.
block = block.replace(
  'className="mt-0.5 break-words text-slate-300"',
  'className="mt-0.5 break-words text-slate-300"',
);

block = block.replace(
  'className="mt-0.5 break-words text-slate-300"',
  'className="mt-0.5 break-words text-slate-300"',
);

// IDs.
block = block.replace(
  'className="mt-0.5 break-all text-slate-300"',
  'className="mt-0.5 break-all font-mono text-slate-400"',
);

block = block.replace(
  'className="mt-0.5 break-all text-[10px] text-slate-300"',
  'className="mt-0.5 break-all font-mono text-[10px] text-slate-400"',
);

// Defensive cleanup for any remaining dark text in this exact panel.
block = block.replace(/text-slate-300/g, "text-slate-300");

source =
  source.slice(0, investigationStart) +
  block +
  source.slice(investigationEnd);

fs.writeFileSync(TARGET, source, "utf8");

console.log("\n[RoadSafe] Investigation Details Theme Fix V1 applied.");
console.log("[RoadSafe] Officer / Police station -> readable slate.");
console.log("[RoadSafe] Junction / Reconstruction IDs -> muted monospace slate.");
console.log("[RoadSafe] No case logic or layout changed.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
