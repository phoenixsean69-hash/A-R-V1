import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-palette-hierarchy-v2.json",
  );

if (!fs.existsSync(statePath)) {
  console.error(
    "No Palette Hierarchy V2 backup state found.",
  );

  process.exit(1);
}

const state =
  JSON.parse(
    fs.readFileSync(statePath, "utf8"),
  );

const mainPath =
  path.join(root, "src/main.tsx");

const palettePath =
  path.join(
    root,
    "src/styles/roadsafePalette.css",
  );

const viewerPath =
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

fs.writeFileSync(
  mainPath,
  state.originalMain,
  "utf8",
);

if (state.originalPalette === null) {
  fs.rmSync(
    palettePath,
    { force: true },
  );
} else {
  fs.writeFileSync(
    palettePath,
    state.originalPalette,
    "utf8",
  );
}

if (state.originalViewer !== null) {
  fs.writeFileSync(
    viewerPath,
    state.originalViewer,
    "utf8",
  );
}

fs.rmSync(
  statePath,
  { force: true },
);

console.log(
  "RoadSafe Palette Hierarchy V2 rolled back.",
);
