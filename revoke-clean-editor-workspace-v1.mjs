import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-clean-editor-workspace-v1.json",
  );

if (!fs.existsSync(statePath)) {
  console.error(
    "No Clean Editor Workspace V1 backup state found.",
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

const bottomDockPath =
  path.join(
    root,
    state.bottomDockPath,
  );

if (
  state.originalBottomDock === null
) {
  fs.rmSync(
    bottomDockPath,
    { force: true },
  );
} else {
  fs.writeFileSync(
    bottomDockPath,
    state.originalBottomDock,
    "utf8",
  );
}

const bottomDockCssPath =
  path.join(
    root,
    state.bottomDockCssPath,
  );

if (
  state.originalBottomDockCss === null
) {
  fs.rmSync(
    bottomDockCssPath,
    { force: true },
  );
} else {
  fs.writeFileSync(
    bottomDockCssPath,
    state.originalBottomDockCss,
    "utf8",
  );
}

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe Clean Editor Workspace V1 rolled back.",
);
