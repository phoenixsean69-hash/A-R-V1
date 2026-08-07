import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-blender-properties-2d-ar-v6.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No Blender Properties 2D + AR V5 backup state found.",
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
  path.join(root, state.arPath),
  state.originalAR,
  "utf8",
);

fs.writeFileSync(
  path.join(root, state.colourGuardPath),
  state.originalColourGuard,
  "utf8",
);

fs.rmSync(statePath, { force: true });

console.log(
  "RoadSafe Blender Properties 2D + AR V6 rolled back.",
);
