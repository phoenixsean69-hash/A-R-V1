import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-right-panel-workspace-tab-fix-v1.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No right-panel Workspace tab backup state found.",
  );
  process.exit(1);
}

const state = JSON.parse(
  fs.readFileSync(statePath, "utf8"),
);

fs.writeFileSync(
  path.join(
    root,
    state.editorPath,
  ),
  state.original,
  "utf8",
);

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe right-panel Workspace tab fix rolled back.",
);
