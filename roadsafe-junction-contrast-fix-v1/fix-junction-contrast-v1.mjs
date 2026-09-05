import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const CANDIDATES = [
  path.join(
    ROOT,
    "src",
    "components",
    "map",
    "JunctionAnalysisModal.tsx",
  ),
  path.join(
    ROOT,
    "src",
    "components",
    "map",
    "AccidentMap.tsx",
  ),
];

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

const existing = CANDIDATES.filter((file) => fs.existsSync(file));

if (existing.length === 0) {
  fail("No junction map UI files were found.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `junction-contrast-fix-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });

const replacements = [
  [/\bbg-white\b/g, "bg-[#292929]"],
  [/\bbg-gray-50\b/g, "bg-[#292929]"],
  [/\bbg-gray-100\b/g, "bg-[#303030]"],
  [/\bbg-slate-50\b/g, "bg-[#292929]"],
  [/\bbg-slate-100\b/g, "bg-[#303030]"],

  [/\bborder-gray-100\b/g, "border-[#414141]"],
  [/\bborder-gray-200\b/g, "border-[#494949]"],
  [/\bborder-gray-300\b/g, "border-[#555555]"],
  [/\bborder-slate-200\b/g, "border-[#494949]"],
  [/\bborder-slate-300\b/g, "border-[#555555]"],

  [/\btext-gray-900\b/g, "text-slate-100"],
  [/\btext-gray-800\b/g, "text-slate-200"],
  [/\btext-gray-700\b/g, "text-slate-300"],
  [/\btext-gray-600\b/g, "text-slate-400"],
  [/\btext-gray-500\b/g, "text-slate-500"],
  [/\btext-slate-300\b/g, "text-slate-100"],
  [/\btext-slate-800\b/g, "text-slate-200"],
  [/\btext-slate-700\b/g, "text-slate-300"],

  [/\bhover:bg-gray-50\b/g, "hover:bg-[#333333]"],
  [/\bhover:bg-gray-100\b/g, "hover:bg-[#383838]"],
  [/\bhover:bg-slate-50\b/g, "hover:bg-[#333333]"],
  [/\bhover:bg-slate-100\b/g, "hover:bg-[#383838]"],
];

let changedFiles = 0;

for (const file of existing) {
  const original = fs.readFileSync(file, "utf8");
  let next = original;

  const junctionUiSignal =
    /View Full Analysis|Junction Analysis|junction analysis|Common cause|Recorded accidents|Risk score/i.test(
      original,
    );

  if (!junctionUiSignal) {
    continue;
  }

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  next = next
    .replace(
      /className="([^"]*)bg-\[#f8fafc\]([^"]*)"/g,
      'className="$1bg-[#292929]$2"',
    )
    .replace(
      /className="([^"]*)bg-\[#f9fafb\]([^"]*)"/g,
      'className="$1bg-[#292929]$2"',
    )
    .replace(
      /className="([^"]*)bg-\[#ffffff\]([^"]*)"/gi,
      'className="$1bg-[#292929]$2"',
    );

  if (next !== original) {
    fs.copyFileSync(
      file,
      path.join(backupDir, path.basename(file)),
    );

    fs.writeFileSync(file, next, "utf8");
    changedFiles += 1;

    console.log(
      `[RoadSafe] Contrast repaired: ${path.relative(ROOT, file)}`,
    );
  }
}

if (changedFiles === 0) {
  console.log(
    "\n[RoadSafe] No light-theme junction classes matched the repair rules.",
  );
  console.log(
    "[RoadSafe] No file was changed. If the white tiles are still visible, the local junction brief is coming from a different component.",
  );
  process.exit(0);
}

console.log("\n[RoadSafe] Junction Contrast Fix V1 applied.");
console.log("[RoadSafe] White/light tiles -> dark RoadSafe surfaces.");
console.log("[RoadSafe] Light borders -> dark neutral borders.");
console.log("[RoadSafe] Text contrast -> slate dark-theme palette.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
