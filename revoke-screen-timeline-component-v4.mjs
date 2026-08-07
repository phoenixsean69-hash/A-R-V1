import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-screen-timeline-component-v4.json",
  );

if (!fs.existsSync(statePath)) {
  console.error(
    "No Screen Timeline Component V3 backup state found.",
  );
  process.exit(1);
}

const state =
  JSON.parse(
    fs.readFileSync(
      statePath,
      "utf8",
    ),
  );

fs.writeFileSync(
  path.join(
    root,
    state.editorPath,
  ),
  state.originalEditor,
  "utf8",
);

fs.writeFileSync(
  path.join(
    root,
    state.colourGuardPath,
  ),
  state.originalColourGuard,
  "utf8",
);

const componentPath =
  path.join(
    root,
    state.componentPath,
  );

if (state.originalComponent === null) {
  fs.rmSync(
    componentPath,
    { force: true },
  );
} else {
  fs.writeFileSync(
    componentPath,
    state.originalComponent,
    "utf8",
  );
}

const cssPath =
  path.join(
    root,
    state.cssPath,
  );

if (state.originalCss === null) {
  fs.rmSync(
    cssPath,
    { force: true },
  );
} else {
  fs.writeFileSync(
    cssPath,
    state.originalCss,
    "utf8",
  );
}

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe Screen Timeline Component V4 rolled back.",
);
