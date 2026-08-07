import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-blender-properties-panel-v1.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No Blender Properties Panel V1 backup state was found.",
  );
  process.exit(1);
}

const state = JSON.parse(
  fs.readFileSync(statePath, "utf8"),
);

const editorPath = path.join(
  root,
  state.editorPath,
);

const cssPath = path.join(
  root,
  state.cssPath,
);

fs.writeFileSync(
  editorPath,
  state.originalEditor,
  "utf8",
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
  "RoadSafe Blender-style Properties Panel V1 revoked.",
);
