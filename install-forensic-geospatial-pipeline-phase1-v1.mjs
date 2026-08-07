import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(root, "package.json");
const pagePath = path.join(root, "src/pages/AccidentCaseFormPage.tsx");
const reconstructionTypesPath = path.join(root, "src/types/reconstruction.ts");
const backupRoot = path.join(root, ".roadsafe-ui-backup");
const statePath = path.join(backupRoot, "last-forensic-geospatial-pipeline-phase1-v1.json");
const buildLogPath = path.join(backupRoot, "forensic-geospatial-pipeline-phase1-v1-build.log");

const payloadFiles = [
  ["forensicScenePipeline.ts", "src/types/forensicScenePipeline.ts"],
  ["forensicAreaService.ts", "src/services/forensicAreaService.ts"],
  ["forensicSourceArchiveService.ts", "src/services/forensicSourceArchiveService.ts"],
  ["forensicElevationService.ts", "src/services/forensicElevationService.ts"],
  ["forensicScenePipelineService.ts", "src/services/forensicScenePipelineService.ts"],
  ["ForensicAreaMap.tsx", "src/components/cases/ForensicAreaMap.tsx"],
  ["ForensicCaseAreaWizard.tsx", "src/components/cases/ForensicCaseAreaWizard.tsx"],
  ["forensicCaseAreaWizard.css", "src/components/cases/forensicCaseAreaWizard.css"],
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) fail("Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.name !== "roadsafe-ar") fail(`Expected roadsafe-ar, found ${pkg.name ?? "unknown"}.`);
for (const required of [pagePath, reconstructionTypesPath]) {
  if (!fs.existsSync(required)) fail(`Required repo file missing: ${required}`);
}

const originalPage = fs.readFileSync(pagePath, "utf8");
const originalReconstructionTypes = fs.readFileSync(reconstructionTypesPath, "utf8");
const originalPayload = Object.fromEntries(
  payloadFiles.map(([, destination]) => {
    const full = path.join(root, destination);
    return [destination, fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null];
  }),
);

let page = originalPage;
let reconstructionTypes = originalReconstructionTypes;

if (page.includes('import NewCaseRoadWizard from "../components/cases/NewCaseRoadWizard";')) {
  page = page.replace(
    'import NewCaseRoadWizard from "../components/cases/NewCaseRoadWizard";',
    'import ForensicCaseAreaWizard from "../components/cases/ForensicCaseAreaWizard";',
  );
} else if (!page.includes('import ForensicCaseAreaWizard from "../components/cases/ForensicCaseAreaWizard";')) {
  fail("Could not locate the current NewCaseRoadWizard import. No files changed.");
}

if (page.includes("<NewCaseRoadWizard initialValues={initialValues} />")) {
  page = page.replace(
    "<NewCaseRoadWizard initialValues={initialValues} />",
    "<ForensicCaseAreaWizard initialValues={initialValues} />",
  );
} else if (!page.includes("<ForensicCaseAreaWizard initialValues={initialValues} />")) {
  fail("Could not locate the current new-case wizard render. No files changed.");
}

page = page.replace(
  "RoadSafe AR will confirm the officer’s position, fetch nearby road data, suggest the junction layout and create the linked 2D reconstruction only after officer approval.",
  "RoadSafe freezes the forensic core and context boundary, archives source payloads, builds metric geometry and terrain evidence, runs quality assurance and creates the linked reconstruction only after investigator review.",
);

if (!reconstructionTypes.includes('import type { ForensicScenePackage } from "./forensicScenePipeline";')) {
  const anchor = 'import type { RealSceneGeometry } from "./realSceneGeometry";';
  if (!reconstructionTypes.includes(anchor)) fail("Could not locate RealSceneGeometry import in reconstruction.ts. No files changed.");
  reconstructionTypes = reconstructionTypes.replace(anchor, `${anchor}\nimport type { ForensicScenePackage } from "./forensicScenePipeline";`);
}

if (!reconstructionTypes.includes("forensicScene?: ForensicScenePackage;")) {
  const anchor = "  realSceneGeometry?: RealSceneGeometry;";
  if (!reconstructionTypes.includes(anchor)) fail("Could not locate realSceneGeometry in RoadSceneSettings. No files changed.");
  reconstructionTypes = reconstructionTypes.replace(
    anchor,
    `${anchor}\n\n  /** Frozen canonical forensic geospatial package. */\n  forensicScene?: ForensicScenePackage;`,
  );
}

try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const targets = [
    ["AccidentCaseFormPage.tsx", page, ts.ScriptKind.TSX],
    ["reconstruction.ts", reconstructionTypes, ts.ScriptKind.TS],
    ...payloadFiles
      .filter(([source]) => source.endsWith(".ts") || source.endsWith(".tsx"))
      .map(([source]) => [source, fs.readFileSync(path.join(scriptDir, source), "utf8"), source.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS]),
  ];

  for (const [name, source, kind] of targets) {
    const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, kind);
    if (sf.parseDiagnostics.length > 0) {
      const details = sf.parseDiagnostics.slice(0, 20).map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        if (typeof diagnostic.start !== "number") return message;
        const position = sf.getLineAndCharacterOfPosition(diagnostic.start);
        return `${name}:${position.line + 1}:${position.character + 1} ${message}`;
      }).join("\n");
      fail(`TS/TSX parse audit failed:\n${details}`);
    }
  }
  console.log("Forensic pipeline TS/TSX parse audit: PASS");
} catch (error) {
  if (String(error).includes("Cannot find module 'typescript'")) console.warn("TypeScript parser unavailable; continuing to full build.");
  else throw error;
}

