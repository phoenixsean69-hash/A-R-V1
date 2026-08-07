import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-screen-timeline-center-width-fix-v1.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No Screen Timeline centre-width fix backup state found.",
  );
  process.exit(1);
}

const state = JSON.parse(
  fs.readFileSync(statePath, "utf8"),
);

fs.writeFileSync(
  path.join(
    root,
    state.componentPath,
  ),
  state.originalComponent,
  "utf8",
);

fs.writeFileSync(
  path.join(
    root,
    state.cssPath,
  ),
  state.originalCss,
  "utf8",
);

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe Screen Timeline centre-width fix rolled back.",
);
