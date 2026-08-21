import fs from "node:fs";

const workspacePath = "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx";
const cssPath = "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css";

if (!fs.existsSync(workspacePath) || !fs.existsSync(cssPath)) {
  throw new Error("Step 6.1.3 verification files are missing.");
}

const workspace = fs.readFileSync(workspacePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

const checks = [
  ["Analysis scan row has dedicated layout class", workspace.includes('fv2-analysis-row fv2-analysis-row-scan')],
  ["Analysis scan panel has dedicated class", workspace.includes('fv2-panel fv2-analysis-scan-panel')],
  ["Consistency scan remains present", workspace.includes("Automatic consistency scan")],
  ["Scan layout is one column", css.includes(".fv2-analysis-row-scan") && css.includes("grid-template-columns: 1fr")],
  ["Signal grid is forced to one column", css.includes(".fv2-analysis-scan-panel .fv2-analysis-signal-grid") && css.includes("grid-template-columns: 1fr !important")],
  ["Signal cards use readable horizontal layout", css.includes('grid-template-areas:') && css.includes('"area title"') && css.includes('"area detail"')],
  ["Signal title is readable", css.includes("font-size: 14px !important")],
  ["Signal detail is readable", css.includes("font-size: 12px !important")],
  ["Responsive mobile stacking exists", css.includes("@media (max-width: 760px)")],
  ["No literal escaped-newline corruption", !css.includes("\\n.fv2-")],
];

let failed = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`[OK] ${label}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failed) {
  throw new Error(`Step 6.1.3 UI verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Step 6.1.3 consistency-scan UI verification passed (${checks.length}/${checks.length}).`);
