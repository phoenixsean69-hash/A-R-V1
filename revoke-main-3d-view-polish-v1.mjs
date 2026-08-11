import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-main-3d-view-polish-v1.json",
  );

if (
  !fs.existsSync(
    statePath,
  )
) {
  console.error(
    "No Main 3D View Polish V1 backup state found.",
  );

  process.exit(
    1,
  );
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
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  ),
  state.original,
  "utf8",
);

fs.rmSync(
  statePath,
  {
    force:
      true,
  },
);

console.log(
  "RoadSafe Main 3D View Polish V1 rolled back.",
);
