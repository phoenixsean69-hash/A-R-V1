import fs from "node:fs";

const cssPath = "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css";
if (!fs.existsSync(cssPath)) throw new Error(`Missing ${cssPath}`);
const css = fs.readFileSync(cssPath, "utf8");

const checks = [
  ["Readability pass marker exists", css.includes("Step 6.1.2 readability pass")],
  ["Root font increased", css.includes(".fv2-root {\n  font-size: 14px;")],
  ["Inputs are readable", css.includes("font-size: 13px !important;")],
  ["Sidebar labels are readable", css.includes(".fv2-sidebar > button span") && css.includes("font-size: 12px !important;")],
  ["Table text increased", css.includes(".fv2-tablewrap td") && css.includes("font-size: 12px !important;")],
  ["Analysis text increased", css.includes(".fv2-analysis-signal > strong") && css.includes(".fv2-analysis-linknode strong")],
  ["Desktop sidebar widened", css.includes("grid-template-columns: 220px minmax(0, 1fr)")],
  ["No escaped newline corruption", !css.includes("\\n.fv2-")],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`[OK] ${label}`);
  else { failed += 1; console.error(`[FAIL] ${label}`); }
}
if (failed) throw new Error(`Font visibility verification failed: ${failed} check(s).`);
console.log(`\n[RoadSafe] Step 6.1.2 font visibility verification passed (${checks.length}/${checks.length}).`);
