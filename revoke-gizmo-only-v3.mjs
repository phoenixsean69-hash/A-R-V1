import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-gizmo-only-v3.json",
  );

if (
  !fs.existsSync(
    statePath,
  )
) {
  console.error(
    "No Gizmo Only V3 backup state found.",
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
  "RoadSafe Gizmo Only V3 rolled back.",
);
