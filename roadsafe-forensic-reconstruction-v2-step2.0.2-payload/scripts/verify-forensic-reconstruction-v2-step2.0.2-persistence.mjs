import fs from "node:fs";

const files = {
  service:
    "src/features/forensicReconstruction/forensicInvestigationService.ts",
  workspace:
    "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css:
    "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing persistence patch file: ${file}`);
  }
}

const service = fs.readFileSync(files.service, "utf8");
const workspace = fs.readFileSync(files.workspace, "utf8");
const css = fs.readFileSync(files.css, "utf8");

const checks = [
  ["Service exposes read-back lookup", service.includes("getByCaseId(")],
  ["Service checks storage availability", service.includes("isLocalPersistenceAvailable()")],
  ["Storage write has explicit error handling", service.includes("Unable to save forensic investigation locally")],
  ["Storage write verifies exact read-back", service.includes("stored !== serialised")],
  ["Service save reads stored case back", service.includes("const persisted =") && service.includes("could not read it back")],
  ["Workspace imports useEffect", workspace.includes("useEffect")],
  ["Workspace imports useRef", workspace.includes("useRef")],
  [
    "Workspace autosaves investigation state",
    /ForensicInvestigationService\.save\s*\(\s*investigation\s*,?\s*\)/m.test(
      workspace,
    ),
  ],
  ["Autosave is debounced", workspace.includes("window.setTimeout") && workspace.includes("350")],
  ["Autosave reads saved case back", workspace.includes("ForensicInvestigationService.getByCaseId")],
  ["Saved locally status exists", workspace.includes("Saved locally")],
  ["Saving status exists", workspace.includes("Saving...")],
  ["Save failed status exists", workspace.includes("Save failed")],
  ["Visible persistence error exists", workspace.includes("Local save failed.")],
  ["Save-status CSS exists", css.includes(".fv2-save-status")],
  ["Save-error CSS exists", css.includes(".fv2-persistence-error")],
];

let failed = 0;

for (const [label, passed] of checks) {
  if (passed) {
    console.log(`[OK] ${label}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failed) {
  throw new Error(
    `Step 2.0.2 persistence verification failed: ${failed} check(s) failed.`,
  );
}

console.log("");
console.log(
  `[RoadSafe] Step 2.0.2 persistence verification passed (${checks.length}/${checks.length}).`,
);