fs.mkdirSync(backupRoot, { recursive: true });
fs.writeFileSync(
  statePath,
  JSON.stringify({
    installedAt: new Date().toISOString(),
    pagePath: path.relative(root, pagePath),
    reconstructionTypesPath: path.relative(root, reconstructionTypesPath),
    originalPage,
    originalReconstructionTypes,
    originalPayload,
  }, null, 2),
  "utf8",
);

function restore() {
  fs.writeFileSync(pagePath, originalPage, "utf8");
  fs.writeFileSync(reconstructionTypesPath, originalReconstructionTypes, "utf8");
  for (const [destination, original] of Object.entries(originalPayload)) {
    const full = path.join(root, destination);
    if (original === null) fs.rmSync(full, { force: true });
    else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, original, "utf8");
    }
  }
  fs.rmSync(statePath, { force: true });
}

for (const [source, destination] of payloadFiles) {
  const sourcePath = path.join(scriptDir, source);
  const destinationPath = path.join(root, destination);
  if (!fs.existsSync(sourcePath)) {
    restore();
    fail(`Installer payload missing: ${source}`);
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, fs.readFileSync(sourcePath, "utf8"), "utf8");
  console.log(`WROTE ${destination}`);
}

fs.writeFileSync(pagePath, page, "utf8");
fs.writeFileSync(reconstructionTypesPath, reconstructionTypes, "utf8");
console.log("REPLACED new-case entry with ForensicCaseAreaWizard.");
console.log("ADDED RoadSceneSettings.forensicScene canonical package.");
console.log("");
console.log("Running full project build...");

const command = process.platform === "win32"
  ? { executable: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", "npm run build"] }
  : { executable: "npm", args: ["run", "build"] };

const build = spawnSync(command.executable, command.args, {
  cwd: root,
  encoding: "utf8",
  shell: false,
  env: process.env,
});

const output = [
  "RoadSafe Forensic Geospatial Pipeline Phase 1 V1",
  "================================================",
  `status: ${String(build.status)}`,
  `error: ${build.error ? `${build.error.name}: ${build.error.message}` : "none"}`,
  "",
  "STDOUT",
  "------",
  build.stdout ?? "",
  "",
  "STDERR",
  "------",
  build.stderr ?? "",
].join("\n");
fs.writeFileSync(buildLogPath, output, "utf8");
if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);

if (build.status === null || build.status !== 0) {
  console.error("");
  console.error("Build failed. Restoring the pre-pipeline repo state...");
  restore();
  console.error(`Build log preserved at ${path.relative(root, buildLogPath)}`);
  process.exit(build.status ?? 1);
}

console.log("");
console.log("RoadSafe Forensic Geospatial Pipeline Phase 1 V1 installed successfully.");
console.log("New-case flow: Case -> Forensic Core + Context -> Source/Elevation Pipeline -> QA Review -> Create");
console.log("The old NewCaseRoadWizard remains in the repo but is no longer the new-case entry point.");
console.log("");
console.log("Start: npm run dev");
console.log("Rollback: node revoke-forensic-geospatial-pipeline-phase1-v1.mjs");
