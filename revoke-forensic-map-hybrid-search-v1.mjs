import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-forensic-map-hybrid-search-v1.json",
  );

if (
  !fs.existsSync(
    statePath,
  )
) {
  console.error(
    "No Forensic Map Hybrid + Search V1 backup state found.",
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
    state.mapPath,
  ),
  state.originalMap,
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
  {
    force: true,
  },
);

console.log(
  "RoadSafe Forensic Map Hybrid + Search V1 rolled back.",
);
