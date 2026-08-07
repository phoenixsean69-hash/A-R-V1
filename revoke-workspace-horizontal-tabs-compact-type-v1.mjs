import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-workspace-horizontal-tabs-compact-type-v1.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No Workspace horizontal-tabs/compact-type backup state found.",
  );
  process.exit(1);
}

const state = JSON.parse(
  fs.readFileSync(statePath, "utf8"),
);

fs.writeFileSync(
  path.join(root, state.editorPath),
  state.originalEditor,
  "utf8",
);

fs.writeFileSync(
  path.join(root, state.cssPath),
  state.originalCss,
  "utf8",
);

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe Workspace horizontal-tabs + compact-type fix rolled back.",
);
