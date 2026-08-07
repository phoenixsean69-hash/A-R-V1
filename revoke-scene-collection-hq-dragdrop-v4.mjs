import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-scene-collection-hq-dragdrop-v4.json",
);

if (!fs.existsSync(statePath)) {
  console.error(
    "No Scene Collection HQ Drag/Drop V4 backup state found.",
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
  path.join(root, state.viewerPath),
  state.originalViewer,
  "utf8",
);

fs.writeFileSync(
  path.join(root, state.pointZPath),
  state.originalPointZ,
  "utf8",
);

for (const [destination, original] of Object.entries(
  state.originalFiles,
)) {
  const full = path.join(root, destination);

  if (original === null) {
    fs.rmSync(full, { force: true });
  } else {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, original, "utf8");
  }
}

if (!state.runtimeExisted) {
  fs.rmSync(
    path.join(
      root,
      "public/assets/roadsafe-premium-participants",
    ),
    { recursive: true, force: true },
  );
}

fs.rmSync(statePath, { force: true });

console.log(
  "RoadSafe Blender Scene Collection HQ Drag/Drop V4 rolled back.",
);
