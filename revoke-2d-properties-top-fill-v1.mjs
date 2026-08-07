import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-2d-properties-top-fill-v1.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No 2D Properties top-fill backup state found.",
  );
  process.exit(1);
}

const state = JSON.parse(
  fs.readFileSync(statePath, "utf8"),
);

fs.writeFileSync(
  path.join(
    root,
    state.cssPath,
  ),
  state.original,
  "utf8",
);

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe 2D Properties top-fill fix rolled back.",
);
